const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs-extra');
const path = require('path');

// ===== إعدادات Blogger =====
const BLOGGER_CONFIG = {
    blogId: '5107716259688743212',
    clientId: '763442957258-chsjm7n9chvae9roaj0vuprgdd61t9vc.apps.googleusercontent.com',
    clientSecret: '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',
    refreshToken: '1//04WXd8PiT1TPMCgYIARAAGAQSNwF-L9IrqUX_lS4aEX_cLlUBnZeqwkpgFSFch0fzvUxWz-g4HPe3u77980qeuOoJoq57lfXysho'
};

const SETTINGS = {
    reviewsUrl: 'https://www.gsmarena.com/reviews.php3',
    newsUrl: 'https://www.gsmarena.com/news.php3',
    baseUrl: 'https://www.gsmarena.com',
    stateFile: 'gsmarena_state.json',
    postsDir: 'posts_gsmarena',
    maxArticlesPerRun: 1, // سينشر مقال واحد جديد في كل تشغيلة
    maxPagesToScan: 5     // كم صفحة يرجع لورا للبحث عن مقالات قديمة إذا الصفحة الأولى مكررة
};

class AutoPublisher {
    constructor() {
        this.state = this.loadState();
        this.publishedCount = 0;
    }

    loadState() {
        try {
            if (fs.existsSync(SETTINGS.stateFile)) {
                const state = fs.readJsonSync(SETTINGS.stateFile);
                if (!state.publishedUrls) state.publishedUrls = [];
                if (!state.publishedTitles) state.publishedTitles = [];
                if (!state.processedUrls) state.processedUrls = [];
                return state;
            }
        } catch (error) {
            console.log('⚠️ ملف الحالة تالف، إنشاء ملف جديد...');
        }
        return { 
            publishedUrls: [],
            publishedTitles: [],
            processedUrls: [],
            lastRun: null
        };
    }

    saveState() {
        try {
            this.state.lastRun = new Date().toISOString();
            fs.writeJsonSync(SETTINGS.stateFile, this.state, { spaces: 2 });
        } catch (error) {
            console.error('❌ فشل حفظ الحالة:', error.message);
        }
    }

