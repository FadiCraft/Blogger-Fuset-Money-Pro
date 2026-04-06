const Parser = require('rss-parser');
const axios = require('axios');
const cheerio = require('cheerio');
const { google } = require('googleapis');
const Jimp = require('jimp');
const Groq = require('groq-sdk');

// الإعدادات
const BLOG_ID = "8249860422330426533";
const CLIENT_ID = "872415365656-7qribadnc7k2u21kl6jjcbatdueevifh.apps.googleusercontent.com";
const CLIENT_SECRET = "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";
const REFRESH_TOKEN = "1//04yti9k2agPknCgYIARAAGAQSNwF-L9IrTZPKt5Fqbg2vrM9sBtOks9cnY4M7Idg0LToQnlbYGME06k20vcyr_SVmYk1H_yZJdEc";
const GROQ_API_KEY = "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";

const groq = new Groq({ apiKey: GROQ_API_KEY });

const RSS_SOURCES = [
    'https://www.makeuseof.com/feed/', 'https://fossbytes.com/feed/', 'https://www.howtogeek.com/feed/',
    'https://www.techradar.com/rss', 'https://www.gadgetstouse.com/feed/', 'https://www.theverge.com/rss/index.xml'
];

/**
 * دالة ذكية لتنظيف النص من الأكواد قبل إرساله لـ Groq
 */
function cleanRawText(html) {
    const $ = cheerio.load(html);
    // حذف الأكواد البرمجية والبيانات الوصفية التي تظهر في المقال
    $('script, style, .author-bio, .breadcrumb, .social-share, .related-posts, noscript').remove();
    
    // الحصول على النص فقط وتنظيف الفراغات الزائدة
    let text = $('body').text();
    text = text.replace(/\{[\s\S]*?\}/g, ''); // حذف أي كود JSON متبقي بين أقواس
    return text.trim().slice(0, 4000);
}

async function formatWithGroq(title, cleanText) {
    try {
        console.log("🤖 AI is rewriting and formatting...");
        const chatCompletion = await groq.chat.completions.create({
            messages: [
                { 
                    role: "system", 
                    content: "You are a professional tech editor. Tasks: 1. Rewrite the article to be 100% unique. 2. Remove any author info, dates, or JSON code. 3. Format using ONLY <h2> for titles and <p> for paragraphs. 4. Do not include any intro like 'Here is the article'. Start directly with the content. Language: English." 
                },
                { role: "user", content: `Article Title: ${title}\n\nRaw Content: ${cleanText}` }
            ],
            model: "llama3-8b-8192",
            temperature: 0.7,
        });

        return chatCompletion.choices[0]?.message?.content || "Content formatting failed.";
    } catch (error) {
        console.error("Groq Error:", error.message);
        return cleanText;
    }
}

async function processImage(imageUrl) {
    try {
        const image = await Jimp.read(imageUrl);
        image.brightness(0.05).contrast(0.1);
        const font = await Jimp.loadFont(Jimp.FONT_SANS_16_WHITE);
        image.print(font, 10, image.getHeight() - 30, "Trending Tech News");
        return await image.getBase64Async(Jimp.MIME_JPEG);
    } catch (e) { return imageUrl; }
}

async function runBot() {
    try {
        const parser = new Parser();
        const targetRss = RSS_SOURCES[Math.floor(Math.random() * RSS_SOURCES.length)];
        const feed = await parser.parseURL(targetRss);
        const item = feed.items[0];

        console.log(`📡 Fetching: ${item.title}`);

        const response = await axios.get(item.link);
        const $ = cheerio.load(response.data);
        
        // محاولة إيجاد حاوية المقال الرئيسية فقط
        const articleHtml = $('article').html() || $('.entry-content').html() || $('.main-content').html() || $('body').html();
        
        // تنظيف النص الخام قبل إرساله لـ AI
        const textToProcess = cleanRawText(articleHtml);
        
        // التنسيق عبر Groq
        const finalBody = await formatWithGroq(item.title, textToProcess);

        // الصورة
        let featuredImg = $('meta[property="og:image"]').attr('content');
        let processedImg = featuredImg ? await processImage(featuredImg) : "";
        let imgHtml = processedImg ? `<center><img src="${processedImg}" style="width:100%; border-radius:15px; margin-bottom:20px;"/></center>` : "";

        const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET);
        oauth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });
        const blogger = google.blogger({ version: 'v3', auth: oauth2Client });

        await blogger.posts.insert({
            blogId: BLOG_ID,
            requestBody: {
                title: item.title,
                content: `<div dir="ltr" style="font-family: 'Roboto', sans-serif; font-size: 18px; line-height: 1.6;">${imgHtml}${finalBody}</div>`,
                labels: ['Tech', 'Automated', 'Llama3']
            },
            isDraft: false
        });

        console.log("✅ المقال نُشر بنجاح بتنسيق نظيف!");
    } catch (error) {
        console.error("❌ Fatal Error:", error.message);
    }
}

runBot();
