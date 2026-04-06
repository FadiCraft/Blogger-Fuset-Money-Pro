const Parser = require('rss-parser');
const axios = require('axios');
const cheerio = require('cheerio');
const { google } = require('googleapis');
const Jimp = require('jimp');
const Groq = require('groq-sdk');
const HttpsProxyAgent = require('https-proxy-agent');

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
    },
    proxy: {
        useProxy: false, // غير إلى true إذا احتجت بروكسي
        // يمكنك إضافة بروكسي هنا مثل: 'http://user:pass@host:port'
        url: null
    }
};

// أخبار جوجل - أشهر المقالات (Trending/ Top Stories)
const GOOGLE_NEWS_SOURCES = [
    'https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en', // أخبار أمريكا
    'https://news.google.com/rss?hl=en&gl=GB&ceid=GB:en', // أخبار بريطانيا
    'https://news.google.com/rss?hl=en&gl=CA&ceid=CA:en', // أخبار كندا
    'https://news.google.com/rss?hl=en&gl=AU&ceid=AU:en', // أخبار أستراليا
    'https://news.google.com/rss?topic=WORLD&hl=en&gl=US&ceid=US:en', // أخبار العالم
    'https://news.google.com/rss?topic=TECH&hl=en&gl=US&ceid=US:en', // أخبار التكنولوجيا
    'https://news.google.com/rss?topic=BUSINESS&hl=en&gl=US&ceid=US:en', // أخبار الأعمال
    'https://news.google.com/rss?topic=SCIENCE&hl=en&gl=US&ceid=US:en', // أخبار العلوم
];

const groq = new Groq({ apiKey: CONFIG.groq.apiKey });
const parser = new Parser({
    timeout: 30000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
});

// إعداد البروكسي إذا لزم الأمر
let axiosConfig = {
    timeout: 30000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
    }
};

if (CONFIG.proxy.useProxy && CONFIG.proxy.url) {
    axiosConfig.httpsAgent = new HttpsProxyAgent(CONFIG.proxy.url);
}

// ==========================================
// استخراج رابط المقال الحقيقي من أخبار جوجل
// ==========================================
function extractRealUrl(googleNewsUrl) {
    try {
        // أخبار جوجل تعطي روابط مؤقتة، نحتاج استخراج الرابط الحقيقي
        if (googleNewsUrl.includes('news.google.com')) {
            // محاولة استخراج الرابط من معامل URL
            const urlParams = new URLSearchParams(googleNewsUrl.split('?')[1]);
            const actualUrl = urlParams.get('url');
            if (actualUrl) return decodeURIComponent(actualUrl);
        }
        return googleNewsUrl;
    } catch (error) {
        return googleNewsUrl;
    }
}

