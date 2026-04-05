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
    { id: "MONEY", label: "Financial Growth", key: "Income" },
    { id: "AI", label: "AI Revolution", key: "Intelligence" },
    { id: "FIX", label: "Tech Solutions", key: "Troubleshooting" },
    { id: "APPS", label: "Digital Tools", key: "Applications" }
];

const groq = new Groq({ apiKey: CONFIG.groqKey });

async function runGroqPublisher() {
    try {
        const selectedNiche = NICHES[Math.floor(Math.random() * NICHES.length)];
        
        // 1. توليد العنوان
        console.log("📝 Generating Title...");
        const titleRes = await groq.chat.completions.create({
            messages: [{ role: "user", content: `Generate a high-authority, viral SEO title for ${selectedNiche.label} (Year 2026). NO quotes. NO emojis.` }],
            model: "llama-3.3-70b-versatile",
        });
        const targetTitle = titleRes.choices[0].message.content.trim();

        // 2. توليد المحتوى (مقال طويل، بدون إيموجيات معقدة، بدون روابط وهمية)
        console.log("🤖 Generating Detailed Content (1000+ words)...");
        const contentRes = await groq.chat.completions.create({
            messages: [{ 
                role: "user", 
                content: `Write a highly detailed, comprehensive SEO article for "${targetTitle}". 
                CRITICAL INSTRUCTIONS:
                1. Length MUST be over 1000 words. Write extremely detailed and long paragraphs.
                2. DO NOT use emojis. Blogger does not support them well. Use normal text.
                3. DO NOT include ANY fake links or anchor tags with "#".
                4. Include at least 5 deep main sections (<h2>) and an extensive FAQ section at the end.
                
                You MUST output ONLY a valid JSON object matching this exact structure:
                {
                    "introSubtitle": "Catchy subtitle (No emojis)",
                    "introText": "A powerful, long introduction paragraph that hooks the reader and explains the core value of the article.",
                    "features": [
                        { "number": "01", "keyword": "STRATEGY", "title": "Feature 1", "desc": "Detailed description of this feature." },
                        { "number": "02", "keyword": "GROWTH", "title": "Feature 2", "desc": "Detailed description of this feature." },
                        { "number": "03", "keyword": "REVENUE", "title": "Feature 3", "desc": "Detailed description of this feature." }
                    ],
                    "articleBodyHtml": "The full article body in clean HTML. Use <h2>, <h3>, <p>, <strong>. Make it very long and detailed. Include at least one list using EXACTLY this syntax: <ul class='kiro-styled-list'><li>...</li></ul>"
                }` 
            }],
            model: "llama-3.3-70b-versatile",
            response_format: { type: "json_object" }
        });
        
        const articleData = JSON.parse(contentRes.choices[0].message.content);

        // 3. الصورة الفريدة
        console.log("🎨 Generating Unique Image Prompt...");
        const imgDescRes = await groq.chat.completions.create({
            messages: [{ role: "user", content: `Briefly describe a cinematic, professional background for: "${targetTitle}". No text in image. 5 words.` }],
            model: "llama-3.3-70b-versatile",
        });
        const imgPrompt = encodeURIComponent(imgDescRes.choices[0].message.content.trim());
        const finalImageUrl = `https://image.pollinations.ai/prompt/${imgPrompt}?width=1200&height=600&nologo=true`; 

        // 4. التصميم المحدث (متناسق، خالي من الفراغات، ملائم للنصوص الطويلة)
        console.log("🏗️ Assembling Clean HTML...");
        const finalHtml = `
        <div class="kiro-premium-wrapper" dir="ltr">
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap');

                .kiro-premium-wrapper {
                    font-family: 'Plus Jakarta Sans', sans-serif;
                    line-height: 1.8;
                    color: #2c3e50;
                    max-width: 1100px;
                    margin: 0 auto;
                    padding: 0;
                }

                @media (prefers-color-scheme: dark) {
                    .kiro-premium-wrapper { color: #ecf0f1; }
                }

                /* ========== العنوان الرئيسي ========== */
                .kiro-main-title {
                    font-size: clamp(32px, 5vw, 54px);
                    font-weight: 800;
                    line-height: 1.2;
                    margin: 20px 0 30px;
                    color: #1e3c72;
                }

                @media (prefers-color-scheme: dark) {
                    .kiro-main-title { color: #3498db; }
                }

                /* ========== الهيدر متصل بالصورة لتقليل الفراغات ========== */
                .kiro-hero-box {
                    border-radius: 20px;
                    overflow: hidden;
                    background: #f8f9fa;
                    margin-bottom: 40px;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.08);
                    border: 1px solid #e9ecef;
                }

                @media (prefers-color-scheme: dark) {
                    .kiro-hero-box { background: #1a1a1a; border-color: #333; }
                }

                .kiro-featured-img {
                    width: 100%;
                    height: auto;
                    min-height: 350px;
                    max-height: 500px;
                    object-fit: cover;
                    display: block;
                }

                .kiro-intro-card {
                    padding: 35px;
                }

                .kiro-intro-card h2 {
                    font-size: 24px;
                    margin: 0 0 15px 0;
                    color: #e67e22;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                }

                .kiro-intro-card p {
                    font-size: 18px;
                    margin: 0;
                    opacity: 0.9;
                }

                /* ========== شبكة المميزات ========== */
                .kiro-features-grid {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 20px;
                    margin-bottom: 40px;
                }

                @media (max-width: 900px) {
                    .kiro-features-grid { grid-template-columns: 1fr; }
                }

                .kiro-feature-item {
                    padding: 25px;
                    background: #ffffff;
                    border-radius: 16px;
                    border: 1px solid #e1e8ed;
                    box-shadow: 0 4px 15px rgba(0,0,0,0.03);
                }

                @media (prefers-color-scheme: dark) {
                    .kiro-feature-item { background: #222; border-color: #444; }
                }

                .kiro-feature-item span {
                    font-weight: 800;
                    color: #3498db;
                    font-size: 13px;
                    letter-spacing: 1.5px;
                    display: inline-block;
                    padding-bottom: 5px;
                    border-bottom: 2px solid #3498db;
                    margin-bottom: 15px;
                }

                .kiro-feature-item h3 {
                    font-size: 20px;
                    margin: 0 0 10px;
                    font-weight: 700;
                }

                .kiro-feature-item p {
                    font-size: 15px;
                    margin: 0;
                    opacity: 0.85;
                }

                /* ========== جسم المقال (مهيأ للنصوص الطويلة) ========== */
                .kiro-article-body {
                    background: #ffffff;
                    padding: 40px;
                    border-radius: 20px;
                    border: 1px solid #e1e8ed;
                }

                @media (prefers-color-scheme: dark) {
                    .kiro-article-body { background: #1e1e1e; border-color: #333; }
                }

                .kiro-article-body h2 {
                    font-size: 28px;
                    border-bottom: 2px solid #ecf0f1;
                    padding-bottom: 10px;
                    margin: 40px 0 20px 0;
                    font-weight: 700;
                }

                @media (prefers-color-scheme: dark) {
                    .kiro-article-body h2 { border-color: #444; }
                }

                .kiro-article-body h2:first-child {
                    margin-top: 0;
                }

                .kiro-article-body h3 {
                    font-size: 22px;
                    margin: 30px 0 15px;
                    color: #3498db;
                    font-weight: 600;
                }

                .kiro-article-body p {
                    font-size: 18px;
                    margin-bottom: 25px;
                    text-align: justify;
                }

                /* ========== قائمة منسقة (بدون إيموجي لتوافق بلوجر) ========== */
                .kiro-styled-list {
                    list-style: none;
                    padding: 0;
                    margin: 30px 0;
                    background: #f8f9fa;
                    padding: 20px;
                    border-radius: 12px;
                    border-left: 4px solid #3498db;
                }

                @media (prefers-color-scheme: dark) {
                    .kiro-styled-list { background: #2a2a2a; }
                }

                .kiro-styled-list li {
                    padding: 10px 0;
                    border-bottom: 1px solid rgba(128,128,128,0.2);
                    display: flex;
                    align-items: center;
                }

                .kiro-styled-list li:last-child {
                    border-bottom: none;
                }

                .kiro-styled-list li::before {
                    content: "•";
                    color: #3498db;
                    font-size: 24px;
                    line-height: 1;
                    margin-right: 15px;
                }

                /* ========== الفوتر ========== */
                .kiro-footer {
                    text-align: center;
                    padding: 30px 20px;
                    margin-top: 40px;
                    font-size: 13px;
                    letter-spacing: 2px;
                    color: #7f8c8d;
                    border-top: 1px solid #e1e8ed;
                }

                @media (prefers-color-scheme: dark) {
                    .kiro-footer { border-color: #333; color: #aaa; }
                }
            </style>

            <h1 class="kiro-main-title">${targetTitle}</h1>

            <div class="kiro-hero-box">
                <img class="kiro-featured-img" src="${finalImageUrl}" alt="${targetTitle}">
                <div class="kiro-intro-card">
                    <h2>${articleData.introSubtitle}</h2>
                    <p>${articleData.introText}</p>
                </div>
            </div>

            <div class="kiro-features-grid">
                ${articleData.features.map(f => `
                <div class="kiro-feature-item">
                    <span>${f.number} // ${f.keyword}</span>
                    <h3>${f.title}</h3>
                    <p>${f.desc}</p>
                </div>
                `).join('')}
            </div>

            <div class="kiro-article-body">
                ${articleData.articleBodyHtml}
            </div>

            <div class="kiro-footer">
                ENGINEERED BY ${CONFIG.siteName} AI SYSTEM • EXCLUSIVE EDITORIAL 2026
            </div>
        </div>
        `;

        // 5. النشر
        console.log("🚀 Publishing to Blogger...");
        const oauth2Client = new google.auth.OAuth2(CONFIG.clientId, CONFIG.clientSecret);
        oauth2Client.setCredentials({ refresh_token: CONFIG.refreshToken });
        const blogger = google.blogger({ version: "v3", auth: oauth2Client });

        const response = await blogger.posts.insert({
            blogId: CONFIG.blogId,
            requestBody: { 
                title: targetTitle, 
                content: finalHtml, 
                labels: [selectedNiche.id, "Premium", "2026"] 
            }
        });

        console.log(`✨ DONE! Article Published: ${response.data.url}`);
    } catch (error) {
        console.error("🔴 Error:", error.message);
    }
}

runGroqPublisher();
