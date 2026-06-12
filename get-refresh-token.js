// هذا الملف للتشغيل المحلي فقط - لا ترفعه لـ GitHub
const express = require('express');
const { google } = require('googleapis');
const open = require('open');

const CLIENT_ID = '1022254688087-e0eck5t7mnqj9fvkkojvi5cssah6f8i0.apps.googleusercontent.com';
const CLIENT_SECRET = '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';
const REDIRECT_URI = 'http://localhost:3000/oauth2callback';

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const app = express();

app.get('/', (req, res) => {
    const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: ['https://www.googleapis.com/auth/blogger'],
        prompt: 'consent'
    });
    
    res.send(`
        <h1>الحصول على Refresh Token</h1>
        <p>انقر على الرابط للموافقة:</p>
        <a href="${authUrl}" target="_blank">الموافقة على الصلاحيات</a>
    `);
    
    console.log('🔗 الرابط:', authUrl);
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
            <h1>✅ تم بنجاح!</h1>
            <pre style="background:#f4f4f4;padding:20px;">
REFRESH_TOKEN=${tokens.refresh_token}
            </pre>
        `);
        
        console.log('\n✅ Refresh Token الجديد:');
        console.log(tokens.refresh_token);
        
    } catch (error) {
        console.error('❌ خطأ:', error);
        res.send('حدث خطأ');
    }
    
    setTimeout(() => process.exit(0), 5000);
});

app.listen(3000, () => {
    console.log('🌐 http://localhost:3000');
    open('http://localhost:3000');
});
