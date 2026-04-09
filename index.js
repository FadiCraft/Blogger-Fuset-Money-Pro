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

// مصادر RSS موثوقة
const RELIABLE_SOURCES = [
    { name: "IGN Games", url: "https://feeds.feedburner.com/ign/articles", category: "Video Game Reviews" },
    { name: "GameSpot", url: "https://www.gamespot.com/feeds/news", category: "Video Game Reviews" },
    { name: "Polygon", url: "https://www.polygon.com/rss/index.xml", category: "Video Game Reviews" },
    { name: "Kotaku", url: "https://kotaku.com/rss", category: "Gaming News & Updates" },
    { name: "PC Gamer", url: "https://www.pcgamer.com/rss", category: "Gaming News & Updates" },
    { name: "TechRadar", url: "https://www.techradar.com/rss", category: "Tech Reviews" },
    { name: "CNET", url: "https://www.cnet.com/rss/news", category: "Tech Reviews" },
    { name: "The Verge", url: "https://www.theverge.com/rss/index.xml", category: "Tech Reviews" },
    { name: "TechCrunch", url: "https://techcrunch.com/feed/", category: "Software & Tools" },
    { name: "Entrepreneur", url: "https://www.entrepreneur.com/feed", category: "Online Earning" }
];

// الفئات المستهدفة (مقال واحد من كل فئة)
const TARGET_CATEGORIES = [
    { name: "Video Game Reviews", cpc: "$2.50-$5.00" },
    { name: "Gaming News & Updates", cpc: "$2.00-$4.00" },
    { name: "Tech Reviews", cpc: "$3.00-$6.00" },
    { name: "Software & Tools", cpc: "$2.50-$5.50" },
    { name: "Online Earning", cpc: "$3.50-$7.00" }
];

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// استخراج الصور الديناميكية من المقال
async function extractDynamicImages($, url) {
    const images = [];
    const seenUrls = new Set();
    
    // الكلمات الدالة على صور غير مرغوب فيها
    const excludePatterns = [
        'logo', 'icon', 'avatar', 'banner', 'ad', 'sponsor', 
        'facebook', 'twitter', 'instagram', 'youtube', 'google',
        'data:image', 'svg', '1x1', 'pixel', 'tracking'
    ];
    
    // البحث عن جميع الصور
    $('img').each((i, img) => {
        if (images.length >= 4) return false;
        
        let src = $(img).attr('src') || $(img).attr('data-src') || $(img).attr('data-original');
        let alt = $(img).attr('alt') || '';
        let title = $(img).attr('title') || '';
        
        if (src && src.startsWith('http') && !excludePatterns.some(p => src.toLowerCase().includes(p))) {
            // تنظيف URL الصورة
            let cleanUrl = src.split('?')[0].split('#')[0];
            
            // التحقق من امتداد الصورة
            if (cleanUrl.match(/\.(jpg|jpeg|png|webp|gif)$/i) && !seenUrls.has(cleanUrl)) {
                seenUrls.add(cleanUrl);
                images.push({
                    url: cleanUrl,
                    alt: alt.substring(0, 100) || title.substring(0, 100) || 'Image',
                    width: $(img).attr('width') || '800',
                    height: $(img).attr('height') || '450'
                });
            }
        }
    });
    
    // إذا لم نجد صور، نستخدم صور Unsplash حسب الموضوع
    if (images.length === 0) {
        const topic = $('title').text().toLowerCase();
        const unsplashTopics = {
            'game': 'gaming',
            'tech': 'technology', 
            'software': 'code',
            'money': 'finance'
        };
        let unsplashTopic = 'technology';
        for (const [key, value] of Object.entries(unsplashTopics)) {
            if (topic.includes(key)) unsplashTopic = value;
        }
        images.push({
            url: `https://source.unsplash.com/featured/800x450?${unsplashTopic}`,
            alt: 'Featured image',
            width: '800',
            height: '450'
        });
    }
    
    return images;
}

