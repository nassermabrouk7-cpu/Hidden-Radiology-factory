# تقرير فحص وإصلاح منظومة النشر التلقائي
**Hidden Radiology Factory**
**التاريخ:** 2026-11-12

---

## ملخص التنفيذ

تم فحص شامل للكود الحالي واكتشاف المشكلات التالية التي تمنع النشر التلقائي الكامل دون موافقة إدارية.

---

## 1. المشكلات المكتشفة

### 1.1 مشكلة دورة الحالات (Status Cycle)

**الموقع:** `src/lib/marketing-auth.ts` و `src/lib/marketing-publisher.ts`

**الوصف:**
- التوليد في `marketing/generate` يحفظ المحتوى بحالة:
  - `approved` إذا `MARKETING_AUTO_PUBLISH=true`
  - `queued` إذا `MARKETING_AUTO_PUBLISH=false`
- الناشر في `marketing-publisher.ts` (سطر 708) يشترط:
  ```typescript
  const eligibleStatuses = ["approved"];
  ```
- هذا يعني أن المحتوى بـ `queued` **لن يتم نشره أبداً تلقائياً**

**الحالة الحالية:**
```
generated → queued (منع النشر التلقائي)
generated → approved (النشر مسموح)
```

**الحالة المطلوبة:**
```
generated → validated → scheduled → publishing → published
             ↘ failed ↗
```

**التأثير:** إذا لم يكن `MARKETING_AUTO_PUBLISH=true`، فلن يتم النشر تلقائياً.

---

### 1.2 مشكلة ترتيب Cron Jobs

**الموقع:** `vercel.json`

**الوصف:**
الجدولة الحالية:
```json
{
  "crons": [
    { "path": "/api/cron/meta-token-health", "schedule": "0 5 * * *" },    // 5 AM UTC
    { "path": "/api/publish-all?auto=true", "schedule": "0 7 * * *" },      // 7 AM UTC
    { "path": "/api/marketing/generate", "schedule": "0 8 * * *" },         // 8 AM UTC
    { "path": "/api/marketing/cron", "schedule": "0 9 * * *" }               // 9 AM UTC
  ]
}
```

**المشكلة:**
- النشر يتم الساعة 7 AM UTC
- التوليد يتم الساعة 8 AM UTC
- هذا يعني أن النشر سيعمل على محتوى قديم من اليوم السابق

**الترتيب الصحيح:**
1. فحص التوكنات (5 AM UTC)
2. توليد المحتوى (6 AM UTC)
3. النشر (7 AM UTC)
4. Cron للنشر المتزامن (8 AM UTC) - اختياري

---

### 1.3 مشكلة شروط النشر في Publisher

**الموقع:** `src/lib/marketing-publisher.ts` سطر 663

**الوصف:**
```typescript
if (!isMarketingItemPublishAuthorized("approved")) {
  return { processed: false, error: "Automatic social publishing is disabled." };
}
```

**المشكلة:**
- الدالة `isMarketingItemPublishAuthorized` تعتمد على:
  ```typescript
  return autoPublish === "true" && status === "approved";
  ```
- هذا يعني أنه حتى لو كان المحتوى `approved`، يجب أن يكون `MARKETING_AUTO_PUBLISH=true`

**التأثير:** إذا لم يكن المتغير مضبوطاً، النشر التلقائي معطل بالكامل.

---

### 1.4 مشكلة حالة `scheduled` غير مستخدمة

**الموقع:** `src/lib/marketing-publisher.ts` سطر 708

**الوصف:**
- الحالة `scheduled` موجودة في نوع البيانات (سطر 28)
- لكن `eligibleStatuses` لا تحتوي عليها
- المحتوى لا ينتقل إلى `scheduled` بشكل صحيح

**التأثير:** النظام لا يستفيد من حالة الوسيط الصحيحة.

---

### 1.5 مشكلة Metricool المدفوع

**الموقع:** `src/lib/marketing-publisher.ts` سطر 44

**الوصف:**
```typescript
function isMetricoolEnabled(): boolean {
  return process.env.MARKETING_ALLOW_PAID_METRICOOL_API === "true" && Boolean(process.env.METRICOOL_API_TOKEN);
}
```

**المشكلة:**
- إذا كان Metricool مفعلاً، يتم تجاوز الناشرين المباشرين
- هذا يتطلب اشتراكاً مدفوعاً
- قد لا يكون متاحاً حالياً

**التأثير:** النظام قد لا ينشر لأنه يحاول استخدام Metricool غير المتاح.

