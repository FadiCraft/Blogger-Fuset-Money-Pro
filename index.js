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
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml'
    }
});

// مصادر RSS متنوعة مع إضافة مصادر لـ Online Earning
const RELIABLE_SOURCES = [
    { name: "IGN Games", url: "https://feeds.feedburner.com/ign/articles", category: "Video Game Reviews" },
    { name: "GameSpot", url: "https://www.gamespot.com/feeds/news", category: "Video Game Reviews" },
    { name: "Polygon", url: "https://www.polygon.com/rss/index.xml", category: "Video Game Reviews" },
    { name: "Kotaku", url: "https://kotaku.com/rss", category: "Gaming News & Updates" },
    { name: "PC Gamer", url: "https://www.pcgamer.com/rss", category: "Gaming News & Updates" },
    { name: "TechRadar", url: "https://www.techradar.com/rss", category: "Tech Reviews" },
    { name: "CNET", url: "https://www.cnet.com/rss/news", category: "Tech Reviews" },
    { name: "The Verge", url: "https://www.theverge.com/rss/index.xml", category: "Tech Reviews" },
    { name: "Wired", url: "https://www.wired.com/feed/rss", category: "Software & Tools" },
    { name: "Mashable", url: "https://mashable.com/feeds/rss/all", category: "Software & Tools" },
    // مصادر لـ Online Earning
    { name: "Smart Passive Income", url: "https://www.smartpassiveincome.com/feed/", category: "Online Earning" },
    { name: "ProBlogger", url: "https://problogger.com/feed/", category: "Online Earning" },
    { name: "Copyblogger", url: "https://copyblogger.com/feed/", category: "Online Earning" }
];

const TARGET_CATEGORIES = [
    { name: "Video Game Reviews", cpc: "$2.50-$5.00" },
    { name: "Gaming News & Updates", cpc: "$2.00-$4.00" },
    { name: "Tech Reviews", cpc: "$3.00-$6.00" },
    { name: "Software & Tools", cpc: "$2.50-$5.50" },
    { name: "Online Earning", cpc: "$3.50-$7.00" }
];

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// استخراج جميع الصور من المقال بدون نصوص
async function extractAllImages($, url) {
    const images = [];
    const seenUrls = new Set();
    
    const excludePatterns = [
        'logo', 'icon', 'avatar', 'banner', 'ad', 'sponsor', 
        'facebook', 'twitter', 'instagram', 'youtube', 'google',
        'data:image', 'svg', '1x1', 'pixel', 'tracking',
        'advertisement', 'promo', 'badge', 'button'
    ];
    
    $('img').each((i, img) => {
        if (images.length >= 8) return false;
        
        let src = $(img).attr('src') || $(img).attr('data-src') || $(img).attr('data-original');
        
        if (src && src.startsWith('http') && !excludePatterns.some(p => src.toLowerCase().includes(p))) {
            let cleanUrl = src.split('?')[0].split('#')[0];
            
            if (cleanUrl.match(/\.(jpg|jpeg|png|webp|gif)$/i) && !seenUrls.has(cleanUrl) && cleanUrl.length < 500) {
                // التحقق من أن الصورة ليست صغيرة جداً (على الأرجح اعلان)
                const width = $(img).attr('width') || '0';
                const height = $(img).attr('height') || '0';
                if (parseInt(width) > 100 || parseInt(height) > 100 || width === '0') {
                    seenUrls.add(cleanUrl);
                    images.push({
                        url: cleanUrl,
                        width: width || '800',
                        height: height || '450'
                    });
                }
            }
        }
    });
    
    return images;
}

