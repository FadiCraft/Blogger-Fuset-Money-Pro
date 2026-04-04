const Groq = require("groq-sdk");
const { google } = require("googleapis");

const CONFIG = {
    groqKey: "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",
    blogId: "8249860422330426533",
    clientId: "872415365656-7qribadnc7k2u21kl6jjcbatdueevifh.apps.googleusercontent.com",
    clientSecret: "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",
    refreshToken: "1//04yti9k2agPknCgYIARAAGAQSNwF-L9IrTZPKt5Fqbg2vrM9sBtOks9cnY4M7Idg0LToQnlbYGME06k20vcyr_SVmYk1H_yZJdEc",
    topics: ["Make Money Online 2026", "AI Side Hustles", "Passive Income Tech"]
};

const groq = new Groq({ apiKey: CONFIG.groqKey });
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function runKiroBot() {
    try {
        console.log("🔍 Step 1: Picking topic...");
        const topicResponse = await groq.chat.completions.create({
            messages: [{ role: "user", content: "Suggest one trending blog title about AI money making. Return ONLY the title text." }],
            model: "llama-3.3-70b-versatile",
        });
        const targetTitle = topicResponse.choices[0].message.content.trim().replace(/["']/g, ""); // حذف الاقتباسات من البداية

        console.log("✍️ Step 2: Writing article...");
        const contentResponse = await groq.chat.completions.create({
            messages: [{ role: "user", content: `Write a 1000-word SEO blog post about "${targetTitle}" in English. Use HTML (h2, p, ul). No markdown.` }],
            model: "llama-3.3-70b-versatile",
        });
        let articleBody = contentResponse.choices[0].message.content.replace(/```html|```/g, "").trim();

        // --- الجزء الأهم: تنظيف رابط الصورة ---
        console.log("📸 Step 3: Cleaning Image URL...");
        // حذف أي رموز قد تسبب 404 أو تخرب الرابط
        const safeTitle = targetTitle.replace(/[^a-zA-Z0-9 ]/g, ""); 
        const imageUrl = `https://pollinations.ai/p/${encodeURIComponent(safeTitle)}?width=1200&height=630&model=flux&seed=${Math.floor(Math.random() * 9999)}`;
        
        console.log(`📷 Image Link: ${imageUrl}`);
        await sleep(10000); // ننتظر 10 ثوانٍ لتوليد الصورة

        const finalHtml = `
            <div dir="ltr" style="font-family: sans-serif; line-height: 1.6;">
                <img src="${imageUrl}" style="width:100%; border-radius:10px; margin-bottom:20px;" alt="${targetTitle}">
                ${articleBody}
            </div>
        `;

        console.log("📤 Step 4: Publishing...");
        const oauth2Client = new google.auth.OAuth2(CONFIG.clientId, CONFIG.clientSecret);
        oauth2Client.setCredentials({ refresh_token: CONFIG.refreshToken });
        const blogger = google.blogger({ version: "v3", auth: oauth2Client });

        const response = await blogger.posts.insert({
            blogId: CONFIG.blogId,
            requestBody: { title: targetTitle, content: finalHtml, labels: ["AI", "2026"] }
        });

        console.log(`✅ Success: ${response.data.url}`);

    } catch (error) {
        console.error("❌ Error:", error.message);
    }
}

runKiroBot();
