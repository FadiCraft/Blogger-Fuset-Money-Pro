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
    authorDescription: 'Expert tech reviews, news, and in-depth analysis',
    maxArticlesPerRun: 3
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
            lastRun: null,
            totalPublished: 0
        };
    }

    saveState() {
        try {
            this.state.lastRun = new Date().toISOString();
            this.state.totalPublished = this.state.publishedUrls.length;
            fs.writeJsonSync(SETTINGS.stateFile, this.state, { spaces: 2 });
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
                        'Cache-Control': 'no-cache'
                    },
                    timeout: 20000
                });
                return res.data;
            } catch (error) {
                if (i === retries - 1) throw error;
                console.log(`⚠️ إعادة المحاولة ${i + 1}...`);
                await new Promise(resolve => setTimeout(resolve, 2000 * (i + 1)));
            }
        }
    }

    isArticlePublished(url, title) {
        // فحص إذا تم نشره أو معالجته مسبقاً
        if (this.state.publishedUrls.includes(url)) return true;
        if (this.state.processedUrls.includes(url)) return true;
        
        const normalizedTitle = this.normalizeText(title);
        if (this.state.publishedTitles.some(t => this.normalizeText(t) === normalizedTitle)) return true;
        
        return false;
    }

    normalizeText(text) {
        return text
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    cleanTitle(title) {
        // إزالة كلمات مثل Review, Reviews من نهاية العنوان
        return title
            .replace(/\s*(review|reviews|hands-on|hands on|preview|first look)\s*$/i, '')
            .replace(/\s*:\s*(review|reviews|hands-on|hands on)\s*$/i, '')
            .trim();
    }

    extractDate($, element) {
        const selectors = ['.meta-item-time', 'time', '.date', '[datetime]'];
        for (const selector of selectors) {
            const el = element.find(selector).first();
            if (el.length) {
                return el.attr('datetime') || el.text().trim();
            }
        }
        return new Date().toISOString().split('T')[0];
    }

    formatDate(dateString) {
        try {
            const date = new Date(dateString);
            if (!isNaN(date.getTime())) {
                return date.toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                });
            }
            
            const months = ['January', 'February', 'March', 'April', 'May', 'June',
                          'July', 'August', 'September', 'October', 'November', 'December'];
            const parts = dateString.split(' ');
            if (parts.length === 3) {
                const monthIndex = months.findIndex(m => m.toLowerCase() === parts[1].toLowerCase());
                if (monthIndex >= 0) {
                    return `${months[monthIndex]} ${parts[0]}, ${parts[2]}`;
                }
            }
            return dateString;
        } catch {
            return dateString;
        }
    }

    formatDateISO(dateString) {
        try {
            const date = new Date(dateString);
            if (!isNaN(date.getTime())) {
                return date.toISOString().split('T')[0];
            }
            const months = ['January', 'February', 'March', 'April', 'May', 'June',
                          'July', 'August', 'September', 'October', 'November', 'December'];
            const parts = dateString.split(' ');
            if (parts.length === 3) {
                const monthIndex = months.findIndex(m => m.toLowerCase() === parts[1].toLowerCase());
                if (monthIndex >= 0) {
                    return `${parts[2]}-${String(monthIndex + 1).padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                }
            }
            return new Date().toISOString().split('T')[0];
        } catch {
            return new Date().toISOString().split('T')[0];
        }
    }

    estimateReadTime(contentLength) {
        const words = Math.ceil(contentLength / 5);
        const minutes = Math.max(1, Math.ceil(words / 200));
        return minutes;
    }

    generateSlug(title) {
        return title
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '')
            .substring(0, 80);
    }

    generateDescription(article, contentText) {
        // توليد وصف meta مناسب (بين 120-160 حرف)
        const cleanContent = contentText
            .replace(/\s+/g, ' ')
            .trim()
            .substring(0, 300);
        
        // محاولة أخذ أول فقرة ذات معنى
        const sentences = cleanContent.split(/[.!?]+/).filter(s => s.trim().length > 30);
        
        if (sentences.length > 0) {
            let description = sentences[0].trim();
            if (description.length < 120 && sentences.length > 1) {
                description += '. ' + sentences[1].trim();
            }
            return description.substring(0, 160).trim() + '.';
        }
        
        return `Comprehensive coverage of ${article.title}. Expert analysis, specifications, features, and everything you need to know about this device.`;
    }

    generateKeywords(article) {
        const words = article.title.split(' ')
            .filter(w => w.length > 3)
            .map(w => w.toLowerCase().replace(/[^a-z0-9]/g, ''));
        
        const baseKeywords = ['tech review', 'smartphone', 'specifications', 'analysis', 'ZeeoXForU'];
        const allKeywords = [...new Set([...words, ...baseKeywords])];
        
        return allKeywords.slice(0, 10).join(', ');
    }

    // ===== البحث عن مقالات جديدة من صفحة المراجعات =====
    async findUnpublishedArticles() {
        console.log('🔍 جلب المقالات من GSMArena...');
        const html = await this.fetchHtml(SETTINGS.targetUrl);
        const $ = cheerio.load(html);
        
        const allArticles = [];
        
        // جمع كل المقالات من الصفحة
        $('.review-item, .news-item, .module-article-item, .article-item').each((i, item) => {
            if (allArticles.length >= 20) return false; // أقصى 20 مقال للفحص
            
            const $item = $(item);
            let link = $item.find('a').first().attr('href');
            
            if (!link) return;
            
            if (!link.startsWith('http')) {
                link = SETTINGS.baseUrl + (link.startsWith('/') ? '' : '/') + link;
            }
            
            // تجاهل الروابط غير الصالحة
            if (link.includes('#') || link.includes('javascript:')) return;
            
            const rawTitle = $item.find('h3, .title, .article-title, a').first().text().trim() ||
                           $item.find('img').attr('alt')?.trim();
            
            if (!rawTitle || rawTitle.length < 5) return;
            
            const title = this.cleanTitle(rawTitle);
            
            let image = $item.find('img').first().attr('src') || $item.find('img').first().attr('data-src');
            if (image) {
                if (image.startsWith('//')) image = 'https:' + image;
                else if (!image.startsWith('http')) image = 'https://' + image;
            }
            
            const date = this.extractDate($, $item);
            
            // تحديد الفئة
            let category = 'Tech';
            if ($item.hasClass('review-item')) category = 'Review';
            else if ($item.hasClass('news-item')) category = 'News';
            
            allArticles.push({ title, link, image, date, category });
        });
        
        console.log(`📋 تم العثور على ${allArticles.length} مقال في الصفحة`);
        
        // ترتيب حسب الأحدث أولاً (حسب ظهورهم في الصفحة)
        // البحث عن أول مقال غير منشور
        const unpublishedArticles = [];
        
        for (const article of allArticles) {
            if (this.isArticlePublished(article.link, article.title)) {
                console.log(`   ⏭️ متجاوز: ${article.title.substring(0, 60)}... (منشور مسبقاً)`);
                continue;
            }
            
            unpublishedArticles.push(article);
            
            if (unpublishedArticles.length >= SETTINGS.maxArticlesPerRun) break;
        }
        
        console.log(`✅ مقالات جديدة للنشر: ${unpublishedArticles.length}`);
        return unpublishedArticles;
    }

    // ===== استخراج محتوى المقال =====
    async extractArticleContent(articleUrl) {
        console.log(`📄 استخراج: ${articleUrl.substring(0, 60)}...`);
        const html = await this.fetchHtml(articleUrl);
        const $ = cheerio.load(html);
        
        // البحث عن المحتوى الرئيسي
        let mainContent = $('#review-body, #article-body, .article-content, .post-content, article, main');
        
        if (!mainContent.length) {
            mainContent = $('body').clone();
            mainContent.find('header, footer, nav, .sidebar, .comments, .related, script, style, noscript, iframe, .ad, .social').remove();
        }
        
        const contentClone = mainContent.clone();
        
        // تنظيف
        contentClone.find('script, style, noscript, iframe, .ad, .advertisement, .social-share, .comments, .related-posts, nav, .navigation').remove();
        
        // استخراج النص النظيف للوصف
        const textContent = contentClone.text().replace(/\s+/g, ' ').trim();
        
        // معالجة الصور
        contentClone.find('img').each((i, img) => {
            const $img = $(img);
            let src = $img.attr('src') || $img.attr('data-src') || $img.attr('data-original');
            
            if (src) {
                if (src.startsWith('//')) src = 'https:' + src;
                else if (!src.startsWith('http') && !src.startsWith('data:')) src = 'https://' + src;
                
                // تجاهل الأيقونات والشعارات
                if (src.includes('/icon/') || src.includes('/logo/') || src.includes('avatar') || 
                    src.includes('1x1') || src.includes('pixel')) {
                    $img.remove();
                    return;
                }
                
                $img.attr('src', src);
                $img.attr('loading', 'lazy');
                $img.attr('alt', $img.attr('alt') || 'Image');
            } else {
                $img.remove();
            }
        });
        
        // إزالة كلاسات و IDs للحفاظ على النظافة
        contentClone.find('*').removeAttr('class id style onclick onload onerror data-*');
        
        return {
            html: contentClone.html() || '',
            text: textContent.substring(0, 500)
        };
    }

    // ===== توليد HTML محسّن لـ SEO =====
    generatePostHtml(article, articleContent, contentText) {
        const cleanTitle = this.cleanTitle(article.title);
        const formattedDate = this.formatDate(article.date);
        const dateISO = this.formatDateISO(article.date);
        const readTime = this.estimateReadTime(articleContent.length);
        const slug = this.generateSlug(cleanTitle);
        const fullUrl = `${SETTINGS.siteUrl}${slug}.html`;
        const description = this.generateDescription(article, contentText);
        const keywords = this.generateKeywords(article);
        
        // ألوان عشوائية للتمييز
        const colors = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
        const accentColor = colors[Math.floor(Math.random() * colors.length)];
        
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <!-- ===== أساسيات SEO ===== -->
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${cleanTitle} - Full Specifications & Analysis | ZeeoXForU</title>
    <meta name="description" content="${description}">
    <meta name="keywords" content="${keywords}">
    <meta name="author" content="${SETTINGS.authorName}">
    <meta name="robots" content="index, follow, max-image-preview:large">
    <meta name="googlebot" content="index, follow">
    <link rel="canonical" href="${fullUrl}">
    
    <!-- ===== Open Graph (Facebook, LinkedIn) ===== -->
    <meta property="og:title" content="${cleanTitle} - Full Specifications & Analysis">
    <meta property="og:description" content="${description}">
    <meta property="og:type" content="article">
    <meta property="og:url" content="${fullUrl}">
    <meta property="og:site_name" content="ZeeoXForU">
    <meta property="og:locale" content="en_US">
    ${article.image ? `
    <meta property="og:image" content="${article.image}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:image:alt" content="${cleanTitle}">` : ''}
    <meta property="article:published_time" content="${dateISO}T00:00:00+00:00">
    <meta property="article:author" content="${SETTINGS.authorName}">
    
    <!-- ===== Twitter Card ===== -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${cleanTitle}">
    <meta name="twitter:description" content="${description}">
    <meta name="twitter:site" content="@ZeeoXForU">
    ${article.image ? `<meta name="twitter:image" content="${article.image}">` : ''}
    
    <!-- ===== Schema.org Structured Data ===== -->
    <script type="application/ld+json">
    {
        "@context": "https://schema.org",
        "@type": "Article",
        "mainEntityOfPage": {
            "@type": "WebPage",
            "@id": "${fullUrl}"
        },
        "headline": "${cleanTitle.replace(/"/g, '\\"')}",
        "description": "${description.replace(/"/g, '\\"')}",
        ${article.image ? `"image": {
            "@type": "ImageObject",
            "url": "${article.image}",
            "width": "1200",
            "height": "630"
        },` : ''}
        "author": {
            "@type": "Organization",
            "name": "${SETTINGS.authorName}",
            "url": "${SETTINGS.siteUrl}"
        },
        "publisher": {
            "@type": "Organization",
            "name": "ZeeoXForU",
            "url": "${SETTINGS.siteUrl}",
            "logo": {
                "@type": "ImageObject",
                "url": "${SETTINGS.siteUrl}logo.png"
            }
        },
        "datePublished": "${dateISO}T00:00:00+00:00",
        "dateModified": "${new Date().toISOString().split('T')[0]}T00:00:00+00:00",
        "inLanguage": "en-US",
        "isAccessibleForFree": true
    }
    </script>
    
    <!-- ===== Breadcrumb Schema ===== -->
    <script type="application/ld+json">
    {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            {
                "@type": "ListItem",
                "position": 1,
                "name": "Home",
                "item": "${SETTINGS.siteUrl}"
            },
            {
                "@type": "ListItem",
                "position": 2,
                "name": "${article.category}",
                "item": "${SETTINGS.siteUrl}category/${article.category.toLowerCase()}"
            },
            {
                "@type": "ListItem",
                "position": 3,
                "name": "${cleanTitle.substring(0, 50)}"
            }
        ]
    }
    </script>
    
    <!-- ===== FAQ Schema (إذا وجد) ===== -->
    <script type="application/ld+json">
    {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [
            {
                "@type": "Question",
                "name": "What are the key features of ${cleanTitle.split(' ').slice(0, 4).join(' ')}?",
                "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "The device comes with impressive specifications including a powerful processor, high-quality camera system, and long-lasting battery life. Check our detailed analysis above for complete information."
                }
            },
            {
                "@type": "Question",
                "name": "Is ${cleanTitle.split(' ').slice(0, 3).join(' ')} worth buying?",
                "acceptedAnswer": {
                    "@type": "Answer",
                    "text": "Based on our comprehensive analysis, this device offers excellent value for its price point, with competitive features that make it a strong contender in its category."
                }
            }
        ]
    }
    </script>
    
    <!-- ===== Styles ===== -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            background: #f8fafc;
            color: #1e293b;
            line-height: 1.8;
            padding: 20px;
        }
        
        .article-container {
            max-width: 960px;
            margin: 0 auto;
            background: #ffffff;
            border-radius: 16px;
            box-shadow: 0 2px 12px rgba(0,0,0,0.05);
            overflow: hidden;
        }
        
        /* ===== رأس المقال ===== */
        .article-header {
            padding: 36px 40px 0;
        }
        
        .breadcrumb {
            font-size: 0.82rem;
            color: #94a3b8;
            margin-bottom: 16px;
        }
        
        .breadcrumb a {
            color: ${accentColor};
            text-decoration: none;
        }
        
        .category-label {
            display: inline-block;
            background: ${accentColor}15;
            color: ${accentColor};
            font-size: 0.78rem;
            font-weight: 600;
            padding: 5px 14px;
            border-radius: 16px;
            margin-bottom: 16px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        .article-title {
            font-size: 2.2rem;
            font-weight: 800;
            line-height: 1.3;
            color: #0f172a;
            margin-bottom: 12px;
        }
        
        .article-subtitle {
            font-size: 1.05rem;
            color: #64748b;
            margin-bottom: 16px;
            line-height: 1.5;
        }
        
        .article-meta {
            display: flex;
            gap: 18px;
            flex-wrap: wrap;
            font-size: 0.88rem;
            color: #64748b;
            padding-bottom: 18px;
            border-bottom: 1px solid #e2e8f0;
            margin-bottom: 20px;
        }
        
        .article-meta span {
            display: flex;
            align-items: center;
            gap: 5px;
        }
        
        .article-meta i {
            color: ${accentColor};
            font-size: 0.85rem;
        }
        
        /* ===== صورة رئيسية ===== */
        .featured-image {
            margin: 0 40px 28px;
            border-radius: 12px;
            overflow: hidden;
            background: #f1f5f9;
        }
        
        .featured-image img {
            width: 100%;
            height: auto;
            display: block;
            object-fit: cover;
            max-height: 500px;
        }
        
        .featured-image figcaption {
            padding: 10px 16px;
            font-size: 0.82rem;
            color: #94a3b8;
            text-align: center;
        }
        
        /* ===== جسم المقال ===== */
        .article-body {
            padding: 0 40px 40px;
        }
        
        .article-body h2 {
            font-size: 1.5rem;
            font-weight: 700;
            color: #0f172a;
            margin: 30px 0 14px;
            padding-left: 12px;
            border-left: 4px solid ${accentColor};
        }
        
        .article-body h3 {
            font-size: 1.2rem;
            font-weight: 600;
            color: #1e293b;
            margin: 22px 0 10px;
        }
        
        .article-body h4 {
            font-size: 1.05rem;
            font-weight: 600;
            color: #334155;
            margin: 18px 0 8px;
        }
        
        .article-body p {
            margin-bottom: 1rem;
            color: #334155;
            font-size: 1.02rem;
        }
        
        .article-body img {
            max-width: 100%;
            height: auto;
            border-radius: 10px;
            margin: 20px 0;
            display: block;
        }
        
        .article-body ul, .article-body ol {
            margin: 14px 0;
            padding-left: 22px;
        }
        
        .article-body li {
            margin-bottom: 6px;
            color: #334155;
        }
        
        .article-body table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
            font-size: 0.92rem;
        }
        
        .article-body table th,
        .article-body table td {
            padding: 10px 14px;
            border: 1px solid #e2e8f0;
            text-align: left;
        }
        
        .article-body table th {
            background: #f8fafc;
            font-weight: 600;
        }
        
        .article-body blockquote {
            border-left: 4px solid ${accentColor};
            padding: 14px 18px;
            margin: 18px 0;
            background: #f8fafc;
            border-radius: 0 8px 8px 0;
            color: #475569;
            font-style: italic;
        }
        
        /* ===== مربع النقاط ===== */
        .key-points {
            background: #f0f9ff;
            border-left: 4px solid ${accentColor};
            padding: 18px 22px;
            border-radius: 10px;
            margin: 24px 0;
        }
        
        .key-points h3 {
            color: ${accentColor};
            margin-bottom: 10px;
            font-size: 1.05rem;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .key-points ul {
            list-style: none;
            padding: 0;
            margin: 0;
        }
        
        .key-points li {
            padding: 5px 0;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .key-points li:before {
            content: "▸";
            color: ${accentColor};
            font-weight: bold;
        }
        
        /* ===== FAQ ===== */
        .faq-section {
            background: #fafbfc;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 24px;
            margin: 30px 0 16px;
        }
        
        .faq-section h2 {
            font-size: 1.3rem;
            margin-bottom: 18px;
            border: none;
            padding: 0;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .faq-item {
            margin-bottom: 16px;
            padding-bottom: 14px;
            border-bottom: 1px solid #e2e8f0;
        }
        
        .faq-item:last-child {
            border-bottom: none;
            margin-bottom: 0;
            padding-bottom: 0;
        }
        
        .faq-item .question {
            font-weight: 600;
            color: #1e293b;
            margin-bottom: 6px;
            font-size: 0.98rem;
        }
        
        .faq-item .answer {
            color: #64748b;
            font-size: 0.93rem;
        }
        
        /* ===== كاتب ===== */
        .author-box {
            display: flex;
            gap: 14px;
            align-items: center;
            padding: 18px;
            background: #f8fafc;
            border-radius: 12px;
            margin: 28px 0 14px;
            border: 1px solid #e2e8f0;
        }
        
        .author-avatar {
            width: 50px;
            height: 50px;
            background: ${accentColor};
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 1.2rem;
            flex-shrink: 0;
        }
        
        .author-info h4 {
            margin-bottom: 2px;
            color: #1e293b;
            font-size: 1rem;
        }
        
        .author-info p {
            color: #64748b;
            font-size: 0.82rem;
            margin: 0;
        }
        
        /* ===== فوتر ===== */
        .article-footer {
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 10px;
            padding-top: 14px;
            border-top: 1px solid #e2e8f0;
            margin-top: 18px;
        }
        
        .tags {
            display: flex;
            gap: 6px;
            flex-wrap: wrap;
        }
        
        .tag {
            background: #f1f5f9;
            color: #64748b;
            padding: 4px 10px;
            border-radius: 14px;
            font-size: 0.75rem;
            font-weight: 500;
        }
        
        .copyright {
            color: #94a3b8;
            font-size: 0.78rem;
        }
        
        /* ===== تجاوب ===== */
        @media (max-width: 768px) {
            body { padding: 8px; }
            .article-header { padding: 20px 16px 0; }
            .article-body { padding: 0 16px 20px; }
            .featured-image { margin: 0 16px 20px; }
            .article-title { font-size: 1.5rem; }
            .article-meta { gap: 10px; font-size: 0.8rem; }
        }
    </style>
</head>
<body>
    <article class="article-container" itemscope itemtype="https://schema.org/Article">
        
        <!-- ===== رأس المقال ===== -->
        <header class="article-header">
            <nav class="breadcrumb" aria-label="Breadcrumb">
                <a href="${SETTINGS.siteUrl}">Home</a> &rsaquo; 
                <a href="${SETTINGS.siteUrl}category/${article.category.toLowerCase()}">${article.category}</a> &rsaquo; 
                <span>${cleanTitle.substring(0, 40)}...</span>
            </nav>
            
            <span class="category-label">${article.category}</span>
            
            <h1 class="article-title" itemprop="headline">${cleanTitle}</h1>
            
            <p class="article-subtitle" itemprop="description">${description}</p>
            
            <div class="article-meta">
                <span><i class="far fa-calendar-alt"></i> 
                    <time datetime="${dateISO}" itemprop="datePublished">${formattedDate}</time>
                </span>
                <span><i class="far fa-user"></i> 
                    <span itemprop="author" itemscope itemtype="https://schema.org/Organization">
                        <span itemprop="name">${SETTINGS.authorName}</span>
                    </span>
                </span>
                <span><i class="far fa-clock"></i> ${readTime} min read</span>
                <meta itemprop="wordCount" content="${Math.ceil(articleContent.length / 5)}">
            </div>
        </header>
        
        <!-- ===== صورة رئيسية ===== -->
        ${article.image ? `
        <figure class="featured-image" itemprop="image" itemscope itemtype="https://schema.org/ImageObject">
            <img src="${article.image}" alt="${cleanTitle}" loading="eager" itemprop="url">
            <meta itemprop="width" content="1200">
            <meta itemprop="height" content="630">
            <figcaption>${cleanTitle} - Image credit: GSMArena</figcaption>
        </figure>` : ''}
        
        <!-- ===== محتوى المقال ===== -->
        <div class="article-body" itemprop="articleBody">
            ${articleContent}
            
            <div class="key-points">
                <h3><i class="fas fa-star"></i> Key Highlights</h3>
                <ul>
                    <li>Complete analysis of specifications and performance</li>
                    <li>Real-world usage insights and benchmarks</li>
                    <li>Pros and cons based on extensive testing</li>
                </ul>
            </div>
            
            <div class="faq-section">
                <h2><i class="fas fa-question-circle" style="color:${accentColor};"></i> Frequently Asked Questions</h2>
                <div class="faq-item" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
                    <div class="question" itemprop="name">Q: What are the standout features of this device?</div>
                    <div class="answer" itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer">
                        <span itemprop="text">The device features a premium design, powerful processor, impressive camera system, and excellent battery life that make it a compelling choice in its category.</span>
                    </div>
                </div>
                <div class="faq-item" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
                    <div class="question" itemprop="name">Q: Should I buy this device?</div>
                    <div class="answer" itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer">
                        <span itemprop="text">Based on our thorough analysis, this device offers great value for money and is definitely worth considering if you're looking for a reliable and feature-rich option.</span>
                    </div>
                </div>
            </div>
            
            <div class="author-box" itemprop="publisher" itemscope itemtype="https://schema.org/Organization">
                <div class="author-avatar"><i class="fas fa-chalkboard-user"></i></div>
                <div class="author-info">
                    <h4 itemprop="name">${SETTINGS.authorName}</h4>
                    <p itemprop="description">${SETTINGS.authorDescription}</p>
                </div>
                <meta itemprop="url" content="${SETTINGS.siteUrl}">
            </div>
            
            <div class="article-footer">
                <div class="tags">
                    <span class="tag">${article.category}</span>
                    <span class="tag">Tech</span>
                    <span class="tag">Analysis</span>
                    <span class="tag">Specifications</span>
                </div>
                <div class="copyright">
                    &copy; ${new Date().getFullYear()} ZeeoXForU
                </div>
            </div>
        </div>
        
    </article>
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
            console.error('❌ فشل الحصول على token:', error.message);
            throw error;
        }
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
            if (error.response) {
                console.error('   الحالة:', error.response.status);
                console.error('   التفاصيل:', JSON.stringify(error.response.data, null, 2));
            }
            return { success: false, error: error.message };
        }
    }

    async saveLocalBackup(title, content, category) {
        try {
            await fs.ensureDir(SETTINGS.postsDir);
            const date = new Date().toISOString().split('T')[0];
            const safeTitle = title.replace(/[<>:"/\\|?*]/g, '').replace(/\s+/g, '_').substring(0, 50);
            const fileName = path.join(SETTINGS.postsDir, `${date}_${category}_${safeTitle}.html`);
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
        console.log('🚀 ZeeoXForU - ناشر GSMArena المحسن');
        console.log('='.repeat(60));
        console.log(`📅 ${new Date().toLocaleString('en-US')}`);
        console.log(`📊 منشور سابقاً: ${this.state.publishedUrls.length}`);
        console.log('='.repeat(60));
        
        try {
            // البحث عن مقالات غير منشورة
            const articles = await this.findUnpublishedArticles();
            
            if (articles.length === 0) {
                console.log('\n✅ لا توجد مقالات جديدة. كل المقالات منشورة مسبقاً.');
                return;
            }
            
            console.log(`\n📋 سيتم نشر ${articles.length} مقالات\n`);
            
            for (let i = 0; i < articles.length; i++) {
                const article = articles[i];
                
                console.log(`${'─'.repeat(50)}`);
                console.log(`📄 [${i + 1}/${articles.length}] ${article.title}`);
                console.log(`   الرابط: ${article.link}`);
                console.log(`${'─'.repeat(50)}`);
                
                try {
                    // استخراج المحتوى
                    const { html: articleHtml, text: articleText } = await this.extractArticleContent(article.link);
                    
                    // توليد HTML
                    const postHtml = this.generatePostHtml(article, articleHtml, articleText);
                    
                    // حفظ محلي
                    await this.saveLocalBackup(article.title, postHtml, article.category);
                    
                    // نشر
                    const result = await this.publishToBlogger(
                        article.title,
                        postHtml,
                        ['Tech', article.category, 'ZeeoXForU', 'GSMArena']
                    );
                    
                    if (result.success) {
                        this.state.publishedUrls.push(article.link);
                        this.state.publishedTitles.push(article.title);
                        this.publishedCount++;
                        console.log(`   🎉 تم النشر بنجاح!`);
                    } else {
                        // حتى لو فشل، نحفظ الرابط عشان ما نحاول ننشره مرة ثانية
                        this.state.processedUrls.push(article.link);
                        console.log(`   ⚠️ فشل النشر، تم حفظ الرابط للمعالجة`);
                    }
                    
                    this.saveState();
                    
                    // انتظار بين المقالات
                    if (i < articles.length - 1) {
                        console.log('   ⏳ انتظار...');
                        await new Promise(r => setTimeout(r, 3000));
                    }
                    
                } catch (error) {
                    console.error(`   ❌ فشل: ${error.message}`);
                    this.state.processedUrls.push(article.link);
                    this.saveState();
                }
            }
            
            console.log('\n' + '='.repeat(60));
            console.log('📊 ملخص:');
            console.log(`   ✅ تم النشر: ${this.publishedCount}`);
            console.log(`   📦 إجمالي المنشور: ${this.state.publishedUrls.length}`);
            console.log('='.repeat(60));
            
        } catch (error) {
            console.error('\n❌ فشل التشغيل:', error.message);
        }
    }
}

// ===== تشغيل =====
console.log('📢 ZeeoXForU Auto Publisher v2.0');
console.log('⏰', new Date().toLocaleString('en-US'));

const publisher = new AutoPublisher();
publisher.run()
    .then(() => console.log('\n✅ اكتمل التنفيذ'))
    .catch(e => console.error('\n❌', e.message));
