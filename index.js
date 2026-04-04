const Groq = require("groq-sdk");
const { google } =require("googleapis");
const axios = require("axios");
const sharp = require("sharp");

const CONFIG = {
    groqKey: "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",
    blogId: "8249860422330426533",
    clientId: "872415365656-7qribadnc7k2u21kl6jjcbatdueevifh.apps.googleusercontent.com",
    clientSecret: "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",
    refreshToken: "1//04yti9k2agPknCgYIARAAGAQSNwF-L9IrTZPKt5Fqbg2vrM9sBtOks9cnY4M7Idg0LToQnlbYGME06k20vcyr_SVmYk1H_yZJdEc",
    siteName: "TECH VANGUARD"
};

const NICHES = [
    { id: "MONEY", label: "Financial Growth", key: "Income", links: ["https://www.investopedia.com/", "https://www.nerdwallet.com/"] },
    { id: "AI", label: "AI Revolution", key: "Intelligence", links: ["https://techcrunch.com/category/artificial-intelligence/", "https://www.wired.com/tag/ai/"] },
    { id: "FIX", label: "Tech Solutions", key: "Troubleshooting", links: ["https://www.lifewire.com/", "https://www.makeuseof.com/"] },
    { id: "APPS", label: "Digital Tools", key: "Applications", links: ["https://alternativeto.net/", "https://www.producthunt.com/"] }
];

const groq = new Groq({ apiKey: CONFIG.groqKey });

async function downloadImage(url) {
    const response = await axios.get(url, { responseType: "arraybuffer" });
    return Buffer.from(response.data, "binary");
}

async function addTextToImage(imageBuffer, titleText) {
    const width = 1200;
    const height = 630;
    
    const textOverlay = await sharp({
        text: {
            text: titleText,
            font: "Arial",
            fontfile: "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
            rgba: true,
            fontSize: 52,
            fontweight: "bold",
            width: width - 80,
            align: "center",
            color: "white",
            background: "rgba(0,0,0,0.6)",
            gravity: "center"
        }
    }).png().toBuffer();
    
    const finalImage = await sharp(imageBuffer)
        .resize(width, height, { fit: "cover" })
        .composite([{ input: textOverlay, gravity: "center" }])
        .jpeg({ quality: 90 })
        .toBuffer();
    
    return finalImage;
}

