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

// قائمة بأعلى 5 أنواع محتوى ربحاً في AdSense
const HIGH_VALUE_CATEGORIES = [
    { name: "Video Game Reviews", keywords: ["game review", "video game review", "gaming review", "review of", "game analysis"], cpc: "$2.50-$5.00" },
    { name: "Gaming News & Updates", keywords: ["gaming news", "video game news", "game update", "new game release", "gaming industry"], cpc: "$2.00-$4.00" },
    { name: "Tech Reviews", keywords: ["tech review", "gadget review", "smartphone review", "laptop review", "device review"], cpc: "$3.00-$6.00" },
    { name: "Software & Tools", keywords: ["software review", "app review", "tool review", "best software", "productivity tools"], cpc: "$2.50-$5.50" },
    { name: "Online Earning", keywords: ["make money online", "passive income", "freelancing", "side hustle", "work from home"], cpc: "$3.50-$7.00" }
];

// استخراج مقالات من Medium حسب التصنيف
const MEDIUM_TOPICS = [
    { name: "Video Game Reviews", tag: "video-game-reviews", url: "https://medium.com/tag/video-game-reviews/latest", category: "Video Game Reviews" },
    { name: "Gaming", tag: "gaming", url: "https://medium.com/tag/gaming/latest", category: "Gaming News & Updates" },
    { name: "Tech Reviews", tag: "tech-reviews", url: "https://medium.com/tag/tech-reviews/latest", category: "Tech Reviews" },
    { name: "Software Development", tag: "software-development", url: "https://medium.com/tag/software-development/latest", category: "Software & Tools" },
    { name: "Make Money Online", tag: "make-money-online", url: "https://medium.com/tag/make-money-online/latest", category: "Online Earning" },
    { name: "Productivity", tag: "productivity", url: "https://medium.com/tag/productivity/latest", category: "Online Earning" },
    { name: "Indie Gaming", tag: "indie-gaming", url: "https://medium.com/tag/indie-gaming/latest", category: "Video Game Reviews" },
    { name: "Game Development", tag: "game-development", url: "https://medium.com/tag/game-development/latest", category: "Gaming News & Updates" }
];

// قائمة بصور آمنة عالية الجودة
const SAFE_IMAGES = [
    "https://images.unsplash.com/photo-1511512578047-dfb367046420?w=800&q=80", // Gaming setup
    "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&q=80", // Gaming
    "https://images.unsplash.com/photo-1552820728-8b83bb6b773f?w=800&q=80", // Console
    "https://images.unsplash.com/photo-1535223289827-42f1e9919769?w=800&q=80", // Controller
    "https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&q=80", // Tech
    "https://images.unsplash.com/photo-1581291518633-83b4ebd1d83e?w=800&q=80"  // Code
];

function extractSafeImages($, dom) {
    let images = [];
    const unsafeKeywords = ['ad', 'ads', 'advertisement', 'sponsor', 'logo', 'icon', 'avatar', 'banner', 'promo', 'googlead', 'doubleclick', 'data:image'];
    
    $('img').each((i, el) => {
        if (images.length >= 2) return false;
        
        let src = $(el).attr('src') || $(el).attr('data-src');
        if (src && src.startsWith('http') && !unsafeKeywords.some(k => src.toLowerCase().includes(k))) {
            let cleanUrl = src.split('?')[0];
            if (cleanUrl.match(/\.(jpg|jpeg|png|webp)$/i) && cleanUrl.length < 500 && !images.includes(cleanUrl)) {
                images.push(cleanUrl);
            }
        }
    });
    
    return images.length > 0 ? images : [SAFE_IMAGES[Math.floor(Math.random() * SAFE_IMAGES.length)]];
}

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// استخراج مقالات من Medium
async function getMediumArticles(topic) {
    try {
        console.log(`   🔍 Searching Medium for: ${topic.name}`);
        
        const response = await axios.get(topic.url, {
            timeout: 15000,
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9'
            }
        });

        const $ = cheerio.load(response.data);
        const articles = [];
        
        // استخراج روابط المقالات من Medium
        $('article a[href*="/p/"], article a[href*="/@"]').each((i, el) => {
            if (articles.length >= 6) return false;
            let href = $(el).attr('href');
            if (href && href.startsWith('https://medium.com/') && !href.includes('?source=')) {
                const title = $(el).find('h1, h2, h3').first().text().trim();
                if (title && title.length > 20 && !articles.some(a => a.link === href)) {
                    articles.push({ link: href, title: title });
                }
            }
        });
        
        // بديل: استخدام RSS feed الخاص بـ Medium
        if (articles.length === 0 && topic.tag) {
            const rssUrl = `https://medium.com/feed/tag/${topic.tag}`;
            try {
                const feed = await parser.parseURL(rssUrl);
                feed.items.slice(0, 6).forEach(item => {
                    if (!articles.some(a => a.link === item.link)) {
                        articles.push({ link: item.link, title: item.title });
                    }
                });
            } catch (e) {
                console.log(`   ⚠️ RSS feed failed: ${e.message}`);
            }
        }
        
        return articles;
    } catch (error) {
        console.log(`   ❌ Medium fetch error: ${error.message}`);
        return [];
    }
}