// استخراج الكلمات المفتاحية الديناميكية من المحتوى
async function extractDynamicKeywords(title, content, category) {
    const prompt = `Analyze this content and generate 10 SEO-optimized keywords/phrases:

Title: "${title}"
Category: ${category}
Content preview: ${content.substring(0, 1000)}

Requirements:
- Mix of short-tail (1-2 words) and long-tail (3-5 words) keywords
- Include question-based keywords
- Include LSI (Latent Semantic Indexing) keywords
- Focus on search intent (informational/commercial)

Return ONLY a JSON array of 10 keywords:
["keyword 1", "keyword 2", ...]`;

    try {
        const completion = await groq.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model: "llama-3.3-70b-versatile",
            temperature: 0.6,
            max_tokens: 500,
            response_format: { type: "json_object" }
        });
        
        const result = JSON.parse(completion.choices[0].message.content);
        const keywords = Array.isArray(result) ? result : (result.keywords || result);
        return Array.isArray(keywords) ? keywords.slice(0, 10) : [];
    } catch (e) {
        console.log(`   ⚠️ Keyword extraction failed: ${e.message}`);
        // كلمات افتراضية حسب الفئة
        const defaultKeywords = {
            "Video Game Reviews": ["game review", "gameplay", "graphics", "story", "multiplayer", "single player", "game analysis", "review 2026", "is it worth it", "gaming"],
            "Gaming News & Updates": ["gaming news", "update patch", "new release", "game developer", "industry news", "esports", "gaming community", "latest games", "upcoming games", "gaming industry"],
            "Tech Reviews": ["tech review", "specifications", "performance", "price", "value", "comparison", "benchmark", "buying guide", "best tech", "gadget review"],
            "Software & Tools": ["software review", "tool comparison", "features", "pricing", "alternatives", "productivity", "best software", "tool guide", "app review", "software tools"],
            "Online Earning": ["make money", "passive income", "side hustle", "work from home", "online business", "freelancing", "earn online", "money tips", "income guide", "financial freedom"]
        };
        return defaultKeywords[category] || defaultKeywords["Tech Reviews"];
    }
}

// استخراج بيانات المقال بشكل ديناميكي
async function fetchArticleContent(url) {
    try {
        const response = await axios.get(url, {
            timeout: 15000,
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml',
                'Accept-Language': 'en-US,en;q=0.9'
            }
        });

        const dom = new JSDOM(response.data, { url });
        const reader = new Readability(dom.window.document);
        const article = reader.parse();
        
        if (!article || !article.textContent || article.textContent.length < 500) return null;

        const $ = cheerio.load(article.content);
        
        // استخراج الصور الديناميكية
        const dynamicImages = await extractDynamicImages($, url);
        
        // تنظيف النص
        const cleanText = article.textContent
            .trim()
            .replace(/\s+/g, ' ')
            .replace(/[^\x00-\x7F]/g, '') // إزالة الرموز غير ASCII
            .slice(0, 5000);
        
        // استخراج الكلمات المفتاحية الديناميكية
        const dynamicKeywords = await extractDynamicKeywords(article.title, cleanText, "general");
        
        return { 
            title: article.title || "Untitled",
            text: cleanText, 
            images: dynamicImages,
            link: url,
            keywords: dynamicKeywords,
            excerpt: article.excerpt || cleanText.substring(0, 200)
        };
    } catch (e) { 
        console.log(`   ❌ Fetch error: ${e.message}`);
        return null; 
    }
}

