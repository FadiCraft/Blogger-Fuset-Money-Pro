const Parser = require('rss-parser');
const { JSDOM } = require('jsdom');
const { Readability } = require('@mozilla/readability');
const cheerio = require('cheerio');
const { google } = require('googleapis');
const Groq = require('groq-sdk');
const axios = require('axios');

const BLOG_ID = process.env.BLOG_ID || "2636919176960128451";
const CLIENT_ID = process.env.CLIENT_ID || "872415365656-7qribadnc7k2u21kl6jjcbatdueevifh.apps.googleusercontent.com";
const CLIENT_SECRET = process.env.CLIENT_SECRET || "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";
const REFRESH_TOKEN = process.env.REFRESH_TOKEN || "1//04yti9k2agPknCgYIARAAGAQSNwF-L9IrTZPKt5Fqbg2vrM9sBtOks9cnY4M7Idg0LToQnlbYGME06k20vcyr_SVmYk1H_yZJdEc";
const GROQ_API_KEY = process.env.GROQ_API_KEY || "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";

const groq = new Groq({ apiKey: GROQ_API_KEY });
const parser = new Parser({
    timeout: 20000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*'
    }
});

// إعدادات axios مع User-Agent محسن
const axiosInstance = axios.create({
    timeout: 15000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Cache-Control': 'max-age=0'
    }
});

// مصادر RSS مباشرة (بدون Medium لتجنب 403)
const DIRECT_RSS_SOURCES = [
    // ألعاب الفيديو
    { name: "IGN", url: "https://feeds.feedburner.com/ign/all", category: "Video Games" },
    { name: "GameSpot", url: "https://www.gamespot.com/feeds/news/", category: "Video Games" },
    { name: "Polygon", url: "https://www.polygon.com/rss/index.xml", category: "Video Games" },
    { name: "Kotaku", url: "https://kotaku.com/rss", category: "Video Games" },
    
    // تقنية
    { name: "TechCrunch", url: "https://techcrunch.com/feed/", category: "Technology" },
    { name: "The Verge", url: "https://www.theverge.com/rss/index.xml", category: "Technology" },
    { name: "Wired", url: "https://www.wired.com/feed/rss", category: "Technology" },
    { name: "Ars Technica", url: "https://feeds.arstechnica.com/arstechnica/index", category: "Technology" },
    
    // محتوى تقني
    { name: "TechRadar", url: "https://www.techradar.com/rss", category: "Tech Content" },
    { name: "CNET", url: "https://www.cnet.com/rss/news/", category: "Tech Content" },
    { name: "ZDNet", url: "https://www.zdnet.com/news/rss.xml", category: "Tech Content" },
    
    // المال والأعمال
    { name: "Entrepreneur", url: "https://www.entrepreneur.com/latest.rss", category: "Make Money Online" },
    { name: "Business Insider", url: "https://feeds.feedburner.com/businessinsider", category: "Make Money Online" },
    { name: "Forbes", url: "https://www.forbes.com/entrepreneurs/feed/", category: "Make Money Online" },
    
    // صحة ولياقة
    { name: "Healthline", url: "https://www.healthline.com/rss", category: "Health & Fitness" },
    { name: "WebMD", url: "https://rssfeeds.webmd.com/rss/current/default.aspx", category: "Health & Fitness" }
];

// اختيار 5 مصادر عشوائية من فئات مختلفة
const selectedSources = [];
const categories = [...new Set(DIRECT_RSS_SOURCES.map(s => s.category))];
const shuffledCategories = categories.sort(() => Math.random() - 0.5).slice(0, 5);

for (const cat of shuffledCategories) {
    const sourcesInCat = DIRECT_RSS_SOURCES.filter(s => s.category === cat);
    selectedSources.push(sourcesInCat[Math.floor(Math.random() * sourcesInCat.length)]);
}

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// التحقق من حد Groq اليومي
let dailyTokensUsed = 0;
const DAILY_TOKEN_LIMIT = 100000;
const TOKENS_PER_REQUEST = 5000; // تقدير متوسط

function canUseGroq() {
    return dailyTokensUsed + TOKENS_PER_REQUEST < DAILY_TOKEN_LIMIT;
}

