const Parser = require('rss-parser');
const { JSDOM } = require('jsdom');
const { Readability } = require('@mozilla/readability');
const cheerio = require('cheerio');
const { google } = require('googleapis');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// إعدادات جلب البيانات من GitHub Secrets
const BLOG_ID = process.env.BLOG_ID || "2636919176960128451";
const CLIENT_ID = process.env.CLIENT_ID || "872415365656-7qribadnc7k2u21kl6jjcbatdueevifh.apps.googleusercontent.com";
const CLIENT_SECRET = process.env.CLIENT_SECRET || "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";
const REFRESH_TOKEN = process.env.REFRESH_TOKEN || "1//045S0zh6CVaa6CgYIARAAGAQSNwF-L9IrXvcqzbATZc7wlJFATwLq4Rh6IpFlGA2GIsnKEUjUV5h1lA9WCwNEq5tmP89y-wJIHKY";





const parser = new Parser({ timeout: 30000 });
const HISTORY_FILE = path.join(__dirname, 'history.json');

// المصادر - يمكنك إضافة المزيد هنا
const FEEDS = [
    { name: "IGN", category: "Gaming", url: "https://feeds.feedburner.com/ign/all" },
    { name: "9to5Toys", category: "Deals", url: "https://9to5toys.com/feed/" },
    { name: "SammyFans", category: "Tech", url: "https://www.sammyfans.com/feed/" }
];

// وظيفة حفظ الروابط لمنع التكرار
function getHistory() {
    if (fs.existsSync(HISTORY_FILE)) {
        return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8') || "[]");
    }
    return [];
}

function saveHistory(url, history) {
    history.push(url);
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history.slice(-500), null, 2));
}

// الوظيفة الرئيسية
async function start() {
    console.log("🚀 Starting Blogger Bot...");
    const history = getHistory();
    const auth = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET);
    auth.setCredentials({ refresh_token: REFRESH_TOKEN });
    const blogger = google.blogger({ version: 'v3', auth });

    for (const feed of FEEDS) {
        try {
            console.log(`📡 Checking ${feed.name}...`);
            const data = await parser.parseURL(feed.url);
            const item = data.items[0];

            if (!item || history.includes(item.link)) {
                console.log("⏩ No new articles or already published.");
                continue;
            }

            console.log(`📰 Processing: ${item.title}`);
            const res = await axios.get(item.link);
            const dom = new JSDOM(res.data, { url: item.link });
            const article = new Readability(dom.window.document).parse();

            if (article) {
                const htmlContent = `
                    <div style="font-family: Arial; line-height: 1.6;">
                        ${article.content}
                        <hr>
                        <p>Source: <a href="${item.link}">${feed.name}</a></p>
                    </div>`;

                await blogger.posts.insert({
                    blogId: BLOG_ID,
                    requestBody: { title: item.title, content: htmlContent, labels: [feed.category] }
                });

                saveHistory(item.link, history);
                console.log("✅ Published!");
            }
        } catch (err) {
            console.error(`❌ Error with ${feed.name}:`, err.message);
        }
    }
}

start().catch(err => console.error("🔥 Global Error:", err));
