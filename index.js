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

// أفضل المصادر التي توفر محتوى كامل وجاهز (Content-Rich Sources)
const HIGH_VALUE_SOURCES = [
    // تكنولوجيا - محتوى كامل ومباشر
    { url: 'https://techcrunch.com/feed/', name: 'TechCrunch', category: 'tech', value: 'high', direct: true },
    { url: 'https://www.wired.com/feed/rss', name: 'Wired', category: 'tech', value: 'high', direct: true },
    { url: 'https://arstechnica.com/feed/', name: 'Ars Technica', category: 'tech', value: 'high', direct: true },
    { url: 'https://www.theverge.com/rss/index.xml', name: 'The Verge', category: 'tech', value: 'high', direct: true },
    { url: 'https://www.engadget.com/rss.xml', name: 'Engadget', category: 'tech', value: 'high', direct: true },
    { url: 'https://www.techradar.com/rss', name: 'TechRadar', category: 'tech', value: 'high', direct: true },
    { url: 'https://www.digitaltrends.com/feed/', name: 'Digital Trends', category: 'tech', value: 'high', direct: true },
    { url: 'https://www.pcmag.com/feed', name: 'PCMag', category: 'tech', value: 'high', direct: true },
    
    // AI وذكاء اصطناعي - محتوى كامل
    { url: 'https://techcrunch.com/category/artificial-intelligence/feed/', name: 'TechCrunch AI', category: 'ai', value: 'very_high', direct: true },
    { url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml', name: 'The Verge AI', category: 'ai', value: 'very_high', direct: true },
    
    // مالية واقتصاد - محتوى كامل
    { url: 'https://www.businessinsider.com/rss', name: 'Business Insider', category: 'finance', value: 'high', direct: true },
    { url: 'https://fortune.com/feed/', name: 'Fortune', category: 'finance', value: 'high', direct: true },
    
    // كريبتو - محتوى كامل
    { url: 'https://cointelegraph.com/rss', name: 'CoinTelegraph', category: 'crypto', value: 'very_high', direct: true },
    { url: 'https://www.coindesk.com/arc/outboundfeeds/rss/', name: 'CoinDesk', category: 'crypto', value: 'very_high', direct: true },
    { url: 'https://cryptopotato.com/feed/', name: 'CryptoPotato', category: 'crypto', value: 'high', direct: true },
    
    // تطوير وبرمجة
    { url: 'https://dev.to/feed', name: 'Dev.to', category: 'programming', value: 'medium', direct: true },
    { url: 'https://www.smashingmagazine.com/feed/', name: 'Smashing Magazine', category: 'programming', value: 'medium', direct: true },
    { url: 'https://css-tricks.com/feed/', name: 'CSS-Tricks', category: 'programming', value: 'medium', direct: true },
    
    // صحة وطب
    { url: 'https://www.medicalnewstoday.com/feed', name: 'Medical News Today', category: 'health', value: 'high', direct: true },
    { url: 'https://www.news-medical.net/feed.aspx', name: 'News Medical', category: 'health', value: 'high', direct: true },
    
    // سيو وتسويق
    { url: 'https://moz.com/feed', name: 'Moz', category: 'seo', value: 'high', direct: true },
    { url: 'https://neilpatel.com/feed/', name: 'Neil Patel', category: 'marketing', value: 'high', direct: true },
    { url: 'https://searchenginejournal.com/feed/', name: 'Search Engine Journal', category: 'seo', value: 'high', direct: true },
    
    // أخبار عامة مع محتوى كامل
    { url: 'https://www.theguardian.com/world/rss', name: 'The Guardian', category: 'news', value: 'medium', direct: true },
    { url: 'https://www.independent.co.uk/news/uk/rss', name: 'The Independent', category: 'news', value: 'medium', direct: true }
];

const groq = new Groq({ apiKey: CONFIG.groq.apiKey });
const parser = new Parser({
    timeout: 20000,
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
        
        console.log("🎨 Processing image with title overlay...");
        
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
        
        // تحسينات احترافية
        image.contrast(0.1);
        image.brightness(0.05);
        
        // تحجيم الصورة
        const maxWidth = 1000;
        if (image.getWidth() > maxWidth) {
            image.resize(maxWidth, Jimp.AUTO);
        }
        
        const finalWidth = image.getWidth();
        const finalHeight = image.getHeight();
        
        // تحميل الخطوط
        const titleFont = await Jimp.loadFont(Jimp.FONT_SANS_64_WHITE);
        const subFont = await Jimp.loadFont(Jimp.FONT_SANS_32_WHITE);
        
        // تجهيز العنوان
        let displayTitle = articleTitle.length > 55 ? articleTitle.substring(0, 52) + '...' : articleTitle;
        const titleWidth = Jimp.measureText(titleFont, displayTitle);
        const titleHeight = Jimp.measureTextHeight(titleFont, displayTitle);
        
        // خلفية للعنوان
        const bgPadding = 30;
        const bgWidth = Math.min(titleWidth + (bgPadding * 2), finalWidth - 40);
        const bgHeight = titleHeight + 50;
        
        const titleX = (finalWidth - bgWidth) / 2;
        const titleY = finalHeight - bgHeight - 30;
        
        // خلفية متدرجة
        const gradientBg = new Jimp(bgWidth, bgHeight, 0x000000aa);
        image.composite(gradientBg, titleX, titleY);
        
        // إضافة العنوان
        image.print(
            titleFont,
            titleX + (bgWidth / 2) - (titleWidth / 2),
            titleY + 20,
            displayTitle
        );
        
        // علامة مائية صغيرة
        const watermarkText = "© TRENDING TECH";
        const watermarkWidth = Jimp.measureText(subFont, watermarkText);
        image.print(
            subFont,
            finalWidth - watermarkWidth - 15,
            finalHeight - 30,
            watermarkText
        );
        
        image.quality(85);
        return await image.getBase64Async(Jimp.MIME_JPEG);
        
    } catch (error) {
        console.error("Image processing error:", error.message);
        return null;
    }
}

// ==========================================
// استخراج المحتوى الكامل من الصفحة
// ==========================================
async function extractFullContent(html, url) {
    try {
        const $ = cheerio.load(html);
        
        // إزالة العناصر غير المرغوب فيها
        $('script, style, iframe, nav, footer, header, aside, .ad, .advertisement, .social-share, .comments, .related, .newsletter, .popup, .cookie, .sidebar, .menu, .navigation, .ads, .sponsored').remove();
        
        // البحث عن المحتوى الرئيسي
        let content = '';
        const selectors = [
            'article', '.article-content', '.post-content', '.entry-content', 
            '.story-content', '.article-body', '.main-content', '.content',
            '[itemprop="articleBody"]', '.single-post-content', '.post-body'
        ];
        
        for (const selector of selectors) {
            const element = $(selector);
            if (element.length > 0) {
                // محاولة استخراج النص مع الحفاظ على بعض التنسيق
                content = element.text();
                if (content.length > 500) break;
            }
        }
        
        if (!content || content.length < 200) {
            // محاولة الحصول على المحتوى من body
            content = $('body').text();
        }
        
        // تنظيف النص
        content = content.replace(/\s+/g, ' ')
                        .replace(/[^\w\s.,!?;:()\-"']/g, '')
                        .trim();
        
        // إزالة التكرارات
        const sentences = content.split(/[.!?]+/);
        const uniqueSentences = [...new Set(sentences)];
        content = uniqueSentences.join('. ');
        
        // تحديد الطول المناسب
        if (content.length > 3500) {
            content = content.substring(0, 3500);
        }
        
        return content;
        
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
            return generateFallbackContent(title, category);
        }
        
        console.log("🤖 Creating professional content...");
        
        const prompt = `Create a high-quality, SEO-optimized article with perfect structure:

TITLE: ${title}
CATEGORY: ${category}
SOURCE CONTENT: ${cleanText.substring(0, 2500)}

REQUIRED STRUCTURE:

1. INTRODUCTION (2-3 paragraphs with a strong hook)
2. KEY POINTS OVERVIEW (numbered list of 3-5 main points)
3. MAIN SECTIONS (each with <h2> headings):
   - Use <h3> for subsections
   - Include bullet points with ✅ for benefits
   - Include numbered lists for steps
4. COMPARISON OR ANALYSIS (if applicable)
5. EXPERT INSIGHTS or TIPS
6. CONCLUSION with summary and call-to-action

FORMATTING RULES:
- Use emojis: 🚀 💡 📊 🔥 ⭐ ✅ 👉
- Bold important terms with <strong>
- Keep paragraphs short (2-3 sentences)
- Add a "Key Takeaways" section with bullet points
- Include a "FAQ" section if relevant

Write in professional, engaging English. Start directly with content:`;

        const completion = await groq.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: "You are an expert content writer. Create structured, engaging articles with proper HTML formatting. Use rich formatting and emojis."
                },
                {
                    role: "user",
                    content: prompt
                }
            ],
            model: "mixtral-8x7b-32768",
            temperature: 0.7,
            max_tokens: 2800
        });
        
        let content = completion.choices[0]?.message?.content || '';
        
        if (!content || content.length < 400) {
            return generateFallbackContent(title, category);
        }
        
        // تنظيف المحتوى
        content = content.replace(/```html|```/g, '');
        
        // إضافة جدول محتويات
        const toc = generateTableOfContents(content);
        
        return toc + content;
        
    } catch (error) {
        console.error("AI Error:", error.message);
        return generateFallbackContent(title, category);
    }
}

