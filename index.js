const Groq = require("groq-sdk");
const { google } = require("googleapis");
const Parser = require("rss-parser");

const parser = new Parser();

const CONFIG = {
    groqKey: "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",
    blogId: "8249860422330426533",
    clientId: "872415365656-7qribadnc7k2u21kl6jjcbatdueevifh.apps.googleusercontent.com",
    clientSecret: "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",
    refreshToken: "1//04yti9k2agPknCgYIARAAGAQSNwF-L9IrTZPKt5Fqbg2vrM9sBtOks9cnY4M7Idg0LToQnlbYGME06k20vcyr_SVmYk1H_yZJdEc",
    siteName: "Zyphora"
};

// الأقسام الأكثر ربحاً ومتابعة في جوجل
const NICHES = [
    { id: "Make Money Online", searchQuery: '"passive income" OR "make money online" OR "affiliate marketing"', label: "Digital Wealth" },
    { id: "Business & SaaS", searchQuery: '"business software" OR "SaaS" OR "productivity tools"', label: "Business & Apps" },
    { id: "Cyber Security", searchQuery: '"cybersecurity" OR "network security" OR "privacy tools"', label: "Security & Tech" },
    { id: "Tech Fix", searchQuery: '"how to fix" OR "troubleshooting" Windows OR Android OR iOS', label: "Tech Solutions" },
    { id: "Web Hosting", searchQuery: '"best web hosting" OR "cloud computing" OR "website builder"', label: "Cloud & Web" }
];

const groq = new Groq({ apiKey: CONFIG.groqKey });

async function runGroqPublisher() {
    try {
        // 1. اختيار قسم وسحب تريند حقيقي من Google News
        const selectedNiche = NICHES[Math.floor(Math.random() * NICHES.length)];
        console.log(`🔍 Fetching Trend for: ${selectedNiche.id}...`);

        const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(selectedNiche.searchQuery)}+when:7d&hl=en-US&gl=US&ceid=US:en`;
        let sourceTopic = `Top ${selectedNiche.label} Trends for 2026`;

        try {
            const feed = await parser.parseURL(rssUrl);
            if (feed.items && feed.items.length > 0) {
                sourceTopic = feed.items[Math.floor(Math.random() * Math.min(5, feed.items.length))].title;
            }
        } catch (e) { console.log("RSS error, using fallback."); }

        // 2. إنشاء العنوان والمحتوى
        const aiRestriction = "CRITICAL: Do NOT mention AI/ChatGPT unless the topic is explicitly about them. Focus on practical tools and business strategies.";
        
        console.log("📝 Generating Content...");
        const contentRes = await groq.chat.completions.create({
            messages: [{ 
                role: "user", 
                content: `Write a long-form SEO article (1500+ words) about: "${sourceTopic}". 
                Template: <h1>Title</h1>, intro, <h2>headings</h2>, <h3>sub-headings</h3>, <p>paragraphs</p>, <ol> or <ul> lists, <strong>bold keywords</strong>, and internal links.
                Include 2 external links to authority sites (e.g. Wikipedia, YouTube).
                ${aiRestriction}
                Output JSON: {"title": "Viral Title", "articleHtml": "HTML Content Content...", "labels": ["tag1", "tag2"]}`
            }],
            model: "llama-3.3-70b-versatile",
            response_format: { type: "json_object" } 
        });
        
        const articleData = JSON.parse(contentRes.choices[0].message.content);

        // 3. جلب الصورة
        const imgDescRes = await groq.chat.completions.create({
            messages: [{ role: "user", content: `A cinematic high-tech background for: "${articleData.title}". No text. 5 words.` }],
            model: "llama-3.3-70b-versatile",
        });
        const imgPrompt = encodeURIComponent(imgDescRes.choices[0].message.content.trim());
        const finalImageUrl = `https://image.pollinations.ai/prompt/${imgPrompt}?width=1200&height=630&nologo=true`; 

        // 4. بناء الـ HTML النهائي بنفس التصميم المطلوب
        const finalHtml = `
            <style>
                .seo-article-container { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.8; max-width: 1200px; margin: 0 auto; padding: 15px;}
                .seo-article-image { width: 100%; max-width: 1200px; height: auto; border-radius: 12px; box-shadow: 0 8px 20px rgba(0,0,0,0.15); margin-bottom: 30px; object-fit: cover;}
                
                .seo-article-content h1 { text-align: center; margin-bottom: 25px; font-size: 28px; font-weight: bold; color: #2980b9; }
                .seo-article-content h2 { border-bottom: 2px solid rgba(128, 128, 128, 0.2); padding-bottom: 10px; margin-top: 30px; font-size: 24px; color: #3498db;}
                .seo-article-content h3 { font-size: 20px; margin-top: 25px; opacity: 0.9;}
                .seo-article-content p { font-size: 17px; margin-bottom: 18px; opacity: 0.85; }
                
                .seo-article-content a { color: #e74c3c; font-weight: bold; text-decoration: none; border-bottom: 1px dashed #e74c3c; padding-bottom: 2px;}
                .seo-article-content a:hover { color: #c0392b; border-bottom-style: solid; }
                
                .seo-article-content ul, .seo-article-content ol { background-color: rgba(52, 152, 219, 0.05); padding: 20px 40px; border-radius: 8px; border-left: 5px solid #3498db; margin: 25px 0;}
                .seo-article-content ul { list-style-type: disc;}
                .seo-article-content ol { list-style-type: decimal;}
                .seo-article-content li { margin-bottom: 12px; font-size: 16px; opacity: 0.85;}
                
                .seo-article-footer { text-align: center; font-style: italic; font-size: 14px; opacity: 0.6; margin-top: 40px; border-top: 1px solid rgba(128, 128, 128, 0.2); padding-top: 20px;}
            </style>

            <div class="seo-article-container" dir="ltr">
                <div style="text-align: center;">
                    <a href="${finalImageUrl}" target="_blank">
                        <img class="seo-article-image" src="${finalImageUrl}" alt="${articleData.title} - Blog Banner" loading="lazy">
                    </a>
                </div>
                
                <div class="seo-article-content">
                    ${articleData.articleHtml}
                </div>
                
                <div class="seo-article-footer">
                    <p>Crafted dynamically by ${CONFIG.siteName} AI Engine 2026</p>
                </div>
            </div>
        `;

        // 5. النشر
        const oauth2Client = new google.auth.OAuth2(CONFIG.clientId, CONFIG.clientSecret);
        oauth2Client.setCredentials({ refresh_token: CONFIG.refreshToken });
        const blogger = google.blogger({ version: "v3", auth: oauth2Client });

        await blogger.posts.insert({
            blogId: CONFIG.blogId,
            requestBody: { 
                title: articleData.title, 
                content: finalHtml, 
                labels: [...new Set([...articleData.labels, selectedNiche.id])]
            }
        });

        console.log(`✨ Published: ${articleData.title}`);
    } catch (error) {
        console.error("🔴 Error:", error.message);
    }
}

runGroqPublisher();
