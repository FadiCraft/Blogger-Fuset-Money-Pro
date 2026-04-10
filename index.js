const Parser = require('rss-parser');
const { JSDOM } = require('jsdom');
const { Readability } = require('@mozilla/readability');
const cheerio = require('cheerio');
const { google } = require('googleapis');
const Groq = require('groq-sdk');
const axios = require('axios');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// ============================================
// الإعدادات والمفاتيح
// ============================================
const BLOG_ID = process.env.BLOG_ID || "2636919176960128451";
const CLIENT_ID = process.env.CLIENT_ID || "872415365656-7qribadnc7k2u21kl6jjcbatdueevifh.apps.googleusercontent.com";
const CLIENT_SECRET = process.env.CLIENT_SECRET || "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";
const REFRESH_TOKEN = process.env.REFRESH_TOKEN || "1//04yti9k2agPknCgYIARAAGAQSNwF-L9IrTZPKt5Fqbg2vrM9sBtOks9cnY4M7Idg0LToQnlbYGME06k20vcyr_SVmYk1H_yZJdEc";
const GROQ_API_KEY = process.env.GROQ_API_KEY || "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";

const groq = new Groq({ apiKey: GROQ_API_KEY });
const parser = new Parser({ 
    timeout: 30000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*'
    }
});

const HISTORY_FILE = path.join(__dirname, 'history.json');

// ============================================
// نظام منع التكرار
// ============================================
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
            console.log(`📝 Saved to history: ${url.substring(0, 60)}...`);
        }
    } catch (error) {
        console.error('❌ Error saving to history.json:', error.message);
    }
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================
// المصادر (مع تحديد طريقة الجلب)
// usePuppeteer: true للمواقع المحمية بCloudflare
// usePuppeteer: false لمواقع WordPress/Blogger العادية
// ============================================
const SOURCES = [
    { 
        name: "IGN", 
        category: "Gaming", 
        url: "https://feeds.feedburner.com/ign/all", 
        usePuppeteer: true,
        description: "Gaming & Entertainment News"
    },
    { 
        name: "Forbes Innovation", 
        category: "Technology", 
        url: "https://www.forbes.com/innovation/feed/", 
        usePuppeteer: true,
        description: "Tech & Business Innovation"
    },
    { 
        name: "The Verge", 
        category: "Technology", 
        url: "https://www.theverge.com/rss/index.xml", 
        usePuppeteer: false,
        description: "Tech, Science & Culture"
    },
    { 
        name: "9to5Toys", 
        category: "Deals", 
        url: "https://9to5toys.com/feed/", 
        usePuppeteer: false,
        description: "Tech Deals & Discounts"
    }
];

// ============================================
// Headers للمواقع السهلة (Axios)
// ============================================
const BROWSER_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Cache-Control': 'max-age=0',
    'Referer': 'https://www.google.com/'
};

