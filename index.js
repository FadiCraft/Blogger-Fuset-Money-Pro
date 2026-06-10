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

// ===== الإعدادات العامة =====
const SETTINGS = {
    targetUrl: 'https://www.gsmarena.com/reviews.php3',
    baseUrl: 'https://www.gsmarena.com',
    stateFile: 'gsmarena_state.json',
    postsDir: 'posts_gsmarena',
    siteName: 'كيروزوزو',
    siteUrl: 'https://www.kirozozo.xyz/'
};

class AutoPublisher {
    constructor() {
        this.state = this.loadState();
    }

    loadState() {
        try {
            return fs.readJsonSync(SETTINGS.stateFile);
        } catch {
            return { 
                publishedArticles: []
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
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9,ar;q=0.8'
            },
            timeout: 15000
        });
        return res.data;
    }

    // ===== استخراج أحدث مقال من صفحة المراجعات =====
    async getLatestReview() {
        console.log('📥 جلب أحدث مراجعة من GSMArena...');
        const html = await this.fetchHtml(SETTINGS.targetUrl);
        const $ = cheerio.load(html);
        
        // البحث عن أول عنصر review-item (الأحدث)
        const firstReview = $('.review-item').first();
        
        if (!firstReview.length) {
            throw new Error('لم يتم العثور على أي مراجعة');
        }

        // استخراج رابط المقال
        let articleLink = firstReview.find('.review-item-title a').attr('href');
        if (articleLink && !articleLink.startsWith('http')) {
            articleLink = SETTINGS.baseUrl + '/' + articleLink;
        }

        // استخراج عنوان المقال
        const title = firstReview.find('.review-item-title a').text().trim();

        // استخراج الصورة المصغرة
        let thumbnail = firstReview.find('.review-item-media-wrap img').attr('src');
        if (thumbnail && !thumbnail.startsWith('http')) {
            thumbnail = 'https:' + thumbnail;
        }

        // استخراج التاريخ
        const date = firstReview.find('.meta-item-time').text().trim();

        // استخراج عدد التعليقات
        const comments = firstReview.find('.meta-item-comments').text().trim();

        return {
            title,
            link: articleLink,
            thumbnail,
            date,
            comments
        };
    }

    // ===== استخراج محتوى المقال =====
    async extractArticleContent(articleUrl) {
        console.log(`📄 استخراج محتوى المقال من: ${articleUrl}`);
        const html = await this.fetchHtml(articleUrl);
        const $ = cheerio.load(html);
        
        // استخراج نص المقال من div#review-body
        const reviewBody = $('#review-body');
        
        if (!reviewBody.length) {
            throw new Error('لم يتم العثور على محتوى المراجعة');
        }

        // تنظيف المحتوى - إزالة زر مقارنة الصور
        reviewBody.find('.multipic-select-images-button').remove();
        
        // الحصول على HTML النظيف
        let articleHtml = reviewBody.html();
        
        // تنظيف الصور - جعل الروابط كاملة
        const $content = cheerio.load(articleHtml);
        $content('img').each((i, img) => {
            let src = $(img).attr('src');
            if (src && !src.startsWith('http')) {
                $(img).attr('src', 'https:' + src);
            }
            // إضافة styling للصور
            $(img).css({
                'max-width': '100%',
                'height': 'auto',
                'border-radius': '8px',
                'margin': '20px 0'
            });
        });

        return $content.html();
    }

    // ===== استخراج المواصفات من المقال =====
    extractSpecs($) {
        const specs = [];
        const specsList = $('.article-blurb-findings li');
        
        specsList.each((i, li) => {
            specs.push($(li).html());
        });

        return specs.join('');
    }

    // ===== توليد HTML المنشور =====
    generatePostHtml(reviewInfo, articleContent) {
        return `<!DOCTYPE html>
<html dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${reviewInfo.title} - مراجعة شاملة</title>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <style>
    * { font-family: 'Cairo', sans-serif; margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #0a0a0a; color: #e0e0e0; padding: 20px; line-height: 1.8; }
    
    .article-container {
      max-width: 900px;
      margin: 0 auto;
      background: #111;
      border-radius: 15px;
      overflow: hidden;
      box-shadow: 0 10px 40px rgba(0,0,0,0.5);
    }
    
    .article-header {
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      padding: 40px;
      text-align: center;
      border-bottom: 3px solid #f5c518;
    }
    
    .article-header h1 {
      font-size: 36px;
      color: #f5c518;
      margin-bottom: 15px;
    }
    
    .article-meta {
      display: flex;
      justify-content: center;
      gap: 30px;
      flex-wrap: wrap;
      margin-top: 15px;
    }
    
    .meta-item {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #aaa;
      font-size: 14px;
    }
    
    .meta-item i {
      color: #f5c518;
    }
    
    .article-thumbnail {
      width: 100%;
      max-height: 400px;
      object-fit: cover;
    }
    
    .article-content {
      padding: 30px;
    }
    
    .article-content h3 {
      color: #f5c518;
      font-size: 24px;
      margin: 30px 0 15px 0;
      border-right: 4px solid #f5c518;
      padding-right: 15px;
    }
    
    .article-content p {
      margin-bottom: 15px;
      color: #ccc;
    }
    
    .article-content ul {
      background: #1a1a1a;
      padding: 20px 40px;
      border-radius: 10px;
      margin: 20px 0;
      list-style: none;
    }
    
    .article-content ul li {
      padding: 8px 0;
      border-bottom: 1px solid #2a2a2a;
    }
    
    .article-content ul li:last-child {
      border-bottom: none;
    }
    
    .article-content img {
      display: block;
      margin: 20px auto;
    }
    
    .site-footer {
      text-align: center;
      padding: 30px;
      background: #1a1a1a;
      border-top: 1px solid #333;
    }
    
    .site-footer a {
      display: inline-block;
      background: #f5c518;
      color: #000;
      padding: 12px 30px;
      border-radius: 8px;
      text-decoration: none;
      font-weight: bold;
      transition: transform 0.3s;
    }
    
    .site-footer a:hover {
      transform: translateY(-2px);
    }
    
    @media (max-width: 768px) {
      .article-header { padding: 25px; }
      .article-header h1 { font-size: 24px; }
      .article-content { padding: 20px; }
    }
  </style>
</head>
<body>
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": "${reviewInfo.title}",
    "description": "مراجعة شاملة ${reviewInfo.title} - المواصفات، المميزات، العيوب وكل ما تحتاج معرفته",
    "image": "${reviewInfo.thumbnail}",
    "datePublished": "${reviewInfo.date}",
    "publisher": {
      "@type": "Organization",
      "name": "${SETTINGS.siteName}",
      "url": "${SETTINGS.siteUrl}"
    },
    "author": {
      "@type": "Organization",
      "name": "${SETTINGS.siteName}"
    }
  }
  </script>

  <div class="article-container">
    <div class="article-header">
      <h1>📱 ${reviewInfo.title}</h1>
      <div class="article-meta">
        <span class="meta-item"><i class="far fa-calendar-alt"></i> ${reviewInfo.date}</span>
        <span class="meta-item"><i class="far fa-comments"></i> ${reviewInfo.comments} تعليق</span>
        <span class="meta-item"><i class="fas fa-tag"></i> مراجعة</span>
      </div>
    </div>
    
    ${reviewInfo.thumbnail ? `<img class="article-thumbnail" src="${reviewInfo.thumbnail}" alt="${reviewInfo.title}">` : ''}
    
    <div class="article-content">
      ${articleContent}
    </div>
    
    <div class="site-footer">
      <p style="color: #aaa; margin-bottom: 15px;">
        المصدر: <strong>GSMArena</strong> | النشر بواسطة ${SETTINGS.siteName}
      </p>
      <a href="${SETTINGS.siteUrl}" target="_blank">
        <i class="fas fa-external-link-alt"></i> زيارة موقع ${SETTINGS.siteName}
      </a>
    </div>
  </div>
</body>
</html>`;
    }

    // ===== الحصول على Access Token =====
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
            console.error('❌ فشل الحصول على access token:', error.response?.data || error.message);
            throw error;
        }
    }

    // ===== النشر على بلوجر =====
    async publishToBlogger(postTitle, postContent) {
        console.log(`📝 جاري نشر المقال على بلوجر...`);
        
        try {
            const accessToken = await this.getAccessToken();
            
            const postData = {
                kind: 'blogger#post',
                title: postTitle,
                content: postContent,
                labels: ['مراجعات', 'GSMArena', 'هواتف', 'تقنية']
            };

            const response = await axios.post(
                `https://www.googleapis.com/blogger/v3/blogs/${BLOGGER_CONFIG.blogId}/posts/`,
                postData,
                {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            console.log(`✅ تم النشر بنجاح: ${response.data.url}`);
            return { success: true, url: response.data.url, postId: response.data.id };
            
        } catch (error) {
            console.error('❌ فشل النشر على بلوجر:', error.response?.data || error.message);
            return { success: false, error: error.message };
        }
    }

    // ===== حفظ نسخة محلية =====
    async saveLocalBackup(title, content) {
        await fs.ensureDir(SETTINGS.postsDir);
        
        const date = new Date().toISOString().split('T')[0];
        const safeTitle = title.replace(/[^a-zA-Z0-9\u0600-\u06FF\s]/g, '').substring(0, 50);
        const fileName = `${SETTINGS.postsDir}/${date}_${safeTitle}.html`;
        
        await fs.writeFile(fileName, content);
        console.log(`💾 تم حفظ نسخة محلية: ${fileName}`);
        return fileName;
    }

    // ===== التشغيل الرئيسي =====
    async run() {
        console.log('\n' + '='.repeat(60));
        console.log('🚀 بدء نظام النشر من GSMArena');
        console.log('='.repeat(60));
        
        try {
            // 1. استخراج أحدث مقال
            const reviewInfo = await this.getLatestReview();
            
            console.log('\n📋 معلومات المقال:');
            console.log(`   العنوان: ${reviewInfo.title}`);
            console.log(`   الرابط: ${reviewInfo.link}`);
            console.log(`   التاريخ: ${reviewInfo.date}`);
            console.log(`   التعليقات: ${reviewInfo.comments}`);

            // 2. التحقق من أن المقال لم يُنشر مسبقاً
            if (this.state.publishedArticles.includes(reviewInfo.link)) {
                console.log('\n⚠️ هذا المقال تم نشره مسبقاً!');
                console.log(`   الرابط: ${reviewInfo.link}`);
                return;
            }

            // 3. استخراج محتوى المقال
            console.log('\n📄 جاري استخراج محتوى المقال...');
            const articleContent = await this.extractArticleContent(reviewInfo.link);
            console.log('✅ تم استخراج المحتوى بنجاح');

            // 4. توليد HTML المنشور
            console.log('\n🛠️ جاري توليد HTML المنشور...');
            const postHtml = this.generatePostHtml(reviewInfo, articleContent);
            console.log('✅ تم توليد HTML');

            // 5. حفظ نسخة محلية احتياطية
            await this.saveLocalBackup(reviewInfo.title, postHtml);

            // 6. النشر على بلوجر
            console.log('\n📤 جاري النشر على بلوجر...');
            const postTitle = `📱 ${reviewInfo.title} - مراجعة شاملة | ${reviewInfo.date}`;
            const publishResult = await this.publishToBlogger(postTitle, postHtml);

            // 7. تحديث الحالة
            if (publishResult.success) {
                this.state.publishedArticles.push(reviewInfo.link);
                this.saveState();
                
                console.log('\n' + '='.repeat(60));
                console.log('🎉 تم نشر المقال بنجاح!');
                console.log('='.repeat(60));
                console.log(`📌 العنوان: ${reviewInfo.title}`);
                console.log(`🔗 رابط المقال: ${publishResult.url}`);
                console.log(`📅 التاريخ: ${reviewInfo.date}`);
                console.log(`💬 التعليقات: ${reviewInfo.comments}`);
                console.log('='.repeat(60));
            } else {
                console.log('\n⚠️ تم حفظ نسخة محلية فقط. فشل النشر على بلوجر.');
            }

            console.log(`\n📊 إجمالي المقالات المنشورة: ${this.state.publishedArticles.length}`);

        } catch (error) {
            console.error('\n❌ خطأ في التشغيل:', error.message);
        }
    }
}

// ===== تشغيل التطبيق =====
console.log('📢 بدء تشغيل مستخرج مراجعات GSMArena');
new AutoPublisher().run();