// ==========================================
// جدول محتويات تفاعلي
// ==========================================
function generateTableOfContents(content) {
    const headings = content.match(/<h2[^>]*>(.*?)<\/h2>/g);
    if (!headings || headings.length < 2) return '';
    
    let toc = '<div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 25px; border-radius: 12px; margin: 20px 0;">';
    toc += '<h3 style="margin: 0 0 15px 0; color: white;">📑 Table of Contents</h3>';
    toc += '<ul style="list-style: none; padding-left: 0; margin: 0;">';
    
    headings.forEach((heading, index) => {
        const title = heading.replace(/<[^>]*>/g, '');
        const id = `section-${index}`;
        toc += `<li style="margin: 8px 0;">👉 <a href="#${id}" style="color: white; text-decoration: none;">${title}</a></li>`;
    });
    
    toc += '</ul></div>';
    return toc;
}

// ==========================================
// محتوى احتياطي عالي الجودة
// ==========================================
function generateFallbackContent(title, category) {
    return `
        <h2>🔥 Breaking: ${title}</h2>
        <p>Stay informed with the latest developments in ${category}. This comprehensive analysis covers everything you need to know.</p>
        
        <h2>📊 Key Highlights</h2>
        <ul>
            <li>✅ Major breakthrough in the industry</li>
            <li>✅ Significant impact on global markets</li>
            <li>✅ Expert insights and analysis</li>
            <li>✅ Future predictions and trends</li>
        </ul>
        
        <h2>💡 Why This Matters</h2>
        <p>Understanding these developments is crucial for staying ahead in today's fast-paced digital landscape. The implications affect businesses, consumers, and technology adoption worldwide.</p>
        
        <h2>🎯 Key Takeaways</h2>
        <ul>
            <li>📌 Stay updated with industry changes</li>
            <li>📌 Adapt strategies accordingly</li>
            <li>📌 Monitor competitor responses</li>
        </ul>
        
        <h2>🔮 What's Next</h2>
        <p>Industry experts predict continued evolution in this space. Follow our blog for regular updates and in-depth analysis of emerging trends.</p>
        
        <div style="background: #f0f0f0; padding: 20px; border-radius: 8px; margin: 30px 0;">
            <p style="margin: 0;"><strong>📢 Want to stay updated?</strong> Bookmark this page and check back regularly for more professional insights.</p>
        </div>
    `;
}

