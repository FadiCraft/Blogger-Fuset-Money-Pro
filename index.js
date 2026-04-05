const Parser = require('rss-parser');
const { google } = require('googleapis');

// جلب المتغيرات من GitHub Secrets
const BLOG_ID = "8249860422330426533";
const CLIENT_ID = "872415365656-7qribadnc7k2u21kl6jjcbatdueevifh.apps.googleusercontent.com";
const CLIENT_SECRET = "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";
const REFRESH_TOKEN ="1//04yti9k2agPknCgYIARAAGAQSNwF-L9IrTZPKt5Fqbg2vrM9sBtOks9cnY4M7Idg0LToQnlbYGME06k20vcyr_SVmYk1H_yZJdEc";



// روابط RSS لمواقع تقنية وألعاب (يمكنك إضافة المزيد في المصفوفة)
const FEEDS = [
    'https://www.techcrunch.com/feed/',
    'https://feeds.feedburner.com/ign/games-all'
];

async function startAutoBlogger() {
    try {
        const parser = new Parser();
        
        // اختيار رابط عشوائي من القائمة لتنويع المحتوى
        const randomFeed = FEEDS[Math.floor(Math.random() * FEEDS.length)];
        console.log(`1. جاري السحب من: ${randomFeed}`);
        
        const feed = await parser.parseURL(randomFeed);
        const item = feed.items[0]; // نأخذ أحدث منشور

        if (!item) throw new Error("لم يتم العثور على محتوى في الـ RSS");

        console.log(`2. تم تجهيز المقال: ${item.title}`);

        // إعداد المصادقة مع بلوجر
        const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET);
        oauth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });
        const blogger = google.blogger({ version: 'v3', auth: oauth2Client });

        // تجهيز محتوى المقال مع رابط المصدر
        const htmlContent = `
            <div dir="rtl" style="text-align: right; font-family: Arial, sans-serif;">
                <p>${item.contentSnippet || item.content || "تفاصيل الخبر تجدونها في الرابط أدناه..."}</p>
                <br/>
                <div style="background: #f1f1f1; padding: 15px; border-right: 5px solid #2196F3;">
                    <strong>المصدر الأصلي:</strong> 
                    <a href="${item.link}" target="_blank" rel="nofollow">${item.title}</a>
                </div>
                <br/>
                <p>تابعونا للمزيد من التحديثات اليومية حول التقنية والألعاب.</p>
            </div>
        `;

        console.log('3. جاري النشر على بلوجر...');
        await blogger.posts.insert({
            blogId: BLOG_ID,
            requestBody: {
                title: item.title,
                content: htmlContent,
                labels: ['أخبار تقنية', 'تحديثات عاجلة'],
            },
            isDraft: false
        });

        console.log('✅ تم النشر بنجاح!');

    } catch (error) {
        console.error('❌ خطأ في النظام:', error.message);
    }
}

startAutoBlogger();
