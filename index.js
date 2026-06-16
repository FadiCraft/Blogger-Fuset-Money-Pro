const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs-extra');
const path = require('path');

// ===== إعدادات Blogger =====
const BLOGGER_CONFIG = {
    blogId: '5107716259688743212',
    clientId: '763442957258-chsjm7n9chvae9roaj0vuprgdd61t9vc.apps.googleusercontent.com',
    clientSecret: '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',
    refreshToken: '1//04-ucaHqT22MgCgYIARAAGAQSNwF-L9IrgpRydeAVTfdpWp41p2_gAYIkD1eSpxr-cJeMATwW3NBplACoMXhYXcFmI1ctY8wED0Q'
};

// ===== الإعدادات العامة =====
const SETTINGS = {
    targetUrl: 'https://www.gsmarena.com/reviews.php3',
    baseUrl: 'https://www.gsmarena.com',
    stateFile: 'gsmarena_state.json',
    postsDir: 'posts_gsmarena',
    siteName: 'ZeeoXForU',
    siteUrl: 'https://www.zeexforu.com/',
    authorName: 'ZeeoXForU Team',
    authorDescription: 'Your ultimate destination for tech reviews, news, and in-depth analysis'
};

class AutoPublisher {
    constructor() {
        this.state = this.loadState();
    }

    loadState() {
        try {
            if (fs.existsSync(SETTINGS.stateFile)) {
                const state = fs.readJsonSync(SETTINGS.stateFile);
                if (!state.publishedUrls) state.publishedUrls = [];
                if (!state.publishedTitles) state.publishedTitles = [];
                return state;
            }
        } catch (error) {
            console.log('⚠️ ملف الحالة تالف، إنشاء ملف جديد...');
        }
        return { 
            publishedUrls: [],
            publishedTitles: [],
            lastRun: null
        };
    }

    saveState() {
        try {
            this.state.lastRun = new Date().toISOString();
            fs.writeJsonSync(SETTINGS.stateFile, this.state, { spaces: 2 });
            console.log('💾 تم حفظ الحالة بنجاح');
        } catch (error) {
            console.error('❌ فشل حفظ الحالة:', error.message);
        }
    }

