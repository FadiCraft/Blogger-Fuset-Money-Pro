const Groq = require("groq-sdk");
const { google } = require("googleapis");

// إعدادات المشروع الكاملة
const CONFIG = {
    // مفتاح Groq المجاني الخاص بك
    groqKey: "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",
    
    // إعدادات Blogger (نفس بياناتك السابقة)
    blogId: "8249860422330426533",
    clientId: "872415365656-7qribadnc7k2u21kl6jjcbatdueevifh.apps.googleusercontent.com",
    clientSecret: "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",
    refreshToken: "1//04yti9k2agPknCgYIARAAGAQSNwF-L9IrTZPKt5Fqbg2vrM9sBtOks9cnY4M7Idg0LToQnlbYGME06k20vcyr_SVmYk1H_yZJdEc",
    
    // المواضيع المقترحة للمقالات الإنجليزية
    topics: ["Make Money Online 2026", "AI and Future of Work", "Passive Income Apps", "Tech Trends 2026"]
};

// تهيئة مكتبة Groq
const groq = new Groq({ apiKey: CONFIG.groqKey });

async function runKiroGroqBot() {
    try {
        console.log("🔍 Step 1: Picking a trending English topic via Groq...");
        
        // استخدام موديل Llama 3 - 70B (واحد من أقوى الموديلات المجانية)
        const topicResponse = await groq.chat.completions.create({
            messages: [
                {
                    role: "user",
                    content: `Suggest one professional and trending blog post title for 2026 about: ${CONFIG.topics.join(", ")}. Return ONLY the title text, no quotes.`,
                },
            ],
            model: "llama3-70b-8192",
        });

        const targetTitle = topicResponse.choices[0].message.content.trim();
        console.log(`🎯 Target Topic: ${targetTitle}`);

        console.log("✍️ Step 2: Generating a high-quality 1000-word article...");
        const contentResponse = await groq.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: "You are a professional SEO content writer. You write only in English.",
                },
                {
                    role: "user",
                    content: `Write a comprehensive, 1000-word blog post about "${targetTitle}". 
                    - Use HTML tags (h2, h3, p, ul, li). 
                    - No markdown code blocks. 
                    - Make it engaging and expert-level.`,
                },
            ],
            model: "llama3-70b-8192",
        });

        let articleBody = contentResponse.choices[0].message.content;

        // تنظيف المحتوى من أي زوائد تقنية
        articleBody = articleBody.replace(/```html|```/g, "").trim();

        // توليد صورة مميزة (مجانية تماماً)
        const imageUrl = `https://pollinations.ai/p/${encodeURIComponent(targetTitle)}?width=1200&height=630&model=flux&seed=${Math.floor(Math.random() * 9999)}`;
        
        const finalHtml = `
            <div dir="ltr" style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333; line-height: 1.8;">
                <img src="${imageUrl}" style="width:100%; border-radius:15px; margin-bottom:25px; box-shadow: 0 4px 10px rgba(0,0,0,0.1);" alt="${targetTitle}">
                ${articleBody}
                <hr style="margin: 40px 0;">
                <p style="text-align: center; color: #888; font-style: italic;">Published by KiroZozo Automated Tech Engine 2026</p>
            </div>
        `;

        console.log("📤 Step 3: Connecting to Blogger API...");
        const oauth2Client = new google.auth.OAuth2(CONFIG.clientId, CONFIG.clientSecret);
        oauth2Client.setCredentials({ refresh_token: CONFIG.refreshToken });
        const blogger = google.blogger({ version: "v3", auth: oauth2Client });

        const publishResponse = await blogger.posts.insert({
            blogId: CONFIG.blogId,
            requestBody: {
                title: targetTitle,
                content: finalHtml,
                labels: ["AI Tech", "Make Money", "Insights"]
            }
        });

        console.log(`✅ Success! Your English article is live: ${publishResponse.data.url}`);

    } catch (error) {
        console.error("❌ Critical Error:", error.message);
    }
}

// تشغيل البوت
runKiroGroqBot();
