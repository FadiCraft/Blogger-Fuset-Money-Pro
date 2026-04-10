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

// --- نظام منع التكرار ---
function loadHistory() {
    try {
        if (fs.existsSync(HISTORY_FILE)) {
            const data = fs.readFileSync(HISTORY_FILE, 'utf8');
            if (!data || data.trim() === '') return [];
            const parsed = JSON.parse(data);
            return Array.isArray(parsed) ? parsed : [];
        }
        return [];
    } catch (error) {
        console.error('❌ Error reading history.json:', error.message);
        return [];
    }
}

function saveToHistory(url) {
    try {
        const history = loadHistory();
        if (!history.includes(url)) {
            history.push(url);
            const trimmedHistory = history.slice(-500);
            fs.writeFileSync(HISTORY_FILE, JSON.stringify(trimmedHistory, null, 2));
            console.log(`📝 Saved to history: ${url}`);
        }
    } catch (error) {
        console.error('❌ Error saving to history.json:', error.message);
    }
}

// --- دالة تأخير ---
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// --- المصادر RSS ---
const RELIABLE_RSS_FEEDS = [
    { 
        name: "IGN", 
        category: "Gaming",
        url: "https://feeds.feedburner.com/ign/all"
    },
    { 
        name: "SammyFans", 
        category: "Technology",
        url: "https://www.sammyfans.com/feed/"
    },
    { 
        name: "Forbes Innovation", 
        category: "Technology",
        url: "https://www.forbes.com/innovation/feed/"
    },
    { 
        name: "9to5Toys", 
        category: "Tech Deals",
        url: "https://9to5toys.com/feed/"
    }
];

// --- استخراج الصور ---
async function extractImages($, url) {
    const images = [];
    const seenUrls = new Set();
    const exclude = ['logo', 'icon', 'avatar', 'banner', 'pixel', 'svg', '1x1', 'blank'];
    
    $('img, picture source').each((i, el) => {
        let src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('srcset');
        if (!src) return;
        
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
                const alt = $(el).attr('alt') || 'Article image';
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
            images: images
        };
    } catch (e) {
        console.error(`❌ Failed to fetch article: ${url}`, e.message);
        return null;
    }
}

// --- الذكاء الاصطناعي: كتابة محتوى إنجليزي احترافي ---
async function generateHighQualityArticle(article, category, sourceName) {
    const prompt = `You are a senior tech journalist and SEO expert. Rewrite the following article into a comprehensive, engaging, and well-structured blog post (800-1000 words) optimized for Google AdSense and search engines.

Source: ${sourceName}
Category: ${category}
Original Title: ${article.title}
Raw Content: ${article.text.substring(0, 8000)}

Strict Guidelines:
1. Language: Professional, fluent English with proper grammar.
2. Structure: Include an engaging introduction, 3-4 detailed sections, and a conclusion.
3. Add a "Quick Overview" box at the beginning.
4. Include a "Pros and Cons" section.
5. Add an "Expert Note" or important tip.
6. Include an FAQ section with 3 common questions.
7. SEO: Use keyword-rich headings and natural keyword placement.

Return ONLY a valid JSON object with this exact structure:

{
    "seoTitle": "SEO-optimized title (max 60 chars)",
    "metaDescription": "Compelling meta description (140-160 chars)",
    "introduction": "Strong, engaging introduction (2-3 paragraphs).",
    "hookBox": {
        "title": "🔍 Quick Overview",
        "points": ["Key point 1", "Key point 2", "Key point 3"]
    },
    "sections": [
        {
            "heading": "First Section Heading",
            "content": "Detailed, valuable content (150+ words)."
        },
        {
            "heading": "Second Section Heading",
            "content": "Detailed, valuable content (150+ words)."
        },
        {
            "heading": "Third Section Heading",
            "content": "Detailed, valuable content (150+ words)."
        }
    ],
    "prosCons": {
        "pros": ["Pro 1", "Pro 2", "Pro 3"],
        "cons": ["Con 1", "Con 2"]
    },
    "importantNote": "Expert insight or crucial tip for readers.",
    "conclusion": "Strong conclusion summarizing the key takeaways.",
    "faqs": [
        {"q": "Frequently asked question?", "a": "Detailed and helpful answer."},
        {"q": "Another common question?", "a": "Comprehensive answer."},
        {"q": "Third FAQ question?", "a": "Informative response."}
    ]
}`;

    try {
        const completion = await groq.chat.completions.create({
            messages: [
                { 
                    role: "system", 
                    content: "You are an expert tech journalist and SEO content writer. You write professional, engaging, and well-structured articles in fluent English." 
                },
                { role: "user", content: prompt }
            ],
            model: "llama-3.3-70b-versatile",
            temperature: 0.7,
            response_format: { type: "json_object" }
        });
        
        const jsonString = completion.choices[0].message.content;
        const cleanJson = jsonString.substring(jsonString.indexOf('{'), jsonString.lastIndexOf('}') + 1);
        return JSON.parse(cleanJson);
        
    } catch (e) {
        console.log("❌ AI Error:", e.message);
        return null;
    }
}

