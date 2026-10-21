# Facebook/Instagram Publishing Fix Report

## Current Status

### ✅ Completed
1. Added environment variables to Vercel Production:
   - `FACEBOOK_PAGE_ID` = 1080854664848106
   - `FACEBOOK_PAGE_ACCESS_TOKEN` = 31TuafIsMYNwP7Ndg_KF9G3YFks
   - `INSTAGRAM_ACCESS_TOKEN` = 31TuafIsMYNwP7Ndg_KF9G3YFks
   - `INSTAGRAM_BUSINESS_ACCOUNT_ID` = 1080854664848106

2. Enabled channels in `channels.config.json`:
   - Telegram: enabled ✅
   - Facebook: enabled ✅
   - Instagram: enabled ✅
   - LinkedIn: disabled (no token)
   - Threads: disabled (no token)

3. Updated Instagram publisher to fallback to Facebook Page ID

4. Deployed to production: https://hidden-radiology-project-chi.vercel.app

### ❌ Issue: Invalid Facebook Access Token

**Error:** `Invalid OAuth access token - Cannot parse access token`

**Cause:** The token provided (`31TuafIsMYNwP7Ndg_KF9G3YFks`) appears to be:
- Too short (Facebook tokens are typically 100+ characters)
- Possibly truncated or incomplete
- May be a test token instead of a long-lived production token

## Solution Required

You need to generate a proper long-lived Facebook Page Access Token:

### Steps to Get Valid Token:

1. Go to [Facebook Developers - Graph API Explorer](https://developers.facebook.com/tools/explorer/)
2. Select your app (create one if needed)
3. In the dropdown, select your Facebook Page
4. Generate token with these permissions:
   - `pages_manage_posts`
   - `pages_read_engagement`
   - `instagram_basic`
   - `instagram_content_publish`
5. Click "Generate Access Token"
6. Click "Debug" next to the token
7. Click "Extend Access Token" to get a 60-day long-lived token
8. Copy the full token (should be 100+ characters)

### Update Token in Vercel:

```bash
# Remove old token
vercel env rm FACEBOOK_PAGE_ACCESS_TOKEN production --scope team_6BoLUg4waSRjUHoyL8y1FRex
vercel env rm INSTAGRAM_ACCESS_TOKEN production --scope team_6BoLUg4waSRjUHoyL8y1FRex

# Add new valid token
echo "YOUR_NEW_LONG_LIVED_TOKEN" > fb_token.txt
vercel env add FACEBOOK_PAGE_ACCESS_TOKEN production < fb_token.txt --scope team_6BoLUg4waSRjUHoyL8y1FRex
echo "YOUR_NEW_LONG_LIVED_TOKEN" > ig_token.txt
vercel env add INSTAGRAM_ACCESS_TOKEN production < ig_token.txt --scope team_6BoLUg4waSRjUHoyL8y1FRex
rm fb_token.txt ig_token.txt
```

---

## Terminal Commands for Manual Publishing

Once you have a valid token, use these commands to trigger publishing:

### 1. Export CRON_SECRET (from local .env.local)
```bash
export CRON_SECRET=$(grep CRON_SECRET .env.local | cut -d'=' -f2 | tr -d '"')
```

### 2. Test specific channels
```bash
# Test Facebook only
curl -X POST https://hidden-radiology-project-chi.vercel.app/api/test-publish \
  -H "Content-Type: application/json" \
  -d '{"bookId": "test-book-001", "channels": ["facebook"]}'

# Test Instagram only
curl -X POST https://hidden-radiology-project-chi.vercel.app/api/test-publish \
  -H "Content-Type: application/json" \
  -d '{"bookId": "test-book-001", "channels": ["instagram"]}'

# Test both
curl -X POST https://hidden-radiology-project-chi.vercel.app/api/test-publish \
  -H "Content-Type: application/json" \
  -d '{"bookId": "test-book-001", "channels": ["facebook", "instagram"]}'
```

### 3. Trigger full publish-all (requires CRON_SECRET)
```bash
curl -X POST https://hidden-radiology-project-chi.vercel.app/api/publish-all \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"bookId": "test-book-001", "campaignType": "manual_test"}'
```

### 4. Trigger auto mode (random book, last 7 days check)
```bash
curl -X POST "https://hidden-radiology-project-chi.vercel.app/api/publish-all?auto=true" \
  -H "Authorization: Bearer $CRON_SECRET"
```

---

## Current Deployment Status

- **Commit:** 83cfaad (enabled Facebook/Instagram)
- **Deployment:** https://hidden-radiology-factory-p1merdeoa.vercel.app
- **Production URL:** https://hidden-radiology-project-chi.vercel.app
- **Status:** Ready
- **Telegram:** ✅ Working
- **Facebook:** ❌ Token invalid
- **Instagram:** ❌ Token invalid

---

## What Was Fixed

1. ✅ Added environment variables to Vercel Production
2. ✅ Enabled Facebook and Instagram in config
3. ✅ Added Instagram Business Account ID
4. ✅ Updated Instagram publisher with fallback logic
5. ✅ Deployed to production
6. ❌ Token validation failed (needs new token from user)

---

## Next Steps

1. **You:** Generate a valid long-lived Facebook Page Access Token (see steps above)
2. **You:** Update the token in Vercel using the commands above
3. **Me:** Re-deploy and test publishing
4. **Me:** Verify posts appear on Facebook Page and Instagram

---

## Cron Schedule

The cron is configured in `vercel.json`:
- **Path:** `/api/publish-all?auto=true`
- **Schedule:** `0 7 * * *` (7 AM UTC = 9 AM Cairo)
- **Auto-deploys:** Yes (Vercel auto-deploys on git push)

The cron will automatically publish to all enabled channels once the token is fixed.
