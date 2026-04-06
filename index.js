const Parser = require('rss-parser');
const axios = require('axios');
const { JSDOM } = require('jsdom');
const { Readability } = require('@mozilla/readability');
const cheerio = require('cheerio');
const { google } = require('googleapis');
const Groq = require('groq-sdk');

// --- الإعدادات الشخصية (تأكد من صحتها) ---
const BLOG_ID = "2636919176960128451";
const CLIENT_ID = "872415365656-7qribadnc7k2u21kl6jjcbatdueevifh.apps.googleusercontent.com";
const CLIENT_SECRET = "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";
const REFRESH_TOKEN = "1//04yti9k2agPknCgYIARAAGAQSNwF-L9IrTZPKt5Fqbg2vrM9sBtOks9cnY4M7Idg0LToQnlbYGME06k20vcyr_SVmYk1H_yZJdEc";
const GROQ_API_KEY = "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";

const groq = new Groq({ apiKey: GROQ_API_KEY });
const parser = new Parser();

// --- المصادر الذكية (المواقع التي طلبتها) ---
const SOURCES = [
    { name: "Gaming", url: "https://www.windowscentral.com/gaming/rss.xml", label: "Gaming" },
    { name: "Android", url: "https://www.androidpolice.com/feed/", label: "Android" },
    { name: "Make Money", url: "https://www.savethestudent.org/make-money/feed", label: "Make Money" },
    { name: "Reviews", url: "https://9to5google.com/feed/", label: "Reviews" },
    { name: "Tech News", url: "https://www.geeky-gadgets.com/feed/", label: "Tech" },
    { name: "AdTech", url: "https://www.exchangewire.com/feed/", label: "Business" },
    { name: "Google Help", url: "https://news.google.com/rss/search?q=how+to+fix+android+app+problem&hl=en-US", label: "Troubleshooting" }
];

// --- 1. وظيفة سحب وتنظيف المحتوى ---
async function getArticleData(url) {
    try {
        const res = await axios.get(url, { 
            headers: { 'User-Agent': 'Mozilla/5.0' },
            timeout: 15000 
        });
        const dom = new JSDOM(res.data, { url });
        const reader = new Readability(dom.window.document);
        const article = reader.parse();
        if (!article) return null;

        const $ = cheerio.load(article.content);
        let images = [];
        $('img').each((i, el) => {
            let src = $(el).attr('src') || $(el).attr('data-src');
            if (src && src.startsWith('http')) images.push(src);
        });

        // نأخذ نص كبير لضمان أن الـ AI لديه مادة كافية لكتابة 800+ كلمة
        return { 
            title: article.title, 
            text: article.textContent.trim().slice(0, 7000), 
            images, 
            link: url 
        };
    } catch (e) { 
        console.log(`⚠️ فشل سحب الرابط: ${url}`);
        return null; 
    }
}

// --- 2. وظيفة الذكاء الاصطناعي (SEO Expert) ---
async function generateSmartContent(article) {
    const prompt = `
    You are an Expert SEO Content Writer. Rewrite the following text into a highly engaging, AdSense-friendly article.
    
    CRITICAL RULES (FOLLOW STRICTLY):
    1. Output ONLY pure HTML. Do NOT use markdown or backticks.
    2. Start with an <h1> tag containing a viral, click-worthy title.
    3. Write a strong Introduction (4-5 sentences) and naturally include the main topic keyword.
    4. Structure the body perfectly using <h2> and <h3> tags.
    5. Write short, easy-to-read paragraphs (Max 3 lines per <p> tag).
    6. Use Bullet Points (<ul><li>) and numbered lists where applicable.
    7. Include a "Frequently Asked Questions" (<h2>FAQ</h2>) section at the bottom.
    8. Length: Be very detailed and informative. Aim for a long-form article (800-1200 words).
    9. Language: English. Tone: Professional and exciting.

    Original Title: "${article.title}"
    Content to rewrite: ${article.text}
    `;

    try {
        console.log("🧠 جاري صياغة المحتوى باستخدام Llama-3.3 (الأحدث)...");
        const completion = await groq.chat.completions.create({
            messages: [{ role: "system", content: prompt }],
            model: "llama-3.3-70b-versatile", // الموديل الجديد المعتمد
            temperature: 0.6 
        });
        return completion.choices[0].message.content;
    } catch (e) { 
        console.error("❌ خطأ AI:", e.message);
        return null; 
    }
}

