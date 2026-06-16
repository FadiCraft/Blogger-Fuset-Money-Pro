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
    siteName: 'DeepLexa',
    siteUrl: 'https://www.deeplexa.com/',
    authorName: 'DeepLexa Team',
    authorDescription: 'Tech news, reviews, and analytics'
};

class AutoPublisher {
    constructor() {
        this.state = this.loadState();
        this.newArticles = [];
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
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                        'Accept-Language': 'en-US,en;q=0.9',
                        'Cache-Control': 'no-cache',
                        'Pragma': 'no-cache'
                    },
                    timeout: 20000
                });
                return res.data;
            } catch (error) {
                if (i === retries - 1) {
                    console.error(`❌ فشل جلب الصفحة بعد ${retries} محاولات:`, error.message);
                    throw error;
                }
                console.log(`⚠️ محاولة ${i + 1} فشلت، إعادة المحاولة...`);
                await new Promise(resolve => setTimeout(resolve, 2000 * (i + 1)));
            }
        }
    }

    isArticlePublished(url, title) {
        const urlPublished = this.state.publishedUrls.includes(url);
        const titlePublished = this.state.publishedTitles.some(t => 
            this.normalizeTitle(t) === this.normalizeTitle(title)
        );
        return urlPublished || titlePublished;
    }

    normalizeTitle(title) {
        return title
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    extractDate($, element) {
        const selectors = [
            '.meta-item-time',
            '.article-info-meta time',
            'time',
            '.date',
            '[datetime]'
        ];
        
        for (const selector of selectors) {
            const el = element.find(selector);
            if (el.length) {
                const datetime = el.attr('datetime');
                if (datetime) return datetime;
                const text = el.text().trim();
                if (text) return text;
            }
        }
        
        return new Date().toISOString().split('T')[0];
    }

    formatDate(dateString) {
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) {
                const months = ['January', 'February', 'March', 'April', 'May', 'June',
                              'July', 'August', 'September', 'October', 'November', 'December'];
                const parts = dateString.split(' ');
                if (parts.length === 3) {
                    const day = parts[0];
                    const month = months.findIndex(m => m.toLowerCase() === parts[1].toLowerCase());
                    const year = parts[2];
                    if (month >= 0) {
                        return new Date(year, month, day).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                        });
                    }
                }
                return dateString;
            }
            return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        } catch {
            return dateString;
        }
    }

    estimateReadTime(contentLength) {
        const wordsPerMinute = 200;
        const words = contentLength / 5;
        const minutes = Math.max(1, Math.ceil(words / wordsPerMinute));
        return `${minutes} min read`;
    }

    generateSlug(title) {
        return title
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .trim('-')
            .substring(0, 80);
    }

    async getLatestArticles() {
        console.log('📥 جلب أحدث المقالات من GSMArena...');
        const html = await this.fetchHtml(SETTINGS.targetUrl);
        const $ = cheerio.load(html);
        
        const articles = [];
        
        // مقال من قسم المراجعات
        const reviewItem = $('.review-item').first();
        if (reviewItem.length) {
            const article = this.extractArticleInfo($, reviewItem, 'Review');
            if (article) articles.push(article);
        }
        
        // مقال من قسم الأخبار
        const newsItem = $('.news-item').first();
        if (newsItem.length) {
            const article = this.extractArticleInfo($, newsItem, 'News');
            if (article) articles.push(article);
        } else {
            // البحث عن عناصر بديلة للأخبار
            const altNewsItem = $('.module-article-item, .article-item').first();
            if (altNewsItem.length) {
                const article = this.extractArticleInfo($, altNewsItem, 'News');
                if (article) articles.push(article);
            }
        }
        
        // مقال من قسم المدونة
        const blogItem = $('.blog-item').first();
        if (blogItem.length) {
            const article = this.extractArticleInfo($, blogItem, 'Blog');
            if (article) articles.push(article);
        }
        
        const validArticles = articles.filter(a => a && a.link);
        console.log(`✅ تم العثور على ${validArticles.length} مقالات جديدة`);
        return validArticles;
    }

    extractArticleInfo($, element, category) {
        try {
            let link = element.find('a').first().attr('href') || 
                      element.find('[href]').first().attr('href');
            
            if (!link) return null;
            
            if (!link.startsWith('http')) {
                link = link.startsWith('/') ? 
                    SETTINGS.baseUrl + link : 
                    SETTINGS.baseUrl + '/' + link;
            }
            
            const title = element.find('h3, h2, .title, .article-title, a').first().text().trim() ||
                         element.find('img').attr('alt')?.trim() ||
                         'Untitled Article';
            
            let image = element.find('img').first().attr('src') ||
                       element.find('img').first().attr('data-src');
            
            if (image) {
                if (image.startsWith('//')) image = 'https:' + image;
                else if (!image.startsWith('http')) image = 'https://' + image;
            }
            
            const date = this.extractDate($, element);
            const excerpt = element.find('p, .excerpt, .description').first().text().trim() || '';
            
            return {
                title,
                link,
                image,
                date,
                excerpt,
                category
            };
        } catch (error) {
            console.error('خطأ في استخراج معلومات المقال:', error.message);
            return null;
        }
    }

    async extractArticleContent(articleUrl) {
        console.log(`📄 استخراج محتوى المقال من: ${articleUrl}`);
        const html = await this.fetchHtml(articleUrl);
        const $ = cheerio.load(html);
        
        let mainContent = $('#review-body, #article-body, .article-content, .post-content, article, main');
        
        if (!mainContent.length) {
            mainContent = $('body').clone();
            mainContent.find('header, footer, nav, .sidebar, .comments, .related-posts, script, style, noscript, iframe, .advertisement, .social-share').remove();
        }
        
        const contentClone = mainContent.clone();
        
        contentClone.find('script, style, noscript, iframe, .ad, .advertisement, .social-share, .comments, .related, nav').remove();
        contentClone.find('[onclick], [onload], [onerror]').removeAttr('onclick onload onerror');
        
        contentClone.find('*').each((i, el) => {
            const $el = $(el);
            const keepAttrs = ['src', 'alt', 'href', 'title'];
            const attrs = Object.keys($el.attr() || {});
            attrs.forEach(attr => {
                if (!keepAttrs.includes(attr) && !attr.startsWith('aria-')) {
                    $el.removeAttr(attr);
                }
            });
            
            $el.removeAttr('class');
            $el.removeAttr('id');
            $el.removeAttr('style');
        });
        
        contentClone.find('img').each((i, img) => {
            const $img = $(img);
            let src = $img.attr('src') || $img.attr('data-src') || $img.attr('data-original');
            
            if (src) {
                if (src.startsWith('//')) src = 'https:' + src;
                else if (!src.startsWith('http') && !src.startsWith('data:')) {
                    src = 'https://' + src;
                }
                
                if (src.includes('icon') || src.includes('logo') || src.includes('avatar')) {
                    $img.remove();
                    return;
                }
                
                $img.attr('src', src);
                $img.attr('loading', 'lazy');
                $img.attr('alt', $img.attr('alt') || 'Article image');
            } else {
                $img.remove();
            }
        });
        
        contentClone.find('a').each((i, a) => {
            const $a = $(a);
            const href = $a.attr('href');
            if (!href || href === '#' || href.startsWith('javascript:')) {
                $a.replaceWith($a.text());
            }
        });
        
        let content = contentClone.html() || '';
        content = content
            .replace(/\n\s*\n/g, '\n')
            .replace(/>\s+</g, '><')
            .replace(/\s{2,}/g, ' ')
            .trim();
        
        return content;
    }

    generateFAQ($, content) {
        const faqItems = [];
        
        const headings = content.find('h2, h3, h4');
        headings.each((i, heading) => {
            if (i >= 4) return false;
            
            const $heading = $(heading);
            const question = $heading.text().trim();
            
            if (question.length > 10 && question.length < 100) {
                let answer = '';
                let nextEl = $heading.next();
                let attempts = 0;
                
                while (nextEl.length && attempts < 3) {
                    if (nextEl.is('p') && nextEl.text().trim().length > 20) {
                        answer = nextEl.text().trim().substring(0, 200);
                        break;
                    }
                    nextEl = nextEl.next();
                    attempts++;
                }
                
                if (answer) {
                    faqItems.push({ question, answer });
                }
            }
        });
        
        if (faqItems.length < 2) {
            const defaultFAQs = [
                { 
                    question: 'What are the key features of this device?', 
                    answer: 'This device comes with impressive specifications including a powerful processor, high-quality camera system, and long-lasting battery life.' 
                },
                { 
                    question: 'Is this device worth buying?', 
                    answer: 'Based on the review and specifications, this device offers good value for its price point, with competitive features compared to other devices in its category.' 
                }
            ];
            
            while (faqItems.length < 3) {
                const defaultFaq = defaultFAQs[faqItems.length];
                if (defaultFaq && !faqItems.find(f => f.question === defaultFaq.question)) {
                    faqItems.push(defaultFaq);
                } else {
                    break;
                }
            }
        }
        
        return faqItems;
    }

    generatePostHtml(article, articleContent) {
        const formattedDate = this.formatDate(article.date);
        const readTime = this.estimateReadTime(articleContent.length);
        const slug = this.generateSlug(article.title);
        
        const $ = cheerio.load(`<div>${articleContent}</div>`);
        const faqs = this.generateFAQ($, $('div'));
        
        const categoryIcons = {
            'Review': 'fa-star',
            'News': 'fa-newspaper',
            'Blog': 'fa-blog'
        };
        const categoryIcon = categoryIcons[article.category] || 'fa-star';
        
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="Read our detailed coverage of ${article.title}. Get insights, analysis, and everything you need to know.">
    <meta property="og:title" content="${article.title}">
    <meta property="og:description" content="Read our detailed coverage of ${article.title}. Get insights, analysis, and everything you need to know.">
    ${article.image ? `<meta property="og:image" content="${article.image}">` : ''}
    <meta property="og:type" content="article">
    <meta name="twitter:card" content="summary_large_image">
    <title>${article.title}</title>
    <script type="application/ld+json">
    {
        "@context": "https://schema.org",
        "@type": "TechArticle",
        "headline": "${article.title.replace(/"/g, '\\"')}",
        ${article.image ? `"image": "${article.image}",` : ''}
        "datePublished": "${article.date}",
        "author": {
            "@type": "Organization",
            "name": "${SETTINGS.authorName}"
        },
        "publisher": {
            "@type": "Organization",
            "name": "${SETTINGS.authorName}"
        },
        "description": "Read our detailed coverage of ${article.title.replace(/"/g, '\\"')}. Get insights, analysis, and everything you need to know."
    }
    </script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            background: linear-gradient(135deg, #f5f7fa 0%, #e8ecf1 100%);
            padding: 20px;
            line-height: 1.7;
            color: #1a1a2e;
            min-height: 100vh;
        }
        
        .article-card {
            max-width: 880px;
            margin: 0 auto;
            background: #ffffff;
            border-radius: 24px;
            overflow: hidden;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.15);
            transition: transform 0.3s ease;
        }
        
        .article-inner {
            padding: 40px 48px;
        }
        
        .category-badge {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            background: linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%);
            color: #4f46e5;
            font-size: 0.8rem;
            font-weight: 600;
            padding: 6px 16px;
            border-radius: 30px;
            margin-bottom: 20px;
            letter-spacing: 0.3px;
        }
        
        .category-badge i {
            font-size: 0.9rem;
        }
        
        h1 {
            font-size: 2.4rem;
            font-weight: 800;
            line-height: 1.25;
            margin-bottom: 16px;
            color: #0f172a;
            letter-spacing: -0.5px;
        }
        
        .article-meta {
            display: flex;
            gap: 24px;
            font-size: 0.88rem;
            color: #64748b;
            margin: 20px 0 28px;
            padding-bottom: 20px;
            border-bottom: 2px solid #f1f5f9;
            flex-wrap: wrap;
        }
        
        .article-meta span {
            display: flex;
            align-items: center;
            gap: 6px;
        }
        
        .article-meta i {
            color: #6366f1;
            font-size: 0.9rem;
        }
        
        .featured-image-wrapper {
            position: relative;
            margin: 24px 0 32px;
            border-radius: 20px;
            overflow: hidden;
            background: #f8fafc;
        }
        
        .featured-image-wrapper img {
            width: 100%;
            display: block;
            aspect-ratio: 16/9;
            object-fit: cover;
            transition: transform 0.5s ease;
        }
        
        .featured-image-wrapper:hover img {
            transform: scale(1.02);
        }
        
        .article-content {
            color: #334155;
        }
        
        .article-content h2 {
            font-size: 1.6rem;
            font-weight: 700;
            margin: 32px 0 16px;
            padding-left: 14px;
            border-left: 4px solid #6366f1;
            color: #1e293b;
        }
        
        .article-content h3 {
            font-size: 1.25rem;
            font-weight: 600;
            margin: 24px 0 12px;
            color: #334155;
        }
        
        .article-content p {
            margin-bottom: 1.2rem;
            line-height: 1.8;
            color: #475569;
        }
        
        .article-content img {
            width: 100%;
            max-width: 800px;
            height: auto;
            aspect-ratio: 16/9;
            object-fit: cover;
            border-radius: 16px;
            margin: 28px auto;
            display: block;
            box-shadow: 0 8px 25px rgba(0, 0, 0, 0.08);
        }
        
        .highlight-box {
            background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
            border-left: 4px solid #0ea5e9;
            padding: 20px 24px;
            border-radius: 16px;
            margin: 28px 0;
        }
        
        .highlight-box strong {
            color: #0284c7;
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 14px;
            font-size: 1.1rem;
        }
        
        .highlight-box ul {
            list-style: none;
            padding: 0;
        }
        
        .highlight-box ul li {
            padding: 6px 0;
            color: #475569;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .highlight-box ul li:before {
            content: "▸";
            color: #0ea5e9;
            font-weight: bold;
        }
        
        .faq-section {
            background: #f8fafc;
            border-radius: 20px;
            padding: 28px;
            margin: 36px 0 20px;
            border: 1px solid #e2e8f0;
        }
        
        .faq-section h2 {
            font-size: 1.5rem;
            font-weight: 700;
            margin-bottom: 20px;
            color: #1e293b;
            display: flex;
            align-items: center;
            gap: 10px;
            border: none;
            padding: 0;
        }
        
        .faq-item {
            margin-bottom: 20px;
            padding-bottom: 16px;
            border-bottom: 1px solid #e2e8f0;
        }
        
        .faq-item:last-child {
            border-bottom: none;
            margin-bottom: 0;
            padding-bottom: 0;
        }
        
        .faq-item strong {
            display: block;
            margin-bottom: 8px;
            color: #1e293b;
            font-size: 1rem;
        }
        
        .faq-item p {
            color: #64748b;
            font-size: 0.95rem;
        }
        
        .author-box {
            background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
            border-radius: 20px;
            padding: 22px;
            margin: 36px 0 16px;
            display: flex;
            gap: 18px;
            align-items: center;
            border: 1px solid #e2e8f0;
        }
        
        .author-avatar {
            width: 56px;
            height: 56px;
            background: linear-gradient(135deg, #6366f1, #8b5cf6);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.4rem;
            color: white;
            flex-shrink: 0;
        }
        
        .author-info h4 {
            margin-bottom: 4px;
            color: #1e293b;
            font-size: 1.05rem;
        }
        
        .author-info p {
            font-size: 0.85rem;
            color: #64748b;
            margin: 0;
        }
        
        .article-footer {
            margin-top: 20px;
            padding-top: 16px;
            border-top: 2px solid #f1f5f9;
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 12px;
        }
        
        .tags {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
        }
        
        .tag {
            background: #f1f5f9;
            color: #64748b;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 0.78rem;
            font-weight: 500;
        }
        
        .copyright {
            font-size: 0.8rem;
            color: #94a3b8;
        }
        
        @media (max-width: 768px) {
            body {
                padding: 12px;
            }
            
            .article-inner {
                padding: 24px 20px;
            }
            
            h1 {
                font-size: 1.7rem;
            }
            
            .article-meta {
                gap: 12px;
                font-size: 0.8rem;
            }
            
            .article-content h2 {
                font-size: 1.3rem;
            }
        }
        
        @media (max-width: 480px) {
            .article-inner {
                padding: 18px 14px;
            }
            
            h1 {
                font-size: 1.4rem;
            }
        }
    </style>
</head>
<body>
    <div class="article-card">
        <div class="article-inner">
            <div class="category-badge">
                <i class="fas ${categoryIcon}"></i> ${article.category}
            </div>
            
            <h1>${article.title}</h1>
            
            <div class="article-meta">
                <span><i class="far fa-calendar-alt"></i> ${formattedDate}</span>
                <span><i class="far fa-user"></i> ${SETTINGS.authorName}</span>
                <span><i class="far fa-clock"></i> ${readTime}</span>
            </div>
            
            ${article.image ? `
            <div class="featured-image-wrapper">
                <img src="${article.image}" alt="${article.title}" loading="eager">
            </div>` : ''}
            
            <div class="article-content">
                ${articleContent}
                
                <div class="highlight-box">
                    <strong><i class="fas fa-lightbulb"></i> Key Highlights</strong>
                    <ul>
                        <li>Comprehensive analysis and detailed breakdown</li>
                        <li>Latest information and expert insights</li>
                        <li>Everything you need to know about ${article.title.split(' ').slice(0, 5).join(' ')}</li>
                    </ul>
                </div>
                
                ${faqs.length > 0 ? `
                <div class="faq-section">
                    <h2><i class="fas fa-question-circle" style="color:#6366f1;"></i> Frequently Asked Questions</h2>
                    ${faqs.map(faq => `
                    <div class="faq-item">
                        <strong>Q: ${faq.question}</strong>
                        <p>A: ${faq.answer}</p>
                    </div>`).join('')}
                </div>` : ''}
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
                    <span class="tag">${article.category}</span>
                    <span class="tag">Tech</span>
                    <span class="tag">Analysis</span>
                </div>
                <div class="copyright">
                    <i class="far fa-copyright"></i> ${SETTINGS.authorName} ${new Date().getFullYear()}
                </div>
            </div>
        </div>
    </div>
</body>
</html>`;
    }

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
            console.error('❌ فشل الحصول على access token:', error.message);
            if (error.response) {
                console.error('   الحالة:', error.response.status);
                console.error('   الرسالة:', JSON.stringify(error.response.data, null, 2));
            }
            throw error;
        }
    }

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
            return true;
        } catch (error) {
            console.error('❌ فشل التحقق من المدونة:', error.message);
            if (error.response) {
                console.error('   الحالة:', error.response.status);
            }
            return false;
        }
    }

    async publishToBlogger(postTitle, postContent, labels) {
        try {
            const accessToken = await this.getAccessToken();
            
            const hasAccess = await this.verifyBlogAccess(accessToken);
            if (!hasAccess) {
                throw new Error('لا توجد صلاحية للوصول إلى المدونة');
            }
            
            console.log('📝 جاري نشر المقال...');
            const postData = {
                kind: 'blogger#post',
                title: postTitle,
                content: postContent,
                labels: labels || ['Tech', 'News', 'Analysis']
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
            } else {
                console.error('   الخطأ:', error.message);
            }
            
            return { 
                success: false, 
                error: error.message 
            };
        }
    }

    async saveLocalBackup(title, content, category) {
        try {
            await fs.ensureDir(SETTINGS.postsDir);
            
            const date = new Date().toISOString().split('T')[0];
            const safeTitle = title
                .replace(/[<>:"/\\|?*]/g, '')
                .replace(/\s+/g, '_')
                .substring(0, 60);
            const categoryDir = path.join(SETTINGS.postsDir, category.toLowerCase());
            await fs.ensureDir(categoryDir);
            
            const fileName = path.join(categoryDir, `${date}_${safeTitle}.html`);
            await fs.writeFile(fileName, content, 'utf8');
            console.log(`💾 تم حفظ نسخة محلية: ${fileName}`);
            return fileName;
        } catch (error) {
            console.error('❌ فشل حفظ النسخة المحلية:', error.message);
            return null;
        }
    }

    async run() {
        console.log('\n' + '='.repeat(70));
        console.log('🚀 نظام النشر التلقائي من GSMArena - الإصدار المحسن');
        console.log('='.repeat(70));
        console.log(`📅 التاريخ: ${new Date().toLocaleString('en-US')}`);
        console.log(`📊 المقالات المنشورة سابقاً: ${this.state.publishedUrls.length}`);
        console.log('='.repeat(70));
        
        try {
            const articles = await this.getLatestArticles();
            
            if (articles.length === 0) {
                console.log('\n⚠️ لم يتم العثور على مقالات جديدة.');
                return;
            }
            
            const unpublishedArticles = articles.filter(article => 
                !this.isArticlePublished(article.link, article.title)
            );
            
            if (unpublishedArticles.length === 0) {
                console.log('\n⚠️ جميع المقالات تم نشرها مسبقاً.');
                return;
            }
            
            console.log(`\n📋 تم العثور على ${unpublishedArticles.length} مقالات جديدة للنشر`);
            
            for (let i = 0; i < unpublishedArticles.length; i++) {
                const article = unpublishedArticles[i];
                
                console.log(`\n${'─'.repeat(50)}`);
                console.log(`📄 معالجة المقال ${i + 1}/${unpublishedArticles.length}`);
                console.log(`   📱 العنوان: ${article.title}`);
                console.log(`   📂 الفئة: ${article.category}`);
                console.log(`   🔗 الرابط: ${article.link}`);
                console.log(`   📅 التاريخ: ${article.date}`);
                if (article.image) {
                    console.log(`   🖼️ الصورة: ${article.image.substring(0, 60)}...`);
                }
                console.log(`${'─'.repeat(50)}`);
                
                try {
                    console.log('\n📄 جاري استخراج محتوى المقال...');
                    const articleContent = await this.extractArticleContent(article.link);
                    console.log(`✅ تم استخراج المحتوى (${articleContent.length} حرف)`);
                    
                    console.log('\n🛠️ جاري توليد HTML...');
                    const postHtml = this.generatePostHtml(article, articleContent);
                    console.log('✅ تم توليد HTML');
                    
                    console.log('\n💾 جاري حفظ نسخة محلية...');
                    await this.saveLocalBackup(article.title, postHtml, article.category);
                    
                    console.log('\n📤 جاري النشر على بلوجر...');
                    const postTitle = article.title;
                    const labels = ['Tech', article.category, 'GSMArena', 'Analysis'];
                    const publishResult = await this.publishToBlogger(postTitle, postHtml, labels);
                    
                    if (publishResult.success) {
                        this.state.publishedUrls.push(article.link);
                        this.state.publishedTitles.push(article.title);
                        this.saveState();
                        
                        console.log(`\n🎉 تم نشر "${article.title}" بنجاح!`);
                        console.log(`🔗 ${publishResult.url}`);
                    } else {
                        console.log(`\n⚠️ فشل نشر "${article.title}"`);
                        console.log('💡 تم حفظ نسخة محلية للنشر اليدوي');
                    }
                    
                    if (i < unpublishedArticles.length - 1) {
                        console.log('\n⏳ انتظار 3 ثواني قبل المقال التالي...');
                        await new Promise(resolve => setTimeout(resolve, 3000));
                    }
                    
                } catch (error) {
                    console.error(`\n❌ فشل معالجة المقال "${article.title}":`, error.message);
                }
            }
            
            console.log('\n' + '='.repeat(70));
            console.log('📊 ملخص النشر:');
            console.log(`   📦 إجمالي المقالات المحفوظة: ${this.state.publishedUrls.length}`);
            console.log(`   📁 النسخ المحلية محفوظة في: ${SETTINGS.postsDir}/`);
            console.log('='.repeat(70));
            
        } catch (error) {
            console.error('\n' + '='.repeat(70));
            console.error('❌ فشل التشغيل:', error.message);
            console.error('='.repeat(70));
        }
    }
}

// ===== تشغيل التطبيق =====
console.log('📢 بدء تشغيل مستخرج مراجعات GSMArena - الإصدار المحسن');
console.log('⏰ الوقت:', new Date().toLocaleString('en-US'));

const publisher = new AutoPublisher();
publisher.run().then(() => {
    console.log('\n✅ اكتمل التنفيذ');
}).catch(error => {
    console.error('\n❌ فشل البرنامج:', error.message);
});
