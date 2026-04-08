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
    timeout: 15000,
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
});

// مصادر موثوقة ومجانية (بدون حظر 403)
const SOURCES = [
    { name: "TechCrunch", url: "https://techcrunch.com/feed/", label: "Tech", enabled: true },
    { name: "Wired", url: "https://www.wired.com/feed/rss", label: "Tech", enabled: true },
    { name: "The Verge", url: "https://www.theverge.com/rss/index.xml", label: "Tech", enabled: true },
    { name: "Mashable", url: "https://mashable.com/feeds/rss/all", label: "Tech", enabled: true }
];

// قائمة بصور آمنة
const SAFE_IMAGES = [
    "https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&q=80",
    "https://images.unsplash.com/photo-1432888498266-38ffec3eaf0a?w=800&q=80",
    "https://images.unsplash.com/photo-1581291518633-83b4ebd1d83e?w=800&q=80",
    "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&q=80",
    "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=800&q=80"
];

function extractSafeImages($, dom) {
    let images = [];
    const unsafeKeywords = ['ad', 'ads', 'advertisement', 'sponsor', 'logo', 'icon', 'avatar', 'banner', 'promo', 'googlead', 'doubleclick'];
    
    $('img').each((i, el) => {
        if (images.length >= 2) return false;
        
        let src = $(el).attr('src') || $(el).attr('data-src');
        if (src && src.startsWith('http') && !unsafeKeywords.some(k => src.toLowerCase().includes(k))) {
            let cleanUrl = src.split('?')[0];
            if (cleanUrl.match(/\.(jpg|jpeg|png|webp)$/i) && cleanUrl.length < 300 && !images.includes(cleanUrl)) {
                images.push(cleanUrl);
            }
        }
    });
    
    return images.length > 0 ? images : [SAFE_IMAGES[Math.floor(Math.random() * SAFE_IMAGES.length)]];
}

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function getArticleData(url) {
    try {
        const response = await axios.get(url, {
            timeout: 15000,
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
        
        const cleanText = article.textContent.trim().replace(/\s+/g, ' ').slice(0, 3000);

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

async function generateSmartContent(article, retryCount = 0) {
    // نص أبسط وأقصر لضمان نجاح الذكاء الاصطناعي
    const prompt = `Write a professional blog article (800-1200 words) about: "${article.title}"

Reference content: ${article.text.substring(0, 2000)}

Requirements:
1. Write in English
2. Use H2 and H3 headings
3. Add 2 tip boxes
4. End with FAQ section (3 questions)
5. Short paragraphs

Output ONLY valid JSON:
{
    "seoTitle": "SEO title max 60 chars",
    "metaDescription": "Meta description max 160 chars", 
    "keywords": ["kw1","kw2","kw3","kw4"],
    "htmlContent": "HTML content here"
}`;

    try {
        const completion = await groq.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model: "llama-3.3-70b-versatile",
            temperature: 0.7,
            max_tokens: 4000,
            response_format: { type: "json_object" }
        });
        
        const result = JSON.parse(completion.choices[0].message.content);
        
        if (result.htmlContent && result.htmlContent.length > 500) {
            return result;
        }
        throw new Error("Content too short");
    } catch (e) { 
        if (retryCount < 1) {
            console.log(`   🔄 Retry ${retryCount + 1}...`);
            await delay(3000);
            return generateSmartContent(article, retryCount + 1);
        }
        console.log(`   ❌ AI failed: ${e.message}`);
        return null; 
    }
}

async function publishToBlogger(aiData, mainImage, sourceLabel, readTime, currentDate) {
    try {
        const htmlBody = `
<div dir="ltr">
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Inter', sans-serif; background: #f5f7fa; padding: 20px; }
        .article-card { max-width: 880px; margin: 0 auto; background: white; border-radius: 28px; overflow: hidden; box-shadow: 0 20px 35px -12px rgba(0,0,0,0.1); }
        .article-inner { padding: 35px 45px; }
        .category { display: inline-block; background: #eef2ff; color: #2563eb; font-size: 0.8rem; font-weight: 600; padding: 4px 12px; border-radius: 30px; margin-bottom: 20px; }
        h1 { font-size: 2.2rem; font-weight: 800; line-height: 1.3; margin-bottom: 16px; color: #0a0f2c; }
        .meta { display: flex; gap: 20px; font-size: 0.85rem; color: #64748b; margin: 15px 0 25px; padding-bottom: 15px; border-bottom: 2px solid #eef2f8; }
        .meta i { margin-right: 5px; color: #3b82f6; }
        .featured-img { position: relative; margin: 20px 0 30px; border-radius: 20px; overflow: hidden; }
        .featured-img img { width: 100%; display: block; }
        .watermark { position: absolute; bottom: 12px; right: 12px; background: rgba(0,0,0,0.5); color: white; padding: 4px 10px; border-radius: 8px; font-size: 11px; backdrop-filter: blur(4px); }
        .article-content h2 { font-size: 1.7rem; font-weight: 700; margin: 35px 0 15px 0; padding-left: 12px; border-left: 4px solid #3b82f6; }
        .article-content h3 { font-size: 1.3rem; font-weight: 600; margin: 25px 0 10px 0; }
        .article-content p { margin-bottom: 1rem; line-height: 1.7; color: #334155; }
        .tip-box { background: #f0f9ff; border-left: 4px solid #0ea5e9; padding: 18px 22px; border-radius: 16px; margin: 25px 0; }
        .tip-box strong { color: #0284c7; display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
        .faq-section { background: #f8fafc; border-radius: 20px; padding: 25px; margin: 35px 0 20px; }
        .faq-item { margin-bottom: 18px; padding-bottom: 12px; border-bottom: 1px solid #e2e8f0; }
        .faq-item strong { display: block; margin-bottom: 6px; color: #1e293b; }
        .author-box { background: #f1f5f9; border-radius: 20px; padding: 20px; margin: 40px 0 15px; display: flex; gap: 18px; align-items: center; }
        .author-avatar { width: 55px; height: 55px; background: #cbd5e1; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; }
        @media (max-width: 650px) {
            .article-inner { padding: 20px 22px; }
            h1 { font-size: 1.6rem; }
        }
    </style>

    <div class="article-card">
        <div class="article-inner">
            <div class="category"><i class="fas fa-bolt"></i> ${sourceLabel}</div>
            <h1>${escapeHtml(aiData.seoTitle)}</h1>
            <div class="meta">
                <span><i class="far fa-calendar-alt"></i> ${currentDate}</span>
                <span><i class="far fa-user"></i> Tech Insights</span>
                <span><i class="far fa-clock"></i> ${readTime} min read</span>
            </div>

            <div class="featured-img">
                <img src="${escapeHtml(mainImage)}" alt="${escapeHtml(aiData.seoTitle)}">
                <div class="watermark"><i class="fas fa-copyright"></i> Tech Insights ${new Date().getFullYear()}</div>
            </div>

            <div class="article-content">
                ${aiData.htmlContent}
            </div>

            <div class="author-box">
                <div class="author-avatar"><i class="fas fa-chalkboard-user"></i></div>
                <div>
                    <h4 style="margin-bottom: 4px;">Tech Insights Team</h4>
                    <p style="font-size: 0.85rem; color: #475569;">Professional tech journalism & analysis</p>
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
                labels: [sourceLabel, ...(aiData.keywords || []).slice(0, 3)],
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

async function startEmpireBot() {
    console.log(`\n${'='.repeat(55)}`);
    console.log(`🚀 BOT STARTED at ${new Date().toLocaleString()}`);
    console.log(`${'='.repeat(55)}\n`);
    
    let totalPublished = 0;
    const enabledSources = SOURCES.filter(s => s.enabled);
    
    for (let i = 0; i < enabledSources.length; i++) {
        const source = enabledSources[i];
        console.log(`[${i+1}/${enabledSources.length}] 📰 ${source.label}: ${source.name}`);
        
        try {
            const feed = await parser.parseURL(source.url);
            const items = feed.items.slice(0, 2);
            let published = false;

            for (let item of items) {
                console.log(`   📄 "${item.title?.substring(0, 50)}..."`);
                
                const data = await getArticleData(item.link);
                if (!data) {
                    console.log(`   ⏭️ Could not fetch article\n`);
                    continue;
                }
                
                console.log(`   🤖 Generating content...`);
                const aiData = await generateSmartContent(data);
                if (!aiData) {
                    console.log(`   ⏭️ AI failed\n`);
                    continue;
                }

                const coverImg = data.images[0] || SAFE_IMAGES[Math.floor(Math.random() * SAFE_IMAGES.length)];
                const wordCount = aiData.htmlContent.replace(/<[^>]*>/g, '').split(/\s+/).length;
                const readTime = Math.max(4, Math.ceil(wordCount / 200));
                const currentDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

                const success = await publishToBlogger(aiData, coverImg, source.label, readTime, currentDate);
                
                if (success) {
                    totalPublished++;
                    published = true;
                    console.log(`   ✅ PUBLISHED: ${wordCount} words\n`);
                    break;
                }
            }

            if (!published) {
                console.log(`   ❌ No article published\n`);
            }
            
            if (published && i < enabledSources.length - 1) {
                console.log(`   ⏳ Waiting 30 seconds...\n`);
                await delay(30000);
            }

        } catch (err) {
            console.log(`   ❌ Error: ${err.message}\n`);
        }
    }
    
    console.log(`${'='.repeat(55)}`);
    console.log(`🏁 FINISHED: ${totalPublished} articles published`);
    console.log(`${'='.repeat(55)}`);
    process.exit(0);
}

startEmpireBot();
