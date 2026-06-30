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

    // ===== استخراج وإعادة هيكلة محتوى المقال =====
    async extractArticleContent(articleUrl) {
        console.log(`📄 استخراج وإعادة هيكلة: ${articleUrl.substring(0, 60)}...`);
        const html = await this.fetchHtml(articleUrl);
        const $ = cheerio.load(html);
        
        // هيكل منظم للمقال
        const structuredContent = {
            introduction: '',
            sections: [],
            conclusion: '',
            specs: null,
            pros: [],
            cons: [],
            images: []
        };
        
        // استخراج المحتوى الرئيسي
        const reviewBody = $('#review-body');
        
        if (reviewBody.length) {
            // جمع كل الفقرات والعناوين
            const elements = [];
            reviewBody.find('p, h2, h3, h4, ul, ol, img, table, div.specs-table').each((i, el) => {
                const $el = $(el);
                const tag = el.tagName.toLowerCase();
                
                if (tag === 'p') {
                    const text = $el.text().trim();
                    if (text.length > 20) {
                        elements.push({ type: 'paragraph', content: text });
                    }
                } else if (tag.match(/^h[2-4]$/)) {
                    const text = $el.text().trim();
                    if (text.length > 3) {
                        elements.push({ type: 'heading', level: tag, content: text });
                    }
                } else if (tag === 'img') {
                    let src = $el.attr('src') || $el.attr('data-src');
                    if (src && !src.includes('icon') && !src.includes('logo')) {
                        if (src.startsWith('//')) src = 'https:' + src;
                        elements.push({ type: 'image', src: src, alt: $el.attr('alt') || '' });
                    }
                } else if (tag === 'ul' || tag === 'ol') {
                    const items = [];
                    $el.find('li').each((j, li) => {
                        const text = $(li).text().trim();
                        if (text.length > 5) items.push(text);
                    });
                    if (items.length > 0) {
                        elements.push({ type: 'list', listType: tag, items: items });
                    }
                }
            });
            
            // تنظيم العناصر في هيكل
            let currentSection = { title: 'Introduction', content: [] };
            let introCollected = false;
            
            for (const element of elements) {
                if (element.type === 'heading') {
                    if (!introCollected) {
                        structuredContent.introduction = currentSection.content
                            .filter(e => e.type === 'paragraph')
                            .map(e => e.content)
                            .join('\n\n');
                        introCollected = true;
                    } else if (currentSection.content.length > 0) {
                        structuredContent.sections.push({...currentSection});
                    }
                    currentSection = { title: element.content, content: [] };
                } else {
                    currentSection.content.push(element);
                }
            }
            
            // إضافة القسم الأخير
            if (currentSection.content.length > 0) {
                if (!introCollected) {
                    structuredContent.introduction = currentSection.content
                        .filter(e => e.type === 'paragraph')
                        .map(e => e.content)
                        .join('\n\n');
                } else if (structuredContent.sections.length > 0) {
                    structuredContent.conclusion = currentSection.content
                        .filter(e => e.type === 'paragraph')
                        .map(e => e.content)
                        .join('\n\n');
                } else {
                    structuredContent.sections.push({...currentSection});
                }
            }
            
            // استخراج المواصفات إذا وجدت
            const specsTable = reviewBody.find('table');
            if (specsTable.length) {
                const specs = {};
                specsTable.find('tr').each((i, row) => {
                    const cells = $(row).find('td, th');
                    if (cells.length === 2) {
                        const key = $(cells[0]).text().trim();
                        const value = $(cells[1]).text().trim();
                        if (key && value) specs[key] = value;
                    }
                });
                if (Object.keys(specs).length > 0) {
                    structuredContent.specs = specs;
                }
            }
            
            // استخراج الإيجابيات والسلبيات
            reviewBody.find('ul, ol').each((i, list) => {
                const $list = $(list);
                const prevHeading = $list.prev('h3, h4, strong').text().toLowerCase();
                
                if (prevHeading.includes('pros') || prevHeading.includes('good') || prevHeading.includes('+')) {
                    $list.find('li').each((j, li) => {
                        const text = $(li).text().trim();
                        if (text) structuredContent.pros.push(text);
                    });
                } else if (prevHeading.includes('cons') || prevHeading.includes('bad') || prevHeading.includes('-')) {
                    $list.find('li').each((j, li) => {
                        const text = $(li).text().trim();
                        if (text) structuredContent.cons.push(text);
                    });
                }
            });
        }
        
        return structuredContent;
    }

    // ===== توليد HTML منظم للمقال =====
    generatePostHtml(article, structuredContent) {
        const cleanTitle = this.cleanTitle(article.title);
        const formattedDate = this.formatDate(article.date);
        const dateISO = this.formatDateISO(article.date);
        
        // إنشاء وصف من المقدمة
        const description = (structuredContent.introduction || cleanTitle).substring(0, 160).trim() + '...';
        const readTime = Math.max(3, Math.ceil((description.length / 5) / 200));
        
        const colors = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b'];
        const accent = colors[Math.floor(Math.random() * colors.length)];
        
        // بناء محتوى HTML منظم
        let bodyContent = '';
        
        // المقدمة
        if (structuredContent.introduction) {
            bodyContent += `
            <div class="intro-section">
                ${structuredContent.introduction.split('\n\n').map(p => `<p>${p}</p>`).join('\n')}
            </div>`;
        }
        
        // صورة رئيسية إذا وجدت
        if (article.image) {
            bodyContent += `
            <div class="featured-image">
                <img src="${article.image}" alt="${cleanTitle}" loading="lazy">
                <p class="image-caption">${cleanTitle} - Full Review and Analysis</p>
            </div>`;
        }
        
        // جدول المواصفات إذا وجد
        if (structuredContent.specs && Object.keys(structuredContent.specs).length > 0) {
            bodyContent += `
            <div class="specs-section">
                <h2>📊 Key Specifications</h2>
                <table class="specs-table">
                    ${Object.entries(structuredContent.specs).map(([key, value]) => `
                    <tr>
                        <td><strong>${key}</strong></td>
                        <td>${value}</td>
                    </tr>`).join('')}
                </table>
            </div>`;
        }
        
        // الأقسام الرئيسية
        if (structuredContent.sections && structuredContent.sections.length > 0) {
            structuredContent.sections.forEach((section, index) => {
                bodyContent += `
            <div class="content-section">
                <h2>${section.title}</h2>`;
                
                section.content.forEach(element => {
                    if (element.type === 'paragraph') {
                        bodyContent += `
                <p>${element.content}</p>`;
                    } else if (element.type === 'image') {
                        bodyContent += `
                <div class="content-image">
                    <img src="${element.src}" alt="${element.alt || section.title}" loading="lazy">
                </div>`;
                    } else if (element.type === 'list') {
                        const listTag = element.listType === 'ol' ? 'ol' : 'ul';
                        bodyContent += `
                <${listTag}>
                    ${element.items.map(item => `<li>${item}</li>`).join('\n')}
                </${listTag}>`;
                    }
                });
                
                bodyContent += `
            </div>`;
            });
        }
        
        // الإيجابيات والسلبيات
        if (structuredContent.pros.length > 0 || structuredContent.cons.length > 0) {
            bodyContent += `
            <div class="pros-cons-section">
                <h2>⚖️ Pros and Cons</h2>
                <div class="pros-cons-grid">`;
            
            if (structuredContent.pros.length > 0) {
                bodyContent += `
                    <div class="pros-box">
                        <h3>✅ Pros</h3>
                        <ul>
                            ${structuredContent.pros.map(pro => `<li>${pro}</li>`).join('\n')}
                        </ul>
                    </div>`;
            }
            
            if (structuredContent.cons.length > 0) {
                bodyContent += `
                    <div class="cons-box">
                        <h3>❌ Cons</h3>
                        <ul>
                            ${structuredContent.cons.map(con => `<li>${con}</li>`).join('\n')}
                        </ul>
                    </div>`;
            }
            
            bodyContent += `
                </div>
            </div>`;
        }
        
        // الخاتمة
        if (structuredContent.conclusion) {
            bodyContent += `
            <div class="conclusion-section">
                <h2>🏁 Final Verdict</h2>
                ${structuredContent.conclusion.split('\n\n').map(p => `<p>${p}</p>`).join('\n')}
            </div>`;
        }
        
        // النقاط الرئيسية
        bodyContent += `
            <div class="key-points">
                <h3>⭐ Key Takeaways</h3>
                <ul>
                    <li>Comprehensive analysis and detailed breakdown of features</li>
                    <li>Real-world performance insights and benchmarks</li>
                    <li>Honest assessment of strengths and weaknesses</li>
                    <li>Expert recommendations for different user needs</li>
                </ul>
            </div>`;
        
        // الأسئلة الشائعة
        bodyContent += `
            <div class="faq-section">
                <h2>❓ Frequently Asked Questions</h2>
                <div class="faq-item">
                    <h3>Q: What makes this device stand out from competitors?</h3>
                    <p>A: Based on our thorough analysis, this device offers a unique combination of premium design, powerful performance, and innovative features that set it apart from competitors in its price range.</p>
                </div>
                <div class="faq-item">
                    <h3>Q: Is this device worth buying in 2024?</h3>
                    <p>A: Considering its features, performance, and price point, this device provides excellent value for money. It delivers flagship-level features at a competitive price, making it a solid investment for most users.</p>
                </div>
                <div class="faq-item">
                    <h3>Q: How does the camera perform in low light?</h3>
                    <p>A: The camera system has been optimized for various lighting conditions. Low-light performance is impressive with detailed images and minimal noise, though results may vary depending on specific conditions.</p>
                </div>
            </div>`;
        
        // معلومات الكاتب
        bodyContent += `
            <div class="author-box">
                <div class="author-avatar">📝</div>
                <div class="author-info">
                    <h4>${SETTINGS.authorName}</h4>
                    <p>${SETTINGS.authorDescription}</p>
                </div>
            </div>`;
        
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
        "author": {"@type": "Organization", "name": "${SETTINGS.authorName}"},
        "publisher": {"@type": "Organization", "name": "ZeeoXForU"}
    }
    </script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:'Inter',sans-serif;background:linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);color:#1e293b;line-height:1.8;padding:20px;min-height:100vh}
        .container{max-width:900px;margin:0 auto;background:#fff;border-radius:20px;box-shadow:0 10px 40px rgba(0,0,0,0.08);overflow:hidden}
        
        /* Header */
        .header{background:linear-gradient(135deg, ${accent}15, ${accent}05);padding:40px 40px 30px;border-bottom:1px solid #e2e8f0}
        .category{display:inline-block;background:${accent};color:#fff;font-size:.8rem;font-weight:600;padding:6px 16px;border-radius:20px;margin-bottom:20px;text-transform:uppercase;letter-spacing:1px}
        h1{font-size:2.5rem;font-weight:800;line-height:1.3;color:#0f172a;margin-bottom:16px}
        .subtitle{font-size:1.1rem;color:#64748b;margin-bottom:20px;line-height:1.6}
        .meta{display:flex;gap:20px;flex-wrap:wrap;font-size:.9rem;color:#64748b}
        .meta-item{display:flex;align-items:center;gap:6px;background:#f8fafc;padding:6px 14px;border-radius:20px}
        
        /* Main Content */
        .body{padding:40px}
        
        /* Sections */
        .intro-section,.content-section,.conclusion-section{margin-bottom:35px}
        h2{font-size:1.8rem;font-weight:700;color:#0f172a;margin:35px 0 20px;padding-bottom:12px;border-bottom:3px solid ${accent};display:inline-block}
        h3{font-size:1.3rem;font-weight:600;color:#1e293b;margin:20px 0 12px}
        p{margin-bottom:1.2rem;color:#334155;font-size:1.05rem;line-height:1.9}
        
        /* Images */
        .featured-image,.content-image{margin:25px 0;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.1)}
        .featured-image img,.content-image img{width:100%;height:auto;display:block}
        .image-caption{text-align:center;color:#64748b;font-size:.85rem;margin-top:10px;font-style:italic}
        
        /* Specs Table */
        .specs-section{background:#f8fafc;border-radius:12px;padding:25px;margin:30px 0;border:1px solid #e2e8f0}
        .specs-table{width:100%;border-collapse:collapse}
        .specs-table td{padding:12px 16px;border-bottom:1px solid #e2e8f0;font-size:.95rem}
        .specs-table tr:last-child td{border-bottom:none}
        .specs-table td:first-child{color:#64748b;width:40%}
        
        /* Pros & Cons */
        .pros-cons-section{margin:30px 0}
        .pros-cons-grid{display:grid;grid-template-columns:repeat(auto-fit, minmax(250px, 1fr));gap:20px;margin-top:15px}
        .pros-box,.cons-box{padding:20px;border-radius:12px}
        .pros-box{background:#f0fdf4;border:1px solid #bbf7d0}
        .cons-box{background:#fef2f2;border:1px solid #fecaca}
        .pros-box h3{color:#16a34a;margin-bottom:12px}
        .cons-box h3{color:#dc2626;margin-bottom:12px}
        .pros-box ul,.cons-box ul{list-style:none;padding:0}
        .pros-box li,.cons-box li{padding:4px 0;color:#334155;font-size:.95rem}
        .pros-box li:before{content:"✓ ";color:#16a34a;font-weight:bold}
        .cons-box li:before{content:"✗ ";color:#dc2626;font-weight:bold}
        
        /* Lists */
        ul,ol{margin:15px 0;padding-left:25px}
        li{margin-bottom:8px;color:#334155}
        
        /* Key Points */
        .key-points{background:linear-gradient(135deg, ${accent}10, ${accent}05);border-left:4px solid ${accent};padding:20px 25px;border-radius:0 12px 12px 0;margin:25px 0}
        .key-points h3{color:${accent};margin-bottom:12px}
        .key-points ul{list-style:none;padding:0}
        .key-points li{padding:6px 0;color:#334155}
        .key-points li:before{content:"▸ ";color:${accent};font-weight:bold;margin-right:8px}
        
        /* FAQ */
        .faq-section{background:#fafbfc;border:1px solid #e2e8f0;border-radius:12px;padding:25px;margin:30px 0}
        .faq-section h2{border:none;margin-top:0}
        .faq-item{margin-bottom:20px;padding-bottom:20px;border-bottom:1px solid #e2e8f0}
        .faq-item:last-child{border:none;margin:0;padding:0}
        .faq-item h3{font-size:1.1rem;color:#1e293b;margin-bottom:8px;font-weight:600}
        .faq-item p{color:#64748b;font-size:.95rem;margin:0}
        
        /* Author */
        .author-box{display:flex;gap:16px;align-items:center;padding:20px;background:#f8fafc;border-radius:12px;margin:30px 0;border:1px solid #e2e8f0}
        .author-avatar{width:55px;height:55px;background:linear-gradient(135deg, ${accent}, ${accent}dd);border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:1.3rem;flex-shrink:0}
        .author-info h4{color:#1e293b;font-size:1.05rem;margin-bottom:4px}
        .author-info p{color:#64748b;font-size:.85rem;margin:0}
        
        /* Footer */
        .article-footer{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:15px;padding:20px 0 0;margin-top:20px;border-top:1px solid #e2e8f0}
        .tags{display:flex;gap:8px;flex-wrap:wrap}
        .tag{background:#f1f5f9;color:#64748b;padding:5px 12px;border-radius:16px;font-size:.8rem;font-weight:500;transition:all 0.3s}
        .tag:hover{background:${accent}15;color:${accent}}
        .copyright{color:#94a3b8;font-size:.8rem}
        
        @media(max-width:768px){
            body{padding:10px}
            .header{padding:25px 20px 20px}
            .body{padding:25px 20px}
            h1{font-size:1.8rem}
            h2{font-size:1.4rem}
            .pros-cons-grid{grid-template-columns:1fr}
            .meta{gap:10px}
            .meta-item{font-size:.8rem;padding:4px 10px}
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
                <span class="meta-item">📅 <time datetime="${dateISO}">${formattedDate}</time></span>
                <span class="meta-item">👤 ${SETTINGS.authorName}</span>
                <span class="meta-item">⏱️ ${readTime} min read</span>
                <span class="meta-item">🏷️ Review</span>
            </div>
        </header>
        
        <div class="body">
            ${bodyContent}
            
            <div class="article-footer">
                <div class="tags">
                    <span class="tag">Technology</span>
                    <span class="tag">Review</span>
                    <span class="tag">Analysis</span>
                    <span class="tag">Tech News</span>
                </div>
                <div class="copyright">© ${new Date().getFullYear()} ZeeoXForU. All rights reserved.</div>
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
            
            console.log('✅ تم النشر بنجاح!');
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
            console.log(`💾 تم حفظ النسخة الاحتياطية: ${fileName}`);
            return fileName;
        } catch (error) {
            console.error('❌ فشل حفظ النسخة الاحتياطية:', error.message);
            return null;
        }
    }

    async run() {
        console.log('\n' + '='.repeat(60));
        console.log('🚀 ZeeoXForU Auto Publisher - Structured Version');
        console.log('='.repeat(60));
        
        try {
            const articles = await this.findUnpublishedArticles();
            
            if (articles.length === 0) {
                console.log('\n✅ لا توجد مقالات جديدة للنشر.');
                return;
            }
            
            for (const article of articles) {
                console.log(`\n📄 معالجة: ${article.title}`);
                console.log('📋 إعادة هيكلة المحتوى...');
                
                const structuredContent = await this.extractArticleContent(article.link);
                const postHtml = this.generatePostHtml(article, structuredContent);
                
                // حفظ نسخة محلية
                await this.saveLocalBackup(article.title, postHtml, article.category);
                
                // نشر إلى Blogger
                console.log('📤 نشر إلى Blogger...');
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
            
            console.log(`\n📊 إحصائيات النشر:`);
            console.log(`   ✅ تم النشر بنجاح: ${this.publishedCount}`);
            console.log(`   📝 إجمالي المقالات المعالجة: ${articles.length}`);
            
        } catch (error) {
            console.error('\n❌ فشل التشغيل:', error.message);
        }
    }
}

// تشغيل الناشر
console.log('📢 ZeeoXForU Structured Auto Publisher v4.0');
console.log('✨ المميزات: إعادة هيكلة كاملة للمقالات');
const publisher = new AutoPublisher();
publisher.run().then(() => console.log('\n✅ اكتملت العملية بنجاح')).catch(e => console.error('\n❌', e.message));