// استخراج الكلمات المفتاحية بشكل مبسط
async function extractDynamicKeywords(title, content, category) {
    // استخدام كلمات مفتاحية أقل تواكلاً لتوفير tokens
    const defaultKeywords = {
        "Video Game Reviews": ["game review", "gameplay", "graphics", "story mode", "multiplayer", "game analysis", "pros and cons", "final verdict", "worth buying", "gaming experience"],
        "Gaming News & Updates": ["gaming news", "patch notes", "game update", "new release", "developer update", "industry news", "esports", "latest games", "upcoming features", "gaming community"],
        "Tech Reviews": ["tech review", "specifications", "performance test", "price comparison", "value for money", "benchmark", "buying guide", "product review", "tech specs", "user experience"],
        "Software & Tools": ["software review", "tool comparison", "key features", "pricing plans", "best alternatives", "productivity tool", "app review", "software guide", "tool review", "ease of use"],
        "Online Earning": ["make money online", "passive income", "side hustle", "work from home", "online business", "freelancing tips", "earn online", "money making", "income guide", "financial freedom"]
    };
    
    return defaultKeywords[category] || defaultKeywords["Tech Reviews"];
}

async function fetchArticleContent(url) {
    try {
        const response = await axios.get(url, {
            timeout: 15000,
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml'
            }
        });

        const dom = new JSDOM(response.data, { url });
        const reader = new Readability(dom.window.document);
        const article = reader.parse();
        
        if (!article || !article.textContent || article.textContent.length < 500) return null;

        const $ = cheerio.load(article.content);
        
        // استخراج جميع الصور
        const allImages = await extractAllImages($, url);
        
        // تنظيف النص وتقصيره لتوفير tokens
        const cleanText = article.textContent
            .trim()
            .replace(/\s+/g, ' ')
            .slice(0, 3000);
        
        return { 
            title: article.title || "Untitled",
            text: cleanText, 
            images: allImages,
            link: url
        };
    } catch (e) { 
        return null; 
    }
}

// توليد محتوى SEO مع تقليل استخدام tokens
async function generateSEORichContent(article, category) {
    const prompt = `Write a blog article about: "${article.title}"

Category: ${category}
Reference: ${article.text.substring(0, 1500)}

Requirements:
- Length: 1200-1500 words
- Use H2 and H3 headings
- Add pros and cons section
- Add FAQ section (3 questions)
- Short paragraphs
- Include main keyword naturally

Output JSON:
{
    "seoTitle": "title 50-60 chars",
    "metaDescription": "description 150-160 chars", 
    "htmlContent": "HTML content here"
}`;

    try {
        const completion = await groq.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model: "llama-3.3-70b-versatile",
            temperature: 0.7,
            max_tokens: 3500
        });
        
        const result = JSON.parse(completion.choices[0].message.content);
        
        if (result.htmlContent && result.htmlContent.length > 800) {
            return result;
        }
        return null;
    } catch (e) { 
        console.log(`   AI error: ${e.message}`);
        return null; 
    }
}

