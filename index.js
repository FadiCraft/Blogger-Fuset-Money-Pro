const { GoogleGenerativeAI } = require("@google/generative-ai");
const { google } = require("googleapis");

// Configuration (Directly in code as requested)
const CONFIG = {
    geminiKey: "AIzaSyBf8rI9d20giMwOaljK6LArGiqCZ661BKM",
    blogId: "8249860422330426533",
    clientId: "872415365656-7qribadnc7k2u21kl6jjcbatdueevifh.apps.googleusercontent.com",
    clientSecret: "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",
    refreshToken: "1//04yti9k2agPknCgYIARAAGAQSNwF-L9IrTZPKt5Fqbg2vrM9sBtOks9cnY4M7Idg0LToQnlbYGME06k20vcyr_SVmYk1H_yZJdEc",
    topics: ["Make Money Online", "AI Tools 2026", "Passive Income Strategies", "Learn Programming Fast"]
};

async function runAutoBlog() {
    try {
        const genAI = new GoogleGenerativeAI(CONFIG.geminiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        console.log("🔍 Picking a trending English topic...");
        const topicPrompt = `As an SEO expert, suggest one trending and high-CPC article title about: ${CONFIG.topics.join(", ")}. Give me ONLY the title text.`;
        const topicResult = await model.generateContent(topicPrompt);
        const targetTitle = topicResult.response.text().trim();

        console.log(`🎯 Topic Selected: ${targetTitle}`);

        console.log("✍️ Generating English Article (800+ words)...");
        const contentPrompt = `Write a comprehensive, professional, and SEO-friendly article in ENGLISH for a tech blog. 
        Title: "${targetTitle}".
        Requirements:
        1. Length: 800-1000 words.
        2. Format: Use clean HTML (h2, h3, p, ul, li). No markdown symbols like \`\`\`html.
        3. Tone: Informative, engaging, and expert level.
        4. Focus on 2026 trends and high-value keywords.`;

        const contentResult = await model.generateContent(contentPrompt);
        let articleBody = contentResult.response.text();

        // Cleaning Markdown if AI included it
        articleBody = articleBody.replace(/```html|```/g, "");

        // Generate Smart Image URL
        const imageUrl = `https://pollinations.ai/p/${encodeURIComponent(targetTitle)}?width=1200&height=600&model=flux&nologo=true`;
        const finalContent = `<img src="${imageUrl}" style="width:100%; border-radius:12px; margin-bottom:20px;" alt="${targetTitle}">\n${articleBody}`;

        console.log("📤 Publishing to Blogger...");
        const oauth2Client = new google.auth.OAuth2(CONFIG.clientId, CONFIG.clientSecret);
        oauth2Client.setCredentials({ refresh_token: CONFIG.refreshToken });
        const blogger = google.blogger({ version: "v3", auth: oauth2Client });

        await blogger.posts.insert({
            blogId: CONFIG.blogId,
            requestBody: {
                title: targetTitle,
                content: finalContent,
                labels: ["Make Money Online", "Artificial Intelligence", "Tech Guide"]
            }
        });

        console.log("✅ DONE! Article published successfully.");
    } catch (error) {
        console.error("❌ Error:", error.message);
    }
}

runAutoBlog();
