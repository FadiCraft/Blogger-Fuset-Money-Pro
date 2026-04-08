const Parser = require('rss-parser');
const { JSDOM } = require('jsdom');
const { Readability } = require('@mozilla/readability');
const cheerio = require('cheerio');
const { google } = require('googleapis');
const Groq = require('groq-sdk');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const BLOG_ID = process.env.BLOG_ID || "2636919176960128451";
const CLIENT_ID = process.env.CLIENT_ID || "872415365656-7qribadnc7k2u21kl6jjcbatdueevifh.apps.googleusercontent.com"; 
const CLIENT_SECRET = process.env.CLIENT_SECRET || "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"; 
const REFRESH_TOKEN = process.env.REFRESH_TOKEN || "1//04yti9k2agPknCgYIARAAGAQSNwF-L9IrTZPKt5Fqbg2vrM9sBtOks9cnY4M7Idg0LToQnlbYGME06k20vcyr_SVmYk1H_yZJdEc"; 
const GROQ_API_KEY = process.env.GROQ_API_KEY || "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"; 

const groq = new Groq({ apiKey: GROQ_API_KEY });
const parser = new Parser();

const SOURCES = [
    { name: "Gaming", url: "https://www.windowscentral.com/rss", label: "Gaming" },
    { name: "Android", url: "https://www.androidpolice.com/feed/", label: "Android" },
    { name: "Make Money", url: "https://www.savethestudent.org/make-money/feed", label: "Make Money" },
    { name: "Reviews", url: "https://9to5google.com/feed/", label: "Reviews" },
    { name: "Tech News", url: "https://www.geeky-gadgets.com/feed/", label: "Tech" },
    { name: "AdTech", url: "https://www.exchangewire.com/feed/", label: "Business" },
    { name: "Google Help", url: "https://news.google.com/rss/search?q=how+to+fix+android+app+problem&hl=en-US", label: "Troubleshooting" }
];

function getRandomDelay() {
    const minMs = 1 * 60 * 1000;
    const maxMs = 2 * 60 * 1000;
    return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
}

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function getArticleData(url) {
    let browser;
    try {
        browser = await puppeteer.launch({
            headless: "new",
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        });
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });

        await page.evaluate(async () => {
            await new Promise((resolve) => {
                let totalHeight = 0;
                const distance = 100;
                const timer = setInterval(() => {
                    const scrollHeight = document.body.scrollHeight;
                    window.scrollBy(0, distance);
                    totalHeight += distance;
                    if (totalHeight >= scrollHeight - window.innerHeight) {
                        clearInterval(timer);
                        resolve();
                    }
                }, 50);
            });
        });

        const html = await page.content();
        await browser.close();

        const dom = new JSDOM(html, { url });
        const reader = new Readability(dom.window.document);
        const article = reader.parse();
        
        if (!article) return null;

        const $ = cheerio.load(article.content);
        let images = [];
        
        // سحب جميع الصور المتاحة في المقال
        $('img').each((i, el) => {
            let src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('srcset');
            if (src && src.startsWith('http')) {
                let cleanUrl = src.split(' ')[0];
                if (!images.includes(cleanUrl)) {
                    images.push(cleanUrl);
                }
            }
        });

        if (images.length === 0) {
            const ogImage = dom.window.document.querySelector('meta[property="og:image"]');
            if (ogImage && ogImage.content) images.push(ogImage.content);
        }

        return { 
            title: article.title, 
            text: article.textContent.trim().slice(0, 7000), 
            images: images.filter(img => !img.includes('avatar') && !img.includes('logo') && !img.includes('icon')), 
            link: url 
        };
    } catch (e) { 
        if (browser) await browser.close();
        return null; 
    }
}

async function generateSmartContent(article) {
    // فصل الصورة الأولى كغلاف، وباقي الصور لاستخدامها داخل المقال
    const extraImages = article.images && article.images.length > 1 ? article.images.slice(1, 4) : [];

    const prompt = `
    You are an Elite SEO Expert and Copywriter. Rewrite the article to be 100% unique, engaging, and perfectly optimized for Google Search.
    Language MUST be English.
    
    Available extra image URLs to use inside the article body:
    ${JSON.stringify(extraImages)}
    
    You MUST output strictly in JSON format. Do not add any text outside the JSON block.
    {
        "seoTitle": "A click-worthy, highly viral, and SEO-optimized title (Max 60 chars)",
        "metaDescription": "A compelling meta description containing the main keyword",
        "keywords": ["Keyword1", "Keyword2", "Keyword3", "Keyword4"], 
        "htmlContent": "The entire rewritten HTML article body"
    }

    RULES FOR 'htmlContent':
    1. Do NOT include <h1>, <html>, <head>, or <body> tags. Output only the content.
    2. Use <h2> and <h3> tags for all subheadings.
    3. Include at least one "Tip Box" using this EXACT HTML structure:
       <div class="tip-box">
           <strong><i class="fas fa-lightbulb"></i> Pro Tip:</strong>
           <p>Your valuable tip here...</p>
       </div>
    4. IF there are extra image URLs provided above, you MUST insert them naturally between sections using this EXACT HTML structure:
       <div class="content-img">
           <img src="IMAGE_URL_HERE" alt="Relevant SEO Alt Text">
           <div class="caption">A short descriptive caption</div>
       </div>
    5. Write short paragraphs (2-3 sentences max) to improve readability.
    6. Use Bullet Points (<ul><li>) and bold text (<strong>) for important keywords.

    Original Title: "${article.title}"
    Content to rewrite: ${article.text}
    `;

    try {
        const completion = await groq.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model: "llama-3.3-70b-versatile",
            temperature: 0.5,
            response_format: { type: "json_object" }
        });
        return JSON.parse(completion.choices[0].message.content);
    } catch (e) { 
        return null; 
    }
}

