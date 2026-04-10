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

// أقسام Medium المطلوبة
const MEDIUM_CATEGORIES = [
    { name: "Video Games", url: "https://medium.com/search?q=video+game", cpc: "$2.50-$5.00" },
    { name: "Tech Content", url: "https://medium.com/search?q=Tech+Content", cpc: "$3.00-$6.00" },
    { name: "Finance", url: "https://medium.com/search?q=Finance", cpc: "$4.00-$8.00" },
    { name: "Technology", url: "https://medium.com/search?q=Technology", cpc: "$3.00-$6.00" },
    { name: "Make Money Online", url: "https://medium.com/search?q=Make+Money+Online", cpc: "$3.50-$7.00" },
    { name: "Movies & TV Shows", url: "https://medium.com/search?q=Movies+%26+TV+Shows", cpc: "$2.00-$4.00" },
    { name: "Apps & Software", url: "https://medium.com/search?q=Apps+%26+Software", cpc: "$2.50-$5.50" },
    { name: "Health & Fitness", url: "https://medium.com/search?q=Health+%26+Fitness", cpc: "$3.00-$6.00" },
    { name: "Download Apps", url: "https://medium.com/search?q=Download+Apps", cpc: "$2.00-$4.00" },
    { name: "Fix Problems / Troubleshooting", url: "https://medium.com/search?q=Fix+Problems+%2F+Troubleshooting", cpc: "$2.50-$5.00" }
];

// اختيار 5 أقسام عشوائية أو محددة
const selectedCategories = MEDIUM_CATEGORIES.sort(() => Math.random() - 0.5).slice(0, 5);

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// استخراج مقالات من Medium
async function fetchMediumArticles(categoryUrl) {
    try {
        console.log(`   Searching Medium: ${categoryUrl}`);
        const response = await axios.get(categoryUrl, {
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml',
                'Accept-Language': 'en-US,en;q=0.9'
            }
        });

        const $ = cheerio.load(response.data);
        const articles = [];

        // استخراج روابط المقالات من صفحة البحث
        $('article, .postArticle, .postArticle-content, a[data-post-id]').each((i, elem) => {
            if (articles.length >= 10) return false;
            
            const link = $(elem).find('a').attr('href') || $(elem).attr('href');
            if (link && link.includes('medium.com') && !link.includes('/tag/') && !link.includes('/search')) {
                const fullUrl = link.startsWith('http') ? link : `https://medium.com${link}`;
                articles.push(fullUrl);
            }
        });

        // إذا لم نجد مقالات، نستخدم مصادر RSS بديلة
        if (articles.length === 0) {
            console.log(`   No Medium articles found, using backup sources...`);
            return await getBackupArticles(categoryUrl);
        }

        return [...new Set(articles)]; // إزالة التكرار
    } catch (error) {
        console.log(`   Medium fetch error: ${error.message}`);
        return await getBackupArticles(categoryUrl);
    }
}

// مصادر احتياطية في حال فشل Medium
async function getBackupArticles(categoryUrl) {
    const backupSources = {
        'video+game': ['https://feeds.feedburner.com/ign/articles', 'https://www.gamespot.com/feeds/news'],
        'Tech+Content': ['https://www.techradar.com/rss', 'https://www.cnet.com/rss/news'],
        'Finance': ['https://www.entrepreneur.com/feed', 'https://feeds.feedburner.com/finance'],
        'Technology': ['https://www.theverge.com/rss/index.xml', 'https://techcrunch.com/feed/'],
        'Make+Money+Online': ['https://www.entrepreneur.com/topic/make-money-online/feed'],
        'Movies+%26+TV+Shows': ['https://variety.com/feed/'],
        'Apps+%26+Software': ['https://www.techradar.com/rss'],
        'Health+%26+Fitness': ['https://www.healthline.com/rss'],
        'Download+Apps': ['https://www.techradar.com/rss'],
        'Fix+Problems+%2F+Troubleshooting': ['https://www.techradar.com/rss']
    };

    const key = Object.keys(backupSources).find(k => categoryUrl.includes(k));
    return backupSources[key] || ['https://www.techradar.com/rss'];
}

