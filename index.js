const Parser = require('rss-parser');
const axios = require('axios');
const { JSDOM } = require('jsdom');
const { Readability } = require('@mozilla/readability');
const cheerio = require('cheerio');
const { google } = require('googleapis');
const Groq = require('groq-sdk');
const fs = require('fs').promises;

// --- الإعدادات ---
const BLOG_ID = "2636919176960128451";
const CLIENT_ID = "872415365656-7qribadnc7k2u21kl6jjcbatdueevifh.apps.googleusercontent.com";
const CLIENT_SECRET = "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";
const REFRESH_TOKEN = "1//04yti9k2agPknCgYIARAAGAQSNwF-L9IrTZPKt5Fqbg2vrM9sBtOks9cnY4M7Idg0LToQnlbYGME06k20vcyr_SVmYk1H_yZJdEc";
const GROQ_API_KEY = "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";

const groq = new Groq({ apiKey: GROQ_API_KEY });
const parser = new Parser();
const DB_FILE = './published_urls.json';

// --- المصادر ---
const SOURCES = [
    { name: "Google Help", url: "https://news.google.com/rss/search?q=site:support.google.com+android+OR+chrome&hl=en-US", label: "Troubleshooting" },
    { name: "Android", url: "https://www.androidpolice.com/feed/", label: "Android" },
    { name: "Make Money", url: "https://www.savethestudent.org/make-money/feed", label: "Make Money" }
];

// --- إدارة قاعدة البيانات ---
async function loadPublishedUrls() {
    try {
        const data = await fs.readFile(DB_FILE, 'utf8');
        return JSON.parse(data);
    } catch (e) { return []; }
}

async function savePublishedUrl(url) {
    const urls = await loadPublishedUrls();
    urls.push(url);
    await fs.writeFile(DB_FILE, JSON.stringify(urls, null, 2));
}

// --- وظائف المعالجة ---
async function getArticleData(url) {
    try {
        // إضافة User-Agent لخدش المواقع التي تحظر البوتات مثل Google Support
        const res = await axios.get(url, { 
            timeout: 15000,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
        });
        const dom = new JSDOM(res.data, { url });
        const reader = new Readability(dom.window.document);
        const article = reader.parse();
        if (!article) return null;

        const $ = cheerio.load(article.content);
        let images = [];
        $('img').each((i, el) => {
            let src = $(el).attr('src');
            if (src && src.startsWith('http')) images.push(src);
        });

        return { originalTitle: article.title, text: article.textContent.trim().slice(0, 9000), images, link: url };
    } catch (e) { return null; }
}

async function generateSmartContent(article) {
    // 1. التعديل الأول: استخدام موديل مدعوم (llama-3.1-8b-instant)
    // 2. التعديل الثاني: أمر الذكاء الاصطناعي بالتوسع في الكتابة (Deep Expansion) لضمان طول المقال
    const prompt = `
    أنت خبير سيو (SEO) محترف. قم بإعادة كتابة المقال التالي باللغة العربية الفصحى وبأسلوب جذاب جداً.
    
    الشروط الصارمة:
    1. العنوان: اجعله فيروسياً وجذاباً يتضمن سنة 2026 وكلمات مثل (شرح، حصري، حل نهائي).
    2. الطول: يجب أن يكون المقال طويلاً (أكثر من 1000 كلمة). قم بالتوسع في الشرح وإضافة نصائح إضافية من عندك.
    3. الهيكل: مقدمة مشوقة، عناوين فرعية H2 و H3، فقرات قصيرة جداً (سطرين فقط)، قوائم نقطية.
    4. قسم الأسئلة الشائعة (FAQ): أضف 3 أسئلة وإجاباتها في نهاية المقال.
    5. الروابط: أضف رابط خارجي مفيد ورابط داخلي (placeholder).
    
    المحتوى المراد معالجته:
    ${article.text}
    
    رد بصيغة JSON فقط تحتوي على المفاتيح: "title" و "content".
    `;

    try {
        const completion = await groq.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model: "llama-3.1-8b-instant", // الموديل الجديد البديل
            temperature: 0.7,
            response_format: { type: "json_object" }
        });
        
        return JSON.parse(completion.choices[0].message.content);
    } catch (e) { 
        console.log("⚠️ AI Error: " + e.message);
        return null; 
    }
}

// --- المحرك الرئيسي ---
async function startEmpireBot() {
    console.log("🚀 Starting the SEO Master Bot (Fixed Version)...");
    const publishedUrls = await loadPublishedUrls();

    for (const source of SOURCES) {
        console.log(`\n📡 Checking Source: ${source.name} ...`);
        
        try {
            const feed = await parser.parseURL(source.url);
            const items = feed.items.slice(0, 5);

            for (let item of items) {
                if (publishedUrls.includes(item.link)) continue; 

                console.log(`⏳ Processing: ${item.title}`);
                const data = await getArticleData(item.link);
                
                // 3. التعديل الثالث: خفض عتبة الفحص لـ 350 حرف لأن الذكاء الاصطناعي سيقوم بالتوسع (Expansion)
                if (!data || data.text.length < 350) {
                    console.log("⏭️ Content too short for source, skipping.");
                    continue;
                }

                const aiData = await generateSmartContent(data);
                if (!aiData) continue;

                const coverImg = data.images[0] || "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=800";
                
                const htmlBody = `
                <div dir="rtl" style="font-family: 'Tajawal', sans-serif; line-height: 1.8; color: #333; max-width: 800px; margin: auto; text-align: right;">
                    <img src="${coverImg}" alt="${aiData.title}" style="width: 100%; border-radius: 15px; margin-bottom: 20px;"/>
                    <div style="font-size: 18px;">
                        ${aiData.content}
                    </div>
                </div>
                `;

                const auth = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET);
                auth.setCredentials({ refresh_token: REFRESH_TOKEN });
                const blogger = google.blogger({ version: 'v3', auth });

                await blogger.posts.insert({
                    blogId: BLOG_ID,
                    requestBody: {
                        title: aiData.title,
                        content: htmlBody,
                        labels: [source.label, 'حصري 2026']
                    }
                });

                console.log(`✅ Success: Published ${aiData.title}`);
                await savePublishedUrl(item.link);
                break; 
            }
            
            // انتظار 10 ثواني بين المصادر لتجنب الـ Rate Limit
            await new Promise(res => setTimeout(res, 10000)); 

        } catch (err) {
            console.log(`❌ Error: ${err.message}`);
        }
    }
}

startEmpireBot();
