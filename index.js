
const Parser = require('rss-parser');
const axios = require('axios');
const { JSDOM } = require('jsdom');
const { Readability } = require('@mozilla/readability');
const cheerio = require('cheerio');
const { google } = require('googleapis');
const Groq = require('groq-sdk');

// --- الإعدادات ---
const BLOG_ID = "2636919176960128451";
const CLIENT_ID = "872415365656-7qribadnc7k2u21kl6jjcbatdueevifh.apps.googleusercontent.com";
const CLIENT_SECRET = "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";
const REFRESH_TOKEN = "1//04yti9k2agPknCgYIARAAGAQSNwF-L9IrTZPKt5Fqbg2vrM9sBtOks9cnY4M7Idg0LToQnlbYGME06k20vcyr_SVmYk1H_yZJdEc";
const GROQ_API_KEY = "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";

const groq = new Groq({ apiKey: GROQ_API_KEY });
const parser = new Parser();

// --- المصادر الذكية ---
const SOURCES = [
    { name: "Gaming", url: "https://www.windowscentral.com/gaming/rss.xml", label: "Gaming" },
    { name: "Android", url: "https://www.androidpolice.com/feed/", label: "Android" },
    { name: "Make Money", url: "https://www.savethestudent.org/make-money/feed", label: "Make Money" },
    { name: "Reviews", url: "https://9to5google.com/feed/", label: "Reviews" },
    { name: "Tech News", url: "https://www.geeky-gadgets.com/feed/", label: "Tech" },
    { name: "AdTech", url: "https://www.exchangewire.com/feed/", label: "Business" },
    { name: "Google Help", url: "https://news.google.com/rss/search?q=how+to+fix+android+app+problem&hl=en-US", label: "Troubleshooting" }
];

// --- وظائف المعالجة ---

async function getArticleData(url) {
    try {
        const res = await axios.get(url, { timeout: 10000 });
        const dom = new JSDOM(res.data, { url });
        const reader = new Readability(dom.window.document);
        const article = reader.parse();
        if (!article) return null;

        const $ = cheerio.load(article.content);
        let images = [];
        $('img').each((i, el) => {
            let src = $(el).attr('src');
            if (src && src.startsWith('http')) images.push(src);
        });

        return { title: article.title, text: article.textContent.trim().slice(0, 4000), images, link: url };
    } catch (e) { return null; }
}

async function generateSmartContent(sourceInfo, article) {
    const prompt = `
    You are an SEO Expert. Rewrite this article: "${article.title}"
    Follow these STRICT rules:
    1. Hook Title: Create a viral title (e.g., "Stop Wasting Time! Use this...")
    2. Structure: Use <h2> for subheadings.
    3. Content Type: If it's a review, make it a "Comparison". If it's a tutorial, make it "Step-by-Step Troubleshooting".
    4. Best 10: If possible, format it as a list of top tools/tips.
    5. FAQ: Add a "Frequently Asked Questions" section at the end.
    6. Internal Linking: Suggest 2 placeholders like [Insert Link to Related Post Here].
    7. Affiliate Hint: Add a call-to-action to check out a tool/app.
    8. Tone: High energy, engaging, and professional.
    9. Language: English.
    Content to rewrite: ${article.text}
    `;

    try {
        const completion = await groq.chat.completions.create({
            messages: [{ role: "system", content: prompt }],
            model: "llama3-8b-8192",
            temperature: 0.7
        });
        return completion.choices[0].message.content;
    } catch (e) { return article.text; }
}

// --- المحرك الرئيسي ---

async function startEmpireBot() {
    console.log("🚀 Starting the Multi-Niche Empire Bot...");
    
    // اختيار مصدر عشوائي لتنويع المحتوى يومياً
    const source = SOURCES[Math.floor(Math.random() * SOURCES.length)];
    const feed = await parser.parseURL(source.url);
    const items = feed.items.slice(0, 5);

    for (let item of items) {
        console.log(`📡 Checking: ${item.title}`);
        const data = await getArticleData(item.link);
        
        if (!data || data.text.length < 500) continue;

        const aiContent = await generateSmartContent(source, data);
        
        // تصميم احترافي مع علامة مائية نصية على الصور
        const coverImg = data.images[0] || "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=800";
        
        const htmlBody = `
        <div dir="ltr" style="font-family: Arial, sans-serif; color: #222; line-height: 1.7; max-width: 750px; margin: auto;">
            <div style="text-align: center; position: relative;">
                <img src="${coverImg}" style="width: 100%; border-radius: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.1);"/>
                <div style="position: absolute; top: 10px; right: 10px; background: rgba(0,0,0,0.6); color: white; padding: 5px 15px; border-radius: 50px; font-size: 12px;">
                    Verified Tech Review
                </div>
            </div>
            
            <div style="padding: 20px;">
                ${aiContent.replace(/\n/g, '<br/>')}
            </div>
            
            <div style="background: #f8f9fa; border-left: 6px solid #007bff; padding: 20px; margin-top: 30px; border-radius: 10px;">
                <strong>💡 Quick Tip:</strong> Always keep your apps updated to avoid security risks!
            </div>

            <div style="text-align: center; margin-top: 40px; padding: 20px; background: #eef2f7; border-radius: 15px;">
                <p>Enjoyed this? Check our latest <b>App Recommendations</b> on the homepage!</p>
                <a href="${data.link}" style="color: #007bff; text-decoration: none; font-weight: bold;">Original Source ↗</a>
            </div>
        </div>
        `;

        // النشر عبر جوجل
        const auth = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET);
        auth.setCredentials({ refresh_token: REFRESH_TOKEN });
        const blogger = google.blogger({ version: 'v3', auth });

        await blogger.posts.insert({
            blogId: BLOG_ID,
            requestBody: {
                title: data.title,
                content: htmlBody,
                labels: [source.label, 'Latest Apps', 'AI Tips']
            }
        });

        console.log(`✅ Published: ${data.title}`);
        break; // نشر مقال واحد احترافي في كل دورة
    }
}

startEmpireBot();