    async fetchHtml(url) {
        const res = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml',
                'Accept-Language': 'en-US,en;q=0.9'
            },
            timeout: 20000
        });
        return res.data;
    }

    isArticlePublished(url) {
        return this.state.publishedUrls.includes(url) || this.state.processedUrls.includes(url);
    }

    cleanTitle(title) {
        return title
            .replace(/\s*(review|reviews|hands-on|hands on|preview|first look|news)\s*$/i, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    formatDate(dateString) {
        try {
            const date = new Date(dateString);
            if (!isNaN(date.getTime())) {
                return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
            }
            return dateString;
        } catch {
            return dateString;
        }
    }

    // ===== جلب المقالات مع ميزة الانتقال للصفحات الأقدم وعزل الأخبار/المراجعات =====
    async findUnpublishedArticles() {
        const targets = [
            { url: SETTINGS.reviewsUrl, type: 'Review', param: 'iPage' },
            { url: SETTINGS.newsUrl, type: 'News', param: 'iPage' }
        ];

        const unpublishedArticles = [];

        for (const target of targets) {
            console.log(`\n🔍 فحص قسم: ${target.type}...`);
            
            for (let page = 1; page <= SETTINGS.maxPagesToScan; page++) {
                // بناء رابط الصفحة (مثال: reviews.php3?iPage=2)
                const currentUrl = page === 1 ? target.url : `${target.url}?${target.param}=${page}`;
                console.log(`📄 جلب الصفحة ${page}: ${currentUrl}`);
                
                try {
                    const html = await this.fetchHtml(currentUrl);
                    const $ = cheerio.load(html);
                    const articlesOnPage = [];

                    // تحديد الروابط بناءً على النوع (روابط المراجعات تحتوي review- وروابط الأخبار تحتوي news-)
                    const selector = target.type === 'Review' ? 'a[href*="review-"]' : 'a[href*="news-"]';

                    $(selector).each((i, el) => {
                        const $el = $(el);
                        let href = $el.attr('href');
                        
                        if (!href || href.includes('reviewcomm-') || href.includes('comments') || href.includes('newscomm-')) return;
                        
                        if (!href.startsWith('http')) {
                            href = SETTINGS.baseUrl + (href.startsWith('/') ? '' : '/') + href;
                        }
                        
                        const parent = $el.parent().parent() || $el.parent();
                        let title = parent.find('h3, h2, strong, .title, [class*="title"]').first().text().trim();
                        
                        if (!title || title.length < 5) title = $el.text().trim();
                        if (!title || title.length < 10 || title.length > 200 || /^[\d\s./]+$/.test(title)) return;

                        let image = '';
                        const img = $el.find('img').first() || parent.find('img').first();
                        if (img.length) {
                            image = img.attr('src') || img.attr('data-src') || '';
                            if (image && image.startsWith('//')) image = 'https:' + image;
                            else if (image && !image.startsWith('http')) image = 'https://' + image;
                        }

                        if (articlesOnPage.find(a => a.link === href)) return;

                        articlesOnPage.push({
                            title: this.cleanTitle(title),
                            link: href,
                            image: image,
                            date: new Date().toISOString().split('T')[0],
                            category: target.type
                        });
                    });

                    // تصفية المقالات التي لم يتم نشرها من قبل في هذه الصفحة
                    for (const article of articlesOnPage) {
                        if (!this.isArticlePublished(article.link)) {
                            unpublishedArticles.push(article);
                            if (unpublishedArticles.length >= SETTINGS.maxArticlesPerRun) {
                                return unpublishedArticles; // وجدنا العدد المطلوب، توقف واخرج فوراً للنشر
                            }
                        }
                    }
                } catch (err) {
                    console.error(`❌ خطأ أثناء جلب الصفحة ${page}:`, err.message);
                    break;
                }
            }
        }

        return unpublishedArticles;
    }

    // ===== استخراج محتوى المقال وتنظيفه تماماً من الإعلانات وعروض الأسعار =====
    async extractArticleContent(articleUrl) {
        console.log(`📄 استخراج وتنظيف المحتوى من: ${articleUrl.substring(0, 60)}...`);
        const html = await this.fetchHtml(articleUrl);
        const $ = cheerio.load(html);
        
        // المحتوى الرئيسي للمراجعة أو الخبر
        let mainContent = $('#review-body, .review-body, #news-body');
        
        if (!mainContent.length || mainContent.text().trim().length < 100) {
            mainContent = $('body').clone();
            mainContent.find('header, footer, nav, script, style, noscript, iframe, .ad, .social, .comments, .sidebar').remove();
        }
        
        // --- حملة تنظيف شاملة للإعلانات وعروض الأسعار (Affiliate blocks) كما في الـ image_7261c2.png ---
        mainContent.find('script, style, noscript, iframe, .ad, .social-share, .comments, nav, .sub-section, .pricing-box').remove();
        
        // تصفية عناصر الـ HTML التي تحتوي على نصوص ترويجية أو روابط شراء ومقارنة أسعار
        mainContent.find('div, table, section, p, h2, h3, center').each((i, el) => {
            const text = $(el).text().toLowerCase();
            const idOrClass = ($(el).attr('id') || '') + ' ' + ($(el).attr('class') || '');
            
            if (
                text.includes('best offers from our affiliate partners') || 
                text.includes('get a commission from qualifying sales') ||
                text.includes('show all prices') ||
                idOrClass.includes('price') || 
                idOrClass.includes('pricing') ||
                idOrClass.includes('shop') ||
                idOrClass.includes('store')
            ) {
                $(el).remove(); // حذف عنصر الإعلان فوراً
            }
        });
        
        const textContent = mainContent.text().replace(/\s+/g, ' ').trim().substring(0, 500);
        
        // معالجة وتنظيف الصور المتواجدة داخل المقال
        mainContent.find('img').each((i, img) => {
            const $img = $(img);
            let src = $img.attr('src') || $img.attr('data-src');
            if (src) {
                if (src.startsWith('//')) src = 'https:' + src;
                // إزالة الأيقونات وشعارات المتاجر (مثل شعار أمازون المعروض بالصورة)
                if (src.includes('icon') || src.includes('logo') || src.includes('avatar') || src.includes('amazon') || src.length < 30) {
                    $img.remove();
                    return;
                }
                $img.attr('src', src);
                $img.attr('loading', 'lazy');
            }
        });
        
        mainContent.find('*').removeAttr('class id style onclick');
        
        return {
            html: mainContent.html() || '',
            text: textContent
        };
    }

    generatePostHtml(article, articleContent, contentText) {
        const formattedDate = this.formatDate(article.date);
        const readTime = Math.max(1, Math.ceil((articleContent.length / 5) / 200));
        const description = contentText.substring(0, 160).trim() + '...';
        
        // تحديد لون التصنيف بناءً على نوع المقال
        const badgeColor = article.category === 'News' ? '#0ea5e9' : '#6366f1';
        
        return `
        <div class="zx-article-wrapper">
            <style>
                .zx-article-wrapper {
                    font-family: 'Inter', 'Segoe UI', Tahoma, sans-serif;
                    line-height: 1.8;
                    color: #334155;
                    max-width: 100%;
                    overflow: hidden;
                }
                .zx-meta-bar {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 15px;
                    margin-bottom: 25px;
                    padding: 12px 15px;
                    background: #f8fafc;
                    border-radius: 8px;
                    border: 1px solid #e2e8f0;
                    font-size: 0.85rem;
                    color: #64748b;
                }
                .zx-meta-item {
                    display: flex;
                    align-items: center;
                    gap: 5px;
                    font-weight: 600;
                }
                .zx-category-badge {
                    background: ${badgeColor};
                    color: white;
                    padding: 3px 10px;
                    border-radius: 12px;
                    font-size: 0.8rem;
                }
                .zx-featured-image {
                    width: 100%;
                    max-height: 450px;
                    object-fit: contain;
                    border-radius: 12px;
                    margin-bottom: 25px;
                    background: #f1f5f9;
                    display: block;
                }
                .zx-content {
                    font-size: 1.05rem;
                }
                .zx-content p {
                    margin-bottom: 1.2rem;
                }
                .zx-content h2, .zx-content h3 {
                    color: #0f172a;
                    margin-top: 1.5em;
                    margin-bottom: 0.8em;
                    border-bottom: 2px solid #f1f5f9;
                    padding-bottom: 8px;
                    clear: both; 
                }
                .zx-content img {
                    max-width: 100%;
                    height: auto !important;
                    border-radius: 8px;
                    margin: 20px auto;
                    display: block;
                    clear: both;
                }
                .zx-content table {
                    width: 100%;
                    border-collapse: collapse;
                    margin: 20px 0;
                    font-size: 0.95rem;
                }
                .zx-content table th, .zx-content table td {
                    border: 1px solid #e2e8f0;
                    padding: 10px;
                    text-align: left;
                }
                .zx-content table th {
                    background: #f8fafc;
                }
                .zx-highlights {
                    background: #f0fdf4;
                    border-left: 4px solid #16a34a;
                    padding: 18px 20px;
                    border-radius: 0 8px 8px 0;
                    margin: 35px 0;
                }
                .zx-highlights h3 {
                    color: #16a34a;
                    margin-top: 0;
                    border: none;
                }
                .zx-highlights ul {
                    margin: 0;
                    padding-left: 20px;
                }
                .zx-highlights li {
                    margin-bottom: 8px;
                }
            </style>

            <!-- الميتا بار المحدثة بدون صندوق كاتب أو نصوص إضافية غير مرغوبة -->
            <div class="zx-meta-bar">
                <div class="zx-meta-item zx-category-badge">${article.category === 'News' ? '📰 News' : '📱 Review'}</div>
                <div class="zx-meta-item">⏱️ ${readTime} Min Read</div>
                <div class="zx-meta-item">📅 ${formattedDate}</div>
            </div>

            ${article.image ? `<img class="zx-featured-image" src="${article.image}" alt="${article.title}">` : ''}

            <div class="zx-content">
                <p><strong>${description}</strong></p>
                ${articleContent}
            </div>
            
            <div class="zx-highlights">
                <h3>⭐ Key Highlights</h3>
                <ul>
                    <li>Comprehensive analysis and detailed breakdown</li>
                    <li>Real-world updates and official technology announcements</li>
                    <li>Accurate details and up-to-date specifications</li>
                </ul>
            </div>
        </div>`;
    }

    async getAccessToken() {
        const response = await axios.post('https://oauth2.googleapis.com/token', {
            client_id: BLOGGER_CONFIG.clientId,
            client_secret: BLOGGER_CONFIG.clientSecret,
            refresh_token: BLOGGER_CONFIG.refreshToken,
            grant_type: 'refresh_token'
        });
        return response.data.access_token;
    }

    async publishToBlogger(postTitle, postContent, category) {
        try {
            const accessToken = await this.getAccessToken();
            
            const response = await axios.post(
                `https://www.googleapis.com/blogger/v3/blogs/${BLOGGER_CONFIG.blogId}/posts/`,
                {
                    kind: 'blogger#post',
                    title: postTitle,
                    content: postContent,
                    labels: ['Tech', category, 'ZeeoXForU']
                },
                {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            
            console.log('✅ تم النشر في بلوجر بنجاح!');
            console.log(`🔗 رابط المقال: ${response.data.url}`);
            return { success: true, url: response.data.url };
        } catch (error) {
            console.error('❌ فشل النشر:', error.message);
            return { success: false, error: error.message };
        }
    }

    async saveLocalBackup(title, content) {
        try {
            await fs.ensureDir(SETTINGS.postsDir);
            const date = new Date().toISOString().split('T')[0];
            const safeTitle = title.replace(/[<>:"/\\|?*]/g, '').replace(/\s+/g, '_').substring(0, 50);
            const fileName = path.join(SETTINGS.postsDir, `${date}_${safeTitle}.html`);
            await fs.writeFile(fileName, content, 'utf8');
            console.log(`💾 تم حفظ نسخة احتياطية محلية: ${fileName}`);
            return fileName;
        } catch (error) {
            console.error('❌ فشل الحفظ المحلي:', error.message);
            return null;
        }
    }

    async run() {
        console.log('\n' + '='.repeat(60));
        console.log('🚀 ZeeoXForU Auto Publisher v4.0 (Smart Scan & Ad-Block)');
        console.log('='.repeat(60));
        
        try {
            const articles = await this.findUnpublishedArticles();
            
            if (articles.length === 0) {
                console.log('\n✅ تم فحص الصفحات العميقة ولا توجد أي مقالات جديدة كلياً في الموقع حالياً.');
                return;
            }
            
            for (const article of articles) {
                console.log(`\n📄 معالجة مقال جديد مكتشف: [${article.category}] -> ${article.title}`);
                
                const { html: articleHtml, text: articleText } = await this.extractArticleContent(article.link);
                const postHtml = this.generatePostHtml(article, articleHtml, articleText);
                
                await this.saveLocalBackup(article.title, postHtml);
                
                const result = await this.publishToBlogger(article.title, postHtml, article.category);
                
                if (result.success) {
                    this.state.publishedUrls.push(article.link);
                    this.state.publishedTitles.push(article.title);
                    this.publishedCount++;
                } else {
                    this.state.processedUrls.push(article.link);
                }
                
                this.saveState();
            }
            
            console.log(`\n📊 إجمالي المقالات المنشورة في هذه الدورة: ${this.publishedCount}`);
            
        } catch (error) {
            console.error('\n❌ فشل في التنفيذ:', error.message);
        }
    }
}

console.log('📢 سكريبت النشر الذكي المحدث v4.0 جاهز...');
const publisher = new AutoPublisher();
publisher.run().then(() => console.log('\n✅ جولة الفحص والنشر اكتملت')).catch(e => console.error('\n❌ خطأ عام:', e.message));