// استخراج الصور مع استبعاد الإعلانات
async function extractAllContentImages($, url) {
    const images = [];
    const seenUrls = new Set();
    
    // أنماط الصور غير المرغوب فيها (إعلانات، شعارات، إلخ)
    const excludePatterns = [
        'logo', 'icon', 'avatar', 'banner', 'advertisement', 'sponsor',
        'facebook', 'twitter', 'instagram', 'youtube', 'linkedin', 'pinterest',
        'data:image', '.svg', '1x1', 'pixel', 'tracking', 'analytics',
        'doubleclick', 'googleads', 'adnxs', 'adserver', 'buysellads',
        'carbonads', 'ad.doubleclick', 'adzerk', 'exponential'
    ];
    
    // البحث عن جميع الصور في المحتوى
    $('img').each((i, img) => {
        const src = $(img).attr('src') || 
                   $(img).attr('data-src') || 
                   $(img).attr('data-original') || 
                   $(img).attr('data-lazy-src');
                   
        const alt = $(img).attr('alt') || '';
        const title = $(img).attr('title') || '';
        const imgClass = $(img).attr('class') || '';
        const parentClass = $(img).parent().attr('class') || '';
        
        // التحقق من أن الصورة ليست إعلاناً
        if (src && src.startsWith('http')) {
            const isExcluded = excludePatterns.some(pattern => 
                src.toLowerCase().includes(pattern) ||
                alt.toLowerCase().includes(pattern) ||
                imgClass.toLowerCase().includes(pattern) ||
                parentClass.toLowerCase().includes(pattern)
            );
            
            if (!isExcluded) {
                // تنظيف URL
                let cleanUrl = src.split('?')[0].split('#')[0];
                
                // التحقق من امتداد الصورة
                if (cleanUrl.match(/\.(jpg|jpeg|png|webp|gif)(\?.*)?$/i) && !seenUrls.has(cleanUrl)) {
                    seenUrls.add(cleanUrl);
                    
                    // تحديد أبعاد الصورة
                    const width = parseInt($(img).attr('width')) || 
                                 parseInt($(img).css('width')) || 
                                 800;
                    const height = parseInt($(img).attr('height')) || 
                                  parseInt($(img).css('height')) || 
                                  450;
                    
                    // قبول الصور ذات الأبعاد المناسبة فقط
                    if (width > 100 && height > 100) {
                        images.push({
                            url: cleanUrl,
                            alt: alt.substring(0, 200) || title.substring(0, 200) || 'Article image',
                            width: width,
                            height: height
                        });
                    }
                }
            }
        }
    });
    
    // البحث عن صور في الخلفية
    $('[style*="background-image"]').each((i, elem) => {
        const style = $(elem).attr('style');
        const match = style.match(/url\(['"]?([^'"]+)['"]?\)/);
        if (match && match[1] && match[1].startsWith('http')) {
            const url = match[1].split('?')[0];
            if (!excludePatterns.some(p => url.toLowerCase().includes(p)) && !seenUrls.has(url)) {
                seenUrls.add(url);
                images.push({
                    url: url,
                    alt: 'Featured image',
                    width: 800,
                    height: 450
                });
            }
        }
    });
    
    return images;
}

// استخراج محتوى المقال
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
        
        // استخراج جميع الصور
        const images = await extractAllContentImages($, url);
        
        // تنظيف النص من الإيموجي والرموز
        const cleanText = article.textContent
            .trim()
            .replace(/\s+/g, ' ')
            .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '') // إزالة الإيموجي
            .replace(/[^\x00-\x7F\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g, '') // السماح بالإنجليزية والعربية فقط
            .slice(0, 8000);
        
        return {
            title: article.title || "Untitled",
            text: cleanText,
            images: images,
            link: url,
            excerpt: article.excerpt || cleanText.substring(0, 300)
        };
    } catch (e) {
        console.log(`   Content fetch error: ${e.message}`);
        return null;
    }
}

