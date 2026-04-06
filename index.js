const Parser = require('rss-parser');
const axios = require('axios');
const cheerio = require('cheerio');
const { google } = require('googleapis');
const Jimp = require('jimp');
const Groq = require('groq-sdk');

// ==========================================
// الإعدادات المتقدمة
// ==========================================
const CONFIG = {
    blog: {
        id: "8249860422330426533",
        clientId: "872415365656-7qribadnc7k2u21kl6jjcbatdueevifh.apps.googleusercontent.com",
        clientSecret: "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",
        refreshToken: "1//04yti9k2agPknCgYIARAAGAQSNwF-L9IrTZPKt5Fqbg2vrM9sBtOks9cnY4M7Idg0LToQnlbYGME06k20vcyr_SVmYk1H_yZJdEc"
    },
    groq: {
        apiKey: "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"
    },
    watermark: {
        text: "TECH"
    }
};

// قائمة المصادر
const RSS_SOURCES = [
    'https://www.makeuseof.com/feed/',
    'https://fossbytes.com/feed/',
    'https://www.howtogeek.com/feed/',
    'https://www.techradar.com/rss',
    'https://www.theverge.com/rss/index.xml'
];

const groq = new Groq({ apiKey: CONFIG.groq.apiKey });
const parser = new Parser();

// ==========================================
// معالجة الصور بعلامة مائية احترافية
// ==========================================
async function processImage(imageUrl) {
    try {
        if (!imageUrl) return null;
        
        console.log("📸 معالجة الصورة...");
        const response = await axios({
            method: 'get',
            url: imageUrl,
            responseType: 'arraybuffer',
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        let image = await Jimp.read(Buffer.from(response.data));
        
        // تحسين الجودة والحجم
        if (image.getWidth() > 1200) {
            image.resize(1200, Jimp.AUTO);
        }
        
        // تحسين التباين والألوان
        image.contrast(0.05);
        image.brightness(0.02);
        
        // علامة مائية أنيقة وشفافة
        const font = await Jimp.loadFont(Jimp.FONT_SANS_32_WHITE);
        const text = CONFIG.watermark.text;
        const textWidth = Jimp.measureText(font, text);
        const textHeight = 40;
        
        const imageWidth = image.getWidth();
        const imageHeight = image.getHeight();
        
        // وضع العلامة في الزاوية السفلى اليمنى
        const margin = 25;
        const x = imageWidth - textWidth - margin;
        const y = imageHeight - textHeight - margin;
        
        // خلفية شفافة للعلامة المائية
        const bgWidth = textWidth + 40;
        const bgHeight = textHeight + 20;
        const background = new Jimp(bgWidth, bgHeight, 0x00000066); // شفافية 40%
        
        // تأثير الظل
        const shadow = new Jimp(bgWidth, bgHeight, 0x00000033);
        image.composite(shadow, x + 2, y + 2);
        image.composite(background, x, y);
        
        // كتابة النص بخط جميل
        image.print(font, x + 20, y + 10, text);
        
        // إضافة تأثير بسيط على الحواف
        image.blur(1);
        
        console.log("✅ تمت معالجة الصورة بنجاح");
        return await image.getBase64Async(Jimp.MIME_JPEG);
    } catch (error) {
        console.error("خطأ في معالجة الصورة:", error.message);
        return null;
    }
}

// ==========================================
// تنظيف المحتوى بشكل متقدم
// ==========================================
function cleanHtmlContent(html) {
    try {
        const $ = cheerio.load(html);
        
        // إزالة العناصر غير المرغوب فيها
        $('script, style, iframe, nav, footer, header, aside, .ad, .advertisement, .social-share, .comments, .related, .newsletter, .popup, .cookie, .ads, .sponsored, .promo').remove();
        
        // إزالة الروابط التشعبية غير الضرورية
        $('a').each((i, el) => {
            const $el = $(el);
            $el.replaceWith($el.text());
        });
        
        // البحث عن المحتوى الرئيسي
        let content = '';
        const selectors = ['article', '.post-content', '.entry-content', '.article-content', 'main', '.content', '#main-content'];
        
        for (const selector of selectors) {
            if ($(selector).length > 0) {
                content = $(selector).html();
                break;
            }
        }
        
        if (!content) {
            content = $('body').html();
        }
        
        // استخراج النص النظيف
        const text = cheerio.load(content).text();
        
        // تنظيف النص من الرموز الغريبة
        let cleanText = text
            .replace(/\s+/g, ' ')
            .replace(/[^\x00-\x7F]/g, ' ')
            .replace(/Join|Subscribe|Follow|Share|Like|Comment|Click|Link|Download/gi, '')
            .replace(/http[s]?:\/\/[^\s]+/g, '')
            .trim();
        
        // تحديد طول مناسب
        cleanText = cleanText.slice(0, 3500);
        
        return cleanText;
    } catch (error) {
        console.error("خطأ في تنظيف المحتوى:", error.message);
        return null;
    }
}

// ==========================================
// إعادة صياغة المحتوى بالذكاء الاصطناعي
// ==========================================
async function enhanceWithAI(title, cleanText) {
    try {
        if (!cleanText || cleanText.length < 150) {
            console.log("⚠️ المحتوى قصير جداً");
            return `<p>${cleanText || "المحتوى غير متوفر"}</p>`;
        }
        
        console.log("🤖 الذكاء الاصطناعي يعيد صياغة المحتوى...");
        
        const prompt = `Rewrite and enhance this tech article naturally in English:

Title: ${title}

Original Content: ${cleanText}

Requirements:
1. Rewrite in your own words naturally
2. Keep it informative and engaging
3. Use only: <h2>, <h3>, <p>, <strong>, <em>, <ul>, <li>
4. Start directly with <p>
5. Each main idea as <h2>
6. Short paragraphs (2-3 sentences)
7. Professional but conversational tone
8. NO promotional content
9. NO "click here" or "subscribe"
10. NO source references

Format:
<p>Engaging opening paragraph...</p>

<h2>First Key Point</h2>
<p>Natural explanation...</p>

<h2>Second Key Point</h2>
<p>Continue naturally...</p>

Write the rewritten article:`;

        const completion = await groq.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: "You are a professional tech writer. Rewrite articles naturally. Output ONLY clean HTML. Never include meta-commentary."
                },
                {
                    role: "user",
                    content: prompt
                }
            ],
            model: "mixtral-8x7b-32768",
            temperature: 0.8,
            max_tokens: 2500
        });
        
        let aiContent = completion.choices[0]?.message?.content || '';
        
        if (!aiContent || aiContent.length < 100) {
            throw new Error("AI output too short");
        }
        
        // تنظيف المحتوى من أي كلمات دعائية
        aiContent = aiContent
            .replace(/Here('s| is)|Let me|The following|I will|As an AI|I understand|Certainly|Absolutely/gi, '')
            .replace(/Subscribe|Follow|Share|Comment|Like|Click|Link|Download|Newsletter|Join|Donate/gi, '')
            .trim();
        
        // التأكد من وجود هيكل سليم
        if (!aiContent.includes('<p>') && !aiContent.includes('<h2>')) {
            aiContent = aiContent.split('\n\n').filter(p => p.trim().length > 20).map(p => `<p>${p.trim()}</p>`).join('');
        }
        
        console.log("✅ تمت إعادة الصياغة بنجاح");
        return aiContent;
        
    } catch (error) {
        console.error("خطأ في الذكاء الاصطناعي:", error.message);
        return `<p>${cleanText ? cleanText.slice(0, 800) : "المحتوى غير متوفر حالياً"}</p>`;
    }
}

