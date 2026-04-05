const Groq = require("groq-sdk");
const { google } = require("googleapis");
const axios = require("axios"); // إذا لم تكن تستخدمه في الكود، يمكنك حذفه

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
        console.log("📝 Generating Title...");
        const titleRes = await groq.chat.completions.create({
            messages: [{ role: "user", content: `Generate a high-authority, viral SEO title for ${selectedNiche.label} (Year 2026). NO quotes.` }],
            model: "llama-3.3-70b-versatile",
        });
        const targetTitle = titleRes.choices[0].message.content.trim();

        // 2. كتابة محتوى منظم بصيغة JSON ليتناسب مع التصميم الاحترافي
        console.log("🤖 Generating Content in JSON Format...");
        const contentRes = await groq.chat.completions.create({
            messages: [{ 
                role: "user", 
                content: `Write a highly engaging SEO article for "${targetTitle}". 
                You MUST output ONLY a valid JSON object matching this exact structure (no extra text):
                {
                    "introSubtitle": "Catchy subtitle with an emoji (e.g. ⚡ The AI Gold Rush)",
                    "introText": "A powerful 2-sentence introduction paragraph.",
                    "ctaText": "Short Call to Action (e.g. 📘 Access Free Guide →)",
                    "features": [
                        { "number": "01", "icon": "🚀", "keyword": "STRATEGY", "title": "Feature 1", "desc": "Short description" },
                        { "number": "02", "icon": "📊", "keyword": "GROWTH", "title": "Feature 2", "desc": "Short description" },
                        { "number": "03", "icon": "🎨", "keyword": "REVENUE", "title": "Feature 3", "desc": "Short description" }
                    ],
                    "articleBodyHtml": "The main article body in clean HTML (about 1000 words). Use <h2>, <h3>, <p>, <strong>, and you MUST include at least one list using EXACTLY this syntax: <ul class='kiro-styled-list'><li>...</li></ul>"
                }` 
            }],
            model: "llama-3.3-70b-versatile",
            response_format: { type: "json_object" } // نجبر الموديل على إرجاع JSON فقط
        });
        
        const articleData = JSON.parse(contentRes.choices[0].message.content);

        // 3. تقنية "الصورة الفريدة"
        console.log("🎨 Generating Unique Image Prompt...");
        const imgDescRes = await groq.chat.completions.create({
            messages: [{ role: "user", content: `Briefly describe a cinematic, futuristic background for: "${targetTitle}". No text in image. 5 words.` }],
            model: "llama-3.3-70b-versatile",
        });
        const imgPrompt = encodeURIComponent(imgDescRes.choices[0].message.content.trim());
        const finalImageUrl = `https://image.pollinations.ai/prompt/${imgPrompt}?width=1200&height=630&nologo=true`; 

        // 4. دمج البيانات مع التصميم المستقبلي (Modern UI / UX)
        console.log("🏗️ Assembling Premium HTML...");
        const finalHtml = `
        <div class="kiro-premium-wrapper" dir="ltr">
            <style>
                /* ========== الخطوط والتنسيقات الأساسية ========== */
                @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;600;700;800&display=swap');

                .kiro-premium-wrapper {
                    font-family: 'Plus Jakarta Sans', sans-serif;
                    line-height: 1.7;
                    color: inherit;
                    max-width: 1200px;
                    margin: 0 auto;
                    padding: 20px;
                    scroll-behavior: smooth;
                }

                /* ========== أنيميشنات خفيفة ========== */
                @keyframes fadeUp {
                    from { opacity: 0; transform: translateY(30px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                @keyframes glowPulse {
                    0% { box-shadow: 0 0 0 0 rgba(52, 152, 219, 0.2); }
                    70% { box-shadow: 0 0 0 15px rgba(52, 152, 219, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(52, 152, 219, 0); }
                }

                .kiro-premium-wrapper > * {
                    animation: fadeUp 0.6s ease forwards;
                    opacity: 0;
                }

                .kiro-premium-wrapper > *:nth-child(1) { animation-delay: 0.05s; }
                .kiro-premium-wrapper > *:nth-child(2) { animation-delay: 0.1s; }
                .kiro-premium-wrapper > *:nth-child(3) { animation-delay: 0.15s; }
                .kiro-premium-wrapper > *:nth-child(4) { animation-delay: 0.2s; }
                .kiro-premium-wrapper > *:nth-child(5) { animation-delay: 0.25s; }

                /* ========== العنوان الرئيسي ========== */
                .kiro-main-title {
                    font-size: clamp(36px, 7vw, 68px);
                    font-weight: 800;
                    line-height: 1.15;
                    margin-bottom: 35px;
                    letter-spacing: -1.5px;
                    background: linear-gradient(135deg, #1e3c72 0%, #2ecc71 50%, #3498db 100%);
                    background-size: 200% auto;
                    -webkit-background-clip: text;
                    background-clip: text;
                    -webkit-text-fill-color: transparent;
                    animation: glowPulse 3s infinite;
                }

                /* ========== الهيدر الرئيسي ========== */
                .kiro-hero-box {
                    display: grid;
                    grid-template-columns: 1.5fr 1fr;
                    gap: 35px;
                    margin-bottom: 60px;
                    background: rgba(255,255,255,0.02);
                    border-radius: 32px;
                    padding: 8px;
                    backdrop-filter: blur(2px);
                }

                .kiro-featured-img {
                    width: 100%;
                    height: 480px;
                    object-fit: cover;
                    border-radius: 28px;
                    box-shadow: 0 25px 45px -12px rgba(0,0,0,0.25);
                    transition: transform 0.4s ease, box-shadow 0.4s ease;
                    will-change: transform;
                }

                .kiro-featured-img:hover {
                    transform: scale(1.01);
                    box-shadow: 0 30px 55px -15px rgba(0,0,0,0.35);
                }

                .kiro-intro-card {
                    background: linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%);
                    backdrop-filter: blur(12px);
                    border: 1px solid rgba(255,255,255,0.1);
                    padding: 35px;
                    border-radius: 28px;
                    transition: all 0.3s ease;
                }

                .kiro-intro-card:hover {
                    border-color: rgba(52, 152, 219, 0.4);
                    transform: translateY(-5px);
                }

                .kiro-intro-card h2 {
                    font-size: 28px;
                    margin: 0 0 15px 0;
                    background: linear-gradient(120deg, #3498db, #2ecc71);
                    -webkit-background-clip: text;
                    background-clip: text;
                    -webkit-text-fill-color: transparent;
                }

                /* ========== شبكة المميزات ========== */
                .kiro-features-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
                    gap: 30px;
                    margin: 50px 0;
                }

                .kiro-feature-item {
                    padding: 30px;
                    background: rgba(52, 152, 219, 0.03);
                    border-radius: 24px;
                    border: 1px solid rgba(52, 152, 219, 0.15);
                    transition: all 0.35s cubic-bezier(0.2, 0.9, 0.4, 1.1);
                    backdrop-filter: blur(4px);
                }

                .kiro-feature-item:hover {
                    background: rgba(52, 152, 219, 0.08);
                    transform: translateY(-8px);
                    border-color: rgba(52, 152, 219, 0.4);
                    box-shadow: 0 20px 35px -12px rgba(0,0,0,0.2);
                }

                .kiro-feature-item span {
                    font-weight: 800;
                    background: linear-gradient(135deg, #3498db, #2ecc71);
                    -webkit-background-clip: text;
                    background-clip: text;
                    -webkit-text-fill-color: transparent;
                    font-size: 13px;
                    letter-spacing: 1.5px;
                    display: inline-block;
                    padding-bottom: 8px;
                    border-bottom: 2px solid rgba(52,152,219,0.3);
                    margin-bottom: 18px;
                }

                .kiro-feature-item h3 {
                    font-size: 22px;
                    margin: 10px 0 12px;
                    font-weight: 700;
                }

                /* ========== جسم المقال ========== */
                .kiro-article-body h2 {
                    font-size: 34px;
                    border-left: 5px solid #3498db;
                    padding-left: 20px;
                    margin: 55px 0 20px 0;
                    font-weight: 700;
                }

                .kiro-article-body h3 {
                    font-size: 26px;
                    margin: 40px 0 15px;
                    color: #3498db;
                    font-weight: 600;
                }

                .kiro-article-body p {
                    font-size: 18px;
                    line-height: 1.8;
                    color: inherit;
                    opacity: 0.88;
                    margin-bottom: 28px;
                }

                /* ========== قائمة منسقة ========== */
                .kiro-styled-list {
                    list-style: none;
                    padding: 0;
                    margin: 35px 0;
                }

                .kiro-styled-list li {
                    padding: 16px 22px;
                    background: rgba(46, 204, 113, 0.04);
                    margin-bottom: 12px;
                    border-radius: 18px;
                    display: flex;
                    align-items: center;
                    gap: 14px;
                    border: 1px solid rgba(46, 204, 113, 0.2);
                    transition: all 0.25s ease;
                    font-weight: 500;
                }

                .kiro-styled-list li:hover {
                    background: rgba(46, 204, 113, 0.09);
                    transform: translateX(8px);
                    border-color: rgba(46, 204, 113, 0.5);
                }

                .kiro-styled-list li::before {
                    content: "✨";
                    font-size: 20px;
                    margin-right: 0;
                    filter: drop-shadow(0 0 3px #2ecc71);
                }

                /* ========== زر تحسين (إضافة قيمة) ========== */
                .kiro-cta-button {
                    display: inline-flex;
                    align-items: center;
                    gap: 10px;
                    background: linear-gradient(105deg, #3498db, #2ecc71);
                    padding: 14px 32px;
                    border-radius: 60px;
                    font-weight: 700;
                    color: white;
                    text-decoration: none;
                    margin: 20px 0 30px;
                    transition: all 0.3s ease;
                    box-shadow: 0 5px 15px rgba(46,204,113,0.3);
                    border: none;
                    cursor: pointer;
                }

                .kiro-cta-button:hover {
                    transform: scale(1.03);
                    box-shadow: 0 8px 25px rgba(46,204,113,0.5);
                    gap: 15px;
                }

                /* ========== الفوتر ========== */
                .kiro-footer {
                    text-align: center;
                    padding: 45px 20px;
                    border-top: 1px solid rgba(128, 128, 128, 0.2);
                    margin-top: 70px;
                    font-size: 12px;
                    letter-spacing: 2.5px;
                    background: linear-gradient(90deg, transparent, rgba(52,152,219,0.05), transparent);
                    border-radius: 50px;
                }

                /* ========== التجاوب المتقدم ========== */
                @media (max-width: 900px) {
                    .kiro-hero-box { grid-template-columns: 1fr; gap: 25px; }
                    .kiro-featured-img { height: 350px; }
                    .kiro-main-title { letter-spacing: -1px; }
                }

                @media (max-width: 600px) {
                    .kiro-premium-wrapper { padding: 12px; }
                    .kiro-featured-img { height: 250px; }
                    .kiro-intro-card { padding: 22px; }
                    .kiro-feature-item { padding: 20px; }
                    .kiro-article-body p { font-size: 16px; }
                    .kiro-styled-list li { padding: 12px 16px; font-size: 14px; }
                }

                @media (prefers-color-scheme: dark) {
                    .kiro-feature-item, .kiro-intro-card { background: rgba(255,255,255,0.03); }
                    .kiro-styled-list li { background: rgba(46, 204, 113, 0.08); }
                }
            </style>

            <h1 class="kiro-main-title">${targetTitle}</h1>

            <div class="kiro-hero-box">
                <img class="kiro-featured-img" src="${finalImageUrl}" alt="${targetTitle}">
                <div class="kiro-intro-card">
                    <h2>${articleData.introSubtitle}</h2>
                    <p>${articleData.introText}</p>
                    <a href="#" class="kiro-cta-button">${articleData.ctaText}</a>
                </div>
            </div>

            <div class="kiro-features-grid">
                ${articleData.features.map(f => `
                <div class="kiro-feature-item">
                    <span>${f.icon} ${f.number} // ${f.keyword}</span>
                    <h3>${f.title}</h3>
                    <p>${f.desc}</p>
                </div>
                `).join('')}
            </div>

            <div class="kiro-article-body">
                ${articleData.articleBodyHtml}
            </div>

            <div class="kiro-footer">
                🧠 ENGINEERED BY ${CONFIG.siteName} AI ENGINE • EXCLUSIVE EDITORIAL 2026 • <span style="letter-spacing:0;">v2.0</span>
            </div>
        </div>
        `;

        // 5. النشر عبر API
        console.log("🚀 Publishing to Blogger...");
        const oauth2Client = new google.auth.OAuth2(CONFIG.clientId, CONFIG.clientSecret);
        oauth2Client.setCredentials({ refresh_token: CONFIG.refreshToken });
        const blogger = google.blogger({ version: "v3", auth: oauth2Client });

        const response = await blogger.posts.insert({
            blogId: CONFIG.blogId,
            requestBody: { 
                title: targetTitle, 
                content: finalHtml, 
                labels: [selectedNiche.id, "Kiro-Premium-AI", "2026"] 
            }
        });

        console.log(`✨ DONE! Article Published Successfully: ${response.data.url}`);
    } catch (error) {
        console.error("🔴 Error:", error.message);
    }
}

runGroqPublisher();