---

### 1.6 مشكلة `is_active` في جداول المنتجات

**الموقع:** `src/app/api/marketing/generate/route.ts` سطر 165

**الوصف:**
```typescript
.eq("is_active", true)
```

**المشكلة:**
- العمود `is_active` قد لا يكون موجوداً في جدول `products`
- هذا قد يسبب فشل التوليد

**التأثير:** التوليد سيفشل بسبب خطأ في قاعدة البيانات.

---

### 1.7 مشكلة تزامن Cron مع التوليد

**الموقع:** `src/app/api/marketing/cron/route.ts`

**الوصف:**
- الـ Cron يستدعي `/api/marketing/generate` داخلياً
- ثم يستدعي `publishNextMarketingItem` 5 مرات
- هذا يعني أن التوليد والنشر في نفس الطلب

**المشكلة:**
- إذا فشل التوليد، لا يتم النشر
- لا يوجد فصل واضح بين المهام

**التأثير:** مشكلة واحدة قد تعطل كل دورة العمل.

---

## 2. الإصلاحات المطلوبة

### 2.1 إصلاح دورة الحالات

**الملفات:**
- `src/lib/marketing-auth.ts`
- `src/lib/marketing-publisher.ts`

**التغييرات:**
1. إضافة حالة `scheduled` إلى الحالات المؤهلة للنشر
2. تعديل التوليد ليحفظ المحتوى بـ `scheduled` بدلاً من `queued`/`approved`
3. إضافة منطق للتحقق من صحة المحتوى قبل التحويل إلى `scheduled`

**التغيير المقترح في `marketing-auth.ts`:**
```typescript
export function getGeneratedMarketingItemStatus(
  autoPublish = process.env.MARKETING_AUTO_PUBLISH,
): "scheduled" | "queued" {
  return autoPublish === "true" ? "scheduled" : "queued";
}

export function isMarketingItemPublishAuthorized(
  status: unknown,
  autoPublish = process.env.MARKETING_AUTO_PUBLISH,
): boolean {
  return autoPublish === "true" && (status === "approved" || status === "scheduled");
}
```

**التغيير المقترح في `marketing-publisher.ts`:**
```typescript
const eligibleStatuses = ["approved", "scheduled"];
```

---

### 2.2 إصلاح ترتيب Cron Jobs

**الملف:** `vercel.json`

**التغييرات:**
```json
{
  "crons": [
    { "path": "/api/cron/meta-token-health", "schedule": "0 5 * * *" },    // 5 AM UTC - فحص التوكنات
    { "path": "/api/marketing/generate", "schedule": "0 6 * * *" },         // 6 AM UTC - توليد المحتوى
    { "path": "/api/publish-all?auto=true", "schedule": "0 7 * * *" },      // 7 AM UTC - نشر المنتجات
    { "path": "/api/marketing/cron", "schedule": "0 8 * * *" }               // 8 AM UTC - نشر التسويق
  ]
}
```

**التبرير:**
- فحص التوكنات أولاً للتأكد من الصلاحية
- توليد المحتوى قبل النشر
- نشر المنتجات (الموجودة مسبقاً)
- نشر المحتوى التسويقي الجديد

---

### 2.3 إصلاح شروط النشر

**الملف:** `src/lib/marketing-publisher.ts`

**التغييرات:**
إزالة التحقق من `MARKETING_AUTO_PUBLISH` في البداية والاعتماد على الحالة فقط:

```typescript
// السطر 663: إزالة هذا التحقق المبكر
// if (!isMarketingItemPublishAuthorized("approved")) {
//   return { processed: false, error: "Automatic social publishing is disabled." };
// }

// التحقق يتم فقط عند محاولة النشر الفعلية (سطر 741)
if (!isMarketingItemPublishAuthorized(typedContent.status)) {
  return { processed: false, error: "Marketing content has not been explicitly approved." };
}
```

---

### 2.4 إصلاح استخدام `is_active`

**الملف:** `src/app/api/marketing/generate/route.ts`

**التغييرات:**
إزالة شرط `is_active` أو التأكد من وجود العمود:

```typescript
// سطر 165: إزالة أو تعديل
// .eq("is_active", true)
```

أو إضافة Migration للتأكد من وجود العمود.

---

### 2.5 إصلاح التكامل مع Metricool

**الملف:** `src/lib/marketing-publisher.ts`

**التغييرات:**
التأكد من أن Metricool لا يعطل الناشرين المباشرين:

