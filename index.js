const Parser = require('rss-parser');
const { JSDOM } = require('jsdom');
const { Readability } = require('@mozilla/readability');
const cheerio = require('cheerio');
const { google } = require('googleapis');
const Groq = require('groq-sdk');
const axios = require('axios');

const BLOG_ID = process.env.BLOG_ID || "2636919176960128451";
const CLIENT_ID = process.env.CLIENT_ID || "872415365656-7qribadnc7k2u21kl6jjcbatdueevifh.apps.googleusercontent.com"; 
const CLIENT_SECRET = process.env.CLIENT_SECRET || "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"; 
const REFRESH_TOKEN = process.env.REFRESH_TOKEN || "1//04yti9k2agPknCgYIARAAGAQSNwF-L9IrTZPKt5Fqbg2vrM9sBtOks9cnY4M7Idg0LToQnlbYGME06k20vcyr_SVmYk1H_yZJdEc"; 
const GROQ_API_KEY = process.env.GROQ_API_KEY || "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"; 

const groq = new Groq({ apiKey: GROQ_API_KEY });
const parser = new Parser({
    timeout: 20000,
    headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml'
    }
});

// مصادر RSS مضمونة الوصول (بدون حظر 403)
const RELIABLE_SOURCES = [
    // ألعاب الفيديو
    { name: "IGN Games", url: "https://feeds.feedburner.com/ign/articles", category: "Video Game Reviews", type: "games" },
    { name: "GameSpot", url: "https://www.gamespot.com/feeds/news", category: "Video Game Reviews", type: "games" },
    { name: "Polygon", url: "https://www.polygon.com/rss/index.xml", category: "Video Game Reviews", type: "games" },
    { name: "Kotaku", url: "https://kotaku.com/rss", category: "Gaming News & Updates", type: "gaming" },
    { name: "Rock Paper Shotgun", url: "https://www.rockpapershotgun.com/feed", category: "Gaming News & Updates", type: "gaming" },
    { name: "PC Gamer", url: "https://www.pcgamer.com/rss", category: "Gaming News & Updates", type: "gaming" },
    // مراجعات تقنية
    { name: "TechRadar", url: "https://www.techradar.com/rss", category: "Tech Reviews", type: "tech" },
    { name: "CNET", url: "https://www.cnet.com/rss/news", category: "Tech Reviews", type: "tech" },
    { name: "The Verge", url: "https://www.theverge.com/rss/index.xml", category: "Tech Reviews", type: "tech" },
    { name: "Ars Technica", url: "https://feeds.arstechnica.com/arstechnica/index", category: "Tech Reviews", type: "tech" },
    // برامج وأدوات
    { name: "Product Hunt", url: "https://www.producthunt.com/feed", category: "Software & Tools", type: "software" },
    { name: "TechCrunch", url: "https://techcrunch.com/feed/", category: "Software & Tools", type: "software" },
    // ربح المال عبر الإنترنت
    { name: "Smart Passive Income", url: "https://www.smartpassiveincome.com/feed/", category: "Online Earning", type: "money" },
    { name: "Entrepreneur", url: "https://www.entrepreneur.com/feed", category: "Online Earning", type: "money" }
];

// قائمة بصور احتياطية عالية الجودة
const SAFE_IMAGES = [
    "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&q=80",
    "https://images.unsplash.com/photo-1511512578047-dfb367046420?w=800&q=80",
    "https://images.unsplash.com/photo-1552820728-8b83bb6b773f?w=800&q=80",
    "https://images.unsplash.com/photo-1535223289827-42f1e9919769?w=800&q=80",
    "https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&q=80"
];

function extractSafeImages($, dom) {
    let images = [];
    const unsafeKeywords = ['ad', 'ads', 'logo', 'icon', 'avatar', 'banner', 'promo', 'googlead'];
    
    $('img').each((i, el) => {
        if (images.length >= 2) return false;
        let src = $(el).attr('src') || $(el).attr('data-src');
        if (src && src.startsWith('http') && !unsafeKeywords.some(k => src.toLowerCase().includes(k))) {
            let cleanUrl = src.split('?')[0];
            if (cleanUrl.match(/\.(jpg|jpeg|png|webp)$/i) && cleanUrl.length < 500) {
                images.push(cleanUrl);
            }
        }
    });
    
    return images.length > 0 ? images : [SAFE_IMAGES[Math.floor(Math.random() * SAFE_IMAGES.length)]];
}

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function getArticleFromRSS(source) {
    try {
        console.log(`   📡 Fetching from ${source.name}...`);
        const feed = await parser.parseURL(source.url);
        
        // البحث عن مقال مناسب
        for (let item of feed.items.slice(0, 5)) {
            if (!item.link || !item.title) continue;
            
            // محاولة جلب المقال الكامل
            const articleData = await fetchArticleContent(item.link);
            if (articleData && articleData.text.length > 800) {
                return {
                    ...articleData,
                    sourceName: source.name,
                    category: source.category
                };
            }
            await delay(2000);
        }
        return null;
    } catch (error) {
        console.log(`   ⚠️ ${source.name} error: ${error.message}`);
        return null;
    }
}

