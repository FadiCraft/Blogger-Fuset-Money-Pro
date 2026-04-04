const Groq = require("groq-sdk");
const { google } = require("googleapis");
const axios = require("axios");
const sharp = require("sharp");

// =============== الإعدادات الثابتة ===============
const CONFIG = {
    groqKey: "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",
    blogId: "8249860422330426533",
    clientId: "872415365656-7qribadnc7k2u21kl6jjcbatdueevifh.apps.googleusercontent.com",
    clientSecret: "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",
    refreshToken: "1//04yti9k2agPknCgYIARAAGAQSNwF-L9IrTZPKt5Fqbg2vrM9sBtOks9cnY4M7Idg0LToQnlbYGME06k20vcyr_SVmYk1H_yZJdEc",
    siteName: "TECH VANGUARD"
};

// تصنيفات ذكية مع كلمات مفتاحية
const NICHES = [
    { id: "MONEY", label: "Financial Growth", key: "Income", links: ["https://www.investopedia.com/", "https://www.nerdwallet.com/"] },
    { id: "AI", label: "AI Revolution", key: "Intelligence", links: ["https://techcrunch.com/category/artificial-intelligence/", "https://www.wired.com/tag/ai/"] },
    { id: "FIX", label: "Tech Solutions", key: "Troubleshooting", links: ["https://www.lifewire.com/", "https://www.makeuseof.com/"] },
    { id: "APPS", label: "Digital Tools", key: "Applications", links: ["https://alternativeto.net/", "https://www.producthunt.com/"] }
];

const groq = new Groq({ apiKey: CONFIG.groqKey });

// =============== دالة لتحميل الصورة من Pollinations ===============
async function downloadImage(url) {
    const response = await axios.get(url, { responseType: "arraybuffer" });
    return Buffer.from(response.data, "binary");
}

// =============== دالة لإضافة النص على الصورة (بصمة فريدة) ===============
async function addTextToImage(imageBuffer, titleText) {
    // أبعاد الصورة (1200×630)
    const width = 1200;
    const height = 630;
    
    // إنشاء طبقة نصية شفافة فوق الصورة
    const textOverlay = await sharp({
        text: {
            text: titleText,
            font: "Arial",
            fontfile: "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf", // مسار خط عام (في GitHub Actions قد يتوفر)
            rgba: true,
            fontSize: 56,
            fontweight: "bold",
            width: width - 100,
            align: "center",
            justify: true,
            color: "white",
            background: "rgba(0,0,0,0.65)", // خلفية شفافة داكنة لتثبيت القراءة
            gravity: "center"
        }
    }).png().toBuffer();
    
    // دمج الصورة الأصلية مع النص
    const finalImage = await sharp(imageBuffer)
        .resize(width, height, { fit: "cover" })
        .composite([{ input: textOverlay, gravity: "center" }])
        .jpeg({ quality: 85 })
        .toBuffer();
    
    return finalImage;
}

