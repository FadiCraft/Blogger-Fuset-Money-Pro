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
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
});

const SOURCES = [
    { name: "Technology", url: "https://www.wired.com/feed/rss", label: "Tech" },
    { name: "Business", url: "https://www.inc.com/rss", label: "Business" },
    { name: "Marketing", url: "https://moz.com/feed", label: "Marketing" },
    { name: "AI News", url: "https://www.theverge.com/rss/index.xml", label: "AI" }
];

// قائمة بصور آمنة وخالية من حقوق الطبع والنشر (Unsplash Source)
const SAFE_IMAGES = [
    "https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&q=80",
    "https://images.unsplash.com/photo-1432888498266-38ffec3eaf0a?w=800&q=80",
    "https://images.unsplash.com/photo-1581291518633-83b4ebd1d83e?w=800&q=80",
    "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&q=80",
    "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=800&q=80",
    "https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?w=800&q=80",
    "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&q=80",
    "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=800&q=80"
];

// دالة لإضافة علامة مائية نصية على الصورة (باستخدام SVG)
function addWatermarkToImage(imageUrl, title) {
    // نستخدم Unsplash مباشرة لأنها آمنة قانونياً، ونضيف نص تحتها
    // إذا كانت الصورة من Unsplash نضيف معامل attribution
    if (imageUrl.includes('unsplash.com')) {
        return imageUrl + '&auto=format&fit=crop';
    }
    // للصور الأخرى، نستخدم صورة آمنة بديلة
    return SAFE_IMAGES[Math.floor(Math.random() * SAFE_IMAGES.length)];
}

// دالة لاستخراج الصور الآمنة فقط (نرفض صور الإعلانات والشعارات)
function extractSafeImages($, dom) {
    let images = [];
    const unsafeKeywords = ['ad', 'ads', 'advertisement', 'sponsor', 'logo', 'icon', 'avatar', 'banner', 'promo', 'googlead', 'doubleclick', 'amazon-ads', 'advert', 'watermark', 'pixel', 'tracking'];
    
    $('img').each((i, el) => {
        let src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('srcset');
        if (src && src.startsWith('http')) {
            let cleanUrl = src.split(' ')[0];
            cleanUrl = cleanUrl.split('?')[0]; // إزالة المعاملات
            cleanUrl = cleanUrl.toLowerCase();
            
            // التحقق من أن الصورة ليست إعلاناً
            let isSafe = true;
            for (let keyword of unsafeKeywords) {
                if (cleanUrl.includes(keyword)) {
                    isSafe = false;
                    break;
                }
            }
            
            // التحقق من امتدادات الصور المقبولة
            const validExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
            let hasValidExt = false;
            for (let ext of validExtensions) {
                if (cleanUrl.includes(ext)) {
                    hasValidExt = true;
                    break;
                }
            }
            
            if (isSafe && hasValidExt && cleanUrl.length < 300 && !images.includes(cleanUrl)) {
                images.push(cleanUrl);
            }
        }
    });
    
    // إذا لم نجد صوراً، نستخدم صوراً آمنة من Unsplash
    if (images.length === 0) {
        const ogImage = dom.window.document.querySelector('meta[property="og:image"]');
        if (ogImage && ogImage.content) {
            let ogUrl = ogImage.content.split('?')[0];
            let isSafe = true;
            for (let keyword of unsafeKeywords) {
                if (ogUrl.toLowerCase().includes(keyword)) {
                    isSafe = false;
                    break;
                }
            }
            if (isSafe) images.push(ogUrl);
        }
    }
    
    // نحد أقصى 3 صور آمنة
    return images.filter(img => !unsafeKeywords.some(k => img.includes(k))).slice(0, 3);
}