async function startEmpireBot() {
    for (let i = 0; i < SOURCES.length; i++) {
        const source = SOURCES[i];
        try {
            const feed = await parser.parseURL(source.url);
            const items = feed.items.sort(() => 0.5 - Math.random()).slice(0, 5);
            let postedSuccessfully = false;

            for (let item of items) {
                const data = await getArticleData(item.link);
                if (!data || data.text.length < 500) continue;

                const aiData = await generateSmartContent(data);
                if (!aiData || !aiData.htmlContent) continue;

                const coverImg = (data.images && data.images.length > 0) 
                    ? data.images[0] 
                    : "https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&q=80";

                // حساب وقت القراءة وتاريخ اليوم
                const wordCount = aiData.htmlContent.replace(/<[^>]*>?/gm, '').split(' ').length;
                const readTime = Math.max(1, Math.ceil(wordCount / 200));
                const currentDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

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
                        .featured-image img { width: 100%; height: auto; max-height: 500px; object-fit: cover; display: block; transition: transform 0.3s ease; }
                        .featured-image img:hover { transform: scale(1.02); }
                        
                        .article-content h2 { font-size: 1.8rem; font-weight: 700; margin: 35px 0 15px 0; padding-left: 14px; border-left: 5px solid #3b82f6; color: #0f172a; }
                        .article-content h3 { font-size: 1.4rem; font-weight: 600; margin: 28px 0 12px 0; color: #1e293b; }
                        .article-content p { margin-bottom: 1.2rem; font-size: 1.1rem; color: #334155; }
                        .article-content a { color: #2563eb; text-decoration: none; border-bottom: 1px dashed #94a3b8; }
                        .article-content a:hover { color: #1d4ed8; border-bottom-style: solid; }
                        .article-content ul, .article-content ol { margin: 18px 0 22px 30px; font-size: 1.05rem; color: #334155;}
                        .article-content li { margin-bottom: 8px; }
                        
                        .tip-box { background: #f0f9ff; border-left: 4px solid #0ea5e9; padding: 20px 24px; border-radius: 16px; margin: 30px 0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
                        .tip-box strong { color: #0284c7; display: flex; align-items: center; gap: 8px; font-size: 1.2rem; margin-bottom: 10px; }
                        .tip-box p { margin: 0 !important; font-size: 1.05rem; color: #0c4a6e; }
                        
                        .content-img { margin: 35px 0; text-align: center; }
                        .content-img img { max-width: 100%; border-radius: 16px; box-shadow: 0 8px 20px rgba(0,0,0,0.1); }
                        .caption { font-size: 0.85rem; color: #64748b; margin-top: 10px; font-style: italic; }
                        
                        .author-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 20px; padding: 25px; margin: 50px 0 20px; display: flex; flex-wrap: wrap; gap: 20px; align-items: center; }
                        .author-avatar { width: 70px; height: 70px; background: #e2e8f0; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 2rem; color: #475569; }
                        .author-info { flex: 1; min-width: 200px; }
                        .author-info h4 { font-size: 1.2rem; font-weight: 700; margin: 0 0 6px 0; color: #0f172a;}
                        .author-info p { margin: 0; font-size: 0.95rem; color: #475569;}
                        
                        @media (max-width: 650px) {
                            .article-container h1 { font-size: 1.8rem; }
                            .article-content h2 { font-size: 1.5rem; }
                            .article-content p { font-size: 1rem; }
                        }
                    </style>

                    <div class="article-container">
                        <div class="article-header">
                            <span class="article-category"><i class="fas fa-bolt"></i> ${source.label}</span>
                            <h1>${aiData.seoTitle}</h1>
                            <div class="article-meta">
                                <span><i class="far fa-calendar-alt"></i> ${currentDate}</span>
                                <span><i class="far fa-user"></i> Tech Desk</span>
                                <span><i class="far fa-clock"></i> ${readTime} min read</span>
                            </div>
                        </div>

                        <div class="featured-image">
                            <img src="${coverImg}" alt="${aiData.seoTitle}">
                        </div>

                        <div class="article-content">
                            ${aiData.htmlContent}
                        </div>

                        <div class="author-box">
                            <div class="author-avatar">
                                <i class="fas fa-robot"></i>
                            </div>
                            <div class="author-info">
                                <h4>Tech Desk Editor</h4>
                                <p>Delivering the latest insights, news, and deep dives into the technology ecosystem to keep you informed and ahead of the curve.</p>
                            </div>
                        </div>
                    </div>
                </div>
                `;

                const dynamicLabels = [...new Set([source.label, ...aiData.keywords])].slice(0, 5);

                const auth = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET);
                auth.setCredentials({ refresh_token: REFRESH_TOKEN });
                const blogger = google.blogger({ version: 'v3', auth });

                await blogger.posts.insert({
                    blogId: BLOG_ID,
                    requestBody: {
                        title: aiData.seoTitle,
                        content: htmlBody,
                        labels: dynamicLabels,
                        customMetaData: aiData.metaDescription
                    }
                });

                postedSuccessfully = true;
                break;
            }

            if (postedSuccessfully && i < SOURCES.length - 1) {
                await delay(getRandomDelay());
            }

        } catch (err) {
            // صامت لتجنب إيقاف السكربت
        }
    }
}

startEmpireBot();
