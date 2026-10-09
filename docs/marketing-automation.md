# Marketing automation

The marketing flow creates a 12-post Arabic/English campaign for an existing product, stores each post in Supabase, and schedules one post per day. Vercel calls `/api/marketing/cron` once per day at 06:00 UTC. The route avoids creating another campaign while future posts remain in the queue.

## Setup

1. Apply the marketing migrations in timestamp order:
   - `202610080002_marketing_engine.sql`
   - `202610080003_marketing_publisher.sql`
2. Set `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, and a Google AI Studio `GEMINI_API_KEY` using Gemini's Standard Free Tier. Keep the service-role and provider keys server-only. The key itself does not prove which billing tier is enabled; after confirming the Google AI Studio project is free-tier, set `GEMINI_FREE_TIER_ONLY=true` to enable generation. Otherwise both book-draft and campaign generation remain disabled.
3. Set the verified destination for this factory in `MARKETING_SITE_URL`. Campaign generation stops before writing anything if it is missing or invalid; the factory does not infer a URL from another project.
4. Keep `MARKETING_AUTO_PUBLISH` unset or set to `false` to generate and queue ads without publishing them publicly. Public publishing requires social-platform credentials and an explicit decision to set it to `true`.
5. Do not configure Metricool on a free account. Metricool API access requires an Advanced or Custom plan. Even if credentials are present, the integration is disabled unless `MARKETING_ALLOW_PAID_METRICOOL_API=true`; do not enable it while preserving the free plan.
6. Deploy the project. Vercel supplies the `CRON_SECRET` bearer header for cron invocations.

Instagram direct publishing also requires an Instagram professional account and a public product cover URL from the project's Supabase public storage bucket.

## Behavior

- The generator uses Gemini and chooses products with the least recent marketing campaign.
- It creates six Arabic and six English posts, using only configured platforms when publisher credentials are present.
- It stores the existing product cover URL as the campaign image. It does not synthesize a separate graphic.
- Social publishing is disabled by default. When explicitly enabled, images are accepted only from this project's HTTPS Supabase public storage.
- The publisher atomically changes a queue row to `scheduled` before calling the provider. Failed attempts are recorded; abandoned claims older than 30 minutes are returned to the queue.
- Campaign content is educational marketing copy. The prompt prohibits invented clinical cases, medical statistics, diagnoses, and guaranteed outcomes.
- `/api/marketing/generate` and `/api/marketing/publish` accept POST only and require `Authorization: Bearer <CRON_SECRET>`, checked with a constant-time comparison. The cron route uses only configured deployment URLs and does not trust the incoming Host header.
- `MARKETING_AUTO_PUBLISH=true` is required before any public publishing can happen. `MARKETING_ALLOW_PAID_METRICOOL_API=true` is a separate paid-plan gate and should stay disabled on free plans.
- Use `POST /api/marketing/generate?force=true` only when intentionally adding a new campaign while another campaign is scheduled.

## Vercel schedule

`vercel.json` runs once per day at 06:00 UTC. This cadence works on Vercel Hobby plans, which permit at most one cron invocation per day. On Hobby, Vercel may run the invocation at any time during the configured hour.

## Book production

The admin factory can produce a book from an AI-generated first draft or a supplied manuscript. Draft generation requires an authenticated admin session, is rate-limited, and is available only when `GEMINI_FREE_TIER_ONLY=true` and a server-side `GEMINI_API_KEY` is configured. Review and edit clinical material before producing the PDF. The factory renders the cover and PDF, stores them in Supabase (`covers` public, `pdfs` private), and inserts the product only after both uploads succeed; failed runs remove partial uploads. The admin session cookie uses `Path=/` so it reaches both the factory Server Action and its API routes. Vercel execution is configured up to 60 seconds, within Hobby's documented limit.

## Admin views

- `/admin/factory` creates books and AI-assisted drafts.
- `/admin/marketing` displays the authenticated marketing queue. The daily cron can generate and queue copy, but public social publishing stays disabled unless `MARKETING_AUTO_PUBLISH=true` and platform credentials are configured.
