const Parser = require('rss-parser');
const { JSDOM } = require('jsdom');
const { Readability } = require('@mozilla/readability');
const cheerio = require('cheerio');
const { google } = require('googleapis');
const Groq = require('groq-sdk');

// --- مكتبات التخطي والتشغيل الصامت ---
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

// --- الإعدادات الشخصية ---
const BLOG_ID = "2636919176960128451";
const CLIENT_ID = "872415365656-7qribadnc7k2u21kl6jjcbatdueevifh.apps.googleusercontent.com"; 
const CLIENT_SECRET = "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"; 
const REFRESH_TOKEN = "1//04yti9k2agPknCgYIARAAGAQSNwF-L9IrTZPKt5Fqbg2vrM9sBtOks9cnY4M7Idg0LToQnlbYGME06k20vcyr_SVmYk1H_yZJdEc"; 
const GROQ_API_KEY = "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"; 

const groq = new Groq({ apiKey: GROQ_API_KEY });
const parser = new Parser();

const SOURCES = [
    { name: "Gaming", url: "https://www.windowscentral.com/rss", label: "Gaming" },
    { name: "Android", url: "https://www.androidpolice.com/feed/", label: "Android" },
    { name: "Make Money", url: "https://www.savethestudent.org/make-money/feed", label: "Make Money" },
    { name: "Reviews", url: "https://9to5google.com/feed/", label: "Reviews" },
    { name: "Tech News", url: "https://www.geeky-gadgets.com/feed/", label: "Tech" },
    { name: "AdTech", url: "https://www.exchangewire.com/feed/", label: "Business" },
];

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// --- 1. فحص التكرار في بلوجر ---
async function isDuplicate(blogger, blogId, title) {
    try {
        const response = await blogger.posts.search({
            blogId: blogId,
            q: `title:"${title}"`
        });
        return response.data.items && response.data.items.length > 0;
    } catch (e) { return false; }
}

// --- 2. سحب البيانات مع مؤقت أمان 30 ثانية ---
async function getArticleData(url) {
    let browser;
    try {
        browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox', '--disable-setuid-sandbox'] });
        const page = await browser.newPage();
        await page.setDefaultNavigationTimeout(30000); 
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        await page.goto(url, { waitUntil: 'domcontentloaded' });
        const html = await page.content();
        await browser.close();

        const dom = new JSDOM(html, { url });
        const reader = new Readability(dom.window.document);
        const article = reader.parse();
        
        if (!article) return null;
        const $ = cheerio.load(article.content);
        let images = [];
        $('img').each((i, el) => {
            let src = $(el).attr('src') || $(el).attr('data-src');
            if (src && src.startsWith('http')) images.push(src);
        });

        return { 
            title: article.title, 
            text: article.textContent.trim().slice(0, 8000), 
            images: images.filter(img => !img.includes('avatar')), 
            link: url 
        };
    } catch (e) {
        if (browser) await browser.close();
        return null; 
    }
}

// --- 3. توليد المحتوى بالذكاء الاصطناعي ---
async function generateSmartContent(article) {
    const prompt = `
    You are an Expert SEO Content Writer. Rewrite this article into a 1000+ words masterpiece.
    OUTPUT FORMAT:
    [TITLE] Your Viral Title [/TITLE]
    [BODY] Your HTML Content (Use <h2>, <h3>, <p>, and <details><summary> for FAQ) [/BODY]
    [TAGS] Keyword1, Keyword2, Keyword3 [/TAGS]

    Article Title: ${article.title}
    Text: ${article.text}
    `;

    try {
        const completion = await groq.chat.completions.create({
            messages: [{ role: "system", content: prompt }],
            model: "llama-3.3-70b-versatile",
            temperature: 0.5 
        });
        return completion.choices[0].message.content;
    } catch (e) { return null; }
}

// --- 4. المحرك الرئيسي بالتنسيق الجديد ---
async function startEmpireBot() {
    console.log("🚀 Starting the Secure SEO Bot with Custom Layout...");
    
    const auth = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET);
    auth.setCredentials({ refresh_token: REFRESH_TOKEN });
    const blogger = google.blogger({ version: 'v3', auth });

    for (let source of SOURCES) {
        try {
            console.log(`\n📂 Checking: ${source.name}`);
            const feed = await parser.parseURL(source.url);
            const items = feed.items.slice(0, 8); 

            for (let item of items) {
                // منع التكرار
                if (await isDuplicate(blogger, BLOG_ID, item.title)) {
                    console.log(`⏭️ Skipping Duplicate: ${item.title}`);
                    continue;
                }

                const data = await getArticleData(item.link);
                if (!data || data.text.length < 600) continue;

                const aiResponse = await generateSmartContent(data);
                if (!aiResponse) continue;

                const viralTitle = aiResponse.match(/\[TITLE\](.*?)\[\/TITLE\]/s)?.[1]?.trim() || data.title;
                const cleanAiBody = aiResponse.match(/\[BODY\](.*?)\[\/BODY\]/s)?.[1]?.trim();
                const dynamicTags = aiResponse.match(/\[TAGS\](.*?)\[\/TAGS\]/s)?.[1]?.split(',').map(t => t.trim()) || [];
                
                if (!cleanAiBody) continue;

                const coverImg = data.images[0] || "https://images.unsplash.com/photo-1518770660439-4636190af475";

                // --- التنسيق المطلوب بدقة ---
                const finalHtml = `
<div class="post-container" dir="ltr">
    <style>
        .post-container { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.7; color: #1a1a1a; }
        .main-img { width: 100%; height: auto; border-radius: 15px; margin-bottom: 20px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
        h2 { color: #d32f2f; border-bottom: 2px solid #f0f0f0; padding-bottom: 10px; margin-top: 30px; }
        p { margin-bottom: 20px; font-size: 18px; }
        
        /* تفاعلية الأسئلة */
        details { background: #f9f9f9; padding: 15px; border-radius: 10px; margin-bottom: 10px; border: 1px solid #eee; transition: all 0.3s; }
        details[open] { background: #fff; border-left: 5px solid #d32f2f; box-shadow: 0 2px 10px rgba(0,0,0,0.05); }
        summary { font-weight: bold; cursor: pointer; list-style: none; outline: none; font-size: 19px; }
        summary::-webkit-details-marker { display: none; }
        
        .source-btn { display: inline-block; padding: 12px 25px; background: #222; color: #fff !important; text-decoration: none; border-radius: 50px; font-weight: bold; margin-top: 30px; }
    </style>

    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "NewsArticle",
      "headline": "${viralTitle}",
      "image": ["${coverImg}"],
      "datePublished": "${new Date().toISOString()}",
      "author": { "@type": "Person", "name": "Admin" }
    }
    </script>

    <img src="${coverImg}" class="main-img" alt="${viralTitle}">
    
    <div class="article-content">
        ${cleanAiBody}
    </div>

    <a href="${data.link}" class="source-btn" rel="nofollow noopener" target="_blank">View Original Research ↗</a>
</div>
                `;

                await blogger.posts.insert({
                    blogId: BLOG_ID,
                    requestBody: {
                        title: viralTitle,
                        content: finalHtml,
                        labels: [...new Set([source.label, ...dynamicTags])].slice(0, 10)
                    }
                });

                console.log(`✅ Published: ${viralTitle}`);
                await delay(20000); 
                break; 
            }
        } catch (err) { console.log(`❌ Error in ${source.name}`); }
    }
    console.log("🏁 Mission Accomplished.");
    process.exit(0);
}

startEmpireBot();