// --- قالب HTML إنجليزي احترافي ---
function getTemplate(content, images, sourceUrl, sourceName) {
    let mainImage = images[0] || { url: 'https://via.placeholder.com/1200x600/2c3e50/ffffff?text=Tech+News', alt: 'Featured Image' };
    let remainingImages = images.slice(1);

    let sectionsHtml = '';
    content.sections.forEach((sec, index) => {
        sectionsHtml += `<h2>${escapeHtml(sec.heading)}</h2>`;
        sectionsHtml += `<p>${escapeHtml(sec.content).replace(/\n/g, '<br>')}</p>`;
        
        if (index % 2 === 0 && remainingImages.length > 0) {
            let img = remainingImages.shift();
            sectionsHtml += `
            <figure class="article-figure">
                <img src="${img.url}" alt="${escapeHtml(img.alt)}" loading="lazy" width="800" height="450">
                <figcaption>${escapeHtml(img.alt)}</figcaption>
            </figure>`;
        }
    });

    const schemaData = {
        "@context": "https://schema.org",
        "@type": "TechArticle",
        "headline": content.seoTitle,
        "image": mainImage.url,
        "datePublished": new Date().toISOString().split('T')[0],
        "author": { "@type": "Organization", "name": "Tech News Hub" },
        "inLanguage": "en"
    };

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="${escapeHtml(content.metaDescription)}">
    <title>${escapeHtml(content.seoTitle)}</title>
    
    <script type="application/ld+json">
    ${JSON.stringify(schemaData)}
    </script>
    
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            line-height: 1.8;
            color: #1a1a1a;
            font-size: 18px;
            background: #fff;
            padding: 20px;
            max-width: 900px;
            margin: 0 auto;
        }
        
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
        
        .hook-box {
            background: linear-gradient(145deg, #f6f9fc 0%, #eef2f6 100%);
            border-left: 6px solid #e67e22;
            padding: 25px;
            margin: 35px 0;
            border-radius: 12px;
        }
        .hook-box h3 {
            margin-top: 0;
            color: #d35400;
            font-size: 1.5rem;
        }
        .hook-box ul { padding-left: 20px; }
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
        
        .conclusion-box {
            background: #e8f4fd;
            border: 1px solid #b6e0fe;
            padding: 22px;
            border-radius: 12px;
            margin: 30px 0;
            font-size: 1.1rem;
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
        
        .source-footer a {
            color: #3182ce;
            text-decoration: none;
        }
        
        .source-footer a:hover {
            text-decoration: underline;
        }
        
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
                <h3>✅ Pros</h3>
                <ul>${content.prosCons.pros.map(p => `<li>${escapeHtml(p)}</li>`).join('')}</ul>
            </div>
            <div class="cons">
                <h3>❌ Cons</h3>
                <ul>${content.prosCons.cons.map(c => `<li>${escapeHtml(c)}</li>`).join('')}</ul>
            </div>
        </div>
        
        ${content.conclusion ? `<div class="conclusion-box">📌 ${escapeHtml(content.conclusion)}</div>` : ''}
        
        <h2>❓ Frequently Asked Questions</h2>
        ${content.faqs.map(faq => `
            <div class="faq-item">
                <h3>${escapeHtml(faq.q)}</h3>
                <p>${escapeHtml(faq.a)}</p>
            </div>
        `).join('')}
        
        <div class="source-footer">
            <p>📌 This article was curated by our editorial team based on reporting from ${sourceName}. 
            <a href="${sourceUrl}" target="_blank" rel="nofollow noopener">Read the original source</a>.</p>
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

// --- النشر على بلوجر ---
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
                labels: [category]
            }
        });
        return true;
    } catch (e) {
        console.log(`❌ Blogger API Error: ${e.message}`);
        if (e.response) console.log(e.response.data);
        return false;
    }
}

