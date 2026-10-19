# Test Publish Endpoint Created

## New Endpoint: `/api/test-publish`

**Purpose:** Test Telegram publishing without cron authentication
**Status:** ✅ Built locally, ready for deployment
**URL:** https://hidden-radiology-project-chi.vercel.app/api/test-publish (after deployment)

---

## How to Use

### 1. GET Request (Check Configuration)
```bash
curl https://hidden-radiology-project-chi.vercel.app/api/test-publish
```

Returns:
```json
{
  "message": "Test endpoint ready. Use POST to publish.",
  "usage": { ... },
  "config": {
    "telegramEnabled": true,
    "chatId": "-5416713273",
    "channelName": "Radiology و Radiology Hidden"
  }
}
```

### 2. POST Request (Publish Test)
```bash
curl -X POST https://hidden-radiology-project-chi.vercel.app/api/test-publish \
  -H "Content-Type: application/json" \
  -d '{
    "bookId": "test-book-001",
    "campaignType": "manual_test"
  }'
```

Or with custom data:
```bash
curl -X POST https://hidden-radiology-project-chi.vercel.app/api/test-publish \
  -H "Content-Type: application/json" \
  -d '{
    "bookId": "your-book-id",
    "imageUrl": "https://your-image-url.jpg",
    "price": 15,
    "title_ar": "العنوان بالعربي",
    "title_en": "English Title",
    "description_ar": "الوصف بالعربي",
    "description_en": "English description",
    "campaignType": "test"
  }'
```

### 3. Response on Success
```json
{
  "success": true,
  "message": "Photo sent successfully",
  "channel": "telegram",
  "externalId": "17",
  "testData": {
    "bookId": "test-book-001",
    "imageUrl": "...",
    "price": 15,
    "title_ar": "أنا فاهم أشعة",
    "title_en": "I Understand Radiology",
    "campaignType": "manual_test",
    "chatId": "-5416713273",
    "channelName": "Radiology و Radiology Hidden"
  }
}
```

---

## Features

- ✅ No authentication required (for testing only)
- ✅ Uses same Telegram publishing logic as `/api/publish-all`
- ✅ Publishes to configured chat_id: `-5416713273`
- ✅ Includes inline "Buy Now" button
- ✅ Returns external message ID for verification
- ✅ Default test data if none provided
- ✅ Returns detailed error messages

---

## Deployment Required

The build is complete locally. To deploy to production:

**Option 1: Vercel Dashboard**
1. Go to Vercel Dashboard → hidden-radiology-factory
2. Push to GitHub or trigger deployment
3. Or upload the build manually

**Option 2: Vercel CLI (if authenticated)**
```bash
cd E:\hidden-radiology-factory
vercel login
vercel deploy --prod --scope team_6BoLUg4waSRjUHoyL8y1FRex
```

---

## Verification Steps

1. Deploy the new build to production
2. Visit: https://hidden-radiology-project-chi.vercel.app/api/test-publish
3. Check that config shows:
   - `telegramEnabled: true`
   - `chatId: "-5416713273"`
4. Run POST request with test data
5. Check your Telegram channel "Radiology و Radiology Hidden"
6. Verify the photo appears with "Buy Now" button
7. Note the `externalId` for tracking

---

## Cron Configuration

The main `/api/publish-all` endpoint with cron:
- **Path:** `/api/publish-all?auto=true`
- **Schedule:** `0 7 * * *` (7 AM UTC = 9 AM Cairo)
- **Auth:** Requires `Authorization: Bearer CRON_SECRET` header
- **Logic:** Random book not published in last 7 days

To test with cron auth:
```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  https://hidden-radiology-project-chi.vercel.app/api/publish-all?auto=true
```

---

## Current Build Status

- ✅ TypeScript: PASSED
- ✅ Build: PASSED
- ✅ Routes: 24 total (including `/api/test-publish`)
- ⏳ Deployment: REQUIRED (Vercel CLI session expired)

---

## Files Modified

1. `src/app/api/test-publish/route.ts` - New test endpoint
2. `src/channels.config.json` - Added channel_name and enabled to telegram config
