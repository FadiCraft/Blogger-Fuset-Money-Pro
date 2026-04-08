const Parser = require('rss-parser');
const { JSDOM } = require('jsdom');
const { Readability } = require('@mozilla/readability');
const cheerio = require('cheerio');
const { google } = require('googleapis');
const Groq = require('groq-sdk');
const cloudinary = require('cloudinary').v2; // المكتبة الجديدة للصور

// --- مكتبات التخطي ---
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

// --- الإعدادات الشخصية ---
const BLOG_ID = "2636919176960128451";
const CLIENT_ID = "YOUR_CLIENT_ID"; 
const CLIENT_SECRET = "YOUR_CLIENT_SECRET"; 
const REFRESH_TOKEN = "YOUR_REFRESH_TOKEN"; 
const GROQ_API_KEY = "YOUR_GROQ_API_KEY"; 

const groq = new Groq({ apiKey: GROQ_API_KEY });
const parser = new Parser();

// --- إعدادات Cloudinary لرفع الصور والعلامة المائية ---
// قم بإنشاء حساب مجاني على cloudinary.com وضع بياناتك هنا
cloudinary.config({ 
    cloud_name: 'YOUR_CLOUD_NAME', 
    api_key: 'YOUR_CLOUDINARY_API_KEY', 
    api_secret: 'YOUR_CLOUDINARY_API_SECRET' 
});

const WATERMARK_TEXT = "MyEmpireSite.com"; // النص الذي سيظهر كعلامة مائية

// --- المصادر الذكية ---
const SOURCES = [
    { name: "Gaming", url: "https://www.windowscentral.com/rss", label: "Gaming" },
    { name: "Android", url: "https://www.androidpolice.com/feed/", label: "Android" },
    // أضف باقي المصادر هنا...
];

function getRandomDelay() {
    const minMs = 1 * 60 * 1000;
    const maxMs = 2 * 60 * 1000;
    return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
}
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// --- رفع الصورة وإضافة العلامة المائية ---
async function processAndUploadImage(imageUrl) {
    try {
        console.log(`🖼️ جاري رفع الصورة ووضع العلامة المائية...`);
        const result = await cloudinary.uploader.upload(imageUrl, {
            folder: "auto_blogger",
            transformation: [
                // إعدادات العلامة المائية (نص أبيض نصف شفاف في الزاوية اليمنى السفلى)
                {
                    overlay: { font_family: "Arial", font_size: 40, font_weight: "bold", text: WATERMARK_TEXT },
                    color: "white", opacity: 60, gravity: "south_east", x: 20, y: 20
                }
            ]
        });
        return result.secure_url; // إرجاع الرابط الدائم والآمن
    } catch (error) {
        console.error("❌ فشل معالجة الصورة في Cloudinary:", error.message);
        return imageUrl; // في حال الفشل، نستخدم الرابط الأصلي كحل بديل
    }
}

// --- 1. سحب البيانات عبر Puppeteer (كما هي في كودك مع تحسينات طفيفة) ---
async function getArticleData(url) {
    let browser;
    try {
        browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox', '--disable-setuid-sandbox'] });
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });

        // التمرير لجلب الصور
        await page.evaluate(async () => {
            await new Promise((resolve) => {
                let totalHeight = 0;
                const distance = 100;
                const timer = setInterval(() => {
                    const scrollHeight = document.body.scrollHeight;
                    window.scrollBy(0, distance);
                    totalHeight += distance;
                    if (totalHeight >= scrollHeight - window.innerHeight) {
                        clearInterval(timer); resolve();
                    }
                }, 50);
            });
        });

        const html = await page.content();
        await browser.close();

        const dom = new JSDOM(html, { url });
        const reader = new Readability(dom.window.document);
        const article = reader.parse();
        
        if (!article) return null;

        const $ = cheerio.load(article.content);
        let images = [];
        
        $('img').each((i, el) => {
            let src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('srcset');
            if (src && src.startsWith('http')) images.push(src.split(' ')[0]);
        });

        if (images.length === 0) {
            const ogImage = dom.window.document.querySelector('meta[property="og:image"]');
            if (ogImage && ogImage.content) images.push(ogImage.content);
        }

        return { 
            title: article.title, 
            text: article.textContent.trim().slice(0, 7000), 
            images: images.filter(img => !img.includes('avatar') && !img.includes('logo')), 
            link: url 
        };
    } catch (e) { 
        console.log(`⚠️ فشل سحب الرابط: ${url} - السبب: ${e.message}`);
        if (browser) await browser.close();
        return null; 
    }
}

