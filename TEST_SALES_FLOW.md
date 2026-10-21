# Automatic Publishing and Sales Audit

**Audit date:** 2026-10-19 (Africa/Cairo)  
**Requested production URL:** `https://hidden-radiology-project-chi.vercel.app`  
**Vercel project checked:** `hidden-radiology-factory`

## Executive result

- **Automatic all-channel publishing: FAIL.** The configured daily cron calls `/api/publish-all`, but in that route Telegram is the only channel with a real publishing implementation. Facebook, Instagram, Threads, and LinkedIn return placeholder success responses without sending posts. The legacy Gumroad and Supabase configuration entries do not represent social publishing destinations.
- **Cron configuration: PRESENT, execution not confirmed.** `vercel.json` schedules `/api/publish-all?auto=true` at `0 7 * * *`. Vercel Production has both `CRON_SECRET` and `TELEGRAM_BOT_TOKEN` configured (values intentionally not shown). The active production deployment is Ready according to `vercel ls --prod`, but the requested `hidden-radiology-project-chi.vercel.app` host was not accessible through the available live-page checker. A cron invocation or successful post on that exact host was therefore not independently verified during this audit.
- **Sales flow: order capture works in code; automatic payment does not exist.** Checkout creates a pending order, tells the buyer how to pay manually, and offers WhatsApp to send a confirmation request. An administrator must verify payment and confirm the order. That confirmation creates 24-hour signed PDF links and attempts email delivery. There is no implemented payment-provider callback/webhook that verifies and fulfills a transaction automatically.
- **End-to-end paid purchase: NOT VERIFIED.** No test order, payment, admin confirmation, or buyer email was generated as part of this read-only audit. Production table contents and PDF bucket settings were not queried directly.

## 1. Publishing channels

`src/channels.config.json` content:

```json
{
  "telegram": {
    "chat_id": "-5416713273",
    "bot_token_env": "TELEGRAM_BOT_TOKEN",
    "channel_name": "Radiology و Radiology Hidden",
    "enabled": true
  },
  "facebook": {
    "enabled": true,
    "via": "metricool"
  },
  "instagram": {
    "enabled": true,
    "via": "metricool",
    "username": "radiologyhidden"
  },
  "linkedin": {
    "enabled": true,
    "via": "metricool"
  },
  "threads": {
    "enabled": true,
    "username": "radiologyhidden"
  },
  "gumroad": {
    "enabled": true,
    "connected": true
  },
  "supabase": {
    "enabled": true,
    "connected": true
  }
}
```

There are no website, Twitter/X, or email publishing entries in this file. Gumroad and Supabase are enabled integrations here, but `/api/publish-all` does not publish to Gumroad. Supabase is only used for campaign logging.

### `/api/publish-all` behavior

`src/app/api/publish-all/route.ts` selects a random product in automatic mode, skipping products logged in the previous seven days. It builds a purchase link to `/library?book=<id>`, then processes enabled entries:

| Channel | Route behavior | Audit result |
| --- | --- | --- |
| Telegram | Calls Telegram `sendPhoto` with the configured `chat_id`, image, caption, and Buy button. Token is read from `process.env.TELEGRAM_BOT_TOKEN`. | Real implementation; Production env contains the token name. The user reports Message ID 18 was verified separately. |
| Facebook | `publishToFacebook()` returns `success: true` with “Via Metricool - ready for integration”; TODO explicitly says integration remains to be done. | **No post is sent; false success is reported.** |
| Instagram | Placeholder returns `success: true`; Graph API / Metricool work is TODO. | **No post is sent; false success is reported.** |
| Threads | Placeholder returns `success: true`; API is pending. | **No post is sent; false success is reported.** |
| LinkedIn | Placeholder returns `success: true`; API / Metricool work is TODO. | **No post is sent; false success is reported.** |
| Supabase | Attempts to insert a `marketing_campaigns` row and appends the logging result. | Logging only; not a publishing channel. |

Consequently, the route's `successCount` can report success for unimplemented channels. Its GET method checks `Authorization: Bearer <CRON_SECRET>`. Its POST method has no corresponding authorization check, which should be fixed before exposing it to untrusted callers.

There is a separate marketing queue implementation (`/api/marketing/cron` and `src/lib/marketing-publisher.ts`) with real adapters, but the configured Vercel cron does **not** call it. The newer adapters also depend on explicit enablement/configuration and approved queue content; they do not make the placeholder methods in `/api/publish-all` real.

## 2. Cron and Vercel environment

`vercel.json` content:

```json
{
  "crons": [
    {
      "path": "/api/publish-all?auto=true",
      "schedule": "0 7 * * *"
    }
  ]
}
```

This is daily at **07:00 UTC**. Cairo is UTC+3 on the audit date (10:00 Cairo); after the seasonal offset changes it is 09:00 Cairo. The user-provided 09:00 Cairo conversion is not correct for the audit date.

