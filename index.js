const Groq = require("groq-sdk");
const { google } = require("googleapis");

// 🔴 تنويه أمني: من الأفضل مستقبلاً وضع هذه البيانات في GitHub Secrets واستدعائها عبر process.env
const CONFIG = {
    groqKey: "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",
    blogId: "8249860422330426533",
    clientId: "872415365656-7qribadnc7k2u21kl6jjcbatdueevifh.apps.googleusercontent.com",
    clientSecret: "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",
    refreshToken: "1//04yti9k2agPknCgYIARAAGAQSNwF-L9IrTZPKt5Fqbg2vrM9sBtOks9cnY4M7Idg0LToQnlbYGME06k20vcyr_SVmYk1H_yZJdEc",
    topics: ["Make Money Online 2026", "AI Side Hustles", "Future Tech Automation"]
};

const groq = new Groq({ apiKey: CONFIG.groqKey });
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function runGroqPublisher() {
    try {
        console.log("🔍 Step 1: Picking a topic (Llama 3.3)...");
        const topicRes = await groq.chat.completions.create({
            messages: [{ role: "user", content: "Suggest one short, highly engaging, high-traffic blog title about AI and making money. Return ONLY the title text." }],
            model: "llama-3.3-70b-versatile",
        });
        const targetTitle = topicRes.choices[0].message.content.trim().replace(/[^a-zA-Z0-9 ]/g, "");

        console.log("✍️ Step 2: Writing an SEO-optimized 1000-word article...");
        // تحسين الـ Prompt ليكون متوافق مع AdSense والتنسيق الصحيح
        const contentPrompt = `Write a comprehensive, SEO-optimized 1000-word blog post about "${targetTitle}". 
        Structure requirements:
        - Engaging introduction.
        - Use structured headings (<h2> and <h3>).
        - Include at least one bulleted list (<ul> and <li>).
        - Strong conclusion.
        - Output ONLY pure HTML tags. NO markdown blocks (like \`\`\`html). Do not include <html> or <body> tags, just the inner content.`;
        
        const contentRes = await groq.chat.completions.create({
            messages: [{ role: "user", content: contentPrompt }],
            model: "llama-3.3-70b-versatile",
        });
        let articleBody = contentRes.choices[0].message.content.replace(/```html|```/g, "").trim();

        console.log("🎨 Step 3: Generating Landscape Image Prompt...");
        const promptRes = await groq.chat.completions.create({
            messages: [{ role: "user", content: `Based on title: "${targetTitle}", write a 5-word visual description for a futuristic landscape blog banner. English letters only.` }],
            model: "llama-3.3-70b-versatile",
        });
        
        let rawPrompt = promptRes.choices[0].message.content.trim();
        // استخدام encodeURIComponent أفضل للروابط من الـ Replace المعقد
        let cleanPrompt = encodeURIComponent(rawPrompt.replace(/[^a-zA-Z0-9 ]/g, "").trim());
        
        console.log("📸 Step 4: Formatting Direct Image Link...");
        // تحديد العرض والطول لتكون الصورة بالعرض (16:9) ومناسبة للمقالات وإخفاء اللوجو
        const imageUrl = `https://image.pollinations.ai/prompt/${cleanPrompt}?width=1200&height=630&nologo=true`;
        console.log(`🔗 Final Direct Image URL: ${imageUrl}`);
        
        await sleep(5000); 

        // 🌟 تنسيق HTML متوافق مع الوضع الليلي والنهاري (السر هنا في استخدام rgba وعدم تحديد لون صلب للخلفية والنص)
        const finalHtml = `
            <style>
                .seo-article-container { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; line-height: 1.8; }
                .seo-article-title { text-align: center; margin-bottom: 25px; font-size: 28px; font-weight: bold; color: #2980b9; }
                .seo-article-image { width: 100%; max-width: 1200px; height: auto; border-radius: 12px; box-shadow: 0 8px 20px rgba(0,0,0,0.15); margin-bottom: 30px; object-fit: cover;}
                
                /* تنسيقات المقال - ستأخذ لون النص الافتراضي للموقع سواء نهاري أو ليلي */
                .seo-article-content h2 { border-bottom: 2px solid rgba(128, 128, 128, 0.2); padding-bottom: 10px; margin-top: 30px; font-size: 24px; color: #3498db;}
                .seo-article-content h3 { font-size: 20px; margin-top: 25px; opacity: 0.9;}
                .seo-article-content p { font-size: 17px; margin-bottom: 18px; opacity: 0.85; }
                
                /* القوائم: خلفية شفافة جداً تتناسب مع الأبيض والأسود */
                .seo-article-content ul { background-color: rgba(52, 152, 219, 0.05); padding: 20px 40px; border-radius: 8px; border-left: 5px solid #3498db; margin: 25px 0; list-style-type: disc;}
                .seo-article-content li { margin-bottom: 12px; font-size: 16px; opacity: 0.85;}
                
                .seo-article-footer { text-align: center; font-style: italic; font-size: 14px; opacity: 0.6; margin-top: 40px; border-top: 1px solid rgba(128, 128, 128, 0.2); padding-top: 20px;}
            </style>

            <div class="seo-article-container" dir="ltr">
                <h1 class="seo-article-title">${targetTitle}</h1>
                
                <div style="text-align: center;">
                    <a href="${imageUrl}" target="_blank">
                        <img class="seo-article-image" src="${imageUrl}" alt="${targetTitle} - Blog Banner" loading="lazy">
                    </a>
                </div>
                
                <div class="seo-article-content">
                    ${articleBody}
                </div>
                
                <div class="seo-article-footer">
                    <p>Crafted dynamically by Kiro Zozo AI Engine 2026</p>
                </div>
            </div>
        `;

        console.log("📤 Step 5: Publishing to Blogger...");
        const oauth2Client = new google.auth.OAuth2(CONFIG.clientId, CONFIG.clientSecret);
        oauth2Client.setCredentials({ refresh_token: CONFIG.refreshToken });
        const blogger = google.blogger({ version: "v3", auth: oauth2Client });

        const response = await blogger.posts.insert({
            blogId: CONFIG.blogId,
            requestBody: { 
                title: targetTitle, 
                content: finalHtml, 
                labels: ["AI Tech", "Make Money", "Insights"] 
            }
        });
        console.log(`✅ Success! Article live at: ${response.data.url}`);
    } catch (error) {
        console.error("❌ Error:", error.message);
    }
}

runGroqPublisher();