// قالب HTML بسيط وجميل - بدون إيموجيات مشكلة
function getCleanHTMLTemplate(content, metadata, images, category, readTime) {
    const currentDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    
    // الصورة الرئيسية (أول صورة)
    const mainImage = images.length > 0 ? images[0] : { url: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=800&q=80', width: '800', height: '450' };
    
    // باقي الصور للمعرض
    const galleryImages = images.slice(1, 7);
    
    // بناء معرض الصور
    const galleryHTML = galleryImages.length > 0 ? `
        <div class="image-gallery">
            ${galleryImages.map(img => `
                <div class="gallery-item">
                    <img src="${escapeHtml(img.url)}" alt="Article image" loading="lazy">
                </div>
            `).join('')}
        </div>
    ` : '';
    
    return `
<div dir="ltr">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: #f5f5f5;
            padding: 20px;
            line-height: 1.6;
        }
        
        .post-container {
            max-width: 900px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        
        .post-content {
            padding: 40px;
        }
        
        .category {
            display: inline-block;
            background: #1a73e8;
            color: white;
            font-size: 12px;
            font-weight: 600;
            padding: 4px 12px;
            border-radius: 4px;
            margin-bottom: 20px;
            text-transform: uppercase;
        }
        
        h1 {
            font-size: 32px;
            font-weight: 700;
            line-height: 1.3;
            margin-bottom: 16px;
            color: #202124;
        }
        
        .meta {
            color: #5f6368;
            font-size: 13px;
            margin-bottom: 25px;
            padding-bottom: 15px;
            border-bottom: 1px solid #e8eaed;
        }
        
        .meta span {
            margin-right: 20px;
        }
        
        .featured-image {
            margin: 25px 0 30px;
            border-radius: 8px;
            overflow: hidden;
        }
        
        .featured-image img {
            width: 100%;
            height: auto;
            display: block;
        }
        
        .image-gallery {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
            gap: 15px;
            margin: 30px 0;
        }
        
        .gallery-item {
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        }
        
        .gallery-item img {
            width: 100%;
            height: 180px;
            object-fit: cover;
            display: block;
        }
        
        h2 {
            font-size: 24px;
            font-weight: 600;
            margin: 35px 0 15px 0;
            padding-bottom: 8px;
            border-bottom: 2px solid #1a73e8;
            color: #202124;
        }
        
        h3 {
            font-size: 20px;
            font-weight: 600;
            margin: 25px 0 12px 0;
            color: #202124;
        }
        
        p {
            margin-bottom: 16px;
            color: #3c4043;
        }
        
        ul, ol {
            margin: 16px 0 16px 25px;
        }
        
        li {
            margin-bottom: 8px;
        }
        
        .pros-cons {
            display: flex;
            gap: 20px;
            margin: 30px 0;
        }
        
        .pros {
            flex: 1;
            background: #e8f5e9;
            padding: 20px;
            border-radius: 8px;
        }
        
        .cons {
            flex: 1;
            background: #ffebee;
            padding: 20px;
            border-radius: 8px;
        }
        
        .pros h3, .cons h3 {
            margin-top: 0;
            margin-bottom: 15px;
        }
        
        .faq-section {
            background: #f8f9fa;
            border-radius: 8px;
            padding: 25px;
            margin: 35px 0;
        }
        
        .faq-item {
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 1px solid #e8eaed;
        }
        
        .faq-question {
            font-weight: 700;
            margin-bottom: 8px;
            color: #202124;
        }
        
        .faq-answer {
            color: #5f6368;
        }
        
        .author-box {
            background: #f1f3f4;
            border-radius: 8px;
            padding: 20px;
            margin: 40px 0 20px;
            text-align: center;
        }
        
        .author-name {
            font-weight: 700;
            font-size: 18px;
            margin-bottom: 5px;
            color: #202124;
        }
        
        .author-bio {
            color: #5f6368;
            font-size: 14px;
        }
        
        @media (max-width: 650px) {
            .post-content {
                padding: 20px;
            }
            h1 {
                font-size: 26px;
            }
            .pros-cons {
                flex-direction: column;
            }
            .image-gallery {
                grid-template-columns: 1fr;
            }
        }
    </style>
    
    <div class="post-container">
        <div class="post-content">
            <div class="category">${escapeHtml(category)}</div>
            <h1>${escapeHtml(content.seoTitle || metadata.seoTitle)}</h1>
            <div class="meta">
                <span>📅 ${currentDate}</span>
                <span>👤 DeepLexa Team</span>
                <span>⏱️ ${readTime} min read</span>
            </div>
            
            <div class="featured-image">
                <img src="${escapeHtml(mainImage.url)}" alt="${escapeHtml(content.seoTitle || metadata.seoTitle)}" loading="eager">
            </div>
            
            ${galleryHTML}
            
            <div class="article-body">
                ${content.htmlContent}
            </div>
            
            <div class="author-box">
                <div class="author-name">DeepLexa Team</div>
                <div class="author-bio">Professional content creators dedicated to providing high-quality, in-depth reviews and analysis across gaming, tech, and digital trends.</div>
            </div>
        </div>
    </div>
</div>`;
}

async function getArticleFromRSS(source) {
    try {
        const feed = await parser.parseURL(source.url);
        
        for (let item of feed.items.slice(0, 3)) {
            if (!item.link || !item.title) continue;
            
            const articleData = await fetchArticleContent(item.link);
            
            if (articleData && articleData.text.length > 500) {
                articleData.category = source.category;
                articleData.sourceName = source.name;
                return articleData;
            }
            await delay(2000);
        }
        return null;
    } catch (error) {
        console.log(`   ${source.name}: ${error.message}`);
        return null;
    }
}

async function publishToBlogger(content, metadata, images, category, readTime) {
    try {
        const htmlBody = getCleanHTMLTemplate(content, metadata, images, category, readTime);
        
        const auth = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET);
        auth.setCredentials({ refresh_token: REFRESH_TOKEN });
        const blogger = google.blogger({ version: 'v3', auth });
        
        await blogger.posts.insert({
            blogId: BLOG_ID,
            requestBody: {
                title: content.seoTitle,
                content: htmlBody,
                labels: [category, ...(metadata.keywords || []).slice(0, 4)],
                customMetaData: content.metaDescription
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

async function startBot() {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`DeepLexa Bot - Publishing 5 Articles`);
    console.log(`Date: ${new Date().toLocaleString()}`);
    console.log(`${'='.repeat(60)}\n`);
    
    let published = 0;
    const results = {};
    
    for (const category of TARGET_CATEGORIES) {
        if (published >= 5) break;
        
        console.log(`\n[${published + 1}/5] Category: ${category.name} (${category.cpc})`);
        console.log(`-`.repeat(40));
        
        const sourcesForCategory = RELIABLE_SOURCES.filter(s => s.category === category.name);
        let articlePublished = false;
        
        for (const source of sourcesForCategory) {
            if (articlePublished) break;
            
            console.log(`Trying: ${source.name}`);
            const article = await getArticleFromRSS(source);
            
            if (article && article.text.length > 500) {
                console.log(`Found: ${article.title.substring(0, 60)}...`);
                console.log(`Images: ${article.images.length} images extracted`);
                
                const keywords = await extractDynamicKeywords(article.title, article.text, category.name);
                console.log(`Keywords: ${keywords.length} keywords ready`);
                
                console.log(`Generating content...`);
                const seoContent = await generateSEORichContent(article, category.name);
                
                if (seoContent) {
                    const wordCount = seoContent.htmlContent.replace(/<[^>]*>/g, '').split(/\s+/).length;
                    const readTime = Math.max(5, Math.ceil(wordCount / 200));
                    
                    console.log(`Word count: ${wordCount} | Read time: ${readTime} min`);
                    console.log(`Publishing...`);
                    
                    const success = await publishToBlogger(seoContent, { keywords: keywords }, article.images, category.name, readTime);
                    
                    if (success) {
                        published++;
                        results[category.name] = `Published (${wordCount} words)`;
                        articlePublished = true;
                        console.log(`SUCCESS! Article ${published}/5 published.\n`);
                        
                        if (published < 5) {
                            console.log(`Waiting 30 seconds before next article...`);
                            await delay(30000);
                        }
                    } else {
                        results[category.name] = "Publish failed";
                    }
                } else {
                    results[category.name] = "AI generation failed";
                }
            } else {
                console.log(`No valid article from ${source.name}`);
            }
            
            await delay(2000);
        }
        
        if (!articlePublished && !results[category.name]) {
            results[category.name] = "No source available";
        }
    }
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`FINAL RESULTS: ${published}/5 Articles Published`);
    console.log(`${'='.repeat(60)}`);
    for (const [category, status] of Object.entries(results)) {
        const icon = status.includes('Published') ? '✓' : '✗';
        console.log(`${icon} ${category}: ${status}`);
    }
    console.log(`${'='.repeat(60)}\n`);
    
    process.exit(0);
}

startBot();
