const Parser = require('rss-parser');
const { JSDOM } = require('jsdom');
const { Readability } = require('@mozilla/readability');
const cheerio = require('cheerio');
const { google } = require('googleapis');
const Groq = require('groq-sdk');

// إزالة puppeteer واستبداله بـ axios لتحسين السرعة والاستقرار
const axios = require('axios');

const BLOG_ID = process.env.BLOG_ID || "2636919176960128451";
const CLIENT_ID = process.env.CLIENT_ID || "872415365656-7qribadnc7k2u21kl6jjcbatdueevifh.apps.googleusercontent.com"; 
const CLIENT_SECRET = process.env.CLIENT_SECRET || "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"; 
const REFRESH_TOKEN = process.env.REFRESH_TOKEN || "1//04yti9k2agPknCgYIARAAGAQSNwF-L9IrTZPKt5Fqbg2vrM9sBtOks9cnY4M7Idg0LToQnlbYGME06k20vcyr_SVmYk1H_yZJdEc"; 
const GROQ_API_KEY = process.env.GROQ_API_KEY || "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"; 

const groq = new Groq({ apiKey: GROQ_API_KEY });
const parser = new Parser({
    timeout: 15000, // مهلة 15 ثانية لتحميل الـ RSS
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
});

const SOURCES = [
    { name: "Gaming", url: "https://www.windowscentral.com/rss", label: "Gaming" },
    { name: "Android", url: "https://www.androidpolice.com/feed/", label: "Android" },
    { name: "Make Money", url: "https://www.savethestudent.org/make-money/feed", label: "Make Money" },
    { name: "Reviews", url: "https://9to5google.com/feed/", label: "Reviews" },
    { name: "Tech News", url: "https://www.geeky-gadgets.com/feed/", label: "Tech" },
    { name: "AdTech", url: "https://www.exchangewire.com/feed/", label: "Business" }
];

// تأخير عشوائي بين 30 ثانية و 60 ثانية (أقل من السابق لتسريع العملية)
function getRandomDelay() {
    const minMs = 30 * 1000;
    const maxMs = 60 * 1000;
    return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
}

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// دالة لجلب محتوى المقال باستخدام axios بدلاً من puppeteer (أسرع وأكثر استقراراً)
async function getArticleData(url) {
    try {
        // جلب HTML باستخدام axios مع timeout
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
        let images = [];
        
        $('img').each((i, el) => {
            let src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('srcset');
            if (src && src.startsWith('http')) {
                let cleanUrl = src.split(' ')[0];
                if (!images.includes(cleanUrl) && cleanUrl.length < 500) {
                    images.push(cleanUrl);
                }
            }
        });

        if (images.length === 0) {
            const ogImage = dom.window.document.querySelector('meta[property="og:image"]');
            if (ogImage && ogImage.content) images.push(ogImage.content);
        }

        // تنظيف النص من الأحرف الزائدة
        const cleanText = article.textContent
            .trim()
            .replace(/\s+/g, ' ')
            .slice(0, 6000);

        return { 
            title: article.title || "Untitled",
            text: cleanText, 
            images: images.filter(img => 
                !img.includes('avatar') && 
                !img.includes('logo') && 
                !img.includes('icon') &&
                !img.includes('svg') &&
                !img.includes('spacer')
            ).slice(0, 5), // حد أقصى 5 صور
            link: url 
        };
    } catch (e) { 
        console.log(`❌ Error fetching ${url}: ${e.message}`);
        return null; 
    }
}

