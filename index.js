const Parser = require('rss-parser');
const { JSDOM } = require('jsdom');
const { Readability } = require('@mozilla/readability');
const cheerio = require('cheerio');
const { google } = require('googleapis');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// --- الإعدادات ---
const BLOG_ID = process.env.BLOG_ID;
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REFRESH_TOKEN = process.env.REFRESH_TOKEN;

const parser = new Parser({ 
    timeout: 30000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
});

const HISTORY_FILE = path.join(__dirname, 'history.json');

// --- نظام منع التكرار ---
function loadHistory() {
    try {
        if (fs.existsSync(HISTORY_FILE)) {
            const data = fs.readFileSync(HISTORY_FILE, 'utf8');
            return JSON.parse(data || "[]");
        }
    } catch (e) { console.log("⚠️ No history file found, creating new one."); }
    return [];
}

function saveToHistory(url) {
    try {
        const history = loadHistory();
        if (!history.includes(url)) {
            history.push(url);
            fs.writeFileSync(HISTORY_FILE, JSON.stringify(history.slice(-500), null, 2));
        }
    } catch (e) { console.error("❌ Save history error:", e.message); }
}

// --- المصادر RSS ---
const FEEDS = [
    { name: "IGN", category: "Gaming", url: "https://feeds.feedburner.com/ign/all" },
    { name: "SammyFans", category: "Tech", url: "https://www.sammyfans.com/feed/" },
    { name: "9to5Toys", category: "Deals", url: "https://9to5toys.com/feed/" }
];

// --- استخراج الصور ---
async function extractImages($, url) {
    const images = [];
    const seen = new Set();
    $('img').each((i, el) => {
        let src = $(el).attr('src') || $(el).attr('data-src');
        if (src && src.startsWith('http') && !seen.has(src)) {
            if (!src.includes('logo') && !src.includes('icon')) {
                seen.add(src);
                images.push({ url: src, alt: $(el).attr('alt') || 'image' });
            }
        }
    });
    return images;
}

// --- جلب المحتوى ---
async function fetchArticle(url) {
    try {
        console.log(`🔗 Fetching: ${url}`);
        const res = await axios.get(url, { timeout: 20000, headers: { 'User-Agent': 'Mozilla/5.0' } });
        const dom = new JSDOM(res.data, { url });
        const reader = new Readability(dom.window.document);
        const article = reader.parse();
        if (!article) return null;

        const $ = cheerio.load(res.data);
        const images = await extractImages($, url);
        return { ...article, images };
    } catch (e) { return null; }
}

// --- النشر ---
async function publish(title, content, category) {
    try {
        const auth = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET);
        auth.setCredentials({ refresh_token: REFRESH_TOKEN });
        const blogger = google.blogger({ version: 'v3', auth });
        await blogger.posts.insert({
            blogId: BLOG_ID,
            requestBody: { title, content, labels: [category] }
        });
        return true;
    } catch (e) {
        console.log("❌ Blogger Error:", e.message);
        return false;
    }
}

// --- القالب ---
function createHtml(article, sourceName, sourceUrl) {
    const mainImg = article.images[0]?.url || "";
    return `
    <div style="font-family: sans-serif; line-height: 1.6;">
        ${mainImg ? `<img src="${mainImg}" style="width:100%; border-radius:10px;">` : ''}
        <h2 style="color: #2c3e50;">Summary</h2>
        <p>${article.textContent.substring(0, 800)}...</p>
        <hr>
        <p>Source: <a href="${sourceUrl}">${sourceName}</a></p>
    </div>`;
}

// --- التشغيل الرئيسي ---
async function main() {
    console.log("🚀 Bot Started...");
    const history = loadHistory();
    let publishedCount = 0;

    for (const feed of FEEDS) {
        try {
            const parsed = await parser.parseURL(feed.url);
            const item = parsed.items[0];
            if (!item || history.includes(item.link)) continue;

            const article = await fetchArticle(item.link);
            if (!article) continue;

            const html = createHtml(article, feed.name, item.link);
            const success = await publish(article.title, html, feed.category);
            
            if (success) {
                saveToHistory(item.link);
                publishedCount++;
                console.log(`✅ Published: ${article.title}`);
            }
            await new Promise(r => setTimeout(r, 5000)); // انتظار 5 ثواني
        } catch (e) { console.log(`❌ Error in ${feed.name}:`, e.message); }
    }
    console.log(`🏁 Finished. Total: ${publishedCount}`);
}

main();
