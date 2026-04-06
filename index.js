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

// --- المصادر الذكية ---
const SOURCES = [
    { name: "Google Help", url: "https://news.google.com/rss/search?q=site:support.google.com+android+OR+windows&hl=en-US", label: "Troubleshooting" },
    { name: "Android", url: "https://www.androidpolice.com/feed/", label: "Android" },
    { name: "Make Money", url: "https://www.savethestudent.org/make-money/feed", label: "Make Money" }
];

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

        // نأخذ نص كافي لإنتاج مقال طويل
        return { originalTitle: article.title, text: article.textContent.trim().slice(0, 8000), images, link: url };
    } catch (e) { return null; }
}

async function generateSmartContent(article) {
    const prompt = `
    You are an elite SEO Expert and Copywriter. Your goal is to write a highly ranking, Google AdSense-friendly article.
    
    Task: Rewrite the following content completely and output EXACTLY a JSON object with two keys: "title" and "content".
    
    Rules for "title" (H1):
    - Must be a viral, click-worthy Arabic title.
    - Include strong keywords and end with words like "2026", "(شرح كامل)", or "(خطوة بخطوة)".
    
    Rules for "content" (HTML Format):
    - Language: Fluent Arabic (Translate the source naturally).
    - Length: Expand the ideas to be between 800 - 1500 words. Do not write a short article.
    - Structure: 
      1. Start with a 3-4 line engaging Introduction.
      2. Use <h2> for main subheadings and <h3> for smaller points.
      3. Use VERY short paragraphs (maximum 2-3 lines per paragraph) for mobile readability.
      4. Use bullet points <ul><li> or numbered lists wherever possible.
      5. Include an <h2> الأسئلة الشائعة (FAQ) section at the end with 2-3 questions and answers.
      6. End with a short <h2> الخلاصة (Conclusion).
    - Links: Insert this exact placeholder <a href="#">[رابط مقال ذو صلة هنا]</a> twice naturally in the text.
    - DO NOT include markdown formatting like \`\`\`json or \`\`\`html in your response. Just the raw JSON object.
    
    Source Content to Rewrite:
    ${article.text}
    `;

    try {
        const completion = await groq.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model: "llama3-8b-8192",
            temperature: 0.7,
            response_format: { type: "json_object" } // إجبار الذكاء الاصطناعي على إخراج JSON
        });
        
        // تحويل النص المسترجع إلى كائن برمجي (Object)
        return JSON.parse(completion.choices[0].message.content);
    } catch (e) { 
        console.log("⚠️ AI Generation Error", e.message);
        return null; 
    }
}

// --- المحرك الرئيسي ---
async function startEmpireBot() {
    console.log("🚀 Starting the SEO Master Bot...");
    const publishedUrls = await loadPublishedUrls();

    for (const source of SOURCES) {
        console.log(`\n📡 Checking Source: ${source.name} ...`);
        
        try {
            const feed = await parser.parseURL(source.url);
            const items = feed.items.slice(0, 5);

            for (let item of items) {
                if (publishedUrls.includes(item.link)) continue; 

                console.log(`⏳ Scraping: ${item.title}`);
                const data = await getArticleData(item.link);
                
                if (!data || data.text.length < 1000) {
                    console.log("⏭️ Article too short, skipping to avoid low value content.");
                    continue;
                }

                console.log("🧠 Generating SEO Article via AI...");
                const aiData = await generateSmartContent(data);
                
                if (!aiData || !aiData.title || !aiData.content) continue;

                // اختيار صورة وتجهيزها بـ alt tag متوافق مع SEO
                const coverImg = data.images[0] || "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=800";
                
                // القالب: متوافق 100% مع الموبايل، خطوط مقروءة، ومسافات ممتازة
                const htmlBody = `
                <div dir="rtl" style="font-family: 'Tajawal', 'Segoe UI', Tahoma, sans-serif; color: #333; line-height: 1.9; font-size: 17px; max-width: 800px; margin: auto; padding: 15px;">
                    
                    <div style="margin-bottom: 25px; text-align: center;">
                        <img src="${coverImg}" alt="${aiData.title}" style="width: 100%; height: auto; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.1);"/>
                    </div>
                    
                    <div class="article-content" style="text-align: right;">
                        ${aiData.content}
                    </div>
                    
                    <div style="background-color: #f8f9fa; border-right: 5px solid #0056b3; padding: 20px; margin-top: 40px; border-radius: 8px;">
                        <h3 style="margin-top: 0; color: #0056b3;">💡 شاركنا رأيك!</h3>
                        <p style="margin-bottom: 0;">هل جربت هذه الطرق من قبل؟ اترك لنا تعليقاً بالأسفل لنعرف رأيك، ولا تنسَ تصفح باقي مقالاتنا التقنية.</p>
                    </div>

                    <div style="text-align: center; margin-top: 30px; font-size: 14px;">
                        <a href="${data.link}" target="_blank" rel="nofollow" style="color: #6c757d; text-decoration: none;">المصدر الأصلي ↗</a>
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
                        title: aiData.title, // العنوان الفيروسي الذي ولده الذكاء الاصطناعي!
                        content: htmlBody,
                        labels: [source.label, 'حصري', 'شروحات 2026']
                    }
                });

                console.log(`✅ SUCCESS! Published: ${aiData.title}`);
                await savePublishedUrl(item.link);
                break; // مقال واحد من كل مصدر
            }
            
            // فاصل زمني 5 ثواني فقط للتجربة (يمكنك زيادته لاحقاً)
            await new Promise(res => setTimeout(res, 5000)); 

        } catch (err) {
            console.log(`❌ Error in ${source.name}:`, err.message);
        }
    }
    console.log("🎉 All done!");
}

startEmpireBot();
