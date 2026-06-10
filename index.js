const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs-extra');

// ===== إعدادات Blogger =====
const BLOGGER_CONFIG = {
    blogId: '2725115584838237159',
    clientId: '1022254688087-6bj9eij12uuh5u2apm300hg0rl3v3u5i.apps.googleusercontent.com',
    clientSecret: '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',
    refreshToken: '1//04npcWG7RN3UwCgYIARAAGAQSNwF-L9IrrQTVgQCZ0m7WdslFX1lpUIZRy3ODYu70BImi5mYfMUQ8RvKaIPyi3Uhu7esth8aeVro'
};

// ===== الإعدادات العامة الجديدة للتقنية =====
const SETTINGS = {
    targetUrl: 'https://www.gsmarena.com/reviews.php3',
    baseUrl: 'https://www.gsmarena.com',
    stateFile: 'state.json', // تم إرجاعه لـ state.json ليطابق ملف الـ YAML في الجيت هاب
    siteName: 'KiroZozo Tech',
    siteUrl: 'https://www.kirozozo.xyz/'
};

class TechPublisher {
    constructor() {
        this.state = this.loadState();
    }

    loadState() {
        try {
            return fs.readJsonSync(SETTINGS.stateFile);
        } catch {
            return { 
                published: [], 
                lastDate: null, 
                totalPublished: 0
            };
        }
    }

    saveState() {
        fs.writeJsonSync(SETTINGS.stateFile, this.state, { spaces: 2 });
    }

