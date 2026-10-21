# Automatic Publishing and Paymob Sales Flow — V2

**Audit date:** 2026-10-19 (Africa/Cairo)  
**Production URL supplied:** `https://hidden-radiology-project-chi.vercel.app`  
**Status:** Code changes prepared locally; production payment is **not yet enabled or end-to-end verified**.

## Summary

- **Publishing:** Telegram is the only enabled social publisher with a real API implementation. Facebook, Instagram, Threads, and LinkedIn are disabled and reported as skipped. The website remains the storefront/Buy link, not a social publishing API. Gumroad is disabled in this route; Supabase remains campaign logging only.
- **Authorization:** Both GET and POST for `/api/publish-all` now require `Authorization: Bearer <CRON_SECRET>`. The Telegram publisher reads `TELEGRAM_BOT_TOKEN` from the environment. The old test script's hardcoded Telegram token and token-prefix logging were removed; an untracked report containing token-shaped strings was sanitized. Because the old token appeared in local tool output, rotate it with BotFather and replace the environment value if it is still active.
- **Payment implementation:** New server-side Paymob Intention checkout and HMAC-SHA512 webhook code have been added. Checkout is the default option; PayPal remains the only manual-payment fallback and still needs admin confirmation.
- **Production blocker:** No Paymob environment variables were present in the Vercel Production or Preview variable lists checked earlier. The new Supabase migration has not been applied. Therefore, production cannot complete the new checkout until credentials are configured, the migration is applied, and the code is deployed.
- **End-to-end test:** Not run. No Paymob test credentials/account setup or verified Resend sender was available. There is no truthful payment/webhook/email/PDF success log or screenshot to report.

## Publishing configuration

| Destination | Enabled | Behavior |
| --- | --- | --- |
| Telegram | Yes | `sendPhoto` API call using `TELEGRAM_BOT_TOKEN` from Vercel environment and chat ID `-5416713273`. |
| Website storefront | Yes | Buy link uses the configured website base URL and `/library?book=<id>`. This is a destination link, not an automated website post. |
| Facebook | No | Skipped; no false success response. |
| Instagram | No | Skipped; no false success response. |
| Threads | No | Skipped; no false success response. |
| LinkedIn | No | Skipped; no false success response. |
| Gumroad | No | Not published by `/api/publish-all`. |
| Supabase | Logging | Campaign result logging only; not a publishing destination. |

The route now returns a `skippedChannels` list and only counts attempted social channels in the publish summary. If Telegram configuration is missing, Telegram returns a failure result instead of silently disappearing. If a disabled social channel is accidentally enabled without a real adapter, the route returns a failure for it rather than claiming it published.

`vercel.json` remains configured for `0 7 * * *` → `/api/publish-all?auto=true` (07:00 UTC daily). This code update has **not** been deployed, and no cron invocation was made during this audit.

## Paymob checkout flow added

1. The checkout page calls `POST /api/checkout` for Paymob. Manual PayPal requests continue through `POST /api/orders/create`.
2. The server reloads product prices from Supabase, creates a pending `orders` row and `purchases` row, then calls Paymob `POST /v1/intention/` with the server-side secret.
3. The customer is redirected to Paymob Unified Checkout. No secret key or HMAC secret is sent to the browser.
4. Paymob POSTs to `/api/webhook/paymob`. The handler checks the exact transaction HMAC-SHA512 field sequence using the HMAC query parameter, verifies the configured integration ID, and compares amount/currency with the stored purchase.
5. A database RPC records the unique transaction, marks the purchase paid, confirms the order, and creates a fulfillment outbox row atomically. Duplicate callbacks are handled idempotently.
6. Fulfillment creates 24-hour signed PDF URLs, emails them using Resend, and marks the outbox sent. The order status page polls and exposes downloads after confirmation.
7. The Paymob browser redirect is only for user experience. It does not mark an order paid.

The payment migration creates `purchases` (`pending` / `paid` / `failed`, gateway, Paymob order/transaction IDs, minor-unit amount, currency, paid time, product IDs), a deduplication event table, a fulfillment outbox, service-role-only RPCs, and RLS deny policies for client roles. Purchases are linked to purchased books through their product IDs and the referenced order. The existing schema has no defined `sold` campaign status or campaign-attribution field, so this code does not set an existing campaign to “sold.”

### Manual PayPal fallback

`/api/orders/confirm` now permits manual admin confirmation only for `payment_method = paypal`. InstaPay, Vodafone Cash, and Etisalat Cash were removed from checkout as manual options; Egyptian card/wallet payments should go through Paymob integrations configured in the merchant account.

## Required environment variables

Use **test-mode** keys and test Integration IDs in Vercel Preview first. Add live credentials to Production only after the sandbox flow passes.