// دالة توليد المحتوى باستخدام Groq مع إعادة المحاولة
async function generateSmartContent(article, retryCount = 0) {
    const extraImages = article.images && article.images.length > 1 ? article.images.slice(1, 4) : [];

    const prompt = `You are an Elite SEO Expert and Copywriter. Rewrite the article to be 100% unique, engaging, and perfectly optimized for Google Search.
Language MUST be English.

Available extra image URLs to use inside the article body:
${JSON.stringify(extraImages)}

IMPORTANT: You MUST output strictly in JSON format. Do not add any text outside the JSON block.

{
    "seoTitle": "A click-worthy, SEO-optimized title (Max 60 chars)",
    "metaDescription": "A compelling meta description containing the main keyword (Max 160 chars)",
    "keywords": ["Keyword1", "Keyword2", "Keyword3", "Keyword4"],
    "htmlContent": "The entire rewritten HTML article body"
}

RULES FOR 'htmlContent':
1. Do NOT include <h1>, <html>, <head>, or <body> tags. Output only the content.
2. Use <h2> and <h3> tags for subheadings.
3. Include at least one Tip Box:
   <div class="tip-box">
       <strong><i class="fas fa-lightbulb"></i> Pro Tip:</strong>
       <p>Your tip here...</p>
   </div>
4. Use short paragraphs (2-3 sentences max).
5. Use bullet points and bold text for keywords.

Original Title: "${article.title}"
Content to rewrite: ${article.text.substring(0, 5000)}`;

    try {
        const completion = await groq.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model: "llama-3.3-70b-versatile",
            temperature: 0.5,
            max_tokens: 4000,
            response_format: { type: "json_object" }
        });
        
        const result = JSON.parse(completion.choices[0].message.content);
        
        // التحقق من صحة النتيجة
        if (!result.seoTitle || !result.htmlContent || result.htmlContent.length < 500) {
            throw new Error("Invalid content generated");
        }
        
        return result;
    } catch (e) { 
        if (retryCount < 2) {
            console.log(`⚠️ Retry ${retryCount + 1} for content generation...`);
            await delay(3000);
            return generateSmartContent(article, retryCount + 1);
        }
        console.log(`❌ Failed to generate content: ${e.message}`);
        return null; 
    }
}

