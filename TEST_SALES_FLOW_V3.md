# Corrected Sales and Payment Audit — V3

**Audit date:** 2026-10-19 (Africa/Cairo)  
**Production URL supplied:** `https://hidden-radiology-project-chi.vercel.app`  
**Scope:** inspect current workspace, tracked Git history, configured Vercel environment variable names, and available production endpoints without placing a real order.

## Correction to the previous report

The earlier report was too broad when it called the payment channels “missing.” The tracked checkout in `origin/main` has manual payment choices for InstaPay, Vodafone Cash/Fawry, Etisalat Cash, and PayPal, and links customers to WhatsApp to send order/payment details. That is evidence the options existed in the application; the user's report that they were tested previously is recorded as historical user-confirmed testing. I restored those four options in the current workspace checkout and re-enabled their order-creation/admin-confirmation path. InstaPay is the default selection again.

However, inspected tracked code does **not** implement automated payment confirmation for those cash/transfer methods. It creates an order with `pending_verification`; an administrator confirms it, after which the server creates 24-hour PDF links and attempts email delivery. The WhatsApp link opens a prefilled message for the customer to send. No WhatsApp Business webhook or auto-reply handler was found in the repository. So this audit cannot confirm automatic payment fulfillment or WhatsApp auto-replies from code.

## Gateway findings

| Gateway / channel | Evidence in workspace | What the code proves |
| --- | --- | --- |
| InstaPay | Checkout UI and `/api/orders/create` | Re-enabled locally; manual transfer instructions; order remains pending administrator verification. |
| Vodafone Cash | Checkout UI and `/api/orders/create` | Re-enabled locally; manual transfer instructions; order remains pending administrator verification. |
| Fawry | Grouped with Vodafone Cash in checkout/local-pay UI | Re-enabled with the same manual order path; no Fawry webhook route found. |
| Etisalat Cash | Checkout UI and `/api/orders/create` | Re-enabled locally; manual transfer instructions; order remains pending administrator verification. |
| PayPal | PayPal.me checkout link and accepted order method | Manual transfer/link; admin confirmation required. No PayPal webhook route found. |
| Gumroad | Production Vercel has `GUMROAD_ACCESS_TOKEN`; cart UI references Gumroad | Credential name and UI copy do not prove an active Gumroad product checkout or webhook. `DEPLOYMENT.md` says automatic Gumroad purchase verification is paused pending product links/API verification. |
| WhatsApp Business | `wa.me` links in checkout and `/local-pay` | Customer-initiated, prefilled WhatsApp message only. No inbound webhook/auto-reply handler found. |
| Paymob | Local-only uncommitted files from the previous task: `/api/checkout`, `/api/webhook/paymob` | Local candidate implementation only. Vercel Production/Preview variables checked do not include Paymob credentials; webhook cannot be called “live” based on this evidence. |

### Payment endpoints

- `/api/orders/create`: in tracked `origin/main`, accepts `instapay`, `vodafone`, `etisalat`, and `paypal`; inserts an order as `pending_verification`.
- `/api/orders/confirm`: administrator session is required; it creates signed PDF links and emails them after manual confirmation. The local PayPal-only restriction was removed so all manual methods accepted by `/api/orders/create` can follow this flow.
- No tracked `/api/webhook/fawry`, `/api/webhook/vodafone`, `/api/webhook/paypal`, `/api/webhook/whatsapp`, or Gumroad fulfillment webhook was found.
- The only webhook route in the current workspace is the uncommitted `/api/webhook/paymob` added during the earlier task. It is not evidence of a deployed production route.

## WhatsApp auto-reply

The repository contains outbound `https://wa.me/...` links with prefilled order or transfer text. The user must open WhatsApp and send the message. Search across `src/app`, `src/lib`, and `supabase` found no inbound WhatsApp webhook, Meta WhatsApp Cloud API message handler, Twilio/360dialog handler, or automated reply function. Vercel has Meta app variable names, but those alone do not prove WhatsApp Business is configured; no WhatsApp phone-number ID or WhatsApp access-token variable was listed. The local checkout displays the four historical manual options, plus the uncommitted Paymob candidate from the prior task; that candidate is not verified as live.

## Production evidence and limits

The checked Vercel Production variable names include `GUMROAD_ACCESS_TOKEN`, `META_APP_ID`, `META_APP_SECRET`, `RESEND_API_KEY`, and the Supabase/admin/cron variables. No `FAWRY_*`, `VODAFONE_*`, `ETISALAT_*`, `PAYPAL_*`, `STRIPE_*`, `PAYMOB_*`, or WhatsApp-specific variable names appeared. Preview only listed Supabase URL and anon key. Variable names do not establish successful transactions. Earlier tracked migrations contain no `payments` or `purchases` payment schema; the only `purchases` table definition is in the new local Paymob migration and has not been applied or verified against the remote database. The existing `orders` table is used by the manual flow.

Read-only requests to Production returned HTTP 200 for `/checkout` and `/local-pay`. Payment labels found in the returned checkout markup were PayPal on `/checkout`; `/local-pay` contained Vodafone, Fawry, Etisalat, InstaPay, and PayPal. The production URLs `/api/webhook/paypal` and `/api/webhook/paymob` returned 404 on GET. This is live evidence of payment page labels, not successful payment or webhook fulfillment. No real order or financial transaction was submitted. The local re-enable changes have not been deployed.

TypeScript and ESLint checks passed for the local re-enable changes. No live checkout or payment test was run.

## Routes relevant to sales

- `/api/orders/create`
- `/api/orders/confirm`
- `/api/orders/status`
- `/api/orders/list`
- `/api/checkout` (local Paymob candidate)
- `/api/webhook/paymob` (local Paymob candidate)

No Fawry, Vodafone Cash, PayPal, Gumroad, or WhatsApp webhook URL was found. The production webhook URLs for those providers are therefore **not verified / not evidenced**.

## Conclusion

The correction is that the manual payment options did exist and were reportedly tested by the user. The inspected source supports manual order intake and manual fulfillment after an admin verifies payment. It does **not** support the stronger claim that Vodafone Cash, Fawry, Etisalat Cash, PayPal, or Gumroad currently trigger automatic paid status, email delivery, or PDF fulfillment. Nor does it contain WhatsApp auto-reply logic. Production state remains unverified because the live pages and provider dashboards could not be inspected here.

To establish current end-to-end status, verify one transaction per provider in the respective provider dashboard and match it to an order's status and delivery email; for WhatsApp, test an inbound message to the connected Business number and inspect the received reply. Do not infer success from the presence of a payment option or environment variable alone.
