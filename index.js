const Parser = require('rss-parser');
const axios = require('axios');
const cheerio = require('cheerio');
const { google } = require('googleapis');

const BLOG_ID = "8249860422330426533";
const CLIENT_ID = "872415365656-7qribadnc7k2u21kl6jjcbatdueevifh.apps.googleusercontent.com";
const CLIENT_SECRET = "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";
const REFRESH_TOKEN ="1//04yti9k2agPknCgYIARAAGAQSNwF-L9IrTZPKt5Fqbg2vrM9sBtOks9cnY4M7Idg0LToQnlbYGME06k20vcyr_SVmYk1H_yZJdEc";


const RSS_FEED_URL = 'https://www.techcrunch.com/feed/'; // مثال لموقع محتواه غني

async function fetchFullContent(url) {
    try {
        const { data } = await axios.get(url);
        const $ = cheerio.load(data);

        // هنا نحدد "الحاوية" التي تضم المقال. تختلف من موقع لآخر
        // في معظم المواقع تكون داخل وسم <article> أو div بكلاس معين
        let fullHtml = $('.entry-content').html() || $('article').html() || $('.post-content').html();

        if (!fullHtml) return "تعذر سحب المحتوى الكامل، يرجى زيارة المصدر.";

        // تنظيف المحتوى من الإعلانات أو السكريبتات لضمان سلامة مدونتك
        const $cleaner = cheerio.load(fullHtml);
        $cleaner('script, ins, iframe, ads').remove(); 
        
        return $cleaner.html();
    } catch (error) {
        console.error("خطأ في سحب المحتوى الكامل:", error.message);
        return null;
    }
}

async function startAutoBlogger() {
    try {
        const parser = new Parser();
        const feed = await parser.parseURL(RSS_FEED_URL);
        const item = feed.items[0]; 

        console.log(`1. تم العثور على خبر: ${item.title}`);
        
        // سحب المحتوى الكامل من رابط المقال
        const fullBody = await fetchFullContent(item.link);

        if (!fullBody) return;

        // إعداد المصادقة مع بلوجر
        const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET);
        oauth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });
        const blogger = google.blogger({ version: 'v3', auth: oauth2Client });

        const htmlFinal = `
            <div dir="rtl" style="text-align: right;">
                ${fullBody}
                <hr/>
                <p>المصدر الأصلي: <a href="${item.link}">${item.title}</a></p>
            </div>
        `;

        console.log('2. جاري النشر على بلوجر...');
        await blogger.posts.insert({
            blogId: BLOG_ID,
            requestBody: {
                title: item.title,
                content: htmlFinal,
                labels: ['أخبار تقنية', 'محتوى كامل'],
            },
            isDraft: false
        });

        console.log('✅ تم بنجاح! المقال الآن متاح بالكامل مع صوره.');

    } catch (error) {
        console.error('❌ خطأ:', error.message);
    }
}

startAutoBlogger();