// =============== الدالة الرئيسية ===============
async function runGroqPublisher() {
    try {
        // اختيار niche عشوائي
        const selectedNiche = NICHES[Math.floor(Math.random() * NICHES.length)];
        console.log(`🚀 التصنيف المختار: ${selectedNiche.id}`);

        // 1. عنوان جذاب
        const titleRes = await groq.chat.completions.create({
            messages: [{ role: "user", content: `Create a viral, high-authority English blog title for ${selectedNiche.label}. NO quotes.` }],
            model: "llama-3.3-70b-versatile",
        });
        const targetTitle = titleRes.choices[0].message.content.trim();

        // 2. محتوى المقال (HTML نظيف)
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

        // 3. وصف الصورة المرتبط بالمقال
        const imgDescRes = await groq.chat.completions.create({
            messages: [{ role: "user", content: `Describe a professional, high-quality 4k literal photo for: "${targetTitle}". No people if possible, focus on modern tech/money objects. 5 words max.` }],
            model: "llama-3.3-70b-versatile",
        });
        const imgPrompt = encodeURIComponent(imgDescRes.choices[0].message.content.trim());
        const rawImageUrl = `https://image.pollinations.ai/prompt/${imgPrompt}-premium-corporate-style?width=1200&height=630&nologo=true`;

        // 4. تحميل الصورة وإضافة النص عليها
        console.log("📸 جاري تحميل الصورة الأصلية...");
        const imageBuffer = await downloadImage(rawImageUrl);
        console.log("✍️ جاري إضافة عنوان المقال على الصورة...");
        const finalImageBuffer = await addTextToImage(imageBuffer, targetTitle);
        const base64Image = finalImageBuffer.toString("base64");
        const dataUrl = `data:image/jpeg;base64,${base64Image}`;

        // 5. قالب HTML النهائي (ألوان ثابتة واضحة، متوافقة مع الوضع الليلي والفاتح)
        const finalHtml = `
        <!DOCTYPE html>
        <html dir="ltr">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                /* نظام ألوان احترافي – لا عشوائية */
                :root {
                    --bg-body: #f8f9fa;
                    --bg-card: #ffffff;
                    --text-primary: #212529;
                    --text-secondary: #495057;
                    --accent: #0d6efd;
                    --border: #dee2e6;
                    --insight-bg: #e9ecef;
                }
                @media (prefers-color-scheme: dark) {
                    :root {
                        --bg-body: #121212;
                        --bg-card: #1e1e2f;
                        --text-primary: #f1f3f5;
                        --text-secondary: #ced4da;
                        --accent: #4dabf7;
                        --border: #2c2c3a;
                        --insight-bg: #2a2a3b;
                    }
                }

                body {
                    margin: 0;
                    background: var(--bg-body);
                    font-family: 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
                    line-height: 1.7;
                }
                .post-container {
                    max-width: 850px;
                    margin: 30px auto;
                    background: var(--bg-card);
                    border-radius: 24px;
                    overflow: hidden;
                    box-shadow: 0 20px 40px rgba(0,0,0,0.1);
                    padding: 0 0 30px 0;
                }
                .featured-image {
                    width: 100%;
                    display: block;
                }
                .article-content {
                    padding: 20px 30px;
                }
                h1 {
                    font-size: 2.2rem;
                    margin-top: 0;
                    margin-bottom: 0.5rem;
                    color: var(--text-primary);
                }
                h2 {
                    font-size: 1.8rem;
                    margin-top: 2rem;
                    padding-bottom: 0.5rem;
                    border-bottom: 3px solid var(--accent);
                    color: var(--text-primary);
                }
                h3 {
                    font-size: 1.4rem;
                    margin-top: 1.5rem;
                    color: var(--text-primary);
                }
                p, li {
                    color: var(--text-secondary);
                    font-size: 1.05rem;
                }
                .insight-box {
                    background: var(--insight-bg);
                    border-left: 5px solid var(--accent);
                    padding: 1.2rem 1.8rem;
                    border-radius: 16px;
                    margin: 2rem 0;
                }
                a {
                    color: var(--accent);
                    text-decoration: none;
                    font-weight: 500;
                }
                a:hover {
                    text-decoration: underline;
                }
                .footer {
                    text-align: center;
                    font-size: 0.8rem;
                    color: var(--text-secondary);
                    border-top: 1px solid var(--border);
                    margin-top: 3rem;
                    padding-top: 1.5rem;
                }
                @media (max-width: 600px) {
                    .article-content { padding: 15px; }
                    h1 { font-size: 1.8rem; }
                }
            </style>
            <script type="application/ld+json">
            {
                "@context": "https://schema.org",
                "@type": "BlogPosting",
                "headline": "${targetTitle.replace(/"/g, '\\"')}",
                "image": "${dataUrl}",
                "publisher": {
                    "@type": "Organization",
                    "name": "${CONFIG.siteName}"
                }
            }
            </script>
        </head>
        <body>
            <div class="post-container">
                <img class="featured-image" src="${dataUrl}" alt="${targetTitle.replace(/"/g, '&quot;')}">
                <div class="article-content">
                    <div class="insight-box">
                        ⚡ <strong>Quick Overview</strong><br>
                        This exclusive report dives deep into <strong>${selectedNiche.label}</strong> – the #1 trend shaping 2026.
                    </div>
                    ${articleBody}
                    <div class="footer">
                        © 2026 ${CONFIG.siteName} – All rights reserved.<br>
                        Published with AI precision.
                    </div>
                </div>
            </div>
        </body>
        </html>
        `;

        // 6. النشر على بلوجر
        const oauth2Client = new google.auth.OAuth2(CONFIG.clientId, CONFIG.clientSecret);
        oauth2Client.setCredentials({ refresh_token: CONFIG.refreshToken });
        const blogger = google.blogger({ version: "v3", auth: oauth2Client });

        const response = await blogger.posts.insert({
            blogId: CONFIG.blogId,
            requestBody: {
                title: targetTitle,
                content: finalHtml,
                labels: [selectedNiche.id, selectedNiche.key, "2026", "exclusive"]
            }
        });
        console.log(`✅ تم النشر بنجاح! الرابط: ${response.data.url}`);
        console.log(`🖼️ الصورة مضمنة بـ Base64 ولن تُحذف أبداً، وتحمل عنوان المقال كبصمة فريدة.`);
    } catch (error) {
        console.error("❌ فشل التشغيل:", error.message);
        if (error.response) console.error(error.response.data);
    }
}

runGroqPublisher();