// توليد محتوى SEO محسن
async function generateSEORichContent(article, category) {
    const prompt = `Create a comprehensive SEO-optimized blog article.

Title: "${article.title}"
Category: ${category}
Excerpt: ${article.excerpt}

Requirements:
- Length: 1500-2000 words
- SEO Title: Under 60 characters with main keyword
- Meta Description: 150-160 characters compelling
- URL Slug: SEO-friendly lowercase with hyphens
- Heading Structure: Proper H1, H2, H3 hierarchy
- Content Elements:
  * Strong introduction
  * Main body with detailed analysis
  * Pros and Cons section
  * FAQ section (5 questions)
  * Conclusion
- Formatting: Short paragraphs, bullet points, no emojis
- Readability: Clear and professional tone

Output as JSON:
{
    "seoTitle": "SEO optimized title",
    "metaDescription": "Compelling meta description",
    "urlSlug": "seo-friendly-url-slug",
    "htmlContent": "<div>Full HTML content with proper structure</div>",
    "wordCount": number
}`;

    try {
        const completion = await groq.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model: "llama-3.3-70b-versatile",
            temperature: 0.6,
            max_tokens: 6000,
            response_format: { type: "json_object" }
        });
        
        const result = JSON.parse(completion.choices[0].message.content);
        
        // إزالة أي إيموجي من المحتوى
        if (result.htmlContent) {
            result.htmlContent = result.htmlContent.replace(/[\u{1F300}-\u{1F9FF}]/gu, '');
            result.seoTitle = result.seoTitle.replace(/[\u{1F300}-\u{1F9FF}]/gu, '');
            result.metaDescription = result.metaDescription.replace(/[\u{1F300}-\u{1F9FF}]/gu, '');
        }
        
        return result;
    } catch (e) {
        console.log(`   AI generation error: ${e.message}`);
        return null;
    }
}

