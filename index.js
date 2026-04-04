const { GoogleGenerativeAI } = require("@google/generative-ai");
const { google } = require("googleapis");

// ===== Configuration - Direct Integration =====
const CONFIG = {
    // Your New API Key
    geminiKey: "AIzaSyBfxlvNkS2Y2UnXp0MmXNmndJXai9hOD_s",
    
    // Blogger Details
    blogId: "8249860422330426533",
    clientId: "872415365656-7qribadnc7k2u21kl6jjcbatdueevifh.apps.googleusercontent.com",
    clientSecret: "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",
    refreshToken: "1//04yti9k2agPknCgYIARAAGAQSNwF-L9IrTZPKt5Fqbg2vrM9sBtOks9cnY4M7Idg0LToQnlbYGME06k20vcyr_SVmYk1H_yZJdEc",
    
    // Content Strategy
    topics: ["Make Money Online 2026", "AI Side Hustles", "Passive Income Tools", "Work from Home Tech"],
    language: "English"
};

// Initialize Gemini with explicit v1 API version to fix 404 error
const genAI = new GoogleGenerativeAI(CONFIG.geminiKey);

async function runKiroZozoBot() {
    try {
        // Use the full model path and force v1 stable API
        const model = genAI.getGenerativeModel({ 
            model: "models/gemini-1.5-flash" 
        }, { apiVersion: 'v1' });

        console.log("🔍 Step 1: Picking a trending English topic...");
        const topicPrompt = `Suggest one high-CPC, trending blog post title for 2026 about: ${CONFIG.topics.join(", ")}. Return ONLY the title text.`;
        
        const topicResult = await model.generateContent(topicPrompt);
        const targetTitle = topicResult.response.text().trim().replace(/[*#]/g, "");

        console.log(`🎯 Selected Title: ${targetTitle}`);

        console.log("✍️ Step 2: Generating high-quality English article...");
        const contentPrompt = `Write a professional, SEO-optimized blog post in ENGLISH.
        Title: "${targetTitle}".
        Requirements:
        - Minimum 800-1000 words.
        - Use HTML tags (h2, h3, p, ul, li) for structure.
        - DO NOT use markdown code blocks like \`\`\`html.
        - Include a comprehensive guide and expert tips.
        - Tone: Professional Tech Blogger.`;

        const contentResult = await model.generateContent(contentPrompt);
        let articleBody = contentResult.response.text();

        // Clean any potential markdown leftovers
        articleBody = articleBody.replace(/```html|```/g, "").trim();

        // Step 3: Dynamic Image Generation
        const imageUrl = `https://pollinations.ai/p/${encodeURIComponent(targetTitle)}?width=1200&height=600&model=flux&seed=${Math.floor(Math.random() * 9999)}`;
        const finalHtml = `
            <div dir="ltr" style="font-family: Arial, sans-serif; font-size: 16px; color: #333; line-height: 1.6;">
                <img src="${imageUrl}" style="width:100%; border-radius:15px; margin-bottom:25px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);" alt="${targetTitle}">
                ${articleBody}
                <hr style="margin: 30px 0;">
                <p style="text-align: center; color: #777;">Published automatically by KiroZozo Tech Bot 2026</p>
            </div>
        `;

        console.log("📤 Step 4: Posting to Blogger...");
        const oauth2Client = new google.auth.OAuth2(CONFIG.clientId, CONFIG.clientSecret);
        oauth2Client.setCredentials({ refresh_token: CONFIG.refreshToken });
        const blogger = google.blogger({ version: "v3", auth: oauth2Client });

        const response = await blogger.posts.insert({
            blogId: CONFIG.blogId,
            requestBody: {
                title: targetTitle,
                content: finalHtml,
                labels: ["Make Money Online", "AI Trends", "Tutorial"]
            }
        });

        console.log(`✅ Success! Article live at: ${response.data.url}`);

    } catch (error) {
        console.error("❌ Process Failed:");
        console.error(`Error Message: ${error.message}`);
        if (error.message.includes("404")) {
            console.log("💡 Fix: If 404 persists, the API key might still be propagating. Wait 2 minutes and retry.");
        }
    }
}

runKiroZozoBot();
