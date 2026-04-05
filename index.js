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
        
        // 1. إنشاء عنوان SEO قوي جداً
        console.log("📝 Generating Title...");
        const titleRes = await groq.chat.completions.create({
            messages: [{ role: "user", content: `Generate a high-authority, viral SEO title for ${selectedNiche.label} (Year 2026). NO quotes.` }],
            model: "llama-3.3-70b-versatile",
        });
        const targetTitle = titleRes.choices[0].message.content.trim();

        // 2. كتابة محتوى منظم بصيغة JSON ليتناسب مع التصميم الاحترافي والـ SEO
        console.log("🤖 Generating Detailed Content in JSON Format...");
        const contentRes = await groq.chat.completions.create({
            messages: [{ 
                role: "user", 
                content: `Write a highly engaging, extremely detailed, and informative SEO article for "${targetTitle}". 
                REQUIREMENTS:
                1. The article body must be long-form, comprehensive, and valuable (aim for 1500 to 3000 words).
                2. You MUST include relevant external links contextually within the text (e.g., linking to YouTube, official tools, or authoritative sites). Use EXACTLY this syntax for links: <a href="URL" target="_blank" rel="noopener noreferrer">Link Text</a>.
                
                You MUST output ONLY a valid JSON object matching this exact structure (no extra text before or after):
                {
                    "introSubtitle": "Catchy subtitle with an emoji (e.g. ⚡ The AI Gold Rush)",
                    "introText": "A powerful and engaging 2-sentence introduction paragraph.",
                    "features": [
                        { "number": "01", "icon": "🚀", "keyword": "STRATEGY", "title": "Feature 1", "desc": "Short description" },
                        { "number": "02", "icon": "📊", "keyword": "GROWTH", "title": "Feature 2", "desc": "Short description" },
                        { "number": "03", "icon": "🎨", "keyword": "REVENUE", "title": "Feature 3", "desc": "Short description" }
                    ],
                    "articleBodyHtml": "The comprehensive main article body in clean HTML. Use <h2>, <h3>, <p>, <strong>. Make sure paragraphs are well-spaced and easy to read. Include external links with target='_blank'. You MUST include at least one list using EXACTLY this syntax: <ul class='kiro-styled-list'><li>...</li></ul>"
                }` 
            }],
            model: "llama-3.3-70b-versatile",
            response_format: { type: "json_object" } 
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

        // 4. دمج البيانات مع التصميم المستقبلي وتحسين المساحات لـ AdSense
        console.log("🏗️ Assembling Premium HTML...");
        const finalHtml = `
        <div class="kiro-premium-wrapper" dir="ltr">
            <style>
                /* ========== الخطوط والتنسيقات الأساسية ========== */
                @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;600;700;800&display=swap');

                .kiro-premium-wrapper {
                    font-family: 'Plus Jakarta Sans', sans-serif;
                    line-height: 1.8;
                    color: #2c3e50;
                    max-width: 1000px; /* تقليل العرض قليلاً ليكون مريحاً للقراءة */
                    margin: 0 auto;
                    padding: 30px 20px;
                }

                .kiro-premium-wrapper a {
                    color: #3498db;
                    text-decoration: none;
                    border-bottom: 1px solid transparent;
                    transition: all 0.3s ease;
                }

                .kiro-premium-wrapper a:hover {
                    color: #2ecc71;
                    border-bottom: 1px solid #2ecc71;
                }

                /* ========== العنوان الرئيسي ========== */
                .kiro-main-title {
                    font-size: clamp(32px, 5vw, 54px);
                    font-weight: 800;
                    line-height: 1.2;
                    margin-bottom: 40px;
                    background: linear-gradient(135deg, #1e3c72 0%, #2ecc71 50%, #3498db 100%);
                    -webkit-background-clip: text;
                    background-clip: text;
                    -webkit-text-fill-color: transparent;
                }

                /* ========== الهيدر الرئيسي ========== */
                .kiro-hero-box {
                    display: flex;
                    flex-direction: column;
                    gap: 30px;
                    margin-bottom: 50px;
                }

                .kiro-featured-img {
                    width: 100%;
                    height: auto;
                    max-height: 500px;
                    object-fit: cover;
                    border-radius: 20px;
                    box-shadow: 0 15px 35px rgba(0,0,0,0.1);
                }

                .kiro-intro-card {
                    background: #f8f9fa;
                    padding: 35px;
                    border-radius: 20px;
                    border-left: 5px solid #3498db;
                }

                .kiro-intro-card h2 {
                    font-size: 26px;
                    margin: 0 0 15px 0;
                    color: #2c3e50;
                }

                /* ========== شبكة المميزات ========== */
                .kiro-features-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
                    gap: 25px;
                    margin: 50px 0;
                }

                .kiro-feature-item {
                    padding: 30px;
                    background: #ffffff;
                    border-radius: 16px;
                    border: 1px solid #e0e0e0;
                    box-shadow: 0 5px 15px rgba(0,0,0,0.03);
                    transition: transform 0.3s ease;
                }

                .kiro-feature-item:hover {
                    transform: translateY(-5px);
                    border-color: #3498db;
                }

                .kiro-feature-item span {
                    font-weight: 800;
                    color: #3498db;
                    font-size: 13px;
                    letter-spacing: 1.5px;
                    display: inline-block;
                    margin-bottom: 15px;
                }

                .kiro-feature-item h3 {
                    font-size: 20px;
                    margin: 0 0 12px;
                    color: #2c3e50;
                }

                /* ========== مساحات وتنسيقات جسم المقال (AdSense Optimized) ========== */
                .kiro-article-body {
                    margin-top: 40px;
                }

                .kiro-article-body h2 {
                    font-size: 30px;
                    margin: 50px 0 25px 0;
                    color: #1a252f;
                    border-bottom: 2px solid #ecf0f1;
                    padding-bottom: 10px;
                }

                .kiro-article-body h3 {
                    font-size: 24px;
                    margin: 40px 0 20px;
                    color: #2c3e50;
                }

                .kiro-article-body p {
                    font-size: 18px;
                    line-height: 1.9;
                    color: #34495e;
                    margin-bottom: 30px; /* مساحة ممتازة بين الفقرات لإعلانات جوجل */
                }

                /* ========== قائمة منسقة ========== */
                .kiro-styled-list {
                    list-style: none;
                    padding: 0;
                    margin: 30px 0;
                }

                .kiro-styled-list li {
                    padding: 15px 20px;
                    background: #f8f9fa;
                    margin-bottom: 12px;
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    gap: 15px;
                    border-left: 4px solid #2ecc71;
                    font-weight: 500;
                }

                .kiro-styled-list li::before {
                    content: "✨";
                    font-size: 18px;
                }

                /* ========== الفوتر ========== */
                .kiro-footer {
                    text-align: center;
                    padding: 30px 20px;
                    border-top: 1px solid #ecf0f1;
                    margin-top: 60px;
                    font-size: 13px;
                    color: #7f8c8d;
                    letter-spacing: 1.5px;
                }

                /* ========== التجاوب (Responsive) ========== */
                @media (max-width: 768px) {
                    .kiro-premium-wrapper { padding: 15px; }
                    .kiro-intro-card { padding: 25px; }
                    .kiro-article-body p { font-size: 17px; }
                }

                @media (prefers-color-scheme: dark) {
                    .kiro-premium-wrapper { color: #ecf0f1; }
                    .kiro-intro-card, .kiro-feature-item, .kiro-styled-list li { background: #1a252f; border-color: #2c3e50; }
                    .kiro-intro-card h2, .kiro-feature-item h3, .kiro-article-body h2, .kiro-article-body h3 { color: #ecf0f1; }
                    .kiro-article-body p { color: #bdc3c7; }
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
                ENGINEERED BY ${CONFIG.siteName} AI ENGINE | EXCLUSIVE EDITORIAL 2026 | v2.0
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
