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
        text: "© fadi craft",
        position: 'bottom'
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
// معالجة الصور
// ==========================================
async function processImage(imageUrl) {
    try {
        if (!imageUrl) return null;
        
        console.log("📸 Processing image...");
        const response = await axios({
            method: 'get',
            url: imageUrl,
            responseType: 'arraybuffer',
            timeout: 10000
        });
        
        const image = await Jimp.read(Buffer.from(response.data));
        
        // تحسين الصورة
        if (image.getWidth() > 800) {
            image.resize(800, Jimp.AUTO);
        }
        
        // إضافة علامة مائية
        const font = await Jimp.loadFont(Jimp.FONT_SANS_32_WHITE);
        const text = CONFIG.watermark.text;
        const textWidth = Jimp.measureText(font, text);
        const imageWidth = image.getWidth();
        const imageHeight = image.getHeight();
        
        // خلفية للعلامة المائية
        const bgWidth = textWidth + 40;
        const bgHeight = 60;
        const x = imageWidth - bgWidth - 20;
        const y = imageHeight - bgHeight - 20;
        
        const background = new Jimp(bgWidth, bgHeight, 0x000000aa);
        image.composite(background, x, y);
        image.print(font, x + 20, y + 15, text);
        
        return await image.getBase64Async(Jimp.MIME_JPEG);
    } catch (error) {
        console.error("Image processing error:", error.message);
        return null;
    }
}

// ==========================================
// تنظيف المحتوى
// ==========================================
function cleanHtmlContent(html) {
    try {
        const $ = cheerio.load(html);
        
        // إزالة العناصر غير المرغوب فيها
        $('script, style, iframe, nav, footer, header, aside, .ad, .advertisement, .social-share, .comments, .related, .newsletter, .popup, .cookie').remove();
        
        // محاولة العثور على المحتوى الرئيسي
        let content = '';
        const selectors = ['article', '.post-content', '.entry-content', '.article-content', 'main', '.content'];
        
        for (const selector of selectors) {
            if ($(selector).length > 0) {
                content = $(selector).html();
                break;
            }
        }
        
        if (!content) {
            content = $('body').html();
        }
        
        // تنظيف النص
        content = content.replace(/\s+/g, ' ').trim();
        
        // إزالة الروابط المشبوهة والإعلانات
        $('a[rel="sponsored"], a[href*="ad"], a[href*="click"]').remove();
        
        return content;
    } catch (error) {
        console.error("Clean HTML error:", error.message);
        return html;
    }
}

// ==========================================
// تحسين المحتوى بالذكاء الاصطناعي
// ==========================================
async function enhanceWithAI(title, content) {
    try {
        console.log("🤖 AI is processing content...");
        
        // تنظيف المحتوى أولاً
        const cleanText = cheerio.load(content).text().slice(0, 3000);
        
        const prompt = `Rewrite this tech article to be unique and well-structured:

Title: ${title}

Content: ${cleanText}

IMPORTANT FORMATTING RULES:
1. Use ONLY these HTML tags: <h2>, <h3>, <p>, <strong>, <em>, <ul>, <li>
2. Start DIRECTLY with <p> tag - NO introduction phrases like "Here is" or "I will"
3. Each major section MUST start with <h2> tag
4. Use <h3> for subsections
5. Add 2-3 paragraphs between headings
6. Use <ul> for lists when appropriate
7. Keep paragraphs short (2-4 sentences each)
8. DO NOT include any meta-commentary, author notes, or source references
9. DO NOT include the word "rewritten" or "original" in the content
10. Write in natural, flowing English

Example of correct format:
<p>Here is the opening paragraph that introduces the topic naturally.</p>

<h2>First Major Section</h2>
<p>Detailed explanation of the first point with multiple sentences.</p>
<p>Continue with supporting information and examples.</p>

<h2>Second Major Section</h2>
<p>Continue with more detailed content...</p>

Now write the article following these rules exactly:`;

        const completion = await groq.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: "You are a professional tech writer. Output ONLY valid HTML content. Never include explanations or meta comments. Start directly with HTML tags."
                },
                {
                    role: "user",
                    content: prompt
                }
            ],
            model: "llama3-8b-8192",
            temperature: 0.7,
            max_tokens: 2500
        });
        
        let aiContent = completion.choices[0]?.message?.content || '';
        
        // تنظيف إضافي للمحتوى من الـ AI
        aiContent = aiContent.replace(/^(Here|I will|Let me|The following|Below is).*?(rewritten|article|content).*?[:!\n]/i, '');
        aiContent = aiContent.replace(/\[.*?\]/g, '');
        aiContent = aiContent.replace(/\(.*?\)/g, '');
        aiContent = aiContent.trim();
        
        // التأكد من أن المحتوى يبدأ بـ HTML tag صحيح
        if (!aiContent.match(/^<(p|h2|h3|ul)/i)) {
            aiContent = `<p>${aiContent}</p>`;
        }
        
        return aiContent;
    } catch (error) {
        console.error("AI Error:", error.message);
        return `<p>${cleanText}</p>`;
    }
}

