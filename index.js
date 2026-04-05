const Groq = require("groq-sdk");
const { google } = require("googleapis");

const CONFIG = {
    groqKey: "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",
    blogId: "8249860422330426533",
    clientId: "872415365656-7qribadnc7k2u21kl6jjcbatdueevifh.apps.googleusercontent.com",
    clientSecret: "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",
    refreshToken: "1//04yti9k2agPknCgYIARAAGAQSNwF-L9IrTZPKt5Fqbg2vrM9sBtOks9cnY4M7Idg0LToQnlbYGME06k20vcyr_SVmYk1H_yZJdEc",
    siteName: "TECH VANGUARD"
};

// 1. تحديث قائمة النيشات لتشمل الـ 10 تصنيفات المطلوبة
const NICHES = [
    { name: "الربح من الإنترنت", description: "Make Money Online, affiliate, adsense" },
    { name: "أدوات الذكاء الاصطناعي", description: "AI Tools, ChatGPT, automation, productive AI" },
    { name: "تطبيقات ومواقع", description: "Mobile Apps, useful websites, software reviews" },
    { name: "حل المشاكل التقنية", description: "Fixing tech issues, windows/mac/android solutions" },
    { name: "المقارنات", description: "Product comparisons, side-by-side reviews" },
    { name: "أفضل 10", description: "Top 10 lists, best of rankings" },
    { name: "الشروحات", description: "Step-by-step tutorials, educational guides" },
    { name: "حل مشاكل التطبيقات المشهورة", description: "Social media fixes, TikTok/Instagram/Facebook troubleshooting" },
    { name: "أفكار مشاريع", description: "Business ideas, startup concepts, zero capital projects" },
    { name: "الترندات الجديدة", description: "New trends, viral tech, upcoming gadgets" }
];

const groq = new Groq({ apiKey: CONFIG.groqKey });

async function runGroqPublisher() {
    try {
        // اختيار نيش عشوائي
        const selectedNiche = NICHES[Math.floor(Math.random() * NICHES.length)];
        console.log(`🎯 Selected Niche: ${selectedNiche.name}`);

        // 1. إنشاء عنوان SEO احترافي باللغة العربية
        console.log("📝 Generating Title...");
        const titleRes = await groq.chat.completions.create({
            messages: [{ role: "user", content: `Generate a viral, high-authority SEO title in ARABIC for a blog post about: ${selectedNiche.name} (${selectedNiche.description}). Include the year 2026. NO quotes.` }],
            model: "llama-3.3-70b-versatile",
        });
        const targetTitle = titleRes.choices[0].message.content.trim();

        // 2. كتابة المحتوى والكلمات المفتاحية
        console.log("🤖 Generating Detailed Content & Keywords...");
        const contentRes = await groq.chat.completions.create({
            messages: [{ 
                role: "user", 
                content: `Write an extremely detailed Arabic article for: "${targetTitle}".
                
                REQUIREMENTS:
                1. Language: Arabic (Modern Standard).
                2. Length: At least 2500-4000 words. Be very thorough, provide examples, and deep value.
                3. Formatting: Use HTML (<h2>, <h3>, <p>, <ul>, <li>, <strong>).
                4. Content: Include introduction, detailed sections, tips, and conclusion.
                5. Links: Include 2-3 links to authoritative sites (e.g., Wikipedia, Google).
                
                You MUST output ONLY a valid JSON:
                {
                    "articleHtml": "HTML_CONTENT_HERE",
                    "keywords": ["tag1", "tag2", "tag3", "tag4", "tag5"]
                }
                
                Note: "keywords" should be 5 relevant tags in Arabic related to the article topic.` 
            }],
            model: "llama-3.3-70b-versatile",
            response_format: { type: "json_object" } 
        });
        
        const articleData = JSON.parse(contentRes.choices[0].message.content);

        // 3. جلب الصورة (بناءً على العنوان)
        const imgDescRes = await groq.chat.completions.create({
            messages: [{ role: "user", content: `Describe a cinematic background for: "${targetTitle}". English, 5 words.` }],
            model: "llama-3.3-70b-versatile",
        });
        const imgPrompt = encodeURIComponent(imgDescRes.choices[0].message.content.trim());
        const finalImageUrl = `https://image.pollinations.ai/prompt/${imgPrompt}?width=1200&height=630&nologo=true`; 

        // 4. تجميع HTML (مع دعم اللغة العربية RTL)
        const finalHtml = `
            <div dir="rtl" style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.8; color: #333;">
                <style>
                    .main-img { width: 100%; border-radius: 15px; margin-bottom: 20px; }
                    h2 { color: #2c3e50; border-right: 5px solid #3498db; padding-right: 15px; }
                    p { font-size: 18px; text-align: justify; }
                    ul { background: #f9f9f9; padding: 20px 40px; border-radius: 10px; }
                </style>
                <img src="${finalImageUrl}" alt="${targetTitle}" class="main-img">
                ${articleData.articleHtml}
                <hr>
                <p style="text-align:center; font-size: 12px; color: #777;">تم إنشاؤه بواسطة ذكاء TECH VANGUARD الاصطناعي 2026</p>
            </div>
        `;

        // 5. النشر عبر بلوجر مع الكلمات المفتاحية الديناميكية
        console.log("🚀 Publishing to Blogger...");
        const oauth2Client = new google.auth.OAuth2(CONFIG.clientId, CONFIG.clientSecret);
        oauth2Client.setCredentials({ refresh_token: CONFIG.refreshToken });
        const blogger = google.blogger({ version: "v3", auth: oauth2Client });

        const response = await blogger.posts.insert({
            blogId: CONFIG.blogId,
            requestBody: { 
                title: targetTitle, 
                content: finalHtml, 
                labels: articleData.keywords // الكلمات المفتاحية المستخرجة من الذكاء الاصطناعي
            }
        });

        console.log(`✨ DONE! Published: ${response.data.url}`);
    } catch (error) {
        console.error("🔴 Error:", error.message);
    }
}

runGroqPublisher();
