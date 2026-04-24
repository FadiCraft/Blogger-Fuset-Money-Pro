const Parser = require('rss-parser');
const { JSDOM } = require('jsdom');
const { Readability } = require('@mozilla/readability');
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

// المتغيرات الأساسية
const BLOG_ID = process.env.BLOG_ID || "2636919176960128451";
const CLIENT_ID = process.env.CLIENT_ID || "872415365656-7qribadnc7k2u21kl6jjcbatdueevifh.apps.googleusercontent.com";
const CLIENT_SECRET = process.env.CLIENT_SECRET || "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";
const REFRESH_TOKEN = process.env.REFRESH_TOKEN || "1//045S0zh6CVaa6CgYIARAAGAQSNwF-L9IrXvcqzbATZc7wlJFATwLq4Rh6IpFlGA2GIsnKEUjUV5h1lA9WCwNEq5tmP89y-wJIHKY";

const parser = new Parser({ timeout: 30000 });
const HISTORY_FILE = path.join(__dirname, 'history.json');

const FEEDS = [
    { name: "IGN", category: "Gaming", url: "https://feeds.feedburner.com/ign/all" },
    { name: "9to5Toys", category: "Deals", url: "https://9to5toys.com/feed/" },
    { name: "SammyFans", category: "Tech", url: "https://www.sammyfans.com/feed/" }
];

function getHistory() {
    if (fs.existsSync(HISTORY_FILE)) {
        try { return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8') || "[]"); } catch(e) { return []; }
    }
    return [];
}

async function start() {
    console.log("🚀 Starting Blogger Bot...");

    if (!BLOG_ID || !REFRESH_TOKEN) {
        console.error("❌ Missing Secrets!");
        return;
    }

    const history = getHistory();
    const auth = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET);
    auth.setCredentials({ refresh_token: REFRESH_TOKEN });
    const blogger = google.blogger({ version: 'v3', auth });

    for (const feed of FEEDS) {
        try {
            console.log(`\n📡 Checking ${feed.name}...`);
            const data = await parser.parseURL(feed.url);
            const item = data.items[0];

            if (!item || history.includes(item.link)) {
                console.log("⏩ Skip: Already published.");
                continue;
            }

            console.log(`📰 Processing: ${item.title}`);
            
            // استخدام fetch المدمج في Node 22 لتجاوز الحماية
            const response = await fetch(item.link, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                    'Sec-Fetch-Dest': 'document',
                    'Sec-Fetch-Mode': 'navigate',
                    'Sec-Fetch-Site': 'none',
                    'Cache-Control': 'max-age=0'
                }
            });

            if (!response.ok) throw new Error(`HTTP Error! Status: ${response.status}`);
            const htmlText = await response.text();

            const dom = new JSDOM(htmlText, { url: item.link });
            const article = new Readability(dom.window.document).parse();

            if (article && article.content) {
                await blogger.posts.insert({
                    blogId: BLOG_ID,
                    requestBody: { 
                        title: item.title, 
                        content: `<div style="font-family: Arial; line-height: 1.6;">${article.content}<hr><p>Source: <a href="${item.link}">${feed.name}</a></p></div>`, 
                        labels: [feed.category] 
                    }
                });

                history.push(item.link);
                fs.writeFileSync(HISTORY_FILE, JSON.stringify(history.slice(-500), null, 2));
                console.log("✅ Published successfully!");
            }
        } catch (err) {
            console.error(`❌ Error with ${feed.name}: ${err.message}`);
        }
        await new Promise(r => setTimeout(r, 5000));
    }
}

start();
