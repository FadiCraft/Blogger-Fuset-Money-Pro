const Parser = require('rss-parser');
const axios = require('axios');
const cheerio = require('cheerio');
const { google } = require('googleapis');

// إعداد الثوابت من GitHub Secrets
const BLOG_ID = "8249860422330426533";
const CLIENT_ID = "872415365656-7qribadnc7k2u21kl6jjcbatdueevifh.apps.googleusercontent.com";
const CLIENT_SECRET = "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";
const REFRESH_TOKEN ="1//04yti9k2agPknCgYIARAAGAQSNwF-L9IrTZPKt5Fqbg2vrM9sBtOks9cnY4M7Idg0LToQnlbYGME06k20vcyr_SVmYk1H_yZJdEc";

// قائمة المصادر - يمكنك إضافة أي عدد من الروابط
const RSS_SOURCES = [
    'https://www.makeuseof.com/feed/',
    'https://fossbytes.com/feed/',
    'https://www.siliconera.com/feed/',
    'https://phys.org/rss-feed/',
    'https://gadgetstouse.com/feed/'
];

/**
 * دالة سحب المحتوى الكامل والاحترافي
 */
async function getFullArticle(url) {
    try {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            timeout: 15000
        });

        const $ = cheerio.load(response.data);

        // 1. جلب الصورة البارزة (Featured Image) من الميتا
        let featuredImg = $('meta[property="og:image"]').attr('content') || 
                          $('meta[name="twitter:image"]').attr('content');
        
        let coverHtml = featuredImg ? 
            `<div style="text-align:center; margin-bottom:20px;">
                <img src="${featuredImg}" style="width:100%; max-height:500px; object-fit:cover; border-radius:15px;" />
            </div>` : "";

        // 2. تحديد حاوية المقال (البحث في عدة احتمالات)
        const selectors = ['article', '.article-content', '.entry-content', '.post-content', '.article-body', '#article-body', '.main-content'];
        let rawHtml = "";
        
        for (let s of selectors) {
            if ($(s).length > 0 && $(s).text().trim().length > 300) {
                rawHtml = $(s).html();
                break;
            }
        }

        if (!rawHtml) return null;

        const $article = cheerio.load(rawHtml);

        // 3. تنظيف المحتوى من الأوساخ البرمجية والإعلانات
        $article('script, style, iframe, ins, aside, nav, footer, .ad-unit, .newsletter, .social-share').remove();

        // 4. إصلاح الصور (تحويل data-src إلى src وإصلاح الروابط النسبية)
        $article('img').each((i, img) => {
            let src = $(img).attr('data-src') || $(img).attr('src');
            
            if (src && src.startsWith('/')) {
                const domain = new URL(url).origin;
                src = domain + src;
            }
            
            $(img).attr('src', src);
            $(img).attr('loading', 'lazy');
            $(img).css({
                'max-width': '100%',
                'height': 'auto',
                'border-radius': '8px',
                'margin': '15px 0'
            });
        });

        return coverHtml + $article.html();

    } catch (error) {
        console.error(`Error scraping ${url}:`, error.message);
        return null;
    }
}

/**
 * الدالة الرئيسية لتشغيل البوت
 */
async function runBloggerBot() {
    try {
        console.log("🚀 بدء عملية السحب...");
        const parser = new Parser();
        
        // اختيار مصدر عشوائي
        const targetRss = RSS_SOURCES[Math.floor(Math.random() * RSS_SOURCES.length)];
        const feed = await parser.parseURL(targetRss);
        
        // نأخذ أحدث خبر لم يُنشر (يمكنك تطويرها لتأخذ مصفوفة)
        const latestPost = feed.items[0];
        console.log(`📝 معالجة المقال: ${latestPost.title}`);

        const fullContent = await getFullArticle(latestPost.link);

        if (!fullContent || fullContent.length < 500) {
            console.log("⚠️ المحتوى المسحوب قصير جداً أو فارغ. إلغاء النشر.");
            return;
        }

        // إعداد اتصال Google Blogger
        const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET);
        oauth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });
        const blogger = google.blogger({ version: 'v3', auth: oauth2Client });

        const finalHtml = `
            <div dir="ltr" style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; text-align: left;">
                ${fullContent}
                <div style="margin-top: 30px; padding: 15px; background: #f9f9f9; border-left: 5px solid #007bff;">
                    <strong>Original Source:</strong> <a href="${latestPost.link}" target="_blank">${latestPost.title}</a>
                </div>
            </div>
        `;

        await blogger.posts.insert({
            blogId: BLOG_ID,
            requestBody: {
                title: latestPost.title,
                content: finalHtml,
                labels: ['Tech News', 'AutoUpdates', 'Global Trends'],
            },
            isDraft: false
        });

        console.log("✅ تم النشر بنجاح على بلوجر!");

    } catch (error) {
        console.error("❌ خطأ فادح:", error.message);
    }
}

runBloggerBot();
