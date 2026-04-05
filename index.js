const axios = require("axios");
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




const groq = new Groq({ apiKey: CONFIG.groqKey });

// 📤 رفع الصورة داخل Blogger (حل مشكلة الحذف)
async function uploadImageToBlogger(auth, imageUrl) {
    const res = await axios.get(imageUrl, { responseType: "arraybuffer" });

    const blogger = google.blogger({ version: "v3", auth });

    const tempPost = await blogger.posts.insert({
        blogId: CONFIG.blogId,
        requestBody: {
            title: "temp",
            content: `<img src="data:image/png;base64,${Buffer.from(res.data).toString("base64")}" />`
        }
    });

    const match = tempPost.data.content.match(/src="([^"]+)"/);
    return match ? match[1] : imageUrl;
}

async function run() {
    try {
        // 🎯 اختيار نيتش ذكي
        const niches = [
            "Make Money Online",
            "AI Tools",
            "Tech Fixes",
            "Best Apps 2026"
        ];
        const niche = niches[Math.floor(Math.random() * niches.length)];

        // 🔥 عنوان قوي
        const titleRes = await groq.chat.completions.create({
            messages: [{
                role: "user",
                content: `Create a viral SEO blog title about ${niche}. No quotes.`
            }],
            model: "llama-3.3-70b-versatile",
        });

        const title = titleRes.choices[0].message.content.trim();

        // 🧠 محتوى احترافي HTML فقط
        const contentRes = await groq.chat.completions.create({
            messages: [{
                role: "user",
                content: `Write a professional 1200+ words SEO article in HTML about "${title}". 
                Use:
                - h2, h3
                - paragraphs
                - bullet lists
                - FAQ section
                No markdown.`
            }],
            model: "llama-3.3-70b-versatile",
        });

        const articleBody = contentRes.choices[0].message.content
            .replace(/```html|```/g, "")
            .trim();

        // 🎨 صورة مرتبطة فعليًا
        const imagePrompt = encodeURIComponent(
            `high quality modern illustration of ${title}, minimal, clean background, 4k, professional`
        );

        const rawImage = `https://image.pollinations.ai/prompt/${imagePrompt}?width=1200&height=630`;

        // 🔐 OAuth
        const oauth2Client = new google.auth.OAuth2(
            CONFIG.clientId,
            CONFIG.clientSecret
        );

        oauth2Client.setCredentials({
            refresh_token: CONFIG.refreshToken
        });

        // 📤 رفع الصورة
        const uploadedImage = await uploadImageToBlogger(oauth2Client, rawImage);

        // 🎨 تصميم احترافي
        const finalHtml = `
        <div class="container">
        <style>
        :root {
            --bg:#ffffff;
            --text:#111;
            --sub:#555;
            --accent:#0d6efd;
        }

        @media (prefers-color-scheme: dark) {
            :root {
                --bg:#0f0f0f;
                --text:#f5f5f5;
                --sub:#aaa;
            }
        }

        .container {
            max-width: 850px;
            margin: auto;
            font-family: system-ui;
            background: var(--bg);
            color: var(--text);
            padding: 20px;
            line-height: 1.8;
        }

        .hero {
            position: relative;
            border-radius: 20px;
            overflow: hidden;
            margin-bottom: 30px;
        }

        .hero img {
            width: 100%;
            height: auto;
            filter: brightness(0.65);
        }

        .hero-title {
            position: absolute;
            bottom: 20px;
            left: 20px;
            right: 20px;
            color: #fff;
            font-size: 34px;
            font-weight: bold;
            text-shadow: 0 5px 20px rgba(0,0,0,0.9);
        }

        h2 {
            margin-top: 40px;
            color: var(--accent);
        }

        h3 {
            margin-top: 25px;
        }

        p {
            color: var(--sub);
            font-size: 18px;
        }

        ul {
            padding-left: 20px;
        }
        </style>

        <div class="hero">
            <img src="${uploadedImage}" alt="${title}">
            <div class="hero-title">${title}</div>
        </div>

        ${articleBody}

        </div>
        `;

        // 🚀 نشر
        const blogger = google.blogger({
            version: "v3",
            auth: oauth2Client
        });

        const res = await blogger.posts.insert({
            blogId: CONFIG.blogId,
            requestBody: {
                title: title,
                content: finalHtml,
                labels: ["AI", "SEO", niche]
            }
        });

        console.log("✅ Published:", res.data.url);

    } catch (err) {
        console.error("❌ ERROR:", err.message);
    }
}

run();
