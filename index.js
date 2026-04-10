const Parser = require('rss-parser');
const { JSDOM } = require('jsdom');
const { Readability } = require('@mozilla/readability');
const cheerio = require('cheerio');
const { google } = require('googleapis');
const Groq = require('groq-sdk');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// --- الإعدادات ---
const BLOG_ID = process.env.BLOG_ID || "2636919176960128451";
const CLIENT_ID = process.env.CLIENT_ID || "872415365656-7qribadnc7k2u21kl6jjcbatdueevifh.apps.googleusercontent.com";
const CLIENT_SECRET = process.env.CLIENT_SECRET || "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";
const REFRESH_TOKEN = process.env.REFRESH_TOKEN || "1//04yti9k2agPknCgYIARAAGAQSNwF-L9IrTZPKt5Fqbg2vrM9sBtOks9cnY4M7Idg0LToQnlbYGME06k20vcyr_SVmYk1H_yZJdEc";
const GROQ_API_KEY = process.env.GROQ_API_KEY || "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";

const groq = new Groq({ apiKey: GROQ_API_KEY });
const parser = new Parser({ timeout: 30000 });
const HISTORY_FILE = path.join(__dirname, 'history.json');

// --- نظام منع التكرار (نسخة كاملة وصحيحة) ---
function loadHistory() {
    try {
        if (fs.existsSync(HISTORY_FILE)) {
            const data = fs.readFileSync(HISTORY_FILE, 'utf8');
            // التأكد من أن الملف ليس فارغاً
            if (!data || data.trim() === '') {
                return [];
            }
            const parsed = JSON.parse(data);
            // التأكد من أن البيانات عبارة عن مصفوفة
            return Array.isArray(parsed) ? parsed : [];
        }
        return []; // ✅ هذا هو المهم: إرجاع مصفوفة فارغة إذا لم يوجد الملف
    } catch (error) {
        console.error('❌ خطأ في قراءة ملف history.json:', error.message);
        return []; // ✅ إرجاع مصفوفة فارغة في حالة أي خطأ
    }
}

function saveToHistory(url) {
    try {
        const history = loadHistory(); // الآن مضمون أنها مصفوفة
        // منع التكرار (فحص إضافي)
        if (!history.includes(url)) {
            history.push(url);
            // الاحتفاظ بآخر 500 رابط فقط لمنع تضخم الملف
            const trimmedHistory = history.slice(-500);
            fs.writeFileSync(HISTORY_FILE, JSON.stringify(trimmedHistory, null, 2));
            console.log(`📝 تم الحفظ في السجل: ${url}`);
        }
    } catch (error) {
        console.error('❌ خطأ في حفظ ملف history.json:', error.message);
    }
}
// --- المصادر ---
const RELIABLE_RSS_FEEDS = {
    "Technology": [{ name: "The Verge", url: "https://www.theverge.com/rss/index.xml" }],
    "Video Games": [{ name: "IGN", url: "https://feeds.feedburner.com/ign/all" }]
};

// --- استخراج الصور (مع فلترة محسنة) ---
async function extractImages($, url) {
    const images = [];
    const seenUrls = new Set();
    const exclude = ['logo', 'icon', 'avatar', 'banner', 'pixel', 'svg', '1x1', 'blank'];
    
    $('img, picture source').each((i, el) => {
        let src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('srcset');
        if (!src) return;
        
        // تنظيف الرابط: أخذ أعلى دقة في srcset إن وجدت
        if (src.includes(',')) {
            const parts = src.split(',');
            let maxRes = { url: '', size: 0 };
            parts.forEach(part => {
                const [urlPart, sizePart] = part.trim().split(' ');
                const size = parseInt(sizePart) || 0;
                if (size > maxRes.size) maxRes = { url: urlPart, size };
            });
            src = maxRes.url;
        }
        
        let cleanUrl = src.split('?')[0]; 
        if (cleanUrl.startsWith('http')) {
            const isExcluded = exclude.some(p => cleanUrl.toLowerCase().includes(p));
            const isImage = cleanUrl.match(/\.(jpg|jpeg|png|webp)/i);
            
            if (!isExcluded && isImage && !seenUrls.has(cleanUrl)) {
                seenUrls.add(cleanUrl);
                const alt = $(el).attr('alt') || 'صورة توضيحية للمحتوى التقني';
                images.push({ url: cleanUrl, alt });
            }
        }
    });
    return images;
}

