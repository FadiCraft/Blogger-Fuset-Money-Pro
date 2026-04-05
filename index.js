const Parser = require('rss-parser');
const axios = require('axios');
const cheerio = require('cheerio');
const { google } = require('googleapis');

// إحضار المفاتيح من بيئة جيتهاب السرية
const BLOG_ID = "8249860422330426533";
const CLIENT_ID = "872415365656-7qribadnc7k2u21kl6jjcbatdueevifh.apps.googleusercontent.com";
const CLIENT_SECRET = "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";
const REFRESH_TOKEN ="1//04yti9k2agPknCgYIARAAGAQSNwF-L9IrTZPKt5Fqbg2vrM9sBtOks9cnY4M7Idg0LToQnlbYGME06k20vcyr_SVmYk1H_yZJdEc";


// قائمة المصادر (يمكنك إضافة أي رابط RSS هنا)
const RSS_FEEDS = [
    'https://www.techcrunch.com/feed/',
    'https://www.theverge.com/rss/index.xml',
    'https://feeds.feedburner.com/ign/games-all'
];

async function getFullContent(url) {
    try {
        // محاكاة متصفح حقيقي لتجنب الحظر
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            timeout: 10000
        });

        const $ = cheerio.load(response.data);

        // محاولة إيجاد حاوية المقال (تختلف من موقع لآخر)
        // يبحث عن أشهر الكلاسات التي تستخدمها المواقع العالمية للمقال
        let articleHtml = $('article').html() || 
                          $('.entry-content').html() || 
                          $('.post-content').html() || 
                          $('.article-body').html();

        if (!articleHtml) return null;

        // تنظيف المحتوى من الإعلانات والسكريبتات المزعجة
        const $cleaner = cheerio.load(articleHtml);
        $cleaner('script, ins, iframe, style, ads, nav, footer').remove();
        
        return $cleaner.html();
    } catch (error) {
        console.error(`خطأ أثناء سحب الرابط ${url}:`, error.message);
        return null;
    }
}

async function startBot() {
    try {
        const parser = new Parser();
        const randomFeed = RSS_FEEDS[Math.floor(Math.random() * RSS_FEEDS.length)];
        console.log(`1. السحب من مصدر: ${randomFeed}`);

        const feed = await parser.parseURL(randomFeed);
        const item = feed.items[0]; // جلب أحدث خبر

        if (!item) return;
        console.log(`2. الخبر المكتشف: ${item.title}`);

        const fullBody = await getFullContent(item.link);
        if (!fullBody) {
            console.log("لم يتم العثور على محتوى كامل، سيتم إلغاء النشر لهذه المرة.");
            return;
        }

        // إعداد اتصال بلوجر (OAuth2)
        const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET);
        oauth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });
        const blogger = google.blogger({ version: 'v3', auth: oauth2Client });

        const finalHtml = `
            <div dir="ltr" style="text-align: left; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
                ${fullBody}
                <hr/>
                <p style="background: #eee; padding: 10px;">
                    <strong>Source:</strong> <a href="${item.link}" target="_blank">${item.title}</a>
                </p>
            </div>
        `;

        console.log('3. جاري النشر على بلوجر...');
        await blogger.posts.insert({
            blogId: BLOG_ID,
            requestBody: {
                title: item.title,
                content: finalHtml,
                labels: ['Auto-Post', 'Tech News', 'Games'],
            },
            isDraft: false
        });

        console.log('✅ تم النشر بنجاح!');
    } catch (error) {
        console.error('❌ خطأ في النظام:', error.message);
    }
}

startBot();
