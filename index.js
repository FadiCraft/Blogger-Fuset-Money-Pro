const Parser = require('rss-parser');
const { JSDOM } = require('jsdom');
const cheerio = require('cheerio');
const { google } = require('googleapis');
const Groq = require('groq-sdk');
const axios = require('axios');

// === CONFIGURATION ===
const BLOG_ID = process.env.BLOG_ID || "2636919176960128451";
const CLIENT_ID = process.env.CLIENT_ID || "872415365656-7qribadnc7k2u21kl6jjcbatdueevifh.apps.googleusercontent.com"; 
const CLIENT_SECRET = process.env.CLIENT_SECRET || "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"; 
const REFRESH_TOKEN = process.env.REFRESH_TOKEN || "1//04yti9k2agPknCgYIARAAGAQSNwF-L9IrTZPKt5Fqbg2vrM9sBtOks9cnY4M7Idg0LToQnlbYGME06k20vcyr_SVmYk1H_yZJdEc"; 
const GROQ_API_KEY = process.env.GROQ_API_KEY || "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"; 

const groq = new Groq({ apiKey: GROQ_API_KEY });
const parser = new Parser();

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// === 1. ENHANCED CONTENT FETCHING ===
async function fetchArticleContent(url) {
    try {
        const response = await axios.get(url, {
            timeout: 15000,
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'Referer': 'https://www.google.com/'
            }
        });

        const $ = cheerio.load(response.data);
        
        // Medium specific selectors
        let title = $('h1').first().text() || $('meta[property="og:title"]').attr('content');
        
        // Remove unwanted elements before extracting text
        $('script, style, nav, footer, header, noscript').remove();
        
        // Get text from the main article body
        let articleText = $('article').text() || $('section').text() || $('main').text();
        articleText = articleText.trim().replace(/\s+/g, ' ');

        // Extract Images
        const images = [];
        $('img').each((i, el) => {
            const src = $(el).attr('src');
            if (src && src.startsWith('https://miro.medium.com') && !src.includes('1*')) {
                images.push({ url: src, alt: title });
            }
        });

        if (articleText.length < 300) return null; // Minimum threshold

        return { 
            title: title,
            text: articleText.slice(0, 4000), 
            images: images.slice(0, 6),
            link: url
        };
    } catch (e) { 
        console.log(`Error fetching ${url}: ${e.message}`);
        return null; 
    }
}

// === 2. AI GENERATION (ENGLISH) ===
async function generateSEORichContent(article, topic) {
    const prompt = `Rewrite this article for a professional blog. 
Target Topic: ${topic}
Source Title: ${article.title}
Source Content: ${article.text}

Requirements:
- Language: Professional English.
- SEO: High-quality headings (H2, H3), short paragraphs, and natural keyword integration.
- Formatting: Use HTML tags (<article>, <h2>, <h3>, <ul>, <li>, <strong>).
- NO EMOJIS. NO conversational filler.
- Structure: Intro, Analysis, Key Takeaways, and Conclusion.

Return JSON:
{
    "seoTitle": "SEO optimized title",
    "metaDescription": "150 char meta description",
    "keywords": ["key1", "key2"],
    "htmlContent": "HTML body"
}`;

    try {
        const completion = await groq.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model: "llama-3.3-70b-versatile",
            temperature: 0.6,
            response_format: { type: "json_object" }
        });
        
        return JSON.parse(completion.choices[0].message.content);
    } catch (e) { return null; }
}

// === 3. PUBLISHING LOGIC ===
async function publishToBlogger(content, images, topic) {
    try {
        const auth = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET);
        auth.setCredentials({ refresh_token: REFRESH_TOKEN });
        const blogger = google.blogger({ version: 'v3', auth });

        let galleryHtml = images.map(img => `<img src="${img.url}" style="width:100%; border-radius:8px; margin:10px 0;">`).join('');

        const finalHtml = `
            <div dir="ltr" style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <article>
                    ${content.htmlContent}
                    <hr>
                    <div class="gallery">${galleryHtml}</div>
                </article>
            </div>`;

        await blogger.posts.insert({
            blogId: BLOG_ID,
            requestBody: {
                title: content.seoTitle,
                content: finalHtml,
                labels: [topic, "Trends 2026"],
                customMetaData: content.metaDescription
            }
        });
        return true;
    } catch (e) { return false; }
}

// === MAIN BOT PROCESS ===
async function startBot() {
    const topics = ['technology', 'personal-finance', 'software-development', 'digital-marketing', 'health'];
    let totalPublished = 0;

    for (const topic of topics) {
        if (totalPublished >= 5) break;
        console.log(`\nProcessing Topic: ${topic}`);
        
        try {
            const feed = await parser.parseURL(`https://medium.com/feed/tag/${topic}`);
            
            for (const item of feed.items.slice(0, 5)) {
                if (totalPublished >= 5) break;

                console.log(`- Checking: ${item.title}`);
                const articleData = await fetchArticleContent(item.link);

                if (articleData) {
                    const seoContent = await generateSEORichContent(articleData, topic);
                    if (seoContent) {
                        const success = await publishToBlogger(seoContent, articleData.images, topic);
                        if (success) {
                            totalPublished++;
                            console.log(`[SUCCESS] Published: ${seoContent.seoTitle}`);
                            await delay(10000);
                            break; // Move to next topic after one success
                        }
                    }
                }
            }
        } catch (e) { console.log(`Feed Error: ${e.message}`); }
    }
    console.log(`\nFinal: ${totalPublished} articles published.`);
}

startBot();