async function fetchArticleContent(url) {
    try {
        const response = await axios.get(url, { 
            timeout: 20000,
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' }
        });
        const dom = new JSDOM(response.data, { url });
        const reader = new Readability(dom.window.document);
        const article = reader.parse();
        
        if (!article || article.textContent.length < 500) return null; 

        const $ = cheerio.load(response.data);
        const images = await extractImages($, url);
        
        return {
            url: url,
            title: article.title,
            text: article.textContent.replace(/\s+/g, ' ').slice(0, 12000), 
            images: images,
            excerpt: article.excerpt
        };
    } catch (e) {
        console.error(`❌ فشل جلب المقال: ${url}`);
        return null;
    }
}

// --- تحسين Prompt الذكاء الاصطناعي (للغة العربية والجودة) ---
async function generateHighQualityArticle(article, category) {
    const prompt = `
أنت محرر تقني محترف ومتخصص في كتابة مقالات عربية شاملة لموقع تقني. 
**مهمتك:** إعادة كتابة المقال التالي وتحويله إلى مقال عربي احترافي طويل (أكثر من 800 كلمة) وجذاب لمحركات البحث (SEO) وجوجل أدسنس.

**الفئة:** ${category}
**عنوان المصدر:** ${article.title}
**النص الخام:** ${article.text.substring(0, 7000)}

**تعليمات صارمة:**
1. **اللغة:** الانجليزيه السليمة فقط. لا تستخدم العامية أو الركاكة.
2. **الهيكل:** يجب أن يحتوي على مقدمة مشوقة، وهيكل واضح بعناوين فرعية (H2).
3. **التنسيق:** أضف فقرة "نظرة سريعة" (Quick Overview) في البداية.
4. **الإثراء:** أضف رأي خبير أو ملاحظة هامة.
5. **المصطلحات:** حافظ على المصطلحات التقنية بالإنجليزية بين قوسين إن لزم الأمر (مثل: معالج A17 Pro).

**أعد الرد بصيغة JSON فقط بدون أي نصوص إضافية خارج الأقواس:**
{
    "seoTitle": "عنوان SEO انجليزي جذاب (لا يزيد عن 60 حرف)",
    "metaDescription": "وصف ميتا انجليزي (140-160 حرف) يشجع على النقر",
    "introduction": "مقدمة قوية من 3-4 أسطر تشرح أهمية الموضوع.",
    "hookBox": {
        "title": "🔍 نظرة سريعة على الموضوع",
        "points": ["النقطة الرئيسية 1", "النقطة الرئيسية 2", "النقطة الرئيسية 3"]
    },
    "sections": [
        {
            "heading": "عنوان القسم الأول (H2)",
            "content": "محتوى غني ومفصل للقسم (150 كلمة على الأقل)."
        },
        {
            "heading": "عنوان القسم الثاني (H2)",
            "content": "محتوى غني ومفصل للقسم الثاني (150 كلمة على الأقل)."
        }
    ],
    "prosCons": {
        "pros": ["ميزة 1", "ميزة 2", "ميزة 3"],
        "cons": ["عيب 1", "عيب 2"]
    },
    "importantNote": "نصيحة خبير أو تحذير مهم للقارئ.",
    "faqs": [
        {"q": "سؤال شائع بالعربية؟", "a": "إجابة مفصلة ومفيدة."},
        {"q": "سؤال شائع آخر؟", "a": "إجابة شاملة."}
    ]
}`;

    try {
        const completion = await groq.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model: "llama-3.3-70b-versatile",
            temperature: 0.6,
            response_format: { type: "json_object" }
        });
        
        const jsonString = completion.choices[0].message.content;
        // تنظيف أي نصوص زائدة قد يضيفها النموذج أحياناً
        const cleanJson = jsonString.substring(jsonString.indexOf('{'), jsonString.lastIndexOf('}') + 1);
        return JSON.parse(cleanJson);
        
    } catch (e) {
        console.log("❌ خطأ في تحليل رد الذكاء الاصطناعي:", e.message);
        return null;
    }
}

