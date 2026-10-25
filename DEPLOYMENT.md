# إعداد وتشغيل المشروع

## أسرار البيئة

أضف المتغيرات التالية إلى بيئة التطوير وبيئتي Preview وProduction في Vercel:

- `NEXT_PUBLIC_SUPABASE_URL` و`NEXT_PUBLIC_SUPABASE_ANON_KEY` لاتصال المتصفح المحدود بـSupabase.
- `SUPABASE_SERVICE_ROLE_KEY` لخادم Next.js فقط. لا تضف بادئة `NEXT_PUBLIC_`.
- `ADMIN_PASSWORD`: كلمة مرور عشوائية لا تقل عن 32 حرفاً.
- `ADMIN_SESSION_SECRET`: سر عشوائي مستقل لا يقل عن 32 حرفاً لتوقيع جلسات الإدارة.
- `CRON_SECRET`: سر عشوائي مستقل لا يقل عن 32 حرفاً لحماية مهام cron.
- `MARKETING_SITE_URL`: رابط HTTPS المعتمد لوجهة منتجات المصنع. مطلوب لتوليد روابط الحملات؛ لا يختار التطبيق رابط مشروع آخر تلقائياً.
- `RESEND_API_KEY` و`RESEND_FROM_EMAIL` (اختياريان) لإرسال روابط التنزيل بالبريد بعد تأكيد الدفع. يجب أن يكون عنوان المرسل موثقاً لدى مزود البريد. يمكن للعميل دائماً تنزيل الملفات من رابط حالة الطلب الآمن.

لا تُرفع ملفات `.env.local` أو `.env.vercel.local` إلى GitHub. خزّن الأسرار في إعدادات Vercel، واحتفظ بنسخة التطوير محلياً.

## النشر التسويقي التلقائي

يشغّل `vercel.json` مسار المنتجات `/api/publish-all?auto=true` يوميًا عند 07:00 UTC. يحمي `CRON_SECRET` هذا المسار بمصادقة Bearer، ويمنع سجل ذري في Supabase تكرار تشغيل اليوم. يجب تهيئة `NEXT_PUBLIC_SUPABASE_URL` و`SUPABASE_SERVICE_ROLE_KEY`، وقنوات المتجر التي تريد تفعيلها، وإعدادات المنتج والصورة. لا يؤدي غياب إعداد Meta أو عدم صلاحية رمزه إلى نشر مزعوم؛ تُسجّل القناة كمتوقفة، وتستمر القنوات الأخرى الجاهزة مثل Telegram. إعادة المحاولة في يوم لاحق تستبعد القنوات الناجحة.

لا تُضف جدولة لمسار `/api/marketing/cron` بالتوازي مع ناشر المنتجات. هذا المسار يخص طابور التسويق فقط، ويظل غير مجدول؛ يتطلب `MARKETING_AUTO_PUBLISH=true` بشكل منفصل، ومصادقة Bearer عبر `CRON_SECRET`، واعتماد العناصر من لوحة الإدارة. يمكن معالجة الطابور يدويًا عبر `POST /api/marketing/publish`. لا يفعّل `MARKETING_AUTO_PUBLISH` نشر منتجات المتجر. تتطلب ترحيلات `supabase/migrations` استخدام الطابور أو قفل النشر اليومي. تكامل Metricool مدفوع ويتطلب تفعيل `MARKETING_ALLOW_PAID_METRICOOL_API=true` صراحةً مع إعداد بياناته.

## ربط Meta وصحة الرموز

تتطلب مراجعة Facebook وInstagram إعداد `META_APP_ID` و`META_APP_SECRET` والرمز/الرموز الحالية، وإعدادات Page وInstagram المهنية. يعرض `/api/cron/meta-token-health` الحالة الآمنة لكل رمز ويرسل تنبيهًا عند الحاجة؛ يتطلب البريد `RESEND_API_KEY` و`RESEND_FROM_EMAIL` و`META_TOKEN_ALERT_EMAIL` وقاعدة التنبيهات. الأعطال المؤقتة الواضحة للفحص تسمح بمحاولة النشر فقط عند وجود إعدادات التطبيق والرمز؛ أما الرموز المرفوضة أو المنتهية أو المعلومات غير المفهومة فتُحظر.

