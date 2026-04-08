const Parser = require('rss-parser');
const { JSDOM } = require('jsdom');
const { Readability } = require('@mozilla/readability');
const cheerio = require('cheerio');
const { google } = require('googleapis');
const Groq = require('groq-sdk');
const fs = require('fs'); // لإدارة ملف التخطي
const cloudinary = require('cloudinary').v2; // مكتبة الصور

// --- مكتبات التخطي ---
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

// --- الإعدادات الشخصية ---
const BLOG_ID = "2636919176960128451";
const CLIENT_ID = "872415365656-7qribadnc7k2u21kl6jjcbatdueevifh.apps.googleusercontent.com"; 
const CLIENT_SECRET = "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"; 
const REFRESH_TOKEN = "1//04yti9k2agPknCgYIARAAGAQSNwF-L9IrTZPKt5Fqbg2vrM9sBtOks9cnY4M7Idg0LToQnlbYGME06k20vcyr_SVmYk1H_yZJdEc"; 
const GROQ_API_KEY = "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"; 

// --- إعدادات Cloudinary (سجل مجاناً وضع بياناتك هنا) ---
cloudinary.config({ 
    cloud_name: 'YOUR_CLOUD_NAME', 
    api_key: 'YOUR_API_KEY', 
    api_secret: 'YOUR_API_SECRET' 
});

const groq = new Groq({ apiKey: GROQ_API_KEY });
const parser = new Parser();
const PUBLISHED_FILE = './published_urls.json'; // ملف حفظ الروابط المنشورة

const SOURCES = [
    { name: "Gaming", url: "https://www.windowscentral.com/rss", label: "Gaming" },
    { name: "Android", url: "https://www.androidpolice.com/feed/", label: "Android" },
    { name: "Make Money", url: "https://www.savethestudent.org/make-money/feed", label: "Make Money" },
    { name: "Reviews", url: "https://9to5google.com/feed/", label: "Reviews" },
    { name: "Tech News", url: "https://www.geeky-gadgets.com/feed/", label: "Tech" },
    { name: "AdTech", url: "https://www.exchangewire.com/feed/", label: "Business" },
];

function getRandomDelay() {
    return Math.floor(Math.random() * (120000 - 60000 + 1)) + 60000;
}

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// --- نظام التحقق من النشر (التخطي) ---
function isPublished(url) {
    if (!fs.existsSync(PUBLISHED_FILE)) return false;
    const data = JSON.parse(fs.readFileSync(PUBLISHED_FILE));
    return data.includes(url);
}

function markAsPublished(url) {
    let data = [];
    if (fs.existsSync(PUBLISHED_FILE)) {
        data = JSON.parse(fs.readFileSync(PUBLISHED_FILE));
    }
    data.push(url);
    fs.writeFileSync(PUBLISHED_FILE, JSON.stringify(data, null, 2));
}

// --- نظام معالجة ورفع الصور (Cloudinary) ---
async function processAndUploadImage(imageUrl) {
    try {
        const result = await cloudinary.uploader.upload(imageUrl, {
            folder: "deeplexa_blog",
            transformation: [
                { width: 800, crop: "scale" }, // توحيد حجم الصور لسرعة الموقع
                // إعدادات العلامة المائية: استبدل "DeepLexa" باسم مدونتك أو شعارك
                { overlay: { font_family: "Arial", font_size: 45, font_weight: "bold", text: "DeepLexa.com" }, 
                  gravity: "south_east", x: 20, y: 20, color: "white", opacity: 60 }
            ]
        });
        return result.secure_url; // إرجاع الرابط الجديد المحفوظ في Cloudinary
    } catch (e) {
        console.error("⚠️ خطأ في معالجة الصورة عبر Cloudinary، سيتم استخدام الصورة الأصلية:", e.message);
        return imageUrl;
    }
}

async function getArticleData(url) {
    let browser;
    try {
        browser = await puppeteer.launch({
            headless: "new",
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });

        const html = await page.content();
        await browser.close();

        const dom = new JSDOM(html, { url });
        const reader = new Readability(dom.window.document);
        const article = reader.parse();
        
        if (!article) return null;

        const $ = cheerio.load(article.content);
        let images = [];
        $('img').each((i, el) => {
            let src = $(el).attr('src') || $(el).attr('data-src');
            if (src && src.startsWith('http')) images.push(src);
        });

        if (images.length === 0) {
            const ogImage = dom.window.document.querySelector('meta[property="og:image"]');
            if (ogImage) images.push(ogImage.content);
        }

        return { 
            title: article.title, 
            text: article.textContent.trim().slice(0, 8000), 
            images: images.filter(img => !img.includes('avatar')), 
            link: url,
            excerpt: article.textContent.trim().slice(0, 160)
        };
    } catch (e) {
        if (browser) await browser.close();
        return null; 
    }
}