// --- تصميم قالب HTML احترافي (صور ثابتة الحجم + Schema) ---
function getTemplate(content, images, sourceUrl) {
    let mainImage = images[0] || { url: 'https://via.placeholder.com/1200x600/3498db/ffffff?text=Tech+News', alt: 'الصورة الرئيسية' };
    let remainingImages = images.slice(1);

    // بناء المحتوى مع توزيع الصور (كلها بحجم ثابت)
    let sectionsHtml = '';
    content.sections.forEach((sec, index) => {
        sectionsHtml += `<h2>${escapeHtml(sec.heading)}</h2>`;
        sectionsHtml += `<p>${escapeHtml(sec.content).replace(/\n/g, '<br>')}</p>`;
        
        // حقن صورة بعد كل قسم إذا توفرت (وليس عشوائياً)
        if (remainingImages.length > 0) {
            let img = remainingImages.shift();
            sectionsHtml += `
            <figure class="article-figure">
                <img src="${img.url}" alt="${escapeHtml(img.alt)}" loading="lazy" width="800" height="450">
                <figcaption>${escapeHtml(img.alt)}</figcaption>
            </figure>`;
        }
    });

    // بناء Schema.org للمقال
    const schemaData = {
        "@context": "https://schema.org",
        "@type": "TechArticle",
        "headline": content.seoTitle,
        "image": mainImage.url,
        "datePublished": new Date().toISOString().split('T')[0],
        "author": { "@type": "Organization", "name": "اسم مدونتك التقنية" }
    };

    return `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="${escapeHtml(content.metaDescription)}">
    <title>${escapeHtml(content.seoTitle)}</title>
    
    <!-- Schema.org Markup (Google Rich Results) -->
    <script type="application/ld+json">
    ${JSON.stringify(schemaData)}
    </script>
    
    <style>
        /* ========== أساسيات متجاوبة ========== */
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: 'Tajawal', 'Segoe UI', Tahoma, sans-serif;
            line-height: 1.9;
            color: #222;
            font-size: 18px;
            background: #fff;
            padding: 20px;
            max-width: 900px;
            margin: 0 auto;
            direction: rtl;
        }
        
        /* ========== تنسيق الصور (الحل السحري للحجم الثابت) ========== */
        .hero-image {
            margin: 25px 0;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 10px 25px rgba(0,0,0,0.1);
        }
        .hero-image img {
            width: 100%;
            height: auto;
            max-height: 450px;
            object-fit: cover;
            display: block;
        }
        
        .article-figure {
            margin: 35px 0;
            text-align: center;
            background: #f4f7f9;
            padding: 10px;
            border-radius: 12px;
        }
        .article-figure img {
            /* الحجم الثابت لجميع صور المقال الداخلية */
            width: 100%;
            max-width: 800px;
            height: auto;
            aspect-ratio: 16 / 9;
            object-fit: cover;
            border-radius: 8px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.08);
            border: 1px solid #eee;
        }
        figcaption {
            margin-top: 8px;
            color: #555;
            font-size: 0.9rem;
            font-style: italic;
        }
        
        /* ========== عناوين SEO ========== */
        h1 {
            font-size: 2.4rem;
            font-weight: 800;
            line-height: 1.3;
            margin: 20px 0 15px;
            color: #0a2540;
        }
        h2 {
            font-size: 1.8rem;
            font-weight: 700;
            margin: 40px 0 15px;
            color: #1a365d;
            border-bottom: 3px solid #3182ce;
            padding-bottom: 8px;
        }
        
        /* ========== صناديق التحسين ========== */
        .hook-box {
            background: linear-gradient(145deg, #f6f9fc 0%, #eef2f6 100%);
            border-right: 6px solid #e67e22;
            padding: 25px;
            margin: 35px 0;
            border-radius: 12px;
        }
        .hook-box h3 {
            margin-top: 0;
            color: #d35400;
            font-size: 1.5rem;
        }
        .hook-box ul { padding-right: 20px; }
        .hook-box li { margin-bottom: 12px; font-weight: 500; }
        
        .pros-cons {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 25px;
            margin: 40px 0;
        }
        .pros, .cons {
            padding: 25px;
            border-radius: 16px;
            box-shadow: 0 5px 10px rgba(0,0,0,0.02);
        }
        .pros { background: #e9f7ef; border: 1px solid #a3e0c0; }
        .cons { background: #fdedec; border: 1px solid #f5b7b1; }
        .pros h3 { color: #0e6245; margin-bottom: 15px; }
        .cons h3 { color: #a93226; margin-bottom: 15px; }
        
        .highlight-box {
            background: #fff8e7;
            border: 1px solid #ffcd94;
            padding: 22px;
            border-radius: 12px;
            margin: 30px 0;
            font-weight: 500;
            color: #7d4a00;
        }
        
        .faq-item {
            background: #fff;
            border: 1px solid #e2e8f0;
            padding: 20px;
            border-radius: 12px;
            margin-bottom: 15px;
            transition: all 0.2s ease;
        }
        .faq-item:hover { box-shadow: 0 5px 15px rgba(0,0,0,0.05); }
        .faq-item h3 { 
            color: #2b6cb0; 
            margin: 0 0 8px 0; 
            font-size: 1.3rem;
            border: none;
        }
        
        .source-footer {
            margin-top: 50px;
            padding: 20px;
            background: #f8fafc;
            border-radius: 20px;
            text-align: center;
            color: #64748b;
            border-top: 1px solid #cbd5e1;
        }
        
        /* ========== تجاوب مع الجوال ========== */
        @media (max-width: 600px) {
            body { font-size: 16px; padding: 15px; }
            h1 { font-size: 1.8rem; }
            h2 { font-size: 1.5rem; }
            .pros-cons { grid-template-columns: 1fr; }
        }
    </style>
</head>
<body>
    <article>
        <h1>${escapeHtml(content.seoTitle)}</h1>
        
        <div class="hero-image">
            <img src="${mainImage.url}" alt="${escapeHtml(mainImage.alt)}" width="1200" height="600">
        </div>
        
        <div class="introduction">
            ${content.introduction.split('\n').map(p => `<p>${escapeHtml(p)}</p>`).join('')}
        </div>
        
        <div class="hook-box">
            <h3>${escapeHtml(content.hookBox.title)}</h3>
            <ul>
                ${content.hookBox.points.map(p => `<li>${escapeHtml(p)}</li>`).join('')}
            </ul>
        </div>
        
        ${sectionsHtml}
        
        ${content.importantNote ? `<div class="highlight-box">💡 ${escapeHtml(content.importantNote)}</div>` : ''}
        
        <div class="pros-cons">
            <div class="pros">
                <h3>✅ المميزات</h3>
                <ul>${content.prosCons.pros.map(p => `<li>${escapeHtml(p)}</li>`).join('')}</ul>
            </div>
            <div class="cons">
                <h3>❌ العيوب</h3>
                <ul>${content.prosCons.cons.map(c => `<li>${escapeHtml(c)}</li>`).join('')}</ul>
            </div>
        </div>
        
        <h2>❓ الأسئلة الشائعة (FAQ)</h2>
        ${content.faqs.map(faq => `
            <div class="faq-item">
                <h3>${escapeHtml(faq.q)}</h3>
                <p>${escapeHtml(faq.a)}</p>
            </div>
        `).join('')}
        
        <div class="source-footer">
            <p>📌 تم تحرير هذا المقال بواسطة فريق التحرير لدينا بناءً على مصادر موثوقة. 
            <a href="${sourceUrl}" target="_blank" rel="nofollow noopener">المصدر الأصلي للخبر</a>.</p>
        </div>
    </article>
</body>
</html>`;
}

