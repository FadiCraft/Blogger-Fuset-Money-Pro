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
    }
};

// أفضل المصادر عالية الربحية والريتش (High RPM/High Traffic)
const HIGH_VALUE_SOURCES = [
    // أخبار جوجل (Google News) - أفضل مصدر
    { url: 'https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en', name: 'Google News US', category: 'trending' },
    { url: 'https://news.google.com/rss?hl=en&gl=GB&ceid=GB:en', name: 'Google News UK', category: 'trending' },
    { url: 'https://news.google.com/rss?hl=en&gl=CA&ceid=CA:en', name: 'Google News Canada', category: 'trending' },
    { url: 'https://news.google.com/rss?hl=en&gl=AU&ceid=AU:en', name: 'Google News Australia', category: 'trending' },
    
    // تكنولوجيا عالية الربح
    { url: 'https://techcrunch.com/feed/', name: 'TechCrunch', category: 'tech', value: 'high' },
    { url: 'https://www.wired.com/feed/rss', name: 'Wired', category: 'tech', value: 'high' },
    { url: 'https://arstechnica.com/feed/', name: 'Ars Technica', category: 'tech', value: 'high' },
    { url: 'https://www.theverge.com/rss/index.xml', name: 'The Verge', category: 'tech', value: 'high' },
    { url: 'https://www.engadget.com/rss.xml', name: 'Engadget', category: 'tech', value: 'high' },
    
    // مالية واقتصاد (عالية الربح جداً)
    { url: 'https://www.bloomberg.com/feed/podcast/technology', name: 'Bloomberg Tech', category: 'finance', value: 'very_high' },
    { url: 'https://www.cnbc.com/id/10000664/device/rss/rss.html', name: 'CNBC Tech', category: 'finance', value: 'very_high' },
    { url: 'https://www.businessinsider.com/rss', name: 'Business Insider', category: 'finance', value: 'high' },
    
    // AI وذكاء اصطناعي (الموضوعات الرائجة)
    { url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml', name: 'AI News', category: 'ai', value: 'very_high' },
    { url: 'https://techcrunch.com/category/artificial-intelligence/feed/', name: 'TechCrunch AI', category: 'ai', value: 'very_high' },
    
    // كريبتو وعملات رقمية (عالية الربح)
    { url: 'https://cointelegraph.com/rss', name: 'CoinTelegraph', category: 'crypto', value: 'very_high' },
    { url: 'https://www.coindesk.com/arc/outboundfeeds/rss/', name: 'CoinDesk', category: 'crypto', value: 'very_high' },
    
    // سيو وتسويق رقمي
    { url: 'https://moz.com/feed', name: 'Moz SEO', category: 'seo', value: 'high' },
    { url: 'https://neilpatel.com/feed/', name: 'Neil Patel', category: 'marketing', value: 'high' },
    
    // صحة ولياقة (مجال مربح)
    { url: 'https://www.healthline.com/feed', name: 'Healthline', category: 'health', value: 'high' },
    { url: 'https://www.webmd.com/rss.xml', name: 'WebMD', category: 'health', value: 'high' },
    
    // برمجة وتطوير (جمهور متخصص)
    { url: 'https://dev.to/feed', name: 'Dev.to', category: 'programming', value: 'medium' },
    { url: 'https://www.smashingmagazine.com/feed/', name: 'Smashing Magazine', category: 'programming', value: 'medium' }
];

const groq = new Groq({ apiKey: CONFIG.groq.apiKey });
const parser = new Parser({
    timeout: 15000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
});

// ==========================================
// معالجة الصور بشكل احترافي مع عنوان المقال
// ==========================================
async function processImageWithTitle(imageUrl, articleTitle) {
    try {
        if (!imageUrl) return null;
        
        console.log("🎨 Processing image with professional effects...");
        const response = await axios({
            method: 'get',
            url: imageUrl,
            responseType: 'arraybuffer',
            timeout: 10000
        });
        
        let image = await Jimp.read(Buffer.from(response.data));
        
        // تحسينات احترافية على الصورة
        // 1. تحسين التباين والسطوع
        image.contrast(0.1);
        image.brightness(0.05);
        image.greyscale(0.1); // تأثير خفيف للتباين
        
        // 2. إضافة تأثير vignette (تظليل الأطراف)
        const width = image.getWidth();
        const height = image.getHeight();
        
        // 3. تحجيم الصورة للجودة المثلى
        const maxWidth = 1200;
        if (width > maxWidth) {
            image.resize(maxWidth, Jimp.AUTO);
        }
        
        // 4. إضافة overlay شفاف للعلامة المائية
        const finalWidth = image.getWidth();
        const finalHeight = image.getHeight();
        
        // تحميل خطوط متعددة
        const titleFont = await Jimp.loadFont(Jimp.FONT_SANS_64_WHITE);
        const subFont = await Jimp.loadFont(Jimp.FONT_SANS_32_WHITE);
        
        // قص العنوان إذا كان طويلاً
        let displayTitle = articleTitle.length > 60 ? articleTitle.substring(0, 57) + '...' : articleTitle;
        
        // قياس النص
        const titleWidth = Jimp.measureText(titleFont, displayTitle);
        const titleHeight = Jimp.measureTextHeight(titleFont, displayTitle);
        
        // إنشاء خلفية شفافة جميلة للعنوان
        const bgPadding = 40;
        const bgWidth = Math.min(titleWidth + (bgPadding * 2), finalWidth - 40);
        const bgHeight = titleHeight + 60;
        
        // موقع العنوان (في الأسفل مع تأثير درامي)
        const titleX = (finalWidth - bgWidth) / 2;
        const titleY = finalHeight - bgHeight - 30;
        
        // خلفية متدرجة (تأثير شفاف احترافي)
        const gradientBg = new Jimp(bgWidth, bgHeight, 0x00000099);
        
        // إضافة تأثير شريط سفلي
        const bottomBar = new Jimp(finalWidth, 5, 0x3498dbff);
        
        // دمج كل العناصر
        image.composite(gradientBg, titleX, titleY);
        
        // إضافة عنوان المقال بشكل جميل
        image.print(
            titleFont,
            titleX + (bgWidth / 2) - (titleWidth / 2),
            titleY + 25,
            displayTitle
        );
        
        // إضافة نص العلامة المائية الصغير في الزاوية
        const watermarkText = "© TRENDING TECH UPDATE";
        const watermarkWidth = Jimp.measureText(subFont, watermarkText);
        image.print(
            subFont,
            finalWidth - watermarkWidth - 20,
            finalHeight - 40,
            watermarkText
        );
        
        image.composite(bottomBar, 0, finalHeight - 5);
        
        // 5. تحسين الجودة النهائية
        image.quality(90);
        
        return await image.getBase64Async(Jimp.MIME_JPEG);
    } catch (error) {
        console.error("Image processing error:", error.message);
        return null;
    }
}

// ==========================================
// تنظيف المحتوى واستخراج النص الرئيسي
// ==========================================
function extractMainContent(html) {
    try {
        const $ = cheerio.load(html);
        
        // إزالة العناصر غير المرغوب فيها
        $('script, style, iframe, nav, footer, header, aside, .ad, .advertisement, .social-share, .comments, .related, .newsletter, .popup, .cookie, .sidebar, .menu, .navigation').remove();
        
        // محاولة العثور على المحتوى الرئيسي
        let content = '';
        const selectors = [
            'article', '.post-content', '.entry-content', '.article-content', 
            'main', '.content', '.main-content', '.story-content', '.article-body'
        ];
        
        for (const selector of selectors) {
            if ($(selector).length > 0) {
                content = $(selector).text();
                break;
            }
        }
        
        if (!content) {
            content = $('body').text();
        }
        
        // تنظيف النص
        let cleanText = content.replace(/\s+/g, ' ').trim();
        cleanText = cleanText.slice(0, 4000);
        
        return cleanText;
    } catch (error) {
        console.error("Extract content error:", error.message);
        return null;
    }
}

// ==========================================
// تحسين المحتوى مع هيكل احترافي
// ==========================================
async function createProfessionalContent(title, cleanText, category) {
    try {
        if (!cleanText || cleanText.length < 200) {
            return generateFallbackContent(title);
        }
        
        console.log("🤖 Creating professional content structure...");
        
        const prompt = `Create a highly engaging, professional article with perfect structure:

Title: ${title}
Category: ${category}

Content source: ${cleanText.substring(0, 2500)}

REQUIREMENTS FOR PROFESSIONAL STRUCTURE:

1. OPENING SECTION:
   - Start with a compelling hook
   - Include a brief overview/numbered list of key points
   - Use emojis strategically for visual appeal

2. MAIN CONTENT (Use this exact structure):
   - Multiple H2 headings for major sections
   - H3 headings for subsections where needed
   - Numbered lists for steps or rankings (1., 2., 3.)
   - Bullet points for features or benefits
   - Bold text for key terms and important stats
   - Italic text for quotes or emphasis

3. VISUAL ELEMENTS:
   - Add checkmarks (✅) for positive points
   - Add warning signs (⚠️) for important notes
   - Add stars (⭐) for top recommendations
   - Add arrows (👉) for key takeaways

4. TABLE OF CONTENTS (at the beginning):
   Create a simple list of main sections

5. COMPARISON TABLE (if applicable):
   Use markdown table format

6. CLOSING SECTION:
   - Summary of key points (numbered)
   - Call to action
   - Related topics or what to read next

FORMAT EXAMPLE:
<p>🔥 <strong>Quick Overview:</strong> Here are the main points we'll cover:</p>
<ol>
<li>First key point</li>
<li>Second key point</li>
<li>Third key point</li>
</ol>

<h2>📊 Section One: Detailed Analysis</h2>
<p>Content with <strong>bold terms</strong> and important information.</p>
<ul>
<li>✅ Benefit one</li>
<li>✅ Benefit two</li>
</ul>

<h2>📈 Section Two: Key Findings</h2>
<p>Continue with structured content...</p>

Now write the complete article following this exact professional structure:`;

        const completion = await groq.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: "You are an expert content creator specializing in high-value, structured articles. Use rich formatting, emojis, lists, tables, and proper hierarchy. Output clean HTML only."
                },
                {
                    role: "user",
                    content: prompt
                }
            ],
            model: "mixtral-8x7b-32768",
            temperature: 0.7,
            max_tokens: 3000
        });
        
        let content = completion.choices[0]?.message?.content || '';
        
        if (!content || content.length < 500) {
            return generateFallbackContent(title);
        }
        
        // تنظيف المحتوى
        content = content.replace(/```html|```/g, '');
        
        // إضافة جدول محتويات تفاعلي
        const toc = generateTableOfContents(content);
        
        return toc + content;
        
    } catch (error) {
        console.error("AI Content Error:", error.message);
        return generateFallbackContent(title);
    }
}