// --- 2. الذكاء الاصطناعي الشامل (تم تطوير الـ Prompt بالكامل) ---
async function generateSmartContent(article) {
    const prompt = `
    You are an Expert SEO Content Writer and Subject Matter Expert.
    Your task is to rewrite AND EXPAND the following text into a highly engaging, long-form, AdSense-friendly article.
    Even if the provided content is short, you MUST expand on it deeply, adding background context, detailed explanations, and examples.
    
    CRITICAL RULES (FOLLOW STRICTLY):
    1. Output MUST be a valid JSON object. DO NOT output markdown blocks or extra text outside the JSON.
    2. The JSON must contain two keys: "html" and "keywords".
    3. The "html" value must contain pure HTML structure.
    4. In the HTML: Start with an <h1> containing a viral, click-worthy title.
    5. In the HTML: Use an interactive FAQ section using <details> and <summary> tags. Example: <details><summary>Question?</summary><p>Answer.</p></details>
    6. Language: English. Tone: Professional and exciting. Aim for 800-1200 words.
    7. The "keywords" value must be a JSON Array of strings containing 4 to 6 dynamic, highly specific SEO tags for this exact article.

    Expected JSON Format:
    {
      "html": "<h1>Viral Title</h1> <p>Expanded introduction...</p> <h2>Subtitle</h2> <p>Deep content...</p> <h2>FAQ</h2> <details><summary>Q1?</summary><p>A1</p></details>",
      "keywords": ["tag1", "tag2", "tag3", "tag4"]
    }

    Original Title: "${article.title}"
    Content to expand and rewrite: ${article.text}
    `;

    try {
        console.log("🧠 جاري صياغة المحتوى الديناميكي والتوسعة باستخدام Llama-3.3...");
        const completion = await groq.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model: "llama-3.3-70b-versatile",
            temperature: 0.7 
        });

        const responseText = completion.choices[0].message.content;
        
        // استخراج الـ JSON بأمان من رد الذكاء الاصطناعي
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        } else {
            throw new Error("لم يقم الذكاء الاصطناعي بإرجاع JSON صحيح.");
        }

    } catch (e) { 
        console.error("❌ خطأ AI:", e.message);
        return null; 
    }
}

