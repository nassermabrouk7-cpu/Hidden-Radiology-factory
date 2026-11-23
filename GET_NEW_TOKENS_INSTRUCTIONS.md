# تعليمات الحصول على Meta Access Tokens جديدة

## المشكلة

Facebook Page Access Token منتهي الصلاحية أو غير صالح.

## الحل

### الخطوة 1: الحصول على Facebook Page Access Token جديد

1. اذهب إلى: https://developers.facebook.com/tools/explorer/
2. اختر التطبيق المناسب
3. من القائمة المنسدلة، اختر "Get User Access Token"
4. حدد الصلاحيات المطلوبة:
   - `pages_show_list`
   - `pages_read_engagement`
   - `pages_manage_posts`
   - `instagram_basic`
   - `instagram_content_publish`
5. انقر على "Generate Access Token"
6. انسخ الـ Token

7. بعد الحصول على User Access Token، احصل على Page Access Token:
   ```
   GET https://graph.facebook.com/v18.0/me/accounts?access_token=USER_ACCESS_TOKEN
   ```
8. انسخ Page Access Token لصفحة Hidden Radiology

### الخطوة 2: الحصول على Instagram Business Account ID

بعد الحصول على Page Access Token صالح:

1. استخدم هذا الأمر:
   ```
   GET https://graph.facebook.com/v18.0/PAGE_ID?fields=instagram_business_account&access_token=PAGE_ACCESS_TOKEN
   ```
2. انسخ Instagram Business Account ID من الاستجابة

### الخطوة 3: تحديث Vercel

1. اذهب إلى: https://vercel.com/hiddenradiologymedia-6907s-projects/hidden-radiology-factory/settings/environment-variables
2. حدّث المتغيرات:
   - `FACEBOOK_PAGE_ACCESS_TOKEN` = Page Access Token الجديد
   - `INSTAGRAM_BUSINESS_ACCOUNT_ID` = Instagram Business Account ID
3. احفظ التغييرات

### الخطوة 4: التحقق من الحالة

```bash
curl "https://hidden-radiology-project-chi.vercel.app/api/cron/meta-token-health" \
  -H "Authorization: Bearer N27QXgniOxGBDmy3JzSpdeAVwaho0WFr"
```

---

## ملاحظات مهمة

- Access Tokens تنتهي صلاحيتها. يجب تجديدها دورياً
- Page Access Token أفضل من User Access Token للنشر المبرمج
- تأكد من أن التطبيق لديه الصلاحيات المطلوبة
- Instagram Business Account ID يجب أن يكون رقمياً (10-20 خانة)
