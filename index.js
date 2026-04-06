const Parser = require('rss-parser');
const axios = require('axios');
const cheerio = require('cheerio');
const { google } = require('googleapis');
const Jimp = require('jimp');
const Groq = require('groq-sdk');

// ==========================================
// الإعدادات المتقدمة
// ==========================================
const CONFIG = {
    blog: {
        id: "8249860422330426533",
        clientId: "872415365656-7qribadnc7k2u21kl6jjcbatdueevifh.apps.googleusercontent.com",
        clientSecret: "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",
        refreshToken: "1//04yti9k2agPknCgYIARAAGAQSNwF-L9IrTZPKt5Fqbg2vrM9sBtOks9cnY4M7Idg0LToQnlbYGME06k20vcyr_SVmYk1H_yZJdEc"
    },
    groq: {
        apiKey: "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"
    },
    watermark: {
        text: "© TRENDING TECH UPDATE",
        position: 'bottom', // bottom, center, top
        opacity: 0.6
    },
    content: {
        maxLength: 3500,
        minLength: 500
    }
};

// قائمة المصادر مع أولويات
const RSS_SOURCES = [
    { url: 'https://www.makeuseof.com/feed/', priority: 1 },
    { url: 'https://fossbytes.com/feed/', priority: 2 },
    { url: 'https://www.howtogeek.com/feed/', priority: 1 },
    { url: 'https://www.techradar.com/rss', priority: 1 },
    { url: 'https://www.gadgetstouse.com/feed/', priority: 2 },
    { url: 'https://www.theverge.com/rss/index.xml', priority: 1 }
];

// إعدادات الـ API
const groq = new Groq({ apiKey: CONFIG.groq.apiKey });
const parser = new Parser({
    timeout: 10000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
    }
});

// ==========================================
// نظام Logging احترافي
// ==========================================
const Logger = {
    info: (msg) => console.log(`✅ ${new Date().toISOString()} - ${msg}`),
    error: (msg) => console.error(`❌ ${new Date().toISOString()} - ${msg}`),
    warn: (msg) => console.warn(`⚠️ ${new Date().toISOString()} - ${msg}`),
    process: (msg) => console.log(`🔄 ${new Date().toISOString()} - ${msg}`)
};