// ==========================================
// جلب المحتوى الكامل للمقال (مع إعادة محاولات)
// ==========================================
async function fetchFullArticle(url, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            console.log(`🌐 Fetching article (attempt ${i + 1}/${retries})...`);
            
            const response = await axios.get(url, axiosConfig);
            
            if (response.data && response.data.length > 5000) {
                console.log(`✅ Article fetched successfully (${(response.data.length / 1024).toFixed(0)} KB)`);
                return response.data;
            }
            
            console.log(`⚠️ Content too short, retrying...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
            
        } catch (error) {
            console.log(`⚠️ Attempt ${i + 1} failed: ${error.message}`);
            if (i < retries - 1) {
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
        }
    }
    return null;
}

// ==========================================
// استخراج المحتوى الكامل من HTML
// ==========================================
function extractFullContent(html, url) {
    try {
        const $ = cheerio.load(html);
        
        // إزالة العناصر غير المرغوب فيها
        $('script, style, iframe, nav, footer, header, aside, .ad, .advertisement, .social-share, .comments, .related, .newsletter, .popup, .cookie, .sidebar, .menu, .navigation, .ads, .sponsored, [role="banner"], [role="navigation"]').remove();
        
        // البحث عن المحتوى الرئيسي
        let contentHtml = '';
        let contentText = '';
        
        const selectors = [
            'article', '.article-content', '.post-content', '.entry-content', 
            '.story-content', '.article-body', '.main-content', '.content',
            '[itemprop="articleBody"]', '.single-post-content', '.post-body',
            '.story-body', '.article__body', '.paywall', '.article-text'
        ];
        
        for (const selector of selectors) {
            const element = $(selector);
            if (element.length > 0) {
                contentHtml = element.html();
                contentText = element.text();
                if (contentText.length > 1000) break;
            }
        }
        
        if (!contentHtml || contentText.length < 500) {
            // محاولة الحصول على المحتوى من body مع تنقية
            $('body').find('*').each(function() {
                const text = $(this).text();
                if (text.length > 200 && !$(this).parent().is('body')) {
                    contentHtml = $(this).html();
                    contentText = text;
                    return false;
                }
            });
        }
        
        if (!contentHtml || contentText.length < 300) {
            // استخدام النص الكامل كبديل
            contentText = $('body').text();
            contentHtml = `<p>${contentText}</p>`;
        }
        
        return {
            html: contentHtml,
            text: contentText.replace(/\s+/g, ' ').trim(),
            length: contentText.length
        };
        
    } catch (error) {
        console.error("Extract content error:", error.message);
        return null;
    }
}

// ==========================================
// استخراج الصورة الرئيسية مع رابطها
// ==========================================
function extractMainImage($, articleUrl) {
    const selectors = [
        'meta[property="og:image"]',
        'meta[name="twitter:image"]',
        'article img:first',
        '.post-content img:first',
        '.entry-content img:first',
        '.featured-image img',
        '.article-image img',
        '.story-image img',
        'img:first'
    ];
    
    for (const selector of selectors) {
        const img = $(selector);
        let imgUrl = img.attr('content') || img.attr('src') || img.attr('data-src');
        
        if (imgUrl && !imgUrl.includes('logo') && !imgUrl.includes('icon') && 
            !imgUrl.includes('avatar') && !imgUrl.includes('placeholder') &&
            !imgUrl.includes('pixel') && imgUrl.match(/\.(jpg|jpeg|png|webp|gif)/i)) {
            
            // تصحيح الرابط
            if (imgUrl.startsWith('//')) {
                imgUrl = 'https:' + imgUrl;
            } else if (imgUrl.startsWith('/')) {
                const urlObj = new URL(articleUrl);
                imgUrl = urlObj.origin + imgUrl;
            } else if (!imgUrl.startsWith('http')) {
                imgUrl = new URL(imgUrl, articleUrl).href;
            }
            
            return imgUrl;
        }
    }
    return null;
}

// ==========================================
// معالجة الصورة وإضافة علامة مائية مع رابط
// ==========================================
async function processImageWithLink(imageUrl, articleTitle, originalArticleUrl) {
    try {
        if (!imageUrl) return null;
        
        console.log("🎨 Processing image with watermark...");
        
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
        
        // تحميل الخطوط
        const titleFont = await Jimp.loadFont(Jimp.FONT_SANS_32_WHITE);
        const smallFont = await Jimp.loadFont(Jimp.FONT_SANS_16_WHITE);
        
        // تجهيز النص
        let displayTitle = articleTitle.length > 40 ? articleTitle.substring(0, 37) + '...' : articleTitle;
        const titleWidth = Jimp.measureText(titleFont, displayTitle);
        const titleHeight = Jimp.measureTextHeight(titleFont, displayTitle);
        
        // خلفية للعنوان (أسفل الصورة)
        const bgPadding = 20;
        const bgWidth = Math.min(titleWidth + (bgPadding * 2), finalWidth - 20);
        const bgHeight = titleHeight + 40;
        
        const titleX = (finalWidth - bgWidth) / 2;
        const titleY = finalHeight - bgHeight - 20;
        
        // خلفية شفافة
        const gradientBg = new Jimp(bgWidth, bgHeight, 0x000000aa);
        image.composite(gradientBg, titleX, titleY);
        
        // إضافة عنوان المقال
        image.print(
            titleFont,
            titleX + (bgWidth / 2) - (titleWidth / 2),
            titleY + 15,
            displayTitle
        );
        
        // إضافة علامة مائية صغيرة في الزاوية
        const watermarkText = "📰 TRENDING TECH";
        const watermarkWidth = Jimp.measureText(smallFont, watermarkText);
        image.print(
            smallFont,
            finalWidth - watermarkWidth - 10,
            finalHeight - 25,
            watermarkText
        );
        
        image.quality(85);
        const base64Image = await image.getBase64Async(Jimp.MIME_JPEG);
        
        // إرجاع الصورة كرابط HTML قابل للنقر
        return `<a href="${originalArticleUrl}" target="_blank" rel="noopener noreferrer">
            <img src="${base64Image}" 
                 alt="${articleTitle.replace(/[<>]/g, '')}"
                 style="width: 100%; max-width: 800px; height: auto; border-radius: 12px; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.15);"
                 title="Click to view original source" />
        </a>
        <p style="text-align: center; font-size: 12px; color: #666; margin-top: 8px;">
            🔗 Click image to read original article on source website
        </p>`;
        
    } catch (error) {
        console.error("Image processing error:", error.message);
        return null;
    }
}

// ==========================================
// تحسين وإطالة المقال بالذكاء الاصطناعي
// ==========================================
async function improveAndExtendArticle(title, originalContent, sourceUrl) {
    try {
        if (!originalContent || originalContent.length < 300) {
            console.log("⚠️ Content too short, using fallback");
            return `<p>${originalContent || "Content not available"}</p>`;
        }
        
        console.log("🤖 AI: Improving and extending article...");
        
        // أخذ جزء من المحتوى الأصلي
        const contentSample = originalContent.substring(0, 3500);
        
        const prompt = `IMPORTANT: Do NOT write a new article. IMPROVE and EXTEND this existing article.

ORIGINAL ARTICLE TITLE: ${title}
ORIGINAL ARTICLE CONTENT: ${contentSample}

TASK: Improve and extend this article while keeping the original meaning and information.

REQUIREMENTS:
1. Keep ALL the original key information and facts
2. Add more details, examples, and explanations
3. Expand each paragraph with additional insights
4. Add 2-3 new paragraphs with related information
5. Fix any grammar or spelling issues
6. Improve sentence flow and readability
7. Keep the same structure but make it longer
8. DO NOT change the core message or facts
9. DO NOT remove any important information
10. Add a "Key Takeaways" section at the end

The output should be 2-3 times longer than the original.
Start directly with the improved content:`;

        const completion = await groq.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: "You are an expert editor. Your job is to IMPROVE and EXTEND existing content, not rewrite it completely. Keep all original facts and information, just add more value."
                },
                {
                    role: "user",
                    content: prompt
                }
            ],
            model: "mixtral-8x7b-32768",
            temperature: 0.6,
            max_tokens: 3500
        });
        
        let improvedContent = completion.choices[0]?.message?.content || '';
        
        if (!improvedContent || improvedContent.length < originalContent.length) {
            console.log("⚠️ AI didn't extend enough, using original + enhancements");
            improvedContent = await addEnhancementsToContent(title, originalContent);
        }
        
        console.log(`📝 Original length: ${originalContent.length} chars`);
        console.log(`📝 Improved length: ${improvedContent.length} chars`);
        
        return improvedContent;
        
    } catch (error) {
        console.error("AI Error:", error.message);
        return await addEnhancementsToContent(title, originalContent);
    }
}

// ==========================================
// إضافة تحسينات للمحتوى الأصلي (بدون تغيير جوهري)
// ==========================================
async function addEnhancementsToContent(title, originalContent) {
    // تقسيم المحتوى إلى فقرات
    const paragraphs = originalContent.split(/\n\n|\r\n\r\n/);
    let enhancedHtml = '';
    
    for (let para of paragraphs) {
        if (para.trim().length > 50) {
            enhancedHtml += `<p>${para.trim()}</p>\n\n`;
        }
    }
    
    // إضافة قسم Key Takeaways
    enhancedHtml += `
        <div style="background: #f0f7ff; padding: 25px; border-radius: 12px; margin: 30px 0; border-left: 4px solid #3498db;">
            <h3>📌 Key Takeaways</h3>
            <ul>
                <li>✅ ${title.split(' ').slice(0, 10).join(' ')}... is an important development</li>
                <li>✅ The article covers crucial aspects of this topic</li>
                <li>✅ Stay updated with more news on our platform</li>
            </ul>
        </div>
        
        <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 30px 0;">
            <h3>🔗 Source Reference</h3>
            <p>This article is based on original reporting from trusted news sources. All key facts and information are preserved.</p>
        </div>
    `;
    
    return enhancedHtml;
}

// ==========================================
// الحصول على أشهر المقالات من أخبار جوجل
// ==========================================
async function getTopGoogleNews() {
    const allArticles = [];
    
    for (const sourceUrl of GOOGLE_NEWS_SOURCES) {
        try {
            console.log(`📡 Fetching from Google News: ${sourceUrl.split('?')[1]}`);
            const feed = await parser.parseURL(sourceUrl);
            
            if (feed.items && feed.items.length > 0) {
                // أخذ أول 5 مقالات من كل مصدر
                for (let i = 0; i < Math.min(5, feed.items.length); i++) {
                    const item = feed.items[i];
                    const realUrl = extractRealUrl(item.link);
                    
                    allArticles.push({
                        title: item.title,
                        link: realUrl,
                        originalLink: item.link,
                        source: sourceUrl.includes('topic=TECH') ? 'Tech' :
                                sourceUrl.includes('topic=BUSINESS') ? 'Business' :
                                sourceUrl.includes('topic=SCIENCE') ? 'Science' : 'General',
                        pubDate: item.pubDate
                    });
                }
            }
        } catch (error) {
            console.log(`⚠️ Failed to fetch from ${sourceUrl}`);
        }
    }
    
    // إزالة التكرارات
    const uniqueArticles = [];
    const titles = new Set();
    for (const article of allArticles) {
        if (!titles.has(article.title)) {
            titles.add(article.title);
            uniqueArticles.push(article);
        }
    }
    
    console.log(`✅ Found ${uniqueArticles.length} unique trending articles`);
    return uniqueArticles;
}

// ==========================================
// بناء HTML النهائي للمقال
// ==========================================
function buildFinalHTML(title, content, imageHtml, sourceUrl, category) {
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
        h3 { font-size: 24px; color: #34495e; margin: 30px 0 15px; }
        p { margin-bottom: 25px; font-size: 18px; line-height: 1.8; }
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
        .source-info {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 8px;
            margin: 20px 0;
            font-size: 14px;
            border-left: 4px solid #3498db;
        }
        @media (max-width: 768px) {
            .post-body { padding: 20px; }
            h1 { font-size: 28px; }
            h2 { font-size: 24px; }
            h3 { font-size: 20px; }
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
            ⏱️ ${Math.ceil(content.length / 1500)} min read
        </div>
        
        <div class="source-info">
            📰 <strong>Source Information:</strong> Based on reporting from original news sources.
            All key facts and information are preserved. <a href="${sourceUrl}" target="_blank">View original source</a>
        </div>
        
        ${content}
        
        <div style="margin-top: 50px; padding-top: 20px; border-top: 2px solid #ecf0f1; text-align: center; font-size: 14px; color: #95a5a6;">
            <p>📱 This content has been enhanced for better readability while preserving original information</p>
            <p>🔗 <a href="${sourceUrl}" target="_blank">Click here to read the original article</a></p>
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
                labels: ['Trending News', 'Google News', 'Enhanced Content'],
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
        console.log("🚀 TRENDING NEWS AUTO-BLOGGER v4.0");
        console.log("📰 Google News → Extract → Enhance → Publish");
        console.log("=".repeat(70) + "\n");
        
        // 1. الحصول على أشهر المقالات من أخبار جوجل
        console.log("🎯 Fetching top trending articles from Google News...");
        const trendingArticles = await getTopGoogleNews();
        
        if (trendingArticles.length === 0) {
            throw new Error("No trending articles found");
        }
        
        // 2. اختيار أفضل مقال (الأحدث أو الأكثر شهرة)
        const selectedArticle = trendingArticles[0];
        console.log(`\n✅ Selected trending article:`);
        console.log(`📰 Title: ${selectedArticle.title}`);
        console.log(`🔗 Source URL: ${selectedArticle.link}`);
        console.log(`🏷️ Category: ${selectedArticle.source}`);
        
        // 3. جلب المحتوى الكامل للمقال
        console.log(`\n🌐 Fetching full article content...`);
        const articleHtml = await fetchFullArticle(selectedArticle.link);
        
        if (!articleHtml) {
            throw new Error("Failed to fetch article content");
        }
        
        // 4. استخراج المحتوى
        console.log(`\n🧹 Extracting main content...`);
        const extractedContent = extractFullContent(articleHtml, selectedArticle.link);
        
        if (!extractedContent || extractedContent.length < 500) {
            throw new Error("Content extraction failed");
        }
        
        console.log(`✅ Extracted ${extractedContent.length} characters of content`);
        
        // 5. استخراج الصورة ومعالجتها
        console.log(`\n🖼️ Processing image...`);
        const $ = cheerio.load(articleHtml);
        const imageUrl = extractMainImage($, selectedArticle.link);
        let processedImageHtml = null;
        
        if (imageUrl) {
            console.log(`📸 Found image: ${imageUrl.substring(0, 80)}...`);
            processedImageHtml = await processImageWithLink(imageUrl, selectedArticle.title, selectedArticle.link);
            if (processedImageHtml) {
                console.log(`✅ Image processed with clickable link`);
            }
        } else {
            console.log(`⚠️ No image found`);
        }
        
        // 6. تحسين وإطالة المقال بالذكاء الاصطناعي
        console.log(`\n🤖 AI: Improving and extending article...`);
        const improvedContent = await improveAndExtendArticle(
            selectedArticle.title,
            extractedContent.text,
            selectedArticle.link
        );
        
        // 7. بناء HTML النهائي
        console.log(`\n🏗️ Building final HTML...`);
        const finalHTML = buildFinalHTML(
            selectedArticle.title,
            improvedContent,
            processedImageHtml,
            selectedArticle.link,
            selectedArticle.source
        );
        
        // 8. النشر على بلوجر
        console.log(`\n📤 Publishing to Blogger...`);
        await publishToBlogger(selectedArticle.title, finalHTML);
        
        console.log("\n" + "=".repeat(70));
        console.log("🎉 SUCCESS! Trending article published!");
        console.log("✅ Image is clickable (opens original source)");
        console.log("✅ Content improved and extended by AI");
        console.log("✅ Original information preserved");
        console.log("=".repeat(70) + "\n");
        
    } catch (error) {
        console.error("\n❌ Fatal Error:", error.message);
        if (error.stack) console.error("Stack:", error.stack);
    }
}

// ==========================================
// التشغيل
// ==========================================
console.log("🤖 Google News Auto-Blogger v4.0");
console.log("📰 Fetching trending articles from Google News");
console.log("🖼️ Adding clickable image watermark");
console.log("🤖 AI improving and extending content");
console.log(`📅 ${new Date().toLocaleString()}\n`);

runAutoBlogger();

// للتشغيل التلقائي كل 3 ساعات
// setInterval(runAutoBlogger, 3 * 60 * 60 * 1000);
