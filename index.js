const Groq = require("groq-sdk");
const { google } = require("googleapis");

const CONFIG = {
    groqKey: "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",
    blogId: "8249860422330426533",
    clientId: "872415365656-7qribadnc7k2u21kl6jjcbatdueevifh.apps.googleusercontent.com",
    clientSecret: "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",
    refreshToken: "1//04yti9k2agPknCgYIARAAGAQSNwF-L9IrTZPKt5Fqbg2vrM9sBtOks9cnY4M7Idg0LToQnlbYGME06k20vcyr_SVmYk1H_yZJdEc",
    topics: ["Make Money Online 2026", "AI Innovations", "Passive Income", "Tech Trends"]
};

// تهيئة Groq
const groq = new Groq({ apiKey: CONFIG.groqKey });

// --- دالة بسيطة للانتظار ---
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function runKiroGroqBot() {
    try {
        console.log("🔍 Step 1: Picking a trending topic via Groq (Llama 3.3)...");
        
        const topicResponse = await groq.chat.completions.create({
            messages: [
                {
                    role: "user",
                    content: `Suggest one professional and trending blog post title for 2026 about: ${CONFIG.topics.join(", ")}. Return ONLY the title text.`,
                },
            ],
            model: "llama-3.3-70b-versatile",
        });

        const targetTitle = topicResponse.choices[0].message.content.trim();
        console.log(`🎯 Target Topic: ${targetTitle}`);

        console.log("✍️ Step 2: Generating a high-quality 1000-word article...");
        const contentResponse = await groq.chat.completions.create({
            messages: [
                { role: "system", content: "You are a professional SEO tech blogger writing in English." },
                {
                    role: "user",
                    content: `Write a 1000-word blog post in English about "${targetTitle}". Use HTML tags (h2, h3, p, ul, li). No markdown blocs.`,
                },
            ],
            model: "llama-3.3-70b-versatile",
        });

        let articleBody = contentResponse.choices[0].message.content;
        articleBody = articleBody.replace(/```html|```/g, "").trim();

        // Step 3: Image Generation and Waiting (حل مشكلة عدم ظهور الصورة)
        console.log("📸 Step 3: Generating image URL...");
        const imageUrl = `https://pollinations.ai/p/${encodeURIComponent(targetTitle)}?width=1200&height=630&model=flux&seed=${Math.floor(Math.random() * 9999)}`;
        
        console.log("⏳ Waiting 15 seconds for image to be generated...");
        // ننتظر 15 ثانية كاملة ليتأكد سيرفر Pollinations من توليد الصورة قبل النشر
        await sleep(15000); 

        console.log("📤 Step 4: Formatting HTML and Publishing to Blogger...");
        const finalHtml = `
            <div dir="ltr" style="font-family: Arial, sans-serif; line-height: 1.8; color: #333;">
                <img src="${imageUrl}" style="width:100%; border-radius:15px; margin-bottom:25px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);" alt="${targetTitle}">
                ${articleBody}
                <hr>
                <p style="text-align: center; color: #888; font-style: italic;">AI Powered Insights 2026 by KiroZozo Bot</p>
            </div>
        `;

        const oauth2Client = new google.auth.OAuth2(CONFIG.clientId, CONFIG.clientSecret);
        oauth2Client.setCredentials({ refresh_token: CONFIG.refreshToken });
        const blogger = google.blogger({ version: "v3", auth: oauth2Client });

        const publishResponse = await blogger.posts.insert({
            blogId: CONFIG.blogId,
            requestBody: { title: targetTitle, content: finalHtml, labels: ["AI Tech", "Insights", "Make Money"] }
        });

        console.log(`✅DONE! Article live at: ${publishResponse.data.url}`);

    } catch (error) {
        console.error("❌ Critical Error:", error.message);
    }
}

// تشغيل البوت
runKiroGroqBot();
