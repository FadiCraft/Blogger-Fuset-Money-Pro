const Parser = require('rss-parser');
const axios = require('axios');
const cheerio = require('cheerio');
const { google } = require('googleapis');
const Jimp = require('jimp');
const Groq = require('groq-sdk');

// الإعدادات الخاصة بك
const BLOG_ID = "8249860422330426533";
const CLIENT_ID = "872415365656-7qribadnc7k2u21kl6jjcbatdueevifh.apps.googleusercontent.com";
const CLIENT_SECRET = "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";
const REFRESH_TOKEN = "1//04yti9k2agPknCgYIARAAGAQSNwF-L9IrTZPKt5Fqbg2vrM9sBtOks9cnY4M7Idg0LToQnlbYGME06k20vcyr_SVmYk1H_yZJdEc";
const GROQ_API_KEY = "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";

const groq = new Groq({ apiKey: GROQ_API_KEY });

const RSS_SOURCES = [
    'https://www.makeuseof.com/feed/',
    'https://fossbytes.com/feed/',
    'https://www.siliconera.com/feed/',
    'https://phys.org/rss-feed/',
    'https://gadgetstouse.com/feed/',
    'https://www.howtogeek.com/feed/',
    'https://www.theverge.com/rss/index.xml'
];

/**
 * دالة استخدام Groq لتنسيق وإعادة صياغة المقال
 */
async function formatWithGroq(title, rawText) {
    try {
        console.log("🤖 جاري تنسيق المقال عبر Groq AI...");
        const chatCompletion = await groq.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: "You are a professional blog editor. Rewrite the following article content in a clean, engaging, and well-structured HTML format. Use <h2> for subheadings, <p> for paragraphs, and <ul> for lists. Keep the tone professional and informative. Language: English."
                },
                {
                    role: "user",
                    content: `Title: ${title}\n\nContent: ${rawText.slice(0, 4000)}` // نرسل أول 4000 حرف لضمان عدم تجاوز الحد
                }
            ],
            model: "llama3-8b-8192", // نموذج سريع وقوي جداً
        });

        return chatCompletion.choices[0]?.message?.content || rawText;
    } catch (error) {
        console.error("❌ فشل Groq في التنسيق:", error.message);
        return rawText; // العودة للنص الأصلي في حال الفشل
    }
}

/**
 * دالة معالجة الصور
 */
async function processImage(imageUrl) {
    try {
        const image = await Jimp.read(imageUrl);
        image.brightness(0.05).contrast(0.1);
        const font = await Jimp.loadFont(Jimp.FONT_SANS_16_WHITE);
        image.print(font, 20, image.getHeight() - 40, "EXCLUSIVE CONTENT");
        return await image.getBase64Async(Jimp.MIME_JPEG);
    } catch (e) {
        return imageUrl;
    }
}

/**
 * المحرك الرئيسي
 */
async function runBloggerBot() {
    try {
        const parser = new Parser();
        const targetRss = RSS_SOURCES[Math.floor(Math.random() * RSS_SOURCES.length)];
        const feed = await parser.parseURL(targetRss);
        const item = feed.items[0];

        console.log(`📝 معالجة: ${item.title}`);

        // 1. سحب المحتوى الخام
        const response = await axios.get(item.link);
        const $ = cheerio.load(response.data);
        const selectors = ['article', '.entry-content', '.post-content', '.main-content'];
        let rawText = "";
        for (let s of selectors) {
            if ($(s).length > 0) { rawText = $(s).text(); break; }
        }

        // 2. إرسال النص لـ Groq للتنسيق
        const formattedBody = await formatWithGroq(item.title, rawText);

        // 3. معالجة الصورة
        let featuredImg = $('meta[property="og:image"]').attr('content');
        let finalImg = featuredImg ? await processImage(featuredImg) : "";
        let imgHtml = finalImg ? `<img src="${finalImg}" style="width:100%; border-radius:12px; margin-bottom:20px;"/>` : "";

        // 4. النشر على بلوجر
        const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET);
        oauth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });
        const blogger = google.blogger({ version: 'v3', auth: oauth2Client });

        const finalContent = `
            <div dir="ltr" style="font-family: 'Segoe UI', Tahoma, sans-serif; line-height: 1.8;">
                ${imgHtml}
                ${formattedBody}
                <hr/>
                <p style="color: gray;">Originally published at: <a href="${item.link}">${item.title}</a></p>
            </div>
        `;

        await blogger.posts.insert({
            blogId: BLOG_ID,
            requestBody: {
                title: item.title,
                content: finalContent,
                labels: ['AI Generated', 'Tech Update', 'In-Depth']
            },
            isDraft: false
        });

        console.log("✅ تم النشر بنجاح! المقال الآن منسق بذكاء اصطناعي.");

    } catch (error) {
        console.error("❌ خطأ فادح:", error.message);
    }
}

runBloggerBot();
