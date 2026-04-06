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

// --- وظائف معالجة الصور (إضافة علامة مائية نصية محسنة) ---
async function processImage(imageUrl, title) {
    try {
        // في الإنتاج، استخدم مكتبة مثل sharp لمعالجة الصور فعلياً
        // هنا نعيد نفس الرابط مع إضافة نص للعلامة المائية
        return imageUrl;
    } catch (e) {
        return imageUrl;
    }
}

// --- جلب بيانات المقال مع صور إضافية ---
async function getArticleData(url) {
    try {
        const res = await axios.get(url, { timeout: 10000 });
        const dom = new JSDOM(res.data, { url });
        const reader = new Readability(dom.window.document);
        const article = reader.parse();
        if (!article) return null;

        const $ = cheerio.load(res.data);
        let images = [];
        
        // جلب أول 3 صور عالية الجودة
        $('img').each((i, el) => {
            let src = $(el).attr('src') || $(el).attr('data-src');
            if (src && src.startsWith('http') && !src.includes('logo') && !src.includes('icon')) {
                if (images.length < 3) images.push(src);
            }
        });

        // صورة احتياطية
        if (images.length === 0) {
            images = ["https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=800"];
        }

        return { 
            title: article.title, 
            text: article.textContent.trim().slice(0, 5000), // زيادة الطول
            images, 
            link: url 
        };
    } catch (e) { 
        console.error("Error fetching article:", e.message);
        return null; 
    }
}

// --- إنشاء محتوى متوافق مع SEO و AdSense (التحسين الأهم) ---
async function generateSEOFriendlyContent(sourceInfo, article) {
    const prompt = `
    You are an expert SEO content writer. Create a COMPLETE, READY-TO-PUBLISH blog post based on this article: "${article.title}"

    ⚠️ CRITICAL RULES FOR GOOGLE SEARCH & ADSENSE:

    1. **TITLE (H1)**: Create a click-worthy, keyword-rich title (60 characters max)
       Example: "Best Android Apps 2026: Top 10 Free Tools You Need"

    2. **INTRODUCTION** (3-5 short sentences): Hook the reader, include main keyword naturally

    3. **SUBHEADINGS (H2 & H3)**: Use at least 4 H2 subheadings. Example:
       - H2: What is [Topic]?
       - H2: Top 5 Features You'll Love
       - H2: Step-by-Step Guide (with H3 for each step)
       - H2: Pros & Cons Table
       - H2: Common Problems & Solutions

    4. **SHORT PARAGRAPHS**: Maximum 3 lines per paragraph. Add line breaks between.

    5. **BULLET POINTS & LISTS**: Use • or 1. 2. 3. for easy reading

    6. **KEYWORD PLACEMENT**: Put main keyword in:
       - First 100 words
       - At least one H2
       - Naturally throughout (2-3% density, no stuffing)

    7. **FAQ SECTION** (MANDATORY for Rich Snippets):
       Create 3-5 questions with answers using this exact format:
       <div itemscope itemtype="https://schema.org/FAQPage">
         <div itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
           <h3 itemprop="name">Question 1?</h3>
           <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer">
             <div itemprop="text">Answer here...</div>
           </div>
         </div>
       </div>

    8. **CONCLUSION**: Summarize key points + call-to-action (e.g., "Try this today!")

    9. **INTERNAL LINKS**: Add 2-3 placeholders like:
       <a href="/category/apps">Check our best apps guide</a>

    10. **AFFILIATE DISCLOSURE**: Add a small disclaimer if recommending products

    11. **READING TIME**: Add "📖 5 min read" at top

    12. **LANGUAGE**: English, energetic but professional, Grade 8 reading level

    Source content to rewrite (DO NOT COPY VERBATIM):
    ${article.text.substring(0, 3500)}

    Output ONLY valid HTML without markdown code blocks.
    `;

    try {
        const completion = await groq.chat.completions.create({
            messages: [{ role: "system", content: prompt }],
            model: "llama3-8b-8192",
            temperature: 0.6, // أقل من 0.7 للإتقان
            max_tokens: 4000
        });
        return completion.choices[0].message.content;
    } catch (e) { 
        console.error("AI Generation failed:", e.message);
        return `<p>${article.text.substring(0, 2000)}</p>`;
    }
}

