const Parser = require('rss-parser');
const { JSDOM } = require('jsdom');
const { Readability } = require('@mozilla/readability');
const cheerio = require('cheerio');
const { google } = require('googleapis');
const Groq = require('groq-sdk');
const sharp = require('sharp');
const axios = require('axios');

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

const groq = new Groq({ apiKey: GROQ_API_KEY });
const parser = new Parser();

const SOURCES = [
    { name: "Gaming", url: "https://www.windowscentral.com/rss", label: "Gaming" },
    { name: "Android", url: "https://www.androidpolice.com/feed/", label: "Android" },
    { name: "Make Money", url: "https://www.savethestudent.org/make-money/feed", label: "Make Money" },
    { name: "Reviews", url: "https://9to5google.com/feed/", label: "Reviews" },
    { name: "Tech News", url: "https://www.geeky-gadgets.com/feed/", label: "Tech" },
    { name: "AdTech", url: "https://www.exchangewire.com/feed/", label: "Business" },
];

function getRandomDelay() {
    return Math.floor(Math.random() * (60000 - 30000 + 1)) + 30000; // تأخير بين 30 إلى 60 ثانية
}

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// --- 1. وظيفة جلب الروابط المنشورة من بلوجر لفحص التكرار ---
async function fetchPublishedLinksFromBlogger(blogger) {
    console.log("🔄 جاري فحص مدونة DeepLexa لجلب المقالات السابقة...");
    let publishedLinks = [];
    try {
        const res = await blogger.posts.list({
            blogId: BLOG_ID,
            maxResults: 50, // جلب آخر 50 مقال للمقارنة
            fetchBodies: true 
        });
        if (res.data.items) {
            res.data.items.forEach(post => {
                // استخراج رابط المصدر من زر "View Original Research" اللي بنحطه بآخر المقال
                const match = post.content.match(/<a href="(.*?)" class="source-btn"/);
                if (match && match[1]) {
                    publishedLinks.push(match[1]);
                }
            });
        }
        console.log(`✅ تم سحب ${publishedLinks.length} مقال سابق لتجنب التكرار.`);
    } catch (e) {
        console.error("❌ فشل في جلب المقالات من بلوجر:", e.message);
    }
    return publishedLinks;
}

// --- 2. وظيفة معالجة الصور وإضافة العلامة المائية (DeepLexa) ---
async function processImageWithWatermark(imageUrl) {
    try {
        const response = await axios({ url: imageUrl, responseType: 'arraybuffer', timeout: 15000 });
        const buffer = Buffer.from(response.data);

        const width = 800;
        const height = 450;
        
        // تصميم العلامة المائية بالنص (بدون الحاجة لملف لوجو)
        const svgWatermark = `
        <svg width="${width}" height="${height}">
            <style>
                .watermark { fill: #ffffff; font-size: 26px; font-weight: bold; font-family: 'Segoe UI', Arial, sans-serif; }
                .bg { fill: rgba(0, 0, 0, 0.6); }
            </style>
            <rect x="${width - 160}" y="${height - 50}" width="150" height="40" rx="5" class="bg"/>
            <text x="${width - 145}" y="${height - 22}" class="watermark">DeepLexa</text>
        </svg>
        `;

        const processedBuffer = await sharp(buffer)
            .resize(width, height, { fit: 'cover' })
            .composite([{ 
                input: Buffer.from(svgWatermark), 
                top: 0, 
                left: 0 
            }])
            .jpeg({ quality: 80 }) // ضغط ممتاز لسرعة الموقع
            .toBuffer();

        const base64Image = processedBuffer.toString('base64');
        return `data:image/jpeg;base64,${base64Image}`;
    } catch (err) {
        console.error("⚠️ فشل معالجة الصورة، سيتم استخدام الرابط الأصلي:", err.message);
        return imageUrl; 
    }
}

// --- 3. جلب محتوى المقال الأصلي (Puppeteer) ---
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
            link: url
        };
    } catch (e) {
        if (browser) await browser.close();
        return null; 
    }
}

// --- 4. توليد المحتوى بالذكاء الاصطناعي ---
async function generateSmartContent(article) {
    const prompt = `
    You are an Expert SEO Content Writer for 'DeepLexa' Blog. 
    Rewrite the following article into a long-form (800+ words) masterpiece.
    
    OUTPUT FORMAT (MANDATORY):
    [TITLE] Your Viral SEO Title [/TITLE]
    [BODY] Your HTML Content [/BODY]
    [TAGS] Keyword1, Keyword2, Keyword3 [/TAGS]

    CRITICAL RULES:
    1. FAQ Section: Use ONLY <details><summary> tags. Example: <details><summary>Question?</summary><p>Answer</p></details>.
    2. Style: Professional, informative, and engaging.
    3. HTML: Use <h2>, <h3>, <ul>, <li>. No markdown.

    Article Info:
    Title: ${article.title}
    Text: ${article.text}
    `;

    try {
        const completion = await Promise.race([
            groq.chat.completions.create({
                messages: [{ role: "system", content: prompt }],
                model: "llama-3.3-70b-versatile",
                temperature: 0.6 
            }),
            new Promise((_, reject) => setTimeout(() => reject(new Error("Groq API Timeout")), 60000))
        ]);
        return completion.choices[0].message.content;
    } catch (e) { return null; }
}