// ==========================================
// معالجة الصور بشكل احترافي
// ==========================================
class ImageProcessor {
    static async downloadImage(url) {
        try {
            const response = await axios({
                method: 'get',
                url: url,
                responseType: 'arraybuffer',
                timeout: 15000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            return Buffer.from(response.data, 'binary');
        } catch (error) {
            throw new Error(`Failed to download image: ${error.message}`);
        }
    }

    static async addProfessionalWatermark(imageBuffer, text) {
        try {
            const image = await Jimp.read(imageBuffer);
            
            // تحسين جودة الصورة
            if (image.getWidth() > 1200) {
                image.resize(1200, Jimp.AUTO);
            }
            
            // تحسين التباين والسطوع بشكل خفيف
            image.contrast(0.05);
            image.brightness(0.02);
            
            // تحميل الخط المناسب
            const font = await Jimp.loadFont(Jimp.FONT_SANS_32_WHITE);
            const smallFont = await Jimp.loadFont(Jimp.FONT_SANS_16_WHITE);
            
            const textWidth = Jimp.measureText(font, text);
            const textHeight = Jimp.measureTextHeight(font, text);
            const imageWidth = image.getWidth();
            const imageHeight = image.getHeight();
            
            // إنشاء خلفية شفافة للعلامة المائية
            const padding = 20;
            const bgWidth = textWidth + (padding * 2);
            const bgHeight = textHeight + (padding * 1.5);
            
            // موقع العلامة المائية (أسفل اليمين)
            const x = imageWidth - bgWidth - 20;
            const y = imageHeight - bgHeight - 20;
            
            // إضافة خلفية شفافة
            const background = new Jimp(bgWidth, bgHeight, 0x00000099);
            image.composite(background, x, y);
            
            // إضافة النص
            image.print(
                font,
                x + padding,
                y + (bgHeight / 2) - (textHeight / 2),
                text
            );
            
            // إضافة نص صغير في الأسفل (اختياري)
            const footerText = "AI Optimized Content";
            const footerWidth = Jimp.measureText(smallFont, footerText);
            image.print(
                smallFont,
                imageWidth - footerWidth - 10,
                imageHeight - 25,
                footerText
            );
            
            return await image.getBase64Async(Jimp.MIME_JPEG);
        } catch (error) {
            Logger.error(`Watermark failed: ${error.message}`);
            return null;
        }
    }
}

// ==========================================
// معالجة المحتوى
// ==========================================
class ContentProcessor {
    static cleanHtml(html) {
        try {
            const $ = cheerio.load(html);
            
            // إزالة العناصر غير المرغوب فيها
            const removeSelectors = [
                'script', 'style', 'iframe', 'noscript', 'nav', 'footer',
                'header', 'aside', '.advertisement', '.ads', '.social-share',
                '.comments', '.related-posts', '.newsletter', '.popup',
                '[class*="ad"]', '[id*="ad"]', '.cookie-notice'
            ];
            
            removeSelectors.forEach(selector => {
                $(selector).remove();
            });
            
            // استخراج النص الرئيسي
            let text = $('article').text() || 
                      $('.entry-content').text() || 
                      $('.post-content').text() || 
                      $('main').text() || 
                      $('body').text();
            
            // تنظيف النص
            text = text.replace(/\s+/g, ' ')
                      .replace(/[^\w\s.,!?;:()\-]/g, '')
                      .trim();
            
            // إزالة التكرارات
            const sentences = text.split(/[.!?]+/);
            const uniqueSentences = [...new Set(sentences)];
            text = uniqueSentences.join('. ');
            
            return text.slice(0, CONFIG.content.maxLength);
        } catch (error) {
            Logger.error(`HTML cleaning failed: ${error.message}`);
            return null;
        }
    }
    
    static async enhanceWithAI(title, content) {
        try {
            const prompt = `You are a professional tech content writer. Rewrite this article to be unique and engaging:
            
Title: ${title}

Content: ${content}

Requirements:
1. Make it 100% unique and original
2. Use proper HTML formatting (h2 for headings, p for paragraphs)
3. Add relevant emojis where appropriate
4. Keep professional tone but engaging
5. Length: 800-1500 words
6. Add a compelling introduction and conclusion
7. Remove any dates, author names, or references to original source
8. Optimize for SEO with natural keyword placement

Start directly with the content, no meta-commentary.`;

            const completion = await groq.chat.completions.create({
                messages: [
                    {
                        role: "system",
                        content: "You are an expert tech journalist and SEO specialist. Create unique, high-quality content that passes as original."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                model: "mixtral-8x7b-32768",
                temperature: 0.7,
                max_tokens: 2000
            });
            
            return completion.choices[0]?.message?.content || content;
        } catch (error) {
            Logger.error(`AI enhancement failed: ${error.message}`);
            return content;
        }
    }
}

// ==========================================
// إدارة المصادر
// ==========================================
class SourceManager {
    static async getBestSource() {
        const sortedSources = [...RSS_SOURCES].sort((a, b) => a.priority - b.priority);
        
        for (const source of sortedSources) {
            try {
                const feed = await parser.parseURL(source.url);
                if (feed.items && feed.items.length > 0) {
                    return { source: source.url, feed };
                }
            } catch (error) {
                Logger.warn(`Failed to fetch ${source.url}: ${error.message}`);
                continue;
            }
        }
        return null;
    }
    
    static extractMainImage($) {
        const selectors = [
            'meta[property="og:image"]',
            'meta[name="twitter:image"]',
            'article img',
            '.entry-content img',
            'main img',
            'img.wp-image',
            '.featured-image img'
        ];
        
        for (const selector of selectors) {
            const imgUrl = $(selector).attr('content') || $(selector).attr('src');
            if (imgUrl && !imgUrl.includes('logo') && !imgUrl.includes('icon')) {
                return imgUrl;
            }
        }
        return null;
    }
}

// ==========================================
// النشر على بلوجر
// ==========================================
class BloggerPublisher {
    static async setupAuth() {
        const oauth2Client = new google.auth.OAuth2(
            CONFIG.blog.clientId,
            CONFIG.blog.clientSecret
        );
        oauth2Client.setCredentials({
            refresh_token: CONFIG.blog.refreshToken
        });
        return google.blogger({ version: 'v3', auth: oauth2Client });
    }
    
    static async publish(postData) {
        try {
            const blogger = await this.setupAuth();
            
            const styledContent = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1">
                    <style>
                        body {
                            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                            line-height: 1.8;
                            color: #2c3e50;
                            max-width: 800px;
                            margin: 0 auto;
                            padding: 20px;
                        }
                        h1 { font-size: 2em; color: #2c3e50; margin: 1em 0 0.5em; }
                        h2 { font-size: 1.5em; color: #34495e; margin: 1.2em 0 0.8em; border-bottom: 2px solid #ecf0f1; padding-bottom: 0.3em; }
                        h3 { font-size: 1.3em; color: #7f8c8d; margin: 1em 0 0.5em; }
                        p { margin: 1em 0; text-align: justify; }
                        img { max-width: 100%; height: auto; border-radius: 10px; margin: 1.5em 0; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
                        .featured-image { text-align: center; margin: 2em 0; }
                        blockquote { border-left: 4px solid #3498db; margin: 1.5em 0; padding: 0.5em 0 0.5em 2em; background: #f8f9fa; }
                        code { background: #f4f4f4; padding: 0.2em 0.4em; border-radius: 3px; font-family: monospace; }
                        pre { background: #f4f4f4; padding: 1em; border-radius: 5px; overflow-x: auto; }
                        .footer { margin-top: 3em; padding-top: 1em; border-top: 1px solid #ecf0f1; font-size: 0.9em; color: #95a5a6; text-align: center; }
                        @media (max-width: 600px) { body { padding: 10px; font-size: 16px; } }
                    </style>
                </head>
                <body>
                    ${postData.imageHtml}
                    <article>
                        ${postData.content}
                    </article>
                    <div class="footer">
                        <p>✨ AI Optimized Content • Published Automatically ✨</p>
                    </div>
                </body>
                </html>
            `;
            
            const result = await blogger.posts.insert({
                blogId: CONFIG.blog.id,
                requestBody: {
                    title: postData.title,
                    content: styledContent,
                    labels: ['Technology', 'AI Generated', 'Auto-Post'],
                    status: 'LIVE'
                }
            });
            
            return result.data;
        } catch (error) {
            throw new Error(`Blogger publish failed: ${error.message}`);
        }
    }
}

// ==========================================
// المحرك الرئيسي
// ==========================================
class AutoBlogger {
    static async run() {
        try {
            Logger.info("Starting AutoBlogger Engine v2.0");
            
            // 1. جلب أفضل مصدر
            Logger.process("Fetching best RSS source...");
            const sourceData = await SourceManager.getBestSource();
            
            if (!sourceData || !sourceData.feed.items[0]) {
                throw new Error("No valid RSS sources available");
            }
            
            const article = sourceData.feed.items[0];
            Logger.info(`Selected article: ${article.title}`);
            
            // 2. جلب المحتوى الكامل
            Logger.process("Fetching full article content...");
            const response = await axios.get(article.link, {
                timeout: 15000,
                headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BlogBot/1.0)' }
            });
            
            const $ = cheerio.load(response.data);
            
            // 3. تنظيف المحتوى
            Logger.process("Cleaning and processing content...");
            const cleanContent = ContentProcessor.cleanHtml($.html());
            
            if (!cleanContent || cleanContent.length < CONFIG.content.minLength) {
                throw new Error(`Content too short (${cleanContent?.length || 0} chars)`);
            }
            
            // 4. تحسين المحتوى بالذكاء الاصطناعي
            Logger.process("Enhancing content with AI...");
            const enhancedContent = await ContentProcessor.enhanceWithAI(article.title, cleanContent);
            
            // 5. معالجة الصورة
            Logger.process("Processing featured image...");
            let imageHtml = '';
            const imageUrl = SourceManager.extractMainImage($);
            
            if (imageUrl) {
                try {
                    const imageBuffer = await ImageProcessor.downloadImage(imageUrl);
                    const watermarkedImage = await ImageProcessor.addProfessionalWatermark(
                        imageBuffer,
                        CONFIG.watermark.text
                    );
                    
                    if (watermarkedImage) {
                        imageHtml = `<div class="featured-image"><img src="${watermarkedImage}" alt="${article.title}" loading="lazy"/></div>`;
                    }
                } catch (error) {
                    Logger.warn(`Image processing failed: ${error.message}`);
                }
            }
            
            // 6. النشر على بلوجر
            Logger.process("Publishing to Blogger...");
            const publishResult = await BloggerPublisher.publish({
                title: article.title,
                content: enhancedContent,
                imageHtml: imageHtml
            });
            
            Logger.info(`✅ Article published successfully! URL: ${publishResult.url}`);
            
        } catch (error) {
            Logger.error(`Fatal error: ${error.message}`);
            throw error;
        }
    }
}

// ==========================================
// تشغيل النظام مع إعادة المحاولات
// ==========================================
async function main() {
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 5000;
    
    for (let i = 0; i < MAX_RETRIES; i++) {
        try {
            await AutoBlogger.run();
            break;
        } catch (error) {
            Logger.error(`Attempt ${i + 1} failed: ${error.message}`);
            if (i < MAX_RETRIES - 1) {
                Logger.process(`Retrying in ${RETRY_DELAY/1000} seconds...`);
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
            } else {
                Logger.error("All attempts failed. Exiting.");
                process.exit(1);
            }
        }
    }
}

// تشغيل البوت
if (require.main === module) {
    main().catch(console.error);
}

module.exports = { AutoBlogger, ContentProcessor, ImageProcessor };