    async fetchHtml(url) {
        const res = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5'
            },
            timeout: 15000
        });
        return res.data;
    }

    // دالة استخراج محتوى المقال الداخلي بالكامل (نصوص وصور ومواصفات)
    async extractArticleBody(articleUrl) {
        try {
            console.log(`🔍 Fetching article details from: ${articleUrl}`);
            const html = await this.fetchHtml(articleUrl);
            const $ = cheerio.load(html);
            
            const $body = $('#review-body');
            if (!$body.length) return null;

            // تنظيف العناصر غير المرغوبة داخل المقال مثل أزرار المقارنة التلقائية
            $body.find('.multipic-select-images-button, script, .ad-container, .comments-link').remove();

            // إصلاح روابط الصور الداخلية وتعديل الخصائص بشكل صحيح
            $body.find('img').each((i, img) => {
                let src = $(img).attr('src');
                if (src && !src.startsWith('http')) {
                    if (src.startsWith('//')) {
                        $(img).attr('src', 'https:' + src);
                    } else {
                        $(img).attr('src', SETTINGS.baseUrl + (src.startsWith('/') ? src : '/' + src));
                    }
                }
                
                // التعديل الصحيح والمضمون هنا لعدم حدوث توقف في مكتبة Cheerio
                $(img).addClass('article-inline-img');
                $(img).removeAttr('width');
                $(img).removeAttr('height');
            });

            return $body.html().trim();
        } catch (error) {
            console.error('❌ Failed to extract article body:', error.message);
            return null;
        }
    }

    async getLatestUnpublishedArticle() {
        console.log('📥 Fetching tech reviews from GSMArena...');
        const html = await this.fetchHtml(SETTINGS.targetUrl);
        const $ = cheerio.load(html);
        const articles = [];

        $('.review-item').each((i, el) => {
            const $el = $(el);
            let link = $el.find('.review-item-title a').attr('href');
            if (link && !link.startsWith('http')) {
                link = SETTINGS.baseUrl + (link.startsWith('/') ? link : '/' + link);
            }

            let title = $el.find('.review-item-title').text().trim();
            let image = $el.find('.review-item-media-wrap img').attr('src');
            let date = $el.find('.meta-item-time').text().trim();

            if (title && link) {
                articles.push({ title, link, image, date });
            }
        });

        // تصفية المقالات لاستخراج غير المنشور فقط
        const unpublished = articles.filter(art => !this.state.published.includes(art.link));
        console.log(`📊 Found ${articles.length} articles, ${unpublished.length} are new.`);
        
        // إرجاع أول مقال جديد (الأحدث زمنيّاً)
        return unpublished.length > 0 ? unpublished[0] : null;
    }

    generatePostHtml(article, bodyHtml) {
        return `<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&family=Playfair+Display:wght@700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <style>
    :root { --primary: #333333; --accent: #ffaa00; --bg: #ffffff; --text: #111111; --gray: #f5f5f7; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Roboto', sans-serif; color: var(--text); background: #fafafa; line-height: 1.8; padding: 20px; }
    
    .article-container { max-width: 840px; margin: 0 auto; background: var(--bg); padding: 40px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.05); }
    
    .article-header { margin-bottom: 30px; border-bottom: 2px solid var(--gray); padding-bottom: 20px; }
    .article-title { font-family: 'Playfair Display', serif; font-size: 38px; color: var(--primary); line-height: 1.3; margin-bottom: 15px; }
    
    .meta-box { display: flex; gap: 20px; font-size: 14px; color: #666; align-items: center; }
    .meta-box i { color: var(--accent); }
    
    .main-cover { width: 100%; border-radius: 8px; margin-bottom: 30px; object-fit: cover; max-height: 400px; }
    
    /* تنسيق محتوى المقال المستخرج */
    .review-body { font-size: 17px; color: #333; }
    .review-body h3 { font-family: 'Playfair Display', serif; font-size: 26px; color: var(--primary); margin: 35px 0 15px 0; border-left: 4px solid var(--accent); padding-left: 12px; }
    .review-body p { margin-bottom: 22px; text-align: justify; }
    
    /* تنسيق الصور الداخلية المجلوبة */
    .article-inline-img { display: block; max-width: 100%; height: auto; margin: 30px auto; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.08); }
    
    /* تنسيق قائمة المواصفات التقنية المميزة من GSMArena */
    .article-blurb-findings { background: var(--gray); padding: 25px; border-radius: 8px; list-style: none; margin: 25px 0; border-top: 3px solid var(--primary); }
    .article-blurb-findings li { margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid #e5e5e7; font-size: 15px; }
    .article-blurb-findings li:last-child { margin-bottom: 0; padding-bottom: 0; border-bottom: none; }
    .article-blurb-findings b { color: var(--primary); font-weight: 700; display: inline-block; min-width: 120px; }
    
    .visit-btn { display: inline-flex; align-items: center; gap: 10px; background: var(--primary); color: white; padding: 12px 25px; border-radius: 6px; text-decoration: none; font-weight: 500; margin-top: 30px; transition: background 0.3s; }
    .visit-btn:hover { background: #000000; }
    
    @media (max-width: 768px) { .article-container { padding: 20px; } .article-title { font-size: 28px; } }
  </style>
</head>
<body>

  <div class="article-container">
    <div class="article-header">
      <h1 class="article-title">${article.title}</h1>
      <div class="meta-box">
        <div><i class="far fa-calendar-alt"></i> ${article.date || 'Recent'}</div>
        <div><i class="fas fa-microchip"></i> Tech Review</div>
        <div><i class="fas fa-globe"></i> Via ${SETTINGS.siteName}</div>
      </div>
    </div>

    ${article.image ? `<img class="main-cover" src="${article.image}" alt="${article.title}">` : ''}

    <div class="review-body">
      ${bodyHtml}
    </div>

    <center>
       <a href="${SETTINGS.siteUrl}" target="_blank" class="visit-btn">
         <i class="fas fa-bolt"></i> Discover More on ${SETTINGS.siteName}
       </a>
    </center>
  </div>

</body>
</html>`;
    }

    async getAccessToken() {
        try {
            const response = await axios.post('https://oauth2.googleapis.com/token', {
                client_id: BLOGGER_CONFIG.clientId,
                client_secret: BLOGGER_CONFIG.clientSecret,
                refresh_token: BLOGGER_CONFIG.refreshToken,
                grant_type: 'refresh_token'
            });
            return response.data.access_token;
        } catch (error) {
            throw new Error('OAuth Token Refresh Failed');
        }
    }

    async publishToBlogger(article, postContent) {
        try {
            const accessToken = await this.getAccessToken();
            const postData = {
                kind: 'blogger#post',
                title: `🔥 ${article.title}`,
                content: postContent,
                labels: ['Tech Reviews', 'Gadgets', 'GSMArena', 'Smartphones']
            };

            const response = await axios.post(
                `https://www.googleapis.com/blogger/v3/blogs/${BLOGGER_CONFIG.blogId}/posts/`,
                postData,
                { headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' } }
            );

            return { success: true, url: response.data.url };
        } catch (error) {
            console.error('❌ Blogger API Error:', error.response?.data || error.message);
            return { success: false, error: error.message };
        }
    }

    async run() {
        console.log('\n🚀 Starting Tech Auto-Publisher Engine...');
        try {
            // 1. جلب المقال الأحدث غير المنشور
            const article = await this.getLatestUnpublishedArticle();
            
            if (!article) {
                console.log('✨ No new tech articles found! Everything is up to date.');
                return;
            }

            console.log(`🎯 New Article Detected: "${article.title}"`);

            // 2. استخراج كامل محتوى المقال
            const bodyHtml = await this.extractArticleBody(article.link);
            if (!bodyHtml) {
                console.log('⚠️ Could not extract content for this article. Skipping...');
                return;
            }

            // 3. بناء قالب HTML المتوافق مع المحتوى الإنجليزي والأجهزة
            const finalHtml = this.generatePostHtml(article, bodyHtml);

            // 4. النشر على بلوجر لقيد مقال واحد
            console.log('📤 Uploading to Blogger...');
            const result = await this.publishToBlogger(article, finalHtml);

            if (result.success) {
                console.log(`✅ Success! Published to: ${result.url}`);
                
                // حفظ الرابط لمنع التكرار نهائياً
                this.state.published.push(article.link);
                this.state.lastDate = new Date().toISOString();
                this.state.totalPublished += 1;
                this.saveState();
            } else {
                console.log('❌ Failed to publish article to Blogger.');
            }

        } catch (error) {
            console.error('❌ Critical Error during execution:', error.message);
        }
    }
}

// تشغيل محرك النشر
new TechPublisher().run();
