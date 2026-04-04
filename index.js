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

// 🌟 تصنيفات ذكية مع كلمات مفتاحية وروابط موثوقة
const NICHES = [
    { id: "MONEY", label: "Financial Growth", key: "Income", links: ["https://www.investopedia.com/", "https://www.nerdwallet.com/"] },
    { id: "AI", label: "AI Revolution", key: "Intelligence", links: ["https://techcrunch.com/category/artificial-intelligence/", "https://www.wired.com/tag/ai/"] },
    { id: "FIX", label: "Tech Solutions", key: "Troubleshooting", links: ["https://www.lifewire.com/", "https://www.makeuseof.com/"] },
    { id: "APPS", label: "Digital Tools", key: "Applications", links: ["https://alternativeto.net/", "https://www.producthunt.com/"] }
];

const groq = new Groq({ apiKey: CONFIG.groqKey });

async function runGroqPublisher() {
    try {
        const selectedNiche = NICHES[Math.floor(Math.random() * NICHES.length)];
        console.log(`🚀 niche selected: ${selectedNiche.id}`);

        // 1. عنوان SEO قوي
        const titleRes = await groq.chat.completions.create({
            messages: [{ role: "user", content: `Create a viral, high-authority English blog title for ${selectedNiche.label}. NO quotes.` }],
            model: "llama-3.3-70b-versatile",
        });
        const targetTitle = titleRes.choices[0].message.content.trim();

        // 2. كتابة محتوى ضخم ومنظم جداً (AdSense Gold)
        const contentRes = await groq.chat.completions.create({
            messages: [{ role: "user", content: `Write a 1500-word SEO article in English for "${targetTitle}". 
            Include: 
            - Comprehensive Intro
            - Table of Contents (as a list)
            - Detailed H2 and H3 sections
            - 'Expert Insights' box
            - 2 external links from: ${selectedNiche.links.join(", ")}
            - Conclusion with FAQ.
            Use ONLY HTML tags. No markdown.` }],
            model: "llama-3.3-70b-versatile",
        });
        let articleBody = contentRes.choices[0].message.content.replace(/```html|```/g, "").trim();

        // 3. توليد وصف صورة "مرتبط فعلياً" بالموضوع
        const imgDescRes = await groq.chat.completions.create({
            messages: [{ role: "user", content: `Describe a professional, high-quality 4k literal photo for: "${targetTitle}". No people if possible, focus on modern tech/money objects. 5 words max.` }],
            model: "llama-3.3-70b-versatile",
        });
        const imgPrompt = encodeURIComponent(imgDescRes.choices[0].message.content.trim());
        const imageUrl = `https://image.pollinations.ai/prompt/${imgPrompt}-premium-corporate-style?width=1200&height=630&nologo=true`;

        // 4. التصميم "المبهر" (The WOW Factor)
        const finalHtml = `
        <div class="master-container" dir="ltr">
            <style>
                /* نظام الألوان المتكيف - حل مشكلة التباين نهائياً */
                :root { --accent: #007bff; --bg-card: #ffffff; --text-main: #1a1a1a; --text-sub: #444444; }
                @media (prefers-color-scheme: dark) {
                    :root { --bg-card: #121212; --text-main: #f5f5f5; --text-sub: #cccccc; }
                }

                .master-container { 
                    font-family: 'Segoe UI', Roboto, sans-serif; 
                    background-color: var(--bg-card); 
                    color: var(--text-main); 
                    padding: 20px; 
                    border-radius: 15px;
                    max-width: 850px;
                    margin: auto;
                    line-height: 1.8;
                }

                /* Thumbnail الاحترافي - العنوان مدمج برمجياً */
                .article-hero {
                    position: relative;
                    width: 100%;
                    height: 450px;
                    border-radius: 20px;
                    overflow: hidden;
                    margin-bottom: 40px;
                    background: #000;
                    box-shadow: 0 20px 40px rgba(0,0,0,0.3);
                }
                .hero-img { width: 100%; height: 100%; object-fit: cover; opacity: 0.6; filter: brightness(0.7); }
                .hero-overlay {
                    position: absolute; inset: 0;
                    display: flex; flex-direction: column; justify-content: center; align-items: center;
                    text-align: center; padding: 40px;
                    background: linear-gradient(to top, rgba(0,0,0,0.8), transparent);
                }
                .hero-badge { background: #ffcc00; color: #000; padding: 5px 15px; border-radius: 50px; font-weight: bold; font-size: 14px; text-transform: uppercase; margin-bottom: 15px; }
                .hero-title { color: #ffffff !important; font-size: 38px; font-weight: 800; text-shadow: 0 4px 15px rgba(0,0,0,1); margin: 0; line-height: 1.2; }
                .hero-footer { position: absolute; bottom: 20px; color: rgba(255,255,255,0.7); font-size: 12px; letter-spacing: 2px; }

                /* تنسيق المحتوى */
                h2 { color: var(--accent); border-bottom: 2px solid #eee; padding-bottom: 10px; margin-top: 40px; font-size: 28px; }
                h3 { font-size: 22px; margin-top: 30px; opacity: 0.9; }
                p { font-size: 18px; margin-bottom: 20px; color: var(--text-sub); }
                
                /* صندوق المعلومات المميز */
                .insight-box {
                    background: linear-gradient(135deg, rgba(0,123,255,0.1), rgba(0,210,255,0.1));
                    border-left: 6px solid var(--accent);
                    padding: 30px; border-radius: 12px; margin: 40px 0;
                }
                
                .seo-link { color: var(--accent); font-weight: bold; text-decoration: none; border-bottom: 1px dashed var(--accent); }
                
                /* Schema Markup للـ SEO */
                .schema-data { display: none; }
            </style>

            <div class="article-hero">
                <img src="${imageUrl}" class="hero-img" alt="${targetTitle}">
                <div class="hero-overlay">
                    <span class="hero-badge">${selectedNiche.key} 2026</span>
                    <h1 class="hero-title">${targetTitle}</h1>
                    <div class="hero-footer">${CONFIG.siteName} • EXCLUSIVE REPORT</div>
                </div>
            </div>

            <script type="application/ld+json" class="schema-data">
            {
              "@context": "https://schema.org",
              "@type": "BlogPosting",
              "headline": "${targetTitle}",
              "image": "${imageUrl}",
              "publisher": { "@type": "Organization", "name": "${CONFIG.siteName}" }
            }
            </script>

            <div class="insight-box">
                <strong>⚡ Quick Overview:</strong> In this deep dive, we explore why <b>${selectedNiche.label}</b> is the most critical factor for success this year.
            </div>

            <div class="article-body">
                ${articleBody}
            </div>

            <div style="text-align: center; margin-top: 50px; opacity: 0.6; font-size: 13px; border-top: 1px solid #eee; padding-top: 20px;">
                © 2026 ${CONFIG.siteName}. All rights reserved. Intellectual Property of Kiro Zozo AI.
            </div>
        </div>
        `;

        // 5. النشر الرسمي
        const oauth2Client = new google.auth.OAuth2(CONFIG.clientId, CONFIG.clientSecret);
        oauth2Client.setCredentials({ refresh_token: CONFIG.refreshToken });
        const blogger = google.blogger({ version: "v3", auth: oauth2Client });

        const response = await blogger.posts.insert({
            blogId: CONFIG.blogId,
            requestBody: { 
                title: targetTitle, 
                content: finalHtml, 
                labels: [selectedNiche.id, selectedNiche.key, "2026", "Featured"] 
            }
        });
        console.log(`✅ EXCELLENCE! Article published: ${response.data.url}`);
    } catch (error) {
        console.error("❌ ERROR IN SYSTEM:", error.message);
    }
}

runGroqPublisher();