// دالة نشر المقال إلى Blogger
async function publishToBlogger(aiData, coverImg, sourceLabel, readTime, currentDate) {
    try {
        const schemaJSON = {
            "@context": "https://schema.org",
            "@type": "NewsArticle",
            "headline": aiData.seoTitle,
            "image": [coverImg],
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
        
        .main-wrapper { font-family: 'Inter', sans-serif; background: transparent; color: #1e2a3e; line-height: 1.7; padding: 10px 0; }
        .article-container { max-width: 880px; margin: 0 auto; background: white; border-radius: 24px; padding: 10px 20px 30px; }
        .article-header { margin-bottom: 30px; border-bottom: 2px solid #eef2f6; padding-bottom: 20px; }
        .article-category { display: inline-block; background: #eef2ff; color: #2563eb; font-size: 0.85rem; font-weight: 700; padding: 6px 14px; border-radius: 30px; margin-bottom: 16px; text-transform: uppercase; letter-spacing: 0.5px;}
        .article-container h1 { font-size: 2.2rem; font-weight: 800; line-height: 1.3; margin-bottom: 16px; color: #0f172a; }
        .article-meta { display: flex; flex-wrap: wrap; gap: 18px; font-size: 0.9rem; color: #64748b; margin-top: 10px; font-weight: 500;}
        .article-meta i { margin-right: 6px; color: #3b82f6; }
        .featured-image { margin: 20px 0 30px; border-radius: 20px; overflow: hidden; box-shadow: 0 12px 24px -12px rgba(0,0,0,0.15); }
        .featured-image img { width: 100%; height: auto; max-height: 500px; object-fit: cover; display: block; }
        .article-content h2 { font-size: 1.8rem; font-weight: 700; margin: 35px 0 15px 0; padding-left: 14px; border-left: 5px solid #3b82f6; color: #0f172a; }
        .article-content h3 { font-size: 1.4rem; font-weight: 600; margin: 28px 0 12px 0; color: #1e293b; }
        .article-content p { margin-bottom: 1.2rem; font-size: 1.1rem; color: #334155; }
        .article-content ul, .article-content ol { margin: 18px 0 22px 30px; }
        .tip-box { background: #f0f9ff; border-left: 4px solid #0ea5e9; padding: 20px 24px; border-radius: 16px; margin: 30px 0; }
        .tip-box strong { color: #0284c7; display: flex; align-items: center; gap: 8px; font-size: 1.2rem; margin-bottom: 10px; }
        .content-img { margin: 35px 0; text-align: center; }
        .content-img img { max-width: 100%; border-radius: 16px; box-shadow: 0 8px 20px rgba(0,0,0,0.1); }
        .caption { font-size: 0.85rem; color: #64748b; margin-top: 10px; font-style: italic; }
        .author-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 20px; padding: 25px; margin: 50px 0 20px; display: flex; flex-wrap: wrap; gap: 20px; align-items: center; }
        .author-avatar { width: 70px; height: 70px; background: #e2e8f0; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 2rem; color: #475569; }
        .author-info { flex: 1; }
        .author-info h4 { font-size: 1.2rem; font-weight: 700; margin: 0 0 6px 0; }
        @media (max-width: 650px) {
            .article-container h1 { font-size: 1.8rem; }
            .article-content h2 { font-size: 1.5rem; }
        }
    </style>

    <div class="article-container">
        <div class="article-header">
            <span class="article-category"><i class="fas fa-bolt"></i> ${sourceLabel}</span>
            <h1>${escapeHtml(aiData.seoTitle)}</h1>
            <div class="article-meta">
                <span><i class="far fa-calendar-alt"></i> ${currentDate}</span>
                <span><i class="far fa-user"></i> Tech Desk</span>
                <span><i class="far fa-clock"></i> ${readTime} min read</span>
            </div>
        </div>
        <div class="featured-image">
            <img src="${escapeHtml(coverImg)}" alt="${escapeHtml(aiData.seoTitle)}">
        </div>
        <div class="article-content">
            ${aiData.htmlContent}
        </div>
        <div class="author-box">
            <div class="author-avatar"><i class="fas fa-robot"></i></div>
            <div class="author-info">
                <h4>Tech Desk Editor</h4>
                <p>Delivering the latest insights and news from the technology ecosystem.</p>
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

// دالة مساعدة لتشفير HTML
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
            
            // أخذ أول 3 مقالات فقط لتسريع العملية
            const items = feed.items.slice(0, 3);
            let postedSuccessfully = false;

            for (let j = 0; j < items.length; j++) {
                const item = items[j];
                console.log(`  🔍 Fetching article ${j+1}/${items.length}: ${item.title?.substring(0, 50)}...`);
                
                const data = await getArticleData(item.link);
                if (!data || data.text.length < 500) {
                    console.log(`  ⏭️ Skipping: content too short or unavailable`);
                    continue;
                }
                
                console.log(`  📝 Generating AI content...`);
                const aiData = await generateSmartContent(data);
                if (!aiData || !aiData.htmlContent) {
                    console.log(`  ⏭️ Skipping: AI generation failed`);
                    continue;
                }

                const coverImg = (data.images && data.images.length > 0) 
                    ? data.images[0] 
                    : "https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&q=80";

                const wordCount = aiData.htmlContent.replace(/<[^>]*>/g, '').split(/\s+/).length;
                const readTime = Math.max(2, Math.ceil(wordCount / 200));
                const currentDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

                await publishToBlogger(aiData, coverImg, source.label, readTime, currentDate);
                postedSuccessfully = true;
                totalPublished++;
                break; // نجحنا في نشر مقال من هذا المصدر، ننتقل للمصدر التالي
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

// تشغيل البوت مع معالجة الأخطاء العامة
startEmpireBot().catch(err => {
    console.error(`💥 Fatal error: ${err.message}`);
    process.exit(1);
});