| Variable | Purpose |
| --- | --- |
| `PAYMOB_SECRET_KEY` | Server-side Paymob key for creating intentions. |
| `PAYMOB_PUBLIC_KEY` | Public key used to build the hosted checkout URL. |
| `PAYMOB_HMAC_SECRET` | Verifies Paymob transaction webhooks. |
| `PAYMOB_INTEGRATION_ID_CARD` | Card Integration ID. |
| `PAYMOB_INTEGRATION_ID_WALLET` | Optional wallet Integration ID if enabled on the account. |
| `PAYMOB_CURRENCY` | Must match the selected Paymob integration (recommended Egypt setup: `EGP`). |
| `PAYMOB_AMOUNT_MULTIPLIER` | Amount conversion from the site's current USD catalog value into Paymob currency. Choose and maintain this rate; the application does not guess it. |
| `NEXT_PUBLIC_PAYMOB_CURRENCY` | Public checkout display currency; must match `PAYMOB_CURRENCY`. |
| `NEXT_PUBLIC_PAYMOB_AMOUNT_MULTIPLIER` | Public checkout display multiplier; must exactly match `PAYMOB_AMOUNT_MULTIPLIER`. |
| `PAYMOB_BASE_URL` | Optional; Egypt default is `https://accept.paymob.com`. |
| `NEXT_PUBLIC_SITE_URL` | The public HTTPS deployment URL used for Paymob callbacks and redirects. Set Preview and Production URLs separately. |
| `RESEND_FROM_EMAIL` | Verified sender address required to deliver purchase emails. |
| `RESEND_API_KEY` | Already listed in Vercel Production during the earlier audit; ensure it is also configured for Preview testing. |

The requested `PAYMOB_IFRAME_ID` is not used because this integration uses Paymob's hosted Unified Checkout. `PAYMOB_API_KEY` is for Paymob Transaction Inquiry/reconciliation, which is not part of this checkout implementation. A wallet ID is optional; the card Integration ID is required.

For local Egyptian catalog prices still displayed in dollars, the multiplier represents the chosen EGP amount per catalog USD. The checkout UI displays the converted amount and currency before redirecting. International card acceptance depends on the merchant's Paymob account and integration settings; issuing banks handle their own currency conversion.

## Database and deployment state

- Migration file added: `supabase/migrations/202610190001_paymob_automatic_payments.sql`.
- The migration is **not applied** to production. Supabase CLI is not installed in this workspace, and no direct SQL execution tool is connected. Apply the migration from the Supabase SQL editor or provide an approved database migration path before enabling checkout.
- New Paymob variables and `RESEND_FROM_EMAIL` were not found in the Vercel environments checked. No secret values were printed or added.
- This code has not been deployed to the supplied production URL. The current local workspace also contains earlier uncommitted changes, so a production deploy must be made from a reviewed deployment snapshot.

## Verification results

| Check | Result |
| --- | --- |
| TypeScript `tsc --noEmit` | Passed. |
| ESLint on changed route/library/UI files | Passed with no warnings after cleanup. |
| Scoped repository tests (`node --test tests`) | 8 passed, 1 failed. The added Paymob test verifies a valid transaction HMAC and rejects altered signatures. Existing failure: `admin auth rejects short passwords...` expects a 31-character password to be rejected, while current `admin-auth.ts` accepts passwords of 12+ characters. This is unrelated to Paymob and was not changed. |
| Broad Node test discovery | Do not use. It previously discovered root `test-*.js` integration scripts and attempted external publishing requests. The package test script is now scoped to `tests/` so these scripts are not run by `npm test`. |
| Paymob intention / test card | Not run; test credentials are not configured. |
| HMAC webhook received and verified | Not run against Paymob; Preview webhook cannot be tested until Preview environment is configured and deployed. |
| Email with signed PDF | Not run; no Paymob callback or test purchase was available. `RESEND_FROM_EMAIL` is also required. |
| 24-hour link expiry | Implementation requests a 24-hour signed URL; expiry was not time-tested. |
| Production cron / Telegram post | Not run; code update is not deployed. The user's prior Telegram message confirmation is recorded separately and was not repeated. |

## Before enabling production

1. Add the Paymob test variables above to Vercel Preview. Set the selected currency, rate, and matching public display values.
2. Apply the Supabase migration.
3. Configure a verified `RESEND_FROM_EMAIL` in Preview.
4. Deploy a reviewed Preview and run one real Paymob sandbox card transaction through callback, email, order status, and PDF link.
5. Add live Paymob keys/IDs and the verified production sender to Production, deploy the reviewed change, then verify the scheduled cron runs at 07:00 UTC.

### Paymob references

- [Intention API](https://developers.paymob.com/paymob-docs/intention-apis/create-intention) — amount units, payment integration IDs, callback and redirect URLs.
- [Transaction callbacks](https://developers.paymob.com/paymob-docs/developers/transaction-callbacks) — POST callback is the source of truth; redirect parameters are not proof of payment.
- [Paymob integration guidance](https://github.com/PaymobAccept/Paymob-AI-Integration-Skill) — hosted Unified Checkout and HMAC field order.
