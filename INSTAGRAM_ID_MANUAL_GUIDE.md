# كيفية الحصول على Instagram Business Account ID بعد الربط

## الخطوة 1: التحقق من الربط

بعد ربط Instagram بـ Facebook Page، انتظر بضع دقائق ثم اتبع هذه الخطوات:

### الطريقة 1: من Facebook Page Settings

1. اذهب إلى: https://www.facebook.com/pages/settings/
2. اختر صفحة "Hidden Radiology"
3. في القائمة الجانبية، انقر على "Instagram"
4. سترى حساب Instagram المرتبط
5. انقر على "View" أو "عرض" بجانب الحساب
6. سيفتح Instagram Business Account في Facebook Business Suite
7. انسخ Instagram Business Account ID من URL أو من صفحة الإعدادات

### الطريقة 2: من Instagram App

1. افتح تطبيق Instagram
2. اذهب إلى الإعدادات (Settings)
3. اذهب إلى "Account" -> "Professional Dashboard"
4. ابحث عن "Business Account ID"
5. انسخ الرقم

### الطريقة 3: من Facebook Business Suite

1. اذهب إلى: https://business.facebook.com/
2. اذهب إلى "Business Settings"
3. اختر "Instagram Accounts"
4. سترى حساب Instagram المرتبط
5. انسخ Instagram Business Account ID

---

## الخطوة 2: تحديث Vercel

بعد الحصول على Instagram Business Account ID (رقم طويل من 10-20 خانة):

1. اذهب إلى: https://vercel.com/hiddenradiologymedia-6907s-projects/hidden-radiology-factory/settings/environment-variables
2. حدّث المتغير:
   - `INSTAGRAM_BUSINESS_ACCOUNT_ID` = الرقم الجديد (مثال: `17841400000000000`)
3. احفظ التغييرات

---

## الخطوة 3: التحقق من الحالة

```bash
curl "https://hidden-radiology-project-chi.vercel.app/api/cron/meta-token-health" \
  -H "Authorization: Bearer N27QXgniOxGBDmy3JzSpdeAVwaho0WFr"
```

يجب أن ترى:
```json
{
  "success": true,
  "tokens": {
    "facebook": "valid",
    "instagram": "valid"
  }
}
```

---

## الخطوة 4: اختبار النشر على Instagram

```bash
curl "https://hidden-radiology-project-chi.vercel.app/api/marketing/cron" \
  -H "Authorization: Bearer N27QXgniOxGBDmy3JzSpdeAVwaho0WFr"
```

---

## ملاحظات مهمة

- Instagram Business Account ID هو رقم طويل (10-20 خانة)
- ليس اسم المستخدم (@username)
- لا يحتوي على حروف، فقط أرقام
- يمكنك العثور عليه في إعدادات Instagram Business Account أو Facebook Business Suite

---

## إذا لم تجد الربط في Facebook API

هذا طبيعي - قد يستغرق Facebook API بعض الوقت لتحديث الربط. يمكنك:

1. الانتظار 5-10 دقائق ثم المحاولة مرة أخرى
2. استخدام الطرق اليدوية المذكورة أعلاه
3. التحقق من الربط في Facebook Business Suite مباشرة