يبدأ الربط الإداري عبر `GET /api/meta/oauth/start` بعد تسجيل الدخول إلى الإدارة. عيّن `META_OAUTH_REDIRECT_URI` إلى عنوان callback نفسه (`/api/meta/oauth/callback`) وسجّله في إعدادات Facebook Login، ووفّر مفتاحًا عشوائيًا base64 يمثل 32 بايت في `META_TOKEN_ENCRYPTION_KEY`. بعد تطبيق ترحيل مخزن Meta المشفّر وإتمام ربط Meta والتحقق منه يدويًا، يمكن تفعيل `META_TOKEN_VAULT_ENABLED=true`. يبقى معطلًا افتراضيًا؛ لا تعتبره مُفعّلًا أو مجددًا آليًا قبل إتمام تدفق OAuth الحقيقي والتحقق من الرموز والحسابات. إذا لم تقبل Meta تجديد رمز ما زال صالحًا، يوقف النظام المحاولة المتكررة ويطلب إعادة تفويض المسؤول.

يقبل ناشر Instagram اسم `INSTAGRAM_BUSINESS_ACCOUNT_ID`، كما يقبل `INSTAGRAM_USER_ID` القديم فقط إذا كان مطابقًا له؛ احذف الاسم القديم أو اجعله مطابقًا لتجنب تعارض معرّف الحساب.

تأكد من إعداد الأسرار في بيئة Production، وأن النشر التلقائي لـGit متصل بمستودع GitHub في إعدادات مشروع Vercel. لا يمكن تأكيد حالة هذه الإعدادات الخارجية من فحص المستودع وحده.

## قاعدة البيانات والملفات

قبل تفعيل تسليم الكتب، شغّل `supabase/migrations/202610060001_secure_pdf_bucket.sql` من Supabase SQL Editor. يجعل هذا التغيير حاوية `pdfs` خاصة؛ ويرسل الخادم روابط تنزيل مؤقتة بعد تأكيد الدفع.

قبل تطبيق أي ترحيل، شغّل `node scripts/check-migration-ids.cjs` للتأكد من تفرد الأرقام. لا تعِد ترقيم ترحيل موجود قبل مقارنة `supabase migration list` مع سجل `supabase_migrations.schema_migrations` للمشروع البعيد؛ يلزم توفر مصادقة Supabase واتصال المشروع لهذا الفحص.

تأكد أن كل `products.pdf_url` يشير إلى ملف موجود في حاوية `pdfs`، وأن جدول `orders` يدعم الحقول المستخدمة في إنشاء الطلبات: `reference_id`, `customer_name`, `customer_email`, `customer_phone`, `items`, `total_amount`, `payment_method`, `language`, `status`, و`confirmed_at`.

تأكيد الطلب في لوحة الإدارة مخصص للتحويلات اليدوية: على المسؤول مراجعة إثبات الدفع قبل الضغط على التأكيد. شراء Gumroad الآلي متوقف حالياً حتى يربط كل منتج بصفحة Gumroad ويتم التحقق من البيع من Gumroad API. صفحة حالة الطلب تحمل معرّفاً عشوائياً خاصاً بالعميل وتعرض روابط تنزيل مؤقتة بعد التأكيد.

## GitHub وVercel

المشروع مربوط محلياً بمشروع Vercel `hidden-radiology-factory` وبالمستودع `nassermabrouk7-cpu/Hidden-Radiology-factory`. يتطلب رفع التغييرات اعتماد GitHub، ويتطلب النشر قراءة إعدادات Vercel وأسرار البيئة عن طريق CLI. يُنشر فرع الإنتاج مباشرةً بعد دفع تغييرات معتمدة، أو يمكن إنشاء Preview ثم ترقيته من Vercel.
