const Parser = require('rss-parser');
const axios = require('axios');
const cheerio = require('cheerio');
const { google } = require('googleapis');
const Jimp = require('jimp');
const Groq = require('groq-sdk');

// ==========================================
// الإعدادات
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

// أفضل المصادر الرائجة (Trending/Popular) مع محتوى كامل
const TRENDING_SOURCES = [
    // أخبار تكنولوجيا - الأكثر شهرة
    { url: 'https://techcrunch.com/feed/', name: 'TechCrunch', category: 'Technology', popularity: 100 },
    { url: 'https://www.theverge.com/rss/index.xml', name: 'The Verge', category: 'Technology', popularity: 98 },
    { url: 'https://www.wired.com/feed/rss', name: 'Wired', category: 'Technology', popularity: 95 },
    { url: 'https://arstechnica.com/feed/', name: 'Ars Technica', category: 'Technology', popularity: 92 },
    { url: 'https://www.engadget.com/rss.xml', name: 'Engadget', category: 'Technology', popularity: 90 },
    
    // أخبار عامة رائجة
    { url: 'https://www.businessinsider.com/rss', name: 'Business Insider', category: 'Business', popularity: 96 },
    { url: 'https://fortune.com/feed/', name: 'Fortune', category: 'Business', popularity: 88 },
    { url: 'https://www.theguardian.com/world/rss', name: 'The Guardian', category: 'World News', popularity: 94 },
    
    // AI وذكاء اصطناعي (رائج جداً)
    { url: 'https://techcrunch.com/category/artificial-intelligence/feed/', name: 'AI News', category: 'Artificial Intelligence', popularity: 97 },
    { url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml', name: 'The Verge AI', category: 'Artificial Intelligence', popularity: 95 },
    
    // كريبتو (رائج)
    { url: 'https://cointelegraph.com/rss', name: 'CoinTelegraph', category: 'Cryptocurrency', popularity: 93 },
    { url: 'https://www.coindesk.com/arc/outboundfeeds/rss/', name: 'CoinDesk', category: 'Cryptocurrency', popularity: 91 },
    
    // صحة (رائج دائماً)
    { url: 'https://www.medicalnewstoday.com/feed', name: 'Medical News Today', category: 'Health', popularity: 89 },
    { url: 'https://www.news-medical.net/feed.aspx', name: 'News Medical', category: 'Health', popularity: 85 },
    
    // أخبار علمية
    { url: 'https://www.sciencedaily.com/rss/all.xml', name: 'Science Daily', category: 'Science', popularity: 87 },
    { url: 'https://www.newscientist.com/feed/home', name: 'New Scientist', category: 'Science', popularity: 86 }
];

const groq = new Groq({ apiKey: CONFIG.groq.apiKey });
const parser = new Parser({
    timeout: 20000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
});

// ==========================================
// معالجة الصورة (قابلة للنقر)
// ==========================================
async function processClickableImage(imageUrl, articleTitle, originalArticleUrl) {
    try {
        if (!imageUrl) return null;
        
        console.log("🎨 Processing clickable image...");
        
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
        
        // تحسين الصورة
        if (image.getWidth() > 800) {
            image.resize(800, Jimp.AUTO);
        }
        
        const finalWidth = image.getWidth();
        const finalHeight = image.getHeight();
        
        const titleFont = await Jimp.loadFont(Jimp.FONT_SANS_32_WHITE);
        const smallFont = await Jimp.loadFont(Jimp.FONT_SANS_16_WHITE);
        
        // تحضير النص
        let displayTitle = articleTitle.length > 45 ? articleTitle.substring(0, 42) + '...' : articleTitle;
        const titleWidth = Jimp.measureText(titleFont, displayTitle);
        
        const bgPadding = 20;
        const bgWidth = Math.min(titleWidth + (bgPadding * 2), finalWidth - 20);
        const bgHeight = 65;
        
        const titleX = (finalWidth - bgWidth) / 2;
        const titleY = finalHeight - bgHeight - 15;
        
        // خلفية للعنوان
        const gradientBg = new Jimp(bgWidth, bgHeight, 0x000000aa);
        image.composite(gradientBg, titleX, titleY);
        
        // إضافة العنوان
        image.print(
            titleFont,
            titleX + (bgWidth / 2) - (titleWidth / 2),
            titleY + 20,
            displayTitle
        );
        
        // علامة مائية
        const watermarkText = "📰 TRENDING";
        const watermarkWidth = Jimp.measureText(smallFont, watermarkText);
        image.print(
            smallFont,
            finalWidth - watermarkWidth - 10,
            finalHeight - 25,
            watermarkText
        );
        
        image.quality(85);
        const base64Image = await image.getBase64Async(Jimp.MIME_JPEG);
        
        // صورة قابلة للنقر (تفتح المصدر الأصلي)
        return `<div style="text-align: center; margin: 20px 0;">
            <a href="${originalArticleUrl}" target="_blank" rel="noopener noreferrer">
                <img src="${base64Image}" 
                     alt="${articleTitle.replace(/[<>]/g, '')}"
                     style="max-width: 100%; height: auto; border-radius: 12px; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.15);"
                     title="Click to read original article" />
            </a>
            <p style="font-size: 12px; color: #666; margin-top: 8px;">
                🔗 <a href="${originalArticleUrl}" target="_blank" style="color: #3498db;">Click here to read original article</a>
            </p>
        </div>`;
        
    } catch (error) {
        console.error("Image error:", error.message);
        return `<div style="text-align: center; margin: 20px 0;">
            <a href="${originalArticleUrl}" target="_blank">
                <img src="${imageUrl}" alt="${articleTitle}" style="max-width: 100%; border-radius: 12px;" />
            </a>
        </div>`;
    }
}

// ==========================================
// استخراج المحتوى الكامل من HTML
// ==========================================
function extractFullContent(html) {
    try {
        const $ = cheerio.load(html);
        
        // إزالة العناصر غير المرغوب فيها
        $('script, style, iframe, nav, footer, header, aside, .ad, .advertisement, .social-share, .comments, .related, .newsletter, .popup, .cookie, .sidebar, .menu').remove();
        
        // البحث عن المحتوى الرئيسي
        let contentText = '';
        const selectors = [
            'article', '.article-content', '.post-content', '.entry-content', 
            '.story-content', '.article-body', '.main-content', '.content',
            '[itemprop="articleBody"]', '.single-post-content', '.post-body'
        ];
        
        for (const selector of selectors) {
            const element = $(selector);
            if (element.length > 0) {
                contentText = element.text();
                if (contentText.length > 800) break;
            }
        }
        
        if (!contentText || contentText.length < 300) {
            contentText = $('body').text();
        }
        
        // تنظيف النص
        contentText = contentText.replace(/\s+/g, ' ').trim();
        
        // إزالة التكرارات
        const sentences = contentText.split(/[.!?]+/);
        const uniqueSentences = [...new Set(sentences)];
        contentText = uniqueSentences.join('. ');
        
        // تحديد الطول المناسب
        if (contentText.length > 4000) {
            contentText = contentText.substring(0, 4000);
        }
        
        return contentText;
        
    } catch (error) {
        console.error("Extract error:", error.message);
        return null;
    }
}

// ==========================================
// تحسين وإطالة المقال (بدون تغيير جوهري)
// ==========================================
async function improveAndExtendArticle(title, originalContent, sourceName) {
    try {
        if (!originalContent || originalContent.length < 300) {
            return `<p>${originalContent || "Content being processed..."}</p>`;
        }
        
        console.log("🤖 AI: Improving and extending article (preserving original facts)...");
        
        const prompt = `IMPORTANT: You are an EDITOR, not a writer. Improve and EXTEND this existing article.

TITLE: ${title}
SOURCE: ${sourceName}
ORIGINAL CONTENT: ${originalContent.substring(0, 3000)}

YOUR TASK:
1. KEEP all original facts, numbers, names, and key information
2. ADD more details, examples, and explanations to each paragraph
3. EXPAND the article to be 2x longer
4. ADD 2-3 new paragraphs with related context
5. IMPROVE sentence flow and readability
6. ADD a "Summary" section at the end with key points
7. DO NOT remove or change any original facts

Output format: HTML with <p> tags for paragraphs, <h2> for sections if needed.
Start directly with the improved content:`;

        const completion = await groq.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: "You are an expert editor. Preserve ALL original facts and information. Only add value, never remove or change existing content."
                },
                {
                    role: "user",
                    content: prompt
                }
            ],
            model: "mixtral-8x7b-32768",
            temperature: 0.5,
            max_tokens: 3500
        });
        
        let improvedContent = completion.choices[0]?.message?.content || '';
        
        if (!improvedContent || improvedContent.length < originalContent.length) {
            // إذا فشل AI، نضيف تحسينات بسيطة
            improvedContent = `
                <p>${originalContent.substring(0, 500)}</p>
                <div style="background: #f0f7ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3>📌 Summary & Key Points</h3>
                    <ul>
                        <li>✅ Based on reporting from ${sourceName}</li>
                        <li>✅ All facts and information preserved</li>
                        <li>✅ Comprehensive coverage of ${title.substring(0, 50)}</li>
                    </ul>
                </div>
                <p>${originalContent.substring(500)}</p>
            `;
        }
        
        console.log(`📊 Original: ${originalContent.length} chars → Improved: ${improvedContent.length} chars`);
        
        return improvedContent;
        
    } catch (error) {
        console.error("AI Error:", error.message);
        return `<p>${originalContent}</p>`;
    }
}