// ==========================================
// إنشاء جدول محتويات
// ==========================================
function generateTableOfContents(content) {
    const headings = content.match(/<h2[^>]*>(.*?)<\/h2>/g);
    if (!headings || headings.length < 2) return '';
    
    let toc = '<div style="background: #f8f9fa; padding: 20px; border-radius: 12px; margin: 20px 0;">';
    toc += '<h3 style="margin-top: 0;">📑 Table of Contents</h3>';
    toc += '<ul style="list-style: none; padding-left: 0;">';
    
    headings.forEach((heading, index) => {
        const title = heading.replace(/<[^>]*>/g, '');
        const id = `section-${index}`;
        toc += `<li style="margin: 10px 0;">👉 <a href="#${id}" style="color: #3498db; text-decoration: none;">${title}</a></li>`;
    });
    
    toc += '</ul></div>';
    return toc;
}

// ==========================================
// محتوى احتياطي في حالة فشل AI
// ==========================================
function generateFallbackContent(title) {
    return `
        <h2>📋 Overview</h2>
        <p>${title} represents an important development in its field. This article explores the key aspects and implications.</p>
        
        <h2>🔍 Key Points</h2>
        <ul>
            <li>✅ Important development in the industry</li>
            <li>✅ Significant impact on users and businesses</li>
            <li>✅ Future implications and trends</li>
        </ul>
        
        <h2>💡 Main Takeaways</h2>
        <p>The information presented highlights the evolving nature of technology and its applications in real-world scenarios.</p>
        
        <h2>🎯 Conclusion</h2>
        <p>Stay updated with the latest developments in this rapidly changing field.</p>
    `;
}

