const { GoogleGenerativeAI } = require("@google/generative-ai");
const { google } = require("googleapis");

// Configuration - Put your keys directly here
const CONFIG = {
    geminiKey: "AIzaSyBf8rI9d20giMwOaljK6LArGiqCZ661BKM",
    blogId: "8249860422330426533",
    clientId: "872415365656-7qribadnc7k2u21kl6jjcbatdueevifh.apps.googleusercontent.com",
    clientSecret: "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",
    refreshToken: "1//04yti9k2agPknCgYIARAAGAQSNwF-L9IrTZPKt5Fqbg2vrM9sBtOks9cnY4M7Idg0LToQnlbYGME06k20vcyr_SVmYk1H_yZJdEc",
    topics: ["Make Money Online", "AI Tools 2026", "Passive Income Strategies", "Learn Programming from Scratch"]
};

const genAI = new GoogleGenerativeAI(CONFIG.geminiKey);

async function runAutoBlog() {
    try {
        // Fix: Explicitly use the stable gemini-1.5-flash model
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        console.log("🔍 Finding a trending English topic...");
        const topicPrompt = `As a professional SEO and tech blogger, suggest one trending, high-traffic article title related to: ${CONFIG.topics.join(", ")}. Return ONLY the title text.`;
        
        const topicResult = await model.generateContent(topicPrompt);
        const targetTitle = topicResult.response.text().trim().replace(/[*#]/g, "");

        console.log(`🎯 Target Topic: ${targetTitle}`);

        console.log("✍️ Writing the article (800+ words in English)...");
        const contentPrompt = `Write a comprehensive, 100% unique, and professional blog post in ENGLISH.
        Title: "${targetTitle}".
        Structure:
        - Introduction with a hook.
        - Multiple subheadings (H2, H3).
        - Bullet points for readability.
        - Detailed explanation (at least 800 words).
        - Use clean HTML tags (h2, h3, p, ul, li). Do NOT use markdown code blocks like \`\`\`html.
        - Style: Expert tech enthusiast.`;

        const contentResult = await model.generateContent(contentPrompt);
        let articleBody = contentResult.response.text();

        // Clean any accidental markdown code blocks
        articleBody = articleBody.replace(/```html|```/g, "").trim();

        // Generate a dynamic AI image based on the title
        const imageUrl = `https://pollinations.ai/p/${encodeURIComponent(targetTitle)}?width=1200&height=600&model=flux&seed=${Math.floor(Math.random() * 1000)}`;
        const finalHtml = `<img src="${imageUrl}" style="width:100%; border-radius:15px; margin-bottom:25px;" alt="${targetTitle}">\n${articleBody}`;

        console.log("📤 Connecting to Blogger API...");
        const oauth2Client = new google.auth.OAuth2(CONFIG.clientId, CONFIG.clientSecret);
        oauth2Client.setCredentials({ refresh_token: CONFIG.refreshToken });
        const blogger = google.blogger({ version: "v3", auth: oauth2Client });

        const publishResponse = await blogger.posts.insert({
            blogId: CONFIG.blogId,
            requestBody: {
                title: targetTitle,
                content: finalHtml,
                labels: ["Money", "AI", "Tech Tips"]
            }
        });

        console.log(`✅ Success! Published at: ${publishResponse.data.url}`);

    } catch (error) {
        console.error("❌ Critical Error:", error.message);
        if (error.message.includes("404")) {
            console.log("💡 Tip: Try checking if your Gemini API Key is active in Google AI Studio.");
        }
    }
}

runAutoBlog();
