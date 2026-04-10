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
    timeout: 30000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml'
    }
});

// ✅ مصادر RSS مضمونة 100% (تعمل دائماً)
const RELIABLE_RSS_FEEDS = {
    "Video Games": [
        { name: "IGN", url: "https://feeds.feedburner.com/ign/all" },
        { name: "GameSpot", url: "https://www.gamespot.com/feeds/news" },
        { name: "Polygon", url: "https://www.polygon.com/rss/index.xml" },
        { name: "Kotaku", url: "https://kotaku.com/rss" },
        { name: "PC Gamer", url: "https://www.pcgamer.com/rss" }
    ],
    "Technology": [
        { name: "TechCrunch", url: "https://techcrunch.com/feed" },
        { name: "The Verge", url: "https://www.theverge.com/rss/index.xml" },
        { name: "Wired", url: "https://www.wired.com/feed/rss" },
        { name: "Engadget", url: "https://www.engadget.com/rss.xml" },
        { name: "Gizmodo", url: "https://gizmodo.com/rss" }
    ],
    "Tech Content": [
        { name: "TechRadar", url: "https://www.techradar.com/feeds/articletype/news" },
        { name: "Mashable", url: "https://mashable.com/feed" },
        { name: "Digital Trends", url: "https://www.digitaltrends.com/feed" },
        { name: "SlashGear", url: "https://www.slashgear.com/feed" }
    ],
    "Make Money Online": [
        { name: "Entrepreneur", url: "https://www.entrepreneur.com/latest.rss" },
        { name: "Business Insider", url: "https://feeds.feedburner.com/businessinsider" },
        { name: "Lifehacker", url: "https://lifehacker.com/rss" }
    ],
    "Health & Fitness": [
        { name: "Healthline", url: "https://www.healthline.com/rss" },
        { name: "MindBodyGreen", url: "https://www.mindbodygreen.com/feed" },
        { name: "Verywell Fit", url: "https://www.verywellfit.com/feed" }
    ]
};

// اختيار 5 فئات عشوائية
const categories = Object.keys(RELIABLE_RSS_FEEDS);
const selectedCategories = categories.sort(() => Math.random() - 0.5).slice(0, 5);

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

let dailyTokensUsed = 0;
const DAILY_TOKEN_LIMIT = 100000;

function canUseGroq() {
    return dailyTokensUsed + 5000 < DAILY_TOKEN_LIMIT;
}

// استخراج الصور
async function extractImages($, url) {
    const images = [];
    const seenUrls = new Set();
    
    const excludePatterns = [
        'logo', 'icon', 'avatar', 'banner', 'advertisement', 'sponsor',
        'facebook', 'twitter', 'instagram', 'youtube', 'pixel', 'tracking',
        'data:image', '.svg', '1x1'
    ];
    
    $('img').each((i, img) => {
        const src = $(img).attr('src') || $(img).attr('data-src') || $(img).attr('data-original');
        const alt = $(img).attr('alt') || 'Article image';
        
        if (src && src.startsWith('http')) {
            const isExcluded = excludePatterns.some(p => src.toLowerCase().includes(p));
            
            if (!isExcluded) {
                let cleanUrl = src.split('?')[0].split('#')[0];
                
                if (cleanUrl.match(/\.(jpg|jpeg|png|webp|gif)/i) && !seenUrls.has(cleanUrl)) {
                    seenUrls.add(cleanUrl);
                    images.push({ url: cleanUrl, alt: alt.substring(0, 200) });
                }
            }
        }
    });
    
    return images.slice(0, 5);
}

// استخراج محتوى المقال
async function fetchArticleContent(url) {
    try {
        const response = await axios.get(url, {
            timeout: 20000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml'
            }
        });

        const dom = new JSDOM(response.data, { url });
        const reader = new Readability(dom.window.document);
        const article = reader.parse();
        
        if (!article || !article.textContent || article.textContent.length < 500) {
            return null;
        }

        const $ = cheerio.load(article.content);
        const images = await extractImages($, url);
        
        const cleanText = article.textContent
            .trim()
            .replace(/\s+/g, ' ')
            .replace(/[\u{1F600}-\u{1F9FF}]/gu, '')
            .replace(/[^\x00-\x7F]/g, '')
            .slice(0, 6000);
        
        return {
            title: article.title,
            text: cleanText,
            images: images,
            excerpt: article.excerpt || cleanText.substring(0, 300)
        };
    } catch (e) {
        console.log(`   Error: ${e.message}`);
        return null;
    }
}

