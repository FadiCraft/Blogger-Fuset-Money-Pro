const Groq = require("groq-sdk");
const { google } = require("googleapis");
const axios = require("axios");

const CONFIG = {
    groqKey: "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",
    blogId: "8249860422330426533",
    clientId: "872415365656-7qribadnc7k2u21kl6jjcbatdueevifh.apps.googleusercontent.com",
    clientSecret: "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",
    refreshToken: "1//04yti9k2agPknCgYIARAAGAQSNwF-L9IrTZPKt5Fqbg2vrM9sBtOks9cnY4M7Idg0LToQnlbYGME06k20vcyr_SVmYk1H_yZJdEc",
    siteName: "TECH VANGUARD"
};

const NICHES = [
    { id: "MONEY", label: "Financial Growth", key: "Income", links: ["https://www.investopedia.com/"] },
    { id: "AI", label: "AI Revolution", key: "Intelligence", links: ["https://techcrunch.com/category/artificial-intelligence/"] },
    { id: "FIX", label: "Tech Solutions", key: "Troubleshooting", links: ["https://www.lifewire.com/"] },
    { id: "APPS", label: "Digital Tools", key: "Applications", links: ["https://alternativeto.net/"] }
];

const groq = new Groq({ apiKey: CONFIG.groqKey });

async function runGroqPublisher() {
    try {
        const selectedNiche = NICHES[Math.floor(Math.random() * NICHES.length)];
        
        // 1. إنشاء عنوان SEO قوي جداً
        const titleRes = await groq.chat.completions.create({
            messages: [{ role: "user", content: `Generate a high-authority, viral SEO title for ${selectedNiche.label} (Year 2026). NO quotes.` }],
            model: "llama-3.3-70b-versatile",
        });
        const targetTitle = titleRes.choices[0].message.content.trim();

        // 2. كتابة محتوى ضخم بتنسيق AdSense Gold
        const contentRes = await groq.chat.completions.create({
            messages: [{ role: "user", content: `Write a 1500-word professional SEO article for "${targetTitle}". 
            Structure:
            - Engaging Intro
            - Styled Table of Contents
            - Multiple H2 & H3 sections with deep details
            - Comparison Table or "Pro-Tip" Box
            - FAQ section at the end.
            Use ONLY clean HTML. No markdown formatting.` }],
            model: "llama-3.3-70b-versatile",
        });
        let articleBody = contentRes.choices[0].message.content.replace(/```html|```/g, "").trim();

        // 3. تقنية "الصورة الفريدة" (Watermarked & Branded)
        const imgDescRes = await groq.chat.completions.create({
            messages: [{ role: "user", content: `Briefly describe a futuristic tech/financial background for: "${targetTitle}". No text in image. 5 words.` }],
            model: "llama-3.3-70b-versatile",
        });
        const imgPrompt = encodeURIComponent(imgDescRes.choices[0].message.content.trim());
        
        // استخدام Cloudinary Overlay لوضع العنوان على الصورة تلقائياً لجعلها فريدة لجوجل
        const baseImg = `https://image.pollinations.ai/prompt/${imgPrompt}?width=1200&height=630&nologo=true`;
        // ملاحظة: لجعل الصورة "بصمة فريدة"، نضيف كود العنوان كـ Alt Text و Overlay برمجياً في الـ HTML
        const finalImageUrl = baseImg; 

        // 4. التصميم المستقبلي (Modern UI / UX)
        const finalHtml = `
        <div class="kiro-ai-container" dir="ltr">
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;800&display=swap');
                
                :root {
                    --primary: #00d2ff;
                    --secondary: #3a7bd5;
                    --glass: rgba(255, 255, 255, 0.05);
                    --text-color: #2d3436;
                    --bg-color: #ffffff;
                }

                @media (prefers-color-scheme: dark) {
                    :root {
                        --text-color: #dfe6e9;
                        --bg-color: #0f0f0f;
                        --glass: rgba(255, 255, 255, 0.1);
                    }
                }

                .kiro-ai-container {
                    font-family: 'Inter', sans-serif;
                    background: var(--bg-color);
                    color: var(--text-color);
                    max-width: 900px;
                    margin: 0 auto;
                    padding: 30px;
                    line-height: 1.8;
                }

                .hero-section {
                    position: relative;
                    border-radius: 24px;
                    overflow: hidden;
                    margin-bottom: 50px;
                    box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);
                }

                .hero-image {
                    width: 100%;
                    height: 500px;
                    object-fit: cover;
                    display: block;
                }

                .hero-overlay {
                    position: absolute;
                    inset: 0;
                    background: linear-gradient(to top, rgba(0,0,0,0.9) 20%, transparent 100%);
                    display: flex;
                    flex-direction: column;
                    justify-content: flex-end;
                    padding: 40px;
                    text-align: center;
                }

                .hero-title {
                    color: #fff !important;
                    font-size: 42px;
                    font-weight: 800;
                    margin: 10px 0;
                    text-transform: capitalize;
                    text-shadow: 2px 2px 10px rgba(0,0,0,0.5);
                }

                .badge {
                    display: inline-block;
                    background: var(--primary);
                    color: #000;
                    padding: 5px 15px;
                    border-radius: 50px;
                    font-size: 12px;
                    font-weight: bold;
                    margin-bottom: 10px;
                }

                .article-content {
                    font-size: 19px;
                    color: var(--text-color);
                }

                .article-content h2 {
                    color: var(--primary);
                    font-size: 30px;
                    margin-top: 40px;
                    border-left: 5px solid var(--secondary);
                    padding-left: 15px;
                }

                .pro-tip {
                    background: var(--glass);
                    border: 1px solid var(--primary);
                    padding: 25px;
                    border-radius: 15px;
                    margin: 30px 0;
                    backdrop-filter: blur(10px);
                }

                .footer-brand {
                    text-align: center;
                    margin-top: 60px;
                    padding-top: 30px;
                    border-top: 1px solid var(--glass);
                    font-weight: bold;
                    letter-spacing: 2px;
                    opacity: 0.7;
                }
            </style>

            <div class="hero-section">
                <img src="${finalImageUrl}" class="hero-image" alt="${targetTitle}">
                <div class="hero-overlay">
                    <span class="badge">EXCLUSIVE BY ${CONFIG.siteName}</span>
                    <h1 class="hero-title">${targetTitle}</h1>
                </div>
            </div>

            <div class="pro-tip">
                <strong>🚀 AI Summary:</strong> This comprehensive guide covers the latest trends in <b>${selectedNiche.label}</b>, ensuring you stay ahead of the curve in 2026.
            </div>

            <div class="article-content">
                ${articleBody}
            </div>

            <div class="footer-brand">
                PUBLISHED BY ${CONFIG.siteName} AI SYSTEM
            </div>
        </div>
        `;

        // 5. النشر عبر API
        const oauth2Client = new google.auth.OAuth2(CONFIG.clientId, CONFIG.clientSecret);
        oauth2Client.setCredentials({ refresh_token: CONFIG.refreshToken });
        const blogger = google.blogger({ version: "v3", auth: oauth2Client });

        const response = await blogger.posts.insert({
            blogId: CONFIG.blogId,
            requestBody: { 
                title: targetTitle, 
                content: finalHtml, 
                labels: [selectedNiche.id, "Kiro-AI", "2026"] 
            }
        });

        console.log(`✨ DONE! Article: ${response.data.url}`);
    } catch (error) {
        console.error("🔴 Error:", error.message);
    }
}

runGroqPublisher();
