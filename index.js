const Groq = require("groq-sdk");
const { google } = require("googleapis");

const CONFIG = {
    groqKey: "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",
    blogId: "8249860422330426533",
    clientId: "872415365656-7qribadnc7k2u21kl6jjcbatdueevifh.apps.googleusercontent.com",
    clientSecret: "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",
    refreshToken: "1//04yti9k2agPknCgYIARAAGAQSNwF-L9IrTZPKt5Fqbg2vrM9sBtOks9cnY4M7Idg0LToQnlbYGME06k20vcyr_SVmYk1H_yZJdEc",
    siteName: "TECH VANGUARD"
};

const NICHES = [
    { id: "FINANCE", label: "Wealth & Market Trends" },
    { id: "TECH", label: "Future Technology & Software" },
    { id: "AI", label: "Artificial Intelligence Impact" },
    { id: "PRODUCTIVITY", label: "Digital Workflow Tools" }
];

const groq = new Groq({ apiKey: CONFIG.groqKey });

async function runGroqPublisher() {
    try {
        const selectedNiche = NICHES[Math.floor(Math.random() * NICHES.length)];
        
        console.log("📝 Generating Authority Title...");
        const titleRes = await groq.chat.completions.create({
            messages: [{ role: "user", content: `Create a professional, high-intent SEO title for ${selectedNiche.label} for 2026. Avoid clickbait, focus on value.` }],
            model: "llama-3.3-70b-versatile",
        });
        const targetTitle = titleRes.choices[0].message.content.trim();

        console.log("🤖 Generating High-Quality Article (1000+ words)...");
        const contentRes = await groq.chat.completions.create({
            messages: [{ 
                role: "user", 
                content: `Write a comprehensive, professional article about "${targetTitle}".
                
                STRICT GUIDELINES:
                1. Length: Over 1000 words of high-value, unique information.
                2. Structure: <h1> title, deep intro, several <h2> and <h3> subheadings, rich paragraphs, and a strategic conclusion.
                3. Links: Include 5 to 10 natural external links to authority sources (e.g., tech documentation, official platforms, or research). 
                   Use: <a href='URL' target='_blank' rel='noopener'>Text</a>.
                4. Formatting: Use <strong> for key terms. Use <ul class='premium-list'> or <ol class='premium-list'> for steps.
                5. Keywords: Based on the generated content, provide 5 relevant SEO tags (labels) separated by commas.

                Output ONLY a JSON object:
                {
                    "articleHtml": "Complete HTML content starting from <h1>",
                    "dynamicLabels": ["tag1", "tag2", "tag3", "tag4", "tag5"]
                }` 
            }],
            model: "llama-3.3-70b-versatile",
            response_format: { type: "json_object" } 
        });
        
        const result = JSON.parse(contentRes.choices[0].message.content);

        console.log("🎨 Fetching Visual Asset...");
        const imgDescRes = await groq.chat.completions.create({
            messages: [{ role: "user", content: `Minimalist high-tech background for: "${targetTitle}". No text.` }],
            model: "llama-3.3-70b-versatile",
        });
        const imgPrompt = encodeURIComponent(imgDescRes.choices[0].message.content.trim());
        const finalImageUrl = `https://image.pollinations.ai/prompt/${imgPrompt}?width=1200&height=630&nologo=true`; 

        const finalHtml = `
            <style>
                .main-seo-wrapper { font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.8; color: #333; max-width: 900px; margin: 0 auto; padding: 20px; }
                .hero-image-box { text-align: center; margin-bottom: 40px; }
                .hero-image-box img { width: 100%; border-radius: 15px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); }
                
                .article-body-content h1 { color: #0077b6; font-size: 32px; text-align: center; margin-bottom: 30px; font-weight: 800; }
                .article-body-content h2 { color: #005f73; font-size: 26px; border-left: 6px solid #00bbf9; padding-left: 15px; margin-top: 45px; }
                .article-body-content h3 { color: #0a9396; font-size: 22px; margin-top: 35px; }
                
                .article-body-content p { font-size: 18px; margin-bottom: 25px; color: #444; text-align: justify; }
                .article-body-content strong { color: #b8860b; } /* أصفر ذهبي قاتم للكلمات المهمة */
                
                .article-body-content a { color: #0077b6; text-decoration: underline; font-weight: 600; transition: 0.3s; }
                .article-body-content a:hover { color: #00b4d8; text-decoration: none; }
                
                .premium-list { background: #fdfdfd; padding: 25px 50px; border-radius: 12px; border: 1px solid #eef2f3; margin: 30px 0; }
                .premium-list li { margin-bottom: 15px; font-size: 17px; color: #555; }
                
                .article-footer-note { text-align: center; font-size: 13px; color: #999; margin-top: 60px; padding-top: 20px; border-top: 1px solid #eee; letter-spacing: 1px; }
                
                @media (prefers-color-scheme: dark) {
                    .main-seo-wrapper { color: #e0e0e0; }
                    .article-body-content p { color: #ccc; }
                    .premium-list { background: #1a1a1a; border-color: #333; }
                    .article-body-content h1, .article-body-content h2, .article-body-content h3 { color: #00b4d8; }
                }
            </style>

            <div class="main-seo-wrapper" dir="ltr">
                <div class="hero-image-box">
                    <img src="${finalImageUrl}" alt="${targetTitle}" loading="lazy">
                </div>
                
                <div class="article-body-content">
                    ${result.articleHtml}
                </div>
                
                <div class="article-footer-note">
                    PUBLISHED BY ${CONFIG.siteName} • AI EDITORIAL SYSTEM 2026
                </div>
            </div>
        `;

        console.log("🚀 Publishing with Dynamic Labels: " + result.dynamicLabels.join(", "));
        const oauth2Client = new google.auth.OAuth2(CONFIG.clientId, CONFIG.clientSecret);
        oauth2Client.setCredentials({ refresh_token: CONFIG.refreshToken });
        const blogger = google.blogger({ version: "v3", auth: oauth2Client });

        await blogger.posts.insert({
            blogId: CONFIG.blogId,
            requestBody: { 
                title: targetTitle, 
                content: finalHtml, 
                labels: result.dynamicLabels // هنا يتم استخدام الكلمات المفتاحية الناتجة من المحتوى
            }
        });

        console.log(`✨ SUCCESS! Article "${targetTitle}" is live.`);
    } catch (error) {
        console.error("🔴 Error:", error.message);
    }
}

runGroqPublisher();
