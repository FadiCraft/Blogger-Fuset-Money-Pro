const { GoogleGenerativeAI } = require("@google/generative-ai");
const { google } = require("googleapis");

const CONFIG = {
    geminiKey: "AIzaSyBfxlvNkS2Y2UnXp0MmXNmndJXai9hOD_s",
    blogId: "8249860422330426533",
    clientId: "872415365656-7qribadnc7k2u21kl6jjcbatdueevifh.apps.googleusercontent.com",
    clientSecret: "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",
    refreshToken: "1//04yti9k2agPknCgYIARAAGAQSNwF-L9IrTZPKt5Fqbg2vrM9sBtOks9cnY4M7Idg0LToQnlbYGME06k20vcyr_SVmYk1H_yZJdEc",
    topics: ["Make Money Online 2026", "AI Side Hustles", "Passive Income Tech", "Future of Work"]
};

const genAI = new GoogleGenerativeAI(CONFIG.geminiKey);
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function runGeminiPublisher() {
    try {
        const model = genAI.getGenerativeModel({ model: "models/gemini-2.0-flash-lite" }, { apiVersion: 'v1' });

        console.log("🔍 Step 1: Picking a topic (Gemini)...");
        const topicRes = await model.generateContent(`Suggest one professional, high-traffic blog title about AI and technology. Return ONLY the title text.`);
        const targetTitle = topicRes.response.text().trim().replace(/["']/g, "");

        console.log("✍️ Step 2: Writing a 1000-word article...");
        const contentRes = await model.generateContent(`Write a detailed, 1000-word SEO blog post in English about "${targetTitle}". Use HTML (h2, p, ul, li). Make it engaging. No markdown.`);
        let articleBody = contentRes.response.text().replace(/```html|```/g, "").trim();

        console.log("🎨 Step 3: Generating AI Image Prompt...");
        const promptRes = await model.generateContent(`Based on title: "${targetTitle}", write a highly detailed, cinematic, photorealistic image generation prompt. English only, no intro.`);
        const imagePrompt = promptRes.response.text().trim();
        
        console.log("📸 Step 4: Generating Image URL & Waiting...");
        const imageUrl = `https://pollinations.ai/p/${encodeURIComponent(imagePrompt)}?width=1200&height=630&model=flux&seed=${Math.floor(Math.random() * 9999)}`;
        await sleep(15000); 

        // تنسيق احترافي بألوان فاتحة وجذابة
        const finalHtml = `
            <div dir="ltr" style="background-color: #fdfbfb; background-image: linear-gradient(120deg, #fdfbfb 0%, #ebedee 100%); padding: 25px; font-family: 'Helvetica Neue', Arial, sans-serif; color: #333; line-height: 1.8; border-radius: 12px;">
                <img src="${imageUrl}" style="width:100%; border-radius:12px; margin-bottom:25px; box-shadow: 0 10px 20px rgba(0,0,0,0.1);" alt="${targetTitle}">
                <div style="background-color: rgba(255, 255, 255, 0.9); padding: 20px; border-radius: 10px;">
                    <style>
                        h2 { color: #6a1b9a; border-left: 4px solid #ce93d8; padding-left: 10px; margin-top: 25px; font-weight: bold;}
                        h3 { color: #8e24aa; margin-top: 20px; }
                        p { font-size: 16px; color: #424242; }
                        ul { background-color: #fff3e0; padding: 15px 35px; border-radius: 8px; border-left: 4px solid #ffb74d; }
                        li { margin-bottom: 8px; }
                    </style>
                    ${articleBody}
                </div>
                <hr style="border: 0; height: 1px; background: #ccc; margin: 30px 0;">
                <p style="text-align: center; color: #999; font-style: italic;">Published by Kiro Zozo Automated Intelligence 2026</p>
            </div>
        `;

        console.log("📤 Step 5: Publishing to Blogger...");
        const oauth2Client = new google.auth.OAuth2(CONFIG.clientId, CONFIG.clientSecret);
        oauth2Client.setCredentials({ refresh_token: CONFIG.refreshToken });
        const blogger = google.blogger({ version: "v3", auth: oauth2Client });

        const response = await blogger.posts.insert({
            blogId: CONFIG.blogId,
            requestBody: { title: targetTitle, content: finalHtml, labels: ["Tech", "Future"] }
        });
        console.log(`✅ Success! Published: ${response.data.url}`);
    } catch (error) {
        console.error("❌ Error:", error.message);
    }
}
runGeminiPublisher();