// توليد محتوى SEO قوي جداً
async function generateSEORichContent(article, category) {
    const prompt = `You are an expert SEO content writer. Create a comprehensive, high-quality blog article.

ARTICLE TITLE: "${article.title}"
CATEGORY: ${category}
SOURCE EXCERPT: ${article.excerpt}
KEYWORDS TO TARGET: ${article.keywords.join(', ')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

REQUIREMENTS (STRICT):

1. ARTICLE LENGTH: 1800-2500 words
2. SEO TITLE: Under 60 chars, include primary keyword at beginning
3. META DESCRIPTION: 150-160 chars, compelling with keyword
4. URL SLUG: SEO-friendly, lowercase, hyphens
5. HEADING STRUCTURE:
   - H1: Only article title
   - H2: Main sections (5-7 sections)
   - H3: Sub-sections under each H2
   - H4: Minor points if needed

6. CONTENT ELEMENTS TO INCLUDE:
   - Strong introduction with hook (50-80 words)
   - Table of contents (internal navigation)
   - Main body with detailed analysis
   - Real examples or case studies
   - Statistics or data points
   - Pros and Cons section (use checkmarks ❌✅)
   - Comparison table if applicable
   - "People Also Ask" section (3-4 questions)
   - FAQ section (5 questions with detailed answers)
   - Strong conclusion with CTA

7. FORMATTING:
   - Short paragraphs (2-3 sentences max)
   - Use bullet points and numbered lists
   - Bold important phrases
   - Include internal links structure (use "/" as placeholder)
   - Use schema-friendly markup

8. READABILITY:
   - Flesch score > 60
   - Active voice
   - Transition words
   - Avoid fluff and filler words

9. LSI KEYWORDS: Naturally integrate related terms

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

OUTPUT FORMAT (VALID JSON ONLY):
{
    "seoTitle": "Primary Keyword | Secondary | Brand",
    "metaDescription": "Compelling description with keyword naturally included...",
    "urlSlug": "keyword-rich-url-slug",
    "htmlContent": "<div>Full HTML content with proper heading hierarchy, lists, tables, and sections</div>",
    "wordCount": number,
    "readabilityScore": number
}

Make it EPIC, VALUABLE, and SHAREABLE.`;

    try {
        const completion = await groq.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model: "llama-3.3-70b-versatile",
            temperature: 0.7,
            max_tokens: 6000,
            response_format: { type: "json_object" }
        });
        
        const result = JSON.parse(completion.choices[0].message.content);
        
        if (result.htmlContent && result.htmlContent.length > 1000) {
            result.htmlContent = enhanceHTMLFormatting(result.htmlContent);
            return result;
        }
        throw new Error("Content too short");
    } catch (e) { 
        console.log(`   ❌ AI error: ${e.message}`);
        return null; 
    }
}

// تحسين تنسيق HTML للمقال
function enhanceHTMLFormatting(html) {
    let enhanced = html;
    
    // إضافة كلاسات CSS للجداول
    enhanced = enhanced.replace(/<table>/g, '<table class="comparison-table">');
    enhanced = enhanced.replace(/<th>/g, '<th class="table-header">');
    
    // تحسين صناديق النصائح
    enhanced = enhanced.replace(/<div class="tip">/g, '<div class="pro-tip">');
    enhanced = enhanced.replace(/<div class="warning">/g, '<div class="warning-box">');
    
    // إضافة أيقونات للقوائم
    enhanced = enhanced.replace(/<ul>/g, '<ul class="checklist">');
    
    return enhanced;
}