// --- 3. المحرك الرئيسي للنظام ---
async function startEmpireBot() {
    console.log("🚀 Starting the SEO Empire Bot 2026...");
    
    // اختيار مصدر عشوائي
    const source = SOURCES[Math.floor(Math.random() * SOURCES.length)];
    console.log(`📂 المصدر المختار اليوم: ${source.name}`);

    try {
        const feed = await parser.parseURL(source.url);
        const items = feed.items.sort(() => 0.5 - Math.random()).slice(0, 7);

        for (let item of items) {
            console.log(`\n📡 فحص الخبر: ${item.title}`);
            const data = await getArticleData(item.link);
            
            if (!data || data.text.length < 500) {
                console.log("⏭️ محتوى غير كافٍ، جاري الانتقال للخبر التالي...");
                continue;
            }

            const aiRawHtml = await generateSmartContent(data);
            if (!aiRawHtml) continue;

            // استخراج العنوان الذي ألفه الـ AI
            let viralTitle = data.title;
            const h1Match = aiRawHtml.match(/<h1>(.*?)<\/h1>/i);
            if (h1Match) viralTitle = h1Match[1].replace(/<[^>]+>/g, '');

            const cleanAiBody = aiRawHtml.replace(/<h1>.*?<\/h1>/i, '');
            const coverImg = data.images[0] || "https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&q=80";

            // تصميم المقال الاحترافي (تجاوب موبايل + شكل مودرن)
            const htmlBody = `
            <div class="main-container" dir="ltr">
                <style>
                    .main-container { font-family: 'Helvetica Neue', Arial, sans-serif; color: #333; line-height: 1.8; max-width: 800px; margin: 0 auto; }
                    .hero-section { position: relative; border-radius: 20px; overflow: hidden; margin-bottom: 35px; box-shadow: 0 10px 30px rgba(0,0,0,0.15); }
                    .hero-section img { width: 100%; height: 450px; object-fit: cover; display: block; }
                    .hero-overlay { position: absolute; bottom: 0; background: linear-gradient(transparent, rgba(0,0,0,0.9)); width: 100%; padding: 40px 20px 20px; color: white; }
                    .badge { background: #ff4757; color: white; padding: 5px 12px; border-radius: 5px; font-size: 12px; font-weight: bold; text-transform: uppercase; margin-bottom: 10px; display: inline-block; }
                    
                    .article-body h2 { color: #2f3542; font-size: 28px; border-left: 6px solid #ff4757; padding-left: 15px; margin-top: 45px; }
                    .article-body h3 { color: #57606f; font-size: 22px; margin-top: 30px; }
                    .article-body p { margin-bottom: 25px; font-size: 19px; color: #444; }
                    .article-body ul { background: #f1f2f6; padding: 25px 25px 25px 45px; border-radius: 12px; list-style-type: square; }
                    .article-body li { margin-bottom: 12px; }
                    
                    .faq-box { background: #ffffff; border: 2px solid #e1e1e1; padding: 20px; border-radius: 15px; margin-top: 40px; }
                    .source-link { display: block; text-align: center; margin-top: 40px; padding: 15px; background: #2f3542; color: white !important; text-decoration: none; border-radius: 10px; font-weight: bold; }
                </style>

                <div class="hero-section">
                    <img src="${coverImg}" alt="${viralTitle}">
                    <div class="hero-overlay">
                        <div class="badge">${source.label}</div>
                        <h1 style="margin:0; font-size: 28px;">${viralTitle}</h1>
                    </div>
                </div>

                <div class="article-body">
                    ${cleanAiBody}
                </div>

                <a href="${data.link}" class="source-link" target="_blank" rel="nofollow">Read Full Research on Original Source ↗</a>
            </div>
            `;

            // النشر إلى بلوجر
            const auth = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET);
            auth.setCredentials({ refresh_token: REFRESH_TOKEN });
            const blogger = google.blogger({ version: 'v3', auth });

            await blogger.posts.insert({
                blogId: BLOG_ID,
                requestBody: {
                    title: viralTitle,
                    content: htmlBody,
                    labels: [source.label, 'Trending', '2026 Tech']
                }
            });

            console.log(`✅ تم النشر بنجاح: ${viralTitle}`);
            break; // نكتفي بنشر مقال واحد بجودة سينمائية في كل دورة
        }
    } catch (err) {
        console.error("❌ فشل في جلب الـ RSS:", err.message);
    }
}

// تشغيل النظام
startEmpireBot();
