const Parser = require('rss-parser');
const axios = require('axios');
const { JSDOM } = require('jsdom');
const { Readability } = require('@mozilla/readability');
const cheerio = require('cheerio');
const { google } = require('googleapis');
const Groq = require('groq-sdk');
const fs = require('fs').promises; // لإدارة ملف منع التكرار

// --- الإعدادات ---
const BLOG_ID = "8249860422330426533";
const CLIENT_ID = "872415365656-7qribadnc7k2u21kl6jjcbatdueevifh.apps.googleusercontent.com";
const CLIENT_SECRET = "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";
const REFRESH_TOKEN = "1//04yti9k2agPknCgYIARAAGAQSNwF-L9IrTZPKt5Fqbg2vrM9sBtOks9cnY4M7Idg0LToQnlbYGME06k20vcyr_SVmYk1H_yZJdEc";
const GROQ_API_KEY = "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";

const groq = new Groq({ apiKey: GROQ_API_KEY });
const parser = new Parser();

// ملف حفظ الروابط المنشورة
const DB_FILE = './published_urls.json';

// وظيفة الانتظار (تأخير النشر)
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// --- المصادر الذكية ---
const SOURCES = [
    // تم التركيز هنا على سحب الدعم الفني من جوجل مباشرة
    { name: "Google Help", url: "https://news.google.com/rss/search?q=site:support.google.com+android+OR+windows&hl=en-US", label: "Troubleshooting" },
    { name: "Android", url: "https://www.androidpolice.com/feed/", label: "Android" },
    { name: "Make Money", url: "https://www.savethestudent.org/make-money/feed", label: "Make Money" },
    { name: "Reviews", url: "https://9to5google.com/feed/", label: "Reviews" },
    { name: "Tech News", url: "https://www.geeky-gadgets.com/feed/", label: "Tech" },
    { name: "Gaming", url: "https://www.windowscentral.com/gaming/rss.xml", label: "Gaming" }
];

