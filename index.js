const Parser = require('rss-parser');
const { JSDOM } = require('jsdom');
const { Readability } = require('@mozilla/readability');
const cheerio = require('cheerio');
const { google } = require('googleapis');
const Groq = require('groq-sdk');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// --- الإعدادات والمفاتيح ---
const BLOG_ID = process.env.BLOG_ID || "2636919176960128451";
const CLIENT_ID = process.env.CLIENT_ID || "872415365656-7qribadnc7k2u21kl6jjcbatdueevifh.apps.googleusercontent.com";
const CLIENT_SECRET = process.env.CLIENT_SECRET || "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";
const REFRESH_TOKEN = process.env.REFRESH_TOKEN || "1//04yti9k2agPknCgYIARAAGAQSNwF-L9IrTZPKt5Fqbg2vrM9sBtOks9cnY4M7Idg0LToQnlbYGME06k20vcyr_SVmYk1H_yZJdEc";
const GROQ_API_KEY = process.env.GROQ_API_KEY || "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";

const groq = new Groq({ apiKey: GROQ_API_KEY });
const parser = new Parser({ timeout: 30000 });
const HISTORY_FILE = path.join(__dirname, 'history.json');

// --- نظام منع التكرار ---
function loadHistory() {
    if (fs.existsSync(HISTORY_FILE)) {
        return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
    }
    return [];
}
function saveToHistory(url) {
    const history = loadHistory();
    history.push(url);
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
}

// --- المصادر ---
const RELIABLE_RSS_FEEDS = {
    "Technology": [{ name: "The Verge", url: "https://www.theverge.com/rss/index.xml" }], // أضف مصادرك هنا
    "Video Games": [{ name: "IGN", url: "https://feeds.feedburner.com/ign/all" }]
};

// --- استخراج الصور بدقة ---
async function extractImages($, url) {
    const images = [];
    const seenUrls = new Set();
    const exclude = ['logo', 'icon', 'avatar', 'banner', 'pixel', 'svg'];
    
    // البحث في أكثر من وسم لضمان جلب كل الصور
    $('img, picture source').each((i, el) => {
        const src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('srcset');
        if (!src) return;
        
        let cleanUrl = src.split(' ')[0].split('?')[0]; // تنظيف الرابط
        if (cleanUrl.startsWith('http')) {
            const isExcluded = exclude.some(p => cleanUrl.toLowerCase().includes(p));
            if (!isExcluded && cleanUrl.match(/\.(jpg|jpeg|png|webp)/i) && !seenUrls.has(cleanUrl)) {
                seenUrls.add(cleanUrl);
                const alt = $(el).attr('alt') || 'صورة توضيحية للمقال';
                images.push({ url: cleanUrl, alt });
            }
        }
    });
    return images; // نأخذ كل الصور المتاحة
}

async function fetchArticleContent(url) {
    try {
        const response = await axios.get(url, { timeout: 20000 });
        const dom = new JSDOM(response.data, { url });
        const reader = new Readability(dom.window.document);
        const article = reader.parse();
        
        if (!article || article.textContent.length < 800) return null; // تجاهل المقالات القصيرة جداً

        const $ = cheerio.load(response.data); // تحميل الصفحة كاملة للصور
        const images = await extractImages($, url);
        
        return {
            url: url,
            title: article.title,
            text: article.textContent.replace(/\s+/g, ' ').slice(0, 15000), // أخذ نص أطول
            images: images
        };
    } catch (e) {
        return null;
    }
}

