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

const SOURCES = [
    { name: "Technology", url: "https://www.wired.com/feed/rss", label: "Tech", enabled: true },
    { name: "Business", url: "https://www.inc.com/rss", label: "Business", enabled: true },
    { name: "Marketing", url: "https://moz.com/feed", label: "Marketing", enabled: true },
    { name: "AI News", url: "https://www.theverge.com/rss/index.xml", label: "AI", enabled: true }
];

// قائمة بصور آمنة (Unsplash - مجانية للاستخدام التجاري)
const SAFE_IMAGES = [
    "https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&q=80",
    "https://images.unsplash.com/photo-1432888498266-38ffec3eaf0a?w=800&q=80",
    "https://images.unsplash.com/photo-1581291518633-83b4ebd1d83e?w=800&q=80",
    "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&q=80",
    "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=800&q=80",
    "https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?w=800&q=80",
    "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&q=80"
];

// دالة لاستخراج الصور الآمنة فقط (بدون إعلانات)
function extractSafeImages($, dom) {
    let images = [];
    const unsafeKeywords = ['ad', 'ads', 'advertisement', 'sponsor', 'logo', 'icon', 'avatar', 'banner', 'promo', 'googlead', 'doubleclick', 'amazon-ads', 'advert', 'pixel', 'tracking', 'facebook', 'twitter', 'instagram', 'youtube', 'analytics', 'pixel', 'cookies'];
    
    $('img').each((i, el) => {
        if (images.length >= 3) return false;
        
        let src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('srcset');
        if (src && src.startsWith('http')) {
            let cleanUrl = src.split(' ')[0];
            cleanUrl = cleanUrl.split('?')[0].toLowerCase();
            
            let isSafe = true;
            for (let keyword of unsafeKeywords) {
                if (cleanUrl.includes(keyword)) {
                    isSafe = false;
                    break;
                }
            }
            
            const validExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
            let hasValidExt = validExtensions.some(ext => cleanUrl.includes(ext));
            
            if (isSafe && hasValidExt && cleanUrl.length < 300 && !images.includes(cleanUrl)) {
                images.push(cleanUrl);
            }
        }
    });
    
    if (images.length === 0) {
        const ogImage = dom.window.document.querySelector('meta[property="og:image"]');
        if (ogImage && ogImage.content) {
            let ogUrl = ogImage.content.split('?')[0].toLowerCase();
            let isSafe = !unsafeKeywords.some(k => ogUrl.includes(k));
            if (isSafe) images.push(ogImage.content);
        }
    }
    
    return images.length > 0 ? images : [SAFE_IMAGES[Math.floor(Math.random() * SAFE_IMAGES.length)]];
}

function getRandomDelay() {
    return Math.floor(Math.random() * (60000 - 30000 + 1)) + 30000;
}

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function getArticleData(url) {
    try {
        const response = await axios.get(url, {
            timeout: 20000,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
        });

        const html = response.data;
        const dom = new JSDOM(html, { url });
        const reader = new Readability(dom.window.document);
        const article = reader.parse();
        
        if (!article || !article.textContent || article.textContent.length < 300) return null;

        const $ = cheerio.load(article.content);
        const safeImages = extractSafeImages($, dom);
        
        let cleanText = article.textContent
            .trim()
            .replace(/\s+/g, ' ')
            .replace(/ADVERTISEMENT/gi, '')
            .replace(/Sponsor/gi, '')
            .replace(/Ad\s/gi, '')
            .slice(0, 3500);

        return { 
            title: article.title || "Untitled",
            text: cleanText, 
            images: safeImages,
            link: url 
        };
    } catch (e) { 
        console.log(`❌ Error: ${e.message}`);
        return null; 
    }
}