// ==========================================
// بناء HTML احترافي نهائي
// ==========================================
function buildProfessionalHTML(title, content, imageBase64, sourceName) {
    const imageHTML = imageBase64 ? `
        <div class="hero-image">
            <img src="${imageBase64}" alt="${title.replace(/[<>]/g, '')}" />
            <div class="image-caption">Featured Image</div>
        </div>
    ` : '';
    
    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content="Professional analysis and insights about ${title.replace(/[<>]/g, '')}" />
    <title>${title.replace(/[<>]/g, '')}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        .post-body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.8;
            color: #2c3e50;
            max-width: 850px;
            margin: 0 auto;
            padding: 30px;
            background: #ffffff;
        }
        
        /* Hero Image Style */
        .hero-image {
            position: relative;
            margin: -30px -30px 30px -30px;
            overflow: hidden;
        }
        
        .hero-image img {
            width: 100%;
            height: auto;
            max-height: 500px;
            object-fit: cover;
        }
        
        .image-caption {
            text-align: center;
            font-size: 13px;
            color: #7f8c8d;
            padding: 10px;
            background: #f8f9fa;
        }
        
        /* Headings */
        h1 {
            font-size: 36px;
            color: #2c3e50;
            margin: 30px 0 20px;
            line-height: 1.3;
        }
        
        h2 {
            font-size: 28px;
            color: #2c3e50;
            margin: 40px 0 20px;
            padding-bottom: 12px;
            border-bottom: 3px solid #3498db;
            position: relative;
        }
        
        h2:before {
            content: '';
            position: absolute;
            bottom: -3px;
            left: 0;
            width: 60px;
            height: 3px;
            background: #e74c3c;
        }
        
        h3 {
            font-size: 24px;
            color: #34495e;
            margin: 30px 0 15px;
        }
        
        /* Paragraphs and Text */
        p {
            margin-bottom: 25px;
            text-align: left;
        }
        
        strong {
            color: #2c3e50;
            font-weight: 600;
        }
        
        /* Lists */
        ul, ol {
            margin: 20px 0 25px 30px;
        }
        
        li {
            margin: 12px 0;
            line-height: 1.6;
        }
        
        /* Tables */
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 25px 0;
            background: #fff;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        th {
            background: #3498db;
            color: white;
            padding: 12px;
            text-align: left;
        }
        
        td {
            padding: 12px;
            border-bottom: 1px solid #ecf0f1;
        }
        
        tr:hover {
            background: #f8f9fa;
        }
        
        /* Blockquotes */
        blockquote {
            border-left: 4px solid #3498db;
            margin: 25px 0;
            padding: 15px 25px;
            background: #f8f9fa;
            font-style: italic;
            border-radius: 8px;
        }
        
        /* Code blocks */
        pre {
            background: #2c3e50;
            color: #ecf0f1;
            padding: 15px;
            border-radius: 8px;
            overflow-x: auto;
            margin: 20px 0;
        }
        
        code {
            background: #ecf0f1;
            padding: 2px 6px;
            border-radius: 4px;
            font-family: 'Courier New', monospace;
            font-size: 14px;
        }
        
        /* Call to Action */
        .cta-box {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            border-radius: 12px;
            margin: 40px 0;
            text-align: center;
        }
        
        .cta-box p {
            margin-bottom: 15px;
        }
        
        /* Responsive */
        @media (max-width: 768px) {
            .post-body {
                padding: 20px;
            }
            
            h1 { font-size: 28px; }
            h2 { font-size: 24px; }
            h3 { font-size: 20px; }
            
            ul, ol {
                margin-left: 20px;
            }
        }
        
        /* Print styles */
        @media print {
            .post-body {
                padding: 0;
            }
            .hero-image {
                margin: 0;
            }
        }
    </style>