```typescript
// سطر 617: تعديل الشرط
if (isMetricoolEnabled() && process.env.MARKETING_PREFER_METRICOOL === "true") {
  return publishToMetricool(content);
}
```

**المتغير الجديد المطلوب:**
- `MARKETING_PREFER_METRICOOL` (اختياري، افتراضي false)

---

### 2.6 إضافة Migration لعمود `is_active`

**ملف جديد:** `supabase/migrations/202611120001_add_is_active_to_products.sql`

```sql
alter table public.products
add column if not exists is_active boolean default true;

update public.products
set is_active = true
where is_active is null;
```

---

### 2.7 إضافة مراقبة أفضل

**ملف جديد:** `src/app/api/marketing/status/route.ts`

لعرض حالة النظام:
- آخر توليد
- آخر نشر
- عدد المحتوى في كل حالة
- حالة كل قناة

---

## 3. الإعدادات المطلوبة في Vercel

### 3.1 المتغيرات الموجودة

✅ `NEXT_PUBLIC_SUPABASE_URL`
✅ `SUPABASE_SERVICE_ROLE_KEY`
✅ `CRON_SECRET`
✅ `MARKETING_SITE_URL`
✅ `FACEBOOK_PAGE_ID`
✅ `FACEBOOK_PAGE_ACCESS_TOKEN`
✅ `INSTAGRAM_BUSINESS_ACCOUNT_ID`
✅ `INSTAGRAM_ACCESS_TOKEN`
✅ `TELEGRAM_BOT_TOKEN`

### 3.2 المتغيرات المطلوبة الجديدة

⚠️ `MARKETING_AUTO_PUBLISH` - يجب أن يكون `true`
⚠️ `GEMINI_API_KEY` - للذكاء الاصطناعي
⚠️ `GEMINI_FREE_TIER_ONLY` - يجب أن يكون `true`
⚠️ `GEMINI_MODEL` - اختياري (افتراضي `gemini-3.8-flash`)

### 3.3 المتغيرات الاختيارية

🔹 `MARKETING_PREFER_METRICOOL` - افتراضي `false`
🔹 `METRICOOL_API_TOKEN` - فقط إذا تم استخدام Metricool
🔹 `METRICOOL_USER_ID` - فقط إذا تم استخدام Metricool
🔹 `METRICOOL_BLOG_ID` - فقط إذا تم استخدام Metricool

---

## 4. الإصلاحات الموصى بها لقواعد البيانات

### 4.1 التأكد من الجداول الموجودة

✅ `products`
✅ `marketing_campaigns`
✅ `marketing_content`
✅ `meta_token_health_alerts`
✅ `marketing_generation_daily_runs`
✅ `product_publish_daily_runs`
✅ `meta_token_vault`
✅ `meta_token_refresh_locks`
✅ `meta_token_refresh_attempts`

### 4.2 الترحيلات المطلوبة

1. إضافة عمود `is_active` إلى `products`
2. إضافة قيود لمنع التكرار
3. تحديث RLS

---

## 5. خطوات التنفيذ الموصى بها

1. ✅ **إصلاح دورة الحالات** - أولوية عالية
2. ✅ **إصلاح ترتيب Cron** - أولوية عالية
3. ✅ **إضافة Migration لـ is_active** - أولوية متوسطة
4. ✅ **إصلاح شروط النشر** - أولوية عالية
5. ✅ **إضافة مراقبة** - أولوية متوسطة
6. ✅ **اختبار كامل** - أولوية عالية
7. ✅ **نشر** - أولوية عالية

---

## 6. الملفات التي سيتم تعديلها

1. `src/lib/marketing-auth.ts` - تعديل دورة الحالات
2. `src/lib/marketing-publisher.ts` - تعديل شروط النشر
3. `src/app/api/marketing/generate/route.ts` - إزالة is_active
4. `vercel.json` - إصلاح ترتيب Cron
5. `supabase/migrations/202611120001_add_is_active_to_products.sql` - جديد
6. `src/app/api/marketing/status/route.ts` - جديد

---

## 7. التأثير المتوقع

بعد هذه الإصلاحات:
- ✅ التوليد يعمل تلقائياً في 6 AM UTC
- ✅ المحتوى ينتقل إلى `scheduled` تلقائياً
- ✅ النشر يعمل في 7-8 AM UTC
- ✅ لا حاجة لموافقة إدارية يومية
- ✅ فشل قناة لا يعطل البقية
- ✅ المراقبة واضحة وسهلة

---

**التقرير مكتمل - جاهز للتنفيذ**
