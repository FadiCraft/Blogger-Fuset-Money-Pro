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
        
        $('img').each((i, el) => {
            let src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('srcset');
            if (src && src.startsWith('http')) {
                images.push(src.split(' ')[0]);
            }
        });

        if (images.length === 0) {
            const ogImage = dom.window.document.querySelector('meta[property="og:image"]');
            if (ogImage && ogImage.content) images.push(ogImage.content);
        }

        return { 
            title: article.title, 
            text: article.textContent.trim().slice(0, 7000), 
            images: images.filter(img => !img.includes('avatar') && !img.includes('logo')), 
            link: url 
        };
    } catch (e) { 
        if (browser) await browser.close();
        return null; 
    }
}

async function generateSmartContent(article) {
    const prompt = `
    You are an Elite SEO Expert and Copywriter. Analyze the article and rewrite it to be 100% unique, highly engaging, and perfectly optimized for AdSense and Google Search. 
    
    You MUST output strictly in JSON format. Do not add any text outside the JSON block.
    
    {
        "seoTitle": "A click-worthy, highly viral, and SEO-optimized title (Max 60 chars)",
        "metaDescription": "A compelling meta description containing the main keyword (Max 150 chars)",
        "keywords": ["Keyword1", "Keyword2", "Keyword3", "Keyword4", "Keyword5"], 
        "htmlContent": "The entire rewritten HTML article body"
    }

    RULES FOR 'htmlContent':
    1. Structure: Start with a captivating introduction paragraph. Use <h2> and <h3> tags for all subheadings.
    2. AdSense Friendly: Use short paragraphs (2-3 sentences max) to allow ad insertions naturally.
    3. LSI Keywords: Naturally bold (<strong>) 4-6 important LSI keywords throughout the text.
    4. Lists: Include at least one bulleted list (<ul><li>) or numbered list.
    5. Table of Contents: Create a short <div class='toc'><ul>...</ul></div> at the top.
    6. FAQ Section: End the article with an '<h2>Frequently Asked Questions (FAQ)</h2>' containing 3 relevant questions and answers.
    7. Language: English. Tone: Professional, informative, and engaging. DO NOT output the <h1> tag in the htmlContent.

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

                // Schema Markup for SEO
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
                
                <div class="main-container" dir="ltr">
                    <style>
                        .main-container { font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #202124; line-height: 1.8; max-width: 850px; margin: 0 auto; padding: 10px; }
                        .hero-section { position: relative; border-radius: 16px; overflow: hidden; margin-bottom: 30px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
                        .hero-section img { width: 100%; height: auto; max-height: 500px; object-fit: cover; display: block; }
                        .hero-overlay { position: absolute; bottom: 0; background: linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0) 100%); width: 100%; padding: 40px 25px 20px; color: white; box-sizing: border-box;}
                        .badge { background: #1a73e8; color: white; padding: 6px 14px; border-radius: 20px; font-size: 13px; font-weight: 600; text-transform: uppercase; margin-bottom: 15px; display: inline-block; letter-spacing: 0.5px; }
                        .hero-overlay h1 { margin:0; font-size: 32px; font-weight: 700; line-height: 1.3; text-shadow: 1px 1px 3px rgba(0,0,0,0.5); }
                        .toc { background: #f8f9fa; border: 1px solid #e8eaed; border-radius: 8px; padding: 20px; margin-bottom: 30px; }
                        .toc ul { list-style: none; padding-left: 0; margin: 0; }
                        .toc li { margin-bottom: 10px; border-bottom: 1px solid #e8eaed; padding-bottom: 5px; }
                        .toc li::before { content: "🎯 "; }
                        .article-body h2 { color: #1a73e8; font-size: 26px; border-bottom: 2px solid #e8eaed; padding-bottom: 10px; margin-top: 40px; margin-bottom: 20px; font-weight: 600;}
                        .article-body h3 { color: #3c4043; font-size: 22px; margin-top: 30px; font-weight: 600;}
                        .article-body p { margin-bottom: 20px; font-size: 18px; color: #4a4d51; letter-spacing: 0.2px; }
                        .article-body strong { color: #202124; background: #fff3e0; padding: 0 4px; border-radius: 3px; }
                        .article-body ul, .article-body ol { background: #f8f9fa; padding: 20px 20px 20px 40px; border-radius: 8px; border-left: 4px solid #1a73e8; margin-bottom: 25px;}
                        .article-body li { margin-bottom: 10px; font-size: 18px; color: #4a4d51; }
                        .source-link { display: inline-block; text-align: center; margin-top: 40px; padding: 14px 28px; background: #1a73e8; color: #ffffff !important; text-decoration: none; border-radius: 8px; font-weight: 600; transition: background 0.3s; box-shadow: 0 2px 6px rgba(26,115,232,0.4); }
                        .source-link:hover { background: #1557b0; }
                        @media (max-width: 600px) { .hero-overlay h1 { font-size: 24px; } .article-body h2 { font-size: 22px; } .article-body p { font-size: 16px; } }
                    </style>

                    <div class="hero-section">
                        <img src="${coverImg}" alt="${aiData.seoTitle}">
                        <div class="hero-overlay">
                            <div class="badge">${source.label}</div>
                            <h1>${aiData.seoTitle}</h1>
                        </div>
                    </div>

                    <div class="article-body">
                        ${aiData.htmlContent}
                    </div>

                    <div style="text-align: center;">
                        <a href="${data.link}" class="source-link" target="_blank" rel="nofollow noopener noreferrer">View Original Source ↗</a>
                    </div>
                </div>
                `;

                // دمج الكلمات المفتاحية الديناميكية مع تصنيف المصدر
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
                break; // نشر مقال واحد من كل قسم لتجنب السبام
            }

            if (postedSuccessfully && i < SOURCES.length - 1) {
                await delay(getRandomDelay());
            }

        } catch (err) {
            // صامت حسب طلبك
        }
    }
}

startEmpireBot();
