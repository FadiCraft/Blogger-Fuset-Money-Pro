const Parser = require('rss-parser');
const axios = require('axios');
const { JSDOM } = require('jsdom');
const { Readability } = require('@mozilla/readability');
const cheerio = require('cheerio');
const { google } = require('googleapis');
const Groq = require('groq-sdk');

// ==========================================
// إعداداتك الخاصة
// ==========================================
const BLOG_ID = "2636919176960128451"; // رقم مدونتك الجديد
const CLIENT_ID = "872415365656-7qribadnc7k2u21kl6jjcbatdueevifh.apps.googleusercontent.com";
const CLIENT_SECRET = "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";
const REFRESH_TOKEN = "1//04yti9k2agPknCgYIARAAGAQSNwF-L9IrTZPKt5Fqbg2vrM9sBtOks9cnY4M7Idg0LToQnlbYGME06k20vcyr_SVmYk1H_yZJdEc";
const GROQ_API_KEY = "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";

const groq = new Groq({ apiKey: GROQ_API_KEY });
const parser = new Parser();

// رابط أخبار جوجل (هنا اخترنا أخبار التكنولوجيا العالمية - يمكنك تغييره)
const GOOGLE_NEWS_RSS = 'https://news.google.com/rss/search?q=Technology+when:1d&hl=en-US&gl=US&ceid=US:en';

// ==========================================
// 1. دالة سحب المقال والصور باحترافية (وضع القراءة)
// ==========================================
async function scrapeArticle(url) {
    try {
        // جلب الصفحة (مع تتبع التحويلات لأن روابط جوجل نيوز تتحول للموقع الأصلي)
        const response = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
            maxRedirects: 5
        });

        const dom = new JSDOM(response.data, { url: response.request.res.responseUrl });
        const reader = new Readability(dom.window.document);
        const article = reader.parse();

        if (!article) return null;

        // استخراج جميع الصور من المقال الأصلي
        const $ = cheerio.load(article.content);
        const images = [];
        $('img').each((i, el) => {
            let src = $(el).attr('src') || $(el).attr('data-src');
            if (src && src.startsWith('http') && !src.includes('icon') && !src.includes('logo')) {
                images.push(src);
            }
        });

        return {
            title: article.title,
            rawText: article.textContent.trim().slice(0, 4500), // النص النقي للـ AI
            images: [...new Set(images)], // صور بدون تكرار
            originalLink: response.request.res.responseUrl
        };
    } catch (error) {
        console.error("❌ فشل سحب المقال:", error.message);
        return null;
    }
}

// ==========================================
// 2. دالة إعادة الصياغة باستخدام الذكاء الاصطناعي
// ==========================================
async function formatWithAI(title, text) {
    try {
        console.log("🤖 جاري صياغة المقال بأسلوب صحفي...");
        const completion = await groq.chat.completions.create({
            messages: [
                { 
                    role: "system", 
                    content: "You are a senior tech journalist. Rewrite the provided text to be a highly engaging, unique news article. Structure it clearly using <h2> for subtitles and <p> for paragraphs. DO NOT include images or code blocks. Make it sound professional and exciting. Language: English." 
                },
                { role: "user", content: `Title: ${title}\n\nContent: ${text}` }
            ],
            model: "llama3-8b-8192",
            temperature: 0.7,
        });
        return completion.choices[0]?.message?.content || text;
    } catch (error) {
        console.error("❌ فشل الذكاء الاصطناعي:", error.message);
        return text;
    }
}