// استخراج الصور
async function extractAllContentImages($, url) {
    const images = [];
    const seenUrls = new Set();
    
    const excludePatterns = [
        'logo', 'icon', 'avatar', 'banner', 'advertisement', 'sponsor',
        'facebook', 'twitter', 'instagram', 'youtube', 'linkedin',
        'data:image', '.svg', '1x1', 'pixel', 'tracking'
    ];
    
    $('img').each((i, img) => {
        const src = $(img).attr('src') || 
                   $(img).attr('data-src') || 
                   $(img).attr('data-original') || 
                   $(img).attr('data-lazy-src');
                   
        const alt = $(img).attr('alt') || '';
        
        if (src && src.startsWith('http')) {
            const isExcluded = excludePatterns.some(pattern => 
                src.toLowerCase().includes(pattern) ||
                alt.toLowerCase().includes(pattern)
            );
            
            if (!isExcluded) {
                let cleanUrl = src.split('?')[0].split('#')[0];
                
                if (cleanUrl.match(/\.(jpg|jpeg|png|webp|gif)(\?.*)?$/i) && !seenUrls.has(cleanUrl)) {
                    seenUrls.add(cleanUrl);
                    images.push({
                        url: cleanUrl,
                        alt: alt.substring(0, 200) || 'Article image'
                    });
                }
            }
        }
    });
    
    // إذا لم نجد صور كافية، نضيف صور Stock
    if (images.length === 0) {
        images.push({
            url: 'https://images.pexels.com/photos/1779487/pexels-photo-1779487.jpeg?auto=compress&cs=tinysrgb&w=800',
            alt: 'Technology concept'
        });
    }
    
    return images.slice(0, 5); // الحد الأقصى 5 صور
}

// استخراج محتوى المقال
async function fetchArticleContent(url) {
    try {
        const response = await axiosInstance.get(url);
        
        const dom = new JSDOM(response.data, { url });
        const reader = new Readability(dom.window.document);
        const article = reader.parse();
        
        if (!article || !article.textContent || article.textContent.length < 500) return null;

        const $ = cheerio.load(article.content);
        const images = await extractAllContentImages($, url);
        
        // تنظيف النص
        const cleanText = article.textContent
            .trim()
            .replace(/\s+/g, ' ')
            .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}]/gu, '')
            .replace(/[^\x00-\x7F]/g, '')
            .slice(0, 8000);
        
        return {
            title: article.title || "Untitled",
            text: cleanText,
            images: images,
            link: url,
            excerpt: article.excerpt || cleanText.substring(0, 300)
        };
    } catch (e) {
        console.log(`   Content fetch error: ${e.message}`);
        return null;
    }
}

// توليد محتوى SEO مع أو بدون Groq
async function generateSEORichContent(article, category) {
    // إذا تجاوزنا الحد اليومي، نستخدم المحتوى مباشرة
    if (!canUseGroq()) {
        console.log(`   ⚠️ Groq daily limit reached, using direct content`);
        return generateBasicSEOContent(article, category);
    }
    
    const prompt = `Create SEO-optimized article. Be concise due to token limits.

Title: "${article.title}"
Category: ${category}
Excerpt: ${article.excerpt}

Requirements:
- Length: 800-1000 words (shorter to save tokens)
- SEO Title: Under 60 chars
- Meta Description: 150-160 chars
- URL Slug: lowercase with hyphens
- Proper H2, H3 structure
- FAQ section with 3 questions

Output JSON:
{
    "seoTitle": "SEO title",
    "metaDescription": "Meta description",
    "urlSlug": "url-slug",
    "htmlContent": "<div>HTML content</div>",
    "wordCount": number
}`;

    try {
        const completion = await groq.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model: "llama-3.3-70b-versatile",
            temperature: 0.6,
            max_tokens: 3000, // تقليل الاستهلاك
            response_format: { type: "json_object" }
        });
        
        dailyTokensUsed += completion.usage.total_tokens;
        console.log(`   Tokens used: ${completion.usage.total_tokens} (Daily: ${dailyTokensUsed}/${DAILY_TOKEN_LIMIT})`);
        
        const result = JSON.parse(completion.choices[0].message.content);
        
        // إزالة الإيموجي
        if (result.htmlContent) {
            result.htmlContent = result.htmlContent.replace(/[\u{1F300}-\u{1F9FF}]/gu, '');
        }
        
        return result;
    } catch (e) {
        console.log(`   Groq error: ${e.message}`);
        return generateBasicSEOContent(article, category);
    }
}

