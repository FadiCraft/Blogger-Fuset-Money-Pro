const Groq = require("groq-sdk");
const { google } = require("googleapis");
const Parser = require("rss-parser");

const parser = new Parser();

const CONFIG = {
    // ⚠️ تنبيه: مفاتيحك الخاصة. حافظ عليها.
    groqKey: "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",
    blogId: "8249860422330426533",
    clientId: "872415365656-7qribadnc7k2u21kl6jjcbatdueevifh.apps.googleusercontent.com",
    clientSecret: "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",
    refreshToken: "1//04yti9k2agPknCgYIARAAGAQSNwF-L9IrTZPKt5Fqbg2vrM9sBtOks9cnY4M7Idg0LToQnlbYGME06k20vcyr_SVmYk1H_yZJdEc",
    siteName: "Zyphora"
};

// 💡 هنا السر: هذه الأقسام تم اختيارها لأنها تمتلك أعلى سعر نقرة (CPC) في جوجل أدسينس
// وقمنا بربطها بكلمات بحث مخصصة لجوجل نيوز لجلب أحدث التريندات
const NICHES = [
    { id: "Make Money Online", searchQuery: '"passive income" OR "make money online" OR "affiliate marketing"', label: "Digital Wealth" },
    { id: "Business & SaaS", searchQuery: '"SaaS" OR "business software" OR "startup tips"', label: "Business Software" },
    { id: "Cyber Security", searchQuery: '"cybersecurity" OR "network security" OR "vpn"', label: "Cyber Security" }, // مجال دراستك، ومربح جداً
    { id: "Cloud & Web", searchQuery: '"web hosting" OR "cloud computing" OR "web development"', label: "Web Tech" },
    { id: "Tech Troubleshooting", searchQuery: '"how to fix" OR "troubleshooting" Windows OR iOS', label: "Tech Fixes" }
];

const groq = new Groq({ apiKey: CONFIG.groqKey });

