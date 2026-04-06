const Parser = require('rss-parser');
const axios = require('axios');
const cheerio = require('cheerio');
const { google } = require('googleapis');
const Jimp = require('jimp');
const Groq = require('groq-sdk');

// ==========================================
// الإعدادات الخاصة بك (يرجى مراجعتها بدقة)
// ==========================================
const BLOG_ID = "8249860422330426533";
const CLIENT_ID = "872415365656-7qribadnc7k2u21kl6jjcbatdueevifh.apps.googleusercontent.com";
const CLIENT_SECRET = "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";
const REFRESH_TOKEN = "1//04yti9k2agPknCgYIARAAGAQSNwF-L9IrTZPKt5Fqbg2vrM9sBtOks9cnY4M7Idg0LToQnlbYGME06k20vcyr_SVmYk1H_yZJdEc";
const GROQ_API_KEY = "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";

// نص العلامة المائية (اسم موقعك مثلاً)
const WATERMARK_TEXT = "© TRENDING TECH UPDATE";

const groq = new Groq({ apiKey: GROQ_API_KEY });
const parser = new Parser();

// قائمة المصادر الموثوقة
const RSS_SOURCES = [
    'https://www.makeuseof.com/feed/', 'https://fossbytes.com/feed/', 'https://www.howtogeek.com/feed/',
    'https://www.techradar.com/rss', 'https://www.gadgetstouse.com/feed/', 'https://www.theverge.com/rss/index.xml'
];

// ==========================================
// الدوال الفرعية
// ==========================================

/**
 * دالة متقدمة لوضع علامة مائية احترافية على الصورة
 */
async function processAndWatermarkImage(imageUrl) {
    try {
        console.log("🎨 Processing image and adding watermark...");
        const image = await Jimp.read(imageUrl);
        
        // 1. فلاتر خفيفة لتمييز الصورة (اختياري)
        image.brightness(0.03).contrast(0.05);

        // 2. تحميل الخط
        const font = await Jimp.loadFont(Jimp.FONT_SANS_16_WHITE);
        
        const imageWidth = image.getWidth();
        const imageHeight = image.getHeight();
        const textWidth = Jimp.measureText(font, WATERMARK_TEXT);
        const textHeight = Jimp.measureTextHeight(font, WATERMARK_TEXT);

        // 3. رسم مستطيل خلفية نصف شفاف للعلامة المائية (Overlay) لضمان الوضوح
        const overlayHeight = textHeight + 20;
        const overlay = new Jimp(imageWidth, overlayHeight, 0x00000080); // لون أسود شفافية 50%
        
        // دمج الخلفية مع الصورة الأصلية في الأسفل
        image.composite(overlay, 0, imageHeight - overlayHeight);

        // 4. كتابة النص فوق الخلفية الشفافة (متمركز أفقياً)
        image.print(
            font,
            (imageWidth / 2) - (textWidth / 2),
            imageHeight - (overlayHeight / 2) - (textHeight / 2),
            WATERMARK_TEXT
        );

        // 5. تحويل الصورة إلى Base64
        return await image.getBase64Async(Jimp.MIME_JPEG);
    } catch (e) {
        console.error(`⚠️ Image processing failed: ${e.message}. Using original.`);
        return imageUrl; // العودة للصورة الأصلية في حال الفشل
    }
}

/**
 * دالة للتنظيف العميق للنص قبل إرساله للذكاء الاصطناعي
 */
function deepCleanHtml(html) {
    const $ = cheerio.load(html);
    
    // حذف الأكواد البرمجية، الأنماط، الإعلانات، بيانات الكاتب، وكل ما هو ليس نصاً أساسياً
    $('script, style, iframe, noscript, .author-bio, .breadcrumb, .social-share, .related-posts, #comments, .ad-unit, .newsletter-signup').remove();
    
    // حذف التعليقات التوضيحية لـ HTML
    $.root().find('*').contents().filter(function() {
        return this.type === 'comment';
    }).remove();

    // الحصول على النص فقط وتنظيف الفراغات
    let text = $('body').text();
    text = text.replace(/\{[\s\S]*?\}/g, ''); // حذف أي كود JSON متبقي بين أقواس
    text = text.replace(/\s+/g, ' ').trim(); // تنظيف المسافات الزائدة
    
    return text.slice(0, 3800); // اقتطاع النص لضمان عدم تجاوز حد الـ API
}

/**
 * دالة إرسال النص لـ Groq للتنسيق وإعادة الصياغة
 */
