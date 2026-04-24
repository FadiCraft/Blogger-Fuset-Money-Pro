const Parser = require('rss-parser');
const { JSDOM } = require('jsdom');
const { Readability } = require('@mozilla/readability');
const cheerio = require('cheerio');
const { google } = require('googleapis');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// --- الإعدادات ---
const BLOG_ID = process.env.BLOG_ID || "2636919176960128451";
const CLIENT_ID = process.env.CLIENT_ID || "872415365656-7qribadnc7k2u21kl6jjcbatdueevifh.apps.googleusercontent.com";
const CLIENT_SECRET = process.env.CLIENT_SECRET || "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";
const REFRESH_TOKEN = process.env.REFRESH_TOKEN || "1//045S0zh6CVaa6CgYIARAAGAQSNwF-L9IrXvcqzbATZc7wlJFATwLq4Rh6IpFlGA2GIsnKEUjUV5h1lA9WCwNEq5tmP89y-wJIHKY";

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
    } catch (error) {}
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

const BROWSER_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': 'https://www.google.com/'
};

// --- استخراج الصور ---
async function extractImages($, url) {
    const images = [];
    const seenUrls = new Set();
    const exclude = ['logo', 'icon', 'avatar', 'banner', 'pixel', 'svg', '1x1', 'blank', 'spacer'];
    
    $('img').each((i, el) => {
        let src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('srcset');
        if (!src) return;
        
        let cleanUrl = src.split('?')[0].split(' ')[0]; 
        if (cleanUrl.startsWith('//')) cleanUrl = 'https:' + cleanUrl;
        
        if (cleanUrl.startsWith('http')) {
            const isExcluded = exclude.some(p => cleanUrl.toLowerCase().includes(p));
            if (!isExcluded && !seenUrls.has(cleanUrl)) {
                seenUrls.add(cleanUrl);
                images.push({ url: cleanUrl, alt: $(el).attr('alt') || 'Article image' });
            }
        }
    });
    return images;
}

async function fetchArticleContent(url) {
    try {
        console.log(`🔗 Fetching: ${url}`);
        const response = await axios.get(url, { timeout: 30000, headers: BROWSER_HEADERS });
        
        const dom = new JSDOM(response.data, { url });
        const reader = new Readability(dom.window.document);
        const article = reader.parse();
        
        if (!article) return null;

        const $ = cheerio.load(response.data);
        const images = await extractImages($, url);
        
        console.log(`✅ Fetched: ${article.title}`);
        
        return {
            url: url,
            title: article.title,
            excerpt: article.excerpt || article.textContent.substring(0, 160),
            text: article.textContent.replace(/\s+/g, ' ').trim(),
            images: images
        };
    } catch (e) {
        console.error(`❌ Failed: ${e.message}`);
        return null;
    }
}

// --- معالجة المحتوى بدون AI ---
function formatContentWithoutAI(rawArticle, category) {
    // تقسيم النص الطويل إلى فقرات بناءً على النقطة
    const sentences = rawArticle.text.split('. ');
    const intro = sentences.slice(0, 3).join('. ') + '.';
    const body = sentences.slice(3, 15).join('. ') + '.';
    const moreBody = sentences.slice(15, 30).join('. ') + '.';

    return {
        seoTitle: rawArticle.title,
        metaDescription: rawArticle.excerpt.substring(0, 160),
        category: category,
        introduction: intro,
        sections: [
            { heading: "Detailed Overview", content: body },
            { heading: "Key Highlights", content: moreBody }
        ],
        tipBox: { title: "Quick Note", points: ["Source: Original news reported by " + category + " feeds."] },
        conclusion: "For more details, you can follow the full story through the source link.",
        faqs: []
    };
}

// --- قالب HTML ---
function getTemplate(content, images, sourceUrl, sourceName) {
    const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const mainImage = images[0] || { url: 'https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?w=800', alt: content.seoTitle };
    const remainingImages = images.slice(1, 3); // نأخذ صورتين إضافيتين فقط لمنع التشويه
    
    let sectionsHtml = '';
    content.sections.forEach((sec) => {
        sectionsHtml += `<h2>${escapeHtml(sec.heading)}</h2><p>${escapeHtml(sec.content)}</p>`;
        if (remainingImages.length > 0) {
            const img = remainingImages.shift();
            sectionsHtml += `<figure style="text-align:center;"><img src="${img.url}" style="width:100%;border-radius:16px;"></figure>`;
        }
    });

    return `
<div style="font-family: 'Inter', sans-serif; max-width: 800px; margin: auto; color: #333;">
    <p style="color: #2563eb; font-weight: bold;">#${content.category}</p>
    <h1 style="font-size: 2rem;">${escapeHtml(content.seoTitle)}</h1>
    <p style="color: #666;">Published on: ${today} | By DeepLexa Team</p>
    <img src="${mainImage.url}" style="width:100%; border-radius: 20px; margin: 20px 0;">
    <div style="line-height: 1.8; font-size: 1.1rem;">
        <p>${escapeHtml(content.introduction)}</p>
        ${sectionsHtml}
        <div style="background: #f0f7ff; padding: 20px; border-radius: 15px; border-left: 5px solid #2563eb;">
            <strong>${escapeHtml(content.tipBox.title)}</strong>
            <ul>${content.tipBox.points.map(p => `<li>${escapeHtml(p)}</li>`).join('')}</ul>
        </div>
        <p>${escapeHtml(content.conclusion)}</p>
        <hr>
        <p style="font-size: 0.8rem;">Source: <a href="${sourceUrl}">${sourceName}</a></p>
    </div>
</div>`;
}

function escapeHtml(str) { 
    if (!str) return '';
    return String(str).replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
}

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

async function processArticleFromSource(feed, history) {
    console.log(`\n📡 Checking: ${feed.name}`);
    try {
        const parsed = await parser.parseURL(feed.url);
        const latestItem = parsed.items[0];
        if (!latestItem || history.includes(latestItem.link)) {
            console.log(`⏩ No new content`);
            return false;
        }

        const rawArticle = await fetchArticleContent(latestItem.link);
        if (!rawArticle) return false;
        
        const content = formatContentWithoutAI(rawArticle, feed.category);
        const html = getTemplate(content, rawArticle.images, latestItem.link, feed.name);
        
        const published = await publishPost(content, html, feed.category);
        if (published) {
            saveToHistory(latestItem.link);
            console.log(`✅ Published successfully!`);
            return true;
        }
        return false;
    } catch (e) {
        console.error(`❌ Error: ${e.message}`);
        return false;
    }
}

async function startBot() {
    console.log('🚀 Starting DeepLexa No-AI Bot\n');
    const history = loadHistory();
    let publishedCount = 0;
    
    for (let i = 0; i < RELIABLE_RSS_FEEDS.length; i++) {
        if (await processArticleFromSource(RELIABLE_RSS_FEEDS[i], history)) {
            publishedCount++;
        }
        if (i < RELIABLE_RSS_FEEDS.length - 1) await delay(30000); // انتظار 30 ثانية بين المصادر
    }
    console.log(`\n🏁 Done. Total Published: ${publishedCount}`);
}

startBot();