// --- العقل المدبر: الذكاء الاصطناعي ---
async function generateHighQualityArticle(article, category) {
    const prompt = `Act as a Senior Tech/Gaming Journalist. Analyze this raw article and rewrite a comprehensive, highly detailed, engaging article (Target: 1000+ words) optimized for Google AdSense and SEO.

Category: ${category}
Original Title: ${article.title}
Raw Text: ${article.text.substring(0, 8000)}

Return EXACTLY a JSON object with this structure:
{
    "seoTitle": "Catchy SEO Title (Max 60 chars)",
    "metaDescription": "SEO Description (Max 160 chars)",
    "introduction": "A strong, engaging introduction (2-3 paragraphs).",
    "hookBox": {
        "title": "Quick Overview / At a Glance",
        "points": ["Expected Price: ...", "Release Date: ...", "Key Feature: ..."]
    },
    "sections": [
        {
            "heading": "Detailed Section Heading (e.g., Specs, Gameplay, Comparisons)",
            "content": "Deep, comprehensive paragraphs (at least 200 words per section). Compare with previous versions if applicable."
        }
    ],
    "prosCons": {
        "pros": ["Pro 1", "Pro 2", "Pro 3"],
        "cons": ["Con 1", "Con 2"]
    },
    "importantNote": "A crucial tip, warning, or expert note for the reader.",
    "faqs": [
        {"q": "A question users often Google about this?", "a": "Detailed answer."}
    ]
}`;

    try {
        const completion = await groq.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model: "llama-3.3-70b-versatile",
            temperature: 0.7, // إعطاء مساحة للإبداع
            response_format: { type: "json_object" }
        });
        return JSON.parse(completion.choices[0].message.content);
    } catch (e) {
        console.log("AI Error:", e.message);
        return null;
    }
}

// --- تصميم القالب (HTML/CSS) ---
function getTemplate(content, images) {
    let mainImage = images[0] || { url: '', alt: 'Main Image' };
    let remainingImages = images.slice(1);

    // بناء المحتوى المفصل (مع دمج الصور بين الفقرات)
    let sectionsHtml = '';
    content.sections.forEach((sec, index) => {
        sectionsHtml += `<h2>${escapeHtml(sec.heading)}</h2><p>${escapeHtml(sec.content).replace(/\n/g, '<br>')}</p>`;
        // حقن صورة بعد كل فقرتين إذا توفرت صور
        if (index % 2 === 0 && remainingImages.length > 0) {
            let img = remainingImages.shift();
            sectionsHtml += `<figure class="content-img"><img src="${img.url}" alt="${escapeHtml(img.alt)}" loading="lazy"></figure>`;
        }
    });

    return `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.8; color: #333; font-size: 18px; }
        .hero-img { width: 100%; max-height: 400px; object-fit: cover; border-radius: 12px; margin: 20px 0; }
        .content-img { margin: 30px 0; text-align: center; }
        .content-img img { max-width: 100%; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.1); }
        h1 { color: #1a1a1a; font-size: 2.2rem; margin-bottom: 10px; }
        h2 { color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 5px; margin-top: 40px; }
        
        /* صندوق التشويق */
        .hook-box { background: #f8f9fa; border-right: 4px solid #e67e22; padding: 20px; margin: 30px 0; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.05); }
        .hook-box h3 { margin-top: 0; color: #d35400; }
        .hook-box ul { margin: 0; padding-right: 20px; }
        .hook-box li { margin-bottom: 10px; font-weight: bold; }
        
        /* صندوق الملاحظات الهامة */
        .highlight-box { background: #e8f4fd; border: 1px solid #b6e0fe; padding: 20px; border-radius: 8px; margin: 30px 0; font-weight: bold; color: #0056b3; }
        .highlight-box::before { content: '💡'; color: #004494; font-size: 1.1em; }

        /* الإيجابيات والسلبيات */
        .pros-cons { display: flex; gap: 20px; margin: 40px 0; flex-wrap: wrap; }
        .pros, .cons { flex: 1; min-width: 300px; padding: 20px; border-radius: 8px; }
        .pros { background: #e9f7ef; border: 1px solid #c3e6cb; }
        .cons { background: #fdedec; border: 1px solid #f5c6cb; }
        .pros h3 { color: #27ae60; margin-top: 0; }
        .cons h3 { color: #c0392b; margin-top: 0; }
        .pros ul li::marker { content: ''; }
        .cons ul li::marker { content: ''; }

        /* الأسئلة الشائعة */
        .faq { background: #fff; border: 1px solid #eee; padding: 20px; border-radius: 8px; margin-top: 40px; }
        .faq h3 { color: #2c3e50; margin-bottom: 5px; }
        .faq p { margin-top: 5px; color: #555; }
    </style>
</head>
<body>
    <h1>${escapeHtml(content.seoTitle)}</h1>
    
    <p>${escapeHtml(content.introduction).replace(/\n/g, '<br>')}</p>
    
    ${mainImage.url ? `<img src="${mainImage.url}" alt="${escapeHtml(mainImage.alt)}" class="hero-img">` : ''}
    
    <div class="hook-box">
        <h3>${escapeHtml(content.hookBox.title)}</h3>
        <ul>
            ${content.hookBox.points.map(p => `<li>${escapeHtml(p)}</li>`).join('')}
        </ul>
    </div>
    
    <div class="main-content">
        ${sectionsHtml}
    </div>
    
    ${content.importantNote ? `<div class="highlight-box">${escapeHtml(content.importantNote)}</div>` : ''}
    
    <div class="pros-cons">
        <div class="pros">
            <h3>Advantages</h3>
            <ul>${content.prosCons.pros.map(p => `<li>${escapeHtml(p)}</li>`).join('')}</ul>
        </div>
        <div class="cons">
            <h3>Disadvantages</h3>
            <ul>${content.prosCons.cons.map(c => `<li>${escapeHtml(c)}</li>`).join('')}</ul>
        </div>
    </div>
    
    <h2>(FAQ)</h2>
    ${content.faqs.map(faq => `
        <div class="faq">
            <h3>${escapeHtml(faq.q)}</h3>
            <p>${escapeHtml(faq.a)}</p>
        </div>
    `).join('')}

</body>
</html>`;
}