async function getAiFormattedContent(title, cleanText) {
    try {
        console.log("🤖 AI is rewriting and structuring content...");
        const completion = await groq.chat.completions.create({
            messages: [
                { 
                    role: "system", 
                    content: "You are an expert tech journalist and SEO editor. Task: Rewrite the provided content to be 100% unique, engaging, and professional. Structure the output using proper HTML: use <h2> for all major section headings and <p> for paragraphs. Strictly remove any author names, dates, sources, or technical JSON/Schema code. Start directly with the first paragraph; do not include an introductory phrase. Language: English." 
                },
                { role: "user", content: `Article Title: ${title}\n\nRaw Content: ${cleanText}` }
            ],
            model: "llama3-8b-8192",
            temperature: 0.6, // توازن بين الإبداع والدقة
        });

        return completion.choices[0]?.message?.content || "Formatting failed.";
    } catch (error) {
        console.error("❌ Groq API Error:", error.message);
        return cleanText; // العودة للنص النقي في حال فشل الـ AI
    }
}

// ==========================================
// المحرك الرئيسي
// ==========================================
async function runAutoBlogger() {
    try {
        console.log("🚀 Starting Blogger Empire Engine...");
        
        // 1. اختيار مصدر عشوائي وجلب الخبر
        const randomFeed = RSS_SOURCES[Math.floor(Math.random() * RSS_SOURCES.length)];
        const feed = await parser.parseURL(randomFeed);
        const latestItem = feed.items[0];

        if (!latestItem) {
            console.log("⏭️ No items found in feed. Skipping.");
            return;
        }

        console.log(`📡 Processing: ${latestItem.title}`);

        // 2. سحب صفحة المقال الكاملة
        const response = await axios.get(latestItem.link);
        const $ = cheerio.load(response.data);
        
        // تحديد حاوية المقال (محاولة دقيقة)
        const articleHtml = $('article').html() || $('.entry-content').html() || $('.main-content').html() || $('body').html();
        
        // 3. التنظيف العميق للنص
        const textToProcess = deepCleanHtml(articleHtml);
        
        if (textToProcess.length < 300) {
            console.log("⏭️ Content too short, likely failed to capture main text. Skipping.");
            return;
        }

        // 4. طلب الصياغة والتنسيق من Groq AI
        const formattedArticleBody = await getAiFormattedContent(latestItem.title, textToProcess);

        // 5. معالجة الصورة وإضافة العلامة المائية الاحترافية
        let ogImage = $('meta[property="og:image"]').attr('content') || $('meta[name="twitter:image"]').attr('content');
        let finalImageUrl = ogImage;
        let isBase64 = false;

        if (ogImage) {
            finalImageUrl = await processAndWatermarkImage(ogImage);
            if (finalImageUrl.startsWith('data:image')) isBase64 = true;
        }

        let imgHtml = finalImageUrl ? `<center><img src="${finalImageUrl}" style="width:100%; max-width:650px; height:auto; border-radius:15px; margin-bottom:25px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);"/></center>` : "";

        // 6. إعداد النشر على بلوجر مع تنسيق CSS عصري
        const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET);
        oauth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });
        const blogger = google.blogger({ version: 'v3', auth: oauth2Client });

        // ستايل CSS خفيف لجعل المقال مريحاً للقراءة
        const styledContent = `
            <div dir="ltr" style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 18px; line-height: 1.8; color: #333; max-width: 700px; margin: 0 auto;">
                ${imgHtml}
                <style>
                    h2 { font-size: 24px; color: #111; margin-top: 30px; margin-bottom: 15px; font-weight: 700; }
                    p { margin-bottom: 20px; }
                </style>
                ${formattedArticleBody}
                <hr style="border: 0; border-top: 1px solid #eee; margin: 40px 0;"/>
                <p style="font-size: 14px; color: #888; text-align: center;">Automatically sourced and AI-optimized for your reading experience.</p>
            </div>
        `;

        await blogger.posts.insert({
            blogId: BLOG_ID,
            requestBody: {
                title: latestItem.title,
                content: styledContent,
                labels: ['Tech', 'Automated', 'AI Rewritten']
            },
            isDraft: false
        });

        console.log("✅ المقال نُشر بنجاح بتنسيق نظيف وعلامة مائية احترافية!");

    } catch (error) {
        console.error("❌ Fatal Bot Error:", error.message);
    }
}

// تشغيل البوت
runAutoBlogger();
