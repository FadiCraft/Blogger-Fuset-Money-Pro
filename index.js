// publisher.js
const Groq = require("groq-sdk");
const { google } = require("googleapis");
const Parser = require("rss-parser");

const parser = new Parser();

// ----------------------------- CONFIGURATION -----------------------------
// استخدم متغيرات البيئة في GitHub Actions بدل الكتابة المباشرة
const CONFIG = {
   groqKey: "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",
    blogId: "8249860422330426533",
    clientId: "872415365656-7qribadnc7k2u21kl6jjcbatdueevifh.apps.googleusercontent.com",
    clientSecret: "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",
    refreshToken: "1//04yti9k2agPknCgYIARAAGAQSNwF-L9IrTZPKt5Fqbg2vrM9sBtOks9cnY4M7Idg0LToQnlbYGME06k20vcyr_SVmYk1H_yZJdEc",
    siteName: "Zyphora"
    maxPostsPerRun: parseInt(process.env.MAX_POSTS_PER_RUN) || 1,
    retries: parseInt(process.env.RETRIES) || 2,
    delayBetweenPosts: parseInt(process.env.DELAY_BETWEEN_POSTS_MS) || 30000,
};



// الأقسام المربحة
const NICHES = [
    { id: "Make Money Online", searchQuery: '"passive income" OR "make money online" OR "affiliate marketing"', label: "Digital Wealth" },
    { id: "Business & SaaS", searchQuery: '"business software" OR "SaaS" OR "productivity tools"', label: "Business & Apps" },
    { id: "Cyber Security", searchQuery: '"cybersecurity" OR "network security" OR "privacy tools"', label: "Security & Tech" },
    { id: "Tech Fix", searchQuery: '"how to fix" OR "troubleshooting" Windows OR Android OR iOS', label: "Tech Solutions" },
    { id: "Web Hosting", searchQuery: '"best web hosting" OR "cloud computing" OR "website builder"', label: "Cloud & Web" }
];

// ----------------------------- HELPERS -----------------------------
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function withRetry(fn, retries = CONFIG.retries, delay = 5000) {
    for (let i = 0; i < retries; i++) {
        try {
            return await fn();
        } catch (error) {
            console.warn(`⚠️ Attempt ${i + 1} failed: ${error.message}`);
            if (i === retries - 1) throw error;
            await sleep(delay);
        }
    }
}

