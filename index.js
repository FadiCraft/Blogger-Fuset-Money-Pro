const Parser = require('rss-parser');
const axios = require('axios');
const { JSDOM } = require('jsdom');
const { Readability } = require('@mozilla/readability');
const cheerio = require('cheerio');
const { google } = require('googleapis');
const Groq = require('groq-sdk');

// --- الإعدادات ---
const BLOG_ID = "2636919176960128451";
const CLIENT_ID = "872415365656-7qribadnc7k2u21kl6jjcbatdueevifh.apps.googleusercontent.com";
const CLIENT_SECRET = "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";
const REFRESH_TOKEN = "1//04yti9k2agPknCgYIARAAGAQSNwF-L9IrTZPKt5Fqbg2vrM9sBtOks9cnY4M7Idg0LToQnlbYGME06k20vcyr_SVmYk1H_yZJdEc";
const GROQ_API_KEY = "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";

const groq = new Groq({ apiKey: GROQ_API_KEY });
const parser = new Parser();

// --- المصادر الذكية ---
const SOURCES = [
    { name: "Gaming", url: "https://www.windowscentral.com/gaming/rss.xml", label: "Gaming" },
    { name: "Android", url: "https://www.androidpolice.com/feed/", label: "Android" },
    { name: "Make Money", url: "https://www.savethestudent.org/make-money/feed", label: "Make Money" },
    { name: "Reviews", url: "https://9to5google.com/feed/", label: "Reviews" },
    { name: "Tech News", url: "https://www.geeky-gadgets.com/feed/", label: "Tech" },
    { name: "AdTech", url: "https://www.exchangewire.com/feed/", label: "Business" },
    { name: "Google Help", url: "https://news.google.com/rss/search?q=how+to+fix+android+app+problem&hl=en-US", label: "Troubleshooting" }
];

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

        // نأخذ نص أكبر ليعطي الذكاء الاصطناعي تفاصيل كافية لكتابة مقال طويل
        return { title: article.title, text: article.textContent.trim().slice(0, 6000), images, link: url };
    } catch (e) { return null; }
}

async function generateSmartContent(article) {
    // برومبت الـ SEO الخارق (مصمم لتلبية شروطك الـ 10 بالحرف)
    const prompt = `
    You are an Expert SEO Content Writer. Rewrite the following text into a highly engaging, AdSense-friendly article.
    
    CRITICAL RULES (FOLLOW STRICTLY):
    1. Output ONLY pure HTML. Do NOT use markdown.
    2. Start with an <h1> tag containing a viral, click-worthy title (e.g., "Best [Topic] in 2026 (Full Guide)").
    3. Write a strong Introduction (3-4 sentences) and naturally include the main topic keyword.
    4. Structure the body perfectly using <h2> and <h3> tags.
    5. Write short, easy-to-read paragraphs (Max 3-4 lines per <p> tag).
    6. Use Bullet Points (<ul><li>) where applicable to make it scannable.
    7. Include a "Frequently Asked Questions" (<h2>FAQ</h2>) section at the bottom with 2-3 common questions and answers.
    8. Include a short "Conclusion" at the end.
    9. Length: Expand on details to make the article informative, comprehensive, and valuable (aim for 800+ words). Do NOT summarize.
    10. Tone: Professional, high-energy, and helpful. Language: English.

    Original Title: "${article.title}"
    Content to rewrite: ${article.text}
    `;

    try {
        console.log("🧠 جاري كتابة المقال وفقاً لشروط الـ SEO...");
        const completion = await groq.chat.completions.create({
            messages: [{ role: "system", content: prompt }],
            model: "llama3-8b-8192",
            temperature: 0.6 // تقليل الحرارة قليلاً لضمان عدم تخريب أكواد الـ HTML
        });
        return completion.choices[0].message.content;
    } catch (e) { 
        console.error("❌ خطأ في الذكاء الاصطناعي:", e.message);
        return null; 
    }
}