// محتوى SEO أساسي بدون AI (لحالات الطوارئ)
function generateBasicSEOContent(article, category) {
    const title = article.title.replace(/[^\x00-\x7F]/g, '').trim();
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, 50);
    
    const htmlContent = `
        <h2>Introduction</h2>
        <p>${article.excerpt}</p>
        
        <h2>Key Points</h2>
        <p>${article.text.substring(0, 500)}</p>
        
        <h2>Detailed Analysis</h2>
        <p>${article.text.substring(500, 1500)}</p>
        
        <h2>FAQ</h2>
        <h3>What is this about?</h3>
        <p>This article covers important aspects of ${category.toLowerCase()}.</p>
        
        <h3>Why is this important?</h3>
        <p>Understanding these concepts helps you stay informed.</p>
        
        <h3>Where can I learn more?</h3>
        <p>Check the original source for additional information.</p>
    `;
    
    return {
        seoTitle: title.substring(0, 60),
        metaDescription: article.excerpt.substring(0, 160),
        urlSlug: slug,
        htmlContent: htmlContent,
        wordCount: article.text.split(/\s+/).length
    };
}

// قالب HTML متوافق مع AdSense
function getAdSenseFriendlyTemplate(content, metadata, images, category, readTime) {
    const currentDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const mainImage = images[0] || { url: 'https://images.pexels.com/photos/1779487/pexels-photo-1779487.jpeg', alt: category };
    
    const galleryHTML = images.slice(1).map(img => `
        <figure class="content-image">
            <img src="${escapeHtml(img.url)}" alt="${escapeHtml(img.alt)}" loading="lazy">
            <figcaption>${escapeHtml(img.alt)}</figcaption>
        </figure>
    `).join('');
    
    return `
<div class="article-container">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f5f5f5;
            padding: 20px;
            line-height: 1.7;
            color: #333;
        }
        
        .article-container {
            max-width: 900px;
            margin: 0 auto;
        }
        
        .article-main {
            background: white;
            border-radius: 8px;
            padding: 40px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .category-label {
            display: inline-block;
            background: #e0e0e0;
            padding: 4px 12px;
            border-radius: 16px;
            font-size: 0.8rem;
            font-weight: 600;
            margin-bottom: 20px;
        }
        
        h1 {
            font-size: 2.2rem;
            margin-bottom: 16px;
            color: #1a1a1a;
        }
        
        h2 {
            font-size: 1.6rem;
            margin: 32px 0 16px;
            padding-bottom: 8px;
            border-bottom: 2px solid #e0e0e0;
        }
        
        h3 {
            font-size: 1.3rem;
            margin: 24px 0 12px;
        }
        
        p {
            margin-bottom: 1.2rem;
        }
        
        .article-meta {
            display: flex;
            gap: 20px;
            margin: 16px 0 24px;
            padding-bottom: 16px;
            border-bottom: 1px solid #e0e0e0;
            color: #666;
            font-size: 0.85rem;
        }
        
        .featured-image {
            margin: 24px 0;
        }
        
        .featured-image img {
            width: 100%;
            height: auto;
            border-radius: 4px;
        }
        
        .content-image {
            margin: 24px 0;
        }
        
        .content-image img {
            max-width: 100%;
            height: auto;
            border-radius: 4px;
        }
        
        .content-image figcaption {
            margin-top: 8px;
            font-size: 0.85rem;
            color: #666;
        }
        
        ul, ol {
            margin: 1rem 0 1rem 1.5rem;
        }
        
        li {
            margin-bottom: 0.5rem;
        }
        
        @media (max-width: 768px) {
            .article-main {
                padding: 24px 20px;
            }
            
            h1 {
                font-size: 1.8rem;
            }
        }
    </style>
    
    <article class="article-main">
        <span class="category-label">${escapeHtml(category)}</span>
        
        <h1>${escapeHtml(metadata.seoTitle)}</h1>
        
        <div class="article-meta">
            <span>Published: ${currentDate}</span>
            <span>Read time: ${readTime} min</span>
        </div>
        
        <figure class="featured-image">
            <img src="${escapeHtml(mainImage.url)}" alt="${escapeHtml(mainImage.alt)}" loading="eager">
        </figure>
        
        ${galleryHTML}
        
        <div class="article-content">
            ${content.htmlContent}
        </div>
    </article>
</div>`;
}

