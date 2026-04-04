const { GoogleGenerativeAI } = require("@google/generative-ai");
const { google } = require("googleapis");

const CONFIG = {
    geminiKey: "AIzaSyBfxlvNkS2Y2UnXp0MmXNmndJXai9hOD_s",
    blogId: "8249860422330426533",
    clientId: "872415365656-7qribadnc7k2u21kl6jjcbatdueevifh.apps.googleusercontent.com",
    clientSecret: "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",
    refreshToken: "1//04yti9k2agPknCgYIARAAGAQSNwF-L9IrTZPKt5Fqbg2vrM9sBtOks9cnY4M7Idg0LToQnlbYGME06k20vcyr_SVmYk1H_yZJdEc",
    topics: ["Make Money Online", "AI Side Hustles", "Crypto Passive Income", "Future Tech 2026"]
};

// تهيئة الذكاء الاصطناعي
const genAI = new GoogleGenerativeAI(CONFIG.geminiKey);

async function runKiroBot() {
    try {
        // تم اختيار الموديل من القائمة التي ظهرت في فحصك (v1 المستقر)
        const model = genAI.getGenerativeModel({ 
            model: "models/gemini-2.0-flash" 
        }, { apiVersion: 'v1' });

        console.log("🔍 Picking a global trending topic...");
        const topicPrompt = `As a professional English blogger, suggest ONE trending, high-CPC article title about: ${CONFIG.topics.join(", ")}. Return only the title text.`;
        const topicResult = await model.generateContent(topicPrompt);
        const targetTitle = topicResult.response.text().trim().replace(/[*#]/g, "");

        console.log(`🎯 Topic: ${targetTitle}`);

        console.log("✍️ Writing a long-form professional English article...");
        const contentPrompt = `Write a comprehensive, SEO-optimized blog post in ENGLISH.
        Title: "${targetTitle}".
        Requirements:
        - Word count: 1000+ words.
        - Structure: Introduction, several H2/H3 subheadings, bullet points, and a conclusion.
        - Format: Use clean HTML (h2, h3, p, ul, li). No markdown code blocks.
        - Audience: People looking to earn money or use AI in 2026.`;

        const contentResult = await model.generateContent(contentPrompt);
        let articleBody = contentResult.response.text();

        // تنظيف أي زوائد برمجية من النص
        articleBody = articleBody.replace(/```html|```/g, "").trim();

        // توليد صورة ذكية متوافقة مع المحتوى
        const imageUrl = `https://pollinations.ai/p/${encodeURIComponent(targetTitle)}?width=1280&height=720&model=flux&seed=${Math.floor(Math.random() * 10000)}`;
        
        const finalHtml = `
            <div dir="ltr" style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.8; color: #2c3e50;">
                <img src="${imageUrl}" style="width:100%; border-radius:12px; margin-bottom:25px;" alt="${targetTitle}">
                ${articleBody}
                <div style="margin-top: 40px; padding: 20px; background: #f8f9fa; border-left: 5px solid #2980b9;">
                    <p><i>Note: This article was generated using advanced AI to provide the latest 2026 market insights.</i></p>
                </div>
            </div>
        `;

        console.log("📤 Publishing to Blogger...");
        const oauth2Client = new google.auth.OAuth2(CONFIG.clientId, CONFIG.clientSecret);
        oauth2Client.setCredentials({ refresh_token: CONFIG.refreshToken });
        const blogger = google.blogger({ version: "v3", auth: oauth2Client });

        const response = await blogger.posts.insert({
            blogId: CONFIG.blogId,
            requestBody: {
                title: targetTitle,
                content: finalHtml,
                labels: ["AI Money", "Tech Trends", "Passive Income"]
            }
        });

        console.log(`✅ Success! Published at: ${response.data.url}`);

    } catch (error) {
        console.error("❌ Process Failed:", error.message);
    }
}

runKiroBot();
