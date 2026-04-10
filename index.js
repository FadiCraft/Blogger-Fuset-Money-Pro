const Parser = require('rss-parser');
const { JSDOM } = require('jsdom');
const { Readability } = require('@mozilla/readability');
const cheerio = require('cheerio');
const { google } = require('googleapis');
const Groq = require('groq-sdk');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// --- الإعدادات ---
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

// --- نظام منع التكرار ---
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
            console.log(`📝 Saved to history: ${url}`);
        }
    } catch (error) {
        console.error('❌ Error saving to history.json:', error.message);
    }
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// --- المصادر RSS ---
const RELIABLE_RSS_FEEDS = [
    { name: "IGN", category: "Gaming", url: "https://feeds.feedburner.com/ign/all" },
    { name: "SammyFans", category: "Tech", url: "https://www.sammyfans.com/feed/" },
    { name: "Forbes Innovation", category: "Tech", url: "https://www.forbes.com/innovation/feed/" },
    { name: "9to5Toys", category: "Deals", url: "https://9to5toys.com/feed/" }
];

// --- Headers محسنة لتجاوز الحماية ---
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

// --- استخراج الصور ---
async function extractImages($, url) {
    const images = [];
    const seenUrls = new Set();
    const exclude = ['logo', 'icon', 'avatar', 'banner', 'pixel', 'svg', '1x1', 'blank', 'spacer'];
    
    $('img, picture source').each((i, el) => {
        let src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-lazy-src') || $(el).attr('srcset');
        if (!src) return;
        
        if (src.includes(',')) {
            const parts = src.split(',');
            let maxRes = { url: '', size: 0 };
            parts.forEach(part => {
                const [urlPart, sizePart] = part.trim().split(' ');
                const size = parseInt(sizePart) || 0;
                if (size > maxRes.size) maxRes = { url: urlPart, size };
            });
            src = maxRes.url || parts[0].trim().split(' ')[0];
        }
        
        let cleanUrl = src.split('?')[0]; 
        if (cleanUrl.startsWith('http') || cleanUrl.startsWith('//')) {
            if (cleanUrl.startsWith('//')) cleanUrl = 'https:' + cleanUrl;
            
            const isExcluded = exclude.some(p => cleanUrl.toLowerCase().includes(p));
            const isImage = cleanUrl.match(/\.(jpg|jpeg|png|webp|gif)/i);
            
            if (!isExcluded && isImage && !seenUrls.has(cleanUrl)) {
                seenUrls.add(cleanUrl);
                const alt = $(el).attr('alt') || $(el).attr('title') || 'Article image';
                images.push({ url: cleanUrl, alt });
            }
        }
    });
    return images;
}

async function fetchArticleContent(url) {
    try {
        console.log(`🔗 Fetching: ${url}`);
        
        const response = await axios.get(url, { 
            timeout: 30000,
            headers: BROWSER_HEADERS,
            maxRedirects: 5,
            validateStatus: status => status < 500
        });
        
        if (response.status !== 200) {
            console.log(`⚠️ Status ${response.status} for ${url}`);
            return null;
        }
        
        const dom = new JSDOM(response.data, { url });
        const reader = new Readability(dom.window.document);
        const article = reader.parse();
        
        if (!article || article.textContent.length < 500) {
            console.log(`⚠️ Content too short or unreadable`);
            return null;
        }

        const $ = cheerio.load(response.data);
        const images = await extractImages($, url);
        
        console.log(`✅ Fetched: ${article.title} (${images.length} images)`);
        
        return {
            url: url,
            title: article.title,
            text: article.textContent.replace(/\s+/g, ' ').slice(0, 12000), 
            images: images
        };
    } catch (e) {
        console.error(`❌ Failed: ${e.message}`);
        return null;
    }
}

// --- الذكاء الاصطناعي ---
async function generateHighQualityArticle(article, category, sourceName) {
    const prompt = `You are a senior tech journalist. Rewrite this into an engaging 800-1000 word blog post.

Source: ${sourceName} | Category: ${category}
Title: ${article.title}
Content: ${article.text.substring(0, 8000)}

Return JSON:
{
    "seoTitle": "SEO title (max 60 chars)",
    "metaDescription": "Meta description (140-160 chars)",
    "category": "${category}",
    "introduction": "2-3 engaging paragraphs.",
    "sections": [
        {"heading": "H2 Heading", "content": "Detailed content with <h3> subheadings if needed."},
        {"heading": "Second H2", "content": "Detailed content."},
        {"heading": "Third H2", "content": "Detailed content."}
    ],
    "tipBox": {"title": "💡 Pro Tip", "points": ["Point 1", "Point 2"]},
    "conclusion": "Strong conclusion.",
    "faqs": [{"q": "Q?", "a": "A."}, {"q": "Q?", "a": "A."}]
}`;

    try {
        const completion = await groq.chat.completions.create({
            messages: [
                { role: "system", content: "You are an expert tech journalist. Write professional, engaging articles." },
                { role: "user", content: prompt }
            ],
            model: "llama-3.3-70b-versatile",
            temperature: 0.7,
            response_format: { type: "json_object" }
        });
        
        const jsonString = completion.choices[0].message.content;
        const cleanJson = jsonString.substring(jsonString.indexOf('{'), jsonString.lastIndexOf('}') + 1);
        return JSON.parse(cleanJson);
    } catch (e) {
        console.log("❌ AI Error:", e.message);
        return null;
    }
}

