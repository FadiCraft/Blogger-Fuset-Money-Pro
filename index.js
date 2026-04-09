const Parser = require('rss-parser');
const { JSDOM } = require('jsdom');
const { Readability } = require('@mozilla/readability');
const cheerio = require('cheerio');
const { google } = require('googleapis');
const Groq = require('groq-sdk');
const axios = require('axios');

// === الإعدادات الأساسية ===
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
    }
});

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// === 1. استخراج أهم المواضيع من Medium ===
async function getTopMediumTopics() {
    try {
        console.log("جاري استخراج المواضيع من Medium...");
        const response = await axios.get('https://medium.com/explore-topics', {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
        });
        const $ = cheerio.load(response.data);
        const topics = new Set();
        
        $('a[href^="/tag/"]').each((i, el) => {
            const tag = $(el).attr('href').split('/tag/')[1].split('?')[0];
            if(tag && tag.length > 2) topics.add(tag);
        });

        const topicsArray = Array.from(topics);
        const highCpcKeywords = ['technology', 'business', 'finance', 'software', 'programming', 'crypto', 'health', 'marketing', 'seo', 'ai'];
        const selectedTopics = topicsArray.filter(t => highCpcKeywords.includes(t.toLowerCase())).slice(0, 5);
        
        if (selectedTopics.length === 5) return selectedTopics;
        return [...new Set([...selectedTopics, ...topicsArray])].slice(0, 5);
        
    } catch (error) {
        console.log("تعذر سحب المواضيع من Medium. جاري استخدام القائمة الاحتياطية (High CPC)...");
        return ['technology', 'personal-finance', 'software-development', 'digital-marketing', 'health'];
    }
}

// === 2. استخراج الصور النظيفة فقط ===
async function extractAllImages($, url) {
    const images = [];
    const seenUrls = new Set();
    
    const excludePatterns = [
        'logo', 'icon', 'avatar', 'banner', 'ad', 'sponsor', 
        'facebook', 'twitter', 'instagram', 'youtube', 'google',
        'data:image', 'svg', '1x1', 'pixel', 'tracking',
        'advertisement', 'promo', 'badge', 'button', 'sidebar', 'footer'
    ];
    
    $('img').each((i, img) => {
        if (images.length >= 6) return false; 
        
        let src = $(img).attr('src') || $(img).attr('data-src') || $(img).attr('srcset');
        if(src && src.includes(' ')) src = src.split(' ')[0]; 
        
        if (src && src.startsWith('http') && !excludePatterns.some(p => src.toLowerCase().includes(p))) {
            let cleanUrl = src.split('?')[0];
            
            if (cleanUrl.match(/\.(jpg|jpeg|png|webp)$/i) && !seenUrls.has(cleanUrl)) {
                const width = parseInt($(img).attr('width') || '1000');
                const height = parseInt($(img).attr('height') || '1000');
                
                if (width > 150 && height > 150) {
                    seenUrls.add(cleanUrl);
                    images.push({ url: cleanUrl, alt: $(img).attr('alt') || 'Article illustration' });
                }
            }
        }
    });
    
    return images;
}

// === 3. جلب محتوى المقال ===
async function fetchArticleContent(url) {
    try {
        const response = await axios.get(url, {
            timeout: 15000,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
        });

        const dom = new JSDOM(response.data, { url });
        const reader = new Readability(dom.window.document);
        const article = reader.parse();
        
        if (!article || !article.textContent || article.textContent.length < 500) return null;

        const $ = cheerio.load(article.content);
        const allImages = await extractAllImages($, url);
        
        return { 
            title: article.title,
            text: article.textContent.trim().replace(/\s+/g, ' ').slice(0, 3000), 
            images: allImages,
            link: url
        };
    } catch (e) { 
        return null; 
    }
}

// === 4. توليد مقال متوافق مع SEO وأدسنس (باللغة الإنجليزية) ===
async function generateSEORichContent(article, topic) {
    const prompt = `You are an expert SEO content writer and AdSense specialist. Rewrite the following article to be a unique, high-quality, and AdSense-compliant English blog post. 
The goal is to provide real value to the reader, not just keyword stuffing.

Topic: ${topic}
Original Title: ${article.title}
Reference Content: ${article.text.substring(0, 1500)}

Strict Requirements:
1. Language: Perfect, native-level English.
2. SEO: Use LSI keywords naturally. Keep paragraphs short (max 3-4 lines).
3. HTML Formatting: Use semantic HTML tags (<article>, <h2>, <h3>, <ul>, <li>, <strong>).
4. Restrictions: NO Emojis whatsoever. Do NOT write introductory phrases like "Here is the article" or "Sure, I can write that".
5. Structure: Include a catchy introduction, well-structured subheadings, a "Key Takeaways" section as a bulleted list, and a solid conclusion.

Return the result STRICTLY as a JSON object in this format:
{
    "seoTitle": "Catchy, SEO-optimized title (50-60 characters)",
    "metaDescription": "Engaging meta description containing the main keyword (130-150 characters)",
    "keywords": ["keyword1", "keyword2", "keyword3", "keyword4"],
    "htmlContent": "Clean HTML content here (NO <html>, <head>, or <body> tags, just the inner content)"
}`;

    try {
        const completion = await groq.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model: "llama-3.3-70b-versatile",
            temperature: 0.5, 
            max_tokens: 4000,
            response_format: { type: "json_object" }
        });
        
        const result = JSON.parse(completion.choices[0].message.content);
        if (result.htmlContent && result.seoTitle) return result;
        return null;
    } catch (e) { 
        console.log(`خطأ في الذكاء الاصطناعي: ${e.message}`);
        return null; 
    }
}