async function generateSmartContent(article) {
    const prompt = `
    You are an Expert SEO Content Writer & Schema.org Specialist. 
    Rewrite the following article into a long-form (1000+ words) masterpiece.
    
    OUTPUT FORMAT (MANDATORY EXACTLY AS BELOW):
    [TITLE] Your Viral Title [/TITLE]
    [ALT] Highly descriptive SEO Alt Text for the main image (Max 8 words) [/ALT]
    [BODY] Your HTML Content [/BODY]
    [TAGS] Keyword1, Keyword2, Keyword3, Keyword4 [/TAGS]

    CRITICAL RULES:
    1. FAQ Section: Use ONLY <details><summary> tags for questions. Example: <details><summary>Question?</summary><p>Answer</p></details>.
    2. Style: Professional, informative, and high-quality.
    3. HTML: Use <h2>, <h3>, <ul>, <li>. No markdown.
    4. Tags: Provide 5-8 relevant SEO keywords.

    Article Info:
    Title: ${article.title}
    Text: ${article.text}
    `;

    try {
        const completion = await groq.chat.completions.create({
            messages: [{ role: "system", content: prompt }],
            model: "llama-3.3-70b-versatile",
            temperature: 0.5 
        });
        return completion.choices[0].message.content;
    } catch (e) { return null; }
}

async function startEmpireBot() {
    console.log("🚀 Starting the Advanced SEO Bot 2026...");
    
    for (let source of SOURCES) {
        try {
            const feed = await parser.parseURL(source.url);
            const items = feed.items.slice(0, 5);

            for (let item of items) {
                // 1. التخطي: فحص ما إذا كان الرابط تم نشره مسبقاً
                if (isPublished(item.link)) {
                    console.log(`⏩ تخطي مقال منشور مسبقاً: ${item.title}`);
                    continue; 
                }

                const data = await getArticleData(item.link);
                if (!data || data.text.length < 600) continue;

                const aiResponse = await generateSmartContent(data);
                if (!aiResponse) continue;

                // استخراج البيانات من استجابة AI
                const viralTitle = aiResponse.match(/\[TITLE\](.*?)\[\/TITLE\]/s)?.[1].trim() || data.title;
                const cleanAiBody = aiResponse.match(/\[BODY\](.*?)\[\/BODY\]/s)?.[1].trim();
                const imgAltText = aiResponse.match(/\[ALT\](.*?)\[\/ALT\]/s)?.[1].trim() || viralTitle; // استخراج Alt Text المخصص
                const dynamicTags = aiResponse.match(/\[TAGS\](.*?)\[\/TAGS\]/s)?.[1].split(',').map(t => t.trim()) || [];
                
                if (!cleanAiBody) continue;

                let coverImg = data.images[0] || "https://images.unsplash.com/photo-1518770660439-4636190af475";
                
                // 2. معالجة الصورة: رفعها وإضافة العلامة المائية
                console.log("🖼️ جاري معالجة الصورة وإضافة العلامة المائية...");
                coverImg = await processAndUploadImage(coverImg);

                // --- هيكل المقال المطور للـ SEO ---
                const finalHtml = `
                <div class="post-container" dir="ltr">
                    <style>
                        .post-container { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.7; color: #1a1a1a; }
                        .main-img { width: 100%; height: auto; border-radius: 15px; margin-bottom: 20px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
                        h2 { color: #d32f2f; border-bottom: 2px solid #f0f0f0; padding-bottom: 10px; margin-top: 30px; }
                        p { margin-bottom: 20px; font-size: 18px; }
                        
                        /* تفاعلية الأسئلة */
                        details { background: #f9f9f9; padding: 15px; border-radius: 10px; margin-bottom: 10px; border: 1px solid #eee; transition: all 0.3s; }
                        details[open] { background: #fff; border-left: 5px solid #d32f2f; box-shadow: 0 2px 10px rgba(0,0,0,0.05); }
                        summary { font-weight: bold; cursor: pointer; list-style: none; outline: none; font-size: 19px; }
                        summary::-webkit-details-marker { display: none; }
                        
                        .source-btn { display: inline-block; padding: 12px 25px; background: #222; color: #fff !important; text-decoration: none; border-radius: 50px; font-weight: bold; margin-top: 30px; }
                    </style>

                    <script type="application/ld+json">
                    {
                      "@context": "https://schema.org",
                      "@type": "NewsArticle",
                      "headline": "${viralTitle}",
                      "image": ["${coverImg}"],
                      "datePublished": "${new Date().toISOString()}",
                      "author": { "@type": "Person", "name": "DeepLexa Admin" }
                    }
                    </script>

                    <img src="${coverImg}" class="main-img" alt="${imgAltText}" title="${imgAltText}">
                    
                    <div class="article-content">
                        ${cleanAiBody}
                    </div>

                    <a href="${data.link}" class="source-btn" rel="nofollow noopener" target="_blank">View Original Research ↗</a>
                </div>
                `;

                const auth = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET);
                auth.setCredentials({ refresh_token: REFRESH_TOKEN });
                const blogger = google.blogger({ version: 'v3', auth });

                await blogger.posts.insert({
                    blogId: BLOG_ID,
                    requestBody: {
                        title: viralTitle,
                        content: finalHtml,
                        labels: [...new Set([source.label, ...dynamicTags])].slice(0, 10) 
                    }
                });

                // 3. التخطي: إضافة الرابط إلى ملف الروابط المنشورة
                markAsPublished(item.link);

                console.log(`✅ تم النشر بنجاح مع صورة بعلامة مائية: ${viralTitle}`);
                await delay(getRandomDelay());
                break; // يحمل مقال واحد من كل قسم ثم ينتقل للقسم الآخر
            }
        } catch (err) { console.error(`❌ فشل القسم ${source.name}:`, err.message); }
    }
}

startEmpireBot();