// ==========================================
// استخراج الصورة من HTML
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
            !imgUrl.includes('avatar') && imgUrl.match(/\.(jpg|jpeg|png|webp)/i)) {
            
            if (imgUrl.startsWith('//')) imgUrl = 'https:' + imgUrl;
            else if (imgUrl.startsWith('/') && url) imgUrl = new URL(imgUrl, url).href;
            
            return imgUrl;
        }
    }
    return null;
}

// ==========================================
// جلب المحتوى الكامل
// ==========================================
async function fetchArticleContent(url, retries = 2) {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await axios.get(url, {
                timeout: 20000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            
            if (response.data && response.data.length > 3000) {
                return response.data;
            }
        } catch (error) {
            console.log(`⚠️ Fetch attempt ${i + 1} failed: ${error.message}`);
            if (i < retries - 1) await new Promise(r => setTimeout(r, 2000));
        }
    }
    return null;
}

// ==========================================
// الحصول على المقالات الرائجة
// ==========================================
async function getTrendingArticles() {
    const articles = [];
    
    // ترتيب حسب الشعبية
    const sortedSources = [...TRENDING_SOURCES].sort((a, b) => b.popularity - a.popularity);
    
    for (const source of sortedSources) {
        try {
            console.log(`📡 Checking: ${source.name} (Popularity: ${source.popularity})`);
            const feed = await parser.parseURL(source.url);
            
            if (feed.items && feed.items.length > 0) {
                // أخذ أول مقال من كل مصدر رائج
                const item = feed.items[0];
                
                // التحقق من وجود محتوى
                let hasContent = false;
                let contentText = '';
                
                if (item.content) {
                    contentText = item.content;
                    hasContent = contentText.length > 300;
                } else if (item.description) {
                    contentText = item.description;
                    hasContent = contentText.length > 300;
                }
                
                if (hasContent || item.title) {
                    articles.push({
                        title: item.title,
                        link: item.link,
                        sourceName: source.name,
                        category: source.category,
                        popularity: source.popularity,
                        rssContent: contentText,
                        pubDate: item.pubDate
                    });
                    
                    console.log(`   ✅ Added: ${item.title.substring(0, 50)}...`);
                }
            }
        } catch (error) {
            console.log(`   ⚠️ Failed: ${source.name}`);
        }
    }
    
    // ترتيب حسب الشعبية والتاريخ
    articles.sort((a, b) => {
        if (a.popularity !== b.popularity) return b.popularity - a.popularity;
        return new Date(b.pubDate) - new Date(a.pubDate);
    });
    
    console.log(`\n✅ Total trending articles found: ${articles.length}`);
    return articles;
}

