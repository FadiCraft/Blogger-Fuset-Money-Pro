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
        
        // ===== الطريقة الصحيحة: البحث عن divs اللي تحتوي على مقالات المراجعات =====
        // GSMArena يستخدم هيكل معين: روابط تنتهي بـ review-رقم.php
        
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
        const cleanTitle = this.cleanTitle(article.title);
        const formattedDate = this.formatDate(article.date);
        const dateISO = this.formatDateISO(article.date);
        const readTime = Math.max(1, Math.ceil((articleContent.length / 5) / 200));
        const description = contentText.substring(0, 160).trim() + '...';
        
        const colors = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b'];
        const accent = colors[Math.floor(Math.random() * colors.length)];
        
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${cleanTitle} | ZeeoXForU</title>
    <meta name="description" content="${description}">
    <meta name="robots" content="index, follow">
    <meta property="og:title" content="${cleanTitle}">
    <meta property="og:description" content="${description}">
    <meta property="og:type" content="article">
    ${article.image ? `<meta property="og:image" content="${article.image}">` : ''}
    <meta name="twitter:card" content="summary_large_image">
    <script type="application/ld+json">
    {
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": "${cleanTitle.replace(/"/g, '\\"')}",
        "description": "${description.replace(/"/g, '\\"')}",
        ${article.image ? `"image": "${article.image}",` : ''}
        "datePublished": "${dateISO}",
        "publisher": {"@type": "Organization", "name": "ZeeoXForU"}
    }
    </script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
    <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:'Inter',sans-serif;background:#f8fafc;color:#1e293b;line-height:1.8;padding:20px}
        .container{max-width:900px;margin:0 auto;background:#fff;border-radius:16px;box-shadow:0 2px 12px rgba(0,0,0,0.05);overflow:hidden}
        .header{padding:36px 40px 0}
        .category{display:inline-block;background:${accent}15;color:${accent};font-size:.78rem;font-weight:600;padding:5px 14px;border-radius:16px;margin-bottom:16px;text-transform:uppercase}
        h1{font-size:2.2rem;font-weight:800;line-height:1.3;color:#0f172a;margin-bottom:12px}
        .subtitle{font-size:1.05rem;color:#64748b;margin-bottom:16px}
        .meta{display:flex;gap:18px;flex-wrap:wrap;font-size:.88rem;color:#64748b;padding-bottom:18px;border-bottom:1px solid #e2e8f0;margin-bottom:20px}
        .meta span{display:flex;align-items:center;gap:5px}
        .featured{margin:0 40px 28px;border-radius:12px;overflow:hidden}
        .featured img{width:100%;height:auto;display:block;max-height:450px;object-fit:cover}
        .body{padding:0 40px 40px}
        .body h2{font-size:1.5rem;font-weight:700;color:#0f172a;margin:30px 0 14px;padding-left:12px;border-left:4px solid ${accent}}
        .body h3{font-size:1.2rem;font-weight:600;color:#1e293b;margin:22px 0 10px}
        .body p{margin-bottom:1rem;color:#334155;font-size:1.02rem}
        .body img{max-width:100%;height:auto;border-radius:10px;margin:20px 0;display:block}
        .body ul,.body ol{margin:14px 0;padding-left:22px}
        .body li{margin-bottom:6px;color:#334155}
        .body table{width:100%;border-collapse:collapse;margin:20px 0}
        .body table td,.body table th{padding:10px 14px;border:1px solid #e2e8f0;text-align:left}
        .body table th{background:#f8fafc;font-weight:600}
        .key-points{background:#f0f9ff;border-left:4px solid ${accent};padding:18px 22px;border-radius:10px;margin:24px 0}
        .key-points h3{color:${accent};margin-bottom:10px}
        .key-points ul{list-style:none;padding:0}
        .key-points li{padding:5px 0}
        .key-points li:before{content:"▸ ";color:${accent};font-weight:bold}
        .faq{background:#fafbfc;border:1px solid #e2e8f0;border-radius:12px;padding:24px;margin:30px 0}
        .faq h2{font-size:1.3rem;border:none;padding:0;margin-bottom:18px}
        .faq-item{margin-bottom:16px;padding-bottom:14px;border-bottom:1px solid #e2e8f0}
        .faq-item:last-child{border:none;margin:0;padding:0}
        .faq-item strong{display:block;margin-bottom:6px;color:#1e293b}
        .faq-item p{color:#64748b;font-size:.93rem}
        .author{display:flex;gap:14px;align-items:center;padding:18px;background:#f8fafc;border-radius:12px;margin:28px 0}
        .author-avatar{width:50px;height:50px;background:${accent};border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:1.2rem;flex-shrink:0}
        .author-info h4{color:#1e293b}
        .author-info p{color:#64748b;font-size:.82rem;margin:0}
        .footer{display:flex;justify-content:space-between;flex-wrap:wrap;gap:10px;padding-top:14px;border-top:1px solid #e2e8f0;margin-top:18px}
        .tags{display:flex;gap:6px;flex-wrap:wrap}
        .tag{background:#f1f5f9;color:#64748b;padding:4px 10px;border-radius:14px;font-size:.75rem}
        .copyright{color:#94a3b8;font-size:.78rem}
        @media(max-width:768px){
            body{padding:8px}
            .header{padding:20px 16px 0}
            .body{padding:0 16px 20px}
            .featured{margin:0 16px 20px}
            h1{font-size:1.5rem}
        }
    </style>
</head>
<body>
    <article class="container">
        <header class="header">
            <span class="category">📱 ${article.category}</span>
            <h1>${cleanTitle}</h1>
            <p class="subtitle">${description}</p>
            <div class="meta">
                <span>📅 <time datetime="${dateISO}">${formattedDate}</time></span>
                <span>👤 ${SETTINGS.authorName}</span>
                <span>⏱️ ${readTime} min read</span>
            </div>
        </header>
        
        ${article.image ? `<div class="featured"><img src="${article.image}" alt="${cleanTitle}"></div>` : ''}
        
        <div class="body">
            ${articleContent}
            
            <div class="key-points">
                <h3>⭐ Key Highlights</h3>
                <ul>
                    <li>Comprehensive analysis and detailed breakdown</li>
                    <li>Real-world performance insights and benchmarks</li>
                    <li>Honest assessment of pros and cons</li>
                </ul>
            </div>
            
            <div class="faq">
                <h2>❓ Frequently Asked Questions</h2>
                <div class="faq-item">
                    <strong>Q: What makes this device stand out?</strong>
                    <p>A: The device offers a unique combination of premium design, powerful performance, and innovative features that set it apart from competitors in its price range.</p>
                </div>
                <div class="faq-item">
                    <strong>Q: Is it worth buying?</strong>
                    <p>A: Based on our analysis, the device provides excellent value for money, delivering flagship-level features at a competitive price point.</p>
                </div>
            </div>
            
            <div class="author">
                <div class="author-avatar">📝</div>
                <div class="author-info">
                    <h4>${SETTINGS.authorName}</h4>
                    <p>${SETTINGS.authorDescription}</p>
                </div>
            </div>
            
            <div class="footer">
                <div class="tags">
                    <span class="tag">Tech</span>
                    <span class="tag">Review</span>
                    <span class="tag">Analysis</span>
                </div>
                <div class="copyright">© ${new Date().getFullYear()} ZeeoXForU</div>
            </div>
        </div>
    </article>
</body>
</html>`;
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
