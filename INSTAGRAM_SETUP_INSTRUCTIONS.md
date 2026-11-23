# تعليمات ربط Instagram بـ Facebook Page

## المشكلة الحالية

Instagram Business Account غير مرتبط بـ Facebook Page. هذا هو سبب عدم عمل Instagram Publishing.

## الحل: ربط Instagram بـ Facebook Page

### الخطوة 1: ربط Instagram بـ Facebook Page

1. اذهب إلى: https://www.facebook.com/pages/settings/
2. اختر صفحة Facebook الخاصة بك
3. في القائمة الجانبية، انقر على "Instagram"
4. انقر على "Connect an account" أو "ربط حساب"
5. قم بتسجيل الدخول إلى حساب Instagram الخاص بك
6. تأكد من أن الحساب هو Business Account أو Creator Account
7. اقبل الشروط واربط الحساب

### الخطوة 2: التحقق من الربط

بعد الربط، يمكنك التحقق باستخدام Graph API:

```bash
curl "https://graph.facebook.com/v18.0/YOUR_PAGE_ID?fields=instagram_business_account&access_token=YOUR_ACCESS_TOKEN"
```

ستحصل على استجابة مثل:
```json
{
  "id": "1208067379047351",
  "instagram_business_account": {
    "id": "17841400000000000"
  }
}
```

### الخطوة 3: تحديث المتغيرات في Vercel

بعد الحصول على Instagram Business Account ID (رقم طويل من 10-20 خانة):

1. اذهب إلى: https://vercel.com/hiddenradiologymedia-6907s-projects/hidden-radiology-factory/settings/environment-variables
2. حدّث المتغير:
   - `INSTAGRAM_BUSINESS_ACCOUNT_ID` = الرقم الجديد (مثال: `17841400000000000`)
3. احفظ التغييرات

### الخطوة 4: التحقق من الحالة

بعد التحديث، اختبر:
```bash
curl "https://hidden-radiology-project-chi.vercel.app/api/cron/meta-token-health" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

يجب أن ترى:
```json
{
  "tokens": {
    "facebook": "valid",
    "instagram": "valid"
  }
}
```

## ملاحظات مهمة

- يجب أن يكون حساب Instagram Business Account أو Creator Account
- Facebook Page و Instagram Business Account يجب أن يكونا لنفس الحساب
- Access Token يجب أن يحتوي على الصلاحيات:
  - `pages_show_list`
  - `instagram_basic`
  - `instagram_content_publish`
  - `pages_read_engagement`

## بعد الإكمال

بعد ربط Instagram وتحديث المتغيرات، يمكنك اختبار النشر على Instagram:

```bash
curl "https://hidden-radiology-project-chi.vercel.app/api/marketing/cron" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```