async function fetchArticleContent(url) {
    try {
        const response = await axios.get(url, {
            timeout: 15000,
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml'
            }
        });

        const dom = new JSDOM(response.data, { url });
        const reader = new Readability(dom.window.document);
        const article = reader.parse();
        
        if (!article || !article.textContent || article.textContent.length < 500) return null;

        const $ = cheerio.load(article.content);
        const safeImages = extractSafeImages($, dom);
        
        return { 
            title: article.title || "Untitled",
            text: article.textContent.trim().replace(/\s+/g, ' ').slice(0, 4000), 
            images: safeImages,
            link: url 
        };
    } catch (e) { 
        return null; 
    }
}

// قوالب محتوى مخصصة لكل فئة
function getPromptForCategory(article, category) {
    const prompts = {
        "Video Game Reviews": `Write a professional video game review (1000-1500 words) about: "${article.title}"

Reference: ${article.text.substring(0, 2000)}

Requirements:
1. Gameplay mechanics analysis
2. Graphics and sound quality
3. Story and replayability
4. Pros and cons list
5. Final score (1-10)
6. FAQ section (3 questions)
7. Use H2 and H3 headings

Output JSON: {"seoTitle": "...", "metaDescription": "...", "keywords": [...], "htmlContent": "..."}`,

        "Gaming News & Updates": `Write a gaming news article (800-1200 words) about: "${article.title}"

Reference: ${article.text.substring(0, 2000)}

Requirements:
1. What happened and why it matters
2. Community reaction
3. Impact on gaming industry
4. What's next
5. FAQ section
6. Use headings and bullet points

Output JSON: {"seoTitle": "...", "metaDescription": "...", "keywords": [...], "htmlContent": "..."}`,

        "Tech Reviews": `Write a tech product review (1000-1500 words) about: "${article.title}"

Reference: ${article.text.substring(0, 2000)}

Requirements:
1. Key specifications
2. Performance testing
3. Price and value
4. Comparison with competitors
5. Pros and cons
6. Final verdict
7. FAQ section

Output JSON: {"seoTitle": "...", "metaDescription": "...", "keywords": [...], "htmlContent": "..."}`,

        "Software & Tools": `Write a software/tool review (800-1200 words) about: "${article.title}"

Reference: ${article.text.substring(0, 2000)}

Requirements:
1. Main features
2. Ease of use
3. Pricing plans
4. Best alternatives
5. Who should use it
6. FAQ section

Output JSON: {"seoTitle": "...", "metaDescription": "...", "keywords": [...], "htmlContent": "..."}`,

        "Online Earning": `Write about making money online (1000-1500 words) related to: "${article.title}"

Reference: ${article.text.substring(0, 2000)}

Requirements:
1. Step-by-step method
2. Realistic earnings potential
3. Time investment needed
4. Pros and cons
5. Common mistakes to avoid
6. FAQ section

Output JSON: {"seoTitle": "...", "metaDescription": "...", "keywords": [...], "htmlContent": "..."}`
    };
    
    return prompts[category] || prompts["Video Game Reviews"];
}

async function generateContent(article, category) {
    const prompt = getPromptForCategory(article, category);
    
    try {
        const completion = await groq.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model: "llama-3.3-70b-versatile",
            temperature: 0.7,
            max_tokens: 4500,
            response_format: { type: "json_object" }
        });
        
        const result = JSON.parse(completion.choices[0].message.content);
        if (result.htmlContent && result.htmlContent.length > 500) {
            return result;
        }
        return null;
    } catch (e) { 
        console.log(`   ❌ AI error: ${e.message}`);
        return null; 
    }
}