// ==========================================
// بناء قالب احترافي وجذاب
// ==========================================
function buildArticleHTML(title, content, imageBase64) {
    // تنظيف المحتوى النهائي
    let finalContent = content;
    
    // إزالة أي شعارات أو علامات مائية نصية
    finalContent = finalContent
        .replace(/[📱🔗🤖✨🚀💡💻🎯⚡📊🎨🖼️✅❌⚠️📸🧹🏗️📤📖🖼️🧠🎉]/g, '')
        .replace(/Stay updated|Auto-generated|informational purposes|latest tech news|Auto Blogger|Bot/i, '');
    
    // إضافة فقرات إذا لزم الأمر
    if (finalContent && !finalContent.includes('<p>') && !finalContent.includes('<h2>')) {
        finalContent = finalContent.split('\n\n').filter(p => p.trim()).map(para => `<p>${para.trim()}</p>`).join('');
    }
    
    // بناء الصورة بشكل احترافي
    const imageHTML = imageBase64 ? `
        <div class="hero-image">
            <img src="${imageBase64}" alt="${title.replace(/[<>]/g, '')}" />
            <div class="image-overlay"></div>
        </div>
    ` : '';
    
    // قالب عصري وجذاب
    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content="${title.substring(0, 150)}" />
    <title>${title.replace(/[<>]/g, '')}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 40px 20px;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }
        
        .article-container {
            max-width: 900px;
            margin: 0 auto;
            background: white;
            border-radius: 20px;
            overflow: hidden;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }
        
        .hero-image {
            position: relative;
            width: 100%;
            background: #f0f0f0;
            overflow: hidden;
        }
        
        .hero-image img {
            width: 100%;
            height: auto;
            display: block;
            transition: transform 0.3s ease;
        }
        
        .hero-image:hover img {
            transform: scale(1.02);
        }
        
        .image-overlay {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.3) 100%);
            pointer-events: none;
        }
        
        .post-header {
            padding: 40px 50px 20px 50px;
            background: white;
        }
        
        .post-title {
            font-size: 42px;
            line-height: 1.3;
            color: #2d3748;
            margin-bottom: 20px;
            font-weight: 800;
            letter-spacing: -0.5px;
        }
        
        .post-meta {
            display: flex;
            gap: 20px;
            color: #718096;
            font-size: 14px;
            border-bottom: 2px solid #e2e8f0;
            padding-bottom: 20px;
        }
        
        .post-content {
            padding: 0 50px 50px 50px;
            background: white;
        }
        
        .post-content h2 {
            font-size: 32px;
            color: #2d3748;
            margin: 40px 0 20px 0;
            padding-left: 15px;
            border-left: 5px solid #667eea;
            font-weight: 700;
        }
        
        .post-content h3 {
            font-size: 26px;
            color: #4a5568;
            margin: 30px 0 15px 0;
            font-weight: 600;
        }
        
        .post-content p {
            font-size: 18px;
            line-height: 1.8;
            color: #4a5568;
            margin-bottom: 25px;
            text-align: justify;
        }
        
        .post-content strong {
            color: #667eea;
            font-weight: 700;
        }
        
        .post-content em {
            background: #fef5e7;
            padding: 2px 6px;
            border-radius: 4px;
            font-style: italic;
        }
        
        .post-content ul, .post-content ol {
            margin: 20px 0 25px 40px;
        }
        
        .post-content li {
            font-size: 18px;
            line-height: 1.8;
            color: #4a5568;
            margin-bottom: 10px;
        }
        
        .post-footer {
            background: #f7fafc;
            padding: 30px 50px;
            text-align: center;
            border-top: 1px solid #e2e8f0;
        }
        
        .share-buttons {
            display: flex;
            justify-content: center;
            gap: 15px;
            margin-top: 20px;
        }
        
        .share-btn {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 10px 20px;
            background: white;
            border-radius: 25px;
            text-decoration: none;
            color: #4a5568;
            transition: all 0.3s ease;
            border: 1px solid #e2e8f0;
        }
        
        .share-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        
        @media (max-width: 768px) {
            body {
                padding: 20px 10px;
            }
            
            .post-header {
                padding: 25px 25px 15px 25px;
            }
            
            .post-title {
                font-size: 28px;
            }
            
            .post-content {
                padding: 0 25px 30px 25px;
            }
            
            .post-content h2 {
                font-size: 24px;
            }
            
            .post-content h3 {
                font-size: 20px;
            }
            
            .post-content p, .post-content li {
                font-size: 16px;
            }
            
            .post-footer {
                padding: 20px 25px;
            }
        }
        
        @media (max-width: 480px) {
            .post-title {
                font-size: 24px;
            }
            
            .post-meta {
                flex-direction: column;
                gap: 8px;
            }
        }
    </style>