// توليد SEO (مع وضع الطوارئ)
async function generateSEO(article, category) {
    if (!canUseGroq()) {
        console.log(`   ⚠️ Using basic SEO (rate limit)`);
        return {
            seoTitle: article.title.substring(0, 60),
            metaDescription: article.excerpt.substring(0, 160),
            urlSlug: article.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 50),
            htmlContent: `<h2>Introduction</h2><p>${article.excerpt}</p><h2>Details</h2><p>${article.text.substring(0, 1500)}</p>`,
            wordCount: article.text.split(/\s+/).length
        };
    }
    
    const prompt = `Create SEO article:
Title: "${article.title}"
Category: ${category}

Return JSON:
{
    "seoTitle": "SEO title max 60 chars",
    "metaDescription": "Meta description max 160 chars",
    "urlSlug": "url-slug",
    "htmlContent": "<h2>Section 1</h2><p>Content</p><h2>Section 2</h2><p>Content</p><h2>FAQ</h2><p>Questions and answers</p>",
    "wordCount": 800
}`;

    try {
        const completion = await groq.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model: "llama-3.3-70b-versatile",
            temperature: 0.6,
            max_tokens: 2500,
            response_format: { type: "json_object" }
        });
        
        dailyTokensUsed += completion.usage.total_tokens;
        console.log(`   Tokens: ${completion.usage.total_tokens} (${dailyTokensUsed}/${DAILY_TOKEN_LIMIT})`);
        
        return JSON.parse(completion.choices[0].message.content);
    } catch (e) {
        console.log(`   AI error: ${e.message}`);
        return null;
    }
}

