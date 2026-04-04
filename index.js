const Groq = require("groq-sdk");
const { google } = require("googleapis");

const CONFIG = {
    groqKey: "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",
    blogId: "8249860422330426533",
    clientId: "872415365656-7qribadnc7k2u21kl6jjcbatdueevifh.apps.googleusercontent.com",
    clientSecret: "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",
    refreshToken: "1//04yti9k2agPknCgYIARAAGAQSNwF-L9IrTZPKt5Fqbg2vrM9sBtOks9cnY4M7Idg0LToQnlbYGME06k20vcyr_SVmYk1H_yZJdEc",
    siteName: "Kiro Zozo Tech" // غير هذا لاسم موقعك الفعلي
};

// 🌟 النظام الجديد: 10 أقسام بكلماتها المفتاحية وتخصصاتها
const CONTENT_NICHES = [
    { name: "الربح من الإنترنت", prompt: "Make Money Online, passive income, fast websites to earn money", labels: ["Make Money", "Business", "Income"] },
    { name: "أدوات الذكاء الاصطناعي", prompt: "New trending AI Tools, Product Hunt alternatives, AI for productivity", labels: ["AI Tools", "Technology", "Trends"] },
    { name: "تطبيقات ومواقع", prompt: "Best useful Apps and Websites, APKMirror style reviews, AlternativeTo", labels: ["Apps", "Websites", "Reviews"] },
    { name: "حل المشاكل التقنية", prompt: "How to fix common tech problems, PC errors, smartphone issues, StackOverflow style", labels: ["Tech Fixes", "Tutorials", "Guides"] },
    { name: "المقارنات", prompt: "Comparison between top software/apps, AlternativeTo style comparison", labels: ["Comparisons", "Software", "Reviews"] },
    { name: "أفضل 10", prompt: "Top 10 lists (apps, tools, websites, tech gadgets)", labels: ["Top 10", "Lists", "Tech"] },
    { name: "الشروحات", prompt: "Step by step tech tutorial, How to use specific software or platform", labels: ["Tutorials", "How-To", "Education"] },
    { name: "حل مشاكل التطبيقات المشهورة", prompt: "Fixing bugs in popular apps like TikTok, Instagram, WhatsApp, Reddit source style", labels: ["App Fixes", "Social Media", "Troubleshooting"] },
    { name: "أفكار مشاريع", prompt: "Zero-capital online business ideas, digital marketing projects", labels: ["Business Ideas", "Entrepreneur", "Startup"] },
    { name: "الترندات الجديدة", prompt: "Latest tech trends, newly released AI models, Google Trends tech news", labels: ["Tech News", "Trends", "Future"] }
];