// ----------------------------- GOOGLE NEWS TREND -----------------------------
async function fetchTrendingTopic(selectedNiche) {
    const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(selectedNiche.searchQuery)}+when:7d&hl=en-US&gl=US&ceid=US:en`;
    try {
        const feed = await parser.parseURL(rssUrl);
        if (feed.items?.length) {
            return feed.items[Math.floor(Math.random() * Math.min(5, feed.items.length))].title;
        }
    } catch (e) {
        console.log("RSS error, using fallback topic.");
    }
    return `Top ${selectedNiche.label} Trends for ${new Date().getFullYear()}`;
}

// ----------------------------- AI CONTENT GENERATION -----------------------------
async function generateArticle(topic, nicheId) {
    const groq = new Groq({ apiKey: CONFIG.groqKey });

    const systemPrompt = `You are an expert SEO blogger. Write a long-form article (1500+ words) in HTML format.
    - Do NOT mention AI tools unless the topic is specifically about AI.
    - Use natural internal links like '<a href="/search/label/example">example</a>'
    - Include 2 external links to high-authority sites.
    - Output strictly as JSON: {"title": "...", "articleHtml": "...", "labels": [...]}`;

    const userPrompt = `Topic: "${topic}"
    Niche: ${nicheId}
    Write engaging, practical, and SEO-optimized content with proper headings (h1, h2, h3), lists, and bold keywords.`;

    const response = await groq.chat.completions.create({
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
        ],
        model: "llama-3.3-70b-versatile",
        temperature: 0.8,
        response_format: { type: "json_object" }
    });

    return JSON.parse(response.choices[0].message.content);
}

async function generateImagePrompt(title) {
    const groq = new Groq({ apiKey: CONFIG.groqKey });
    const response = await groq.chat.completions.create({
        messages: [{ role: "user", content: `A cinematic high-tech background for: "${title}". No text. 5 words.` }],
        model: "llama-3.3-70b-versatile",
    });
    return encodeURIComponent(response.choices[0].message.content.trim());
}

// ----------------------------- HTML TEMPLATE -----------------------------
function buildFinalHtml(articleData, imageUrl) {
    return `
        <style>
            .seo-article-container { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.8; max-width: 1200px; margin: 0 auto; padding: 15px;}
            .seo-article-image { width: 100%; max-width: 1200px; height: auto; border-radius: 12px; box-shadow: 0 8px 20px rgba(0,0,0,0.15); margin-bottom: 30px;}
            .seo-article-content h1 { text-align: center; margin-bottom: 25px; font-size: 28px; font-weight: bold; color: #2980b9; }
            .seo-article-content h2 { border-bottom: 2px solid rgba(128, 128, 128, 0.2); padding-bottom: 10px; margin-top: 30px; font-size: 24px; color: #3498db;}
            .seo-article-content h3 { font-size: 20px; margin-top: 25px;}
            .seo-article-content p { font-size: 17px; margin-bottom: 18px; line-height: 1.7;}
            .seo-article-content a { color: #e74c3c; font-weight: bold; text-decoration: none; border-bottom: 1px dashed #e74c3c;}
            .seo-article-content a:hover { color: #c0392b; }
            .seo-article-content ul, .seo-article-content ol { background: rgba(52,152,219,0.05); padding: 20px 40px; border-radius: 8px; border-left: 5px solid #3498db;}
            .seo-article-footer { text-align: center; font-style: italic; font-size: 14px; opacity: 0.7; margin-top: 40px; border-top: 1px solid #ddd; padding-top: 20px;}
        </style>
        <div class="seo-article-container" dir="ltr">
            <div style="text-align: center;">
                <img class="seo-article-image" src="${imageUrl}" alt="${articleData.title}" loading="lazy">
            </div>
            <div class="seo-article-content">
                ${articleData.articleHtml}
            </div>
            <div class="seo-article-footer">
                <p>Crafted dynamically by ${CONFIG.siteName} AI Engine ${new Date().getFullYear()}</p>
            </div>
        </div>
    `;
}

// ----------------------------- BLOGGER PUBLISH -----------------------------
async function publishToBlogger(title, content, labels, nicheId) {
    const oauth2Client = new google.auth.OAuth2(CONFIG.clientId, CONFIG.clientSecret);
    oauth2Client.setCredentials({ refresh_token: CONFIG.refreshToken });
    const blogger = google.blogger({ version: "v3", auth: oauth2Client });

    const finalLabels = [...new Set([...labels, nicheId, "AI-assisted", "SEO"])];
    
    await blogger.posts.insert({
        blogId: CONFIG.blogId,
        requestBody: {
            title,
            content,
            labels: finalLabels
        }
    });
}

// ----------------------------- MAIN WORKFLOW -----------------------------
async function runSinglePost(niche) {
    console.log(`\n🚀 Starting new post for niche: ${niche.id}`);
    
    const topic = await fetchTrendingTopic(niche);
    console.log(`📰 Topic: ${topic}`);
    
    const articleData = await generateArticle(topic, niche.id);
    console.log(`✍️ Article generated: ${articleData.title}`);
    
    const imgPrompt = await generateImagePrompt(articleData.title);
    const imageUrl = `https://image.pollinations.ai/prompt/${imgPrompt}?width=1200&height=630&nologo=true`;
    
    const finalHtml = buildFinalHtml(articleData, imageUrl);
    
    await publishToBlogger(articleData.title, finalHtml, articleData.labels, niche.id);
    console.log(`✅ Published: ${articleData.title}`);
}

async function runPublisher() {
    console.log(`🤖 AI Publisher Started (${new Date().toISOString()})`);
    console.log(`📚 Max posts this run: ${CONFIG.maxPostsPerRun}`);
    
    // اختيار مقالات عشوائية من الأقسام المختلفة
    const shuffledNiches = [...NICHES].sort(() => 0.5 - Math.random());
    const selectedNiches = shuffledNiches.slice(0, CONFIG.maxPostsPerRun);
    
    for (let i = 0; i < selectedNiches.length; i++) {
        const niche = selectedNiches[i];
        try {
            await withRetry(() => runSinglePost(niche));
            if (i < selectedNiches.length - 1) {
                console.log(`⏳ Waiting ${CONFIG.delayBetweenPosts / 1000}s before next post...`);
                await sleep(CONFIG.delayBetweenPosts);
            }
        } catch (error) {
            console.error(`❌ Failed to publish for niche ${niche.id}:`, error.message);
        }
    }
    
    console.log(`🏁 Publisher finished.`);
}

// ----------------------------- EXECUTE -----------------------------
if (require.main === module) {
    runPublisher().catch(console.error);
}

module.exports = { runPublisher };
