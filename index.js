const { GoogleGenerativeAI } = require("@google/generative-ai");

async function testKey() {
    const genAI = new GoogleGenerativeAI("AIzaSyBfxlvNkS2Y2UnXp0MmXNmndJXai9hOD_s");
    
    try {
        // سنحاول جلب قائمة الموديلات المتاحة فعلياً لهذا المفتاح
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${genAI.apiKey}`);
        const data = await response.json();
        
        if (data.error) {
            console.error("❌ فشل المفتاح:", data.error.message);
        } else {
            console.log("✅ المفتاح يعمل! الموديلات المتاحة لك هي:");
            data.models.map(m => console.log("- " + m.name));
        }
    } catch (e) {
        console.error("❌ خطأ في الاتصال:", e);
    }
}

testKey();
