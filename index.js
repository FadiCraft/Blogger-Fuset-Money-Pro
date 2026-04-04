const Groq = require("groq-sdk");
const { google } = require("googleapis");

const CONFIG = {
    groqKey: "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",
    blogId: "8249860422330426533",
    clientId: "872415365656-7qribadnc7k2u21kl6jjcbatdueevifh.apps.googleusercontent.com",
    clientSecret: "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",
    refreshToken: "1//04yti9k2agPknCgYIARAAGAQSNwF-L9IrTZPKt5Fqbg2vrM9sBtOks9cnY4M7Idg0LToQnlbYGME06k20vcyr_SVmYk1H_yZJdEc",
    siteName: "TECH PULSE 2026" 
};

// 🌟 مصفوفة الأقسام مع روابط حقيقية وكلمات مفتاحية فريدة
const CONTENT_NICHES = [
    { 
        id: "money", 
        topic: "Make Money Online & Side Hustles", 
        keywords: ["money", "finance", "earnings"], 
        trustedLinks: ["https://www.forbes.com/advisor/investing/", "https://www.entrepreneur.com/"] 
    },
    { 
        id: "ai", 
        topic: "Latest AI Tools & Innovations", 
        keywords: ["ai", "tech", "intelligence"], 
        trustedLinks: ["https://www.theverge.com/ai-artificial-intelligence", "https://openai.com/news/"] 
    },
    { 
        id: "apps", 
        topic: "Essential Apps & Website Reviews", 
        keywords: ["apps", "software", "reviews"], 
        trustedLinks: ["https://alternativeto.net/", "https://www.pcmag.com/reviews"] 
    },
    { 
        id: "fix", 
        topic: "Tech Troubleshooting & Problem Solving", 
        keywords: ["fix", "guide", "support"], 
        trustedLinks: ["https://www.ifixit.com/", "https://stackoverflow.blog/"] 
    },
    { 
        id: "trends", 
        topic: "Viral Tech Trends & Future Insights", 
        keywords: ["trends", "viral", "future"], 
        trustedLinks: ["https://trends.google.com/trends/", "https://www.wired.com/"] 
    }
];

const groq = new Groq({ apiKey: CONFIG.groqKey });