// الحصول على مقال من RSS
async function getArticleFromRSS(source) {
    try {
        console.log(`   Fetching from ${source.name}...`);
        const feed = await parser.parseURL(source.url);
        
        for (let item of feed.items.slice(0, 5)) {
            if (!item.link) continue;
            
            console.log(`   Trying: ${item.title?.substring(0, 50)}...`);
            const articleData = await fetchArticleContent(item.link);
            
            if (articleData && articleData.text.length > 500) {
                articleData.category = source.category;
                return articleData;
            }
            await delay(2000);
        }
        return null;
    } catch (error) {
        console.log(`   Feed error: ${error.message}`);
        return null;
    }
}

// نشر المقال
async function publishToBlogger(content, metadata, images, category, readTime) {
    try {
        const htmlBody = getAdSenseFriendlyTemplate(content, metadata, images, category, readTime);
        
        const auth = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET);
        auth.setCredentials({ refresh_token: REFRESH_TOKEN });
        const blogger = google.blogger({ version: 'v3', auth });
        
        await blogger.posts.insert({
            blogId: BLOG_ID,
            requestBody: {
                title: metadata.seoTitle,
                content: htmlBody,
                labels: [category]
            }
        });
        
        return true;
    } catch (e) {
        console.log(`   Publish error: ${e.message}`);
        return false;
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// البوت الرئيسي
async function startBot() {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`SEO BOT - 5 ARTICLES FROM RSS SOURCES`);
    console.log(`Date: ${new Date().toLocaleString()}`);
    console.log(`Groq Daily Limit: ${DAILY_TOKEN_LIMIT} tokens`);
    console.log(`${'='.repeat(60)}\n`);
    
    let published = 0;
    
    for (let i = 0; i < selectedSources.length; i++) {
        const source = selectedSources[i];
        
        console.log(`\n${'-'.repeat(60)}`);
        console.log(`ARTICLE ${i + 1}/5: ${source.category} (${source.name})`);
        console.log(`${'-'.repeat(60)}\n`);
        
        const article = await getArticleFromRSS(source);
        
        if (article && article.text.length > 500) {
            console.log(`   Article found: ${article.title.substring(0, 60)}...`);
            console.log(`   Images: ${article.images.length}`);
            
            const seoContent = await generateSEORichContent(article, source.category);
            
            if (seoContent && seoContent.htmlContent) {
                const wordCount = seoContent.wordCount || 
                    seoContent.htmlContent.replace(/<[^>]*>/g, '').split(/\s+/).length;
                const readTime = Math.max(3, Math.ceil(wordCount / 200));
                
                console.log(`   Content: ${wordCount} words`);
                console.log(`   Publishing...`);
                
                const success = await publishToBlogger(
                    seoContent,
                    {
                        seoTitle: seoContent.seoTitle,
                        metaDescription: seoContent.metaDescription,
                        urlSlug: seoContent.urlSlug
                    },
                    article.images,
                    source.category,
                    readTime
                );
                
                if (success) {
                    published++;
                    console.log(`   SUCCESS! Published ${published}/5\n`);
                }
            }
        } else {
            console.log(`   No valid article found\n`);
        }
        
        if (i < selectedSources.length - 1) {
            console.log(`   Waiting 30 seconds before next article...`);
            await delay(30000);
        }
    }
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`COMPLETED: ${published}/5 articles published`);
    console.log(`Total Groq tokens used: ${dailyTokensUsed}/${DAILY_TOKEN_LIMIT}`);
    console.log(`${'='.repeat(60)}\n`);
    
    process.exit(0);
}

startBot();
