const { JSDOM } = require('jsdom');
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

// المتغيرات الأساسية لبلوجر
const BLOG_ID = process.env.BLOG_ID || "2636919176960128451";
const CLIENT_ID = process.env.CLIENT_ID || "872415365656-7qribadnc7k2u21kl6jjcbatdueevifh.apps.googleusercontent.com";
const CLIENT_SECRET = process.env.CLIENT_SECRET || "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";
const REFRESH_TOKEN = process.env.REFRESH_TOKEN || "1//046k2RWLveK4KCgYIARAAGAQSNwF-L9IrYJWfeeIkjStq18W7y0hun58uQ5ZaRwT3NP_feh7hE-LLRIg5RZ9-jDJqryVNN6fVhyU";

const HISTORY_FILE = path.join(__dirname, 'history.json');

// مصفوفة البروكسيات الذكية الخاصة بك
const PROXIES = [
  'https://corsproxy.io/?',
  'https://api.codetabs.com/v1/proxy?quest=',
  'https://allorigins.win/raw?url=',
  'https://api.allorigins.win/raw?url=',
  'https://win98.xyz/proxy.php?url=',
  'https://thingproxy.freeboard.io/fetch/',
  'https://jsonp.afeld.me/?url='
];

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

// دالة الجلب الذكية: تحاول مع كل البروكسيات حتى تنجح في استخراج الهيكل
async function fetchWithFallback(targetUrl) {
    let lastError = null;

    for (const proxyBase of PROXIES) {
        // بناء الرابط المناسب (بعض البروكسيات تحتاج عمل encode للرابط وبعضها لا، الأفضل عمل encode)
        const fullUrl = `${proxyBase}${encodeURIComponent(targetUrl)}`;
        
        try {
            console.log(`⏳ Trying proxy: ${proxyBase}`);
            const response = await fetch(fullUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
                },
                signal: AbortSignal.timeout(15000) // وقت انتظار 15 ثانية لكل بروكسي كحد أقصى حتى لا يعلق البوت
            });

            if (response.ok) {
                const text = await response.text();
                // التحقق من أن النتيجة ليست فارغة أو تحتوي على خطأ حجب
                if (text && text.trim().length > 100 && !text.includes("403 Forbidden") && !text.includes("522")) {
                    console.log(`✅ Success with proxy: ${proxyBase}`);
                    return text;
                }
            }
            console.log(`⚠️ Proxy failed or returned bad data: ${proxyBase} (Status: ${response.status})`);
        } catch (err) {
            console.log(`❌ Proxy Error: ${proxyBase} -> ${err.message}`);
            lastError = err;
        }
    }

    throw new Error(`All proxies failed! Last error: ${lastError ? lastError.message : 'Unknown'}`);
}

async function start() {
    console.log("🚀 Starting Blogger Bot with Multi-Proxy Fallback System...");

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
            
            // طلب صفحة القسم عبر نظام البروكسيات المتعددة
            const sectionHtml = await fetchWithFallback(section.url);
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

            // طلب صفحة المقال عبر نظام البروكسيات المتعددة
            const articleHtml = await fetchWithFallback(targetArticleLink);
            const articleDom = new JSDOM(articleHtml);
            const articleDoc = articleDom.window.document;

            const metaTitle = articleDoc.querySelector('meta[property="og:title"]')?.getAttribute('content');
            const metaImage = articleDoc.querySelector('meta[property="og:image"]')?.getAttribute('content');
            const contentContainer = articleDoc.querySelector('#mvp-content-main');

            if (!contentContainer) {
                console.log("⚠️ Could not find article body container. Skipping.");
                continue;
            }

            // تنظيف الإعلانات
            const ads = contentContainer.querySelectorAll('.mvp-post-ad-wrap, script, ins, .adsbygoogle, img[src*="google_preferred_source_badge"]');
            ads.forEach(ad => ad.remove());

            const cleanContentHtml = contentContainer.innerHTML.trim();

            // استخراج الكلمات المفتاحية الـ Tags
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