async function runGroqPublisher() {
    try {
        // 1. اختيار قسم عشوائي تماماً
        const niche = CONTENT_NICHES[Math.floor(Math.random() * CONTENT_NICHES.length)];
        console.log(`🎲 Selected Category: ${niche.topic}`);

        // 2. إنشاء عنوان جذاب
        const topicRes = await groq.chat.completions.create({
            messages: [{ role: "user", content: `Generate a high-CTR English blog title for: ${niche.topic}. Make it professional. ONLY the title text.` }],
            model: "llama-3.3-70b-versatile",
        });
        const targetTitle = topicRes.choices[0].message.content.trim().replace(/["']/g, "");

        // 3. كتابة المقال الطويل (SEO Optimized)
        const contentPrompt = `Write a 1500-word professional English blog post for "${targetTitle}".
        Structure:
        - Introduction with a hook.
        - "Why this Matters" section (Use a highlight box style later).
        - Detailed H2 and H3 subheadings.
        - A bulleted list of "Top Benefits".
        - A "Pro Tip" section.
        - Conclusion & FAQ.
        IMPORTANT: Include these 2 real links naturally: ${niche.trustedLinks.join(", ")}.
        Use ONLY valid HTML tags (<p>, <h2>, <h3>, <ul>, <li>, <a>). No markdown.`;
        
        const contentRes = await groq.chat.completions.create({
            messages: [{ role: "user", content: contentPrompt }],
            model: "llama-3.3-70b-versatile",
        });
        let articleBody = contentRes.choices[0].message.content.replace(/```html|```/g, "").trim();

        // 4. صورة البنر
        const imgPromptRes = await groq.chat.completions.create({
            messages: [{ role: "user", content: `3-word visual description for a cinematic background: ${niche.topic}` }],
            model: "llama-3.3-70b-versatile",
        });
        let cleanImgPrompt = encodeURIComponent(imgPromptRes.choices[0].message.content.trim());
        const imageUrl = `https://image.pollinations.ai/prompt/${cleanImgPrompt}?width=1200&height=630&nologo=true`;

        // 5. التصميم الفاخر (UI/UX)
        const finalHtml = `
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap');
                .article-wrapper { font-family: 'Inter', sans-serif; color: #333; line-height: 1.8; max-width: 900px; margin: auto; }
                
                /* البنر الاحترافي مع نص واضح في كل المودات */
                .main-banner { position: relative; border-radius: 20px; overflow: hidden; background: #000; margin-bottom: 40px; }
                .banner-image { width: 100%; height: 450px; object-fit: cover; display: block; opacity: 0.5; filter: contrast(1.2); }
                .banner-text-area { position: absolute; bottom: 0; left: 0; right: 0; padding: 50px; background: linear-gradient(0deg, rgba(0,0,0,0.95) 20%, rgba(0,0,0,0) 100%); }
                .category-badge { background: #00d2ff; color: #000; padding: 4px 12px; border-radius: 5px; font-weight: bold; font-size: 12px; text-transform: uppercase; }
                .banner-h1 { color: #ffffff !important; font-size: 36px; margin: 15px 0; line-height: 1.2; text-shadow: 0 2px 10px rgba(0,0,0,0.5); }
                
                /* لمسات فخامة: ألوان فاتحة وخلفيات مميزة */
                .pro-content h2 { color: #2c3e50; border-left: 5px solid #00d2ff; padding-left: 15px; margin-top: 40px; }
                .highlight-box { background: #e3f2fd; border-radius: 12px; padding: 25px; margin: 30px 0; border: 1px solid #bbdefb; color: #0d47a1; }
                .tip-box { background: #fffde7; border-radius: 12px; padding: 20px; margin: 20px 0; border: 1px solid #fff9c4; color: #f57f17; font-weight: 500; }
                
                /* الروابط */
                .article-wrapper a { color: #007bff; text-decoration: underline; font-weight: 600; }
                
                /* التوافق مع الوضع الليلي للمدونة */
                @media (prefers-color-scheme: dark) {
                    .article-wrapper { color: #e0e0e0; }
                    .pro-content h2 { color: #00d2ff; }
                    .highlight-box { background: rgba(0, 210, 255, 0.1); border-color: #00d2ff; color: #81d4fa; }
                    .tip-box { background: rgba(255, 235, 59, 0.1); border-color: #fbc02d; color: #fff176; }
                }
            </style>

            <div class="article-wrapper" dir="ltr">
                <div class="main-banner">
                    <img class="banner-image" src="${imageUrl}" alt="Banner">
                    <div class="banner-text-area">
                        <span class="category-badge">${niche.id}</span>
                        <h1 class="banner-h1">${targetTitle}</h1>
                        <div style="color: #ccc; font-size: 14px;">Premium Insights by ${CONFIG.siteName} • 2026</div>
                    </div>
                </div>
                
                <div class="pro-content">
                    <div class="highlight-box">
                        <strong>Quick Insight:</strong> This guide explores the latest methodologies in ${niche.id} to give you a competitive edge this year.
                    </div>
                    ${articleBody}
                </div>

                <div class="tip-box">
                    💡 <strong>Expert Tip:</strong> Always verify links and stay updated with the latest changes in the ${niche.id} ecosystem for maximum results.
                </div>
            </div>
        `;

        // 6. النشر مع الـ Labels الصحيحة
        const oauth2Client = new google.auth.OAuth2(CONFIG.clientId, CONFIG.clientSecret);
        oauth2Client.setCredentials({ refresh_token: CONFIG.refreshToken });
        const blogger = google.blogger({ version: "v3", auth: oauth2Client });

        const response = await blogger.posts.insert({
            blogId: CONFIG.blogId,
            requestBody: { 
                title: targetTitle, 
                content: finalHtml, 
                labels: [niche.id, "Insights", "2026"] // سيضع الكلمة الفريدة (money, ai, fix..)
            }
        });
        console.log(`✅ Live at: ${response.data.url}`);
    } catch (error) {
        console.error("❌ Error:", error.message);
    }
}

runGroqPublisher();
