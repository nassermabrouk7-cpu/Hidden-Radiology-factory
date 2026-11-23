# تقرير حالة Meta Tokens - Hidden Radiology Factory
**التاريخ:** 2026-11-20

---

## 📊 الحالة الحالية

### Facebook Access Token
- الحالة: ✅ **valid** (صالح)
- النتيجة: يمكن النشر على Facebook

### Instagram Business Account ID
- الحالة: ❌ **invalid** (غير صالح)
- المشكلة: القيمة الحالية ليست رقمية (10-20 خانة)
- القيمة الحالية: تحتوي على حروف أو رموز

---

## 🔍 المشكلة التفصيلية

Instagram Business Account ID يجب أن يكون:
- رقم فقط (بدون حروف)
- طول 10-20 خانة
- مثال: `17841400000000000`

القيمة الحالية في Vercel:
- تحتوي على حروف أو رموز
- ليست بالتنسيق الصحيح

---

## 💡 الحل المطلوب

### الخيار 1: تحديث Instagram Business Account ID يدوياً

1. **احصل على Instagram Business Account ID:**
   - اذهب إلى: https://business.facebook.com/
   - Business Settings -> Instagram Accounts
   - انسخ ID (رقم 10-20 خانة)

   أو من Instagram App:
   - Settings -> Account -> Professional Dashboard
   - انسخ Business Account ID

2. **حدّث في Vercel:**
   - اذهب إلى: https://vercel.com/hiddenradiologymedia-6907s-projects/hidden-radiology-factory/settings/environment-variables
   - حدّث `INSTAGRAM_BUSINESS_ACCOUNT_ID` = الرقم الجديد
   - احفظ التغييرات

3. **تحقق من الحالة:**
   ```bash
   curl "https://hidden-radiology-project-chi.vercel.app/api/cron/meta-token-health" \
     -H "Authorization: Bearer N27QXgniOxGBDmy3JzSpdeAVwaho0WFr"
   ```

### الخيار 2: استخدام Vercel CLI

بعد الحصول على Instagram Business Account ID:

```bash
vercel env rm INSTAGRAM_BUSINESS_ACCOUNT_ID production
vercel env add INSTAGRAM_BUSINESS_ACCOUNT_ID production
# Enter the new ID when prompted
```

---

## 📋 المعلومات المطلوبة

أحتاج منك تزويدي بـ **Instagram Business Account ID** الصحيح.

### كيفية الحصول عليه:

#### من Facebook Business Suite:
1. https://business.facebook.com/
2. Business Settings
3. Instagram Accounts
4. انسخ ID (رقم طويل)

#### من Instagram App:
1. افتح Instagram
2. Settings -> Account -> Professional Dashboard
3. انسخ Business Account ID

---

## ✅ بعد التحديث

بعد تحديث Instagram Business Account ID، سأقوم بـ:
1. التحقق من الحالة
2. اختبار النشر على Instagram
3. التأكد من عمل جميع القنوات
4. اختبار Cron Jobs
5. التسليم النهائي الشامل

---

**الحالة: بانتظار Instagram Business Account ID الصحيح من المستخدم**
