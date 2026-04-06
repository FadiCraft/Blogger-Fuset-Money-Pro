const Parser = require('rss-parser');
const axios = require('axios');
const cheerio = require('cheerio');
const { google } = require('googleapis');
const Jimp = require('jimp');
const Groq = require('groq-sdk');

// الإعدادات (ثابتة كما طلبت)
const BLOG_ID = "8249860422330426533";
const CLIENT_ID = "872415365656-7qribadnc7k2u21kl6jjcbatdueevifh.apps.googleusercontent.com";
const CLIENT_SECRET = "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";
const REFRESH_TOKEN = "1//04yti9k2agPknCgYIARAAGAQSNwF-L9IrTZPKt5Fqbg2vrM9sBtOks9cnY4M7Idg0LToQnlbYGME06k20vcyr_SVmYk1H_yZJdEc";
const GROQ_API_KEY = "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";

const groq = new Groq({ apiKey: GROQ_API_KEY });

const RSS_SOURCES = [
    'https://www.makeuseof.com/feed/', 'https://fossbytes.com/feed/', 'https://www.siliconera.com/feed/',
    'https://phys.org/rss-feed/', 'https://gadgetstouse.com/feed/', 'https://www.howtogeek.com/feed/',
    'https://www.techradar.com/rss', 'https://www.cnet.com/rss/news/', 'https://www.digitaltrends.com/feed/',
    'https://thenextweb.com/feed', 'https://www.bleepingcomputer.com/feed/', 'https://www.artificialintelligence-news.com/feed/',
    'https://www.unite.ai/feed/', 'https://futurism.com/feed', 'https://www.eurogamer.net/feed/',
    'https://www.gamespot.com/feeds/content/', 'https://www.pcgamesn.com/mainrss.xml', 'https://kotaku.com/rss',
    'https://www.destructoid.com/feed/', 'https://www.gematsu.com/feed', 'https://www.droidgamers.com/feed/',
    'https://toucharcade.com/feed/', 'https://www.vg247.com/feed', 'https://www.sciencedaily.com/rss/all.xml',
    'https://newatlas.com/index.rss', 'https://www.wired.com/feed/rss', 'https://lifehacker.com/rss',
    'https://www.entrepreneur.com/latest.rss', 'https://addicted2success.com/feed/', 'https://www.psychologytoday.com/intl/front/feed',
    'https://www.healthline.com/rss', 'https://www.treehugger.com/rss', 'https://www.nationalgeographic.com/rss/index.xml',
    'https://betanews.com/feed/', 'https://www.theverge.com/rss/index.xml', 'https://www.slashgear.com/feed/',
    'https://machinelearningmastery.com/feed/', 'https://inside.com/ai/feed', 'https://moneyish.com/feed/',
    'https://www.guidingtech.com/feed/'
];

async function processImage(imageUrl) {
    try {
        const image = await Jimp.read(imageUrl);
        image.brightness(0.06).contrast(0.1);
        const font = await Jimp.loadFont(Jimp.FONT_SANS_16_WHITE);
        image.print(font, 20, image.getHeight() - 40, "EXCLUSIVE CONTENT");
        return await image.getBase64Async(Jimp.MIME_JPEG);
    } catch (e) { return imageUrl; }
}

async function formatWithGroq(title, rawText) {
    try {
        const chatCompletion = await groq.chat.completions.create({
            messages: [
                { role: "system", content: "You are a professional blog editor. Rewrite the content in professional HTML. Use <h2> for subheadings and <p> for paragraphs. Content must be unique and engaging." },
                { role: "user", content: `Title: ${title}\n\nContent: ${rawText.slice(0, 3500)}` }
            ],
            model: "llama3-8b-8192",
        });
        return chatCompletion.choices[0]?.message?.content || rawText;
    } catch (error) { return rawText; }
}

async function runBot() {
    try {
        const parser = new Parser();
        const targetRss = RSS_SOURCES[Math.floor(Math.random() * RSS_SOURCES.length)];
        const feed = await parser.parseURL(targetRss);
        const item = feed.items[0];

        console.log(`📡 Processing: ${item.title}`);

        const response = await axios.get(item.link);
        const $ = cheerio.load(response.data);
        const selectors = ['article', '.entry-content', '.post-content', '.main-content', '#article-body'];
        let rawText = "";
        for (let s of selectors) { if ($(s).length > 0) { rawText = $(s).text(); break; } }

        const formattedBody = await formatWithGroq(item.title, rawText);
        let featuredImg = $('meta[property="og:image"]').attr('content');
        let finalImg = featuredImg ? await processImage(featuredImg) : "";
        let imgHtml = finalImg ? `<img src="${finalImg}" style="width:100%; border-radius:12px; margin-bottom:20px;"/>` : "";

        const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET);
        oauth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });
        const blogger = google.blogger({ version: 'v3', auth: oauth2Client });

        await blogger.posts.insert({
            blogId: BLOG_ID,
            requestBody: {
                title: item.title,
                content: `<div dir="ltr">${imgHtml}${formattedBody}<hr/><p>Source: ${item.link}</p></div>`,
                labels: ['AI-Optimized', 'TechNews', 'DailyUpdate']
            },
            isDraft: false
        });
        console.log("✅ Published Successfully!");
    } catch (error) { console.error("❌ Error:", error.message); }
}

runBot();