// --- 3. المحرك الرئيسي ---
async function startEmpireBot() {
    console.log("🚀 Starting the SEO Empire Bot 2026...");
    
    for (let i = 0; i < SOURCES.length; i++) {
        const source = SOURCES[i];
        console.log(`\n========================================`);
        console.log(`📂 جاري معالجة قسم: ${source.name}`);
        console.log(`========================================`);

        try {
            const feed = await parser.parseURL(source.url);
            const items = feed.items.sort(() => 0.5 - Math.random()).slice(0, 5);
            let postedSuccessfully = false;

            for (let item of items) {
                console.log(`📡 فحص الخبر: ${item.title}`);
                const data = await getArticleData(item.link);
                
                // تم تقليل حد التخطي قليلاً لأن الذكاء الاصطناعي سيقوم بالتوسعة
                if (!data || data.text.length < 300) {
                    console.log("⏭️ محتوى غير كافٍ تماماً، جاري الانتقال للخبر التالي...");
                    continue;
                }

                const aiData = await generateSmartContent(data);
                if (!aiData || !aiData.html) continue;

                let viralTitle = data.title;
                const aiRawHtml = aiData.html;
                const dynamicKeywords = aiData.keywords || [];
                
                const h1Match = aiRawHtml.match(/<h1>(.*?)<\/h1>/i);
                if (h1Match) viralTitle = h1Match[1].replace(/<[^>]+>/g, '');

                const cleanAiBody = aiRawHtml.replace(/<h1>.*?<\/h1>/i, '');
                
                // --- معالجة الصورة عبر Cloudinary ---
                let finalCoverImg = "https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&q=80";
                if (data.images && data.images.length > 0) {
                    finalCoverImg = await processAndUploadImage(data.images[0]);
                }

                // --- تصميم الـ CSS الخاص بالـ Accordion للأسئلة الشائعة وتنسيق المقال ---
                const htmlBody = `
                <div class="main-container" dir="ltr">
                    <style>
                        .main-container { font-family: 'Helvetica Neue', Arial, sans-serif; color: #333; line-height: 1.8; max-width: 800px; margin: 0 auto; }
                        .hero-section { position: relative; border-radius: 20px; overflow: hidden; margin-bottom: 35px; box-shadow: 0 10px 30px rgba(0,0,0,0.15); }
                        .hero-section img { width: 100%; height: auto; max-height: 500px; object-fit: cover; display: block; }
                        .badge { background: #ff4757; color: white; padding: 5px 12px; border-radius: 5px; font-size: 12px; font-weight: bold; text-transform: uppercase; margin-bottom: 10px; display: inline-block; }
                        .article-body h2 { color: #2f3542; font-size: 26px; border-left: 5px solid #ff4757; padding-left: 15px; margin-top: 40px; }
                        .article-body h3 { color: #57606f; font-size: 22px; margin-top: 30px; }
                        .article-body p { margin-bottom: 20px; font-size: 18px; color: #444; }
                        
                        /* تصميم الأسئلة الديناميكية (Accordion) */
                        details { background: #f8f9fa; border: 1px solid #e1e1e1; border-radius: 8px; margin-bottom: 15px; padding: 10px 20px; cursor: pointer; transition: all 0.3s ease; }
                        details[open] { background: #ffffff; border-color: #ff4757; box-shadow: 0 4px 10px rgba(0,0,0,0.05); }
                        summary { font-size: 18px; font-weight: bold; color: #2f3542; outline: none; list-style: none; display: flex; justify-content: space-between; align-items: center; }
                        summary::-webkit-details-marker { display: none; }
                        summary::after { content: '+'; font-size: 24px; color: #ff4757; }
                        details[open] summary::after { content: '-'; }
                        details p { margin-top: 15px; font-size: 16px; color: #555; padding-top: 15px; border-top: 1px solid #eee; }
                        
                        .source-link { display: block; text-align: center; margin-top: 40px; padding: 15px; background: #2f3542; color: white !important; text-decoration: none; border-radius: 10px; font-weight: bold; }
                    </style>

                    <div class="hero-section">
                        <img src="${finalCoverImg}" alt="${viralTitle} - صورة توضيحية" title="${viralTitle}">
                    </div>
                    
                    <div class="badge">${source.label}</div>
                    <h1 style="font-size: 32px; color: #111; margin-bottom: 20px;">${viralTitle}</h1>

                    <div class="article-body">
                        ${cleanAiBody}
                    </div>

                    <a href="${data.link}" class="source-link" target="_blank" rel="nofollow">Read Full Research on Original Source ↗</a>
                </div>
                `;

                // دمج التصنيفات الثابتة مع الكلمات المفتاحية الديناميكية من الذكاء الاصطناعي
                const finalLabels = [...new Set([source.label, 'Trending', ...dynamicKeywords])].slice(0, 7); // أقصى حد 7 تصنيفات

                const auth = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET);
                auth.setCredentials({ refresh_token: REFRESH_TOKEN });
                const blogger = google.blogger({ version: 'v3', auth });

                await blogger.posts.insert({
                    blogId: BLOG_ID,
                    requestBody: {
                        title: viralTitle,
                        content: htmlBody,
                        labels: finalLabels
                    }
                });

                console.log(`✅ تم النشر بنجاح: ${viralTitle}`);
                console.log(`🏷️ الكلمات المفتاحية: ${finalLabels.join(', ')}`);
                postedSuccessfully = true;
                break; // الانتقال للقسم التالي بعد نشر مقال واحد بنجاح من هذا القسم
            }

            if (postedSuccessfully && i < SOURCES.length - 1) {
                const waitTime = getRandomDelay();
                const waitMinutes = (waitTime / 60000).toFixed(2);
                console.log(`⏳ تم النشر. جاري الانتظار لمدة ${waitMinutes} دقيقة قبل القسم التالي...`);
                await delay(waitTime);
            }

        } catch (err) {
            console.error(`❌ فشل في معالجة الـ RSS لقسم ${source.name}:`, err.message);
        }
    }
    
    console.log("🎉 اكتملت الدورة بنجاح!");
}

startEmpireBot();
