const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs-extra');

// ===== إعدادات Blogger =====
const BLOGGER_CONFIG = {
    blogId: '2905417967444176859',
    clientId: '1022254688087-e0eck5t7mnqj9fvkkojvi5cssah6f8i0.apps.googleusercontent.com',
    clientSecret: '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',
    refreshToken: '1//04AdT93Pf69USCgYIARAAGAQSNwF-L9IrvHIOqCdQGiroS8xHJFEdbZBwRjpQ5ozid8VFW8ZmBDlyVexCcJQQ8MJcOrSRp_mjOBA'
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
            if (fs.existsSync(SETTINGS.stateFile)) {
                return fs.readJsonSync(SETTINGS.stateFile);
            }
        } catch (error) {
            console.log('⚠️ ملف الحالة تالف، إنشاء ملف جديد...');
        }
        return { publishedArticles: [] };
    }

    saveState() {
        try {
            fs.writeJsonSync(SETTINGS.stateFile, this.state, { spaces: 2 });
            console.log('💾 تم حفظ الحالة بنجاح');
        } catch (error) {
            console.error('❌ فشل حفظ الحالة:', error.message);
        }
    }

    async fetchHtml(url) {
        try {
            const res = await axios.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9,ar;q=0.8'
                },
                timeout: 15000
            });
            return res.data;
        } catch (error) {
            console.error('❌ فشل جلب الصفحة:', error.message);
            throw error;
        }
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

        console.log(`✅ تم العثور على مقال: ${title}`);

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

        // نسخ المحتوى
        const contentClone = reviewBody.clone();
        
        // إزالة العناصر غير المرغوب فيها
        contentClone.find('.multipic-select-images-button').remove();
        contentClone.find('script').remove();
        contentClone.find('style').remove();
        
        // معالجة الصور - جعل الروابط كاملة وإضافة تنسيق
        contentClone.find('img').each((i, img) => {
            const $img = $(img);
            let src = $img.attr('src');
            if (src) {
                if (src.startsWith('//')) {
                    src = 'https:' + src;
                } else if (!src.startsWith('http')) {
                    src = 'https://' + src;
                }
                $img.attr('src', src);
                $img.attr('loading', 'lazy');
                $img.css({
                    'max-width': '100%',
                    'height': 'auto',
                    'border-radius': '8px',
                    'margin': '20px auto',
                    'display': 'block'
                });
            }
        });

        // معالجة القوائم
        contentClone.find('ul').css({
            'background': '#1a1a1a',
            'padding': '20px 40px',
            'border-radius': '10px',
            'margin': '20px 0',
            'list-style': 'none'
        });

        contentClone.find('ul li').css({
            'padding': '8px 0',
            'border-bottom': '1px solid #2a2a2a'
        });

        // معالجة العناوين
        contentClone.find('h3').css({
            'color': '#f5c518',
            'font-size': '24px',
            'margin': '30px 0 15px 0',
            'border-right': '4px solid #f5c518',
            'padding-right': '15px'
        });

        // معالجة الفقرات
        contentClone.find('p').css({
            'margin-bottom': '15px',
            'color': '#ccc',
            'line-height': '1.8'
        });

        return contentClone.html();
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
    body { background: #0a0a0a; color: #e0e0e0; padding: 20px; line-height: 1.8; direction: rtl; }
    
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
      line-height: 1.4;
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
      background: rgba(255,255,255,0.05);
      padding: 8px 15px;
      border-radius: 20px;
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
    
    .article-content img {
      display: block;
      margin: 20px auto;
    }
    
    .source-badge {
      display: inline-block;
      background: #f5c518;
      color: #000;
      padding: 5px 15px;
      border-radius: 20px;
      font-weight: bold;
      font-size: 14px;
      margin-top: 10px;
    }
    
    .site-footer {
      text-align: center;
      padding: 30px;
      background: #1a1a1a;
      border-top: 1px solid #333;
    }
    
    .site-footer p {
      color: #aaa;
      margin-bottom: 15px;
    }
    
    .site-footer a {
      display: inline-block;
      background: #f5c518;
      color: #000;
      padding: 12px 30px;
      border-radius: 8px;
      text-decoration: none;
      font-weight: bold;
      transition: transform 0.3s, box-shadow 0.3s;
    }
    
    .site-footer a:hover {
      transform: translateY(-2px);
      box-shadow: 0 5px 20px rgba(245, 197, 24, 0.3);
    }
    
    .disclaimer {
      background: #1a1a1a;
      border-right: 4px solid #f5c518;
      padding: 15px;
      margin: 20px 0;
      border-radius: 5px;
      color: #888;
      font-size: 14px;
    }
    
    @media (max-width: 768px) {
      body { padding: 10px; }
      .article-header { padding: 25px; }
      .article-header h1 { font-size: 24px; }
      .article-content { padding: 20px; }
      .article-meta { gap: 15px; }
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
    "image": "${reviewInfo.thumbnail || ''}",
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
        <span class="meta-item"><i class="fas fa-tag"></i> مراجعة هاتف</span>
      </div>
      <div class="source-badge">المصدر: GSMArena</div>
    </div>
    
    ${reviewInfo.thumbnail ? `<img class="article-thumbnail" src="${reviewInfo.thumbnail}" alt="${reviewInfo.title}" loading="lazy">` : ''}
    
    <div class="article-content">
      <div class="disclaimer">
        <i class="fas fa-info-circle"></i> 
        هذه المراجعة منقولة من موقع GSMArena المتخصص في مراجعات الهواتف. نقدمها لكم مترجمة وبتنسيق مميز من ${SETTINGS.siteName}.
      </div>
      ${articleContent}
    </div>
    
    <div class="site-footer">
      <p>
        <i class="fas fa-sync-alt"></i> 
        يتم تحديث المحتوى بشكل دوري | جميع الحقوق محفوظة © ${new Date().getFullYear()}
      </p>
      <a href="${SETTINGS.siteUrl}" target="_blank" rel="noopener">
        <i class="fas fa-external-link-alt"></i> زيارة موقع ${SETTINGS.siteName} للمزيد من المراجعات
      </a>
    </div>
  </div>
</body>
</html>`;
    }

    // ===== الحصول على Access Token مع معالجة أفضل للأخطاء =====
    async getAccessToken() {
        try {
            console.log('🔑 جاري الحصول على رمز الوصول...');
            const response = await axios.post('https://oauth2.googleapis.com/token', {
                client_id: BLOGGER_CONFIG.clientId,
                client_secret: BLOGGER_CONFIG.clientSecret,
                refresh_token: BLOGGER_CONFIG.refreshToken,
                grant_type: 'refresh_token'
            });
            
            console.log('✅ تم الحصول على رمز الوصول بنجاح');
            return response.data.access_token;
        } catch (error) {
            console.error('❌ فشل الحصول على access token:');
            if (error.response) {
                console.error('   الحالة:', error.response.status);
                console.error('   الرسالة:', error.response.data);
                
                if (error.response.status === 400) {
                    console.error('\n⚠️ يبدو أن refresh token منتهي الصلاحية أو غير صالح.');
                    console.error('يجب عليك:');
                    console.error('1. الذهاب إلى: https://console.cloud.google.com/apis/credentials');
                    console.error('2. تفعيل Blogger API v3');
                    console.error('3. إنشاء OAuth 2.0 Client ID جديد');
                    console.error('4. استخدام الرابط التالي للحصول على refresh token جديد:');
                    console.error(`   https://accounts.google.com/o/oauth2/auth?client_id=${BLOGGER_CONFIG.clientId}&redirect_uri=urn:ietf:wg:oauth:2.0:oob&scope=https://www.googleapis.com/auth/blogger&response_type=code`);
                }
            } else {
                console.error('   الخطأ:', error.message);
            }
            throw error;
        }
    }

    // ===== التحقق من صلاحية المدونة =====
    async verifyBlogAccess(accessToken) {
        try {
            console.log('🔍 التحقق من صلاحية الوصول للمدونة...');
            const response = await axios.get(
                `https://www.googleapis.com/blogger/v3/blogs/${BLOGGER_CONFIG.blogId}`,
                {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`
                    }
                }
            );
            console.log(`✅ تم التحقق من المدونة: ${response.data.name}`);
            console.log(`   الوصف: ${response.data.description || 'لا يوجد وصف'}`);
            console.log(`   عدد المنشورات: ${response.data.posts.totalItems}`);
            return true;
        } catch (error) {
            console.error('❌ فشل التحقق من المدونة:');
            if (error.response) {
                console.error('   الحالة:', error.response.status);
                console.error('   الرسالة:', error.response.data);
                
                if (error.response.status === 403) {
                    console.error('\n⚠️ ليس لديك صلاحية للنشر في هذه المدونة.');
                    console.error('تأكد من:');
                    console.error('1. أنك استخدمت نفس حساب Google المالك للمدونة عند إنشاء التطبيق');
                    console.error('2. أنك منحت صلاحية Blogger API كاملة');
                    console.error('3. أن Blog ID صحيح');
                } else if (error.response.status === 404) {
                    console.error('\n⚠️ المدونة غير موجودة. تأكد من Blog ID.');
                }
            }
            return false;
        }
    }

    // ===== النشر على بلوجر =====
    async publishToBlogger(postTitle, postContent) {
        try {
            // 1. الحصول على access token
            const accessToken = await this.getAccessToken();
            
            // 2. التحقق من صلاحية المدونة
            const hasAccess = await this.verifyBlogAccess(accessToken);
            if (!hasAccess) {
                throw new Error('لا توجد صلاحية للوصول إلى المدونة');
            }
            
            // 3. نشر المقال
            console.log('📝 جاري نشر المقال...');
            const postData = {
                kind: 'blogger#post',
                title: postTitle,
                content: postContent,
                labels: ['مراجعات', 'GSMArena', 'هواتف', 'تقنية', 'ريفيو']
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

            console.log('✅ تم النشر بنجاح!');
            console.log(`🔗 رابط المقال: ${response.data.url}`);
            console.log(`🆔 معرف المقال: ${response.data.id}`);
            
            return { 
                success: true, 
                url: response.data.url, 
                postId: response.data.id 
            };
            
        } catch (error) {
            console.error('\n❌ فشل النشر على بلوجر:');
            
            if (error.response) {
                console.error('   الحالة:', error.response.status);
                console.error('   الرسالة:', JSON.stringify(error.response.data, null, 2));
                
                // اقتراحات للحل
                switch (error.response.status) {
                    case 401:
                        console.error('\n💡 الحل: تحتاج إلى refresh token جديد');
                        console.error('استخدم الرابط التالي:');
                        console.error(`https://accounts.google.com/o/oauth2/auth?client_id=${BLOGGER_CONFIG.clientId}&redirect_uri=urn:ietf:wg:oauth:2.0:oob&scope=https://www.googleapis.com/auth/blogger&response_type=code`);
                        break;
                    case 403:
                        console.error('\n💡 الحل: تأكد من الصلاحيات التالية:');
                        console.error('1. حساب Google المستخدم هو مالك المدونة');
                        console.error('2. تم تفعيل Blogger API في Google Cloud Console');
                        console.error('3. تم منح صلاحية https://www.googleapis.com/auth/blogger');
                        break;
                }
            } else {
                console.error('   الخطأ:', error.message);
            }
            
            return { 
                success: false, 
                error: error.message 
            };
        }
    }

    // ===== حفظ نسخة محلية =====
    async saveLocalBackup(title, content) {
        try {
            await fs.ensureDir(SETTINGS.postsDir);
            
            const date = new Date().toISOString().split('T')[0];
            const safeTitle = title
                .replace(/[<>:"/\\|?*]/g, '')
                .replace(/\s+/g, '_')
                .substring(0, 80);
            const fileName = `${SETTINGS.postsDir}/${date}_${safeTitle}.html`;
            
            await fs.writeFile(fileName, content, 'utf8');
            console.log(`💾 تم حفظ نسخة محلية: ${fileName}`);
            return fileName;
        } catch (error) {
            console.error('❌ فشل حفظ النسخة المحلية:', error.message);
            return null;
        }
    }

    // ===== التشغيل الرئيسي =====
    async run() {
        console.log('\n' + '='.repeat(60));
        console.log('🚀 نظام النشر التلقائي من GSMArena');
        console.log('='.repeat(60));
        console.log(`📅 التاريخ: ${new Date().toLocaleString('ar-SA')}`);
        console.log(`📊 المقالات المنشورة سابقاً: ${this.state.publishedArticles.length}`);
        console.log('='.repeat(60));
        
        try {
            // 1. استخراج أحدث مقال
            const reviewInfo = await this.getLatestReview();
            
            console.log('\n' + '-'.repeat(40));
            console.log('📋 تفاصيل المقال:');
            console.log(`   📱 العنوان: ${reviewInfo.title}`);
            console.log(`   🔗 الرابط: ${reviewInfo.link}`);
            console.log(`   📅 التاريخ: ${reviewInfo.date}`);
            console.log(`   💬 التعليقات: ${reviewInfo.comments}`);
            if (reviewInfo.thumbnail) {
                console.log(`   🖼️ الصورة: ${reviewInfo.thumbnail.substring(0, 60)}...`);
            }
            console.log('-'.repeat(40));

            // 2. التحقق من أن المقال لم يُنشر مسبقاً
            if (this.state.publishedArticles.includes(reviewInfo.link)) {
                console.log('\n⚠️ هذا المقال تم نشره مسبقاً!');
                console.log(`   📅 الرابط: ${reviewInfo.link}`);
                console.log('   🛑 توقف لمنع التكرار.');
                return;
            }

            // 3. استخراج محتوى المقال
            console.log('\n📄 جاري استخراج محتوى المقال...');
            const articleContent = await this.extractArticleContent(reviewInfo.link);
            console.log(`✅ تم استخراج ${articleContent.length} حرف من المحتوى`);

            // 4. توليد HTML المنشور
            console.log('\n🛠️ جاري توليد HTML المنشور...');
            const postHtml = this.generatePostHtml(reviewInfo, articleContent);
            console.log('✅ تم توليد HTML');

            // 5. حفظ نسخة محلية احتياطية
            console.log('\n💾 جاري حفظ نسخة محلية...');
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
                console.log('🎉🎉🎉 تم نشر المقال بنجاح! 🎉🎉🎉');
                console.log('='.repeat(60));
                console.log(`📱 العنوان: ${reviewInfo.title}`);
                console.log(`🔗 رابط بلوجر: ${publishResult.url}`);
                console.log(`🆔 معرف المنشور: ${publishResult.postId}`);
                console.log(`📅 التاريخ: ${reviewInfo.date}`);
                console.log(`💬 التعليقات: ${reviewInfo.comments}`);
                console.log(`📊 إجمالي المقالات المنشورة: ${this.state.publishedArticles.length}`);
                console.log('='.repeat(60));
            } else {
                console.log('\n' + '='.repeat(60));
                console.log('⚠️ فشل النشر على بلوجر');
                console.log('='.repeat(60));
                console.log('✅ تم حفظ نسخة محلية للاستخدام اليدوي');
                console.log('💡 يمكنك نشر الملف المحفوظ يدوياً من لوحة تحكم بلوجر');
                console.log('='.repeat(60));
            }

        } catch (error) {
            console.error('\n' + '='.repeat(60));
            console.error('❌ فشل التشغيل:', error.message);
            console.error('='.repeat(60));
        }
    }
}

// ===== تشغيل التطبيق =====
console.log('📢 بدء تشغيل مستخرج مراجعات GSMArena');
console.log('⏰ الوقت:', new Date().toLocaleString('ar-SA'));

const publisher = new AutoPublisher();
publisher.run().then(() => {
    console.log('\n✅ اكتمل التنفيذ');
}).catch(error => {
    console.error('\n❌ فشل البرنامج:', error.message);
});