// --- إدارة قاعدة البيانات المصغرة ---
async function loadPublishedUrls() {
    try {
        const data = await fs.readFile(DB_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return []; // إذا لم يكن الملف موجوداً، أرجع مصفوفة فارغة
    }
}

async function savePublishedUrl(url) {
    const urls = await loadPublishedUrls();
    urls.push(url);
    await fs.writeFile(DB_FILE, JSON.stringify(urls, null, 2));
}

// --- وظائف المعالجة ---
async function getArticleData(url) {
    try {
        const res = await axios.get(url, { timeout: 15000 });
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

        // تم تحويل النص لـ HTML للحفاظ على الروابط (<a> tags)
        return { title: article.title, text: article.content.trim().slice(0, 5000), images, link: url };
    } catch (e) { 
        console.log(`⚠️ Error reading article: ${url}`);
        return null; 
    }
}

async function generateSmartContent(sourceInfo, article) {
    const prompt = `
    You are an SEO Expert. Rewrite this article: "${article.title}"
    Follow these STRICT rules:
    1. Hook Title: Create a viral title.
    2. Structure: Use <h2> for subheadings.
    3. Keep Useful Links: If the original text contains valid, useful <a> tags (like official download links or references), KEEP THEM in your rewritten HTML content. Make sure links have target="_blank".
    4. Content Type: Make it highly readable, especially if it's troubleshooting from Google Support.
    5. FAQ: Add a "Frequently Asked Questions" section at the end.
    6. Tone: High energy, engaging, professional, and easy to understand for beginners.
    7. Language: English.
    
    Original Content (HTML format to preserve links): 
    ${article.text}
    `;

    try {
        const completion = await groq.chat.completions.create({
            messages: [{ role: "system", content: prompt }],
            model: "llama3-8b-8192",
            temperature: 0.7
        });
        return completion.choices[0].message.content;
    } catch (e) { 
        console.log("⚠️ Groq AI Error");
        return null; 
    }
}

// --- المحرك الرئيسي ---
async function startEmpireBot() {
    console.log("🚀 Starting the Multi-Niche Empire Bot...");
    
    const publishedUrls = await loadPublishedUrls();

    // المرور على كل المصادر بالترتيب
    for (const source of SOURCES) {
        console.log(`\n📡 Checking Source: ${source.name} ...`);
        
        try {
            const feed = await parser.parseURL(source.url);
            const items = feed.items.slice(0, 10); // سحب أول 10 مقالات للفحص
            let articlePublishedForThisSource = false;

            for (let item of items) {
                // فحص التكرار: إذا كان الرابط منشوراً من قبل، تخطاه فوراً
                if (publishedUrls.includes(item.link)) {
                    continue; 
                }

                console.log(`⏳ Processing new article: ${item.title}`);
                const data = await getArticleData(item.link);
                
                if (!data || data.text.length < 500) continue;

                const aiContent = await generateSmartContent(source, data);
                if (!aiContent) continue;

                // صورة الغلاف
                const coverImg = data.images[0] || "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=800";
                
                // قالب احترافي بنمط Dark Mode & Glassmorphism
                const htmlBody = `
                <div dir="ltr" style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #121212; color: #e0e0e0; line-height: 1.8; max-width: 800px; margin: auto; padding: 20px; border-radius: 15px;">
                    
                    <div style="text-align: center; position: relative; margin-bottom: 30px;">
                        <img src="${coverImg}" style="width: 100%; border-radius: 16px; box-shadow: 0 8px 32px rgba(0,0,0,0.5);"/>
                        <div style="position: absolute; bottom: 15px; left: 15px; background: rgba(255, 255, 255, 0.1); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.2); color: white; padding: 8px 20px; border-radius: 30px; font-size: 13px; font-weight: bold;">
                            ${source.label}
                        </div>
                    </div>
                    
                    <div style="background: rgba(255, 255, 255, 0.03); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.05); padding: 30px; border-radius: 16px; box-shadow: 0 4px 30px rgba(0,0,0,0.1);">
                        ${aiContent.replace(/\n/g, '<br/>')}
                    </div>
                    
                    <div style="background: rgba(0, 123, 255, 0.1); border-left: 4px solid #007bff; padding: 15px 20px; margin-top: 30px; border-radius: 0 10px 10px 0;">
                        <strong style="color: #66b2ff;">💡 Pro Tip:</strong> Keep your systems updated for maximum security.
                    </div>

                    <div style="text-align: center; margin-top: 40px; padding: 20px; background: rgba(255,255,255,0.02); border-radius: 15px; border: 1px dashed rgba(255,255,255,0.1);">
                        <p style="color: #aaa;">Enjoyed this article? Discover more tech insights on our homepage!</p>
                        <a href="${data.link}" target="_blank" rel="nofollow" style="display: inline-block; background: #007bff; color: #fff; padding: 10px 25px; border-radius: 30px; text-decoration: none; font-weight: bold; transition: 0.3s;">Read Original Source ↗</a>
                    </div>
                </div>
                `;

                // النشر عبر جوجل Blogger API
                const auth = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET);
                auth.setCredentials({ refresh_token: REFRESH_TOKEN });
                const blogger = google.blogger({ version: 'v3', auth });

                await blogger.posts.insert({
                    blogId: BLOG_ID,
                    requestBody: {
                        title: data.title, // يمكنك جعل الذكاء الاصطناعي يستخرج العنوان أيضاً لو أردت
                        content: htmlBody,
                        labels: [source.label, 'Tech', '2026']
                    }
                });

                console.log(`✅ Published Successfully: ${data.title}`);
                
                // حفظ الرابط في قاعدة البيانات لتجنب تكراره مستقبلاً
                await savePublishedUrl(item.link);
                articlePublishedForThisSource = true;
                
                // الخروج من حلقة المقالات لهذا المصدر (نكتفي بمقال واحد من كل مصدر في الجولة الواحدة)
                break; 
            }

            if (!articlePublishedForThisSource) {
                console.log(`🤷‍♂️ No new articles found for ${source.name}.`);
            }

            // فاصل زمني بين كل موقع وموقع (15 دقيقة) لتجنب الحظر
            console.log("⏱️ Waiting 15 minutes before checking the next source...");
            await delay(15 * 60 * 1000); 

        } catch (err) {
            console.log(`❌ Error processing source ${source.name}:`, err.message);
        }
    }
    
    console.log("🎉 All sources checked for this cycle. Bot finished!");
}

// تشغيل البوت
startEmpireBot();
