const express = require('express');
const { google } = require('googleapis');
const open = require('open');

const CLIENT_ID = '1022254688087-e0eck5t7mnqj9fvkkojvi5cssah6f8i0.apps.googleusercontent.com';
const CLIENT_SECRET = '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';
const REDIRECT_URI = 'http://localhost:3000/oauth2callback';

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const SCOPES = ['https://www.googleapis.com/auth/blogger'];

const app = express();

app.get('/', (req, res) => {
    const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
        prompt: 'consent'
    });
    
    res.send(`
        <h1>الحصول على Refresh Token</h1>
        <p>انقر على الرابط للموافقة:</p>
        <a href="${authUrl}" target="_blank">الموافقة على الصلاحيات</a>
    `);
    
    console.log('🔗 افتح الرابط التالي في المتصفح:');
    console.log(authUrl);
});

app.get('/oauth2callback', async (req, res) => {
    const code = req.query.code;
    
    if (!code) {
        res.send('❌ لم يتم استلام الكود');
        return;
    }
    
    try {
        const { tokens } = await oauth2Client.getToken(code);
        
        res.send(`
            <h1>✅ تم الحصول على التوكن بنجاح!</h1>
            <h2>انسخ الكود التالي:</h2>
            <pre style="background:#f4f4f4;padding:20px;border-radius:5px;">
REFRESH_TOKEN=${tokens.refresh_token}
            </pre>
            <p><strong>ملاحظة:</strong> احفظ هذا التوكن بأمان ولا تشاركه مع أحد</p>
        `);
        
        console.log('\n✅ تم الحصول على Refresh Token بنجاح!');
        console.log('📋 انسخ هذا السطر وأضفه للكود:');
        console.log(`REFRESH_TOKEN=${tokens.refresh_token}`);
        
    } catch (error) {
        console.error('❌ خطأ:', error);
        res.send('حدث خطأ: ' + error.message);
    }
    
    // إغلاق السيرفر بعد 5 ثواني
    setTimeout(() => {
        console.log('\n👋 تم إغلاق السيرفر');
        process.exit(0);
    }, 5000);
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`🌐 السيرفر يعمل على http://localhost:${PORT}`);
    console.log('📝 انتظر حتى يتم فتح المتصفح تلقائياً...\n');
    
    // فتح المتصفح تلقائياً
    open(`http://localhost:${PORT}`);
});
