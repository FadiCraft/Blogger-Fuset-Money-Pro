const Groq = require("groq-sdk");
const { google } = require("googleapis");

const CONFIG = {
    groqKey: "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",
    blogId: "8249860422330426533",
    clientId: "872415365656-7qribadnc7k2u21kl6jjcbatdueevifh.apps.googleusercontent.com",
    clientSecret: "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",
    refreshToken: "1//04yti9k2agPknCgYIARAAGAQSNwF-L9IrTZPKt5Fqbg2vrM9sBtOks9cnY4M7Idg0LToQnlbYGME06k20vcyr_SVmYk1H_yZJdEc",
    topics: ["Make Money Online 2026", "AI Side Hustles", "Passive Income Tech", "Future of Work"]
};

const groq = new Groq({ apiKey: CONFIG.groqKey });
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function runProfessionalBot() {
    try {
        console.log("🔍 Step 1: Picking a trending topic via Groq (Llama 3.3)...");
        const topicResponse = await groq.chat.completions.create({
            messages: [{ role: "user", content: "Suggest one professional, high-traffic blog title about AI money making in 2026. Return ONLY the title text, no quotes." }],
            model: "llama-3.3-70b-versatile",
        });
        const targetTitle = topicResponse.choices[0].message.content.trim().replace(/["']/g, "");
        console.log(`🎯 Target Topic: ${targetTitle}`);

        console.log("✍️ Step 2: Writing a 1000-word article...");
        const contentResponse = await groq.chat.completions.create({
            messages: [{ role: "user", content: `Write a detailed, 1000-word SEO blog post in English about "${targetTitle}". Use HTML (h2, p, ul, li). No markdown.` }],
            model: "llama-3.3-70b-versatile",
        });
        let articleBody = contentResponse.choices[0].message.content.replace(/```html|```/g, "").trim();

        // --- الخطوة الجديدة والسحرية: توليد أمر الصورة الاحترافي ---
        console.log("🎨 Step 2.5: Generating a professional Image Prompt via AI...");
        const promptGeneratorResponse = await groq.chat.completions.create({
            messages: [
                { role: "system", content: "You are an expert AI image prompt engineer. You generate highly detailed, technical, and photorealistic prompts for image generation models like Stable Diffusion/Flux." },
                { role: "user", content: `Based on this blog title: "${targetTitle}", generate a highly detailed, professional, cinematic, and photorealistic image prompt. 
                    - Focus on a modern, high-tech, futuristic theme (year 2026).
                    - Use keywords like: "photorealistic, 8k, cinematic lighting, dramatic, high detailed, professional, digital art, trending on ArtStation".
                    - The prompt must be in English. Return ONLY the final detailed prompt, no introduction.` }
            ],
            model: "llama-3.3-70b-versatile",
        });
        const dynamicImagePrompt = promptGeneratorResponse.choices[0].message.content.trim();
        console.log(`🖼️ AI Image Prompt: ${dynamicImagePrompt}`);
        // --------------------------------------------------------

        console.log("📸 Step 3: Handling Image with AI Generated Prompt...");
        // تنظيف العنوان فقط لغرض الـ Alt text والاسم الآمن
        const safeTitle = targetTitle.replace(/[^a-zA-Z0-9 ]/g, ""); 
        
        // بناء رابط الصورة بناءً على الـ PROMPT الاحترافي الجديد
        const imageUrl = `https://pollinations.ai/p/${encodeURIComponent(dynamicImagePrompt)}?width=1200&height=630&model=flux&seed=${Math.floor(Math.random() * 9999)}`;
        
        console.log(`📷 Final Image Link: ${imageUrl}`);
        await sleep(15000); // ننتظر 15 ثانية لتوليد الصورة لأنها أصبحت أكثر تعقيداً

        const finalHtml = `
            <div dir="ltr" style="font-family: Arial, sans-serif; line-height: 1.8; color: #333;">
                <img src="${imageUrl}" style="width:100%; border-radius:15px; margin-bottom:25px; box-shadow: 0 4px 10px rgba(0,0,0,0.1);" alt="${targetTitle}">
                ${articleBody}
                <hr>
                <p style="text-align: center; color: #888;">AI Powered Insights 2026 by KiroZozo Bot</p>
            </div>
        `;

        console.log("📤 Step 4: Publishing to Blogger...");
        const oauth2Client = new google.auth.OAuth2(CONFIG.clientId, CONFIG.clientSecret);
        oauth2Client.setCredentials({ refresh_token: CONFIG.refreshToken });
        const blogger = google.blogger({ version: "v3", auth: oauth2Client });

        const response = await blogger.posts.insert({
            blogId: CONFIG.blogId,
            requestBody: { title: targetTitle, content: finalHtml, labels: ["AI Tech", "Insights", "Make Money"] }
        });

        console.log(`✅DONE! Article live at: ${response.data.url}`);

    } catch (error) {
        console.error("❌ Critical Error:", error.message);
    }
}

// تشغيل البوت
runProfessionalBot();