async function publishToBlogger(aiData, mainImage, category, readTime) {
    const currentDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    
    try {
        const htmlBody = `
<div dir="ltr">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f0f2f5; padding: 20px; }
        .post-container { max-width: 800px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
        .post-content { padding: 32px 40px; }
        .category-tag { display: inline-block; background: #e8f0fe; color: #1a73e8; font-size: 12px; font-weight: 600; padding: 4px 12px; border-radius: 20px; margin-bottom: 20px; }
        h1 { font-size: 28px; font-weight: 700; line-height: 1.3; margin-bottom: 16px; color: #202124; }
        .meta { color: #5f6368; font-size: 13px; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid #e8eaed; }
        .featured-image { margin: 20px 0 30px; border-radius: 12px; overflow: hidden; }
        .featured-image img { width: 100%; display: block; }
        .article-body h2 { font-size: 22px; font-weight: 600; margin: 32px 0 16px 0; color: #202124; }
        .article-body h3 { font-size: 18px; font-weight: 600; margin: 24px 0 12px 0; color: #202124; }
        .article-body p { line-height: 1.6; margin-bottom: 16px; color: #3c4043; }
        .article-body ul, .article-body ol { margin: 16px 0 16px 24px; }
        .article-body li { margin-bottom: 8px; line-height: 1.5; }
        .pros-cons { display: flex; gap: 20px; margin: 24px 0; }
        .pros { flex: 1; background: #e6f4ea; padding: 16px; border-radius: 12px; }
        .cons { flex: 1; background: #fce8e6; padding: 16px; border-radius: 12px; }
        .faq-section { background: #f8f9fa; border-radius: 12px; padding: 24px; margin: 32px 0; }
        .faq-item { margin-bottom: 20px; }
        .faq-question { font-weight: 700; margin-bottom: 8px; color: #202124; }
        @media (max-width: 600px) { .post-content { padding: 20px; } h1 { font-size: 24px; } .pros-cons { flex-direction: column; } }
    </style>
    <div class="post-container">
        <div class="post-content">
            <div class="category-tag">🎮 ${category}</div>
            <h1>${escapeHtml(aiData.seoTitle)}</h1>
            <div class="meta">📅 ${currentDate} | 📖 ${readTime} min read | ✍️ GamingHub</div>
            <div class="featured-image"><img src="${escapeHtml(mainImage)}" alt="${escapeHtml(aiData.seoTitle)}"></div>
            <div class="article-body">${aiData.htmlContent}</div>
        </div>
    </div>
</div>`;

        const auth = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET);
        auth.setCredentials({ refresh_token: REFRESH_TOKEN });
        const blogger = google.blogger({ version: 'v3', auth });

        await blogger.posts.insert({
            blogId: BLOG_ID,
            requestBody: {
                title: aiData.seoTitle,
                content: htmlBody,
                labels: [category, ...(aiData.keywords || []).slice(0, 3)]
            }
        });

        return true;
    } catch (e) {
        console.log(`   ❌ Publish error: ${e.message}`);
        return false;
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]));
}

// الفئات المستهدفة (5 فئات، مقال واحد من كل فئة)
const TARGET_CATEGORIES = [
    { name: "Video Game Reviews", cpc: "$2.50-$5.00", priority: 1 },
    { name: "Gaming News & Updates", cpc: "$2.00-$4.00", priority: 2 },
    { name: "Tech Reviews", cpc: "$3.00-$6.00", priority: 3 },
    { name: "Software & Tools", cpc: "$2.50-$5.50", priority: 4 },
    { name: "Online Earning", cpc: "$3.50-$7.00", priority: 5 }
];

async function startBot() {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🎮 5 ARTICLES BOT - ONE FROM EACH CATEGORY`);
    console.log(`📅 ${new Date().toLocaleString()}`);
    console.log(`${'='.repeat(60)}\n`);
    
    let published = 0;
    const results = {};
    
    for (const category of TARGET_CATEGORIES) {
        console.log(`\n🎯 WORKING ON: ${category.name} (${category.cpc})`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
        
        // البحث عن مصدر مناسب لهذه الفئة
        const sourcesForCategory = RELIABLE_SOURCES.filter(s => s.category === category.name);
        let articleFound = false;
        
        for (const source of sourcesForCategory) {
            if (articleFound) break;
            
            console.log(`   📡 Trying: ${source.name}`);
            const article = await getArticleFromRSS(source);
            
            if (article && article.text.length > 500) {
                console.log(`   ✅ Found: ${article.title.substring(0, 60)}...`);
                console.log(`   🤖 Generating AI content...`);
                
                const aiContent = await generateContent(article, category.name);
                
                if (aiContent) {
                    const coverImage = article.images[0] || SAFE_IMAGES[Math.floor(Math.random() * SAFE_IMAGES.length)];
                    const wordCount = aiContent.htmlContent.replace(/<[^>]*>/g, '').split(/\s+/).length;
                    const readTime = Math.max(5, Math.ceil(wordCount / 200));
                    
                    console.log(`   📝 Publishing (${wordCount} words)...`);
                    const success = await publishToBlogger(aiContent, coverImage, category.name, readTime);
                    
                    if (success) {
                        published++;
                        results[category.name] = "✅ PUBLISHED";
                        articleFound = true;
                        console.log(`   ✅ SUCCESS! Article ${published}/5 published\n`);
                        await delay(30000);
                    } else {
                        results[category.name] = "❌ PUBLISH FAILED";
                    }
                } else {
                    results[category.name] = "❌ AI FAILED";
                }
            } else {
                console.log(`   ⚠️ No valid article from ${source.name}`);
            }
            
            await delay(3000);
        }
        
        if (!articleFound) {
            results[category.name] = "❌ NO SOURCE AVAILABLE";
            console.log(`   ❌ Could not find article for ${category.name}\n`);
        }
    }
    
    // عرض النتائج النهائية
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📊 FINAL RESULTS - ${published}/5 ARTICLES PUBLISHED`);
    console.log(`${'='.repeat(60)}`);
    for (const [category, status] of Object.entries(results)) {
        console.log(`   ${status}  ${category}`);
    }
    console.log(`${'='.repeat(60)}\n`);
    
    process.exit(0);
}

startBot();
