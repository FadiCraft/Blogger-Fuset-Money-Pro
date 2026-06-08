const { JSDOM } = require('jsdom');
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const { HttpsProxyAgent } = require('https-proxy-agent'); // تأكد من وجودها في ملف الـ yaml

// المتغيرات الأساسية
const BLOG_ID = process.env.BLOG_ID || "2636919176960128451";
const CLIENT_ID = process.env.CLIENT_ID || "872415365656-7qribadnc7k2u21kl6jjcbatdueevifh.apps.googleusercontent.com";
const CLIENT_SECRET = process.env.CLIENT_SECRET || "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";
const REFRESH_TOKEN = process.env.REFRESH_TOKEN || "1//046k2RWLveK4KCgYIARAAGAQSNwF-L9IrYJWfeeIkjStq18W7y0hun58uQ5ZaRwT3NP_feh7hE-LLRIg5RZ9-jDJqryVNN6fVhyU";

// جلب البروكسي الحقيقي الخاص بك من الـ GitHub Secrets
const PROXY_URL = process.env.PROXY_URL; 
const proxyAgent = PROXY_URL ? new HttpsProxyAgent(PROXY_URL) : null;

const HISTORY_FILE = path.join(__dirname, 'history.json');

const SECTIONS = [
    { category: "News", url: "https://www.sammyfans.com/category/news/" },
    { category: "Phones", url: "https://www.sammyfans.com/category/phones/" },
    { category: "Updates", url: "https://www.sammyfans.com/category/updates/" },
    { category: "Android", url: "https://www.sammyfans.com/?s=android" },
    { category: "Tips", url: "https://www.sammyfans.com/category/tips/" }
];

function getHistory() {
    if (fs.existsSync(HISTORY_FILE)) {
        try { return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8') || "[]"); } catch(e) { return []; }
    }
    return [];
}

// دالة الجلب الذكية المعتمدة على البروكسي الشخصي المستقر
async function fetchPage(targetUrl) {
    const fetchOptions = {
        method: 'GET',
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5'
        }
    };

    // إذا تم توفير البروكسي، نمرره فوراً للطلب لتفادي الـ 403 والـ 522
    if (proxyAgent) {
        fetchOptions.agent = proxyAgent;
    }

    const response = await fetch(targetUrl, fetchOptions);
    if (!response.ok) throw new Error(`Fetch failed with status: ${response.status}`);
    return await response.text();
}

async function start() {
    console.log("🚀 Starting Blogger Bot with Premium Proxy Support...");
    
    if (proxyAgent) {
        console.log("🔒 Secured connection established via Private Proxy.");
    } else {
        console.log("⚠️ Warning: No PROXY_URL secret found. Using direct connection.");
    }

    if (!BLOG_ID || !REFRESH_TOKEN) {
        console.error("❌ Missing Secrets!");
        return;
    }

    const history = getHistory();
    const auth = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET);
    auth.setCredentials({ refresh_token: REFRESH_TOKEN });
    const blogger = google.blogger({ version: 'v3', auth });

    for (const section of SECTIONS) {
        try {
            console.log(`\n📡 Scraping Section [${section.category}]...`);
            
            const sectionHtml = await fetchPage(section.url);
            const sectionDom = new JSDOM(sectionHtml);
            const doc = sectionDom.window.document;

            const storyElements = doc.querySelectorAll('li.mvp-blog-story-wrap');
            let targetArticleLink = null;

            for (const el of storyElements) {
                const anchor = el.querySelector('a');
                if (anchor) {
                    const link = anchor.getAttribute('href');
                    if (link && !history.includes(link)) {
                        targetArticleLink = link;
                        break; 
                    }
                }
            }

            if (!targetArticleLink) {
                console.log(`⏩ Skip: No new articles found in [${section.category}].`);
                continue;
            }

            console.log(`🔗 Found new article link: ${targetArticleLink}`);

            const articleHtml = await fetchPage(targetArticleLink);
            const articleDom = new JSDOM(articleHtml);
            const articleDoc = articleDom.window.document;

            const metaTitle = articleDoc.querySelector('meta[property="og:title"]')?.getAttribute('content');
            const metaImage = articleDoc.querySelector('meta[property="og:image"]')?.getAttribute('content');
            const contentContainer = articleDoc.querySelector('#mvp-content-main');

            if (!contentContainer) {
                console.log("⚠️ Could not find article body container. Skipping.");
                continue;
            }

            const ads = contentContainer.querySelectorAll('.mvp-post-ad-wrap, script, ins, .adsbygoogle, img[src*="google_preferred_source_badge"]');
            ads.forEach(ad => ad.remove());

            const cleanContentHtml = contentContainer.innerHTML.trim();

            const tagElements = articleDoc.querySelectorAll('.mvp-post-tags itemprop[keywords] a, .mvp-post-tags a');
            const labels = [section.category]; 
            
            tagElements.forEach(tag => {
                const tagText = tag.textContent.trim();
                if (tagText && !labels.includes(tagText)) {
                    labels.push(tagText);
                }
            });

            const titleToPublish = metaTitle || "New Update";
            let finalBloggerContent = `<div style="font-family: Arial, sans-serif; line-height: 1.8; color: #333;">`;
            
            if (metaImage) {
                finalBloggerContent += `<div style="text-align: center; margin-bottom: 20px;"><img src="${metaImage}" style="max-width: 100%; height: auto; border-radius: 8px;" alt="${titleToPublish}"/></div>`;
            }
            
            finalBloggerContent += `${cleanContentHtml}`;
            finalBloggerContent += `<hr style="border: 0; border-top: 1px solid #eee; margin-top: 30px;"><p style="font-size: 13px; color: #777;">Source: <a href="${targetArticleLink}" target="_blank">SammyFans</a></p></div>`;

            console.log(`📝 Publishing: "${titleToPublish}"`);
            
            await blogger.posts.insert({
                blogId: BLOG_ID,
                requestBody: { 
                    title: titleToPublish, 
                    content: finalBloggerContent, 
                    labels: labels 
                }
            });

            history.push(targetArticleLink);
            fs.writeFileSync(HISTORY_FILE, JSON.stringify(history.slice(-500), null, 2));
            console.log(`✅ [${section.category}] Published successfully!`);

        } catch (err) {
            console.error(`❌ Error in section [${section.category}]: ${err.message}`);
        }
        
        await new Promise(r => setTimeout(r, 5000));
    }
}

start();