// ============================================
// جلب المحتوى بـ Puppeteer (للمواقع الصعبة)
// ============================================
async function fetchWithPuppeteer(url) {
    console.log(`🌐 Using Puppeteer for: ${url.substring(0, 50)}...`);
    
    let browser;
    try {
        browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu',
                '--window-size=1920,1080',
                '--disable-web-security',
                '--disable-features=IsolateOrigins,site-per-process'
            ]
        });
        
        const page = await browser.newPage();
        
        // محاكاة متصفح حقيقي
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await page.setViewport({ width: 1920, height: 1080 });
        
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
        });
        
        // الذهاب للصفحة
        await page.goto(url, { 
            waitUntil: 'networkidle2', 
            timeout: 30000 
        });
        
        // انتظار تحميل المحتوى (حسب الموقع)
        await page.waitForTimeout(3000);
        
        // محاولة الضغط على زر قبول الكوكيز إذا وجد
        try {
            await page.click('button[aria-label*="Accept"], button:has-text("Accept"), button:has-text("Agree"), .cc-accept', { timeout: 3000 });
        } catch {}
        
        // التمرير لتحميل الصور الكسولة
        await page.evaluate(async () => {
            await new Promise(resolve => {
                let totalHeight = 0;
                const distance = 300;
                const timer = setInterval(() => {
                    const scrollHeight = document.body.scrollHeight;
                    window.scrollBy(0, distance);
                    totalHeight += distance;
                    if (totalHeight >= scrollHeight) {
                        clearInterval(timer);
                        resolve();
                    }
                }, 100);
            });
        });
        
        // استخراج المحتوى باستخدام Readability
        const content = await page.evaluate(() => {
            // حقن Readability في الصفحة
            const script = document.createElement('script');
            script.src = 'https://unpkg.com/@mozilla/readability@0.5.0/Readability.js';
            document.head.appendChild(script);
            
            return new Promise(resolve => {
                script.onload = () => {
                    const documentClone = document.cloneNode(true);
                    const article = new Readability(documentClone).parse();
                    
                    // استخراج الصور
                    const images = [];
                    const selectors = ['article img', '.article img', '.post-content img', '.entry-content img', 'main img', '.content img'];
                    
                    selectors.forEach(selector => {
                        document.querySelectorAll(selector).forEach(img => {
                            const src = img.src || img.getAttribute('data-src') || img.getAttribute('data-lazy-src');
                            if (src && src.startsWith('http') && 
                                !src.includes('logo') && 
                                !src.includes('icon') && 
                                !src.includes('avatar') &&
                                !src.includes('pixel') &&
                                src.match(/\.(jpg|jpeg|png|webp)/i)) {
                                images.push({
                                    url: src.split('?')[0],
                                    alt: img.alt || img.getAttribute('title') || 'Article image'
                                });
                            }
                        });
                    });
                    
                    resolve({
                        title: article ? article.title : document.title,
                        text: article ? article.textContent : document.body.innerText,
                        images: images.slice(0, 10) // أخذ أول 10 صور فقط
                    });
                };
            });
        });
        
        await browser.close();
        
        if (!content || !content.text || content.text.length < 500) {
            console.log(`⚠️ Content too short or unreadable`);
            return null;
        }
        
        console.log(`✅ Fetched: ${content.title.substring(0, 50)}... (${content.images.length} images)`);
        
        return {
            url: url,
            title: content.title,
            text: content.text.replace(/\s+/g, ' ').slice(0, 12000),
            images: content.images
        };
        
    } catch (error) {
        console.error(`❌ Puppeteer error: ${error.message}`);
        if (browser) await browser.close();
        return null;
    }
}

// ============================================
// جلب المحتوى بـ Axios (للمواقع السهلة)
// ============================================
async function fetchWithAxios(url) {
    console.log(`📡 Using Axios for: ${url.substring(0, 50)}...`);
    
    try {
        const response = await axios.get(url, { 
            timeout: 20000,
            headers: BROWSER_HEADERS,
            maxRedirects: 5
        });
        
        if (response.status !== 200) {
            console.log(`⚠️ Status ${response.status}`);
            return null;
        }
        
        const dom = new JSDOM(response.data, { url });
        const reader = new Readability(dom.window.document);
        const article = reader.parse();
        
        if (!article || article.textContent.length < 500) {
            console.log(`⚠️ Content too short`);
            return null;
        }
        
        const $ = cheerio.load(response.data);
        const images = [];
        const seenUrls = new Set();
        
        $('article img, .article img, .post-content img, .entry-content img, main img').each((i, el) => {
            let src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-lazy-src');
            if (!src) return;
            
            let cleanUrl = src.split('?')[0];
            if (cleanUrl.startsWith('//')) cleanUrl = 'https:' + cleanUrl;
            
            if (cleanUrl.startsWith('http') && 
                !cleanUrl.includes('logo') && 
                !cleanUrl.includes('icon') && 
                cleanUrl.match(/\.(jpg|jpeg|png|webp)/i) &&
                !seenUrls.has(cleanUrl)) {
                seenUrls.add(cleanUrl);
                images.push({
                    url: cleanUrl,
                    alt: $(el).attr('alt') || $(el).attr('title') || 'Article image'
                });
            }
        });
        
        console.log(`✅ Fetched: ${article.title.substring(0, 50)}... (${images.length} images)`);
        
        return {
            url: url,
            title: article.title,
            text: article.textContent.replace(/\s+/g, ' ').slice(0, 12000),
            images: images.slice(0, 10)
        };
        
    } catch (error) {
        console.error(`❌ Axios error: ${error.message}`);
        return null;
    }
}