// --- المحرك الرئيسي المُحسّن ---
async function startEmpireBot() {
    console.log("🚀 Starting SEO & AdSense Optimized Bot...");
    
    const source = SOURCES[Math.floor(Math.random() * SOURCES.length)];
    console.log(`📡 Source: ${source.name} | ${source.url}`);
    
    try {
        const feed = await parser.parseURL(source.url);
        const items = feed.items.slice(0, 8); // فحص أكثر

        for (let item of items) {
            console.log(`🔍 Checking: ${item.title}`);
            const data = await getArticleData(item.link);
            
            if (!data || data.text.length < 600) {
                console.log("❌ Skipped: Too short or no content");
                continue;
            }

            console.log(`🤖 Generating SEO content (800-1500 words)...`);
            const aiContent = await generateSEOFriendlyContent(source, data);
            
            // معالجة الصور
            const coverImage = data.images[0];
            const secondImage = data.images[1] || "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=600";
            const thirdImage = data.images[2] || "https://images.unsplash.com/photo-1555774698-0b77e0d5fac6?w=600";

            // HTML متوافق مع SEO وموبايل فاست
            const htmlBody = `
            <!DOCTYPE html>
            <html dir="ltr">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <meta name="description" content="${data.title.substring(0, 150)}">
            </head>
            <body style="font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a1a; line-height: 1.6; max-width: 750px; margin: 0 auto; padding: 20px; background: #fff;">
                
                <!-- H1 العنوان الرئيسي -->
                <h1 style="font-size: 28px; margin-bottom: 10px; color: #000;">${data.title}</h1>
                
                <!-- معلومات المقال -->
                <div style="color: #666; font-size: 14px; margin-bottom: 20px; border-bottom: 1px solid #eee; padding-bottom: 10px;">
                    📖 8 min read • 🔥 Updated: ${new Date().toLocaleDateString()} • 👁️ 1.2k views
                </div>
                
                <!-- الصورة الرئيسية مع Alt Text محسن -->
                <div style="margin: 25px 0; text-align: center;">
                    <img src="${coverImage}" alt="${data.title}" style="width: 100%; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);" loading="lazy"/>
                    <div style="font-size: 12px; color: #888; margin-top: 8px;">Image credit: Official source</div>
                </div>
                
                <!-- المحتوى الرئيسي -->
                <div style="font-size: 17px;">
                    ${aiContent}
                </div>
                
                <!-- صورة إضافية في المنتصف -->
                <div style="margin: 30px 0; text-align: center;">
                    <img src="${secondImage}" alt="Related screenshot" style="width: 100%; border-radius: 12px;" loading="lazy"/>
                </div>
                
                <!-- روابط داخلية -->
                <div style="background: #f0f7ff; padding: 20px; border-radius: 12px; margin: 30px 0;">
                    <strong>📌 You might also like:</strong>
                    <ul style="margin-top: 10px;">
                        <li><a href="/search/label/Apps" style="color: #0066cc;">Best Apps of 2026 →</a></li>
                        <li><a href="/search/label/Tutorials" style="color: #0066cc;">Step-by-Step Tech Guides →</a></li>
                    </ul>
                </div>
                
                <!-- صورة ثالثة -->
                <div style="margin: 30px 0; text-align: center;">
                    <img src="${thirdImage}" alt="Additional preview" style="width: 100%; border-radius: 12px;" loading="lazy"/>
                </div>
                
                <!-- خاتمة مع دعوة للنقر -->
                <div style="background: #f9f9f9; padding: 25px; border-radius: 12px; margin: 30px 0; text-align: center;">
                    <p style="margin: 0 0 15px 0;"><strong>💡 Ready to level up?</strong></p>
                    <p style="margin: 0;">Try these tips today and share your experience in the comments below!</p>
                </div>
                
                <!-- رابط المصدر الأصلي -->
                <div style="font-size: 12px; color: #999; text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee;">
                    Source: <a href="${data.link}" style="color: #999;" rel="nofollow">Original Article</a>
                </div>
                
            </body>
            </html>
            `;

            // --- النشر إلى Blogger ---
            const auth = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET);
            auth.setCredentials({ refresh_token: REFRESH_TOKEN });
            const blogger = google.blogger({ version: 'v3', auth });

            const publishResult = await blogger.posts.insert({
                blogId: BLOG_ID,
                requestBody: {
                    title: data.title,
                    content: htmlBody,
                    labels: [source.label, 'SEO Optimized', 'AdSense Ready', '2026']
                }
            });

            console.log(`✅ PUBLISHED SUCCESSFULLY: ${data.title}`);
            console.log(`🔗 Post URL: ${publishResult.data.url}`);
            break; // نشر مقال واحد ممتاز لكل دورة
            
        } // end for
    } catch (error) {
        console.error("❌ Bot Error:", error.message);
    }
}

// تشغيل البوت
startEmpireBot();
