# إعداد وتشغيل المشروع

## أسرار البيئة

أضف المتغيرات التالية إلى بيئة التطوير وبيئتي Preview وProduction في Vercel:

- `NEXT_PUBLIC_SUPABASE_URL` و`NEXT_PUBLIC_SUPABASE_ANON_KEY` لاتصال المتصفح المحدود بـSupabase.
- `SUPABASE_SERVICE_ROLE_KEY` لخادم Next.js فقط. لا تضف بادئة `NEXT_PUBLIC_`.
- `ADMIN_PASSWORD`: كلمة مرور عشوائية لا تقل عن 32 حرفاً.
- `ADMIN_SESSION_SECRET`: سر عشوائي مستقل لا يقل عن 32 حرفاً لتوقيع جلسات الإدارة.
- `CRON_SECRET`: سر عشوائي مستقل لا يقل عن 32 حرفاً لحماية `/api/publish`.
- `MARKETING_SITE_URL`: رابط HTTPS المعتمد لوجهة منتجات المصنع. مطلوب لتوليد روابط الحملات؛ لا يختار التطبيق رابط مشروع آخر تلقائياً.
- `RESEND_API_KEY` و`RESEND_FROM_EMAIL` (اختياريان) لإرسال روابط التنزيل بالبريد بعد تأكيد الدفع. يجب أن يكون عنوان المرسل موثقاً لدى مزود البريد. يمكن للعميل دائماً تنزيل الملفات من رابط حالة الطلب الآمن.

لا تُرفع ملفات `.env.local` أو `.env.vercel.local` إلى GitHub. خزّن الأسرار في إعدادات Vercel، واحتفظ بنسخة التطوير محلياً.

## قاعدة البيانات والملفات

قبل تفعيل تسليم الكتب، شغّل `supabase/migrations/202610060001_secure_pdf_bucket.sql` من Supabase SQL Editor. يجعل هذا التغيير حاوية `pdfs` خاصة؛ ويرسل الخادم روابط تنزيل مؤقتة بعد تأكيد الدفع.

تأكد أن كل `products.pdf_url` يشير إلى ملف موجود في حاوية `pdfs`، وأن جدول `orders` يدعم الحقول المستخدمة في إنشاء الطلبات: `reference_id`, `customer_name`, `customer_email`, `customer_phone`, `items`, `total_amount`, `payment_method`, `language`, `status`, و`confirmed_at`.

تأكيد الطلب في لوحة الإدارة مخصص للتحويلات اليدوية: على المسؤول مراجعة إثبات الدفع قبل الضغط على التأكيد. شراء Gumroad الآلي متوقف حالياً حتى يربط كل منتج بصفحة Gumroad ويتم التحقق من البيع من Gumroad API. صفحة حالة الطلب تحمل معرّفاً عشوائياً خاصاً بالعميل وتعرض روابط تنزيل مؤقتة بعد التأكيد.

## GitHub وVercel

المشروع مربوط محلياً بمشروع Vercel `hidden-radiology-factory` وبالمستودع `nassermabrouk7-cpu/Hidden-Radiology-factory`. يتطلب رفع التغييرات اعتماد GitHub، ويتطلب النشر قراءة إعدادات Vercel وأسرار البيئة عن طريق CLI. يُنشر فرع الإنتاج مباشرةً بعد دفع تغييرات معتمدة، أو يمكن إنشاء Preview ثم ترقيته من Vercel.
