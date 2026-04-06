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
const parser = new Parser({
    timeout: 10000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
});

// --- المصادر الذكية (كلها محدثة وتعمل) ---
const SOURCES = [
    { name: "TechCrunch", url: "https://techcrunch.com/feed/", label: "Tech News" },
    { name: "Wired", url: "https://www.wired.com/feed/rss", label: "Gadgets" },
    { name: "The Verge", url: "https://www.theverge.com/rss/index.xml", label: "Reviews" },
    { name: "Mashable", url: "https://mashable.com/feeds/rss/all", label: "Social Media" },
    { name: "Lifehacker", url: "https://lifehacker.com/rss", label: "Tips" },
    { name: "Make Money", url: "https://www.savethestudent.org/make-money/feed", label: "Make Money" },
    { name: "Google News Apps", url: "https://news.google.com/rss/search?q=best+android+apps+2026&hl=en-US&ceid=US:en", label: "Apps" },
    { name: "Google News Tech", url: "https://news.google.com/rss/search?q=technology&hl=en-US&ceid=US:en", label: "Technology" },
    { name: "CNET", url: "https://www.cnet.com/rss/news/", label: "Tech Reviews" },
    { name: "Digital Trends", url: "https://www.digitaltrends.com/feed/", label: "Gaming" }
];

// --- مقالات احتياطية في حال فشل كل المصادر ---
const BACKUP_ARTICLES = [
    {
        title: "Best Android Apps for Productivity in 2026",
        text: "Productivity apps have become essential for modern smartphone users. From task management to note-taking, here are the top 10 apps that will transform your Android experience. Microsoft Todo offers seamless integration with Office 365. Google Keep provides quick note capture. Notion brings powerful databases to mobile. Evernote remains the king of organization. Trello makes project management visual and easy. Asana helps teams coordinate effectively. Slack keeps communication flowing. Zoom enables video conferencing on the go. Spotify helps you focus with background music. Forest app uses gamification to reduce distractions.",
        link: "https://example.com/productivity-apps",
        images: [
            "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=800",
            "https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?w=600"
        ]
    },
    {
        title: "How to Make Money Online in 2026: Complete Guide",
        text: "Making money online has never been more accessible. Freelancing platforms like Upwork and Fiverr connect you with clients worldwide. Affiliate marketing through Amazon Associates or ShareASale can generate passive income. Creating and selling digital products such as eBooks, courses, or templates requires upfront work but pays repeatedly. YouTube monetization offers ad revenue for video creators. Print on demand services like Redbubble let you sell designs without inventory. Stock photography through Shutterstock provides royalties for your photos. Virtual assistant positions are in high demand. Online tutoring through VIPKid or Chegg pays well. Dropshipping with Shopify creates e-commerce opportunities. Cryptocurrency trading offers high risk but potential high reward.",
        link: "https://example.com/make-money",
        images: [
            "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800",
            "https://images.unsplash.com/photo-1563986768609-322da13575f3?w=600"
        ]
    },
    {
        title: "Top 10 Gaming Tips for Better Performance",
        text: "Gaming performance can be dramatically improved with these simple tips. Update your graphics drivers regularly for optimal compatibility. Close background applications to free up system resources. Adjust in-game graphics settings based on your hardware capabilities. Enable Game Mode in Windows 10/11 for prioritized processing. Use a wired internet connection instead of WiFi for lower latency. Overclock your GPU carefully using MSI Afterburner. Install games on an SSD for faster load times. Reduce your screen resolution for higher frame rates. Disable vertical sync to reduce input lag. Keep your PC clean from dust to prevent thermal throttling.",
        link: "https://example.com/gaming-tips",
        images: [
            "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800",
            "https://images.unsplash.com/photo-1511512578047-dfb367046420?w=600"
        ]
    }
];