// --- معالجة مقال واحد من مصدر معين ---
async function processArticleFromSource(feed, history) {
    console.log(`\n📡 Checking: ${feed.name} (${feed.url})`);
    
    try {
        const parsed = await parser.parseURL(feed.url);
        
        // أخذ أحدث مقال فقط
        const latestItem = parsed.items[0];
        
        if (!latestItem) {
            console.log(`⚠️ No articles found in ${feed.name}`);
            return false;
        }
        
        if (history.includes(latestItem.link)) {
            console.log(`⏩ Already published from ${feed.name}: ${latestItem.title}`);
            return false;
        }
        
        console.log(`🆕 New article from ${feed.name}: ${latestItem.title}`);
        console.log(`🔗 URL: ${latestItem.link}`);
        
        // جلب المحتوى
        const rawArticle = await fetchArticleContent(latestItem.link);
        if (!rawArticle || rawArticle.images.length === 0) {
            console.log(`❌ Failed to fetch sufficient content from ${feed.name}`);
            return false;
        }
        
        console.log(`✅ Fetched ${rawArticle.images.length} images`);
        console.log(`🤖 Generating high-quality article...`);
        
        // كتابة المقال
        const content = await generateHighQualityArticle(rawArticle, feed.category, feed.name);
        if (!content) {
            console.log(`❌ Failed to generate content`);
            return false;
        }
        
        // إنشاء HTML
        const html = getTemplate(content, rawArticle.images, latestItem.link, feed.name);
        
        // نشر المقال
        console.log(`📤 Publishing to Blogger...`);
        const published = await publishPost(content, html, feed.category);
        
        if (published) {
            saveToHistory(latestItem.link);
            console.log(`✅✅✅ Successfully published from ${feed.name}!`);
            return true;
        }
        
        return false;
        
    } catch (error) {
        console.error(`❌ Error processing ${feed.name}:`, error.message);
        return false;
    }
}

// --- البوت الرئيسي ---
async function startBot() {
    console.log('🚀 Starting Multi-Source Publishing Bot...\n');
    
    const history = loadHistory();
    
    if (!Array.isArray(history)) {
        console.error('❌ Error in history.json. Reinitializing.');
        fs.writeFileSync(HISTORY_FILE, '[]');
    }
    
    let publishedCount = 0;
    
    // معالجة كل مصدر على حدة
    for (let i = 0; i < RELIABLE_RSS_FEEDS.length; i++) {
        const feed = RELIABLE_RSS_FEEDS[i];
        
        console.log(`\n${'='.repeat(50)}`);
        console.log(`📰 Source (${i + 1}/${RELIABLE_RSS_FEEDS.length}): ${feed.name}`);
        console.log(`${'='.repeat(50)}`);
        
        const success = await processArticleFromSource(feed, history);
        
        if (success) {
            publishedCount++;
        }
        
        // انتظار دقيقة بين كل مصدر وآخر (ما عدا الأخير)
        if (i < RELIABLE_RSS_FEEDS.length - 1) {
            console.log(`\n⏳ Waiting 60 seconds before next source...`);
            await delay(60000);
        }
    }
    
    console.log(`\n${'='.repeat(50)}`);
    console.log(`🏁 Run complete. Published ${publishedCount} new article(s).`);
    console.log(`${'='.repeat(50)}`);
}

// بدء التشغيل
startBot();