// قالب HTML متوافق مع AdSense وبدون إيموجي
function getAdSenseFriendlyTemplate(content, metadata, images, category, readTime) {
    const currentDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const mainImage = images[0] || { url: 'https://source.unsplash.com/featured/800x450?technology', alt: 'Featured image' };
    
    // معرض الصور
    const galleryHTML = images.slice(1).map(img => `
        <figure class="content-image">
            <img src="${escapeHtml(img.url)}" alt="${escapeHtml(img.alt)}" loading="lazy">
            <figcaption>${escapeHtml(img.alt)}</figcaption>
        </figure>
    `).join('');
    
    return `
<div class="article-container">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: #f8f9fa;
            padding: 20px;
            line-height: 1.7;
            color: #212529;
        }
        
        .article-container {
            max-width: 900px;
            margin: 0 auto;
        }
        
        .article-main {
            background: white;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 2px 8px rgba(0,0,0,0.08);
            padding: 40px 48px;
        }
        
        .category-label {
            display: inline-block;
            background: #e9ecef;
            color: #495057;
            font-size: 0.8rem;
            font-weight: 600;
            padding: 4px 12px;
            border-radius: 20px;
            margin-bottom: 20px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        h1 {
            font-size: 2.4rem;
            font-weight: 700;
            line-height: 1.3;
            margin-bottom: 16px;
            color: #1a1a1a;
        }
        
        h2 {
            font-size: 1.8rem;
            font-weight: 600;
            margin: 40px 0 20px;
            padding-bottom: 8px;
            border-bottom: 2px solid #dee2e6;
            color: #2c3e50;
        }
        
        h3 {
            font-size: 1.4rem;
            font-weight: 600;
            margin: 30px 0 15px;
            color: #34495e;
        }
        
        h4 {
            font-size: 1.1rem;
            font-weight: 600;
            margin: 24px 0 12px;
            color: #495057;
        }
        
        p {
            margin-bottom: 1.3rem;
            color: #495057;
        }
        
        .article-meta {
            display: flex;
            flex-wrap: wrap;
            gap: 20px;
            margin: 16px 0 28px;
            padding-bottom: 20px;
            border-bottom: 1px solid #e9ecef;
            color: #6c757d;
            font-size: 0.85rem;
        }
        
        .featured-image {
            margin: 28px 0 32px;
            border-radius: 8px;
            overflow: hidden;
        }
        
        .featured-image img {
            width: 100%;
            height: auto;
            display: block;
        }
        
        .content-image {
            margin: 28px 0;
            text-align: center;
        }
        
        .content-image img {
            max-width: 100%;
            height: auto;
            border-radius: 6px;
        }
        
        .content-image figcaption {
            margin-top: 8px;
            font-size: 0.85rem;
            color: #6c757d;
        }
        
        ul, ol {
            margin: 1.2rem 0 1.2rem 1.8rem;
            color: #495057;
        }
        
        li {
            margin-bottom: 0.5rem;
        }
        
        .pros-section, .cons-section {
            padding: 20px 24px;
            margin: 28px 0;
            border-radius: 8px;
        }
        
        .pros-section {
            background: #d4edda;
            border-left: 4px solid #28a745;
        }
        
        .cons-section {
            background: #f8d7da;
            border-left: 4px solid #dc3545;
        }
        
        .faq-section {
            background: #f8f9fa;
            border-radius: 8px;
            padding: 28px 32px;
            margin: 40px 0;
        }
        
        .faq-question {
            font-weight: 600;
            color: #1a1a1a;
            margin: 20px 0 8px;
        }
        
        .faq-answer {
            color: #495057;
            margin-bottom: 20px;
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 28px 0;
        }
        
        th, td {
            padding: 12px;
            text-align: left;
            border: 1px solid #dee2e6;
        }
        
        th {
            background: #f8f9fa;
            font-weight: 600;
        }
        
        .author-section {
            margin-top: 48px;
            padding-top: 28px;
            border-top: 2px solid #e9ecef;
            color: #6c757d;
        }
        
        @media (max-width: 768px) {
            .article-main {
                padding: 24px 20px;
            }
            
            h1 {
                font-size: 1.8rem;
            }
            
            h2 {
                font-size: 1.4rem;
            }
        }
    </style>
    
    <article class="article-main">
        <span class="category-label">${escapeHtml(category)}</span>
        
        <h1>${escapeHtml(metadata.seoTitle)}</h1>
        
        <div class="article-meta">
            <span>Published: ${currentDate}</span>
            <span>Category: ${escapeHtml(category)}</span>
            <span>Read time: ${readTime} min</span>
        </div>
        
        <figure class="featured-image">
            <img src="${escapeHtml(mainImage.url)}" alt="${escapeHtml(mainImage.alt)}" loading="eager">
        </figure>
        
        ${galleryHTML}
        
        <div class="article-content">
            ${content.htmlContent}
        </div>
        
        <div class="author-section">
            <p>Content provided for informational purposes only.</p>
        </div>
    </article>
</div>`;
}

// الحصول على مقال من Medium
async function getArticleFromMedium(category) {
    try {
        console.log(`   Fetching from ${category.name}...`);
        
        // محاولة جلب المقالات من Medium
        const articleUrls = await fetchMediumArticles(category.url);
        
        // إذا كانت النتيجة مصدر RSS احتياطي
        if (articleUrls[0] && articleUrls[0].includes('feed')) {
            for (const feedUrl of articleUrls) {
                try {
                    const feed = await parser.parseURL(feedUrl);
                    for (let item of feed.items.slice(0, 3)) {
                        if (!item.link) continue;
                        
                        console.log(`   Trying: ${item.title?.substring(0, 50)}...`);
                        const articleData = await fetchArticleContent(item.link);
                        
                        if (articleData && articleData.text.length > 500) {
                            articleData.category = category.name;
                            return articleData;
                        }
                        await delay(2000);
                    }
                } catch (e) {
                    console.log(`   Feed error: ${e.message}`);
                }
            }
            return null;
        }
        
        // معالجة روابط Medium المباشرة
        for (const url of articleUrls) {
            console.log(`   Processing: ${url.substring(0, 50)}...`);
            const articleData = await fetchArticleContent(url);
            
            if (articleData && articleData.text.length > 500) {
                articleData.category = category.name;
                return articleData;
            }
            await delay(2000);
        }
        
        return null;
    } catch (error) {
        console.log(`   Category error: ${error.message}`);
        return null;
    }
}

