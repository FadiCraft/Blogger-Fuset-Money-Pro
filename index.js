
const Parser = require('rss-parser');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Jimp = require('jimp');
const { google } = require('googleapis');

// 1. جلب المتغيرات السرية من بيئة GitHub
const GEMINI_API_KEY ="AIzaSyD4d7EKm0gNpBqRoLxTfzzS-hzs1JugCl0";
const BLOG_ID = "8249860422330426533";
const CLIENT_ID = "872415365656-7qribadnc7k2u21kl6jjcbatdueevifh.apps.googleusercontent.com";
const CLIENT_SECRET = "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";
const REFRESH_TOKEN ="1//04yti9k2agPknCgYIARAAGAQSNwF-L9IrTZPKt5Fqbg2vrM9sBtOks9cnY4M7Idg0LToQnlbYGME06k20vcyr_SVmYk1H_yZJdEc";

// إعداد الذكاء الاصطناعي
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// رابط RSS (مثال: أخبار الألعاب من IGN)
const RSS_FEED_URL = 'https://feeds.feedburner.com/ign/games-all';

async function processAndPublish() {
    try {
        console.log('1. جاري سحب أحدث الأخبار...');
        const parser = new Parser();
        const feed = await parser.parseURL(RSS_FEED_URL);
        const latestArticle = feed.items[0]; 

        console.log('2. جاري صياغة المقال باستخدام الذكاء الاصطناعي...');
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = `
        أنت خبير SEO ومدون محترف. قم بإعادة صياغة النص التالي ليكون مقالاً حصرياً.
        اجعل المقال بصيغة "أسئلة وأجوبة شائعة" (People Also Ask) لتتصدر نتائج بحث جوجل.
        استخدم لغة احترافية وجذابة.
        النص الأصلي: ${latestArticle.title} - ${latestArticle.contentSnippet}
        `;
        const result = await model.generateContent(prompt);
        const rewrittenContent = result.response.text();

        console.log('3. جاري المصادقة مع حساب جوجل (OAuth2)...');
        // إعداد OAuth2 باستخدام بياناتك
        const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET);
        
        // استخدام الـ Refresh Token للحصول على صلاحية جديدة تلقائياً
        oauth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });
        
        const blogger = google.blogger({ version: 'v3', auth: oauth2Client });

        console.log('4. جاري النشر على مدونة بلوجر...');
        const postData = {
            kind: 'blogger#post',
            blogId: BLOG_ID,
            title: `سؤال وجواب: ${latestArticle.title}`, // العنوان
            content: `${rewrittenContent} <br><hr><p><i>المصدر الأصلي للخبر: تم التحديث آلياً</i></p>`,
            labels: ['أخبار الألعاب', 'أسئلة شائعة']
        };

        const response = await blogger.posts.insert({
            blogId: BLOG_ID,
            requestBody: postData,
            isDraft: false // يتم النشر مباشرة للجمهور
        });

        console.log(`تم النشر بنجاح! الرابط: ${response.data.url}`);

    } catch (error) {
        console.error('حدث خطأ:', error);
    }
}

processAndPublish();