function getRandomDelay() {
    const minMs = 30 * 1000;
    const maxMs = 60 * 1000;
    return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
}

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function getArticleData(url) {
    try {
        const response = await axios.get(url, {
            timeout: 20000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        const html = response.data;
        const dom = new JSDOM(html, { url });
        const reader = new Readability(dom.window.document);
        const article = reader.parse();
        
        if (!article || !article.textContent || article.textContent.length < 300) return null;

        const $ = cheerio.load(article.content);
        const safeImages = extractSafeImages($, dom);
        
        // تنظيف النص وتوسيعه قليلاً
        let cleanText = article.textContent
            .trim()
            .replace(/\s+/g, ' ')
            .replace(/ADVERTISEMENT/gi, '')
            .replace(/Sponsor/gi, '')
            .replace(/Ad\s/gi, '');
            
        // نأخذ أول 4000 حرف كأساس (سنطلب من AI التوسع)
        cleanText = cleanText.slice(0, 4000);

        return { 
            title: article.title || "Untitled",
            text: cleanText, 
            images: safeImages,
            link: url 
        };
    } catch (e) { 
        console.log(`❌ Error fetching ${url}: ${e.message}`);
        return null; 
    }
}

async function generateSmartContent(article, retryCount = 0) {
    const extraImages = article.images.length > 0 ? article.images : [SAFE_IMAGES[0]];
    const mainImage = extraImages[0];
    const otherImages = extraImages.slice(1, 3);

    const prompt = `You are an Elite SEO Expert and professional content writer. Create a COMPREHENSIVE, DETAILED, and LONG-FORM article based on the topic below.

IMPORTANT RULES:
1. The article MUST be at least 1500 words (aim for 1800-2500 words).
2. Expand the topic with your own knowledge - add statistics, examples, case studies, and actionable advice.
3. Structure the article professionally with multiple H2 and H3 headings.
4. Add 2-3 Tip Boxes throughout the article.
5. Include a "Key Takeaways" section at the beginning.
6. Add a "Frequently Asked Questions (FAQ)" section at the end with 3-4 questions and answers.
7. Use bold text for important keywords and phrases.
8. Write in clear, engaging English.

Available images (use them naturally in the article):
- Main/Featured image: ${mainImage}
- Additional images: ${JSON.stringify(otherImages)}

OUTPUT FORMAT (JSON only, no extra text):
{
    "seoTitle": "SEO-optimized title (50-60 characters)",
    "metaDescription": "Compelling meta description with keywords (150-160 characters)",
    "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"],
    "htmlContent": "Complete HTML article content without <h1>, <html>, <head>, <body>"
}

HTML STRUCTURE REQUIREMENTS:
1. Start with a <div class="key-takeaways"> box containing 4-5 bullet points of main insights
2. Use <h2> for main sections and <h3> for subsections
3. Include 2-3 tip boxes:
   <div class="tip-box">
       <strong><i class="fas fa-lightbulb"></i> Pro Tip:</strong>
       <p>Your valuable advice here...</p>
   </div>
4. Insert images using:
   <div class="content-img">
       <img src="IMAGE_URL" alt="Descriptive alt text">
       <div class="caption">Image caption with useful context</div>
   </div>
5. End with an FAQ section:
   <div class="faq-section">
       <h2>Frequently Asked Questions</h2>
       <div class="faq-item"><strong>Q: Question?</strong><p>A: Answer.</p></div>
   </div>
6. Use short paragraphs (2-3 sentences max)
7. Include bullet points and numbered lists where appropriate

Original topic inspiration: "${article.title}"
Reference material: ${article.text}

Create a unique, expanded, valuable article that helps readers solve problems or learn something new. DO NOT just copy the reference - expand and improve it significantly.`;

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
            throw new Error("Generated content too short");
        }
        
        return result;
    } catch (e) { 
        if (retryCount < 2) {
            console.log(`⚠️ Retry ${retryCount + 1} for content generation...`);
            await delay(5000);
            return generateSmartContent(article, retryCount + 1);
        }
        console.log(`❌ Failed to generate content: ${e.message}`);
        return null; 
    }
}