The Vercel CLI showed these names in the **Production** environment: `TELEGRAM_BOT_TOKEN`, `CRON_SECRET`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `GUMROAD_ACCESS_TOKEN`, Meta app credentials, admin credentials, and `MARKETING_AUTO_PUBLISH`. Secret values were not copied into this report. Vercel Preview only showed Supabase URL and anon key; no Preview cron secret or Telegram token was listed.

`vercel ls --prod` showed a Ready Production deployment from about three hours before the audit. That confirms a deployment exists, not that its cron ran successfully, nor that every channel published.

## 3. Sales and payment

### Checkout and payment method

- Checkout page: `src/app/checkout/page.tsx`.
- Order endpoint: `POST /api/orders/create`.
- It accepts `instapay`, `vodafone`, `etisalat`, or `paypal`; reads product prices from Supabase rather than trusting browser-supplied prices; creates an `orders` row with `pending_verification` status.
- The page displays hard-coded transfer numbers and a PayPal.me link, then asks the buyer to send proof / contact the operator through WhatsApp.
- There is **no Stripe, PayPal API, Paymob, or other gateway-based payment verification** in the checkout order flow. The Stripe code in `/api/auto-post` can create a checkout session only if `STRIPE_SECRET_KEY` exists; this is a separate legacy campaign endpoint, not connected to `/api/orders/create`, order confirmation, or download delivery. Production Vercel did not list Stripe, PayPal API, or Paymob credential variables.
- `/api/orders/confirm` requires a valid admin session and changes a pending order to confirmed. It then attempts to email download links using Resend when `RESEND_API_KEY` and `RESEND_FROM_EMAIL` exist.

### PDF protection and delivery

- The repository has a migration `supabase/migrations/202610060001_secure_pdf_bucket.sql` that sets the `pdfs` Storage bucket private and fails if it is missing or remains public.
- Confirmation and status endpoints create signed PDF URLs valid for 24 hours. This is the intended protected-delivery path **if** the migration has been applied and the actual PDF bucket is private.
- The repo migrations do not define or show RLS policies for `products` / `books`, `orders` / `purchases`, or the legacy `campaigns` table. Marketing tables do have RLS enabled with client access denied. Production RLS state and the live bucket visibility are **not confirmed** by this local migration review.
- Buyer order status is looked up by a reference ID with rate limiting. Download links are returned only when the order status is confirmed.

### Payment environment variable names

Code references these payment-related names: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYMOB_API_KEY`, and `PAYMOB_INTEGRATION_ID`. None appeared in the Vercel Production variable list. The live manual PayPal.me and local transfer instructions are literals in the checkout UI rather than configured gateway credentials.

## 4. API route inventory

The source currently contains **18** `src/app/api/**/route.ts` routes, not 24:

1. `/api/admin/factory/generate`
2. `/api/admin/session`
3. `/api/auto-post`
4. `/api/cron`
5. `/api/health`
6. `/api/history`
7. `/api/marketing/cron`
8. `/api/marketing/generate`
9. `/api/marketing/publish`
10. `/api/marketing/queue`
11. `/api/orders/confirm`
12. `/api/orders/create`
13. `/api/orders/list`
14. `/api/orders/status`
15. `/api/products`
16. `/api/publish`
17. `/api/publish-all`
18. `/api/test-publish`

## 5. Flow test matrix

| Step | Result from code/config review |
| --- | --- |
| Buy Now opens checkout | Present in UI, but no live browser checkout was performed. |
| Checkout validates cart and creates order | Implemented through `/api/orders/create`; database write was not executed in this audit. |
| Buyer pays online | **Not implemented as an automatic gateway flow.** Manual transfer / PayPal.me instructions only. |
| Payment is confirmed automatically | **No.** Admin session is required for `/api/orders/confirm`. |
| Confirmed buyer gets download | Signed links and status polling are implemented; actual bucket privacy and email delivery were not live-tested. |
| Automatic social publishing at cron time | Cron is configured and required secrets exist in Vercel Production, but only Telegram is implemented in `/api/publish-all`; other listed networks will not receive posts. |

## Conclusions and priority fixes

1. Do not treat tomorrow's cron as all-channel publishing: the route currently only really publishes to Telegram. Replace the placeholder methods with the real marketing publisher or remove false-success results and point cron to the approved queue workflow.
2. Add the same cron/admin authorization protection to `POST /api/publish-all` as the GET path.
3. Decide whether manual payment with admin confirmation is the intended business process. If automatic payment is required, implement provider checkout + signed webhook verification + idempotent order fulfillment; current checkout is not that flow.
4. Verify/apply the private `pdfs` bucket migration and audit RLS policies in the live Supabase project before declaring PDF access protected.
5. Run a controlled end-to-end purchase with a test product/payment after the live provider and database settings are confirmed. This audit did not create orders or trigger payments.
