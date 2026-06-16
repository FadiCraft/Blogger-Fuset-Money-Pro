const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs-extra');
const path = require('path');

// ===== إعدادات Blogger =====
const BLOGGER_CONFIG = {
    blogId: '5107716259688743212',
    blogName: 'ZeeoXForU',
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

// ===== قوالب التصميم المتعددة =====
const DESIGN_TEMPLATES = [
    {
        name: 'modern-gradient',
        primaryColor: '#6366f1',
        secondaryColor: '#8b5cf6',
        bgGradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        cardBg: '#ffffff',
        textColor: '#1a1a2e',
        accentColor: '#4f46e5',
        badgeBg: 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)'
    },
    {
        name: 'dark-elegant',
        primaryColor: '#0ea5e9',
        secondaryColor: '#06b6d4',
        bgGradient: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
        cardBg: '#1e293b',
        textColor: '#e2e8f0',
        accentColor: '#38bdf8',
        badgeBg: 'rgba(14, 165, 233, 0.1)'
    },
    {
        name: 'warm-minimal',
        primaryColor: '#f59e0b',
        secondaryColor: '#ef4444',
        bgGradient: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
        cardBg: '#ffffff',
        textColor: '#1c1917',
        accentColor: '#d97706',
        badgeBg: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)'
    },
    {
        name: 'nature-fresh',
        primaryColor: '#10b981',
        secondaryColor: '#059669',
        bgGradient: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)',
        cardBg: '#ffffff',
        textColor: '#064e3b',
        accentColor: '#047857',
        badgeBg: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)'
    }
];

class AutoPublisher {
    constructor() {
        this.state = this.loadState();
        this.newArticles = [];
        this.currentTemplate = this.getRandomTemplate();
    }

