const Parser = require('rss-parser');
const axios = require('axios');
const cheerio = require('cheerio');
const { google } = require('googleapis');
const Jimp = require('jimp');

// إعداد الثوابت (المعلومات التي زودتني بها)
const BLOG_ID = "8249860422330426533";
const CLIENT_ID = "872415365656-7qribadnc7k2u21kl6jjcbatdueevifh.apps.googleusercontent.com";
const CLIENT_SECRET = "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";
const REFRESH_TOKEN ="1//04yti9k2agPknCgYIARAAGAQSNwF-L9IrTZPKt5Fqbg2vrM9sBtOks9cnY4M7Idg0LToQnlbYGME06k20vcyr_SVmYk1H_yZJdEc";

// قائمة 40 مصدر RSS متنوع (تقنية، ألعاب، علوم، ذكاء اصطناعي)
const RSS_SOURCES = [
    'https://www.makeuseof.com/feed/',
    'https://fossbytes.com/feed/',
    'https://www.siliconera.com/feed/',
    'https://phys.org/rss-feed/',
    'https://gadgetstouse.com/feed/',
    'https://www.howtogeek.com/feed/',
    'https://www.guidingtech.com/feed/',
    'https://www.techradar.com/rss',
    'https://www.cnet.com/rss/news/',
    'https://www.digitaltrends.com/feed/',
    'https://thenextweb.com/feed',
    'https://www.bleepingcomputer.com/feed/',
    'https://www.artificialintelligence-news.com/feed/',
    'https://www.unite.ai/feed/',
    'https://futurism.com/feed',
    'https://www.eurogamer.net/feed',
    'https://www.gamespot.com/feeds/content/',
    'https://www.pcgamesn.com/mainrss.xml',
    'https://kotaku.com/rss',
    'https://www.destructoid.com/feed/',
    'https://www.gematsu.com/feed',
    'https://www.droidgamers.com/feed/',
    'https://toucharcade.com/feed/',
    'https://www.vg247.com/feed',
    'https://www.sciencedaily.com/rss/all.xml',
    'https://newatlas.com/index.rss',
    'https://www.wired.com/feed/rss',
    'https://lifehacker.com/rss',
    'https://www.entrepreneur.com/latest.rss',
    'https://addicted2success.com/feed/',
    'https://www.psychologytoday.com/intl/front/feed',
    'https://www.healthline.com/rss',
    'https://www.treehugger.com/rss',
    'https://www.nationalgeographic.com/rss/index.xml',
    'https://betanews.com/feed/',
    'https://www.theverge.com/rss/index.xml',
    'https://www.slashgear.com/feed/',
    'https://machinelearningmastery.com/feed/',
    'https://inside.com/ai/feed',
    'https://moneyish.com/feed/'
];

/**
 * دالة لتعديل الصورة (إضافة فلتر وعلامة مائية) لجعلها حصرية
 */
async function processImage(imageUrl) {
    try {
        const image = await Jimp.read(imageUrl);
        
        // 1. إضافة فلتر بسيط (تعديل السطوع والتباين)
        image.brightness(0.05).contrast(0.1);
        
        // 2. إضافة نص كعلامة مائية (Watermark)
        const font = await Jimp.loadFont(Jimp.FONT_SANS_16_WHITE);
        image.print(font, 20, image.getHeight() - 40, "EXCLUSIVELY UPDATED");

        // 3. تحويل الصورة إلى Base64 ليتم تضمينها في بلوجر مباشرة
        return await image.getBase64Async(Jimp.MIME_JPEG);
    } catch (e) {
        console.log("⚠️ تعذر تعديل الصورة، سيتم استخدام الرابط الأصلي.");
        return imageUrl;
    }
}

/**
 * دالة استخراج الكلمات المفتاحية (Labels) ديناميكياً
 */
function extractDynamicLabels(title, content) {
    const stopWords = ['the', 'and', 'this', 'that', 'with', 'from', 'news', 'tech', 'video'];
    const combined = (title + " " + content).toLowerCase().replace(/[^\w\s]/g, '');
    const words = combined.split(/\s+/);
    
    // تصفية الكلمات الطويلة (أكثر من 5 أحرف) وغير الموجودة في قائمة الكلمات الشائعة
    const tags = words.filter(word => word.length > 5 && !stopWords.includes(word));
    return [...new Set(tags)].slice(0, 5); // إرجاع أفضل 5 كلمات فريدة
}

/**
 * دالة سحب المحتوى الكامل
 */
async function getFullArticle(url) {
    try {
        const response = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
            timeout: 20000
        });

        const $ = cheerio.load(response.data);

        // جلب ومعالجة الصورة الرئيسية
        let featuredImg = $('meta[property="og:image"]').attr('content') || $('meta[name="twitter:image"]').attr('content');
        let processedImg = featuredImg ? await processImage(featuredImg) : null;
        
        let coverHtml = processedImg ? 
            `<div style="text-align:center; margin-bottom:20px;">
                <img src="${processedImg}" style="width:100%; max-height:500px; object-fit:cover; border-radius:15px;" />
            </div>` : "";

        // تحديد المحتوى
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
        $article('script, style, iframe, ins, aside, nav, footer, .ad-unit, .newsletter, .social-share').remove();

        $article('img').each((i, img) => {
            let src = $(img).attr('data-src') || $(img).attr('src');
            if (src && src.startsWith('/')) src = new URL(url).origin + src;
            $(img).attr('src', src).css({'max-width': '100%', 'height': 'auto', 'border-radius': '8px'});
        });

        return {
            content: coverHtml + $article.html(),
            textContent: $article.text()
        };

    } catch (error) {
        console.error(`❌ خطأ في سحب ${url}:`, error.message);
        return null;
    }
}

/**
 * تشغيل البوت
 */
async function runBloggerBot() {
    try {
        console.log("🚀 جاري بدء المحرك...");
        const parser = new Parser();
        
        // اختيار مصدر عشوائي من الـ 40 مصدر
        const targetRss = RSS_SOURCES[Math.floor(Math.random() * RSS_SOURCES.length)];
        const feed = await parser.parseURL(targetRss);
        const latestPost = feed.items[0];

        console.log(`📝 سحب مقال: ${latestPost.title}`);

        const articleData = await getFullArticle(latestPost.link);

        if (!articleData || articleData.content.length < 500) {
            console.log("⏭️ محتوى ضعيف، يتم التجاوز...");
            return;
        }

        // استخراج تاجات ديناميكية
        const dynamicLabels = extractDynamicLabels(latestPost.title, articleData.textContent);

        const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET);
        oauth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });
        const blogger = google.blogger({ version: 'v3', auth: oauth2Client });

        const finalHtml = `
            <div dir="ltr" style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; text-align: left;">
                ${articleData.content}
                <div style="margin-top: 30px; padding: 15px; background: #f9f9f9; border-left: 5px solid #007bff;">
                    <strong>Credits:</strong> <a href="${latestPost.link}" target="_blank">${latestPost.title}</a>
                </div>
            </div>
        `;

        await blogger.posts.insert({
            blogId: BLOG_ID,
            requestBody: {
                title: latestPost.title,
                content: finalHtml,
                labels: dynamicLabels, // الكلمات المفتاحية الديناميكية هنا
            },
            isDraft: false
        });

        console.log("✅ تم النشر بنجاح مع صورة حصرية وتاجات ديناميكية!");

    } catch (error) {
        console.error("❌ خطأ فادح:", error.message);
    }
}

runBloggerBot();
