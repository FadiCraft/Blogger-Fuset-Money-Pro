const Groq = require("groq-sdk");
const { google } = require("googleapis");

const CONFIG = {
    groqKey: "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",
    blogId: "8249860422330426533",
    clientId: "872415365656-7qribadnc7k2u21kl6jjcbatdueevifh.apps.googleusercontent.com",
    clientSecret: "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",
    refreshToken: "1//04yti9k2agPknCgYIARAAGAQSNwF-L9IrTZPKt5Fqbg2vrM9sBtOks9cnY4M7Idg0LToQnlbYGME06k20vcyr_SVmYk1H_yZJdEc",
    topics: ["Make Money Online 2026", "AI Side Hustles", "Future Tech Automation"]
};

const groq = new Groq({ apiKey: CONFIG.groqKey });
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function runGroqPublisher() {
    try {
        console.log("🔍 Step 1: Picking a topic (Llama 3.3)...");
        const topicRes = await groq.chat.completions.create({
            messages: [{ role: "user", content: "Suggest one short, high-traffic blog title about AI and making money. Return ONLY the title text." }],
            model: "llama-3.3-70b-versatile",
        });
        const targetTitle = topicRes.choices[0].message.content.trim().replace(/[^a-zA-Z0-9 ]/g, "");

        console.log("✍️ Step 2: Writing a 1000-word article...");
        const contentRes = await groq.chat.completions.create({
            messages: [{ role: "user", content: `Write a detailed 1000-word SEO blog post about "${targetTitle}". Use HTML (h2, p, ul, li). Make it engaging. No markdown blocks.` }],
            model: "llama-3.3-70b-versatile",
        });
        let articleBody = contentRes.choices[0].message.content.replace(/```html|```/g, "").trim();

        console.log("🎨 Step 3: Generating Blogger-Friendly Image Prompt...");
        // نطلب من الذكاء الاصطناعي وصفاً قصيراً جداً ليقبله رابط بلوجر
        const promptRes = await groq.chat.completions.create({
            messages: [{ role: "user", content: `Based on title: "${targetTitle}", write a VERY SHORT (max 5 words) visual description. English letters only.` }],
            model: "llama-3.3-70b-versatile",
        });
        
        // تنظيف صارم للرابط: تحويل المسافات إلى شرطات (-) وحذف أي رموز
        let rawPrompt = promptRes.choices[0].message.content.trim();
        let cleanPrompt = rawPrompt.replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, "-").toLowerCase();
        
        console.log("📸 Step 4: Formatting Direct Image Link...");
        // هذا الرابط النظيف سيجبر بلوجر على التعرف على الصورة وحفظها
        const imageUrl = `https://image.pollinations.ai/prompt/${cleanPrompt}-futuristic-8k`;
        console.log(`🔗 Final Direct Image URL: ${imageUrl}`);
        
        await sleep(5000); 

        // تنسيق HTML احترافي جداً بألوان فاتحة ومريحة للعين
        const finalHtml = `
            <div dir="ltr" style="background-color: #f4f7f6; padding: 30px; font-family: 'Segoe UI', Arial, sans-serif; color: #2c3e50; line-height: 1.8; border-radius: 12px;">
                <h1 style="color: #2980b9; text-align: center; margin-bottom: 25px; font-size: 28px; font-weight: bold;">${targetTitle}</h1>
                
                <div style="text-align: center; margin-bottom: 30px;">
                    <a href="${imageUrl}" target="_blank">
                        <img src="${imageUrl}" style="max-width: 100%; height: auto; border-radius: 12px; box-shadow: 0 8px 20px rgba(0,0,0,0.15);" alt="${targetTitle}">
                    </a>
                </div>
                
                <div style="background-color: #ffffff; padding: 25px; border-radius: 12px; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
                    <style>
                        h2 { color: #34495e; border-bottom: 2px solid #ecf0f1; padding-bottom: 10px; margin-top: 30px; font-size: 22px;}
                        h3 { color: #7f8c8d; font-size: 18px; margin-top: 20px;}
                        p { font-size: 16px; color: #555555; margin-bottom: 15px; }
                        ul { background-color: #fdfefe; padding: 20px 40px; border-radius: 8px; border-left: 5px solid #3498db; margin: 20px 0;}
                        li { margin-bottom: 10px; font-size: 16px; color: #444444;}
                    </style>
                    ${articleBody}
                </div>
                <hr style="border: 0; height: 1px; background: #e0e0e0; margin: 30px 0;">
                <p style="text-align: center; color: #bdc3c7; font-style: italic; font-size: 13px;">Crafted dynamically by Kiro Zozo AI Engine 2026</p>
            </div>
        `;

        console.log("📤 Step 5: Publishing to Blogger...");
        const oauth2Client = new google.auth.OAuth2(CONFIG.clientId, CONFIG.clientSecret);
        oauth2Client.setCredentials({ refresh_token: CONFIG.refreshToken });
        const blogger = google.blogger({ version: "v3", auth: oauth2Client });

        const response = await blogger.posts.insert({
            blogId: CONFIG.blogId,
            requestBody: { title: targetTitle, content: finalHtml, labels: ["AI Tech", "Insights"] }
        });
        console.log(`✅ Success! Article live at: ${response.data.url}`);
    } catch (error) {
        console.error("❌ Error:", error.message);
    }
}
runGroqPublisher();