async function generateSmartContent(article, retryCount = 0) {
    const prompt = `You are an Elite SEO Expert. Create a COMPREHENSIVE, DETAILED article (1800-2500 words).

TOPIC: ${article.title}

REFERENCE: ${article.text}

REQUIREMENTS:
1. Article MUST be 1800-2500 words minimum
2. Start with "Key Takeaways" box (4-5 bullet points)
3. Use <h2> for main sections, <h3> for subsections
4. Include 3 "Pro Tip" boxes throughout
5. End with "Frequently Asked Questions" (4 Q&As)
6. Use short paragraphs (2-3 sentences)
7. Add bold text for important keywords
8. Write in professional, engaging English

OUTPUT (JSON only):
{
    "seoTitle": "SEO title 50-60 chars",
    "metaDescription": "Meta description 150-160 chars",
    "keywords": ["kw1","kw2","kw3","kw4","kw5"],
    "htmlContent": "Full HTML content without h1, html, head, body"
}`;

    try {
        const completion = await groq.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model: "llama-3.3-70b-versatile",
            temperature: 0.7,
            max_tokens: 8000,
            response_format: { type: "json_object" }
        });
        
        const result = JSON.parse(completion.choices[0].message.content);
        
        if (!result.seoTitle || !result.htmlContent || result.htmlContent.length < 2000) {
            throw new Error("Content too short");
        }
        
        return result;
    } catch (e) { 
        if (retryCount < 2) {
            console.log(`⚠️ Retry ${retryCount + 1}...`);
            await delay(5000);
            return generateSmartContent(article, retryCount + 1);
        }
        return null; 
    }
}