async function publishToBlogger(aiData, mainImage, sourceLabel, readTime, currentDate) {
    try {
        const safeMainImage = addWatermarkToImage(mainImage, aiData.seoTitle);
        
        const schemaJSON = {
            "@context": "https://schema.org",
            "@type": "Article",
            "headline": aiData.seoTitle,
            "image": [safeMainImage],
            "datePublished": new Date().toISOString(),
            "description": aiData.metaDescription,
            "author": { "@type": "Organization", "name": "Tech Insights" }
        };

        const htmlBody = `
<script type="application/ld+json">
${JSON.stringify(schemaJSON)}
</script>

<div class="main-wrapper" dir="ltr">
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        @import url('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css');
        
        .main-wrapper { font-family: 'Inter', sans-serif; background: #f5f7fa; color: #1e2a3e; line-height: 1.7; padding: 20px 0; }
        .article-container { max-width: 880px; margin: 0 auto; background: white; border-radius: 24px; padding: 30px 40px 50px; box-shadow: 0 20px 35px -12px rgba(0,0,0,0.1); }
        .article-header { margin-bottom: 30px; border-bottom: 2px solid #eef2f6; padding-bottom: 20px; }
        .article-category { display: inline-block; background: #eef2ff; color: #2563eb; font-size: 0.85rem; font-weight: 700; padding: 6px 14px; border-radius: 30px; margin-bottom: 16px; text-transform: uppercase; letter-spacing: 0.5px;}
        .article-container h1 { font-size: 2.2rem; font-weight: 800; line-height: 1.3; margin-bottom: 16px; color: #0f172a; }
        .article-meta { display: flex; flex-wrap: wrap; gap: 18px; font-size: 0.9rem; color: #64748b; margin-top: 10px; font-weight: 500;}
        .article-meta i { margin-right: 6px; color: #3b82f6; }
        .featured-image { margin: 20px 0 30px; border-radius: 20px; overflow: hidden; box-shadow: 0 12px 24px -12px rgba(0,0,0,0.15); }
        .featured-image img { width: 100%; height: auto; max-height: 500px; object-fit: cover; display: block; }
        .article-content h2 { font-size: 1.8rem; font-weight: 700; margin: 40px 0 15px 0; padding-left: 14px; border-left: 5px solid #3b82f6; color: #0f172a; }
        .article-content h3 { font-size: 1.4rem; font-weight: 600; margin: 30px 0 12px 0; color: #1e293b; }
        .article-content p { margin-bottom: 1.2rem; font-size: 1.05rem; color: #334155; }
        .article-content ul, .article-content ol { margin: 18px 0 22px 30px; }
        .tip-box { background: #f0f9ff; border-left: 4px solid #0ea5e9; padding: 20px 24px; border-radius: 16px; margin: 30px 0; }
        .tip-box strong { color: #0284c7; display: flex; align-items: center; gap: 8px; font-size: 1.2rem; margin-bottom: 10px; }
        .key-takeaways { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px 24px; border-radius: 16px; margin: 20px 0 30px; }
        .key-takeaways h3 { color: #b45309; margin-bottom: 12px; }
        .faq-section { background: #f8fafc; border-radius: 20px; padding: 25px; margin: 40px 0 20px; }
        .faq-item { margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px solid #e2e8f0; }
        .faq-item:last-child { border-bottom: none; }
        .faq-item strong { color: #1e293b; font-size: 1.05rem; }
        .content-img { margin: 35px 0; text-align: center; }
        .content-img img { max-width: 100%; border-radius: 16px; box-shadow: 0 8px 20px rgba(0,0,0,0.1); }
        .caption { font-size: 0.85rem; color: #64748b; margin-top: 10px; font-style: italic; }
        .author-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 20px; padding: 25px; margin: 50px 0 20px; display: flex; flex-wrap: wrap; gap: 20px; align-items: center; }
        .author-avatar { width: 70px; height: 70px; background: #e2e8f0; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 2rem; color: #475569; }
        .image-attribution { font-size: 0.7rem; color: #94a3b8; text-align: center; margin-top: 5px; }
        @media (max-width: 650px) {
            .article-container h1 { font-size: 1.8rem; }
            .article-content h2 { font-size: 1.5rem; }
            .article-container { padding: 20px 22px 35px; }
        }
    </style>

    <div class="article-container">
        <div class="article-header">
            <span class="article-category"><i class="fas fa-bolt"></i> ${sourceLabel}</span>
            <h1>${escapeHtml(aiData.seoTitle)}</h1>
            <div class="article-meta">
                <span><i class="far fa-calendar-alt"></i> ${currentDate}</span>
                <span><i class="far fa-user"></i> Tech Insights Team</span>
                <span><i class="far fa-clock"></i> ${readTime} min read</span>
            </div>
        </div>
        <div class="featured-image">
            <img src="${escapeHtml(safeMainImage)}" alt="${escapeHtml(aiData.seoTitle)}">
            <div class="image-attribution">📷 Image for illustrative purposes | Source: Unsplash (Free for commercial use)</div>
        </div>
        <div class="article-content">
            ${aiData.htmlContent}
        </div>
        <div class="author-box">
            <div class="author-avatar"><i class="fas fa-chalkboard-user"></i></div>
            <div class="author-info">
                <h4>Tech Insights Editorial Team</h4>
                <p>We deliver in-depth, research-backed content to help you stay ahead in the fast-evolving world of technology and digital business.</p>
            </div>
        </div>
    </div>
</div>`;

        const dynamicLabels = [...new Set([sourceLabel, ...(aiData.keywords || [])])].slice(0, 5);

        const auth = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET);
        auth.setCredentials({ refresh_token: REFRESH_TOKEN });
        const blogger = google.blogger({ version: 'v3', auth });

        const result = await blogger.posts.insert({
            blogId: BLOG_ID,
            requestBody: {
                title: aiData.seoTitle,
                content: htmlBody,
                labels: dynamicLabels,
                customMetaData: aiData.metaDescription.substring(0, 150)
            }
        });

        console.log(`✅ Published: ${aiData.seoTitle}`);
        return result;
    } catch (e) {
        console.log(`❌ Failed to publish: ${e.message}`);
        return null;
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

async function startEmpireBot() {
    console.log(`🚀 Bot started at ${new Date().toLocaleString()}`);
    console.log(`📡 Total sources: ${SOURCES.length}`);
    
    let totalPublished = 0;
    
    for (let i = 0; i < SOURCES.length; i++) {
        const source = SOURCES[i];
        console.log(`\n📰 Processing source ${i+1}/${SOURCES.length}: ${source.label}`);
        
        try {
            const feed = await parser.parseURL(source.url);
            if (!feed.items || feed.items.length === 0) {
                console.log(`⚠️ No items found in ${source.label}`);
                continue;
            }
            
            const items = feed.items.slice(0, 2);
            let postedSuccessfully = false;

            for (let j = 0; j < items.length; j++) {
                const item = items[j];
                console.log(`  🔍 Fetching article ${j+1}/${items.length}: ${item.title?.substring(0, 50)}...`);
                
                const data = await getArticleData(item.link);
                if (!data || data.text.length < 300) {
                    console.log(`  ⏭️ Skipping: content too short or unavailable`);
                    continue;
                }
                
                console.log(`  📝 Generating comprehensive AI content (this may take 30-60 seconds)...`);
                const aiData = await generateSmartContent(data);
                if (!aiData || !aiData.htmlContent || aiData.htmlContent.length < 1500) {
                    console.log(`  ⏭️ Skipping: AI generation failed or content too short`);
                    continue;
                }

                const coverImg = (data.images && data.images.length > 0) 
                    ? data.images[0] 
                    : SAFE_IMAGES[Math.floor(Math.random() * SAFE_IMAGES.length)];

                const wordCount = aiData.htmlContent.replace(/<[^>]*>/g, '').split(/\s+/).length;
                const readTime = Math.max(5, Math.ceil(wordCount / 200));
                const currentDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

                await publishToBlogger(aiData, coverImg, source.label, readTime, currentDate);
                postedSuccessfully = true;
                totalPublished++;
                break;
            }

            if (postedSuccessfully && i < SOURCES.length - 1) {
                const waitTime = getRandomDelay();
                console.log(`  ⏳ Waiting ${Math.round(waitTime/1000)} seconds before next source...`);
                await delay(waitTime);
            }

        } catch (err) {
            console.log(`❌ Error processing ${source.label}: ${err.message}`);
        }
    }
    
    console.log(`\n🏁 Bot finished! Total published: ${totalPublished} articles`);
}

startEmpireBot().catch(err => {
    console.error(`💥 Fatal error: ${err.message}`);
    process.exit(1);
});
