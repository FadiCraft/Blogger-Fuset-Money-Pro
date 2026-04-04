const Groq = require("groq-sdk");
const { google } = require("googleapis");

const CONFIG = {
    groqKey: "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",
    blogId: "8249860422330426533",
    clientId: "872415365656-7qribadnc7k2u21kl6jjcbatdueevifh.apps.googleusercontent.com",
    clientSecret: "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",
    refreshToken: "1//04yti9k2agPknCgYIARAAGAQSNwF-L9IrTZPKt5Fqbg2vrM9sBtOks9cnY4M7Idg0LToQnlbYGME06k20vcyr_SVmYk1H_yZJdEc",
    topics: ["Make Money Online 2026", "AI Side Hustles", "Passive Income Tech", "Future of Work"]
};

const groq = new Groq({ apiKey: CONFIG.groqKey });
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function runGroqPublisher() {
    try {
        console.log("🔍 Step 1: Picking a topic (Llama 3.3)...");
        const topicRes = await groq.chat.completions.create({
            messages: [{ role: "user", content: "Suggest one professional, high-traffic blog title about AI and technology. Return ONLY the title text, no quotes." }],
            model: "llama-3.3-70b-versatile",
        });
        const targetTitle = topicRes.choices[0].message.content.trim().replace(/["']/g, "");

        console.log("✍️ Step 2: Writing a 1000-word article...");
        const contentRes = await groq.chat.completions.create({
            messages: [{ role: "user", content: `Write a detailed, 1000-word SEO blog post in English about "${targetTitle}". Use HTML (h2, p, ul, li). Make it engaging. No markdown.` }],
            model: "llama-3.3-70b-versatile",
        });
        let articleBody = contentRes.choices[0].message.content.replace(/```html|```/g, "").trim();

        console.log("🎨 Step 3: Generating AI Image Prompt...");
        const promptRes = await groq.chat.completions.create({
            messages: [{ role: "user", content: `Based on title: "${targetTitle}", write a highly detailed, cinematic, photorealistic image generation prompt. English only, no intro.` }],
            model: "llama-3.3-70b-versatile",
        });
        const imagePrompt = promptRes.choices[0].message.content.trim();
        
        console.log("📸 Step 4: Generating Image URL & Waiting...");
        const imageUrl = `https://pollinations.ai/p/${encodeURIComponent(imagePrompt)}?width=1200&height=630&model=flux&seed=${Math.floor(Math.random() * 9999)}`;
        await sleep(15000); 

        // تنسيق احترافي جداً بألوان فاتحة ومريحة
        const finalHtml = `
            <div dir="ltr" style="background-color: #f8fafd; padding: 25px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #2c3e50; line-height: 1.8; border-radius: 12px; border: 1px solid #e1e8ed;">
                <h1 style="color: #1a73e8; text-align: center; margin-bottom: 20px; font-size: 28px;">${targetTitle}</h1>
                <img src="${imageUrl}" style="width:100%; border-radius:12px; margin-bottom:25px; box-shadow: 0 8px 16px rgba(0,0,0,0.08);" alt="${targetTitle}">
                <div style="background-color: #ffffff; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.04);">
                    <style>
                        h2 { color: #0d47a1; border-bottom: 2px solid #e3f2fd; padding-bottom: 5px; margin-top: 25px;}
                        h3 { color: #1976d2; margin-top: 20px; }
                        p { font-size: 16px; color: #34495e; }
                        ul { background-color: #f1f8e9; padding: 15px 35px; border-radius: 8px; border-left: 4px solid #7cb342; }
                        li { margin-bottom: 8px; }
                    </style>
                    ${articleBody}
                </div>
                <hr style="border: 0; height: 1px; background: #dce0e4; margin: 30px 0;">
                <p style="text-align: center; color: #7f8c8d; font-style: italic; font-size: 14px;">Published by Kiro Zozo Automated Intelligence 2026</p>
            </div>
        `;

        console.log("📤 Step 5: Publishing to Blogger...");
        const oauth2Client = new google.auth.OAuth2(CONFIG.clientId, CONFIG.clientSecret);
        oauth2Client.setCredentials({ refresh_token: CONFIG.refreshToken });
        const blogger = google.blogger({ version: "v3", auth: oauth2Client });

        const response = await blogger.posts.insert({
            blogId: CONFIG.blogId,
            requestBody: { title: targetTitle, content: finalHtml, labels: ["AI Tech", "Make Money"] }
        });
        console.log(`✅ Success! Published: ${response.data.url}`);
    } catch (error) {
        console.error("❌ Error:", error.message);
    }
}
runGroqPublisher();