// --- قالب HTML ---
function getTemplate(content, images, sourceUrl, sourceName) {
    const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const readTime = Math.ceil((content.introduction.length + content.sections.reduce((acc, s) => acc + s.content.length, 0)) / 1500) + 2;
    const mainImage = images[0] || { url: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&q=80', alt: content.seoTitle };
    const remainingImages = images.slice(1);
    
    let sectionsHtml = '';
    content.sections.forEach((sec, index) => {
        sectionsHtml += `<h2>${escapeHtml(sec.heading)}</h2>`;
        sectionsHtml += `<div>${sec.content.split('\n').map(p => p.trim() ? `<p>${escapeHtml(p)}</p>` : '').join('')}</div>`;
        
        if (remainingImages.length > 0) {
            const img = remainingImages.shift();
            sectionsHtml += `
            <figure style="margin: 30px 0; text-align: center;">
                <img src="${img.url}" alt="${escapeHtml(img.alt)}" loading="lazy" style="width:100%; max-width:800px; height:auto; aspect-ratio:16/9; object-fit:cover; border-radius:16px; box-shadow:0 8px 20px rgba(0,0,0,0.08);">
            </figure>`;
        }
    });

    const schemaData = {
        "@context": "https://schema.org",
        "@type": "TechArticle",
        "headline": content.seoTitle,
        "image": mainImage.url,
        "datePublished": new Date().toISOString(),
        "author": { "@type": "Organization", "name": "DeepLexa" },
        "publisher": { "@type": "Organization", "name": "DeepLexa" },
        "description": content.metaDescription
    };

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="${escapeHtml(content.metaDescription)}">
    <meta property="og:title" content="${escapeHtml(content.seoTitle)}">
    <meta property="og:description" content="${escapeHtml(content.metaDescription)}">
    <meta property="og:image" content="${mainImage.url}">
    <title>${escapeHtml(content.seoTitle)}</title>
    <script type="application/ld+json">${JSON.stringify(schemaData)}</script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Inter', sans-serif; background: #f5f7fa; padding: 20px; line-height: 1.7; }
        .article-card { max-width: 880px; margin: 0 auto; background: white; border-radius: 28px; overflow: hidden; box-shadow: 0 20px 35px -12px rgba(0,0,0,0.1); }
        .article-inner { padding: 35px 45px; }
        .category { display: inline-block; background: #eef2ff; color: #2563eb; font-size: 0.8rem; font-weight: 600; padding: 4px 12px; border-radius: 30px; margin-bottom: 20px; }
        h1 { font-size: 2.2rem; font-weight: 800; line-height: 1.3; margin-bottom: 16px; color: #0a0f2c; }
        .meta { display: flex; gap: 20px; font-size: 0.85rem; color: #64748b; margin: 15px 0 25px; padding-bottom: 15px; border-bottom: 2px solid #eef2f8; flex-wrap: wrap; }
        .meta i { margin-right: 5px; color: #3b82f6; }
        .featured-img { position: relative; margin: 20px 0 30px; border-radius: 20px; overflow: hidden; }
        .featured-img img { width: 100%; display: block; aspect-ratio: 16/9; object-fit: cover; }
        .watermark { position: absolute; bottom: 12px; right: 12px; background: rgba(0,0,0,0.5); color: white; padding: 4px 10px; border-radius: 8px; font-size: 11px; backdrop-filter: blur(4px); }
        .article-content h2 { font-size: 1.7rem; font-weight: 700; margin: 35px 0 15px; padding-left: 12px; border-left: 4px solid #3b82f6; }
        .article-content h3 { font-size: 1.3rem; font-weight: 600; margin: 25px 0 10px; color: #1e293b; }
        .article-content p { margin-bottom: 1.2rem; line-height: 1.8; color: #334155; }
        .tip-box { background: #f0f9ff; border-left: 4px solid #0ea5e9; padding: 18px 22px; border-radius: 16px; margin: 25px 0; }
        .tip-box strong { color: #0284c7; display: flex; align-items: center; gap: 8px; margin-bottom: 12px; font-size: 1.1rem; }
        .faq-section { background: #f8fafc; border-radius: 20px; padding: 25px; margin: 35px 0 20px; }
        .faq-item { margin-bottom: 18px; padding-bottom: 12px; border-bottom: 1px solid #e2e8f0; }
        .faq-item:last-child { border-bottom: none; }
        .faq-item strong { display: block; margin-bottom: 6px; color: #1e293b; }
        .author-box { background: #f1f5f9; border-radius: 20px; padding: 20px; margin: 40px 0 15px; display: flex; gap: 18px; align-items: center; }
        .author-avatar { width: 55px; height: 55px; background: linear-gradient(135deg, #2563eb, #0ea5e9); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; color: white; }
        .source-link { margin-top: 15px; font-size: 0.85rem; color: #64748b; text-align: right; }
        @media (max-width: 650px) { .article-inner { padding: 20px; } h1 { font-size: 1.6rem; } }
    </style>
</head>
<body>
    <div class="article-card">
        <div class="article-inner">
            <div class="category"><i class="fas fa-bolt"></i> ${escapeHtml(content.category)}</div>
            <h1>${escapeHtml(content.seoTitle)}</h1>
            <div class="meta">
                <span><i class="far fa-calendar-alt"></i> ${today}</span>
                <span><i class="far fa-user"></i> DeepLexa Team</span>
                <span><i class="far fa-clock"></i> ${readTime} min read</span>
            </div>
            <div class="featured-img">
                <img src="${mainImage.url}" alt="${escapeHtml(mainImage.alt)}">
                <div class="watermark"><i class="far fa-copyright"></i> DeepLexa 2026</div>
            </div>
            <div class="article-content">
                ${content.introduction.split('\n').map(p => p.trim() ? `<p>${escapeHtml(p)}</p>` : '').join('')}
                ${content.tipBox ? `<div class="tip-box"><strong><i class="fas fa-lightbulb"></i> ${escapeHtml(content.tipBox.title)}</strong><ul>${content.tipBox.points.map(p => `<li>${escapeHtml(p)}</li>`).join('')}</ul></div>` : ''}
                ${sectionsHtml}
                ${content.conclusion ? `<h2>Conclusion</h2><p>${escapeHtml(content.conclusion)}</p>` : ''}
                <div class="faq-section">
                    <h2><i class="fas fa-question-circle" style="margin-right:8px;color:#3b82f6;"></i> FAQ</h2>
                    ${content.faqs.map(faq => `<div class="faq-item"><strong>Q: ${escapeHtml(faq.q)}</strong><p>A: ${escapeHtml(faq.a)}</p></div>`).join('')}
                </div>
            </div>
            <div class="author-box">
                <div class="author-avatar"><i class="fas fa-chalkboard-user"></i></div>
                <div><h4 style="margin-bottom:4px;">DeepLexa Team</h4><p style="font-size:0.85rem;color:#475569;">Tech news, reviews, and analytics</p></div>
            </div>
            <div class="source-link"><i class="fas fa-link"></i> Source: <a href="${sourceUrl}" target="_blank">${escapeHtml(sourceName)}</a></div>
        </div>
    </div>
</body>
</html>`;
}

function escapeHtml(str) { 
    if (!str) return '';
    return String(str).replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
}

// --- النشر ---
async function publishPost(content, html, category) {
    try {
        const auth = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET);
        auth.setCredentials({ refresh_token: REFRESH_TOKEN });
        const blogger = google.blogger({ version: 'v3', auth });
        await blogger.posts.insert({ blogId: BLOG_ID, requestBody: { title: content.seoTitle, content: html, labels: [category] } });
        return true;
    } catch (e) {
        console.log(`❌ Blogger Error: ${e.message}`);
        return false;
    }
}

// --- معالجة مقال ---
async function processArticleFromSource(feed, history) {
    console.log(`\n📡 ${feed.name}`);
    try {
        const parsed = await parser.parseURL(feed.url);
        const latestItem = parsed.items[0];
        if (!latestItem) return false;
        if (history.includes(latestItem.link)) {
            console.log(`⏩ Already published`);
            return false;
        }
        console.log(`🆕 ${latestItem.title}`);
        
        const rawArticle = await fetchArticleContent(latestItem.link);
        if (!rawArticle || rawArticle.images.length === 0) return false;
        
        const content = await generateHighQualityArticle(rawArticle, feed.category, feed.name);
        if (!content) return false;
        
        const html = getTemplate(content, rawArticle.images, latestItem.link, feed.name);
        const published = await publishPost(content, html, feed.category);
        if (published) {
            saveToHistory(latestItem.link);
            console.log(`✅ Published!`);
            return true;
        }
        return false;
    } catch (e) {
        console.error(`❌ ${e.message}`);
        return false;
    }
}

// --- البوت الرئيسي ---
async function startBot() {
    console.log('🚀 DeepLexa Bot\n');
    const history = loadHistory();
    let published = 0;
    
    for (let i = 0; i < RELIABLE_RSS_FEEDS.length; i++) {
        console.log(`\n${'='.repeat(40)}\n📰 ${i+1}/4: ${RELIABLE_RSS_FEEDS[i].name}\n${'='.repeat(40)}`);
        if (await processArticleFromSource(RELIABLE_RSS_FEEDS[i], history)) published++;
        if (i < RELIABLE_RSS_FEEDS.length - 1) {
            console.log(`\n⏳ 60s wait...`);
            await delay(60000);
        }
    }
    console.log(`\n🏁 Done. Published: ${published}`);
}

startBot();