function escapeHtml(str) { 
    if (!str) return '';
    return String(str).replace(/[&<>"]/g, function(m) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m];
    });
}

// --- النشر على بلوجر (كما هو) ---
async function publishPost(content, html, category) {
    try {
        const auth = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET);
        auth.setCredentials({ refresh_token: REFRESH_TOKEN });
        const blogger = google.blogger({ version: 'v3', auth });
        
        await blogger.posts.insert({
            blogId: BLOG_ID,
            requestBody: {
                title: content.seoTitle,
                content: html,
                labels: [category],
                // إضافة وصف ميتا مخصص (Blogger يدعم هذا عبر Custom Meta Tags)
                customMetaData: `&lt;meta name="description" content="${content.metaDescription}"&gt;`
            }
        });
        return true;
    } catch (e) {
        console.log(`❌ خطأ في API بلوجر: ${e.message}`);
        if (e.response) console.log(e.response.data);
        return false;
    }
}

// --- البوت الرئيسي ---
async function startBot() {
    const history = loadHistory();
    const category = "Technology";
    const feeds = RELIABLE_RSS_FEEDS[category];
    
    for (const feed of feeds) {
        const parsed = await parser.parseURL(feed.url);
        
        for (const item of parsed.items.slice(0, 1)) { // نشر أول مقال فقط للاختبار
            if (history.includes(item.link)) continue;

            console.log(`⏳ جاري المعالجة: ${item.title}`);
            const rawArticle = await fetchArticleContent(item.link);
            
            if (rawArticle && rawArticle.images.length > 0) {
                const content = await generateHighQualityArticle(rawArticle, category);
                
                if (content) {
                    const html = getTemplate(content, rawArticle.images, item.link);
                    await publishPost(content, html, category);
                    saveToHistory(item.link);
                    console.log(`✅ تم النشر بنجاح!`);
                    process.exit(0);
                }
            }
        }
    }
}

startBot();