function escapeHtml(str) { return str ? str.replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m])) : ''; }


// --- دالة النشر في بلوجر ---
async function publishPost(content, html, category) {
    try {
        const auth = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET);
        auth.setCredentials({ refresh_token: REFRESH_TOKEN });
        const blogger = google.blogger({ version: 'v3', auth });
        
        console.log(`📡 جاري الاتصال بـ Blogger لنشر المقال...`);
        
        await blogger.posts.insert({
            blogId: BLOG_ID,
            requestBody: {
                title: content.seoTitle, // العنوان من الذكاء الاصطناعي
                content: html,           // المحتوى المنسق بـ HTML
                labels: [category]       // القسم
            }
        });
        
        return true;
    } catch (e) {
        console.log(`❌ خطأ في API بلوجر: ${e.message}`);
        return false;
    }
}

// --- البوت الرئيسي ---
async function startBot() {
    const history = loadHistory();
    const category = "Technology"; // تجربة على قسم واحد
    const feeds = RELIABLE_RSS_FEEDS[category];
    
    for (const feed of feeds) {
        const parsed = await parser.parseURL(feed.url);
        
        for (const item of parsed.items) {
            if (history.includes(item.link)) {
                console.log(`⏩ تم النشر مسبقاً، تخطي: ${item.title}`);
                continue;
            }

            console.log(`⏳ جاري المعالجة: ${item.title}`);
            const rawArticle = await fetchArticleContent(item.link);
            
            if (rawArticle && rawArticle.images.length > 0) {
                console.log(`🧠 جاري كتابة المقال الاحترافي (1000+ كلمة)...`);
                const content = await generateHighQualityArticle(rawArticle, category);
                
                if (content) {
                    const html = getTemplate(content, rawArticle.images);
                    
                    // هنا تقوم بالنشر عبر API بلوجر
                     await publishPost(content, html, category);
                    
                    saveToHistory(item.link); // حفظ الرابط حتى لا يتكرر
                    console.log(`✅ تم تجهيز ونشر المقال بنجاح!`);
                    process.exit(0); // إنهاء بعد مقال واحد للتجربة
                }
            }
        }
    }
}

startBot();