// ============================================
// الذكاء الاصطناعي - كتابة مقال احترافي
// ============================================
async function generateHighQualityArticle(article, category, sourceName) {
    console.log(`🤖 Generating AI article...`);
    
    const prompt = `You are a senior tech journalist and SEO expert. Rewrite the following article into a comprehensive, engaging blog post (800-1000 words) optimized for Google.

Source: ${sourceName}
Category: ${category}
Original Title: ${article.title}
Raw Content: ${article.text.substring(0, 8000)}

Guidelines:
- Professional, fluent English with proper grammar
- Engaging introduction that hooks readers
- 3-4 detailed sections with H2 headings
- Include a "Quick Overview" or "Pro Tip" box
- Add a Pros & Cons section if applicable
- Strong conclusion
- 3 FAQ questions with detailed answers
- SEO-optimized title and meta description

Return ONLY a valid JSON object with this exact structure:

{
    "seoTitle": "SEO-optimized title (max 60 chars)",
    "metaDescription": "Compelling meta description (140-160 chars)",
    "category": "${category}",
    "introduction": "Strong, engaging introduction (2-3 paragraphs).",
    "sections": [
        {
            "heading": "Section Heading (H2)",
            "content": "Detailed content with paragraphs. You can include <h3> subheadings."
        },
        {
            "heading": "Second Section Heading",
            "content": "Detailed content."
        },
        {
            "heading": "Third Section Heading",
            "content": "Detailed content."
        }
    ],
    "tipBox": {
        "title": "💡 Pro Tip / Key Insight",
        "points": ["Important point 1", "Important point 2", "Important point 3"]
    },
    "conclusion": "Strong conclusion paragraph summarizing key takeaways.",
    "faqs": [
        {"q": "Frequently asked question 1?", "a": "Detailed and helpful answer."},
        {"q": "Frequently asked question 2?", "a": "Detailed and helpful answer."},
        {"q": "Frequently asked question 3?", "a": "Detailed and helpful answer."}
    ]
}`;

    try {
        const completion = await groq.chat.completions.create({
            messages: [
                { 
                    role: "system", 
                    content: "You are an expert tech journalist and SEO content writer. You write professional, engaging articles in fluent English with proper structure." 
                },
                { role: "user", content: prompt }
            ],
            model: "llama-3.3-70b-versatile",
            temperature: 0.7,
            max_tokens: 4000,
            response_format: { type: "json_object" }
        });
        
        const jsonString = completion.choices[0].message.content;
        const cleanJson = jsonString.substring(jsonString.indexOf('{'), jsonString.lastIndexOf('}') + 1);
        const parsed = JSON.parse(cleanJson);
        
        console.log(`✅ AI article generated: ${parsed.seoTitle}`);
        return parsed;
        
    } catch (e) {
        console.log(`❌ AI Error: ${e.message}`);
        return null;
    }
}