</head>
<body>
    <div class='post-body'>
        ${imageHTML}
        <h1>${title.replace(/[<>]/g, '')}</h1>
        <div style="color: #7f8c8d; font-size: 14px; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 1px solid #ecf0f1;">
            📅 ${new Date().toLocaleDateString()} • ⏱️ ${Math.ceil(content.length / 1000)} min read • 📍 Source: ${sourceName}
        </div>
        ${content}
        <div class="cta-box">
            <p>📢 <strong>Stay Updated</strong></p>
            <p>Follow us for more professional insights and analysis</p>
            <p style="font-size: 12px; margin-top: 15px;">Share this article if you found it helpful!</p>
        </div>
    </div>
</body>
</html>`;
}

// ==========================================
// اختيار أفضل مصدر (High Value)
// ==========================================
async function selectBestSource() {
    // ترتيب المصادر حسب القيمة
    const prioritySources = [...HIGH_VALUE_SOURCES];
    
    for (const source of prioritySources) {
        try {
            console.log(`📡 Trying source: ${source.name} (${source.category})`);
            const feed = await parser.parseURL(source.url);
            
            if (feed.items && feed.items.length > 0) {
                // البحث عن مقال ذو جودة عالية (طول مناسب)
                for (const item of feed.items.slice(0, 5)) {
                    if (item.title && item.title.length > 20 && item.content || item.description) {
                        return {
                            source: source,
                            article: item
                        };
                    }
                }
            }
        } catch (error) {
            console.log(`⚠️ Failed: ${source.name}`);
            continue;
        }
    }
    return null;
}

// ==========================================
// استخراج الصورة
// ==========================================
function extractImageFromHtml($, articleUrl) {
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
        let url = img.attr('content') || img.attr('src') || img.attr('data-src');
        
        if (url && !url.includes('logo') && !url.includes('icon') && 
            !url.includes('avatar') && !url.includes('placeholder') &&
            url.match(/\.(jpg|jpeg|png|webp)/i)) {
            
            if (url.startsWith('//')) url = 'https:' + url;
            else if (!url.startsWith('http')) url = new URL(url, articleUrl).href;
            
            return url;
        }
    }
    return null;
}

// ==========================================
// المحرك الرئيسي المحسن
// ==========================================
async function runAutoBlogger() {
    try {
        console.log("\n🚀 Professional AutoBlogger v3.0\n" + "=".repeat(60));
        
        // 1. اختيار أفضل مصدر
        console.log("🎯 Selecting high-value source...");
        const selected = await selectBestSource();
        
        if (!selected) {
            throw new Error("No valid sources found");
        }
        
        const { source, article } = selected;
        console.log(`✅ Selected: ${source.name} (${source.category.toUpperCase()})`);
        console.log(`📰 Article: ${article.title}`);
        console.log(`🔗 Link: ${article.link}`);
        
        // 2. جلب المقال الكامل
        console.log("🌐 Fetching full content...");
        const response = await axios.get(article.link, {
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        // 3. استخراج المحتوى
        console.log("🧹 Extracting main content...");
        const cleanText = extractMainContent(response.data);
        
        if (!cleanText || cleanText.length < 300) {
            throw new Error("Content too short or failed to extract");
        }
        
        console.log(`📝 Content length: ${cleanText.length} chars`);
        
        // 4. معالجة الصورة
        console.log("🎨 Creating professional image with title...");
        const $ = cheerio.load(response.data);
        const imageUrl = extractImageFromHtml($, article.link);
        let processedImage = null;
        
        if (imageUrl) {
            processedImage = await processImageWithTitle(imageUrl, article.title);
            if (processedImage) console.log("✅ Professional image created");
        }
        
        // 5. إنشاء محتوى احترافي
        console.log("📝 Creating structured professional content...");
        const professionalContent = await createProfessionalContent(
            article.title, 
            cleanText, 
            source.category
        );
        
        // 6. بناء HTML النهائي
        console.log("🏗️ Building final HTML with professional design...");
        const finalHTML = buildProfessionalHTML(
            article.title,
            professionalContent,
            processedImage,
            source.name
        );
        
        // 7. النشر
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
                title: article.title,
                content: finalHTML,
                labels: [source.category.toUpperCase(), 'Professional', 'High Value'],
                status: 'LIVE'
            }
        });
        
        console.log("\n" + "=".repeat(60));
        console.log("🎉 SUCCESS! Professional article published!");
        console.log(`📖 URL: ${result.data.url}`);
        console.log(`🏷️ Category: ${source.category}`);
        console.log(`💎 Value: High RPM Content`);
        console.log("=".repeat(60) + "\n");
        
    } catch (error) {
        console.error("\n❌ Fatal Error:", error.message);
        if (error.stack) console.error("Stack:", error.stack);
    }
}

// ==========================================
// التشغيل
// ==========================================
console.log("🤖 Professional AutoBlogger v3.0");
console.log("💎 Optimized for High RPM Content");
console.log(`📅 ${new Date().toLocaleString()}\n`);

runAutoBlogger();

// تشغيل كل 4 ساعات لمصادر عالية الربح
// setInterval(runAutoBlogger, 4 * 60 * 60 * 1000);