// قالب HTML
function getTemplate(content, metadata, images, category, readTime) {
    const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const mainImage = images[0] || { url: 'https://images.pexels.com/photos/1779487/pexels-photo-1779487.jpeg', alt: category };
    
    const gallery = images.slice(1).map(img => `
        <figure style="margin: 20px 0;">
            <img src="${escapeHtml(img.url)}" alt="${escapeHtml(img.alt)}" style="max-width: 100%; height: auto; border-radius: 8px;" loading="lazy">
            <figcaption style="font-size: 0.85rem; color: #666; margin-top: 8px;">${escapeHtml(img.alt)}</figcaption>
        </figure>
    `).join('');
    
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="${escapeHtml(metadata.metaDescription)}">
    <title>${escapeHtml(metadata.seoTitle)}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.7;
            color: #333;
            background: #f5f5f5;
            margin: 0;
            padding: 20px;
        }
        .container {
            max-width: 900px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            padding: 40px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .category {
            display: inline-block;
            background: #e0e0e0;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 0.8rem;
            font-weight: 600;
            margin-bottom: 20px;
        }
        h1 {
            font-size: 2.2rem;
            margin: 0 0 16px 0;
            color: #1a1a1a;
        }
        h2 {
            font-size: 1.6rem;
            margin: 32px 0 16px;
            padding-bottom: 8px;
            border-bottom: 2px solid #eee;
        }
        h3 {
            font-size: 1.3rem;
            margin: 24px 0 12px;
        }
        p {
            margin: 0 0 1.2rem 0;
        }
        .meta {
            display: flex;
            gap: 20px;
            margin: 16px 0 24px;
            padding-bottom: 16px;
            border-bottom: 1px solid #eee;
            color: #666;
            font-size: 0.9rem;
        }
        .featured-image {
            margin: 24px 0;
        }
        .featured-image img {
            width: 100%;
            height: auto;
            border-radius: 8px;
        }
        ul, ol {
            margin: 1rem 0 1rem 1.5rem;
        }
        li {
            margin-bottom: 0.5rem;
        }
        @media (max-width: 768px) {
            .container { padding: 24px 20px; }
            h1 { font-size: 1.8rem; }
        }
    </style>
</head>
<body>
    <div class="container">
        <span class="category">${escapeHtml(category)}</span>
        <h1>${escapeHtml(metadata.seoTitle)}</h1>
        
        <div class="meta">
            <span>Published: ${date}</span>
            <span>Read time: ${readTime} min</span>
        </div>
        
        <div class="featured-image">
            <img src="${escapeHtml(mainImage.url)}" alt="${escapeHtml(mainImage.alt)}">
        </div>
        
        ${gallery}
        
        <div class="content">
            ${content.htmlContent}
        </div>
    </div>
</body>
</html>`;
}

// جلب مقال من RSS
async function getArticleFromFeed(feedUrl, category) {
    try {
        const feed = await parser.parseURL(feedUrl);
        
        for (const item of feed.items.slice(0, 3)) {
            if (!item.link) continue;
            
            console.log(`   Trying: ${item.title?.substring(0, 50)}...`);
            const article = await fetchArticleContent(item.link);
            
            if (article && article.text.length > 500) {
                return article;
            }
            await delay(2000);
        }
        return null;
    } catch (e) {
        console.log(`   Feed error: ${e.message}`);
        return null;
    }
}

// نشر المقال
async function publishPost(content, metadata, images, category, readTime) {
    try {
        const html = getTemplate(content, metadata, images, category, readTime);
        
        const auth = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET);
        auth.setCredentials({ refresh_token: REFRESH_TOKEN });
        const blogger = google.blogger({ version: 'v3', auth });
        
        await blogger.posts.insert({
            blogId: BLOG_ID,
            requestBody: {
                title: metadata.seoTitle,
                content: html,
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
    return str.replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]));
}

// البوت الرئيسي
async function startBot() {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`SEO BOT - 5 ARTICLES FROM RELIABLE RSS`);
    console.log(`Date: ${new Date().toLocaleString()}`);
    console.log(`${'='.repeat(60)}\n`);
    
    let published = 0;
    
    for (let i = 0; i < selectedCategories.length; i++) {
        const category = selectedCategories[i];
        const feeds = RELIABLE_RSS_FEEDS[category];
        
        console.log(`\n${'-'.repeat(60)}`);
        console.log(`ARTICLE ${i + 1}/5: ${category}`);
        console.log(`${'-'.repeat(60)}\n`);
        
        let article = null;
        
        // تجربة كل المصادر في الفئة
        for (const feed of feeds) {
            console.log(`   Source: ${feed.name}`);
            article = await getArticleFromFeed(feed.url, category);
            
            if (article) {
                console.log(`   ✅ Found: ${article.title.substring(0, 60)}...`);
                console.log(`   Images: ${article.images.length}`);
                break;
            }
            await delay(3000);
        }
        
        if (!article) {
            console.log(`   ❌ No article found for ${category}`);
            continue;
        }
        
        const seo = await generateSEO(article, category);
        
        if (!seo) {
            console.log(`   ❌ SEO generation failed`);
            continue;
        }
        
        const wordCount = seo.wordCount || seo.htmlContent.replace(/<[^>]*>/g, '').split(/\s+/).length;
        const readTime = Math.max(3, Math.ceil(wordCount / 200));
        
        console.log(`   Content: ${wordCount} words`);
        console.log(`   Publishing...`);
        
        const success = await publishPost(seo, seo, article.images, category, readTime);
        
        if (success) {
            published++;
            console.log(`   ✅ Published ${published}/5`);
        }
        
        if (i < selectedCategories.length - 1) {
            console.log(`\n   Waiting 45 seconds...`);
            await delay(45000);
        }
    }
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`✅ COMPLETED: ${published}/5 articles published`);
    console.log(`Tokens used: ${dailyTokensUsed}/${DAILY_TOKEN_LIMIT}`);
    console.log(`${'='.repeat(60)}\n`);
    
    process.exit(0);
}

startBot();
