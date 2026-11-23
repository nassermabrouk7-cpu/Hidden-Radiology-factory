# تقرير حالة Instagram - Hidden Radiology Factory
**التاريخ:** 2026-11-19

---

## 🔴 المشكلة

Instagram Business Account **غير مرتبط** بـ Facebook Page الخاص بـ Hidden Radiology.

---

## 🔍 الفحص

### Facebook Page ID
- ID: `1208067379047351`
- Access Token: ✅ صالح

### Instagram Business Account
- الربط: ❌ غير مرتبط
- النتيجة: لا يمكن الوصول إلى Instagram عبر Facebook Page

---

## 💡 الحل المطلوب

### الخطوة 1: ربط Instagram بـ Facebook Page

1. اذهب إلى: https://www.facebook.com/pages/settings/
2. اختر صفحة "Hidden Radiology"
3. في القائمة الجانبية، انقر على "Instagram"
4. انقر على "Connect an account" أو "ربط حساب"
5. قم بتسجيل الدخول إلى حساب Instagram
6. تأكد أن الحساب هو Business Account أو Creator Account
7. اقبل الشروط واربط الحساب

### الخطوة 2: التحقق من الربط

بعد الربط، شغّل هذا الأمر:
```bash
curl "https://graph.facebook.com/v18.0/1208067379047351?fields=instagram_business_account&access_token=YOUR_ACCESS_TOKEN"
```

ستحصل على:
```json
{
  "id": "1208067379047351",
  "instagram_business_account": {
    "id": "17841400000000000"
  }
}
```

### الخطوة 3: تحديث Vercel

1. اذهب إلى: https://vercel.com/hiddenradiologymedia-6907s-projects/hidden-radiology-factory/settings/environment-variables
2. حدّث:
   - `INSTAGRAM_BUSINESS_ACCOUNT_ID` = الرقم الجديد (مثال: `17841400000000000`)
3. احفظ التغييرات

### الخطوة 4: التحقق من الحالة

```bash
curl "https://hidden-radiology-project-chi.vercel.app/api/cron/meta-token-health" \
  -H "Authorization: Bearer N27QXgniOxGBDmy3JzSpdeAVwaho0WFr"
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

---

## 📊 الحالة الحالية

### ✅ يعمل:
- Facebook Publishing (Token صالح)
- Telegram Publishing (مختبر بنجاح)
- قاعدة البيانات (36 منتج)
- Cron Jobs

### ❌ لا يعمل:
- Instagram Publishing (Instagram غير مرتبط بـ Facebook Page)

---

## 🎯 ملاحظات مهمة

- **Facebook Page Access Token صالح** - Facebook سيعمل مباشرة
- **Instagram يحتاج ربط يدوي** - يجب ربط Instagram بـ Facebook Page أولاً
- **الربط يستغرق دقائق** - عملية بسيطة من Facebook Settings
- **بعد الربط** - النظام سيعمل تلقائياً على Instagram

---

## 📋 التعليمات الكاملة

راجع الملف: `INSTAGRAM_SETUP_INSTRUCTIONS.md` للحصول على تعليمات مفصلة.

---

**الحالة: بانتظار ربط Instagram بـ Facebook Page من قبل المستخدم**