// --- الدالة الرئيسية (The Master Bot) ---
async function startEmpireBot() {
    console.log("🚀 Starting DeepLexa SEO Bot...");
    let postedCount = 0;
    
    // إعداد مصادقة جوجل
    const auth = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET);
    auth.setCredentials({ refresh_token: REFRESH_TOKEN });
    const blogger = google.blogger({ version: 'v3', auth });

    // جلب الروابط المنشورة من المدونة
    let publishedLinks = await fetchPublishedLinksFromBlogger(blogger);

    for (let source of SOURCES) {
        try {
            console.log(`\n🔍 جاري فحص مصدر: ${source.name}`);
            const feed = await parser.parseURL(source.url);
            const items = feed.items.slice(0, 10); // سحب آخر 10 مقالات عشان لو الأول مكرر، ينزل للي تحته

            for (let item of items) {
                // الفحص الذكي: إذا الرابط موجود بمدونتك، اعمل تخطي وانتقل للمقال اللي بعده بنفس المصدر!
                if (publishedLinks.includes(item.link)) {
                    console.log(`⏭️ تخطي (موجود في DeepLexa): ${item.title}`);
                    continue; 
                }

                console.log(`✍️ جاري معالجة مقال جديد: ${item.title}`);
                const data = await getArticleData(item.link);
                if (!data || data.text.length < 600) {
                    console.log(`⚠️ تخطي: المحتوى قصير جداً.`);
                    continue;
                }

                const aiResponse = await generateSmartContent(data);
                if (!aiResponse) {
                    console.log(`⚠️ تخطي: مشكلة في استجابة الذكاء الاصطناعي.`);
                    continue;
                }

                const viralTitle = aiResponse.match(/\[TITLE\](.*?)\[\/TITLE\]/s)?.[1].trim() || data.title;
                const cleanAiBody = aiResponse.match(/\[BODY\](.*?)\[\/BODY\]/s)?.[1].trim();
                const dynamicTags = aiResponse.match(/\[TAGS\](.*?)\[\/TAGS\]/s)?.[1].split(',').map(t => t.trim()) || [];
                
                if (!cleanAiBody) continue;

                // معالجة الصورة وإضافة لوجو DeepLexa
                const originalImg = data.images[0] || "https://images.unsplash.com/photo-1518770660439-4636190af475";
                console.log(`🎨 جاري تصميم وحفظ حقوق الصورة لـ DeepLexa...`);
                const finalImage = await processImageWithWatermark(originalImg);

                // الهيكل النهائي للمقال
                const finalHtml = `
                <div class="post-container" dir="ltr">
                    <style>
                        .post-container { font-family: 'Segoe UI', Tahoma, sans-serif; line-height: 1.7; color: #222; }
                        .main-img { width: 100%; height: auto; border-radius: 12px; margin-bottom: 25px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
                        h2 { color: #1a73e8; border-bottom: 2px solid #e8eaed; padding-bottom: 8px; margin-top: 25px; }
                        p { font-size: 17px; margin-bottom: 15px; }
                        details { background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 10px; border: 1px solid #dadce0; }
                        details[open] { background: #fff; border-left: 4px solid #1a73e8; }
                        summary { font-weight: bold; cursor: pointer; list-style: none; font-size: 18px; color: #202124; }
                        .source-btn { display: inline-block; padding: 10px 20px; background: #202124; color: #fff !important; text-decoration: none; border-radius: 25px; font-weight: bold; margin-top: 20px; font-size: 14px; }
                    </style>

                    <img src="${finalImage}" class="main-img" alt="${viralTitle}" title="${viralTitle}">
                    
                    <div class="article-content">
                        ${cleanAiBody}
                    </div>

                    <a href="${data.link}" class="source-btn" rel="nofollow noopener" target="_blank">View Original Research ↗</a>
                </div>
                `;

                await blogger.posts.insert({
                    blogId: BLOG_ID,
                    requestBody: {
                        title: viralTitle,
                        content: finalHtml,
                        labels: [...new Set([source.label, ...dynamicTags])].slice(0, 8)
                    }
                });

                console.log(`✅ تم النشر بنجاح على DeepLexa: ${viralTitle}`);
                
                // تحديث الذاكرة الحالية عشان ما ينشره مرة تانية لو تكرر بالغلط
                publishedLinks.push(data.link);
                postedCount++;

                // بما إنا نشرنا مقال من هالمصدر، ننتظر شوي ونعمل break للانتقال للمصدر اللي بعده
                const waitTime = getRandomDelay();
                console.log(`⏳ انتظار ${(waitTime / 1000).toFixed(0)} ثانية قبل الانتقال للمصدر التالي...`);
                await delay(waitTime);
                
                break; // يطلع من حلقة المقالات وينتقل للمصدر التالي عشان ينوع المحتوى
            }
        } catch (err) { console.error(`❌ فشل معالجة القسم ${source.name}:`, err.message); }
    }

    if (postedCount === 0) {
        console.log("🛑 انتهت العملية: لم يتم العثور على مقالات جديدة في جميع المصادر.");
    } else {
        console.log(`🎉 تم بنجاح! نُشر ${postedCount} مقالات حصرية على DeepLexa.`);
    }
    
    process.exit(0);
}

startEmpireBot();