// قالب HTML عصري ومقبول من AdSense
function getModernHTMLTemplate(content, metadata, images, category, readTime) {
    const currentDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const mainImage = images[0] || { url: 'https://source.unsplash.com/featured/800x450?technology', alt: 'Featured image' };
    
    // بناء معرض الصور
    const galleryHTML = images.slice(1, 4).map(img => `
        <div class="gallery-item">
            <img src="${escapeHtml(img.url)}" alt="${escapeHtml(img.alt)}" loading="lazy">
        </div>
    `).join('');
    
    return `
<div dir="ltr">
    <style>
        /* Modern CSS - AdSense Friendly */
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #f5f7fa 0%, #eef2f7 100%);
            padding: 30px 20px;
            line-height: 1.6;
        }
        
        .article-wrapper {
            max-width: 1100px;
            margin: 0 auto;
        }
        
        /* Main Card */
        .article-card {
            background: white;
            border-radius: 32px;
            overflow: hidden;
            box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
            transition: transform 0.3s ease;
        }
        
        .article-content {
            padding: 48px 56px;
        }
        
        /* Category Badge */
        .category-badge {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            font-size: 0.75rem;
            font-weight: 700;
            padding: 6px 16px;
            border-radius: 40px;
            margin-bottom: 24px;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        
        /* Typography */
        h1 {
            font-size: 2.8rem;
            font-weight: 800;
            line-height: 1.2;
            margin-bottom: 20px;
            color: #0f172a;
            letter-spacing: -0.02em;
        }
        
        h2 {
            font-size: 1.8rem;
            font-weight: 700;
            margin: 48px 0 20px 0;
            padding-left: 16px;
            border-left: 5px solid #667eea;
            color: #0f172a;
        }
        
        h3 {
            font-size: 1.4rem;
            font-weight: 600;
            margin: 32px 0 16px 0;
            color: #1e293b;
        }
        
        h4 {
            font-size: 1.1rem;
            font-weight: 600;
            margin: 24px 0 12px 0;
            color: #334155;
        }
        
        p {
            margin-bottom: 1.2rem;
            color: #334155;
            line-height: 1.7;
        }
        
        /* Meta Info */
        .meta-info {
            display: flex;
            flex-wrap: wrap;
            gap: 24px;
            margin: 20px 0 32px;
            padding-bottom: 24px;
            border-bottom: 2px solid #e2e8f0;
            color: #64748b;
            font-size: 0.85rem;
        }
        
        .meta-info span {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        /* Featured Image */
        .featured-image {
            margin: 32px 0 40px;
            border-radius: 24px;
            overflow: hidden;
            box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1);
        }
        
        .featured-image img {
            width: 100%;
            height: auto;
            display: block;
        }
        
        .image-caption {
            text-align: center;
            font-size: 0.8rem;
            color: #64748b;
            margin-top: 8px;
        }
        
        /* Image Gallery */
        .image-gallery {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin: 40px 0;
        }
        
        .gallery-item {
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        
        .gallery-item img {
            width: 100%;
            height: 200px;
            object-fit: cover;
            transition: transform 0.3s;
        }
        
        .gallery-item img:hover {
            transform: scale(1.05);
        }
        
        /* Lists */
        ul, ol {
            margin: 1.2rem 0 1.2rem 1.8rem;
            color: #334155;
        }
        
        li {
            margin-bottom: 0.6rem;
            line-height: 1.6;
        }
        
        .checklist li {
            list-style-type: '✓ ';
            padding-left: 0.5rem;
        }
        
        /* Pros & Cons */
        .pros-cons-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 24px;
            margin: 32px 0;
        }
        
        .pros-box {
            background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%);
            padding: 24px;
            border-radius: 20px;
        }
        
        .cons-box {
            background: linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%);
            padding: 24px;
            border-radius: 20px;
        }
        
        .pros-box h3, .cons-box h3 {
            margin-top: 0;
            margin-bottom: 16px;
        }
        
        /* Comparison Table */
        .comparison-table {
            width: 100%;
            border-collapse: collapse;
            margin: 32px 0;
            background: white;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 2px 8px rgba(0,0,0,0.08);
        }
        
        .comparison-table th {
            background: #1e293b;
            color: white;
            padding: 14px;
            font-weight: 700;
            text-align: left;
        }
        
        .comparison-table td {
            padding: 12px 14px;
            border-bottom: 1px solid #e2e8f0;
        }
        
        .comparison-table tr:last-child td {
            border-bottom: none;
        }
        
        /* Tip & Warning Boxes */
        .pro-tip {
            background: linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%);
            border-left: 5px solid #0284c7;
            padding: 20px 24px;
            border-radius: 16px;
            margin: 28px 0;
        }
        
        .warning-box {
            background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
            border-left: 5px solid #f59e0b;
            padding: 20px 24px;
            border-radius: 16px;
            margin: 28px 0;
        }
        
        .pro-tip strong, .warning-box strong {
            display: flex;
            align-items: center;
            gap: 10px;
            font-size: 1.1rem;
            margin-bottom: 12px;
        }
        
        /* FAQ Section */
        .faq-section {
            background: #f8fafc;
            border-radius: 24px;
            padding: 32px;
            margin: 48px 0;
        }
        
        .faq-section h2 {
            margin-top: 0;
            border-left-color: #94a3b8;
        }
        
        .faq-item {
            margin-bottom: 24px;
            padding-bottom: 16px;
            border-bottom: 1px solid #e2e8f0;
        }
        
        .faq-question {
            font-weight: 700;
            font-size: 1.1rem;
            color: #0f172a;
            margin-bottom: 10px;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .faq-answer {
            color: #475569;
            line-height: 1.6;
        }
        
        /* Table of Contents */
        .toc {
            background: #f1f5f9;
            border-radius: 20px;
            padding: 24px;
            margin: 32px 0;
        }
        
        .toc h3 {
            margin-top: 0;
            margin-bottom: 16px;
        }
        
        .toc ul {
            margin: 0;
            list-style: none;
        }
        
        .toc li {
            margin-bottom: 10px;
        }
        
        .toc a {
            color: #3b82f6;
            text-decoration: none;
        }
        
        .toc a:hover {
            text-decoration: underline;
        }
        
        /* Author Box */
        .author-box {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 24px;
            padding: 28px;
            margin: 48px 0 24px;
            display: flex;
            gap: 24px;
            align-items: center;
            color: white;
        }
        
        .author-avatar {
            width: 70px;
            height: 70px;
            background: rgba(255,255,255,0.2);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 2rem;
        }
        
        /* Share Buttons */
        .share-buttons {
            display: flex;
            gap: 12px;
            margin: 32px 0;
            justify-content: center;
        }
        
        .share-btn {
            padding: 10px 20px;
            border-radius: 40px;
            color: white;
            text-decoration: none;
            font-size: 0.85rem;
            transition: opacity 0.3s;
        }
        
        .share-btn:hover {
            opacity: 0.8;
        }
        
        /* Responsive */
        @media (max-width: 768px) {
            .article-content {
                padding: 28px 24px;
            }
            
            h1 {
                font-size: 1.8rem;
            }
            
            h2 {
                font-size: 1.4rem;
            }
            
            .pros-cons-grid {
                grid-template-columns: 1fr;
            }
            
            .image-gallery {
                grid-template-columns: 1fr;
            }
            
            .meta-info {
                gap: 12px;
            }
        }
        
        /* AdSense Ready */
        ins.adsbygoogle {
            margin: 24px 0;
            display: block;
        }
    </style>
    
    <div class="article-wrapper">
        <div class="article-card">
            <div class="article-content">
                <div class="category-badge">
                    🎮 ${escapeHtml(category)}
                </div>
                
                <h1>${escapeHtml(content.seoTitle || metadata.seoTitle)}</h1>
                
                <div class="meta-info">
                    <span>📅 ${currentDate}</span>
                    <span>👤 GamingHub Pro</span>
                    <span>⏱️ ${readTime} min read</span>
                    <span>🏷️ ${escapeHtml(category)}</span>
                </div>
                
                <div class="featured-image">
                    <img src="${escapeHtml(mainImage.url)}" alt="${escapeHtml(mainImage.alt)}" loading="eager">
                    <div class="image-caption">${escapeHtml(mainImage.alt)}</div>
                </div>
                
                ${galleryHTML ? `<div class="image-gallery">${galleryHTML}</div>` : ''}
                
                <div class="article-body">
                    ${content.htmlContent}
                </div>
                
                <div class="share-buttons">
                    <a href="#" class="share-btn" style="background: #1877f2;">📘 Share</a>
                    <a href="#" class="share-btn" style="background: #1da1f2;">🐦 Tweet</a>
                    <a href="#" class="share-btn" style="background: #0a66c2;">💼 LinkedIn</a>
                </div>
                
                <div class="author-box">
                    <div class="author-avatar">🎮</div>
                    <div>
                        <h3 style="color: white; margin-bottom: 8px;">GamingHub Expert Team</h3>
                        <p style="color: rgba(255,255,255,0.9); font-size: 0.9rem;">Professional gaming and tech reviews since 2024. We provide honest, in-depth analysis to help you make informed decisions.</p>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>`;
}