const groq = new Groq({ apiKey: CONFIG.groqKey });
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function runGroqPublisher() {
    try {
        // اختيار قسم عشوائي من الـ 10 أقسام
        const selectedNiche = CONTENT_NICHES[Math.floor(Math.random() * CONTENT_NICHES.length)];
        console.log(`🎯 Selected Niche: ${selectedNiche.name}`);

        console.log("🔍 Step 1: Picking a high-traffic title...");
        const topicRes = await groq.chat.completions.create({
            messages: [{ role: "user", content: `Suggest ONE highly engaging, click-worthy English blog title about: ${selectedNiche.prompt}. Return ONLY the title text.` }],
            model: "llama-3.3-70b-versatile",
        });
        const targetTitle = topicRes.choices[0].message.content.trim().replace(/["']/g, "");

        console.log("✍️ Step 2: Writing a 1500+ word SEO article with external links...");
        // Prompt قوي جداً مخصص للـ SEO ولأدسنس
        const contentPrompt = `Write a comprehensive, highly engaging, and SEO-optimized 1500-word blog post about "${targetTitle}".
        CRITICAL REQUIREMENTS:
        1. Professional Formatting: Use <p>, <h2>, <h3>, and <ul>/<li>.
        2. External Links: Naturally include at least 3 outbound links to authoritative websites (like Wikipedia, official sites, or major news outlets) using <a href="..." target="_blank" rel="noopener noreferrer" class="seo-link">Anchor Text</a>.
        3. Structure: Start with an engaging intro, include a "Key Takeaways" bulleted list early on, deep-dive into the subject, and end with a "FAQ" section.
        4. Tone: Expert, engaging, and problem-solving.
        5. Output ONLY HTML tags for the body content. Do NOT include markdown (\`\`\`html) or <html><body> tags.`;
        
        const contentRes = await groq.chat.completions.create({
            messages: [{ role: "user", content: contentPrompt }],
            model: "llama-3.3-70b-versatile",
        });
        let articleBody = contentRes.choices[0].message.content.replace(/```html|```/g, "").trim();

        console.log("🎨 Step 3: Generating Image background...");
        const promptRes = await groq.chat.completions.create({
            messages: [{ role: "user", content: `Based on title: "${targetTitle}", write a 4-word visual description for a dark, cinematic tech background image. No text in image. English only.` }],
            model: "llama-3.3-70b-versatile",
        });
        
        let cleanPrompt = encodeURIComponent(promptRes.choices[0].message.content.trim().replace(/[^a-zA-Z0-9 ]/g, ""));
        const imageUrl = `https://image.pollinations.ai/prompt/${cleanPrompt}?width=1200&height=630&nologo=true`;
        
        await sleep(5000); 

        console.log("🪄 Step 4: Assembling Pro HTML Design...");
        // التصميم الجديد: بنر احترافي بنصوص فوق الصورة، روابط خارجية واضحة، وشكل عصري
        const finalHtml = `
            <style>
                .pro-article { font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.8; font-size: 17px; }
                
                /* تصميم البنر الاحترافي (صورة عليها نصوص وفلاتر) */
                .hero-banner { position: relative; border-radius: 16px; overflow: hidden; margin-bottom: 40px; box-shadow: 0 10px 30px rgba(0,0,0,0.15); background-color: #000; }
                .hero-img { width: 100%; max-height: 500px; object-fit: cover; display: block; opacity: 0.6; filter: contrast(1.1) brightness(0.8); transition: opacity 0.3s; }
                .hero-banner:hover .hero-img { opacity: 0.8; }
                .hero-overlay { position: absolute; bottom: 0; left: 0; right: 0; padding: 40px 30px; background: linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0) 100%); pointer-events: none; }
                .hero-tag { display: inline-block; background: #e74c3c; color: #fff; padding: 5px 12px; border-radius: 20px; font-size: 13px; font-weight: bold; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 1px; }
                .hero-title { color: #ffffff; margin: 0; font-size: 32px; font-weight: 800; line-height: 1.3; text-shadow: 2px 2px 4px rgba(0,0,0,0.5); }
                .hero-brand { color: #bdc3c7; font-size: 14px; margin-top: 10px; font-weight: 500; }

                /* تنسيق المحتوى ليكون متوافق مع الوضع الليلي */
                .pro-content h2 { border-bottom: 2px solid rgba(128,128,128,0.2); padding-bottom: 12px; margin-top: 40px; font-size: 26px; color: #2980b9; font-weight: 700;}
                .pro-content h3 { font-size: 21px; margin-top: 30px; font-weight: 600; opacity: 0.9;}
                .pro-content p { margin-bottom: 20px; opacity: 0.85; }
                
                /* تنسيق الروابط الخارجية */
                .pro-content a.seo-link { color: #d35400; font-weight: 600; text-decoration: none; border-bottom: 1px dashed #d35400; transition: all 0.2s;}
                .pro-content a.seo-link:hover { color: #e67e22; border-bottom: 1px solid #e67e22; background-color: rgba(230, 126, 34, 0.05); }

                /* تنسيق القوائم النقطية لتكون مميزة */
                .pro-content ul { background-color: rgba(41, 128, 185, 0.04); padding: 25px 45px; border-radius: 12px; border-left: 6px solid #2980b9; margin: 30px 0; }
                .pro-content li { margin-bottom: 12px; opacity: 0.85; }

                .pro-footer { text-align: center; margin-top: 50px; padding-top: 20px; border-top: 1px solid rgba(128,128,128,0.2); font-size: 14px; opacity: 0.5; font-style: italic; }
            </style>

            <div class="pro-article" dir="ltr">
                <div class="hero-banner">
                    <img class="hero-img" src="${imageUrl}" alt="${targetTitle}" loading="lazy">
                    <div class="hero-overlay">
                        <span class="hero-tag">${selectedNiche.name}</span>
                        <h1 class="hero-title">${targetTitle}</h1>
                        <div class="hero-brand">Exclusive on ${CONFIG.siteName}</div>
                    </div>
                </div>
                
                <div class="pro-content">
                    ${articleBody}
                </div>
                
                <div class="pro-footer">
                    <p>Published dynamically on ${CONFIG.siteName} | Powered by AI SEO Engine</p>
                </div>
            </div>
        `;

        console.log(`📤 Step 5: Publishing to Blogger in category [${selectedNiche.labels.join(", ")}]...`);
        const oauth2Client = new google.auth.OAuth2(CONFIG.clientId, CONFIG.clientSecret);
        oauth2Client.setCredentials({ refresh_token: CONFIG.refreshToken });
        const blogger = google.blogger({ version: "v3", auth: oauth2Client });

        const response = await blogger.posts.insert({
            blogId: CONFIG.blogId,
            requestBody: { 
                title: targetTitle, 
                content: finalHtml, 
                // نستخدم الكلمات المفتاحية الخاصة بالقسم الذي تم اختياره فقط
                labels: selectedNiche.labels 
            }
        });
        console.log(`✅ Success! Article live at: ${response.data.url}`);
    } catch (error) {
        console.error("❌ Error:", error.message);
    }
}

runGroqPublisher();