// نشر المقال
async function publishToBlogger(content, metadata, images, category, readTime) {
    try {
        const htmlBody = getAdSenseFriendlyTemplate(content, metadata, images, category, readTime);
        
        const auth = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET);
        auth.setCredentials({ refresh_token: REFRESH_TOKEN });
        const blogger = google.blogger({ version: 'v3', auth });
        
        const slug = metadata.urlSlug || metadata.seoTitle.toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
        
        await blogger.posts.insert({
            blogId: BLOG_ID,
            requestBody: {
                title: metadata.seoTitle,
                content: htmlBody,
                labels: [category],
                customMetaData: metadata.metaDescription
            }
        });
        
        return true;
    } catch (e) {
        console.log(`   Publish error: ${e.message}`);
        return false;
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// البوت الرئيسي
async function startBot() {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`SEO BOT - 5 ARTICLES FROM MEDIUM SECTIONS`);
    console.log(`Date: ${new Date().toLocaleString()}`);
    console.log(`${'='.repeat(60)}\n`);
    
    let published = 0;
    const results = {};
    
    for (const category of selectedCategories) {
        console.log(`\n${'-'.repeat(60)}`);
        console.log(`CATEGORY ${published + 1}/5: ${category.name}`);
        console.log(`${'-'.repeat(60)}\n`);
        
        let articlePublished = false;
        let attempts = 0;
        const maxAttempts = 3;
        
        while (!articlePublished && attempts < maxAttempts) {
            attempts++;
            
            if (attempts > 1) {
                console.log(`   Retry attempt ${attempts}/${maxAttempts}...`);
            }
            
            const article = await getArticleFromMedium(category);
            
            if (article && article.text.length > 500) {
                console.log(`   Article found: ${article.title.substring(0, 60)}...`);
                console.log(`   Images extracted: ${article.images.length}`);
                console.log(`   Generating SEO content...`);
                
                const seoContent = await generateSEORichContent(article, category.name);
                
                if (seoContent && seoContent.htmlContent) {
                    const wordCount = seoContent.wordCount || 
                        seoContent.htmlContent.replace(/<[^>]*>/g, '').split(/\s+/).length;
                    const readTime = Math.max(5, Math.ceil(wordCount / 200));
                    
                    console.log(`   Content: ${wordCount} words, ${readTime} min read`);
                    console.log(`   Publishing to Blogger...`);
                    
                    const success = await publishToBlogger(
                        seoContent,
                        {
                            seoTitle: seoContent.seoTitle,
                            metaDescription: seoContent.metaDescription,
                            urlSlug: seoContent.urlSlug
                        },
                        article.images,
                        category.name,
                        readTime
                    );
                    
                    if (success) {
                        published++;
                        results[category.name] = { status: "PUBLISHED", words: wordCount, images: article.images.length };
                        articlePublished = true;
                        console.log(`   SUCCESS! Article ${published}/5 published!\n`);
                        await delay(45000);
                    } else {
                        results[category.name] = { status: "PUBLISH FAILED" };
                    }
                } else {
                    console.log(`   SEO generation failed`);
                }
            } else {
                console.log(`   No valid article found (attempt ${attempts}/${maxAttempts})`);
            }
            
            if (!articlePublished && attempts < maxAttempts) {
                await delay(5000);
            }
        }
        
        if (!articlePublished) {
            results[category.name] = { status: "NO ARTICLE FOUND" };
            console.log(`   Failed to get article for ${category.name}\n`);
        }
    }
    
    // التقرير النهائي
    console.log(`\n${'='.repeat(60)}`);
    console.log(`FINAL REPORT - ${published}/5 ARTICLES PUBLISHED`);
    console.log(`${'='.repeat(60)}`);
    
    for (const [category, data] of Object.entries(results)) {
        const status = data.status === "PUBLISHED" ? "[OK]" : "[FAIL]";
        const details = data.words ? `(${data.words} words, ${data.images} images)` : '';
        console.log(`   ${status} ${category}: ${data.status} ${details}`);
    }
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`BOT COMPLETED - ${new Date().toLocaleString()}`);
    console.log(`${'='.repeat(60)}\n`);
    
    process.exit(0);
}

startBot();
