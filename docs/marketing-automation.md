# Marketing automation

The marketing flow creates a 12-post Arabic/English campaign for an existing product, stores each post in Supabase, and schedules one post per day. `/api/marketing/cron` is implemented but is not scheduled in the current `vercel.json`; that file schedules the Meta health check and product publishing. The route avoids creating another campaign while future posts remain in the queue.

## Setup

1. Apply the marketing migrations in timestamp order:
   - `202610080002_marketing_engine.sql`
   - `202610080003_marketing_publisher.sql`
   - `202610220001_meta_token_health_alerts.sql`
   - `202610220002_single_channel_publish_lock.sql`
   - `202610250001_reliable_publishing_and_meta_vault.sql`
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
- The publisher atomically changes a queue row to `scheduled` before calling the provider. Failed attempts are recorded. Claims older than 30 minutes without a provider response are marked `failed` for manual reconciliation; they are not retried automatically because the provider may already have accepted the post.
- Campaign content is educational marketing copy. The prompt prohibits invented clinical cases, medical statistics, diagnoses, and guaranteed outcomes.
- `/api/marketing/generate` and `/api/marketing/publish` accept POST only and require `Authorization: Bearer <CRON_SECRET>`, checked with a constant-time comparison. The cron route uses only configured deployment URLs and does not trust the incoming Host header.
- `MARKETING_AUTO_PUBLISH=true` is required before any public publishing can happen. `MARKETING_ALLOW_PAID_METRICOOL_API=true` is a separate paid-plan gate and should stay disabled on free plans.
- Use `POST /api/marketing/generate?force=true` only when intentionally adding a new campaign while another campaign is scheduled.

## Vercel schedule

`vercel.json` runs product publishing at 07:00 UTC. This cadence works on Vercel Hobby plans, which permit at most one cron invocation per day. On Hobby, Vercel may run the invocation at any time during the configured hour.

The Meta token health check is scheduled at 05:00 UTC, before product publishing at 07:00 UTC. Product publishing also rechecks token health immediately before use. Apply the migrations above before deploying these routes. Both schedules run once daily. The routes use the `CRON_SECRET` bearer guard and never return token data. Meta publishing is blocked for `invalid`, `expired`, `unknown`, and `not_configured` token states. A clearly transient health-check outage permits an attempt only when the app and channel credentials are configured; `unavailable` is never treated as proof that a token is valid.

## Environment variables

Configure these names in the server environment; never put secret values in source control.

| Variable | Used for |
| --- | --- |
| `META_APP_ID`, `META_APP_SECRET` | Token Debugging health checks for both Meta channels; required with the channel's access token. |
| `FACEBOOK_PAGE_ACCESS_TOKEN`, `INSTAGRAM_ACCESS_TOKEN` | Token health checks and direct channel publishing. |
| `FACEBOOK_PAGE_ID`, `INSTAGRAM_BUSINESS_ACCOUNT_ID` | Product publishing routes (`/api/publish-all`, `/api/publish-one`, `/api/test-publish`). |
| `INSTAGRAM_USER_ID` | Legacy alias for the marketing queue; if set, it must match `INSTAGRAM_BUSINESS_ACCOUNT_ID`. |
| `META_TOKEN_ALERT_EMAIL` | Recipient for token health alerts. |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | Sending token alerts; these are also used by existing email features. |
| `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Server-side access to token alert state and application data. The service role key must remain server-only. |
| `CRON_SECRET` | Bearer authentication for scheduled health and publishing routes; use a random secret of at least 32 characters. |

The health check needs `META_APP_ID`, `META_APP_SECRET`, and the channel token. Direct Facebook publishing additionally needs `FACEBOOK_PAGE_ID`; direct Instagram product publishing needs `INSTAGRAM_BUSINESS_ACCOUNT_ID`, while the marketing queue uses `INSTAGRAM_USER_ID`. Alert delivery also needs the recipient, Resend configuration, and Supabase state-store configuration. Health checks do not refresh credentials. See `FACEBOOK_INSTAGRAM_FIX_REPORT.md` for first-time Meta App Dashboard setup and the OAuth work still required for secure reauthorization.

## Book production

The admin factory can produce a book from an AI-generated first draft or a supplied manuscript. Draft generation requires an authenticated admin session, is rate-limited, and is available only when `GEMINI_FREE_TIER_ONLY=true` and a server-side `GEMINI_API_KEY` is configured. Review and edit clinical material before producing the PDF. The factory renders the cover and PDF, stores them in Supabase (`covers` public, `pdfs` private), and inserts the product only after both uploads succeed; failed runs remove partial uploads. The admin session cookie uses `Path=/` so it reaches both the factory Server Action and its API routes. Vercel execution is configured up to 60 seconds, within Hobby's documented limit.

## Admin views

- `/admin/factory` creates books and AI-assisted drafts.
- `/admin/marketing` displays the authenticated marketing queue. The daily cron can generate and queue copy, but public social publishing stays disabled unless `MARKETING_AUTO_PUBLISH=true` and platform credentials are configured.
