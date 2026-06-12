name: نشر يومي تلقائي

on:
  schedule:
    - cron: '0 */6 * * *'  # كل 6 ساعات بدلاً من كل 10 دقائق
  workflow_dispatch:
  push:
    branches: [ main ]

jobs:
  publish:
    runs-on: ubuntu-latest
    
    steps:
    - name: تحميل المستودع
      uses: actions/checkout@v4
      
    - name: إعداد Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '20'
        
    - name: تثبيت الحزم
      run: |
        npm init -y
        npm install axios cheerio fs-extra
        
    - name: تشغيل النشر
      env:
        REFRESH_TOKEN: ${{ secrets.REFRESH_TOKEN }}
      run: node index.js
      
    - name: حفظ الحالة
      uses: actions/upload-artifact@v4
      with:
        name: published-state
        path: |
          gsmarena_state.json
          posts_gsmarena/*.html
          
    - name: تحديث المستودع
      run: |
        git config user.name "github-actions"
        git config user.email "actions@github.com"
        git add gsmarena_state.json posts_gsmarena/
        git commit -m "نشر تلقائي: $(date)" || exit 0
        git push