</head>
<body>
    <div class="article-container">
        ${imageHTML}
        <div class="post-header">
            <h1 class="post-title">${title.replace(/[<>]/g, '')}</h1>
            <div class="post-meta">
                <span>📅 ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                <span>⏱️ ${Math.ceil(finalContent.length / 1000)} min read</span>
            </div>
        </div>
        <div class="post-content">
            ${finalContent}
        </div>
        <div class="post-footer">
            <p style="color: #718096; font-size: 14px;">Thank you for reading</p>
            <div class="share-buttons">
                <a href="#" class="share-btn">📘 Share</a>
                <a href="#" class="share-btn">🐦 Tweet</a>
                <a href="#" class="share-btn">💬 Comment</a>
            </div>
        </div>
    </div>
</body>
</html>`;
}

// ==========================================
// النشر على بلوجر
// ==========================================
async function publishToBlogger(title, content) {
    try {
        console.log("📤 جاري النشر على بلوجر...");
        
        const oauth2Client = new google.auth.OAuth2(
            CONFIG.blog.clientId,
            CONFIG.blog.clientSecret
        );
        
        oauth2Client.setCredentials({
            refresh_token: CONFIG.blog.refreshToken
        });
        
        const blogger = google.blogger({ version: 'v3', auth: oauth2Client });
        
        const result = await blogger.posts.insert({
            blogId: CONFIG.blog.id,
            requestBody: {
                title: title,
                content: content,
                labels: ['Technology', 'Tech News', 'Article'],
                status: 'LIVE'
            }
        });
        
        console.log(`✅ تم النشر بنجاح!`);
        console.log(`📖 رابط المقال: ${result.data.url}`);
        return result.data;
    } catch (error) {
        console.error("خطأ في النشر:", error.message);
        throw error;
    }
}

// ==========================================
// استخراج الصورة الرئيسية
// ==========================================
function extractImage($) {
    const selectors = [
        'meta[property="og:image"]',
        'meta[name="twitter:image"]',
        'article img:first',
        '.post-content img:first',
        '.entry-content img:first',
        '.featured-image img',
        'img:first'
    ];
    
    for (const selector of selectors) {
        const img = $(selector);
        let url = img.attr('content') || img.attr('src') || img.attr('data-src') || img.attr('data-lazy-src');
        
        if (url && !url.includes('logo') && !url.includes('icon') && !url.includes('avatar') && 
            !url.includes('placeholder') && !url.includes('spinner') && !url.includes('pixel')) {
            
            if (url.startsWith('//')) {
                url = 'https:' + url;
            } else if (!url.startsWith('http')) {
                url = 'https://' + url;
            }
            
            // التأكد من أن الصورة حقيقية وليست أيقونة
            if (url.match(/\.(jpg|jpeg|png|webp)/i) && !url.match(/\/icons\/|\/avatars\/|\/thumbnails\/small/)) {
                return url;
            }
        }
    }
    return null;
}

// ==========================================
// المحرك الرئيسي
// ==========================================
async function runAutoBlogger() {
    try {
        console.log("\n🚀 تشغيل نظام النشر التلقائي\n" + "=".repeat(50));
        
        // اختيار مصدر عشوائي
        const randomSource = RSS_SOURCES[Math.floor(Math.random() * RSS_SOURCES.length)];
        console.log(`📡 جلب من: ${randomSource}`);
        
        const feed = await parser.parseURL(randomSource);
        const article = feed.items[0];
        
        if (!article) {
            throw new Error("لا توجد مقالات");
        }
        
        console.log(`📰 العنوان: ${article.title}`);
        
        // جلب المقال الكامل
        console.log("🌐 جلب المقال كاملاً...");
        const response = await axios.get(article.link, {
            timeout: 20000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5'
            }
        });
        
        // تنظيف المحتوى
        console.log("🧹 تنظيف المحتوى...");
        const cleanText = cleanHtmlContent(response.data);
        
        if (!cleanText) {
            throw new Error("فشل في تنظيف المحتوى");
        }
        
        console.log(`📝 طول المحتوى: ${cleanText.length} حرف`);
        
        // معالجة الصورة
        console.log("🖼️ معالجة الصورة...");
        const $ = cheerio.load(response.data);
        const imageUrl = extractImage($);
        let processedImage = null;
        
        if (imageUrl) {
            console.log(`📸 تم العثور على صورة: ${imageUrl.substring(0, 100)}...`);
            processedImage = await processImage(imageUrl);
        } else {
            console.log("⚠️ لم يتم العثور على صورة");
        }
        
        // إعادة صياغة المحتوى بالذكاء الاصطناعي
        console.log("🧠 إعادة صياغة المحتوى...");
        const enhancedContent = await enhanceWithAI(article.title, cleanText);
        
        console.log(`📄 طول المحتوى المعاد صياغته: ${enhancedContent.length} حرف`);
        
        // بناء القالب النهائي
        console.log("🏗️ بناء القالب النهائي...");
        const finalHTML = buildArticleHTML(article.title, enhancedContent, processedImage);
        
        // النشر
        await publishToBlogger(article.title, finalHTML);
        
        console.log("\n" + "=".repeat(50));
        console.log("🎉 تم النشر بنجاح!");
        console.log("=".repeat(50) + "\n");
        
    } catch (error) {
        console.error("\n❌ خطأ فادح:", error.message);
        if (error.stack) {
            console.error("التفاصيل:", error.stack);
        }
    }
}

// ==========================================
// تشغيل البوت
// ==========================================
console.log("🤖 تشغيل نظام النشر التلقائي...");
console.log(`📅 ${new Date().toLocaleString('ar-EG')}\n`);

runAutoBlogger();

// للتشغيل التلقائي كل 6 ساعات
setInterval(runAutoBlogger, 6 * 60 * 60 * 1000);