async function runGroqPublisher() {
    try {
        const selectedNiche = NICHES[Math.floor(Math.random() * NICHES.length)];
        console.log(`🚀 Selected: ${selectedNiche.id}`);

        // Generate title
        const titleRes = await groq.chat.completions.create({
            messages: [{ role: "user", content: `Create a viral, modern English blog title for ${selectedNiche.label}. Max 8 words. NO quotes.` }],
            model: "llama-3.3-70b-versatile",
        });
        const targetTitle = titleRes.choices[0].message.content.trim();

        // Generate content
        const contentRes = await groq.chat.completions.create({
            messages: [{ role: "user", content: `Write a 2000-word modern SEO article for "${targetTitle}".
            Style: Professional, engaging, easy to read.
            Include:
            - Powerful hook in intro
            - Statistics or data points
            - 3 major H2 sections with H3 subsections
            - "Pro Tips" box (with 💡 emoji)
            - 2 external authority links from: ${selectedNiche.links.join(", ")}
            - FAQ section with 3 questions
            - Strong conclusion with call-to-action
            Use ONLY clean HTML tags. No markdown. No inline styles.` }],
            model: "llama-3.3-70b-versatile",
        });
        let articleBody = contentRes.choices[0].message.content.replace(/```html|```/g, "").trim();

        // Generate image prompt
        const imgDescRes = await groq.chat.completions.create({
            messages: [{ role: "user", content: `Describe a stunning, modern, high-quality photo for: "${targetTitle}". Professional, clean, abstract or tech-related. 6 words max.` }],
            model: "llama-3.3-70b-versatile",
        });
        const imgPrompt = encodeURIComponent(imgDescRes.choices[0].message.content.trim());
        const rawImageUrl = `https://image.pollinations.ai/prompt/${imgPrompt}?width=1200&height=630&nologo=true`;

        // Process image
        console.log("📸 Downloading image...");
        const imageBuffer = await downloadImage(rawImageUrl);
        console.log("✍️ Adding title to image...");
        const finalImageBuffer = await addTextToImage(imageBuffer, targetTitle);
        const base64Image = finalImageBuffer.toString("base64");

        // 🎨 MODERN PREMIUM HTML TEMPLATE
        const finalHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="${targetTitle} - Expert insights and actionable strategies">
    <title>${targetTitle}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', system-ui, sans-serif;
            background: linear-gradient(135deg, #f5f7fa 0%, #e9edf2 100%);
            line-height: 1.6;
        }
        
        /* Glass morphism card */
        .article-wrapper {
            max-width: 900px;
            margin: 2rem auto;
            background: rgba(255, 255, 255, 0.98);
            border-radius: 32px;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
            overflow: hidden;
            backdrop-filter: blur(0px);
            transition: transform 0.3s ease;
        }
        
        /* Hero section with gradient overlay */
        .hero-section {
            position: relative;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 3rem 2rem;
            text-align: center;
            color: white;
        }
        
        .hero-image {
            width: 100%;
            max-height: 500px;
            object-fit: cover;
            display: block;
        }
        
        .hero-overlay {
            padding: 2rem;
            background: linear-gradient(to bottom, rgba(0,0,0,0.3), rgba(0,0,0,0.7));
        }
        
        .category-badge {
            display: inline-block;
            background: rgba(255,255,255,0.2);
            backdrop-filter: blur(10px);
            padding: 0.4rem 1.2rem;
            border-radius: 100px;
            font-size: 0.8rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 2px;
            margin-bottom: 1.5rem;
        }
        
        h1 {
            font-size: 2.8rem;
            font-weight: 800;
            line-height: 1.2;
            margin-bottom: 1rem;
            background: linear-gradient(135deg, #fff, #e0e0e0);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        
        /* Content area */
        .content-area {
            padding: 3rem;
        }
        
        /* Typography */
        h2 {
            font-size: 2rem;
            font-weight: 700;
            margin-top: 2.5rem;
            margin-bottom: 1rem;
            background: linear-gradient(135deg, #667eea, #764ba2);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        
        h3 {
            font-size: 1.5rem;
            font-weight: 600;
            margin-top: 1.8rem;
            margin-bottom: 0.8rem;
            color: #2d3748;
        }
        
        p {
            font-size: 1.1rem;
            color: #4a5568;
            margin-bottom: 1.2rem;
        }
        
        /* Pro Tips Box - Modern design */
        .pro-tip {
            background: linear-gradient(135deg, #fef3c7 0%, #fffbeb 100%);
            border-left: 5px solid #f59e0b;
            padding: 1.5rem;
            border-radius: 20px;
            margin: 2rem 0;
            box-shadow: 0 4px 12px rgba(0,0,0,0.05);
        }
        
        .pro-tip strong {
            color: #d97706;
            font-size: 1.2rem;
            display: block;
            margin-bottom: 0.5rem;
        }
        
        /* FAQ Section - Collapsible modern */
        .faq-item {
            background: #f7fafc;
            margin: 1rem 0;
            border-radius: 16px;
            overflow: hidden;
            transition: all 0.3s;
        }
        
        .faq-question {
            padding: 1.2rem 1.5rem;
            font-weight: 700;
            cursor: pointer;
            background: #edf2f7;
            color: #2d3748;
        }
        
        .faq-answer {
            padding: 0 1.5rem 1.2rem 1.5rem;
            color: #4a5568;
        }
        
        /* Table of Contents */
        .toc {
            background: #f7fafc;
            padding: 1.5rem;
            border-radius: 20px;
            margin: 2rem 0;
        }
        
        .toc h3 {
            margin-top: 0;
        }
        
        .toc ul {
            list-style: none;
            padding-left: 0;
        }
        
        .toc li {
            padding: 0.5rem 0;
            border-bottom: 1px solid #e2e8f0;
        }
        
        .toc a {
            color: #667eea;
            text-decoration: none;
            font-weight: 500;
            transition: color 0.3s;
        }
        
        .toc a:hover {
            color: #764ba2;
        }
        
        /* External links styling */
        .external-link {
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
            padding: 0.3rem 1rem;
            border-radius: 100px;
            text-decoration: none;
            font-weight: 500;
            margin: 0.2rem;
            transition: transform 0.2s;
        }
        
        .external-link:hover {
            transform: translateY(-2px);
        }
        
        /* Footer */
        .footer {
            background: linear-gradient(135deg, #1a202c 0%, #2d3748 100%);
            color: white;
            text-align: center;
            padding: 2rem;
            margin-top: 2rem;
        }
        
        /* Responsive */
        @media (max-width: 768px) {
            .content-area {
                padding: 1.5rem;
            }
            h1 {
                font-size: 1.8rem;
            }
            h2 {
                font-size: 1.5rem;
            }
        }
        
        /* Dark mode support */
        @media (prefers-color-scheme: dark) {
            body {
                background: linear-gradient(135deg, #1a202c 0%, #2d3748 100%);
            }
            .article-wrapper {
                background: #2d3748;
            }
            p, .faq-answer {
                color: #cbd5e0;
            }
            h3 {
                color: #e2e8f0;
            }
            .toc, .faq-item, .faq-question {
                background: #4a5568;
            }
            .faq-question {
                color: #f7fafc;
            }
        }
    </style>
    <script type="application/ld+json">
    {
        "@context": "https://schema.org",
        "@type": "TechArticle",
        "headline": "${targetTitle.replace(/"/g, '\\"')}",
        "image": "data:image/jpeg;base64,${base64Image}",
        "author": {
            "@type": "Organization",
            "name": "${CONFIG.siteName}"
        },
        "publisher": {
            "@type": "Organization",
            "name": "${CONFIG.siteName}",
            "logo": {
                "@type": "ImageObject",
                "url": "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEghost-logo.png"
            }
        }
    }
    </script>
</head>
<body>
    <div class="article-wrapper">
        <img src="data:image/jpeg;base64,${base64Image}" alt="${targetTitle}" class="hero-image">
        
        <div class="content-area">
            <div class="category-badge">${selectedNiche.label} • 2026</div>
            
            ${articleBody}
            
            <div class="pro-tip">
                <strong>💡 Pro Tip</strong>
                <p>Bookmark this article and share it with colleagues who need to stay ahead in ${selectedNiche.label}. The strategies above are proven to deliver results.</p>
            </div>
        </div>
        
        <div class="footer">
            <p>© 2026 ${CONFIG.siteName} — All rights reserved</p>
            <p style="font-size: 0.8rem; margin-top: 0.5rem;">AI-powered insights for modern professionals</p>
        </div>
    </div>
    
    <script>
        // Smooth scroll for TOC links
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function (e) {
                e.preventDefault();
                document.querySelector(this.getAttribute('href')).scrollIntoView({
                    behavior: 'smooth'
                });
            });
        });
    </script>
</body>
</html>`;

        // Publish to Blogger
        const oauth2Client = new google.auth.OAuth2(CONFIG.clientId, CONFIG.clientSecret);
        oauth2Client.setCredentials({ refresh_token: CONFIG.refreshToken });
        const blogger = google.blogger({ version: "v3", auth: oauth2Client });

        const response = await blogger.posts.insert({
            blogId: CONFIG.blogId,
            requestBody: {
                title: targetTitle,
                content: finalHtml,
                labels: [selectedNiche.id, selectedNiche.key, "2026", "premium", "featured"]
            }
        });
        
        console.log(`✅ Published! ${response.data.url}`);
        console.log(`🎨 Modern design with glass morphism, gradients, and premium typography`);
        console.log(`🖼️ Image has title watermark - unique fingerprint for Google Images`);
        
    } catch (error) {
        console.error("❌ Error:", error.message);
        if (error.response) console.error(error.response.data);
    }
}

runGroqPublisher();