async function publishToBlogger(aiData, mainImage, sourceLabel, readTime, currentDate) {
    try {
        // إنشاء HTML مع علامة مائية باستخدام CSS فقط
        const htmlBody = `
<div class="main-wrapper" dir="ltr">
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        @import url('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css');
        
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Inter', sans-serif; background: #f0f4f8; padding: 20px; }
        .main-wrapper { max-width: 880px; margin: 0 auto; background: white; border-radius: 28px; overflow: hidden; box-shadow: 0 20px 40px -15px rgba(0,0,0,0.15); }
        .article-padding { padding: 35px 45px 50px; }
        
        /* Header */
        .article-category { display: inline-block; background: #eef2ff; color: #2563eb; font-size: 0.8rem; font-weight: 700; padding: 5px 14px; border-radius: 30px; margin-bottom: 18px; letter-spacing: 0.5px; }
        h1 { font-size: 2.3rem; font-weight: 800; line-height: 1.3; margin-bottom: 18px; color: #0a0f2c; }
        .article-meta { display: flex; gap: 22px; font-size: 0.9rem; color: #5a6e85; margin: 15px 0 25px; padding-bottom: 20px; border-bottom: 2px solid #eef2f8; }
        .article-meta i { margin-right: 6px; color: #3b82f6; }
        
        /* Featured Image with Watermark */
        .featured-image { position: relative; margin: 25px 0 35px; border-radius: 24px; overflow: hidden; }
        .featured-image img { width: 100%; display: block; border-radius: 24px; }
        .watermark { position: absolute; bottom: 15px; right: 15px; background: rgba(0,0,0,0.6); color: white; padding: 6px 14px; border-radius: 10px; font-size: 12px; font-family: monospace; backdrop-filter: blur(5px); z-index: 2; }
        .watermark i { margin-right: 5px; }
        .watermark-diagonal { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-25deg); opacity: 0.2; font-size: 14px; color: white; background: rgba(0,0,0,0.3); padding: 8px 20px; border-radius: 40px; white-space: nowrap; font-family: monospace; letter-spacing: 2px; pointer-events: none; }
        
        /* Content */
        .article-content h2 { font-size: 1.8rem; font-weight: 700; margin: 45px 0 18px 0; padding-left: 14px; border-left: 5px solid #3b82f6; color: #0a0f2c; }
        .article-content h3 { font-size: 1.4rem; font-weight: 600; margin: 30px 0 12px 0; color: #1f2a48; }
        .article-content p { margin-bottom: 1.2rem; font-size: 1.05rem; line-height: 1.7; color: #2d3a4a; }
        .article-content ul, .article-content ol { margin: 18px 0 22px 35px; }
        .article-content li { margin-bottom: 8px; }
        
        /* Key Takeaways */
        .key-takeaways { background: linear-gradient(135deg, #fef7e0, #fff4e5); border-right: 4px solid #f59e0b; padding: 22px 28px; border-radius: 20px; margin: 20px 0 35px; }
        .key-takeaways h3 { color: #b45309; margin-bottom: 15px; font-size: 1.3rem; display: flex; align-items: center; gap: 10px; }
        .key-takeaways ul { margin: 0 0 0 20px; }
        
        /* Tip Box */
        .tip-box { background: #f0f9ff; border-right: 4px solid #0ea5e9; padding: 20px 25px; border-radius: 18px; margin: 30px 0; }
        .tip-box strong { color: #0284c7; display: flex; align-items: center; gap: 10px; font-size: 1.15rem; margin-bottom: 10px; }
        .tip-box p { margin: 0 !important; }
        
        /* FAQ */
        .faq-section { background: #f8fafc; border-radius: 24px; padding: 28px; margin: 45px 0 25px; }
        .faq-section h2 { margin-top: 0 !important; border-left: none !important; padding-left: 0 !important; }
        .faq-item { margin-bottom: 22px; padding-bottom: 18px; border-bottom: 1px solid #e2e8f0; }
        .faq-item:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
        .faq-item strong { color: #1e293b; font-size: 1rem; display: block; margin-bottom: 8px; }
        
        /* Content Images with Watermark */
        .content-img { position: relative; margin: 35px 0; text-align: center; }
        .content-img img { max-width: 100%; border-radius: 20px; box-shadow: 0 10px 25px -10px rgba(0,0,0,0.15); }
        .content-img .watermark { bottom: 10px; right: 10px; font-size: 10px; padding: 4px 10px; }
        .caption { font-size: 0.8rem; color: #6b7a8a; margin-top: 10px; }
        
        /* Author */
        .author-box { background: #f1f5f9; border-radius: 24px; padding: 25px; margin: 50px 0 20px; display: flex; gap: 22px; align-items: center; }
        .author-avatar { width: 65px; height: 65px; background: #cbd5e1; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.8rem; color: #334155; }
        .author-info h4 { font-size: 1.2rem; font-weight: 700; margin-bottom: 5px; }
        .author-info p { font-size: 0.9rem; color: #475569; margin: 0; }
        
        @media (max-width: 650px) {
            .article-padding { padding: 20px 22px 35px; }
            h1 { font-size: 1.8rem; }
            .article-content h2 { font-size: 1.5rem; }
            .watermark-diagonal { font-size: 8px; white-space: nowrap; }
        }
    </style>

    <div class="article-padding">
        <div class="article-category"><i class="fas fa-bolt"></i> ${sourceLabel}</div>
        <h1>${escapeHtml(aiData.seoTitle)}</h1>
        <div class="article-meta">
            <span><i class="far fa-calendar-alt"></i> ${currentDate}</span>
            <span><i class="far fa-user"></i> Tech Insights</span>
            <span><i class="far fa-clock"></i> ${readTime} min read</span>
        </div>

        <div class="featured-image">
            <img src="${escapeHtml(mainImage)}" alt="${escapeHtml(aiData.seoTitle)}">
            <div class="watermark"><i class="fas fa-copyright"></i> Tech Insights ${new Date().getFullYear()}</div>
            <div class="watermark-diagonal">🔒 TECH INSIGHTS PRO 🔒</div>
        </div>

        <div class="article-content">
            ${aiData.htmlContent}
        </div>

        <div class="author-box">
            <div class="author-avatar"><i class="fas fa-chalkboard-user"></i></div>
            <div class="author-info">
                <h4>Tech Insights Editorial Team</h4>
                <p>Professional tech journalism since 2018. We deliver in-depth analysis and actionable insights.</p>
            </div>
        </div>
    </div>
</div>`;

        const dynamicLabels = [...new Set([sourceLabel, ...(aiData.keywords || [])])].slice(0, 5);

        const auth = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET);
        auth.setCredentials({ refresh_token: REFRESH_TOKEN });
        const blogger = google.blogger({ version: 'v3', auth });

        await blogger.posts.insert({
            blogId: BLOG_ID,
            requestBody: {
                title: aiData.seoTitle,
                content: htmlBody,
                labels: dynamicLabels,
                customMetaData: aiData.metaDescription.substring(0, 150)
            }
        });

        return true;
    } catch (e) {
        console.log(`❌ Publish error: ${e.message}`);
        return false;
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// الدالة الرئيسية
async function startEmpireBot() {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🚀 BOT STARTED at ${new Date().toLocaleString()}`);
    console.log(`${'='.repeat(60)}\n`);
    
    let totalPublished = 0;
    let totalAttempts = 0;
    const enabledSources = SOURCES.filter(s => s.enabled);
    
    console.log(`📡 Active sources: ${enabledSources.length}\n`);
    
    for (let i = 0; i < enabledSources.length; i++) {
        const source = enabledSources[i];
        console.log(`[${i+1}/${enabledSources.length}] 📰 Processing: ${source.label}`);
        
        try {
            const feed = await parser.parseURL(source.url);
            if (!feed.items || feed.items.length === 0) {
                console.log(`   ⚠️ No items found\n`);
                continue;
            }
            
            const items = feed.items.slice(0, 2);
            let published = false;

            for (let j = 0; j < items.length; j++) {
                totalAttempts++;
                const item = items[j];
                console.log(`   🔍 [${j+1}/${items.length}] ${item.title?.substring(0, 45)}...`);
                
                const data = await getArticleData(item.link);
                if (!data || data.text.length < 300) {
                    console.log(`   ⏭️ Skipped: insufficient content\n`);
                    continue;
                }
                
                console.log(`   ✍️ Generating article (this takes ~45 sec)...`);
                const aiData = await generateSmartContent(data);
                if (!aiData || !aiData.htmlContent || aiData.htmlContent.length < 1500) {
                    console.log(`   ⏭️ Skipped: AI generation failed\n`);
                    continue;
                }

                const coverImg = data.images && data.images.length > 0 
                    ? data.images[0] 
                    : SAFE_IMAGES[Math.floor(Math.random() * SAFE_IMAGES.length)];
                
                const wordCount = aiData.htmlContent.replace(/<[^>]*>/g, '').split(/\s+/).length;
                const readTime = Math.max(6, Math.ceil(wordCount / 210));
                const currentDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

                const success = await publishToBlogger(aiData, coverImg, source.label, readTime, currentDate);
                
                if (success) {
                    totalPublished++;
                    published = true;
                    console.log(`   ✅ PUBLISHED: "${aiData.seoTitle.substring(0, 50)}..."`);
                    console.log(`   📊 Stats: ${wordCount} words | ${readTime} min read\n`);
                    break;
                }
            }

            if (published && i < enabledSources.length - 1) {
                const waitTime = getRandomDelay();
                console.log(`   ⏳ Waiting ${Math.round(waitTime/1000)} seconds before next source...\n`);
                await delay(waitTime);
            } else if (!published) {
                console.log(`   ❌ No article published from this source\n`);
            }

        } catch (err) {
            console.log(`   ❌ Error: ${err.message}\n`);
        }
    }
    
    console.log(`${'='.repeat(60)}`);
    console.log(`🏁 BOT FINISHED at ${new Date().toLocaleString()}`);
    console.log(`📊 SUMMARY: ${totalPublished} articles published from ${totalAttempts} attempts`);
    console.log(`${'='.repeat(60)}`);
    
    process.exit(0);
}

startEmpireBot();
