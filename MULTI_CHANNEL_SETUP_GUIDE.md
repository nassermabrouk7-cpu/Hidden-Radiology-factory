# Multi-Channel Publishing Setup Guide

## Current Status
- ✅ Telegram: **WORKING** (chat_id: -5416713273)
- ⏳ Facebook: Ready for configuration
- ⏳ Instagram: Ready for configuration
- ⏳ Threads: Ready for configuration
- ⏳ LinkedIn: Ready for configuration

---

## Environment Variables Required

### 1. Facebook (Required for both Facebook & Instagram)

**Variables:**
- `FACEBOOK_PAGE_ID` - Your Facebook Page ID
- `FACEBOOK_PAGE_ACCESS_TOKEN` - Long-lived page access token

**How to get FACEBOOK_PAGE_ID:**
1. Go to your Facebook Page
2. Click "About" → "Page Info"
3. Copy the "Page ID" (numeric string, e.g., "123456789012345")

**How to get FACEBOOK_PAGE_ACCESS_TOKEN:**
1. Go to [Facebook Developers](https://developers.facebook.com/tools/explorer/)
2. Select your app (create one if needed)
3. In Graph API Explorer, select your Page from the dropdown
4. Generate token with permissions: `pages_manage_posts`, `pages_read_engagement`
5. Click "Generate Access Token"
6. Click "Debug" → "Extend Access Token" to get long-lived token (60 days)
7. Copy the token

**Add to Vercel:**
- Vercel Dashboard → hidden-radiology-factory → Settings → Environment Variables
- Add `FACEBOOK_PAGE_ID` (Config)
- Add `FACEBOOK_PAGE_ACCESS_TOKEN` (Secret)

---

### 2. Instagram

**Variables:**
- `INSTAGRAM_BUSINESS_ACCOUNT_ID` - Instagram Business Account ID
- `FACEBOOK_PAGE_ACCESS_TOKEN` - Same as Facebook (already configured)

**How to get INSTAGRAM_BUSINESS_ACCOUNT_ID:**
1. Connect your Instagram account to your Facebook Page (if not already)
2. Go to [Facebook Business Suite](https://business.facebook.com/)
3. Click your Instagram account
4. Copy the "Instagram Account ID" from URL or settings

**Add to Vercel:**
- Add `INSTAGRAM_BUSINESS_ACCOUNT_ID` (Config)

---

### 3. Threads

**Variables:**
- `THREADS_USER_ID` - Your Threads user ID
- `THREADS_ACCESS_TOKEN` - Threads API access token

**How to get THREADS_USER_ID & THREADS_ACCESS_TOKEN:**
1. Go to [Threads Developers](https://developers.facebook.com/docs/threads/)
2. Create a new app or use existing
3. Set up Threads API in app settings
4. Go to Tools → Graph API Explorer
5. Generate token with `threads_basic`, `threads_content_publish` permissions
6. Use the endpoint `me?fields=id` to get your user ID
7. Copy both values

**Add to Vercel:**
- Add `THREADS_USER_ID` (Config)
- Add `THREADS_ACCESS_TOKEN` (Secret)

---

### 4. LinkedIn

**Variables:**
- `LINKEDIN_ORGANIZATION_ID` - LinkedIn Company Page ID (URN format)
- `LINKEDIN_ACCESS_TOKEN` - LinkedIn API access token

**How to get LINKEDIN_ORGANIZATION_ID:**
1. Go to your LinkedIn Company Page
2. Copy the URL, e.g., `https://www.linkedin.com/company/hidden-radiology/`
3. The ID is the last part, but you need the URN format: `urn:li:organization:12345678`
4. To get the numeric ID, use LinkedIn API or tools like [li-id-finder](https://li-id-finder.onrender.com/)

**How to get LINKEDIN_ACCESS_TOKEN:**
1. Go to [LinkedIn Developers](https://developer.linkedin.com/)
2. Create an app
3. Enable APIs: "Share on LinkedIn" and "Organization Access"
4. Generate access token with `w_member_social` permission
5. Copy the token

**Add to Vercel:**
- Add `LINKEDIN_ORGANIZATION_ID` (Config)
- Add `LINKEDIN_ACCESS_TOKEN` (Secret)

---

## Configuration Steps

### Step 1: Add Environment Variables to Vercel

For each channel:
1. Go to Vercel Dashboard → hidden-radiology-factory → Settings → Environment Variables
2. Add each variable as specified above
3. Select "Production" environment
4. Click "Save"
5. **Important:** Redeploy after adding all variables

### Step 2: Enable Channels in Configuration

Once tokens are added, I will update `src/channels.config.json` to set `enabled: true` for each channel.

Current config (all disabled except Telegram):
```json
{
  "telegram": { "enabled": true },
  "facebook": { "enabled": false },
  "instagram": { "enabled": false },
  "threads": { "enabled": false },
  "linkedin": { "enabled": false }
}
```

After configuration (example):
```json
{
  "telegram": { "enabled": true },
  "facebook": { "enabled": true },
  "instagram": { "enabled": true },
  "threads": { "enabled": true },
  "linkedin": { "enabled": true }
}
```

### Step 3: Test Each Channel

I will update `/api/test-publish` to test individual channels. You can test with:

```bash
# Test all channels
curl -X POST https://hidden-radiology-project-chi.vercel.app/api/test-publish \
  -H "Content-Type: application/json" \
  -d '{"bookId": "test-book-001"}'

# Test specific channel (I'll add this feature)
curl -X POST https://hidden-radiology-project-chi.vercel.app/api/test-publish \
  -H "Content-Type: application/json" \
  -d '{"bookId": "test-book-001", "channels": ["facebook"]}'
```

---

## Files Created

1. `src/lib/channels/facebook.ts` - Facebook Graph API publisher
2. `src/lib/channels/instagram.ts` - Instagram Graph API publisher (2-step)
3. `src/lib/channels/threads.ts` - Threads API publisher
4. `src/lib/channels/linkedin.ts` - LinkedIn UGC API publisher
5. `src/channels.config.json` - Updated with new structure

---

## Publisher Features

All publishers include:
- ✅ Error handling (one channel failure doesn't stop others)
- ✅ Detailed error messages
- ✅ External post ID tracking
- ✅ Try/catch for each channel
- ✅ Environment variable validation
- ✅ Message formatting with buy links

---

## Cron Schedule

The cron will publish to **all enabled channels** automatically:
- **Path:** `/api/publish-all?auto=true`
- **Schedule:** `0 7 * * *` (7 AM UTC = 9 AM Cairo)
- **Auth:** Requires `CRON_SECRET` header

---

## Next Steps

1. **You:** Get the tokens for each channel (see instructions above)
2. **You:** Add them to Vercel environment variables
3. **You:** Let me know when all variables are added
4. **Me:** Update `channels.config.json` to enable channels
5. **Me:** Test each channel with `/api/test-publish`
6. **Me:** Deploy to production
7. **Me:** Verify posts appear on each platform

---

## Important Notes

- **Facebook & Instagram** share the same access token (from Meta)
- **Telegram** is already working and will continue to work
- **Metricool** is no longer used - we now use direct APIs
- **Gumroad** remains the payment provider (not a publishing channel)
- **Supabase** logs all publishing attempts
- **All channels** use the same campaign data (title, description, image, price)

---

## Troubleshooting

**If a channel fails:**
- Check token is valid and not expired
- Verify permissions are correct
- Check the channel is linked to the correct account
- Review error message in response

**If you want to disable a channel temporarily:**
- Set `enabled: false` in `channels.config.json`
- Redeploy
- The cron will skip that channel

---

## Security

- All access tokens are stored as **Secrets** in Vercel
- They are never exposed in browser bundles
- Tokens are only used server-side
- CRON_SECRET protects the cron endpoint
