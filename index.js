const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { JSDOM } = require('jsdom');
const { Readability } = require('@mozilla/readability');
const axios = require('axios');

puppeteer.use(StealthPlugin());

// --- إعدادات الأقسام والمصادر ---
const CONFIG = {
    sections: [
        {
            name: "Android",
            url: "https://www.androidpolice.com/category/news/",
            linkSelector: "h2 a", // كلاس العناوين في أندرويد بوليس
        },
        {
            name: "Make Money",
            url: "https://www.savethestudent.org/make-money",
            linkSelector: ".post-listing h3 a",
        },
        {
            name: "Gaming",
            url: "https://www.ign.com/news",
            linkSelector: "a.recirc-content-link",
        }
    ],
    waitBetweenSections: 5000, // 5 ثواني
};

// --- دالة محاكاة النشر (يمكنك ربطها بـ WordPress API هنا) ---
async function publishPost(section, data) {
    console.log(`\n✅ تم النشر بنجاح في قسم: ${section}`);
    console.log(`📌 العنوان الجديد: ${data.aiTitle}`);
    console.log(`🖼️ رابط الصورة: ${data.image}`);
    console.log(`📝 عدد الكلمات: ${data.content.split(' ').length}`);
    console.log(`----------------------------------------`);
}

// --- دالة سحب الروابط من الصفحة الرئيسية ---
async function getArticleLinks(page, url, selector) {
    try {
        await page.goto(url, { waitUntil: 'networkidle2' });
        const links = await page.evaluate((sel) => {
            return Array.from(document.querySelectorAll(sel))
                .map(a => a.href)
                .slice(0, 5); // سحب أول 5 مقالات فقط للتجربة
        }, selector);
        return links;
    } catch (e) {
        console.log(`❌ خطأ في سحب روابط من ${url}: ${e.message}`);
        return [];
    }
}

// --- دالة سحب المحتوى والصورة من المقال ---
async function extractArticleData(page, url) {
    try {
        await page.goto(url, { waitUntil: 'networkidle2' });
        
        // استخراج الصورة البارزة (نبحث عن og:image أولاً)
        const imageData = await page.evaluate(() => {
            const ogImg = document.querySelector('meta[property="og:image"]');
            if (ogImg) return ogImg.content;
            const mainImg = document.querySelector('article img');
            return mainImg ? mainImg.src : null;
        });

        // الحصول على الـ HTML لكامل الصفحة
        const html = await page.content();
        const dom = new JSDOM(html, { url });
        const reader = new Readability(dom.window.document);
        const article = reader.parse();

        if (article && article.textContent.length > 400) {
            return {
                title: article.title,
                content: article.textContent,
                image: imageData,
                url: url
            };
        }
    } catch (e) {
        console.log(`⚠️ فشل سحب المقال ${url}: ${e.message}`);
    }
    return null;
}

// --- المحرك الرئيسي للبوت ---
async function startEmpireBot() {
    console.log("🚀 Starting the SEO Empire Bot 2026...");
    const browser = await puppeteer.launch({ 
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    for (const section of CONFIG.sections) {
        console.log(`\n========================================`);
        console.log(`📂 جاري معالجة قسم: ${section.name}`);
        console.log(`========================================`);

        const links = await getArticleLinks(page, section.url, section.linkSelector);
        
        if (links.length === 0) {
            console.log(`⚠️ لم يتم العثور على روابط في ${section.name}`);
            continue;
        }

        for (const link of links) {
            console.log(`📡 فحص الخبر: ${link}`);
            const data = await extractArticleData(page, link);

            if (data && data.image) {
                console.log(`🧠 جاري صياغة المحتوى باستخدام الذكاء الاصطناعي...`);
                
                // هنا نضع اسم المقال الجديد (محاكاة لرد AI)
                data.aiTitle = "New: " + data.title; 
                
                await publishPost(section.name, data);
            } else {
                console.log(`⏭️ محتوى غير كافٍ أو لا توجد صورة، تخطي...`);
            }
        }

        await new Promise(r => setTimeout(r, CONFIG.waitBetweenSections));
    }

    await browser.close();
    console.log("🎉 اكتملت الدورة بنجاح!");
}

startEmpireBot();