// --- المحرك الرئيسي ---
async function startEmpireBot() {
    console.log("🚀 Starting the Multi-Niche Empire Bot (SEO Optimized)...");
    
    const source = SOURCES[Math.floor(Math.random() * SOURCES.length)];
    const feed = await parser.parseURL(source.url);
    // خلط المقالات لضمان عدم التكرار
    const items = feed.items.sort(() => 0.5 - Math.random()).slice(0, 5);

    for (let item of items) {
        console.log(`📡 Checking: ${item.title}`);
        const data = await getArticleData(item.link);
        
        if (!data || data.text.length < 500) continue;

        const aiRawHtml = await generateSmartContent(data);
        if (!aiRawHtml) continue;

        // 1. استخراج العنوان الجذاب (H1) الذي ألفه الذكاء الاصطناعي
        let viralTitle = data.title; // العنوان الافتراضي
        const h1Match = aiRawHtml.match(/<h1>(.*?)<\/h1>/i);
        if (h1Match) {
            viralTitle = h1Match[1].replace(/<[^>]+>/g, ''); // تنظيف من أي أكواد فرعية
        }

        // 2. تنظيف المقال من وسم H1 (لأن بلوجر يضع العنوان في الأعلى تلقائياً)
        const cleanAiBody = aiRawHtml.replace(/<h1>.*?<\/h1>/i, '');

        // 3. الصورة الاحترافية: وضع العنوان الجذاب على الصورة بنظام CSS Overlay
        const coverImg = data.images[0] || "https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&q=80";
        
        const htmlBody = `
        <div class="seo-article" dir="ltr">
            <style>
                .seo-article { font-family: 'Segoe UI', Arial, sans-serif; color: #202124; line-height: 1.85; font-size: 18px; max-width: 800px; margin: 0 auto; }
                
                /* تنسيق الصورة الرئيسية مع العنوان فوقها */
                .hero-image-box { position: relative; margin-bottom: 40px; border-radius: 16px; overflow: hidden; box-shadow: 0 8px 24px rgba(0,0,0,0.12); }
                .hero-image-box img { width: 100%; max-height: 450px; object-fit: cover; display: block; }
                .hero-title-overlay { position: absolute; bottom: 0; left: 0; right: 0; background: linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.4) 60%, transparent 100%); padding: 30px 20px 15px 20px; color: #fff; }
                .hero-title-overlay span { display: inline-block; background: #1a73e8; color: #fff; padding: 4px 10px; border-radius: 4px; font-size: 12px; font-weight: bold; margin-bottom: 8px; text-transform: uppercase; }
                .hero-title-overlay h2 { margin: 0; font-size: 24px; color: #fff; border: none; padding: 0; line-height: 1.4; }

                /* تنسيقات الـ SEO لتجربة القارئ */
                .seo-article h2 { color: #1a73e8; font-size: 26px; border-bottom: 2px solid #e8eaed; padding-bottom: 8px; margin-top: 40px; margin-bottom: 20px; }
                .seo-article h3 { color: #3c4043; font-size: 22px; margin-top: 30px; margin-bottom: 15px; }
                .seo-article p { margin-bottom: 22px; color: #3c4043; }
                .seo-article ul { background: #f8f9fa; padding: 20px 20px 20px 40px; border-radius: 8px; margin-bottom: 25px; }
                .seo-article li { margin-bottom: 10px; }
                
                /* صندوق نصيحة جذابة للمقالات */
                .pro-tip { background: #e8f0fe; border-left: 5px solid #1a73e8; padding: 15px 20px; margin: 30px 0; border-radius: 0 8px 8px 0; font-weight: 500; }
            </style>

            <div class="hero-image-box">
                <img src="${coverImg}" alt="${viralTitle}" />
                <div class="hero-title-overlay">
                    <span>${source.label} Guide</span>
                    <h2>${viralTitle}</h2>
                </div>
            </div>
            
            <div class="article-content">
                ${cleanAiBody}
            </div>
            
            <div class="pro-tip">
                💡 <strong>SEO & User Tip:</strong> Save this page to your bookmarks for future reference, and check the 
                <a href="${data.link}" target="_blank" rel="nofollow" style="color: #1a73e8; font-weight: bold;">Original Source Here</a> 
                for more detailed insights!
            </div>
        </div>
        `;

        // النشر عبر جوجل
        const auth = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET);
        auth.setCredentials({ refresh_token: REFRESH_TOKEN });
        const blogger = google.blogger({ version: 'v3', auth });

        await blogger.posts.insert({
            blogId: BLOG_ID,
            requestBody: {
                title: viralTitle, // نستخدم العنوان الجذاب بدلاً من العادي
                content: htmlBody,
                labels: [source.label, 'Exclusive', 'Tech Guides']
            }
        });

        console.log(`✅ Published Successfully! Title: ${viralTitle}`);
        break; // نشر مقال واحد احترافي في كل دورة
    }
}

startEmpireBot();
