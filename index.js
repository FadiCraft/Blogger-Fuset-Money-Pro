const { GoogleGenerativeAI } = require("@google/generative-ai");
const { google } = require("googleapis");

// إعدادات المشروع
const CONFIG = {
    geminiKey: "AIzaSyBfxlvNkS2Y2UnXp0MmXNmndJXai9hOD_s",
    blogId: "8249860422330426533",
    clientId: "872415365656-7qribadnc7k2u21kl6jjcbatdueevifh.apps.googleusercontent.com",
    clientSecret: "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",
    refreshToken: "1//04yti9k2agPknCgYIARAAGAQSNwF-L9IrTZPKt5Fqbg2vrM9sBtOks9cnY4M7Idg0LToQnlbYGME06k20vcyr_SVmYk1H_yZJdEc",
    topics: ["Make Money Online", "AI Tech Trends", "Passive Income 2026", "Software Automation"]
};

const genAI = new GoogleGenerativeAI(CONFIG.geminiKey);

async function runAutoPublisher() {
    try {
        // استخدام موديل Lite لضمان الاستقرار وتجنب تجاوز الحصة المجانية
        const model = genAI.getGenerativeModel({ 
            model: "models/gemini-2.0-flash-lite" 
        }, { apiVersion: 'v1' });

        console.log("🔍 Step 1: Picking a trending English topic...");
        const topicPrompt = `Suggest one high-traffic, trending blog post title for 2026 about: ${CONFIG.topics.join(", ")}. Return ONLY the title text.`;
        const topicResult = await model.generateContent(topicPrompt);
        const targetTitle = topicResult.response.text().trim().replace(/[*#]/g, "");

        console.log(`🎯 Selected Topic: ${targetTitle}`);

        console.log("✍️ Step 2: Generating 1000+ words article in English...");
        const contentPrompt = `Write a professional, long-form SEO blog post in ENGLISH.
        Title: "${targetTitle}".
        Requirements:
        - Content length: 1000 to 1200 words.
        - Structure: Use H2 and H3 headings, clear paragraphs, and bullet points.
        - Format: Use ONLY clean HTML (h2, h3, p, ul, li). Do NOT use markdown code blocks.
        - Style: High-quality, informative, and engaging.`;

        const contentResult = await model.generateContent(contentPrompt);
        let articleBody = contentResult.response.text();

        // تنظيف أي زوائد من الذكاء الاصطناعي
        articleBody = articleBody.replace(/```html|```/g, "").trim();

        // توليد صورة مميزة بناءً على العنوان
        const imageUrl = `https://pollinations.ai/p/${encodeURIComponent(targetTitle)}?width=1200&height=630&model=flux&seed=${Math.floor(Math.random() * 10000)}`;
        
        const finalContent = `
            <div dir="ltr" style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333; line-height: 1.8;">
                <img src="${imageUrl}" style="width:100%; border-radius:10px; margin-bottom:20px; display:block;" alt="${targetTitle}">
                ${articleBody}
                <br><hr>
                <p style="text-align: center; font-size: 12px; color: #999;">Automated Tech Insights by KiroZozo Engine 2026</p>
            </div>
        `;

        console.log("📤 Step 3: Authenticating and Publishing to Blogger...");
        const oauth2Client = new google.auth.OAuth2(CONFIG.clientId, CONFIG.clientSecret);
        oauth2Client.setCredentials({ refresh_token: CONFIG.refreshToken });
        const blogger = google.blogger({ version: "v3", auth: oauth2Client });

        const response = await blogger.posts.insert({
            blogId: CONFIG.blogId,
            requestBody: {
                title: targetTitle,
                content: finalContent,
                labels: ["Technology", "Make Money", "AI"]
            }
        });

        console.log(`✅ DONE! Your article is live: ${response.data.url}`);

    } catch (error) {
        if (error.message.includes("429")) {
            console.error("❌ Quota Error: Google is limiting requests right now. Please wait 10 minutes and try again.");
        } else {
            console.error("❌ Error occurred:", error.message);
        }
    }
}

runAutoPublisher();