async function getArticleData(url) {
    try {
        const response = await axios.get(url, {
            timeout: 20000,
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
            }
        });

        const dom = new JSDOM(response.data, { url });
        const reader = new Readability(dom.window.document);
        const article = reader.parse();
        
        if (!article || !article.textContent || article.textContent.length < 500) return null;

        const $ = cheerio.load(article.content);
        const safeImages = extractSafeImages($, dom);
        
        const cleanText = article.textContent.trim().replace(/\s+/g, ' ').slice(0, 4000);

        return { 
            title: article.title || "Untitled",
            text: cleanText, 
            images: safeImages,
            link: url 
        };
    } catch (e) { 
        console.log(`   ❌ Fetch error: ${e.message}`);
        return null; 
    }
}

// تحديد فئة المحتوى بناءً على العنوان والنص
function detectContentCategory(title, text) {
    const lowerContent = (title + " " + text).toLowerCase();
    
    for (const category of HIGH_VALUE_CATEGORIES) {
        for (const keyword of category.keywords) {
            if (lowerContent.includes(keyword.toLowerCase())) {
                return category.name;
            }
        }
    }
    
    return HIGH_VALUE_CATEGORIES[0].name; // افتراضي: Video Game Reviews
}

async function generateSmartContent(article, category) {
    // تحسين البرومبت حسب نوع المحتوى
    const categoryGuidance = {
        "Video Game Reviews": "Focus on game mechanics, graphics, storyline, replayability, value for money, and comparison with similar games.",
        "Gaming News & Updates": "Focus on latest updates, patch notes, developer announcements, release dates, and industry trends.",
        "Tech Reviews": "Focus on specifications, performance, price-to-value ratio, pros and cons, and comparison with competitors.",
        "Software & Tools": "Focus on features, usability, pricing, alternatives, and real-world use cases.",
        "Online Earning": "Focus on proven methods, realistic expectations, step-by-step guides, and warning about scams."
    };
    
    const prompt = `Write a detailed, SEO-optimized blog article (1200-1800 words) about: "${article.title}"

Content Category: ${category}

${categoryGuidance[category] || categoryGuidance["Video Game Reviews"]}

Reference content for facts and details: ${article.text.substring(0, 2500)}

Requirements:
1. Write in professional English
2. Use H2 and H3 headings structure
3. Include 2-3 pro tips or warning boxes
4. Add comparison table if relevant
5. End with FAQ section (4-5 questions)
6. Include a strong conclusion with call-to-action
7. Short, scannable paragraphs (max 3-4 sentences)
8. Use bullet points and numbered lists where appropriate

Output ONLY valid JSON (no other text):
{
    "seoTitle": "SEO title 50-60 chars including main keyword",
    "metaDescription": "Compelling meta description 150-160 chars",
    "keywords": ["keyword1","keyword2","keyword3","keyword4","keyword5"],
    "htmlContent": "Full HTML content with proper formatting, headings, lists, tip boxes, and FAQ section"
}`;

    try {
        const completion = await groq.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model: "llama-3.3-70b-versatile",
            temperature: 0.7,
            max_tokens: 5000,
            response_format: { type: "json_object" }
        });
        
        const result = JSON.parse(completion.choices[0].message.content);
        
        if (result.htmlContent && result.htmlContent.length > 800) {
            return result;
        }
        throw new Error("Content too short");
    } catch (e) { 
        console.log(`   ❌ AI failed: ${e.message}`);
        return null; 
    }
}