// ==========================================
// 3. المحرك الرئيسي (تصميم خيالي + النشر)
// ==========================================
async function runGoogleNewsBot() {
    try {
        console.log("🚀 جاري البحث في أخبار جوجل تريندز...");
        const feed = await parser.parseURL(GOOGLE_NEWS_RSS);
        
        // نأخذ خبر عشوائي من أول 10 أخبار تريند
        const topArticles = feed.items.slice(0, 10);
        const selectedNews = topArticles[Math.floor(Math.random() * topArticles.length)];

        console.log(`📡 سحب الخبر: ${selectedNews.title}`);

        const articleData = await scrapeArticle(selectedNews.link);
        if (!articleData || articleData.rawText.length < 500) {
            console.log("⏭️ محتوى ضعيف أو لم نتمكن من سحبه، سيتم المحاولة لاحقاً.");
            return;
        }

        const finalContent = await formatWithAI(articleData.title, articleData.rawText);

        // --- بناء التصميم الخيالي والحديث للمقال ---
        // استخدام الصور التي تم سحبها (الصورة الأولى كغلاف، والباقي موزع)
        const coverImage = articleData.images.length > 0 ? articleData.images[0] : 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&q=80';
        
        // تجهيز معرض صور مصغر لباقي الصور إن وجدت
        let galleryHtml = "";
        if (articleData.images.length > 1) {
            galleryHtml = `<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-top: 30px;">`;
            for (let i = 1; i < Math.min(articleData.images.length, 4); i++) {
                galleryHtml += `<img src="${articleData.images[i]}" style="width: 100%; height: 150px; object-fit: cover; border-radius: 12px; box-shadow: 0 4px 10px rgba(0,0,0,0.1); transition: transform 0.3s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'"/>`;
            }
            galleryHtml += `</div>`;
        }

        // كود HTML/CSS الحديث والاحترافي
        const beautifulPostHtml = `
            <div dir="ltr" style="background-color: #ffffff; padding: 30px; border-radius: 24px; box-shadow: 0 10px 40px rgba(0,0,0,0.08); font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; max-width: 800px; margin: 0 auto; color: #2d3748; overflow: hidden;">
                
                <div style="position: relative; margin-bottom: 30px; border-radius: 16px; overflow: hidden; box-shadow: 0 8px 25px rgba(0,0,0,0.15);">
                    <img src="${coverImage}" style="width: 100%; max-height: 450px; object-fit: cover; display: block;" alt="Article Cover"/>
                    <div style="position: absolute; bottom: 15px; left: 15px; background: rgba(0,0,0,0.7); color: #fff; padding: 5px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; backdrop-filter: blur(5px);">
                        🔥 TRENDING NOW
                    </div>
                </div>

                <div style="line-height: 1.85; font-size: 1.1rem;">
                    <style>
                        h2 { color: #1a202c; font-size: 1.6rem; font-weight: 800; border-left: 5px solid #3b82f6; padding-left: 15px; margin-top: 40px; margin-bottom: 20px; }
                        p { margin-bottom: 25px; color: #4a5568; }
                        p:first-of-type { font-size: 1.25rem; font-weight: 500; color: #2d3748; letter-spacing: -0.01em; }
                    </style>
                    ${finalContent}
                </div>

                ${galleryHtml}

                <div style="margin-top: 50px; padding-top: 20px; border-top: 2px dashed #e2e8f0; display: flex; justify-content: space-between; align-items: center; font-size: 0.9rem; color: #718096;">
                    <span>🤖 Authored & Curated by AI</span>
                    <a href="${articleData.originalLink}" target="_blank" style="color: #3b82f6; text-decoration: none; font-weight: 600; padding: 8px 16px; background: #ebf8ff; border-radius: 20px; transition: all 0.3s;">Read Original Source ↗</a>
                </div>
            </div>
        `;

        // ==========================================
        // 4. النشر على بلوجر
        // ==========================================
        const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET);
        oauth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });
        const blogger = google.blogger({ version: 'v3', auth: oauth2Client });

        await blogger.posts.insert({
            blogId: BLOG_ID,
            requestBody: {
                title: articleData.title,
                content: beautifulPostHtml,
                labels: ['Google News', 'Trending', 'Tech Update']
            },
            isDraft: false
        });

        console.log("✅ تم النشر بنجاح! اذهب لتفقد مدونتك لترى التصميم الخيالي.");

    } catch (error) {
        console.error("❌ خطأ فادح:", error.message);
    }
}

runGoogleNewsBot();