async function getArticleFromRSS(source) {
    try {
        console.log(`   📡 Fetching from ${source.name}...`);
        const feed = await parser.parseURL(source.url);
        
        for (let item of feed.items.slice(0, 3)) {
            if (!item.link || !item.title) continue;
            
            console.log(`   📄 Trying: ${item.title.substring(0, 50)}...`);
            const articleData = await fetchArticleContent(item.link);
            
            if (articleData && articleData.text.length > 800) {
                articleData.category = source.category;
                articleData.sourceName = source.name;
                return articleData;
            }
            await delay(2000);
        }
        return null;
    } catch (error) {
        console.log(`   ⚠️ ${source.name}: ${error.message}`);
        return null;
    }
}

async function publishToBlogger(content, metadata, images, category, readTime) {
    try {
        const htmlBody = getModernHTMLTemplate(content, metadata, images, category, readTime);
        
        const auth = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET);
        auth.setCredentials({ refresh_token: REFRESH_TOKEN });
        const blogger = google.blogger({ version: 'v3', auth });
        
        // إنشاء Slug SEO-friendly
        const slug = metadata.urlSlug || metadata.seoTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        
        await blogger.posts.insert({
            blogId: BLOG_ID,
            requestBody: {
                title: metadata.seoTitle,
                content: htmlBody,
                labels: [category, ...(metadata.keywords || []).slice(0, 5)],
                customMetaData: metadata.metaDescription
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

async function startBot() {
    console.log(`\n${'='.repeat(65)}`);
    console.log(`🎮 PROFESSIONAL SEO BOT - 5 HIGH-VALUE ARTICLES`);
    console.log(`📅 ${new Date().toLocaleString()}`);
    console.log(`🎯 Target: One article from each category`);
    console.log(`${'='.repeat(65)}\n`);
    
    let published = 0;
    const results = {};
    
    for (const category of TARGET_CATEGORIES) {
        console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`🎯 CATEGORY ${published + 1}/5: ${category.name}`);
        console.log(`💰 Estimated CPC: ${category.cpc}`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
        
        const sourcesForCategory = RELIABLE_SOURCES.filter(s => s.category === category.name);
        let articlePublished = false;
        
        for (const source of sourcesForCategory) {
            if (articlePublished) break;
            
            console.log(`   📰 Source: ${source.name}`);
            const article = await getArticleFromRSS(source);
            
            if (article && article.text.length > 500) {
                console.log(`\n   ✅ FOUND: ${article.title.substring(0, 70)}...`);
                console.log(`   🖼️ Images found: ${article.images.length}`);
                console.log(`   🔑 Keywords generated: ${article.keywords.length}`);
                console.log(`   📝 Generating SEO-optimized content...`);
                
                const seoContent = await generateSEORichContent(article, category.name);
                
                if (seoContent) {
                    const wordCount = seoContent.wordCount || seoContent.htmlContent.replace(/<[^>]*>/g, '').split(/\s+/).length;
                    const readTime = Math.max(6, Math.ceil(wordCount / 180));
                    
                    console.log(`   📊 Content stats:`);
                    console.log(`      - Length: ${wordCount} words`);
                    console.log(`      - Read time: ${readTime} min`);
                    console.log(`      - SEO Title: ${seoContent.seoTitle.substring(0, 50)}...`);
                    
                    console.log(`   📤 Publishing to Blogger...`);
                    const success = await publishToBlogger(seoContent, {
                        seoTitle: seoContent.seoTitle,
                        metaDescription: seoContent.metaDescription,
                        urlSlug: seoContent.urlSlug,
                        keywords: article.keywords
                    }, article.images, category.name, readTime);
                    
                    if (success) {
                        published++;
                        results[category.name] = { status: "✅ PUBLISHED", words: wordCount };
                        articlePublished = true;
                        console.log(`\n   🎉 SUCCESS! Article ${published}/5 published!\n`);
                        await delay(45000);
                    } else {
                        results[category.name] = { status: "❌ PUBLISH FAILED", words: 0 };
                    }
                } else {
                    results[category.name] = { status: "❌ AI GENERATION FAILED", words: 0 };
                }
            } else {
                console.log(`   ⚠️ No valid article from ${source.name}`);
            }
            
            await delay(3000);
        }
        
        if (!articlePublished && !results[category.name]) {
            results[category.name] = { status: "❌ NO SOURCE", words: 0 };
            console.log(`   ❌ Could not find source for ${category.name}\n`);
        }
    }
    
    // النتائج النهائية
    console.log(`\n${'='.repeat(65)}`);
    console.log(`📊 FINAL REPORT - ${published}/5 ARTICLES PUBLISHED`);
    console.log(`${'='.repeat(65)}`);
    
    for (const [category, data] of Object.entries(results)) {
        const emoji = data.status.includes('✅') ? '🎮' : '❌';
        console.log(`   ${emoji} ${category}: ${data.status} ${data.words ? `(${data.words} words)` : ''}`);
    }
    
    console.log(`\n${'='.repeat(65)}`);
    console.log(`✨ BOT COMPLETED - ${new Date().toLocaleString()}`);
    console.log(`${'='.repeat(65)}\n`);
    
    process.exit(0);
}

startBot();