async function runGroqPublisher() {
    try {
        // 1. اختيار قسم عشوائي عالي الربح
        const selectedNiche = NICHES[Math.floor(Math.random() * NICHES.length)];
        console.log(`\n🔍 Searching Google News Trends for High CPC Niche: [${selectedNiche.id}]...`);

        // 2. سحب التريندات من Google News لأخر 7 أيام
        // نستخدم رابط الـ RSS السري الخاص ببحث جوجل نيوز
        const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(selectedNiche.searchQuery)}+when:7d&hl=en-US&gl=US&ceid=US:en`;
        
        let trendingTopic = "";
        try {
            const feed = await parser.parseURL(rssUrl);
            if (feed.items && feed.items.length > 0) {
                // نختار مقال عشوائي من أعلى 5 مقالات تريند
                const topItems = feed.items.slice(0, 5);
                const randomNews = topItems[Math.floor(Math.random() * topItems.length)];
                trendingTopic = randomNews.title;
                console.log(`📈 Google Trend Picked: "${trendingTopic}"`);
            } else {
                throw new Error("No news found.");
            }
        } catch (error) {
            console.log("⚠️ Could not fetch from Google News. Using a fallback High CPC topic.");
            trendingTopic = `Top tools and strategies for ${selectedNiche.id} in 2026`;
        }

        // 3. قاعدة صارمة لمنع الذكاء الاصطناعي من السيطرة على المحتوى
        const aiRestriction = "CRITICAL RULE: Unless the topic is explicitly about Artificial Intelligence, DO NOT mention AI, ChatGPT, or Machine Learning. Focus entirely on practical human strategies, traditional tech, networking, or business mechanics. Keep it highly commercial and AdSense friendly (mention tools, software, and actionable steps).";

        // 4. إنشاء عنوان SEO فيروسي بناءً على التريند الحقيقي
        console.log("📝 Crafting Viral SEO Title...");
        const titleRes = await groq.chat.completions.create({
            messages: [{ 
                role: "user", 
                content: `You are an expert tech and business copywriter. Create a highly clickable, SEO-optimized title (Under 60 characters) based on this real news topic: "${trendingTopic}". Make it sound like a guide, a fix, or a profitable strategy. NO quotes. ${aiRestriction}` 
            }],
            model: "llama-3.3-70b-versatile",
        });
        const targetTitle = titleRes.choices[0].message.content.trim();
        console.log(`🎯 Final Title: ${targetTitle}`);

        // 5. كتابة المحتوى والكلمات المفتاحية (مخصص للقبول في AdSense)
        console.log("🤖 Generating High-CPC Content...");
        const contentRes = await groq.chat.completions.create({
            messages: [{ 
                role: "user", 
                content: `Write a highly engaging, extremely detailed SEO article for "${targetTitle}". 
                
                REQUIREMENTS FOR ADSENSE APPROVAL:
                1. Length: Long-form (Aim for 1500+ words). Must have a clear Introduction, Body with actionable steps/lists, and Conclusion.
                2. Commercial Intent: Use language that attracts high-paying ads (e.g., mention "software solutions", "enterprise tools", "investment strategies", "premium services").
                3. Links: Include 2 relevant external links to authoritative sources using syntax: <a href='URL' target='_blank' rel='noopener noreferrer'>Link Text</a>.
                4. Formatting: Use proper HTML tags (<h1> for the main title, <h2>, <h3>, <p>, <ul>, <li>, <strong>).
                5. ${aiRestriction}
                6. Keywords: Provide exactly 6 high-volume, high-CPC SEO tags.
                
                You MUST output ONLY a valid JSON object matching this structure:
                {
                    "articleHtml": "The complete HTML...",
                    "labels": ["keyword1", "keyword2"]
                }
                NOTE: Use single quotes (') for HTML attributes inside JSON.` 
            }],
            model: "llama-3.3-70b-versatile",
            response_format: { type: "json_object" } 
        });
        
        const articleData = JSON.parse(contentRes.choices[0].message.content);

        // 6. جلب صورة احترافية تناسب هوية Zyphora
        console.log("🎨 Generating Aesthetic Image...");
        const imgDescRes = await groq.chat.completions.create({
            messages: [{ role: "user", content: `Describe a modern, minimalist, corporate or tech background related to: "${targetTitle}". No text. Max 6 words.` }],
            model: "llama-3.3-70b-versatile",
        });
        const imgPrompt = encodeURIComponent(imgDescRes.choices[0].message.content.trim());
        const finalImageUrl = `https://image.pollinations.ai/prompt/${imgPrompt}?width=1200&height=630&nologo=true`; 

        // 7. تجميع الـ HTML مع تصميم Dark Mode & Glassmorphism
        console.log("🏗️ Assembling Zyphora UI...");
        const finalHtml = `
            <style>
                .zyphora-wrapper { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.8; color: #e2e8f0; background-color: #0f172a; padding: 20px; border-radius: 12px; }
                .zyphora-hero { width: 100%; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.3); margin-bottom: 30px; }
                
                .zyphora-body h1 { color: #38bdf8; font-size: 28px; text-align: center; border-bottom: 2px solid #1e293b; padding-bottom: 15px; margin-bottom: 25px;}
                .zyphora-body h2 { color: #818cf8; font-size: 24px; margin-top: 35px; border-left: 4px solid #38bdf8; padding-left: 10px;}
                .zyphora-body h3 { color: #cbd5e1; font-size: 20px; margin-top: 25px;}
                .zyphora-body p { font-size: 17px; margin-bottom: 20px; color: #94a3b8; }
                
                .zyphora-body a { color: #f472b6; text-decoration: none; font-weight: bold; border-bottom: 1px dotted #f472b6; transition: 0.3s;}
                .zyphora-body a:hover { color: #fb7185; }
                
                .zyphora-body ul, .zyphora-body ol { background: rgba(30, 41, 59, 0.5); padding: 20px 40px; border-radius: 8px; margin: 20px 0; border: 1px solid #334155;}
                .zyphora-body li { margin-bottom: 10px; color: #cbd5e1; font-size: 16px;}
            </style>

            <div class="zyphora-wrapper" dir="ltr">
                <div style="text-align: center;">
                    <img class="zyphora-hero" src="${finalImageUrl}" alt="${targetTitle}" loading="lazy">
                </div>
                
                <div class="zyphora-body">
                    ${articleData.articleHtml}
                </div>
            </div>
        `;

        // 8. تجهيز الكلمات المفتاحية
        const dynamicLabels = articleData.labels || [];
        const finalLabels = [...new Set([...dynamicLabels, selectedNiche.label, "Zyphora Insider"])].slice(0, 8);

        // 9. النشر التلقائي في بلوجر
        console.log(`🚀 Publishing to Blogger with tags: [${finalLabels.join(', ')}]...`);
        const oauth2Client = new google.auth.OAuth2(CONFIG.clientId, CONFIG.clientSecret);
        oauth2Client.setCredentials({ refresh_token: CONFIG.refreshToken });
        const blogger = google.blogger({ version: "v3", auth: oauth2Client });

        const response = await blogger.posts.insert({
            blogId: CONFIG.blogId,
            requestBody: { 
                title: targetTitle, 
                content: finalHtml, 
                labels: finalLabels 
            }
        });

        console.log(`✨ SUCCESS! Viral Article Published: ${response.data.url}`);
    } catch (error) {
        console.error("🔴 Fatal Error:", error.message);
    }
}

runGroqPublisher();