    async fetchHtml(url, retries = 3) {
        for (let i = 0; i < retries; i++) {
            try {
                const res = await axios.get(url, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Accept': 'text/html,application/xhtml+xml',
                        'Accept-Language': 'en-US,en;q=0.9'
                    },
                    timeout: 20000
                });
                return res.data;
            } catch (error) {
                if (i === retries - 1) throw error;
                await new Promise(resolve => setTimeout(resolve, 2000 * (i + 1)));
            }
        }
    }

    isArticlePublished(url, title) {
        return this.state.publishedUrls.includes(url) || 
               this.state.publishedTitles.some(t => 
                   t.toLowerCase().replace(/[^a-z0-9]/g, '') === title.toLowerCase().replace(/[^a-z0-9]/g, '')
               );
    }

    formatDate(dateString) {
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) {
                const months = ['January', 'February', 'March', 'April', 'May', 'June',
                              'July', 'August', 'September', 'October', 'November', 'December'];
                const parts = dateString.split(' ');
                if (parts.length === 3) {
                    return `${months[months.findIndex(m => m.toLowerCase() === parts[1].toLowerCase())]} ${parts[0]}, ${parts[2]}`;
                }
                return dateString;
            }
            return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        } catch {
            return dateString;
        }
    }

    estimateReadTime(contentLength) {
        return `${Math.max(1, Math.ceil((contentLength / 5) / 200))} min read`;
    }

    extractDate($, element) {
        const el = element.find('.meta-item-time, time, .date, [datetime]').first();
        if (el.length) {
            return el.attr('datetime') || el.text().trim();
        }
        return new Date().toISOString().split('T')[0];
    }

    async getLatestArticles() {
        console.log('📥 جلب أحدث المقالات من GSMArena...');
        const html = await this.fetchHtml(SETTINGS.targetUrl);
        const $ = cheerio.load(html);
        
        const articles = [];
        
        // مقال مراجعة
        const reviewItem = $('.review-item').first();
        if (reviewItem.length) {
            let link = reviewItem.find('a').first().attr('href');
            if (link && !link.startsWith('http')) link = SETTINGS.baseUrl + (link.startsWith('/') ? '' : '/') + link;
            const title = reviewItem.find('h3, .review-item-title a').first().text().trim();
            let image = reviewItem.find('img').first().attr('src');
            if (image) {
                if (image.startsWith('//')) image = 'https:' + image;
                else if (!image.startsWith('http')) image = 'https://' + image;
            }
            if (link && title) {
                articles.push({
                    title, link, image,
                    date: this.extractDate($, reviewItem),
                    category: 'Review'
                });
            }
        }
        
        // مقال خبر
        const newsItem = $('.news-item').first();
        if (newsItem.length) {
            let link = newsItem.find('a').first().attr('href');
            if (link && !link.startsWith('http')) link = SETTINGS.baseUrl + (link.startsWith('/') ? '' : '/') + link;
            const title = newsItem.find('h3, a').first().text().trim();
            if (link && title) {
                articles.push({
                    title, link,
                    image: null,
                    date: this.extractDate($, newsItem),
                    category: 'News'
                });
            }
        }
        
        console.log(`✅ تم العثور على ${articles.length} مقالات`);
        return articles;
    }

    async extractArticleContent(articleUrl) {
        console.log(`📄 استخراج المحتوى من: ${articleUrl}`);
        const html = await this.fetchHtml(articleUrl);
        const $ = cheerio.load(html);
        
        let mainContent = $('#review-body, #article-body, .article-content, article, main');
        if (!mainContent.length) {
            mainContent = $('body').clone();
            mainContent.find('header, footer, nav, script, style, noscript, iframe, .ad, .comments, .social').remove();
        }
        
        mainContent.find('script, style, noscript, iframe, .ad, .social-share, .comments').remove();
        
        // تنظيف الصور
        mainContent.find('img').each((i, img) => {
            const $img = $(img);
            let src = $img.attr('src') || $img.attr('data-src');
            if (src) {
                if (src.startsWith('//')) src = 'https:' + src;
                $img.attr('src', src);
                $img.attr('loading', 'lazy');
            }
        });
        
        // إزالة كلاسات و IDs
        mainContent.find('*').removeAttr('class id style onclick onload onerror');
        
        return mainContent.html() || '';
    }

    generatePostHtml(article, articleContent) {
        const formattedDate = this.formatDate(article.date);
        const readTime = this.estimateReadTime(articleContent.length);
        
        // اختيار لون عشوائي للتمييز
        const colors = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444'];
        const accentColor = colors[Math.floor(Math.random() * colors.length)];
        
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${article.title} | ZeeoXForU</title>
    <meta name="description" content="Read our detailed coverage of ${article.title}. Get insights, analysis, and everything you need to know.">
    ${article.image ? `<meta property="og:image" content="${article.image}">` : ''}
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <script type="application/ld+json">
    {
        "@context": "https://schema.org",
        "@type": "TechArticle",
        "headline": "${article.title.replace(/"/g, '\\"')}",
        "datePublished": "${article.date}",
        "publisher": {"@type": "Organization", "name": "ZeeoXForU"}
    }
    </script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            background: #f8fafc;
            color: #1e293b;
            line-height: 1.8;
            padding: 20px;
        }
        
        /* الحاوية الرئيسية - واسعة */
        .main-container {
            max-width: 1000px;
            margin: 0 auto;
            background: #ffffff;
            border-radius: 20px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.06);
            overflow: hidden;
        }
        
        /* الهيدر */
        .article-header {
            padding: 40px 48px 0;
        }
        
        .category-tag {
            display: inline-block;
            background: ${accentColor}15;
            color: ${accentColor};
            font-size: 0.8rem;
            font-weight: 600;
            padding: 6px 16px;
            border-radius: 20px;
            margin-bottom: 20px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        /* العنوان - ظاهر وواضح */
        .article-title {
            font-size: 2.5rem;
            font-weight: 800;
            line-height: 1.25;
            color: #0f172a;
            margin-bottom: 16px;
            letter-spacing: -0.5px;
        }
        
        .article-meta {
            display: flex;
            gap: 20px;
            flex-wrap: wrap;
            font-size: 0.9rem;
            color: #64748b;
            padding-bottom: 20px;
            border-bottom: 1px solid #e2e8f0;
            margin-bottom: 24px;
        }
        
        .article-meta span {
            display: flex;
            align-items: center;
            gap: 6px;
        }
        
        .article-meta i {
            color: ${accentColor};
        }
        
        /* الصورة الرئيسية */
        .featured-image {
            margin: 0 48px 32px;
            border-radius: 16px;
            overflow: hidden;
        }
        
        .featured-image img {
            width: 100%;
            height: auto;
            display: block;
            border-radius: 16px;
        }
        
        /* المحتوى - واسع */
        .article-body {
            padding: 0 48px 48px;
        }
        
        .article-body h2 {
            font-size: 1.6rem;
            font-weight: 700;
            color: #0f172a;
            margin: 32px 0 16px;
            padding-left: 14px;
            border-left: 4px solid ${accentColor};
        }
        
        .article-body h3 {
            font-size: 1.3rem;
            font-weight: 600;
            color: #1e293b;
            margin: 24px 0 12px;
        }
        
        .article-body p {
            margin-bottom: 1.2rem;
            color: #334155;
            font-size: 1.05rem;
        }
        
        .article-body img {
            max-width: 100%;
            height: auto;
            border-radius: 12px;
            margin: 24px 0;
            display: block;
        }
        
        .article-body ul, .article-body ol {
            margin: 16px 0;
            padding-left: 24px;
        }
        
        .article-body li {
            margin-bottom: 8px;
            color: #334155;
        }
        
        /* مربع النقاط الرئيسية */
        .key-points {
            background: #f0f9ff;
            border-left: 4px solid ${accentColor};
            padding: 20px 24px;
            border-radius: 12px;
            margin: 28px 0;
        }
        
        .key-points h3 {
            display: flex;
            align-items: center;
            gap: 8px;
            color: ${accentColor};
            margin-bottom: 12px;
            font-size: 1.1rem;
        }
        
        .key-points ul {
            list-style: none;
            padding: 0;
        }
        
        .key-points li {
            padding: 6px 0;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .key-points li:before {
            content: "▸";
            color: ${accentColor};
        }
        
        /* FAQ */
        .faq-section {
            background: #f8fafc;
            border-radius: 16px;
            padding: 28px;
            margin: 36px 0 20px;
        }
        
        .faq-section h2 {
            font-size: 1.4rem;
            margin-bottom: 20px;
            border: none;
            padding: 0;
        }
        
        .faq-item {
            margin-bottom: 18px;
            padding-bottom: 14px;
            border-bottom: 1px solid #e2e8f0;
        }
        
        .faq-item:last-child {
            border-bottom: none;
            margin-bottom: 0;
        }
        
        .faq-item strong {
            display: block;
            margin-bottom: 6px;
            color: #1e293b;
        }
        
        .faq-item p {
            color: #64748b;
            font-size: 0.95rem;
            margin: 0;
        }
        
        /* الكاتب */
        .author-box {
            display: flex;
            gap: 16px;
            align-items: center;
            padding: 20px;
            background: #f8fafc;
            border-radius: 16px;
            margin: 32px 0 16px;
        }
        
        .author-avatar {
            width: 52px;
            height: 52px;
            background: ${accentColor};
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 1.3rem;
            flex-shrink: 0;
        }
        
        .author-info h4 {
            margin-bottom: 2px;
            color: #1e293b;
        }
        
        .author-info p {
            color: #64748b;
            font-size: 0.85rem;
            margin: 0;
        }
        
        /* الفوتر */
        .article-footer {
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 12px;
            padding-top: 16px;
            border-top: 1px solid #e2e8f0;
            margin-top: 20px;
        }
        
        .tags {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
        }
        
        .tag {
            background: #f1f5f9;
            color: #64748b;
            padding: 5px 12px;
            border-radius: 16px;
            font-size: 0.78rem;
        }
        
        .copyright {
            color: #94a3b8;
            font-size: 0.8rem;
        }
        
        /* تجاوب */
        @media (max-width: 768px) {
            body { padding: 10px; }
            .article-header { padding: 24px 20px 0; }
            .article-body { padding: 0 20px 24px; }
            .featured-image { margin: 0 20px 24px; }
            .article-title { font-size: 1.8rem; }
        }
    </style>
</head>
<body>
    <div class="main-container">
        <div class="article-header">
            <span class="category-tag">${article.category}</span>
            <h1 class="article-title">${article.title}</h1>
            <div class="article-meta">
                <span><i class="far fa-calendar-alt"></i> ${formattedDate}</span>
                <span><i class="far fa-user"></i> ${SETTINGS.authorName}</span>
                <span><i class="far fa-clock"></i> ${readTime}</span>
            </div>
        </div>
        
        ${article.image ? `
        <div class="featured-image">
            <img src="${article.image}" alt="${article.title}" loading="eager">
        </div>` : ''}
        
        <div class="article-body">
            ${articleContent}
            
            <div class="key-points">
                <h3><i class="fas fa-lightbulb"></i> Key Highlights</h3>
                <ul>
                    <li>Comprehensive analysis of all features and specifications</li>
                    <li>Real-world performance insights and benchmarks</li>
                    <li>Honest assessment of pros and cons</li>
                </ul>
            </div>
            
            <div class="faq-section">
                <h2><i class="fas fa-question-circle" style="color:${accentColor};"></i> Frequently Asked Questions</h2>
                <div class="faq-item">
                    <strong>Q: What makes this device stand out?</strong>
                    <p>A: The device offers a unique combination of premium design, powerful performance, and innovative features that set it apart from competitors in its price range.</p>
                </div>
                <div class="faq-item">
                    <strong>Q: Is it worth the price?</strong>
                    <p>A: Based on our analysis, the device provides excellent value for money, delivering flagship-level features at a competitive price point.</p>
                </div>
            </div>
            
            <div class="author-box">
                <div class="author-avatar">
                    <i class="fas fa-chalkboard-user"></i>
                </div>
                <div class="author-info">
                    <h4>${SETTINGS.authorName}</h4>
                    <p>${SETTINGS.authorDescription}</p>
                </div>
            </div>
            
            <div class="article-footer">
                <div class="tags">
                    <span class="tag">Tech</span>
                    <span class="tag">${article.category}</span>
                    <span class="tag">Analysis</span>
                </div>
                <div class="copyright">
                    &copy; ${new Date().getFullYear()} ZeeoXForU. All rights reserved.
                </div>
            </div>
        </div>
    </div>
</body>
</html>`;
    }

    async getAccessToken() {
        console.log('🔑 جاري الحصول على رمز الوصول...');
        const response = await axios.post('https://oauth2.googleapis.com/token', {
            client_id: BLOGGER_CONFIG.clientId,
            client_secret: BLOGGER_CONFIG.clientSecret,
            refresh_token: BLOGGER_CONFIG.refreshToken,
            grant_type: 'refresh_token'
        });
        console.log('✅ تم الحصول على رمز الوصول');
        return response.data.access_token;
    }

    async verifyBlogAccess(accessToken) {
        try {
            const response = await axios.get(
                `https://www.googleapis.com/blogger/v3/blogs/${BLOGGER_CONFIG.blogId}`,
                { headers: { 'Authorization': `Bearer ${accessToken}` } }
            );
            console.log(`✅ المدونة: ${response.data.name}`);
            return true;
        } catch (error) {
            console.error('❌ فشل التحقق:', error.message);
            return false;
        }
    }

    async publishToBlogger(postTitle, postContent, labels) {
        try {
            const accessToken = await this.getAccessToken();
            const hasAccess = await this.verifyBlogAccess(accessToken);
            if (!hasAccess) throw new Error('لا توجد صلاحية');
            
            console.log('📝 جاري النشر...');
            const response = await axios.post(
                `https://www.googleapis.com/blogger/v3/blogs/${BLOGGER_CONFIG.blogId}/posts/`,
                {
                    kind: 'blogger#post',
                    title: postTitle,
                    content: postContent,
                    labels: labels || ['Tech', 'Review', 'ZeeoXForU']
                },
                {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            
            console.log('✅ تم النشر!');
            console.log(`🔗 ${response.data.url}`);
            return { success: true, url: response.data.url, postId: response.data.id };
        } catch (error) {
            console.error('❌ فشل النشر:', error.message);
            return { success: false, error: error.message };
        }
    }

    async saveLocalBackup(title, content, category) {
        try {
            await fs.ensureDir(SETTINGS.postsDir);
            const date = new Date().toISOString().split('T')[0];
            const safeTitle = title.replace(/[<>:"/\\|?*]/g, '').replace(/\s+/g, '_').substring(0, 60);
            const fileName = path.join(SETTINGS.postsDir, `${date}_${category.toLowerCase()}_${safeTitle}.html`);
            await fs.writeFile(fileName, content, 'utf8');
            console.log(`💾 تم الحفظ: ${fileName}`);
            return fileName;
        } catch (error) {
            console.error('❌ فشل الحفظ:', error.message);
            return null;
        }
    }

    async run() {
        console.log('\n' + '='.repeat(60));
        console.log('🚀 ZeeoXForU - ناشر GSMArena');
        console.log('='.repeat(60));
        
        try {
            const articles = await this.getLatestArticles();
            const newArticles = articles.filter(a => !this.isArticlePublished(a.link, a.title));
            
            if (newArticles.length === 0) {
                console.log('⚠️ لا توجد مقالات جديدة');
                return;
            }
            
            for (const article of newArticles) {
                console.log(`\n📄 ${article.title}`);
                
                const content = await this.extractArticleContent(article.link);
                const html = this.generatePostHtml(article, content);
                
                await this.saveLocalBackup(article.title, html, article.category);
                
                const result = await this.publishToBlogger(
                    article.title,
                    html,
                    ['Tech', article.category, 'ZeeoXForU']
                );
                
                if (result.success) {
                    this.state.publishedUrls.push(article.link);
                    this.state.publishedTitles.push(article.title);
                    this.saveState();
                }
                
                if (newArticles.indexOf(article) < newArticles.length - 1) {
                    await new Promise(r => setTimeout(r, 3000));
                }
            }
        } catch (error) {
            console.error('❌ فشل التشغيل:', error.message);
        }
    }
}

// تشغيل
const publisher = new AutoPublisher();
publisher.run().then(() => console.log('\n✅ اكتمل')).catch(e => console.error('\n❌', e.message));
