const Groq = require("groq-sdk");
const { google } = require("googleapis");

const CONFIG = {
    groqKey: "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",
    blogId: "8249860422330426533",
    clientId: "872415365656-7qribadnc7k2u21kl6jjcbatdueevifh.apps.googleusercontent.com",
    clientSecret: "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",
    refreshToken: "1//04yti9k2agPknCgYIARAAGAQSNwF-L9IrTZPKt5Fqbg2vrM9sBtOks9cnY4M7Idg0LToQnlbYGME06k20vcyr_SVmYk1H_yZJdEc",
    siteName: "TECH VANGUARD"
};

const groq = new Groq({ apiKey: CONFIG.groqKey });

async function runGroqPublisher() {
    try {
        // 1. توليد عنوان قوي
        const titleRes = await groq.chat.completions.create({
            messages: [{ role: "user", content: "Generate a viral, futuristic tech/money guide title for 2026. No emojis." }],
            model: "llama-3.3-70b-versatile",
        });
        const targetTitle = titleRes.choices[0].message.content.trim();

        // 2. توليد محتوى ضخم (Deep Content)
        console.log("🔥 Generating Mega Article (1000+ words)...");
        const contentRes = await groq.chat.completions.create({
            messages: [{ 
                role: "user", 
                content: `Write a massive, 1200-word authoritative guide about "${targetTitle}".
                STRUCTURE REQUIREMENTS:
                - Introduction: 200 words.
                - 5 Main Chapters (<h2>): Each chapter must have 150+ words of deep analysis.
                - Expert Tips Section: Detailed list.
                - Conclusion: Comprehensive summary.
                - NO EMOJIS (Blogger bug).
                - NO FAKE LINKS.
                
                Format as JSON:
                {
                  "intro": "...",
                  "chapters": [
                    {"title": "Chapter 1", "content": "..."},
                    {"title": "Chapter 2", "content": "..."},
                    {"title": "Chapter 3", "content": "..."},
                    {"title": "Chapter 4", "content": "..."},
                    {"title": "Chapter 5", "content": "..."}
                  ],
                  "summary": "..."
                }` 
            }],
            model: "llama-3.3-70b-versatile",
            response_format: { type: "json_object" }
        });
        
        const data = JSON.parse(contentRes.choices[0].message.content);

        // 3. تصميم الـ HTML (العودة للألوان القوية والأنيميشن)
        const finalHtml = `
        <div class="kiro-container" dir="ltr">
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;900&family=Inter:wght@300;600;800&display=swap');

                :root {
                    --primary: #00f2fe;
                    --secondary: #4facfe;
                    --accent: #f093fb;
                    --bg-dark: #0f172a;
                    --text-main: #e2e8f0;
                }

                .kiro-container {
                    font-family: 'Inter', sans-serif;
                    background: var(--bg-dark);
                    color: var(--text-main);
                    padding: 20px;
                    border-radius: 24px;
                    line-height: 1.8;
                    overflow: hidden;
                    position: relative;
                }

                /* Animation: FadeInUp */
                @keyframes fadeInUp {
                    from { opacity: 0; transform: translateY(30px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                /* Header Futuristic */
                .kiro-header {
                    text-align: center;
                    padding: 60px 20px;
                    background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
                    border-radius: 20px;
                    border: 1px solid rgba(255,255,255,0.1);
                    margin-bottom: 30px;
                    animation: fadeInUp 0.8s ease-out;
                }

                .kiro-header h1 {
                    font-family: 'Orbitron', sans-serif;
                    font-size: clamp(28px, 5vw, 50px);
                    background: linear-gradient(to right, var(--primary), var(--accent));
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    margin-bottom: 20px;
                    text-transform: uppercase;
                }

                /* Hero Image with Glow */
                .kiro-img-wrapper {
                    position: relative;
                    margin-bottom: 40px;
                    border-radius: 20px;
                    overflow: hidden;
                    box-shadow: 0 0 30px rgba(0, 242, 254, 0.2);
                    animation: fadeInUp 1s ease-out;
                }

                .kiro-img-wrapper img {
                    width: 100%;
                    display: block;
                    transition: transform 0.5s;
                }

                .kiro-img-wrapper:hover img { transform: scale(1.05); }

                /* Sectioning & Spacing */
                .kiro-content-section {
                    background: rgba(255,255,255,0.03);
                    padding: 40px;
                    border-radius: 20px;
                    margin-bottom: 25px;
                    border-left: 5px solid var(--primary);
                    transition: 0.3s;
                }

                .kiro-content-section:hover {
                    background: rgba(255,255,255,0.06);
                    transform: translateX(10px);
                }

                .kiro-content-section h2 {
                    font-family: 'Orbitron', sans-serif;
                    color: var(--primary);
                    font-size: 26px;
                    margin-bottom: 15px;
                }

                .kiro-content-section p {
                    font-size: 18px;
                    color: #cbd5e1;
                    text-align: justify;
                }

                /* Custom Styled List (No Emojis, No Bugs) */
                .kiro-list {
                    list-style: none;
                    padding: 0;
                    margin: 20px 0;
                }

                .kiro-list li {
                    position: relative;
                    padding: 15px 15px 15px 40px;
                    background: rgba(255,255,255,0.02);
                    margin-bottom: 10px;
                    border-radius: 10px;
                }

                .kiro-list li::before {
                    content: "";
                    position: absolute;
                    left: 15px;
                    top: 50%;
                    transform: translateY(-50%);
                    width: 10px;
                    height: 10px;
                    background: var(--accent);
                    border-radius: 50%;
                    box-shadow: 0 0 10px var(--accent);
                }

                /* Footer */
                .kiro-footer {
                    text-align: center;
                    padding: 40px;
                    border-top: 1px solid rgba(255,255,255,0.1);
                    font-family: 'Orbitron', sans-serif;
                    letter-spacing: 3px;
                    font-size: 12px;
                    color: var(--secondary);
                }
            </style>

            <header class="kiro-header">
                <h1>${targetTitle}</h1>
                <p style="font-size: 18px; opacity: 0.8;">Ultimate Intelligence Report // 2026</p>
            </header>

            <div class="kiro-img-wrapper">
                <img src="https://image.pollinations.ai/prompt/${encodeURIComponent(targetTitle)}?width=1200&height=640&nologo=true" alt="Banner">
            </div>

            <div class="kiro-content-section">
                <h2>Executive Summary</h2>
                <p>${data.intro}</p>
            </div>

            ${data.chapters.map(ch => `
                <div class="kiro-content-section">
                    <h2>${ch.title}</h2>
                    <p>${ch.content}</p>
                </div>
            `).join('')}

            <div class="kiro-content-section">
                <h2>Key Takeaways</h2>
                <ul class="kiro-list">
                    <li>Comprehensive Data Analysis and Integration</li>
                    <li>Strategic Implementation Frameworks</li>
                    <li>Scalable Solutions for Global Markets</li>
                    <li>Future-Proof Methodology for 2026</li>
                </ul>
            </div>

            <div class="kiro-content-section">
                <h2>Final Conclusion</h2>
                <p>${data.summary}</p>
            </div>

            <footer class="kiro-footer">
                SYSTEM STATUS: ACTIVE | TERMINAL: ${CONFIG.siteName}
            </footer>
        </div>
        `;

        // 4. النشر لبلوجر
        const oauth2Client = new google.auth.OAuth2(CONFIG.clientId, CONFIG.clientSecret);
        oauth2Client.setCredentials({ refresh_token: CONFIG.refreshToken });
        const blogger = google.blogger({ version: "v3", auth: oauth2Client });

        await blogger.posts.insert({
            blogId: CONFIG.blogId,
            requestBody: { 
                title: targetTitle, 
                content: finalHtml, 
                labels: ["MegaGuide", "FutureTech", "2026"] 
            }
        });

        console.log("✅ BOOM! Article is Live with Animations & Long Content.");
    } catch (error) {
        console.error("❌ Error:", error);
    }
}

runGroqPublisher();