    getRandomTemplate() {
        return DESIGN_TEMPLATES[Math.floor(Math.random() * DESIGN_TEMPLATES.length)];
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
            lastRun: null,
            publishedCount: 0
        };
    }

    saveState() {
        try {
            this.state.lastRun = new Date().toISOString();
            this.state.publishedCount = this.state.publishedUrls.length;
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

    getRandomCategoryIcon() {
        const icons = ['fa-star', 'fa-bolt', 'fa-fire', 'fa-rocket', 'fa-gem', 'fa-crown'];
        return icons[Math.floor(Math.random() * icons.length)];
    }

    generateTableOfContents(content) {
        const $ = cheerio.load(`<div>${content}</div>`);
        const headings = $('h2, h3');
        const tocItems = [];
        
        headings.each((i, heading) => {
            if (i >= 6) return false;
            const $heading = $(heading);
            const text = $heading.text().trim();
            const id = 'section-' + text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
            $heading.attr('id', id);
            tocItems.push({
                text,
                id,
                level: heading.tagName.toLowerCase()
            });
        });
        
        return { items: tocItems, modifiedContent: $('div').html() };
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
                    answer: 'This device comes with impressive specifications including a powerful processor, high-quality camera system, and long-lasting battery life that sets it apart from competitors.' 
                },
                { 
                    question: 'Is this device worth buying in 2024?', 
                    answer: 'Based on our comprehensive analysis, this device offers excellent value for its price point, with competitive features that make it a strong contender in its category.' 
                },
                {
                    question: 'How does it compare to competitors?',
                    answer: 'When compared to similar devices in its price range, this model stands out with its superior build quality, performance metrics, and user experience.'
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
        this.currentTemplate = this.getRandomTemplate();
        const template = this.currentTemplate;
        const formattedDate = this.formatDate(article.date);
        const readTime = this.estimateReadTime(articleContent.length);
        const slug = this.generateSlug(article.title);
        const categoryIcon = this.getRandomCategoryIcon();
        
        const $ = cheerio.load(`<div>${articleContent}</div>`);
        const tocData = this.generateTableOfContents(articleContent);
        const modifiedContent = tocData.modifiedContent;
        const faqs = this.generateFAQ($, $('div'));
        
        const isDark = template.name === 'dark-elegant';
        const bgColor = isDark ? '#0f172a' : '#f8fafc';
        const textColor = isDark ? '#e2e8f0' : '#1e293b';
        const cardBg = isDark ? '#1e293b' : '#ffffff';
        const borderColor = isDark ? '#334155' : '#e2e8f0';
        
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="Comprehensive coverage of ${article.title}. Expert analysis, detailed insights, and everything you need to know about this device.">
    <meta name="keywords" content="${article.title}, tech review, smartphone review, GSMArena, ZeeoXForU, technology news">
    <meta property="og:title" content="${article.title} | ZeeoXForU">
    <meta property="og:description" content="Comprehensive coverage of ${article.title}. Expert analysis, detailed insights, and everything you need to know.">
    ${article.image ? `<meta property="og:image" content="${article.image}">` : ''}
    <meta property="og:type" content="article">
    <meta property="og:site_name" content="ZeeoXForU">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${article.title} | ZeeoXForU">
    <meta name="twitter:description" content="Comprehensive coverage of ${article.title}. Expert analysis and detailed insights.">
    ${article.image ? `<meta name="twitter:image" content="${article.image}">` : ''}
    <title>${article.title} | ZeeoXForU</title>
    
    <script type="application/ld+json">
    {
        "@context": "https://schema.org",
        "@type": "TechArticle",
        "headline": "${article.title.replace(/"/g, '\\"')}",
        ${article.image ? `"image": "${article.image}",` : ''}
        "datePublished": "${article.date}",
        "dateModified": "${new Date().toISOString().split('T')[0]}",
        "author": {
            "@type": "Organization",
            "name": "${SETTINGS.authorName}",
            "url": "${SETTINGS.siteUrl}"
        },
        "publisher": {
            "@type": "Organization",
            "name": "ZeeoXForU",
            "logo": {
                "@type": "ImageObject",
                "url": "${SETTINGS.siteUrl}logo.png"
            }
        },
        "description": "Comprehensive coverage of ${article.title.replace(/"/g, '\\"')}. Expert analysis, detailed insights, and everything you need to know.",
        "mainEntityOfPage": {
            "@type": "WebPage",
            "@id": "${SETTINGS.siteUrl}${slug}"
        }
    }
    </script>
    
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
    
    <style>
        :root {
            --primary: ${template.primaryColor};
            --secondary: ${template.secondaryColor};
            --accent: ${template.accentColor};
            --bg: ${bgColor};
            --text: ${textColor};
            --card: ${cardBg};
            --border: ${borderColor};
            --badge-bg: ${template.badgeBg};
        }
        
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            background: var(--bg);
            color: var(--text);
            line-height: 1.7;
            min-height: 100vh;
            transition: background 0.3s ease;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }
        
        .article-wrapper {
            max-width: 900px;
            margin: 30px auto;
            background: var(--card);
            border-radius: 24px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.1);
            overflow: hidden;
            border: 1px solid var(--border);
            transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        
        .article-wrapper:hover {
            transform: translateY(-2px);
            box-shadow: 0 25px 70px rgba(0, 0, 0, 0.15);
        }
        
        .article-header {
            padding: 40px 48px 0;
        }
        
        .breadcrumb {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 24px;
            font-size: 0.85rem;
            color: var(--text);
            opacity: 0.7;
        }
        
        .breadcrumb a {
            color: var(--primary);
            text-decoration: none;
            transition: color 0.2s;
        }
        
        .breadcrumb a:hover {
            color: var(--secondary);
        }
        
        .category-badge {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            background: var(--badge-bg);
            color: var(--primary);
            font-size: 0.8rem;
            font-weight: 600;
            padding: 8px 20px;
            border-radius: 30px;
            margin-bottom: 20px;
            letter-spacing: 0.5px;
            text-transform: uppercase;
            border: 1px solid var(--primary);
            border-opacity: 0.2;
        }
        
        .category-badge i {
            font-size: 0.9rem;
            animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.1); }
        }
        
        h1 {
            font-size: 2.8rem;
            font-weight: 900;
            line-height: 1.2;
            margin-bottom: 20px;
            color: var(--text);
            letter-spacing: -1px;
            background: linear-gradient(135deg, var(--primary), var(--secondary));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        
        .article-meta {
            display: flex;
            gap: 24px;
            align-items: center;
            flex-wrap: wrap;
            padding-bottom: 24px;
            border-bottom: 2px solid var(--border);
            margin-bottom: 24px;
            font-size: 0.9rem;
            color: var(--text);
            opacity: 0.8;
        }
        
        .article-meta span {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .article-meta i {
            color: var(--primary);
        }
        
        .social-share {
            display: flex;
            gap: 12px;
            margin-left: auto;
        }
        
        .social-share a {
            color: var(--text);
            opacity: 0.6;
            transition: all 0.3s;
            font-size: 1.2rem;
        }
        
        .social-share a:hover {
            opacity: 1;
            color: var(--primary);
            transform: translateY(-2px);
        }
        
        .featured-image-wrapper {
            margin: 0 48px 32px;
            border-radius: 20px;
            overflow: hidden;
            position: relative;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
        }
        
        .featured-image-wrapper img {
            width: 100%;
            height: auto;
            display: block;
            aspect-ratio: 16/9;
            object-fit: cover;
            transition: transform 0.5s ease;
        }
        
        .featured-image-wrapper:hover img {
            transform: scale(1.05);
        }
        
        .image-overlay {
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            background: linear-gradient(transparent, rgba(0,0,0,0.7));
            padding: 40px 24px 20px;
            color: white;
            font-size: 0.85rem;
        }
        
        .article-body {
            padding: 0 48px 40px;
        }
        
        .table-of-contents {
            background: var(--badge-bg);
            border-radius: 16px;
            padding: 24px;
            margin-bottom: 32px;
            border: 1px solid var(--border);
        }
        
        .table-of-contents h3 {
            font-size: 1.2rem;
            margin-bottom: 16px;
            color: var(--primary);
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .table-of-contents ul {
            list-style: none;
            padding: 0;
        }
        
        .table-of-contents li {
            padding: 6px 0;
            padding-left: 0;
            transition: padding-left 0.3s;
        }
        
        .table-of-contents li:hover {
            padding-left: 10px;
        }
        
        .table-of-contents a {
            color: var(--text);
            text-decoration: none;
            font-size: 0.95rem;
            transition: color 0.3s;
            opacity: 0.8;
        }
        
        .table-of-contents a:hover {
            color: var(--primary);
            opacity: 1;
        }
        
        .article-content {
            line-height: 1.8;
        }
        
        .article-content h2 {
            font-size: 1.8rem;
            font-weight: 700;
            margin: 40px 0 20px;
            padding-left: 16px;
            border-left: 4px solid var(--primary);
            color: var(--text);
            scroll-margin-top: 20px;
        }
        
        .article-content h3 {
            font-size: 1.4rem;
            font-weight: 600;
            margin: 30px 0 16px;
            color: var(--text);
            scroll-margin-top: 20px;
        }
        
        .article-content p {
            margin-bottom: 1.3rem;
            color: var(--text);
            opacity: 0.9;
        }
        
        .article-content img {
            width: 100%;
            max-width: 100%;
            height: auto;
            aspect-ratio: 16/9;
            object-fit: cover;
            border-radius: 16px;
            margin: 30px 0;
            box-shadow: 0 8px 30px rgba(0, 0, 0, 0.1);
            transition: transform 0.3s ease;
        }
        
        .article-content img:hover {
            transform: scale(1.02);
        }
        
        .article-content ul, .article-content ol {
            margin: 20px 0;
            padding-left: 24px;
        }
        
        .article-content li {
            margin-bottom: 10px;
        }
        
        .highlight-box {
            background: linear-gradient(135deg, var(--badge-bg), transparent);
            border-left: 4px solid var(--primary);
            padding: 24px;
            border-radius: 16px;
            margin: 30px 0;
        }
        
        .highlight-box h3 {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 16px;
            color: var(--primary);
        }
        
        .highlight-box ul {
            list-style: none;
            padding: 0;
        }
        
        .highlight-box ul li {
            padding: 8px 0;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .highlight-box ul li:before {
            content: "▸";
            color: var(--primary);
            font-weight: bold;
        }
        
        .pros-cons {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin: 30px 0;
        }
        
        .pros, .cons {
            padding: 20px;
            border-radius: 16px;
        }
        
        .pros {
            background: rgba(16, 185, 129, 0.1);
            border: 1px solid rgba(16, 185, 129, 0.2);
        }
        
        .cons {
            background: rgba(239, 68, 68, 0.1);
            border: 1px solid rgba(239, 68, 68, 0.2);
        }
        
        .pros h4, .cons h4 {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 12px;
        }
        
        .pros h4 { color: #10b981; }
        .cons h4 { color: #ef4444; }
        
        .faq-section {
            background: var(--badge-bg);
            border-radius: 20px;
            padding: 32px;
            margin: 40px 0 20px;
            border: 1px solid var(--border);
        }
        
        .faq-section h2 {
            font-size: 1.6rem;
            font-weight: 700;
            margin-bottom: 24px;
            color: var(--text);
            display: flex;
            align-items: center;
            gap: 12px;
            border: none;
            padding: 0;
        }
        
        .faq-item {
            margin-bottom: 24px;
            padding-bottom: 20px;
            border-bottom: 1px solid var(--border);
            transition: transform 0.3s;
        }
        
        .faq-item:hover {
            transform: translateX(5px);
        }
        
        .faq-item:last-child {
            border-bottom: none;
            margin-bottom: 0;
            padding-bottom: 0;
        }
        
        .faq-item .question {
            font-weight: 600;
            margin-bottom: 10px;
            color: var(--primary);
            font-size: 1.05rem;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .faq-item .answer {
            color: var(--text);
            opacity: 0.8;
            line-height: 1.6;
        }
        
        .author-box {
            background: linear-gradient(135deg, var(--badge-bg), transparent);
            border-radius: 20px;
            padding: 24px;
            margin: 40px 0 20px;
            display: flex;
            gap: 20px;
            align-items: center;
            border: 1px solid var(--border);
        }
        
        .author-avatar {
            width: 64px;
            height: 64px;
            background: linear-gradient(135deg, var(--primary), var(--secondary));
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.5rem;
            color: white;
            flex-shrink: 0;
        }
        
        .author-info h4 {
            margin-bottom: 4px;
            color: var(--text);
            font-size: 1.1rem;
        }
        
        .author-info p {
            font-size: 0.9rem;
            color: var(--text);
            opacity: 0.7;
            margin: 0;
        }
        
        .article-footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 2px solid var(--border);
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 16px;
        }
        
        .tags {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
        }
        
        .tag {
            background: var(--badge-bg);
            color: var(--primary);
            padding: 6px 14px;
            border-radius: 20px;
            font-size: 0.8rem;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.3s;
            border: 1px solid transparent;
        }
        
        .tag:hover {
            border-color: var(--primary);
            transform: translateY(-1px);
        }
        
        .newsletter-signup {
            background: linear-gradient(135deg, var(--primary), var(--secondary));
            border-radius: 20px;
            padding: 32px;
            margin: 40px 0 20px;
            text-align: center;
            color: white;
        }
        
        .newsletter-signup h3 {
            font-size: 1.5rem;
            margin-bottom: 12px;
        }
        
        .newsletter-signup p {
            margin-bottom: 20px;
            opacity: 0.9;
        }
        
        .newsletter-form {
            display: flex;
            gap: 12px;
            max-width: 500px;
            margin: 0 auto;
        }
        
        .newsletter-form input {
            flex: 1;
            padding: 12px 16px;
            border-radius: 12px;
            border: none;
            font-size: 0.95rem;
        }
        
        .newsletter-form button {
            padding: 12px 24px;
            background: white;
            color: var(--primary);
            border: none;
            border-radius: 12px;
            font-weight: 600;
            cursor: pointer;
            transition: transform 0.3s;
        }
        
        .newsletter-form button:hover {
            transform: scale(1.05);
        }
        
        .related-posts {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin: 40px 0;
        }
        
        .related-post {
            background: var(--badge-bg);
            border-radius: 16px;
            overflow: hidden;
            border: 1px solid var(--border);
            transition: transform 0.3s;
            cursor: pointer;
        }
        
        .related-post:hover {
            transform: translateY(-4px);
        }
        
        .related-post img {
            width: 100%;
            aspect-ratio: 16/9;
            object-fit: cover;
        }
        
        .related-post-info {
            padding: 16px;
        }
        
        .related-post-info h4 {
            font-size: 0.95rem;
            margin-bottom: 8px;
            color: var(--text);
        }
        
        .related-post-info .date {
            font-size: 0.8rem;
            opacity: 0.6;
        }
        
        .copyright {
            font-size: 0.85rem;
            opacity: 0.6;
            text-align: center;
            padding: 20px 0;
        }
        
        @media (max-width: 768px) {
            .container {
                padding: 12px;
            }
            
            .article-header {
                padding: 24px 20px 0;
            }
            
            .article-body {
                padding: 0 20px 24px;
            }
            
            .featured-image-wrapper {
                margin: 0 20px 24px;
            }
            
            h1 {
                font-size: 2rem;
            }
            
            .pros-cons {
                grid-template-columns: 1fr;
            }
            
            .article-meta {
                gap: 12px;
                font-size: 0.8rem;
            }
            
            .social-share {
                margin-left: 0;
            }
            
            .newsletter-form {
                flex-direction: column;
            }
        }
        
        @media (max-width: 480px) {
            h1 {
                font-size: 1.6rem;
            }
            
            .article-header {
                padding: 18px 14px 0;
            }
            
            .article-body {
                padding: 0 14px 18px;
            }
            
            .featured-image-wrapper {
                margin: 0 14px 18px;
            }
        }
        
        .ad-container {
            margin: 30px 0;
            padding: 20px;
            background: var(--badge-bg);
            border-radius: 16px;
            text-align: center;
            border: 1px dashed var(--border);
        }
        
        .ad-label {
            font-size: 0.7rem;
            text-transform: uppercase;
            letter-spacing: 2px;
            opacity: 0.5;
            margin-bottom: 8px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="article-wrapper">
            <div class="article-header">
                <div class="breadcrumb">
                    <a href="${SETTINGS.siteUrl}"><i class="fas fa-home"></i> Home</a>
                    <i class="fas fa-chevron-right" style="font-size:0.7rem;"></i>
                    <a href="${SETTINGS.siteUrl}category/${article.category.toLowerCase()}">${article.category}</a>
                    <i class="fas fa-chevron-right" style="font-size:0.7rem;"></i>
                    <span>${article.title.substring(0, 50)}...</span>
                </div>
                
                <div class="category-badge">
                    <i class="fas ${categoryIcon}"></i> ${article.category}
                </div>
                
                <h1>${article.title}</h1>
                
                <div class="article-meta">
                    <span><i class="far fa-calendar-alt"></i> ${formattedDate}</span>
                    <span><i class="far fa-user"></i> ${SETTINGS.authorName}</span>
                    <span><i class="far fa-clock"></i> ${readTime}</span>
                    <span><i class="far fa-eye"></i> ${Math.floor(Math.random() * 1000) + 500} views</span>
                    <div class="social-share">
                        <a href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(SETTINGS.siteUrl + slug)}" title="Share on Facebook"><i class="fab fa-facebook-f"></i></a>
                        <a href="https://twitter.com/intent/tweet?url=${encodeURIComponent(SETTINGS.siteUrl + slug)}&text=${encodeURIComponent(article.title)}" title="Share on Twitter"><i class="fab fa-twitter"></i></a>
                        <a href="https://www.linkedin.com/shareArticle?mini=true&url=${encodeURIComponent(SETTINGS.siteUrl + slug)}" title="Share on LinkedIn"><i class="fab fa-linkedin-in"></i></a>
                        <a href="whatsapp://send?text=${encodeURIComponent(article.title + ' ' + SETTINGS.siteUrl + slug)}" title="Share on WhatsApp"><i class="fab fa-whatsapp"></i></a>
                    </div>
                </div>
            </div>
            
            ${article.image ? `
            <div class="featured-image-wrapper">
                <img src="${article.image}" alt="${article.title}" loading="eager">
                <div class="image-overlay">
                    <span>📸 Image courtesy of GSMArena</span>
                </div>
            </div>` : ''}
            
            <div class="article-body">
                ${tocData.items.length > 0 ? `
                <div class="table-of-contents">
                    <h3><i class="fas fa-list-ul"></i> Table of Contents</h3>
                    <ul>
                        ${tocData.items.map(item => `
                        <li style="padding-left: ${item.level === 'h3' ? '20px' : '0'};">
                            <a href="#${item.id}">${item.text}</a>
                        </li>`).join('')}
                    </ul>
                </div>` : ''}
                
                <div class="article-content">
                    ${modifiedContent}
                    
                    <div class="pros-cons">
                        <div class="pros">
                            <h4><i class="fas fa-check-circle"></i> Pros</h4>
                            <ul>
                                <li>Outstanding performance and speed</li>
                                <li>Premium build quality and design</li>
                                <li>Long-lasting battery life</li>
                            </ul>
                        </div>
                        <div class="cons">
                            <h4><i class="fas fa-times-circle"></i> Cons</h4>
                            <ul>
                                <li>Premium pricing segment</li>
                                <li>No expandable storage</li>
                                <li>Average low-light camera performance</li>
                            </ul>
                        </div>
                    </div>
                    
                    <div class="highlight-box">
                        <h3><i class="fas fa-lightbulb"></i> Key Takeaways</h3>
                        <ul>
                            <li>Comprehensive analysis covering all aspects of the device</li>
                            <li>Expert insights based on real-world testing and benchmarks</li>
                            <li>Detailed comparison with competitors in the same segment</li>
                            <li>Honest assessment of strengths and weaknesses</li>
                        </ul>
                    </div>
                    
                    <div class="ad-container">
                        <div class="ad-label">Advertisement</div>
                        <!-- AdSense Ad Unit -->
                        <ins class="adsbygoogle"
                             style="display:block; text-align:center;"
                             data-ad-layout="in-article"
                             data-ad-format="fluid"
                             data-ad-client="ca-pub-XXXXXXXXXXXXXXXX"
                             data-ad-slot="XXXXXXXXXX"></ins>
                    </div>
                    
                    ${faqs.length > 0 ? `
                    <div class="faq-section">
                        <h2><i class="fas fa-question-circle" style="color: var(--primary);"></i> Frequently Asked Questions</h2>
                        ${faqs.map(faq => `
                        <div class="faq-item">
                            <div class="question"><i class="fas fa-chevron-right" style="font-size:0.8rem;"></i> ${faq.question}</div>
                            <div class="answer">${faq.answer}</div>
                        </div>`).join('')}
                    </div>` : ''}
                </div>
                
                <div class="newsletter-signup">
                    <h3><i class="fas fa-envelope-open-text"></i> Stay Updated with ZeeoXForU</h3>
                    <p>Get the latest tech reviews, news, and exclusive content delivered straight to your inbox.</p>
                    <form class="newsletter-form">
                        <input type="email" placeholder="Enter your email address" required>
                        <button type="submit">Subscribe</button>
                    </form>
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
                        <span class="tag">#${article.category}</span>
                        <span class="tag">#TechReview</span>
                        <span class="tag">#Smartphones</span>
                        <span class="tag">#GSMArena</span>
                    </div>
                    <div class="copyright">
                        <i class="far fa-copyright"></i> ${new Date().getFullYear()} ZeeoXForU. All rights reserved.
                    </div>
                </div>
            </div>
        </div>
    </div>
    
    <script>
        // تحسين تجربة المستخدم
        document.addEventListener('DOMContentLoaded', function() {
            // إضافة تأثير التمرير السلس للروابط
            document.querySelectorAll('a[href^="#"]').forEach(anchor => {
                anchor.addEventListener('click', function(e) {
                    e.preventDefault();
                    const target = document.querySelector(this.getAttribute('href'));
                    if (target) {
                        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                });
            });
            
            // إضافة تأثيرات التفاعل
            document.querySelectorAll('.faq-item').forEach(item => {
                item.style.cursor = 'pointer';
            });
        });
    </script>
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
                labels: labels || ['Tech', 'Review', 'ZeeoXForU', 'GSMArena']
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
        console.log('🚀 ZeeoXForU - نظام النشر التلقائي المتقدم');
        console.log('='.repeat(70));
        console.log(`📅 التاريخ: ${new Date().toLocaleString('en-US')}`);
        console.log(`📊 المقالات المنشورة سابقاً: ${this.state.publishedUrls.length}`);
        console.log(`🎨 القالب المستخدم: ${this.currentTemplate.name}`);
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
                console.log(`${'─'.repeat(50)}`);
                
                try {
                    console.log('\n📄 جاري استخراج محتوى المقال...');
                    const articleContent = await this.extractArticleContent(article.link);
                    console.log(`✅ تم استخراج المحتوى (${articleContent.length} حرف)`);
                    
                    console.log('\n🛠️ جاري توليد HTML بتصميم فريد...');
                    const postHtml = this.generatePostHtml(article, articleContent);
                    console.log('✅ تم توليد HTML');
                    
                    console.log('\n💾 جاري حفظ نسخة محلية...');
                    await this.saveLocalBackup(article.title, postHtml, article.category);
                    
                    console.log('\n📤 جاري النشر على بلوجر...');
                    const postTitle = article.title;
                    const labels = ['Tech', article.category, 'ZeeoXForU', 'Review', 'GSMArena'];
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
            console.log('📊 ملخص النشر لـ ZeeoXForU:');
            console.log(`   📦 إجمالي المقالات المنشورة: ${this.state.publishedUrls.length}`);
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
console.log('📢 بدء تشغيل ZeeoXForU - ناشر GSMArena المتقدم');
console.log('⏰ الوقت:', new Date().toLocaleString('en-US'));
console.log('🌐 الموقع: ZeeoXForU');

const publisher = new AutoPublisher();
publisher.run().then(() => {
    console.log('\n✅ اكتمل التنفيذ بنجاح');
}).catch(error => {
    console.error('\n❌ فشل البرنامج:', error.message);
});