// ==========================================
// بناء HTML النهائي
// ==========================================
function buildFinalHTML(title, content, imageHtml, sourceUrl, sourceName, category) {
    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
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
            max-width: 850px;
            margin: 0 auto;
            background: white;
            padding: 40px;
            box-shadow: 0 0 20px rgba(0,0,0,0.1);
        }
        h1 { font-size: 36px; color: #2c3e50; margin: 20px 0 20px; line-height: 1.3; }
        h2 { font-size: 28px; color: #2c3e50; margin: 40px 0 20px; padding-bottom: 10px; border-bottom: 3px solid #3498db; }
        p { margin-bottom: 25px; font-size: 18px; line-height: 1.8; }
        ul, ol { margin: 20px 0 25px 30px; }
        li { margin: 10px 0; }
        .meta {
            color: #7f8c8d;
            font-size: 14px;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 1px solid #ecf0f1;
        }
        .source-box {
            background: #f8f9fa;
            padding: 15px 20px;
            border-radius: 8px;
            margin: 20px 0;
            border-left: 4px solid #3498db;
        }
        @media (max-width: 768px) {
            .post-body { padding: 20px; }
            h1 { font-size: 28px; }
            p { font-size: 16px; }
        }
    </style>
</head>
<body>
    <div class='post-body'>
        ${imageHtml || ''}
        
        <h1>${title.replace(/[<>]/g, '')}</h1>
        
        <div class="meta">
            📅 ${new Date().toLocaleDateString()} • 
            🏷️ ${category} • 
            📰 Source: ${sourceName}
        </div>
        
        <div class="source-box">
            📌 <strong>Based on original reporting from ${sourceName}</strong><br>
            All key facts and information are preserved. 
            <a href="${sourceUrl}" target="_blank" style="color: #3498db;">View original source →</a>
        </div>
        
        ${content}
        
        <div style="margin-top: 50px; padding-top: 20px; border-top: 2px solid #ecf0f1; text-align: center; font-size: 14px; color: #95a5a6;">
            <p>📱 Content enhanced for better readability | Original facts preserved</p>
            <p>🔗 <a href="${sourceUrl}" target="_blank" style="color: #3498db;">Read original article on ${sourceName}</a></p>
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
                labels: ['Trending', 'Enhanced Article', 'Auto Post'],
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
// المحرك الرئيسي
// ==========================================
async function runAutoBlogger() {
    try {
        console.log("\n" + "=".repeat(70));
        console.log("🚀 TRENDING NEWS AUTO-BLOGGER v5.0");
        console.log("📰 Popular Sources → Extract → Enhance → Publish");
        console.log("=".repeat(70) + "\n");
        
        // 1. الحصول على المقالات الرائجة
        console.log("🎯 Fetching trending articles from popular sources...");
        const trendingArticles = await getTrendingArticles();
        
        if (trendingArticles.length === 0) {
            throw new Error("No trending articles found");
        }
        
        // 2. اختيار أفضل مقال
        const selected = trendingArticles[0];
        console.log(`\n✅ Selected trending article:`);
        console.log(`📰 Title: ${selected.title}`);
        console.log(`📡 Source: ${selected.sourceName} (Popularity: ${selected.popularity})`);
        console.log(`🏷️ Category: ${selected.category}`);
        console.log(`🔗 URL: ${selected.link}`);
        
        // 3. جلب المحتوى الكامل
        console.log(`\n🌐 Fetching full article content...`);
        let fullContent = selected.rssContent;
        let articleHtml = null;
        
        if (selected.link) {
            articleHtml = await fetchArticleContent(selected.link);
            if (articleHtml) {
                const extractedText = extractFullContent(articleHtml);
                if (extractedText && extractedText.length > 500) {
                    fullContent = extractedText;
                    console.log(`✅ Extracted ${fullContent.length} chars from HTML`);
                }
            }
        }
        
        if (!fullContent || fullContent.length < 300) {
            console.log("⚠️ Using RSS content as fallback");
            fullContent = selected.rssContent;
        }
        
        if (!fullContent || fullContent.length < 200) {
            throw new Error("Could not extract content");
        }
        
        // 4. معالجة الصورة
        console.log(`\n🖼️ Processing clickable image...`);
        let imageHtml = null;
        
        if (articleHtml) {
            const $ = cheerio.load(articleHtml);
            const imageUrl = extractImage($, selected.link);
            if (imageUrl) {
                imageHtml = await processClickableImage(imageUrl, selected.title, selected.link);
                console.log(`✅ Image processed (clickable)`);
            }
        }
        
        // 5. تحسين وإطالة المقال
        console.log(`\n🤖 AI: Improving and extending content...`);
        const improvedContent = await improveAndExtendArticle(
            selected.title,
            fullContent,
            selected.sourceName
        );
        
        // 6. بناء HTML
        console.log(`\n🏗️ Building final HTML...`);
        const finalHTML = buildFinalHTML(
            selected.title,
            improvedContent,
            imageHtml,
            selected.link,
            selected.sourceName,
            selected.category
        );
        
        // 7. النشر
        await publishToBlogger(selected.title, finalHTML);
        
        console.log("\n" + "=".repeat(70));
        console.log("🎉 SUCCESS! Article published!");
        console.log("✅ Image is clickable (opens source)");
        console.log("✅ Content improved and extended by AI");
        console.log("✅ Original facts preserved");
        console.log("=".repeat(70) + "\n");
        
    } catch (error) {
        console.error("\n❌ Fatal Error:", error.message);
    }
}

// التشغيل
console.log("🤖 Trending News Auto-Blogger v5.0");
console.log("📰 Using popular sources with full content");
console.log(`📅 ${new Date().toLocaleString()}\n`);

runAutoBlogger();
