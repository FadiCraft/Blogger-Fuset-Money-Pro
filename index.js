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
    targetUrl: 'https://www.gsmarena.com/reviews.php3',
    baseUrl: 'https://www.gsmarena.com',
    stateFile: 'gsmarena_state.json',
    postsDir: 'posts_gsmarena',
    siteName: 'ZeeoXForU',
    siteUrl: 'https://www.zeexforu.com/',
    authorName: 'ZeeoXForU Team',
    authorDescription: 'Expert tech reviews, news, and in-depth analysis',
    maxArticlesPerRun: 1
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

    isArticlePublished(url, title) {
        if (this.state.publishedUrls.includes(url)) return true;
        if (this.state.processedUrls.includes(url)) return true;
        return false;
    }

    cleanTitle(title) {
        return title
            .replace(/\s*(review|reviews|hands-on|hands on|preview|first look)\s*$/i, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    formatDate(dateString) {
        try {
            const date = new Date(dateString);
            if (!isNaN(date.getTime())) {
                return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
            }
            const months = ['January', 'February', 'March', 'April', 'May', 'June',
                          'July', 'August', 'September', 'October', 'November', 'December'];
            const parts = dateString.split(' ');
            if (parts.length === 3) {
                const idx = months.findIndex(m => m.toLowerCase() === parts[1].toLowerCase());
                if (idx >= 0) return `${months[idx]} ${parts[0]}, ${parts[2]}`;
            }
            return dateString;
        } catch {
            return dateString;
        }
    }

    formatDateISO(dateString) {
        try {
            const date = new Date(dateString);
            if (!isNaN(date.getTime())) return date.toISOString().split('T')[0];
            return new Date().toISOString().split('T')[0];
        } catch {
            return new Date().toISOString().split('T')[0];
        }
    }

    // ===== البحث عن المقالات الحقيقية فقط =====
    async findUnpublishedArticles() {
        console.log('🔍 جلب صفحة GSMArena...');
        const html = await this.fetchHtml(SETTINGS.targetUrl);
        const $ = cheerio.load(html);
        
        const articles = [];
        
        // البحث عن كل الروابط اللي فيها "review-" (روابط المراجعات الحقيقية)
        $('a[href*="review-"]').each((i, el) => {
            if (articles.length >= 10) return false;
            
            const $el = $(el);
            let href = $el.attr('href');
            
            // تجاهل روابط التعليقات
            if (href.includes('reviewcomm-')) return;
            if (href.includes('comments')) return;
            
            // جعل الرابط كامل
            if (!href.startsWith('http')) {
                href = SETTINGS.baseUrl + (href.startsWith('/') ? '' : '/') + href;
            }
            
            // البحث عن أقرب عنوان
            let title = '';
            let image = '';
            
            // جرب الوالد المباشر أو الجد
            const parent = $el.parent().parent() || $el.parent();
            
            // العنوان: غالباً في h3 أو عنصر قريب
            title = parent.find('h3, h2, strong, .title, [class*="title"]').first().text().trim();
            
            // إذا ما لقينا عنوان قريب، جرب النص داخل الرابط
            if (!title || title.length < 5) {
                title = $el.text().trim();
            }
            
            // إذا ما زال ما فيه عنوان، جرب alt الصورة
            if (!title || title.length < 5) {
                title = $el.find('img').attr('alt') || parent.find('img').attr('alt') || '';
            }
            
            // تجاهل العناوين القصيرة جداً أو الطويلة جداً
            if (!title || title.length < 10 || title.length > 200) return;
            
            // تجاهل إذا كان العنوان أرقام فقط أو تواريخ
            if (/^[\d\s./]+$/.test(title)) return;
            
            // تنظيف العنوان
            title = title.replace(/\s+/g, ' ').trim();
            
            // الصورة
            const img = $el.find('img').first() || parent.find('img').first();
            if (img.length) {
                image = img.attr('src') || img.attr('data-src') || '';
                if (image && image.startsWith('//')) image = 'https:' + image;
                else if (image && !image.startsWith('http')) image = 'https://' + image;
            }
            
            // استخراج التاريخ من النص القريب
            let date = '';
            const dateEl = parent.find('[class*="time"], [class*="date"], time, .meta').first();
            if (dateEl.length) {
                date = dateEl.text().trim();
            }
            if (!date) {
                date = new Date().toISOString().split('T')[0];
            }
            
            // تجاهل التكرار
            if (articles.find(a => a.link === href)) return;
            
            articles.push({
                title: this.cleanTitle(title),
                link: href,
                image: image,
                date: date,
                category: 'Review'
            });
        });
        
        console.log(`📋 تم استخراج ${articles.length} مراجعة حقيقية`);
        
        // طباعة المقالات المستخرجة
        articles.slice(0, 5).forEach((a, i) => {
            console.log(`   ${i + 1}. "${a.title.substring(0, 70)}"`);
            console.log(`      ${a.link.substring(0, 70)}`);
        });
        
        // فلترة غير المنشورة
        const unpublished = [];
        for (const article of articles) {
            if (!this.isArticlePublished(article.link, article.title)) {
                unpublished.push(article);
                if (unpublished.length >= SETTINGS.maxArticlesPerRun) break;
            }
        }
        
        console.log(`✅ مقالات جديدة: ${unpublished.length}`);
        return unpublished;
    }

    // ===== استخراج محتوى المقال =====
    async extractArticleContent(articleUrl) {
        console.log(`📄 استخراج: ${articleUrl.substring(0, 60)}...`);
        const html = await this.fetchHtml(articleUrl);
        const $ = cheerio.load(html);
        
        // المحتوى الرئيسي
        let mainContent = $('#review-body');
        
        if (!mainContent.length || mainContent.text().trim().length < 100) {
            mainContent = $('body').clone();
            mainContent.find('header, footer, nav, script, style, noscript, iframe, .ad, .social, .comments, .sidebar').remove();
        }
        
        // تنظيف
        mainContent.find('script, style, noscript, iframe, .ad, .social-share, .comments, nav').remove();
        
        const textContent = mainContent.text().replace(/\s+/g, ' ').trim().substring(0, 500);
        
        // معالجة الصور
        mainContent.find('img').each((i, img) => {
            const $img = $(img);
            let src = $img.attr('src') || $img.attr('data-src');
            if (src) {
                if (src.startsWith('//')) src = 'https:' + src;
                if (src.includes('icon') || src.includes('logo') || src.includes('avatar') || src.length < 30) {
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
        
        // استخدام تصميم مخصص لا يتعارض مع قالب بلوجر الأساسي
        return `
        <div class="zx-article-wrapper">
            <style>
                .zx-article-wrapper {
                    font-family: 'Inter', 'Segoe UI', Tahoma, sans-serif;
                    line-height: 1.8;
                    color: #334155;
                    max-width: 100%;
                    overflow: hidden; /* لمنع تداخل العناصر الطافية */
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
                    background: #6366f1;
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
                /* تنظيف العناوين الداخلية والصور لتجنب التداخل */
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
                .zx-author-box {
                    display: flex;
                    align-items: center;
                    gap: 15px;
                    background: #f8fafc;
                    padding: 20px;
                    border-radius: 12px;
                    margin-top: 40px;
                    border: 1px solid #e2e8f0;
                    clear: both;
                }
                .zx-author-avatar {
                    font-size: 2rem;
                    background: #e2e8f0;
                    width: 60px;
                    height: 60px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 50%;
                }
                .zx-author-info h4 {
                    margin: 0 0 5px 0;
                    color: #0f172a;
                    font-size: 1.1rem;
                    border: none;
                }
                .zx-author-info p {
                    margin: 0;
                    font-size: 0.9rem;
                    color: #64748b;
                }
            </style>

            <div class="zx-meta-bar">
                <div class="zx-meta-item zx-category-badge">📱 ${article.category}</div>
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
                    <li>Real-world performance insights and benchmarks</li>
                    <li>Honest assessment of pros and cons</li>
                </ul>
            </div>
            
            <div class="zx-author-box">
                <div class="zx-author-avatar">👨‍💻</div>
                <div class="zx-author-info">
                    <h4>${SETTINGS.authorName}</h4>
                    <p>${SETTINGS.authorDescription}</p>
                </div>
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

    async publishToBlogger(postTitle, postContent) {
        try {
            const accessToken = await this.getAccessToken();
            
            const response = await axios.post(
                `https://www.googleapis.com/blogger/v3/blogs/${BLOGGER_CONFIG.blogId}/posts/`,
                {
                    kind: 'blogger#post',
                    title: postTitle,
                    content: postContent,
                    labels: ['Tech', 'Review', 'ZeeoXForU']
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
            return { success: true, url: response.data.url };
        } catch (error) {
            if (error.response?.status === 403) {
                console.error('\n❌ صلاحية مرفوضة - تحتاج Refresh Token جديد');
                console.error('💡 اتبع الخطوات التالية:');
                console.error('1. افتح هذا الرابط في المتصفح:');
                console.error(`https://accounts.google.com/o/oauth2/auth?client_id=${BLOGGER_CONFIG.clientId}&redirect_uri=urn:ietf:wg:oauth:2.0:oob&scope=https://www.googleapis.com/auth/blogger&response_type=code`);
                console.error('2. اسمح بالوصول وانسخ الكود');
                console.error('3. استخدم الكود لتحصل على refresh token جديد من:');
                console.error('   curl -d "code=CODE&client_id=CLIENT_ID&client_secret=CLIENT_SECRET&redirect_uri=urn:ietf:wg:oauth:2.0:oob&grant_type=authorization_code" https://oauth2.googleapis.com/token');
            } else {
                console.error('❌ فشل النشر:', error.message);
            }
            return { success: false, error: error.message };
        }
    }

    async saveLocalBackup(title, content, category) {
        try {
            await fs.ensureDir(SETTINGS.postsDir);
            const date = new Date().toISOString().split('T')[0];
            const safeTitle = title.replace(/[<>:"/\\|?*]/g, '').replace(/\s+/g, '_').substring(0, 50);
            const fileName = path.join(SETTINGS.postsDir, `${date}_${safeTitle}.html`);
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
        console.log('🚀 ZeeoXForU Auto Publisher');
        console.log('='.repeat(60));
        
        try {
            const articles = await this.findUnpublishedArticles();
            
            if (articles.length === 0) {
                console.log('\n✅ لا توجد مقالات جديدة.');
                return;
            }
            
            for (const article of articles) {
                console.log(`\n📄 ${article.title}`);
                
                const { html: articleHtml, text: articleText } = await this.extractArticleContent(article.link);
                const postHtml = this.generatePostHtml(article, articleHtml, articleText);
                
                await this.saveLocalBackup(article.title, postHtml, article.category);
                
                const result = await this.publishToBlogger(article.title, postHtml);
                
                if (result.success) {
                    this.state.publishedUrls.push(article.link);
                    this.state.publishedTitles.push(article.title);
                    this.publishedCount++;
                } else {
                    this.state.processedUrls.push(article.link);
                }
                
                this.saveState();
            }
            
            console.log(`\n📊 تم النشر: ${this.publishedCount}`);
            
        } catch (error) {
            console.error('\n❌ فشل:', error.message);
        }
    }
}

console.log('📢 ZeeoXForU Auto Publisher v3.0');
const publisher = new AutoPublisher();
publisher.run().then(() => console.log('\n✅ اكتمل')).catch(e => console.error('\n❌', e.message));