async function publishToBlogger(aiData, mainImage, category, readTime, currentDate) {
    try {
        const htmlBody = `
<div dir="ltr">
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Inter', sans-serif; background: linear-gradient(135deg, #f5f7fa 0%, #eef2f7 100%); padding: 30px 20px; }
        .article-card { max-width: 900px; margin: 0 auto; background: white; border-radius: 32px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); transition: transform 0.3s ease; }
        .article-inner { padding: 40px 50px; }
        .category-badge { display: inline-flex; align-items: center; gap: 8px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; font-size: 0.75rem; font-weight: 700; padding: 6px 14px; border-radius: 40px; margin-bottom: 24px; text-transform: uppercase; letter-spacing: 1px; }
        h1 { font-size: 2.4rem; font-weight: 800; line-height: 1.3; margin-bottom: 20px; color: #0f172a; }
        .meta { display: flex; gap: 24px; font-size: 0.85rem; color: #64748b; margin: 20px 0 30px; padding-bottom: 20px; border-bottom: 2px solid #e2e8f0; flex-wrap: wrap; }
        .meta i { margin-right: 6px; color: #667eea; }
        .featured-img { position: relative; margin: 20px 0 35px; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1); }
        .featured-img img { width: 100%; display: block; }
        .watermark { position: absolute; bottom: 12px; right: 12px; background: rgba(0,0,0,0.6); color: white; padding: 5px 12px; border-radius: 20px; font-size: 11px; backdrop-filter: blur(6px); }
        .article-content h2 { font-size: 1.8rem; font-weight: 700; margin: 40px 0 18px 0; padding-left: 14px; border-left: 5px solid #667eea; color: #0f172a; }
        .article-content h3 { font-size: 1.4rem; font-weight: 600; margin: 28px 0 12px 0; color: #1e293b; }
        .article-content p { margin-bottom: 1.2rem; line-height: 1.75; color: #334155; }
        .article-content ul, .article-content ol { margin: 1rem 0 1rem 1.5rem; color: #334155; }
        .article-content li { margin-bottom: 0.5rem; }
        .tip-box { background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-left: 5px solid #f59e0b; padding: 20px 25px; border-radius: 20px; margin: 30px 0; }
        .tip-box strong { color: #92400e; display: flex; align-items: center; gap: 10px; font-size: 1.1rem; margin-bottom: 10px; }
        .warning-box { background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%); border-left: 5px solid #ef4444; padding: 20px 25px; border-radius: 20px; margin: 30px 0; }
        .warning-box strong { color: #991b1b; display: flex; align-items: center; gap: 10px; }
        .faq-section { background: #f8fafc; border-radius: 24px; padding: 30px; margin: 40px 0 25px; }
        .faq-section h3 { margin-top: 0 !important; }
        .faq-item { margin-bottom: 22px; padding-bottom: 15px; border-bottom: 1px solid #e2e8f0; }
        .faq-item strong { display: block; margin-bottom: 8px; color: #1e293b; font-size: 1rem; }
        .comparison-table { width: 100%; border-collapse: collapse; margin: 25px 0; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
        .comparison-table th { background: #1e293b; color: white; padding: 12px; font-weight: 600; }
        .comparison-table td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; }
        .author-box { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 24px; padding: 25px; margin: 45px 0 20px; display: flex; gap: 20px; align-items: center; color: white; }
        .author-avatar { width: 60px; height: 60px; background: rgba(255,255,255,0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.8rem; }
        @media (max-width: 650px) {
            .article-inner { padding: 25px 20px; }
            h1 { font-size: 1.7rem; }
            .meta { gap: 12px; }
        }
    </style>

    <div class="article-card">
        <div class="article-inner">
            <div class="category-badge">
                <i class="fas fa-star"></i> ${escapeHtml(category)}
            </div>
            <h1>${escapeHtml(aiData.seoTitle)}</h1>
            <div class="meta">
                <span><i class="far fa-calendar-alt"></i> ${currentDate}</span>
                <span><i class="far fa-user"></i> GamingHub Pro</span>
                <span><i class="far fa-clock"></i> ${readTime} min read</span>
                <span><i class="fas fa-chart-line"></i> ${category}</span>
            </div>

            <div class="featured-img">
                <img src="${escapeHtml(mainImage)}" alt="${escapeHtml(aiData.seoTitle)}">
                <div class="watermark"><i class="fas fa-copyright"></i> GamingHub ${new Date().getFullYear()}</div>
            </div>

            <div class="article-content">
                ${aiData.htmlContent}
            </div>

            <div class="author-box">
                <div class="author-avatar"><i class="fas fa-gamepad"></i></div>
                <div>
                    <h4 style="margin-bottom: 5px; color: white;">GamingHub Team</h4>
                    <p style="font-size: 0.85rem; opacity: 0.9;">Expert gaming reviews, tech insights, and earning strategies</p>
                </div>
            </div>
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
                labels: [category, ...(aiData.keywords || []).slice(0, 4)],
                customMetaData: aiData.metaDescription
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

// منع النشر المكرر باستخدام مجموعة من الروابط المنشورة
let publishedLinks = new Set();

async function startEmpireBot() {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🎮 GAMING & HIGH-VALUE CONTENT BOT STARTED`);
    console.log(`📅 ${new Date().toLocaleString()}`);
    console.log(`${'='.repeat(60)}\n`);
    
    let totalPublished = 0;
    const articlesByCategory = {};
    
    // تهيئة عداد لكل فئة
    for (const category of HIGH_VALUE_CATEGORIES) {
        articlesByCategory[category.name] = 0;
    }
    
    // المعالجة حسب كل فئة من الفئات ذات القيمة العالية
    for (const category of HIGH_VALUE_CATEGORIES) {
        console.log(`\n🎯 TARGETING: ${category.name} (CPC: ${category.cpc})`);
        console.log(`📊 Need: ${5 - articlesByCategory[category.name]} more articles\n`);
        
        // البحث عن مواضيع Medium المناسبة لهذه الفئة
        const relevantTopics = MEDIUM_TOPICS.filter(t => t.category === category.name);
        
        for (const topic of relevantTopics) {
            if (articlesByCategory[category.name] >= 5) break;
            
            console.log(`   📚 Topic: ${topic.name}`);
            const mediumArticles = await getMediumArticles(topic);
            
            if (mediumArticles.length === 0) {
                console.log(`   ⚠️ No articles found\n`);
                continue;
            }
            
            for (const mediumArticle of mediumArticles) {
                if (articlesByCategory[category.name] >= 5) break;
                
                // تجنب النشر المكرر
                if (publishedLinks.has(mediumArticle.link)) {
                    console.log(`   ⏭️ Already published: ${mediumArticle.title.substring(0, 40)}...`);
                    continue;
                }
                
                console.log(`   📄 Found: "${mediumArticle.title.substring(0, 50)}..."`);
                
                const articleData = await getArticleData(mediumArticle.link);
                if (!articleData) {
                    console.log(`   ⏭️ Could not fetch full article\n`);
                    continue;
                }
                
                // تأكيد فئة المحتوى
                const detectedCategory = detectContentCategory(articleData.title, articleData.text);
                if (detectedCategory !== category.name) {
                    console.log(`   🔄 Category mismatch: ${detectedCategory} vs ${category.name}, skipping...\n`);
                    continue;
                }
                
                console.log(`   🤖 Generating AI content for ${category.name}...`);
                const aiData = await generateSmartContent(articleData, category.name);
                if (!aiData) {
                    console.log(`   ⏭️ AI generation failed\n`);
                    continue;
                }

                const coverImg = articleData.images[0] || SAFE_IMAGES[Math.floor(Math.random() * SAFE_IMAGES.length)];
                const wordCount = aiData.htmlContent.replace(/<[^>]*>/g, '').split(/\s+/).length;
                const readTime = Math.max(5, Math.ceil(wordCount / 200));
                const currentDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

                const success = await publishToBlogger(aiData, coverImg, category.name, readTime, currentDate);
                
                if (success) {
                    totalPublished++;
                    publishedLinks.add(mediumArticle.link);
                    articlesByCategory[category.name]++;
                    console.log(`   ✅ PUBLISHED! (${articlesByCategory[category.name]}/5 for ${category.name}) - ${wordCount} words\n`);
                    
                    // انتظار أطول بين المنشورات لتجنب المشاكل
                    await delay(45000);
                } else {
                    console.log(`   ❌ Publishing failed\n`);
                }
            }
            
            await delay(15000);
        }
        
        // عرض التقدم لكل فئة
        console.log(`\n📈 Progress for ${category.name}: ${articlesByCategory[category.name]}/5 articles\n`);
        await delay(20000);
    }
    
    // ملخص النشر
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🏁 BOT FINISHED`);
    console.log(`📊 Total Published: ${totalPublished} articles`);
    console.log(`\n📋 Breakdown by category:`);
    for (const [category, count] of Object.entries(articlesByCategory)) {
        const categoryInfo = HIGH_VALUE_CATEGORIES.find(c => c.name === category);
        console.log(`   • ${category}: ${count}/5 articles (CPC: ${categoryInfo?.cpc || 'N/A'})`);
    }
    console.log(`${'='.repeat(60)}`);
    process.exit(0);
}

// تشغيل البوت
startEmpireBot();