// ============================================
// قالب HTML - تصميم DeepLexa الأنيق
// ============================================
function getTemplate(content, images, sourceUrl, sourceName, sourceDescription) {
    const today = new Date().toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
    
    const totalWords = content.introduction.length + 
                      content.sections.reduce((acc, s) => acc + s.content.length, 0) +
                      (content.conclusion || '').length;
    const readTime = Math.max(3, Math.ceil(totalWords / 1500));
    
    const mainImage = images[0] || { 
        url: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&q=80', 
        alt: content.seoTitle 
    };
    
    const remainingImages = images.slice(1);
    let imageIndex = 0;
    
    // بناء الأقسام مع الصور
    let sectionsHtml = '';
    content.sections.forEach((sec, index) => {
        sectionsHtml += `<h2>${escapeHtml(sec.heading)}</h2>`;
        
        // معالجة المحتوى (يدعم HTML بداخله)
        const contentWithHtml = sec.content.replace(/<h3>/g, '<h3>').replace(/<\/h3>/g, '</h3>');
        sectionsHtml += `<div>${contentWithHtml.split('\n').map(p => {
            const trimmed = p.trim();
            if (!trimmed) return '';
            if (trimmed.startsWith('<h3>')) return trimmed;
            return `<p>${escapeHtml(trimmed)}</p>`;
        }).join('')}</div>`;
        
        // إضافة صورة بعد كل قسم
        if (remainingImages.length > 0 && imageIndex < remainingImages.length) {
            const img = remainingImages[imageIndex++];
            sectionsHtml += `
            <figure style="margin: 35px 0; text-align: center;">
                <img src="${img.url}" alt="${escapeHtml(img.alt)}" loading="lazy" style="width:100%; max-width:800px; height:auto; aspect-ratio:16/9; object-fit:cover; border-radius:16px; box-shadow:0 10px 25px rgba(0,0,0,0.1);">
                <figcaption style="margin-top:10px; color:#64748b; font-size:0.9rem; font-style:italic;">${escapeHtml(img.alt)}</figcaption>
            </figure>`;
        }
    });

    // Schema.org للسيو
    const schemaData = {
        "@context": "https://schema.org",
        "@type": "TechArticle",
        "headline": content.seoTitle,
        "image": mainImage.url,
        "datePublished": new Date().toISOString(),
        "dateModified": new Date().toISOString(),
        "author": { 
            "@type": "Organization", 
            "name": "DeepLexa", 
            "url": "https://deeplexa.com" 
        },
        "publisher": { 
            "@type": "Organization", 
            "name": "DeepLexa", 
            "logo": { 
                "@type": "ImageObject", 
                "url": "https://deeplexa.com/logo.png" 
            } 
        },
        "description": content.metaDescription,
        "mainEntityOfPage": { 
            "@type": "WebPage", 
            "@id": sourceUrl 
        },
        "inLanguage": "en",
        "keywords": `${content.category}, ${sourceName}, tech news, technology`
    };

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="${escapeHtml(content.metaDescription)}">
    <meta name="keywords" content="${escapeHtml(content.category)}, tech news, ${escapeHtml(sourceName)}">
    <meta property="og:title" content="${escapeHtml(content.seoTitle)}">
    <meta property="og:description" content="${escapeHtml(content.metaDescription)}">
    <meta property="og:image" content="${mainImage.url}">
    <meta property="og:type" content="article">
    <meta property="og:site_name" content="DeepLexa">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeHtml(content.seoTitle)}">
    <meta name="twitter:description" content="${escapeHtml(content.metaDescription)}">
    <meta name="twitter:image" content="${mainImage.url}">
    <title>${escapeHtml(content.seoTitle)}</title>
    
    <script type="application/ld+json">
    ${JSON.stringify(schemaData, null, 2)}
    </script>
    
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f5f7fa;
            padding: 20px;
            line-height: 1.8;
            color: #1a1a2e;
        }
        
        .article-card {
            max-width: 900px;
            margin: 0 auto;
            background: white;
            border-radius: 28px;
            overflow: hidden;
            box-shadow: 0 20px 35px -12px rgba(0, 0, 0, 0.1);
        }
        
        .article-inner {
            padding: 40px 50px;
        }
        
        .category-badge {
            display: inline-block;
            background: linear-gradient(135deg, #eef2ff, #e0e7ff);
            color: #2563eb;
            font-size: 0.8rem;
            font-weight: 600;
            padding: 6px 14px;
            border-radius: 30px;
            margin-bottom: 20px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        h1 {
            font-size: 2.4rem;
            font-weight: 800;
            line-height: 1.3;
            margin-bottom: 16px;
            color: #0a0f2c;
        }
        
        .meta-info {
            display: flex;
            gap: 24px;
            font-size: 0.9rem;
            color: #64748b;
            margin: 15px 0 25px;
            padding-bottom: 18px;
            border-bottom: 2px solid #eef2f8;
            flex-wrap: wrap;
        }
        
        .meta-info i {
            margin-right: 6px;
            color: #3b82f6;
        }
        
        .featured-image {
            position: relative;
            margin: 20px 0 35px;
            border-radius: 20px;
            overflow: hidden;
            box-shadow: 0 15px 30px -10px rgba(0, 0, 0, 0.15);
        }
        
        .featured-image img {
            width: 100%;
            display: block;
            aspect-ratio: 16/9;
            object-fit: cover;
        }
        
        .watermark {
            position: absolute;
            bottom: 14px;
            right: 14px;
            background: rgba(0, 0, 0, 0.6);
            color: white;
            padding: 6px 14px;
            border-radius: 10px;
            font-size: 12px;
            backdrop-filter: blur(4px);
        }
        
        .article-content h2 {
            font-size: 1.8rem;
            font-weight: 700;
            margin: 40px 0 18px;
            padding-left: 14px;
            border-left: 5px solid #3b82f6;
            color: #1e293b;
        }
        
        .article-content h3 {
            font-size: 1.4rem;
            font-weight: 600;
            margin: 30px 0 12px;
            color: #334155;
        }
        
        .article-content p {
            margin-bottom: 1.3rem;
            line-height: 1.9;
            color: #334155;
        }
        
        .article-content ul, .article-content ol {
            margin: 15px 0 20px 25px;
            color: #334155;
        }
        
        .article-content li {
            margin-bottom: 8px;
        }
        
        .tip-box {
            background: linear-gradient(135deg, #f0f9ff, #e6f3ff);
            border-left: 5px solid #0ea5e9;
            padding: 20px 25px;
            border-radius: 16px;
            margin: 30px 0;
        }
        
        .tip-box strong {
            color: #0284c7;
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 12px;
            font-size: 1.15rem;
        }
        
        .tip-box ul {
            margin: 10px 0 0 20px;
        }
        
        .faq-section {
            background: #f8fafc;
            border-radius: 20px;
            padding: 28px;
            margin: 40px 0 25px;
            border: 1px solid #e2e8f0;
        }
        
        .faq-section h2 {
            margin-top: 0;
            margin-bottom: 25px;
            border-left: none;
            padding-left: 0;
        }
        
        .faq-item {
            margin-bottom: 20px;
            padding-bottom: 18px;
            border-bottom: 1px solid #e2e8f0;
        }
        
        .faq-item:last-child {
            border-bottom: none;
            margin-bottom: 0;
            padding-bottom: 0;
        }
        
        .faq-item strong {
            display: block;
            margin-bottom: 8px;
            color: #1e293b;
            font-size: 1.1rem;
        }
        
        .faq-item p {
            margin-bottom: 0;
            color: #475569;
        }
        
        .author-box {
            background: #f1f5f9;
            border-radius: 20px;
            padding: 22px;
            margin: 40px 0 20px;
            display: flex;
            gap: 18px;
            align-items: center;
        }
        
        .author-avatar {
            width: 60px;
            height: 60px;
            background: linear-gradient(135deg, #2563eb, #0ea5e9);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.6rem;
            color: white;
            box-shadow: 0 8px 16px rgba(37, 99, 235, 0.2);
        }
        
        .source-footer {
            margin-top: 20px;
            padding-top: 18px;
            border-top: 1px solid #e2e8f0;
            font-size: 0.9rem;
            color: #64748b;
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 10px;
        }
        
        .source-footer a {
            color: #3b82f6;
            text-decoration: none;
            font-weight: 500;
        }
        
        .source-footer a:hover {
            text-decoration: underline;
        }
        
        @media (max-width: 700px) {
            .article-inner {
                padding: 25px;
            }
            
            h1 {
                font-size: 1.8rem;
            }
            
            .article-content h2 {
                font-size: 1.5rem;
            }
            
            .meta-info {
                gap: 15px;
            }
        }
        
        @media (max-width: 500px) {
            body {
                padding: 10px;
            }
            
            .article-inner {
                padding: 18px;
            }
            
            h1 {
                font-size: 1.5rem;
            }
        }
    </style>
</head>
<body>
    <div class="article-card">
        <div class="article-inner">
            <span class="category-badge">
                <i class="fas fa-bolt"></i> ${escapeHtml(content.category)}
            </span>
            
            <h1>${escapeHtml(content.seoTitle)}</h1>
            
            <div class="meta-info">
                <span><i class="far fa-calendar-alt"></i> ${today}</span>
                <span><i class="far fa-user"></i> DeepLexa Team</span>
                <span><i class="far fa-clock"></i> ${readTime} min read</span>
                <span><i class="fas fa-tag"></i> Via ${escapeHtml(sourceName)}</span>
            </div>
            
            <div class="featured-image">
                <img src="${mainImage.url}" alt="${escapeHtml(mainImage.alt)}" loading="eager">
                <div class="watermark">
                    <i class="far fa-copyright"></i> DeepLexa 2026
                </div>
            </div>
            
            <div class="article-content">
                ${content.introduction.split('\n').map(p => {
                    const trimmed = p.trim();
                    return trimmed ? `<p>${escapeHtml(trimmed)}</p>` : '';
                }).join('')}
                
                ${content.tipBox ? `
                <div class="tip-box">
                    <strong><i class="fas fa-lightbulb"></i> ${escapeHtml(content.tipBox.title)}</strong>
                    <ul>
                        ${content.tipBox.points.map(p => `<li>${escapeHtml(p)}</li>`).join('')}
                    </ul>
                </div>
                ` : ''}
                
                ${sectionsHtml}
                
                ${content.conclusion ? `
                <h2>Conclusion</h2>
                <p>${escapeHtml(content.conclusion)}</p>
                ` : ''}
                
                <div class="faq-section">
                    <h2>
                        <i class="fas fa-question-circle" style="margin-right: 10px; color: #3b82f6;"></i>
                        Frequently Asked Questions
                    </h2>
                    ${content.faqs.map(faq => `
                        <div class="faq-item">
                            <strong>Q: ${escapeHtml(faq.q)}</strong>
                            <p>A: ${escapeHtml(faq.a)}</p>
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <div class="author-box">
                <div class="author-avatar">
                    <i class="fas fa-chalkboard-user"></i>
                </div>
                <div>
                    <h4 style="margin-bottom: 5px; color: #0a0f2c; font-size: 1.1rem;">DeepLexa Team</h4>
                    <p style="font-size: 0.9rem; color: #475569;">
                        ${escapeHtml(sourceDescription || 'Quick and useful content including new releases, tech news, and expert analytics.')}
                    </p>
                </div>
            </div>
            
            <div class="source-footer">
                <span><i class="fas fa-link"></i> Curated from ${escapeHtml(sourceName)}</span>
                <a href="${sourceUrl}" target="_blank" rel="nofollow noopener">
                    Read Original Source <i class="fas fa-external-link-alt"></i>
                </a>
            </div>
        </div>
    </div>
</body>
</html>`;
}

// ============================================
// دالة escapeHtml
// ============================================
function escapeHtml(text) {
    if (!text) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return String(text).replace(/[&<>"']/g, m => map[m]);
}

// ============================================
// النشر على بلوجر
// ============================================
async function publishPost(title, html, category) {
    try {
        const auth = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET);
        auth.setCredentials({ refresh_token: REFRESH_TOKEN });
        const blogger = google.blogger({ version: 'v3', auth });
        
        const response = await blogger.posts.insert({
            blogId: BLOG_ID,
            requestBody: {
                title: title,
                content: html,
                labels: [category]
            }
        });
        
        console.log(`✅ Published! Post ID: ${response.data.id}`);
        return true;
        
    } catch (e) {
        console.error(`❌ Blogger API Error: ${e.message}`);
        if (e.response) {
            console.error(`Status: ${e.response.status}`);
            console.error(`Data:`, JSON.stringify(e.response.data, null, 2));
        }
        return false;
    }
}

// ============================================
// معالجة مقال واحد من مصدر
// ============================================
async function processSource(source, history) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📰 Processing: ${source.name}`);
    console.log(`📂 Category: ${source.category}`);
    console.log(`🔗 Feed: ${source.url}`);
    console.log(`🛠️ Method: ${source.usePuppeteer ? 'Puppeteer' : 'Axios'}`);
    console.log(`${'='.repeat(60)}`);
    
    try {
        // جلب RSS
        const feed = await parser.parseURL(source.url);
        
        if (!feed.items || feed.items.length === 0) {
            console.log(`⚠️ No articles found`);
            return false;
        }
        
        // أخذ أحدث مقال
        const latestItem = feed.items[0];
        
        console.log(`\n📌 Latest article: ${latestItem.title}`);
        console.log(`🔗 URL: ${latestItem.link}`);
        
        // التحقق من النشر المسبق
        if (history.includes(latestItem.link)) {
            console.log(`⏩ Already published, skipping...`);
            return false;
        }
        
        // جلب محتوى المقال
        console.log(`\n📥 Fetching article content...`);
        const article = source.usePuppeteer 
            ? await fetchWithPuppeteer(latestItem.link)
            : await fetchWithAxios(latestItem.link);
        
        if (!article) {
            console.log(`❌ Failed to fetch article content`);
            return false;
        }
        
        if (article.images.length === 0) {
            console.log(`⚠️ No images found, but continuing...`);
        }
        
        // توليد المقال بالذكاء الاصطناعي
        console.log(`\n🤖 Generating AI-enhanced article...`);
        const aiContent = await generateHighQualityArticle(article, source.category, source.name);
        
        if (!aiContent) {
            console.log(`❌ Failed to generate AI content`);
            return false;
        }
        
        // إنشاء HTML
        console.log(`\n📄 Creating HTML template...`);
        const html = getTemplate(aiContent, article.images, latestItem.link, source.name, source.description);
        
        // النشر على بلوجر
        console.log(`\n🚀 Publishing to Blogger...`);
        const published = await publishPost(aiContent.seoTitle, html, source.category);
        
        if (published) {
            saveToHistory(latestItem.link);
            console.log(`\n✅✅✅ SUCCESS! Published from ${source.name}!`);
            return true;
        }
        
        return false;
        
    } catch (error) {
        console.error(`\n❌ Error processing ${source.name}:`, error.message);
        return false;
    }
}

// ============================================
// البوت الرئيسي
// ============================================
async function startBot() {
    console.log('\n');
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║            🚀 DEEPLEXA AUTO PUBLISHER BOT v2.0              ║');
    console.log('║         Multi-Source Tech News to Blogger with AI            ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log('\n');
    
    const startTime = Date.now();
    const history = loadHistory();
    
    if (!Array.isArray(history)) {
        console.log('⚠️ Reinitializing history file...');
        fs.writeFileSync(HISTORY_FILE, '[]');
    }
    
    console.log(`📊 History: ${history.length} previously published articles`);
    console.log(`📰 Sources to process: ${SOURCES.length}`);
    console.log('\n');
    
    let successCount = 0;
    let skipCount = 0;
    let failCount = 0;
    
    // معالجة كل مصدر
    for (let i = 0; i < SOURCES.length; i++) {
        const source = SOURCES[i];
        
        console.log(`\n┌─────────────────────────────────────────────────────────────┐`);
        console.log(`│  Source ${i + 1}/${SOURCES.length}: ${source.name.padEnd(45)} │`);
        console.log(`└─────────────────────────────────────────────────────────────┘`);
        
        const result = await processSource(source, history);
        
        if (result) {
            successCount++;
        } else {
            // التحقق إذا كان المقال موجود مسبقاً
            try {
                const feed = await parser.parseURL(source.url);
                if (feed.items && feed.items[0] && history.includes(feed.items[0].link)) {
                    skipCount++;
                } else {
                    failCount++;
                }
            } catch {
                failCount++;
            }
        }
        
        // انتظار دقيقة بين المصادر (ما عدا الأخير)
        if (i < SOURCES.length - 1) {
            console.log(`\n⏳ Waiting 60 seconds before next source...`);
            console.log(`   (To avoid rate limiting and detection)`);
            await delay(60000);
        }
    }
    
    // ملخص النتائج
    const duration = Math.round((Date.now() - startTime) / 1000);
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    
    console.log('\n');
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║                      📊 FINAL SUMMARY                        ║');
    console.log('╠══════════════════════════════════════════════════════════════╣');
    console.log(`║  ✅ Successfully published: ${successCount.toString().padStart(28)} ║`);
    console.log(`║  ⏩ Already published (skipped): ${skipCount.toString().padStart(22)} ║`);
    console.log(`║  ❌ Failed to process: ${failCount.toString().padStart(32)} ║`);
    console.log(`║  ⏱️  Total time: ${minutes}m ${seconds}s`.padEnd(62) + '║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log('\n');
}

// ============================================
// تشغيل البوت
// ============================================
startBot().catch(error => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
});