// ==========================================
// استخراج الصورة
// ==========================================
function extractImage($, url) {
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
        let imgUrl = img.attr('content') || img.attr('src') || img.attr('data-src');
        
        if (imgUrl && !imgUrl.includes('logo') && !imgUrl.includes('icon') && 
            !imgUrl.includes('avatar') && !imgUrl.includes('placeholder') &&
            (imgUrl.match(/\.(jpg|jpeg|png|webp)/i) || imgUrl.includes('images'))) {
            
            if (imgUrl.startsWith('//')) imgUrl = 'https:' + imgUrl;
            else if (!imgUrl.startsWith('http')) imgUrl = new URL(imgUrl, url).href;
            
            return imgUrl;
        }
    }
    return null;
}

// ==========================================
// اختيار أفضل مصدر
// ==========================================
async function selectBestSource() {
    // ترتيب المصادر حسب الأولوية
    const priorityOrder = ['very_high', 'high', 'medium'];
    const sortedSources = [...HIGH_VALUE_SOURCES].sort((a, b) => {
        const aValue = priorityOrder.indexOf(a.value);
        const bValue = priorityOrder.indexOf(b.value);
        return aValue - bValue;
    });
    
    for (const source of sortedSources) {
        try {
            console.log(`📡 Trying: ${source.name} (${source.category})`);
            const feed = await parser.parseURL(source.url);
            
            if (feed.items && feed.items.length > 0) {
                // تجربة أول 3 مقالات
                for (let i = 0; i < Math.min(3, feed.items.length); i++) {
                    const item = feed.items[i];
                    
                    if (item.title && item.title.length > 15) {
                        // التحقق من وجود محتوى
                        let hasContent = false;
                        
                        if (item.content) {
                            hasContent = item.content.length > 200;
                        } else if (item.description) {
                            hasContent = item.description.length > 200;
                        } else {
                            hasContent = true; // سنحاول جلب المحتوى
                        }
                        
                        if (hasContent) {
                            console.log(`✅ Found: ${source.name} - ${item.title.substring(0, 50)}...`);
                            return {
                                source: source,
                                article: item
                            };
                        }
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
// بناء HTML احترافي
// ==========================================
function buildProfessionalHTML(title, content, imageBase64, sourceName, category) {
    const imageHTML = imageBase64 ? `
        <div style="text-align: center; margin: 0 -30px 30px -30px;">
            <img src="${imageBase64}" alt="${title.replace(/[<>]/g, '')}" style="width: 100%; height: auto; max-height: 500px; object-fit: cover;" />
        </div>
    ` : '';
    
    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="description" content="Professional analysis of ${title.replace(/[<>]/g, '')}">
    <title>${title.replace(/[<>]/g, '')}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.8;
            color: #333;
            background: #f5f5f5;
        }
        .post-body {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            padding: 40px;
            box-shadow: 0 0 20px rgba(0,0,0,0.1);
        }
        h1 { font-size: 36px; color: #2c3e50; margin: 30px 0 20px; line-height: 1.3; }
        h2 { font-size: 28px; color: #2c3e50; margin: 40px 0 20px; padding-bottom: 10px; border-bottom: 3px solid #3498db; }
        h3 { font-size: 24px; color: #34495e; margin: 30px 0 15px; }
        p { margin-bottom: 25px; font-size: 18px; }
        ul, ol { margin: 20px 0 25px 30px; }
        li { margin: 10px 0; }
        strong { color: #2c3e50; font-weight: 600; }
        .meta {
            color: #7f8c8d;
            font-size: 14px;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 1px solid #ecf0f1;
        }
        @media (max-width: 768px) {
            .post-body { padding: 20px; }
            h1 { font-size: 28px; }
            h2 { font-size: 24px; }
            h3 { font-size: 20px; }
            p { font-size: 16px; }
            ul, ol { margin-left: 20px; }
        }
    </style>
</head>
<body>
    <div class='post-body'>
        ${imageHTML}
        <h1>${title.replace(/[<>]/g, '')}</h1>
        <div class="meta">
            📅 ${new Date().toLocaleDateString()} • ⏱️ ${Math.ceil(content.length / 1500)} min read • 🏷️ ${category.toUpperCase()}
        </div>
        ${content}
        <div style="margin-top: 50px; padding-top: 20px; border-top: 2px solid #ecf0f1; text-align: center; font-size: 14px; color: #95a5a6;">
            <p>📱 Source: ${sourceName} • Professional Analysis</p>
        </div>
    </div>
</body>
</html>`;
}

// ==========================================
// المحرك الرئيسي
// ==========================================
async function runAutoBlogger() {
    try {
        console.log("\n🚀 Professional AutoBlogger v3.1\n" + "=".repeat(60));
        
        // 1. اختيار أفضل مصدر
        console.log("🎯 Selecting high-value source...");
        const selected = await selectBestSource();
        
        if (!selected) {
            throw new Error("No valid sources found");
        }
        
        const { source, article } = selected;
        console.log(`✅ Selected: ${source.name} (${source.category.toUpperCase()})`);
        console.log(`📰 Title: ${article.title}`);
        console.log(`🔗 Link: ${article.link}`);
        
        // 2. جلب المقال الكامل
        console.log("🌐 Fetching full content...");
        let fullHtml = '';
        
        try {
            const response = await axios.get(article.link, {
                timeout: 20000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
                }
            });
            fullHtml = response.data;
        } catch (error) {
            console.log("⚠️ Using RSS content as fallback");
            if (article.content) {
                fullHtml = article.content;
            } else if (article.description) {
                fullHtml = article.description;
            } else {
                throw new Error("No content available");
            }
        }
        
        // 3. استخراج المحتوى
        console.log("🧹 Extracting main content...");
        const cleanText = await extractFullContent(fullHtml, article.link);
        
        if (!cleanText || cleanText.length < 200) {
            // استخدام محتوى RSS كبديل
            const rssContent = article.content || article.description || '';
            if (rssContent && rssContent.length > 200) {
                console.log("📝 Using RSS content as fallback");
                const fallbackText = cheerio.load(rssContent).text().slice(0, 3000);
                if (fallbackText.length > 200) {
                    const professionalContent = await createProfessionalContent(article.title, fallbackText, source.category);
                    const processedImage = null;
                    const finalHTML = buildProfessionalHTML(article.title, professionalContent, null, source.name, source.category);
                    await publishToBlogger(article.title, finalHTML);
                    return;
                }
            }
            throw new Error("Content extraction failed");
        }
        
        console.log(`📝 Content length: ${cleanText.length} chars`);
        
        // 4. معالجة الصورة
        console.log("🎨 Creating professional image...");
        const $ = cheerio.load(fullHtml);
        const imageUrl = extractImage($, article.link);
        let processedImage = null;
        
        if (imageUrl) {
            processedImage = await processImageWithTitle(imageUrl, article.title);
            if (processedImage) console.log("✅ Image created successfully");
        }
        
        // 5. إنشاء محتوى احترافي
        console.log("📝 Creating structured content...");
        const professionalContent = await createProfessionalContent(article.title, cleanText, source.category);
        
        // 6. بناء HTML
        console.log("🏗️ Building final HTML...");
        const finalHTML = buildProfessionalHTML(article.title, professionalContent, processedImage, source.name, source.category);
        
        // 7. النشر
        await publishToBlogger(article.title, finalHTML);
        
        console.log("\n" + "=".repeat(60));
        console.log("🎉 SUCCESS! Article published!");
        console.log("=".repeat(60) + "\n");
        
    } catch (error) {
        console.error("\n❌ Fatal Error:", error.message);
        if (error.stack) console.error("Stack:", error.stack);
    }
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
                labels: ['Professional', 'Auto Post', 'High Quality'],
                status: 'LIVE'
            }
        });
        
        console.log(`✅ Published! URL: ${result.data.url}`);
        return result.data;
        
    } catch (error) {
        console.error("Blogger Error:", error.message);
        throw error;
    }
}

// ==========================================
// التشغيل
// ==========================================
console.log("🤖 Professional AutoBlogger v3.1");
console.log("💎 Optimized for Content-Rich Sources");
console.log(`📅 ${new Date().toLocaleString()}\n`);

runAutoBlogger();
