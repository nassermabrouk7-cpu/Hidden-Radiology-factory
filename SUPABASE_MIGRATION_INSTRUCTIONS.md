# تعليمات تطبيق Migration في Supabase

## الخطوة 1: تطبيق Migration

افتح Supabase Dashboard للمشروع:
- URL: https://okijdtchqrihwsyqhyss.supabase.co
- تأكد أن اسم المشروع هو "Hidden Radiology Factory" أو مشابه

اذهب إلى: **SQL Editor**

انسخ والصق الكود التالي:

```sql
-- إنشاء جدول marketing_generation_daily_runs
create table if not exists public.marketing_generation_daily_runs (
  run_date date primary key,
  status text not null check (status in ('running', 'completed', 'failed')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  result jsonb not null default '{}'::jsonb
);

-- تفعيل RLS
alter table public.marketing_generation_daily_runs enable row level security;
revoke all on table public.marketing_generation_daily_runs from public, anon, authenticated;
grant select, update on table public.marketing_generation_daily_runs to service_role;

-- إنشاء دالة claim_marketing_generation_daily_run
create or replace function public.claim_marketing_generation_daily_run(p_run_date date)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed boolean;
begin
  if p_run_date <> (now() at time zone 'utc')::date then
    return false;
  end if;

  insert into public.marketing_generation_daily_runs as existing_run (run_date, status)
  values (p_run_date, 'running')
  on conflict (run_date) do update
  set status = 'running',
      started_at = now(),
      completed_at = null,
      result = '{}'::jsonb
  where existing_run.status = 'failed'
     or (
       existing_run.status = 'running'
       and existing_run.started_at < now() - interval '30 minutes'
     )
  returning true into claimed;
  return coalesce(claimed, false);
end;
$$;

-- منح الصلاحيات للدالة
revoke all on function public.claim_marketing_generation_daily_run(date) from public, anon, authenticated;
grant execute on function public.claim_marketing_generation_daily_run(date) to service_role;

-- تحديث constraint لمنصات المحتوى
alter table public.marketing_content
  drop constraint if exists marketing_content_platform_check;

alter table public.marketing_content
  add constraint marketing_content_platform_check
  check (platform in ('telegram', 'instagram', 'facebook', 'linkedin', 'threads'));
```

اضغط **Run**

---

## الخطوة 2: اختبار التوليد

احصل على CRON_SECRET من:
1. Vercel Dashboard
2. hidden-radiology-factory project
3. Settings → Environment Variables
4. ابحث عن CRON_SECRET في Production

استخدم الأمر التالي (استبدل YOUR_CRON_SECRET بالقيمة الفعلية):

```bash
curl -X POST https://hidden-radiology-project-chi.vercel.app/api/marketing/generate \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

النتيجة المتوقعة:
```json
{
  "success": true,
  "status": "scheduled",
  "campaignId": "...",
  "contentCount": 3,
  "platforms": ["telegram", "facebook", "instagram"],
  "message": "One post per configured platform was generated and scheduled for automatic publishing."
}
```

---

## الخطوة 3: اختبار النشر

```bash
curl -X POST https://hidden-radiology-project-chi.vercel.app/api/marketing/cron \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

النتيجة المتوقعة:
```json
{
  "success": true,
  "generation": {
    "status": 200,
    "result": { ... }
  },
  "publishing": {
    "processed": true,
    "attempted": 3,
    "results": [ ... ]
  }
}
```

---

## الخطوة 4: التحقق من المنشورات

افتح القنوات وتحقق من ظهور المنشورات:

### Telegram
- القناة: Radiology و Radiology Hidden
- Chat ID: -5416713273
- Bot: @Radiologyhidden_factory_bot

### Facebook
- Page: Hidden Radiology
- Page ID: 1629465452308367

### Instagram
- Account: @radiologyhidden

---

## الخطوة 5: مراقبة Cron Jobs

الجدولة الحالية (توقيت UTC):
- 5 AM UTC: فحص Meta Tokens
- 6 AM UTC: توليد المحتوى
- 7 AM UTC: نشر المنتجات
- 8 AM UTC: نشر المحتوى التسويقي

مراقبة في Vercel:
1. Vercel Dashboard
2. hidden-radiology-factory project
3. Settings → Cron Jobs
4. راقب سجلات التنفيذ

---

## استكشاف الأخطاء

### إذا فشل التوليد:
- تحقق من GEMINI_API_KEY في Vercel
- تحقق من GEMINI_FREE_TIER_ONLY=true
- راقب Logs في Vercel

### إذا فشل النشر:
- تحقق من توكنات Meta في Vercel
- تحقق من TELEGRAM_BOT_TOKEN
- راقب Logs في Vercel
- تحقق من حالة Meta Tokens في `/api/cron/meta-token-health`

### إذا لم يظهر المحتوى:
- تحقق من جدول `marketing_content` في Supabase
- تحقق من الحالة `scheduled` أو `published`
- تحقق من `external_post_id`