// ==========================================
// بناء HTML نهائي للمقال
// ==========================================
function buildArticleHTML(title, content, imageBase64) {
    // تنظيف المحتوى من أي مشاكل في التنسيق
    let cleanContent = content;
    
    // التأكد من وجود فقرات
    if (!cleanContent.includes('<p>')) {
        cleanContent = cleanContent.split('\n\n').map(para => `<p>${para}</p>`).join('');
    }
    
    // التأكد من أن العناوين بالتنسيق الصحيح
    cleanContent = cleanContent.replace(/##\s+(.+)/g, '<h2>$1</h2>');
    cleanContent = cleanContent.replace(/###\s+(.+)/g, '<h3>$1</h3>');
    
    // بناء الصورة
    const imageHTML = imageBase64 ? `
        <div style="text-align: center; margin: 20px 0;">
            <img src="${imageBase64}" 
                 alt="${title}"
                 style="max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);" />
        </div>
    ` : '';
    
    // بناء الهيكل النهائي
    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:b="http://www.google.com/2005/gml/b" xmlns:data="http://www.google.com/2005/gml/data" xmlns:expr="http://www.google.com/2005/gml/expr">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
        /* بلوجر ستايل متوافق */
        .post-body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.8;
            color: #333;
            max-width: 700px;
            margin: 0 auto;
            padding: 20px;
            font-size: 18px;
        }
        .post-body h2 {
            font-size: 28px;
            color: #2c3e50;
            margin: 30px 0 15px 0;
            padding-bottom: 10px;
            border-bottom: 2px solid #3498db;
            font-weight: 600;
        }
        .post-body h3 {
            font-size: 24px;
            color: #34495e;
            margin: 25px 0 12px 0;
            font-weight: 500;
        }
        .post-body p {
            margin: 0 0 20px 0;
            text-align: left;
        }
        .post-body ul, .post-body ol {
            margin: 15px 0 20px 30px;
            padding: 0;
        }
        .post-body li {
            margin: 8px 0;
        }
        .post-body strong {
            color: #2c3e50;
            font-weight: 600;
        }
        .post-body em {
            font-style: italic;
            color: #7f8c8d;
        }
        .post-body img {
            max-width: 100%;
            height: auto;
            border-radius: 8px;
            margin: 20px 0;
        }
        .post-body .featured-image {
            text-align: center;
            margin: 20px 0 30px 0;
        }
        @media (max-width: 768px) {
            .post-body {
                font-size: 16px;
                padding: 15px;
            }
            .post-body h2 { font-size: 24px; }
            .post-body h3 { font-size: 20px; }
        }
    </style>
</head>
<body>
    <div class='post-body'>
        ${imageHTML}
        ${cleanContent}
        <div style="margin-top: 50px; padding-top: 20px; border-top: 1px solid #ecf0f1; text-align: center; font-size: 14px; color: #95a5a6;">
            <p>📱 Tech News • Auto Published • Stay Updated</p>
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
        console.log("📤 Publishing to Blogger...");
        
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
                labels: ['Technology', 'Auto Post', 'AI Generated'],
                status: 'LIVE'
            }
        });
        
        console.log(`✅ Published successfully!`);
        console.log(`📖 Post URL: ${result.data.url}`);
        return result.data;
    } catch (error) {
        console.error("Blogger Error:", error.message);
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
        'img:first'
    ];
    
    for (const selector of selectors) {
        const img = $(selector);
        let url = img.attr('content') || img.attr('src');
        if (url && !url.includes('logo') && !url.includes('icon') && !url.includes('avatar')) {
            if (!url.startsWith('http')) {
                url = 'https:' + url;
            }
            return url;
        }
    }
    return null;
}

// ==========================================
// المحرك الرئيسي
// ==========================================
async function runAutoBlogger() {
    try {
        console.log("\n🚀 Starting AutoBlogger System\n" + "=".repeat(50));
        
        // 1. اختيار مصدر عشوائي
        const randomSource = RSS_SOURCES[Math.floor(Math.random() * RSS_SOURCES.length)];
        console.log(`📡 Fetching from: ${randomSource}`);
        
        const feed = await parser.parseURL(randomSource);
        const article = feed.items[0];
        
        if (!article) {
            throw new Error("No articles found");
        }
        
        console.log(`📰 Title: ${article.title}`);
        console.log(`🔗 Link: ${article.link}`);
        
        // 2. جلب المقال الكامل
        console.log("🌐 Fetching full article...");
        const response = await axios.get(article.link, {
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        // 3. تنظيف المحتوى
        console.log("🧹 Cleaning content...");
        const $ = cheerio.load(response.data);
        let cleanedContent = cleanHtmlContent(response.data);
        
        // 4. معالجة الصورة
        console.log("🖼️ Processing image...");
        const imageUrl = extractImage($);
        let processedImage = null;
        
        if (imageUrl) {
            processedImage = await processImage(imageUrl);
            if (processedImage) {
                console.log("✅ Image processed successfully");
            }
        }
        
        // 5. تحسين المحتوى بالذكاء الاصطناعي
        console.log("🧠 AI enhancement in progress...");
        const enhancedContent = await enhanceWithAI(article.title, cleanedContent);
        
        // 6. بناء HTML النهائي
        console.log("🏗️ Building final HTML...");
        const finalHTML = buildArticleHTML(article.title, enhancedContent, processedImage);
        
        // 7. النشر
        console.log("📤 Publishing to Blogger...");
        await publishToBlogger(article.title, finalHTML);
        
        console.log("\n" + "=".repeat(50));
        console.log("🎉 Success! Article published with perfect formatting!");
        console.log("=".repeat(50) + "\n");
        
    } catch (error) {
        console.error("\n❌ Fatal Error:", error.message);
        console.error("Stack:", error.stack);
    }
}

// تشغيل البوت
runAutoBlogger();

// جدولة التشغيل كل 6 ساعات (اختياري)
// setInterval(runAutoBlogger, 6 * 60 * 60 * 1000);