// === 5. قالب HTML احترافي، نظيف (English / LTR) ===
function getCleanHTMLTemplate(content, images, topic) {
    const mainImage = images.length > 0 ? images[0] : null;
    const galleryImages = images.slice(1);
    
    let imagesHtml = '';
    if (mainImage) {
        imagesHtml += `<figure class="main-image"><img src="${escapeHtml(mainImage.url)}" alt="${escapeHtml(content.seoTitle)}" loading="eager"></figure>`;
    }
    
    let galleryHtml = '';
    if (galleryImages.length > 0) {
        galleryHtml = `<div class="article-gallery">`;
        galleryImages.forEach(img => {
            galleryHtml += `<img src="${escapeHtml(img.url)}" alt="${escapeHtml(img.alt || content.seoTitle)}" loading="lazy">`;
        });
        galleryHtml += `</div>`;
    }

    const schemaOrg = {
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": content.seoTitle,
        "description": content.metaDescription,
        "articleSection": topic,
        "image": mainImage ? mainImage.url : ""
    };

    return `
<div dir="ltr" class="seo-optimized-article">
    <style>
        .seo-optimized-article {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            line-height: 1.8;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            font-size: 17px;
        }
        .seo-optimized-article h1, .seo-optimized-article h2, .seo-optimized-article h3 {
            color: #1a1a1a;
            line-height: 1.4;
            margin-top: 1.5em;
            margin-bottom: 0.5em;
            font-weight: bold;
        }
        .seo-optimized-article h1 { font-size: 2em; border-bottom: 2px solid #e0e0e0; padding-bottom: 10px; }
        .seo-optimized-article h2 { font-size: 1.5em; }
        .seo-optimized-article h3 { font-size: 1.25em; }
        .seo-optimized-article p { margin-bottom: 1.2em; }
        .seo-optimized-article img {
            max-width: 100%;
            height: auto;
            border-radius: 8px;
            margin: 1em 0;
            display: block;
        }
        .seo-optimized-article figure { margin: 0; }
        .article-gallery {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 15px;
            margin-top: 2em;
        }
        .seo-optimized-article ul, .seo-optimized-article ol {
            margin-bottom: 1.2em;
            padding-left: 20px; /* Adjusted for English LTR */
        }
        .seo-optimized-article li { margin-bottom: 0.5em; }
    </style>
    
    <script type="application/ld+json">
    ${JSON.stringify(schemaOrg)}
    </script>

    <article>
        <h1>${escapeHtml(content.seoTitle)}</h1>
        ${imagesHtml}
        <div class="content-body">
            ${content.htmlContent}
        </div>
        ${galleryHtml}
    </article>
</div>`;
}

// === 6. النشر على بلوجر ===
async function publishToBlogger(content, images, topic) {
    try {
        const htmlBody = getCleanHTMLTemplate(content, images, topic);
        const auth = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET);
        auth.setCredentials({ refresh_token: REFRESH_TOKEN });
        const blogger = google.blogger({ version: 'v3', auth });
        
        await blogger.posts.insert({
            blogId: BLOG_ID,
            requestBody: {
                title: content.seoTitle,
                content: htmlBody,
                labels: [topic, ...content.keywords.slice(0, 3)],
                customMetaData: content.metaDescription
            }
        });
        return true;
    } catch (e) {
        console.log(`خطأ أثناء النشر: ${e.message}`);
        return false;
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]));
}

// === التشغيل الرئيسي للروبوت ===
async function startBot() {
    console.log("=================================================");
    console.log("بدء روبوت النشر المتقدم - المستهدف: أدسنس & SEO (مقالات إنجليزية)");
    console.log("=================================================");
    
    let publishedCount = 0;
    const topics = await getTopMediumTopics();
    console.log(`تم تحديد المواضيع: ${topics.join(', ')}`);
    
    for (const topic of topics) {
        if (publishedCount >= 5) break;
        
        console.log(`\n--- جاري البحث في قسم: ${topic} ---`);
        const rssUrl = `https://medium.com/feed/tag/${topic}`;
        
        try {
            const feed = await parser.parseURL(rssUrl);
            let articlePublished = false;

            for (let item of feed.items.slice(0, 3)) { 
                if (articlePublished) break;
                
                console.log(`معالجة مقال: ${item.title}`);
                const articleData = await fetchArticleContent(item.link);
                
                if (articleData && articleData.text.length > 500) {
                    console.log(`تم سحب المحتوى بنجاح. الصور المرفقة: ${articleData.images.length}`);
                    console.log("جاري صياغة المقال باللغة الإنجليزية (SEO Optimized)...");
                    
                    const seoContent = await generateSEORichContent(articleData, topic);
                    
                    if (seoContent) {
                        console.log("جاري النشر على بلوجر...");
                        const success = await publishToBlogger(seoContent, articleData.images, topic);
                        
                        if (success) {
                            publishedCount++;
                            articlePublished = true;
                            console.log(`[نجاح] تم نشر المقال الإنجليزي ${publishedCount}/5`);
                            await delay(15000); 
                        }
                    }
                }
            }
            if(!articlePublished) console.log(`لم يتم العثور على مقال مناسب في قسم ${topic}`);
        } catch (error) {
            console.log(`فشل جلب تغذية RSS للقسم ${topic}: ${error.message}`);
        }
    }
    
    console.log("\n=================================================");
    console.log(`النتيجة النهائية: تم نشر ${publishedCount} مقالات إنجليزية متوافقة مع الـ SEO.`);
    console.log("=================================================");
    process.exit(0);
}

startBot();