// --- جلب بيانات المقال مع صور إضافية ---
async function getArticleData(url) {
    try {
        const res = await axios.get(url, { 
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        const dom = new JSDOM(res.data, { url });
        const reader = new Readability(dom.window.document);
        const article = reader.parse();
        if (!article) return null;

        const $ = cheerio.load(res.data);
        let images = [];
        
        // جلب أول 3 صور عالية الجودة
        $('img').each((i, el) => {
            let src = $(el).attr('src') || $(el).attr('data-src');
            if (src && src.startsWith('http') && !src.includes('logo') && !src.includes('icon') && !src.includes('avatar')) {
                if (images.length < 3) images.push(src);
            }
        });

        // صورة احتياطية من Unsplash
        if (images.length === 0) {
            images = [
                "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=800",
                "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=600",
                "https://images.unsplash.com/photo-1555774698-0b77e0d5fac6?w=600"
            ];
        }

        return { 
            title: article.title, 
            text: article.textContent.trim().slice(0, 5000),
            images, 
            link: url 
        };
    } catch (e) { 
        console.error(`Error fetching ${url}:`, e.message);
        return null; 
    }
}

// --- إنشاء محتوى متوافق مع SEO و AdSense ---
async function generateSEOFriendlyContent(sourceInfo, article) {
    const prompt = `
    You are an expert SEO content writer. Create a COMPLETE, READY-TO-PUBLISH blog post based on this article: "${article.title}"

    ⚠️ CRITICAL RULES FOR GOOGLE SEARCH & ADSENSE:

    1. **TITLE (H1)**: Keep the original title but make it more click-worthy

    2. **INTRODUCTION** (4-5 short sentences): Hook the reader, include main keyword naturally

    3. **SUBHEADINGS (H2)**: Use at least 4 H2 subheadings like:
       - What is [Topic]?
       - Key Features You Should Know
       - Step-by-Step Guide
       - Pros and Cons
       - Common Questions Answered

    4. **SHORT PARAGRAPHS**: Maximum 3 lines per paragraph

    5. **BULLET POINTS**: Use • for lists

    6. **FAQ SECTION** (MANDATORY):
       Create 3 questions with answers

    7. **CONCLUSION**: Summarize + call-to-action

    8. **LANGUAGE**: English, professional but easy to read

    Source content to base your article on:
    ${article.text.substring(0, 3000)}

    Output ONLY valid HTML.
    `;

    try {
        const completion = await groq.chat.completions.create({
            messages: [{ role: "system", content: prompt }],
            model: "llama3-8b-8192",
            temperature: 0.7,
            max_tokens: 3500
        });
        return completion.choices[0].message.content;
    } catch (e) { 
        console.error("AI Generation failed:", e.message);
        return `<p>${article.text.substring(0, 2000)}</p><h2>Summary</h2><p>${article.text.substring(2000, 3000)}</p>`;
    }
}

// --- المحرك الرئيسي مع معالجة الأخطاء المتقدمة ---
async function startEmpireBot() {
    console.log("🚀 Starting SEO & AdSense Optimized Bot...");
    console.log("📅 Date:", new Date().toLocaleString());
    
    // خلط المصادر عشوائياً
    const shuffledSources = [...SOURCES].sort(() => Math.random() - 0.5);
    
    for (const source of shuffledSources) {
        console.log(`\n📡 Trying source: ${source.name} | ${source.url}`);
        
        try {
            // اختبار المصدر أولاً
            const testResponse = await axios.head(source.url, { timeout: 8000 });
            if (testResponse.status !== 200) {
                console.log(`⚠️ Source ${source.name} returned status ${testResponse.status}, skipping...`);
                continue;
            }
            
            const feed = await parser.parseURL(source.url);
            if (!feed.items || feed.items.length === 0) {
                console.log(`⚠️ Source ${source.name} has no items, skipping...`);
                continue;
            }
            
            const items = feed.items.slice(0, 5);
            
            for (let item of items) {
                console.log(`🔍 Checking: ${item.title.substring(0, 60)}...`);
                const data = await getArticleData(item.link);
                
                if (!data || data.text.length < 500) {
                    console.log("❌ Skipped: Too short or no content");
                    continue;
                }
                
                console.log(`✅ Found good content (${data.text.length} chars)`);
                console.log(`🤖 Generating SEO content with AI...`);
                
                const aiContent = await generateSEOFriendlyContent(source, data);
                
                // استخدام الصور من المقال أو من الاحتياطي
                const coverImage = data.images[0] || BACKUP_ARTICLES[0].images[0];
                const secondImage = data.images[1] || BACKUP_ARTICLES[0].images[1] || "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=600";
                const thirdImage = data.images[2] || "https://images.unsplash.com/photo-1555774698-0b77e0d5fac6?w=600";
                
                // HTML متوافق مع SEO وموبايل
                const htmlBody = `
                <!DOCTYPE html>
                <html dir="ltr">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <meta name="description" content="${data.title.substring(0, 150)}">
                    <title>${data.title}</title>
                </head>
                <body style="font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a1a; line-height: 1.7; max-width: 800px; margin: 0 auto; padding: 20px; background: #fff;">
                    
                    <h1 style="font-size: 32px; margin-bottom: 15px; color: #000; line-height: 1.3;">${data.title}</h1>
                    
                    <div style="color: #666; font-size: 14px; margin-bottom: 25px; border-bottom: 2px solid #f0f0f0; padding-bottom: 15px;">
                        📖 ${Math.floor(data.text.length / 300) + 3} min read • 🔥 Updated: ${new Date().toLocaleDateString()}
                    </div>
                    
                    <div style="margin: 25px 0; text-align: center;">
                        <img src="${coverImage}" alt="${data.title}" style="width: 100%; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);" loading="lazy"/>
                        <div style="font-size: 12px; color: #888; margin-top: 8px;">📸 Image credit: Official source</div>
                    </div>
                    
                    <div style="font-size: 17px;">
                        ${aiContent}
                    </div>
                    
                    <div style="margin: 35px 0; text-align: center;">
                        <img src="${secondImage}" alt="Related content" style="width: 100%; border-radius: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);" loading="lazy"/>
                    </div>
                    
                    <div style="background: #f0f7ff; padding: 25px; border-radius: 16px; margin: 35px 0;">
                        <strong>📌 Related Articles You Might Like:</strong>
                        <ul style="margin-top: 12px;">
                            <li><a href="/search/label/Apps" style="color: #0066cc; text-decoration: none;">Best Apps of 2026 →</a></li>
                            <li><a href="/search/label/Tutorials" style="color: #0066cc; text-decoration: none;">Step-by-Step Guides →</a></li>
                            <li><a href="/search/label/Reviews" style="color: #0066cc; text-decoration: none;">Honest Product Reviews →</a></li>
                        </ul>
                    </div>
                    
                    <div style="margin: 35px 0; text-align: center;">
                        <img src="${thirdImage}" alt="Additional preview" style="width: 100%; border-radius: 16px;" loading="lazy"/>
                    </div>
                    
                    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 16px; margin: 35px 0; text-align: center;">
                        <p style="margin: 0 0 10px 0; font-size: 20px;"><strong>💡 Enjoyed This Article?</strong></p>
                        <p style="margin: 0;">Share it with friends and check back daily for more tech tips!</p>
                    </div>
                    
                    <div style="font-size: 12px; color: #999; text-align: center; margin-top: 50px; padding-top: 20px; border-top: 1px solid #eee;">
                        Source: <a href="${data.link}" style="color: #999;" rel="nofollow noopener" target="_blank">Original Article</a>
                    </div>
                    
                </body>
                </html>
                `;
                
                // النشر إلى Blogger
                const auth = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET);
                auth.setCredentials({ refresh_token: REFRESH_TOKEN });
                const blogger = google.blogger({ version: 'v3', auth });
                
                const publishResult = await blogger.posts.insert({
                    blogId: BLOG_ID,
                    requestBody: {
                        title: data.title,
                        content: htmlBody,
                        labels: [source.label, 'SEO Optimized', 'AdSense Ready', new Date().getFullYear().toString()]
                    }
                });
                
                console.log(`\n✅✅✅ PUBLISHED SUCCESSFULLY! ✅✅✅`);
                console.log(`📝 Title: ${data.title}`);
                console.log(`🔗 URL: ${publishResult.data.url}`);
                console.log(`🏷️ Labels: ${source.label}, SEO Optimized, AdSense Ready`);
                console.log(`\n🎉 Job completed! Check your blog now.`);
                return; // Exit after successful publish
                
            } // end for items
            
        } catch (error) {
            console.log(`❌ Source ${source.name} failed:`, error.message);
            continue; // Try next source
        }
    }
    
    // إذا فشلت كل المصادر، استخدم المقالات الاحتياطية
    console.log("\n⚠️ All RSS sources failed. Using backup articles...");
    
    for (const backup of BACKUP_ARTICLES) {
        console.log(`📝 Publishing backup article: ${backup.title}`);
        
        const htmlBody = `
        <!DOCTYPE html>
        <html>
        <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
        <body style="font-family: Arial; max-width: 800px; margin: auto; padding: 20px;">
            <h1>${backup.title}</h1>
            <img src="${backup.images[0]}" style="width: 100%; border-radius: 12px;">
            <p>${backup.text.replace(/\n/g, '</p><p>')}</p>
            <h2>Frequently Asked Questions</h2>
            <p><strong>Q: Is this reliable?</strong><br>A: Yes, based on extensive research.</p>
            <p><strong>Q: How to get started?</strong><br>A: Follow the steps above.</p>
            <p><strong>Q: Any costs involved?</strong><br>A: Most methods are free to start.</p>
            <h2>Conclusion</h2>
            <p>Start implementing these tips today for best results!</p>
        </body>
        </html>
        `;
        
        const auth = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET);
        auth.setCredentials({ refresh_token: REFRESH_TOKEN });
        const blogger = google.blogger({ version: 'v3', auth });
        
        const publishResult = await blogger.posts.insert({
            blogId: BLOG_ID,
            requestBody: {
                title: backup.title,
                content: htmlBody,
                labels: ['Backup', 'SEO Ready']
            }
        });
        
        console.log(`✅ Published backup: ${backup.title}`);
        console.log(`🔗 URL: ${publishResult.data.url}`);
        return;
    }
    
    console.log("❌ All attempts failed. Please check your internet connection.");
}

// --- تشغيل البوت ---
startEmpireBot().catch(console.error);
