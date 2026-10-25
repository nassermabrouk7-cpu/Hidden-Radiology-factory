import { NextRequest, NextResponse } from 'next/server';
import channelsConfig from '@/channels.config.json';
import { publishToFacebook } from '@/lib/channels/facebook';
import { publishToInstagram } from '@/lib/channels/instagram';
import { publishToThreads } from '@/lib/channels/threads';
import { publishToLinkedIn } from '@/lib/channels/linkedin';
import { isCronBearerAuthorized } from '@/lib/marketing-auth';
import { getFacebookCredentialError } from '@/lib/facebook-credentials';
import { getMetaTokenHealth, isMetaTokenPublishAllowed, type MetaTokenHealth } from '@/lib/meta-token-health';
import { getInstagramBusinessAccountId } from '@/lib/meta-credentials';
import { getMetaPublishCredentials } from '@/lib/meta-token-vault';

interface PublishRequest {
  bookId?: string;
  campaignType?: string;
  imageUrl?: string;
  price?: number;
  description_ar?: string;
  description_en?: string;
  title_ar?: string;
  title_en?: string;
  channels?: string[]; // Optional: specify which channels to test
  dryRun?: boolean;
}

interface PublishResult {
  channel: string;
  success: boolean;
  message: string;
  externalId?: string;
  error?: string;
}

function safeError(value: unknown): string {
  let message = typeof value === 'string' ? value : 'Unknown publishing error';
  for (const name of ['TELEGRAM_BOT_TOKEN', 'FACEBOOK_PAGE_ACCESS_TOKEN', 'INSTAGRAM_ACCESS_TOKEN', 'THREADS_ACCESS_TOKEN', 'LINKEDIN_ACCESS_TOKEN', 'CRON_SECRET', 'SUPABASE_SERVICE_ROLE_KEY']) {
    const secret = process.env[name];
    if (secret) message = message.split(secret).join('[REDACTED]');
  }
  return message.slice(0, 300);
}

// Telegram publisher
async function publishToTelegram(
  botToken: string,
  chatId: string,
  imageUrl: string,
  caption: string,
  buyUrl: string
): Promise<PublishResult> {
  try {
    const photoResponse = await fetch(
      `https://api.telegram.org/bot${botToken}/sendPhoto`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          photo: imageUrl,
          caption: caption.substring(0, 1024),
          reply_markup: {
            inline_keyboard: [[
              {
                text: '🛒 Buy Now',
                url: buyUrl
              }
            ]]
          }
        })
      }
    );

    const photoData = await photoResponse.json();

    const messageId = photoData?.result?.message_id;
    if (!photoResponse.ok || photoData?.ok !== true || (typeof messageId !== 'number' && typeof messageId !== 'string')) {
      return {
        channel: 'telegram',
        success: false,
        message: 'Failed to send photo',
        error: String(photoData.description || `Telegram API returned HTTP ${photoResponse.status}.`).split(botToken).join('[REDACTED]').slice(0, 300)
      };
    }

    return {
      channel: 'telegram',
      success: true,
      message: 'Photo sent successfully',
      externalId: String(messageId)
    };
  } catch (error) {
    return {
      channel: 'telegram',
      success: false,
      message: 'Telegram publishing failed',
      error: error instanceof Error ? error.message.split(botToken).join('[REDACTED]').slice(0, 300) : 'Unknown error'
    };
  }
}

export async function POST(request: NextRequest) {
  if (!isCronBearerAuthorized(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body: PublishRequest = await request.json();
    const testChannels = body.channels || ['telegram']; // Default to telegram only
    const metaHealth: Partial<Record<'facebook' | 'instagram', MetaTokenHealth>> = {};
    if (testChannels.includes('facebook')) metaHealth.facebook = await getMetaTokenHealth('facebook');
    if (testChannels.includes('instagram')) metaHealth.instagram = await getMetaTokenHealth('instagram');
    const metaCanPublish = (status: MetaTokenHealth['status'] | undefined) => status !== undefined && isMetaTokenPublishAllowed(status);

    // If no data provided, use default test data
    const bookId = body.bookId || 'test-book-001';
    const imageUrl = body.imageUrl || 'https://hidden-radiology-project-chi.vercel.app/logos/hr-icon.png';
    const price = body.price || 15;
    const title_ar = body.title_ar || 'أنا فاهم أشعة';
    const title_en = body.title_en || 'I Understand Radiology';
    const description_ar = body.description_ar || 'مرجع متخصص في الأشعة للطلاب والأطباء';
    const description_en = body.description_en || 'Specialized radiology reference for students and doctors';
    const campaignType = body.campaignType || 'manual_test';

    const buyUrl = `https://hidden-radiology-project-chi.vercel.app/library?book=${bookId}`;
    const caption = description_ar || description_en || '';

    if (body.dryRun === true) {
      const preview = testChannels.map((channel) => {
        const enabled = channel === 'telegram' ? Boolean(channelsConfig.telegram?.enabled)
          : channel === 'facebook' ? Boolean(channelsConfig.facebook?.enabled)
          : channel === 'instagram' ? Boolean(channelsConfig.instagram?.enabled)
          : channel === 'threads' ? Boolean(channelsConfig.threads?.enabled)
          : channel === 'linkedin' ? Boolean(channelsConfig.linkedin?.enabled)
          : false;
        let configured = false;
        if (channel === 'telegram') configured = Boolean(process.env.TELEGRAM_BOT_TOKEN);
        if (channel === 'facebook') configured = metaCanPublish(metaHealth.facebook?.status) &&
          (process.env.META_TOKEN_VAULT_ENABLED === 'true' || !getFacebookCredentialError(process.env.FACEBOOK_PAGE_ID, process.env.FACEBOOK_PAGE_ACCESS_TOKEN));
        if (channel === 'instagram') configured = metaCanPublish(metaHealth.instagram?.status) &&
          (process.env.META_TOKEN_VAULT_ENABLED === 'true' || Boolean(getInstagramBusinessAccountId() && process.env.INSTAGRAM_ACCESS_TOKEN));
        if (channel === 'threads') configured = Boolean(process.env.THREADS_USER_ID && process.env.THREADS_ACCESS_TOKEN);
        if (channel === 'linkedin') configured = Boolean(process.env.LINKEDIN_ORGANIZATION_ID && process.env.LINKEDIN_ACCESS_TOKEN);
        return { channel, enabled, configured, status: !enabled ? 'disabled' : configured ? 'would_publish' : 'not_configured' };
      });
      return NextResponse.json({
        success: true,
        dryRun: true,
        product: { bookId, title: title_en || title_ar, price },
        imageUrl,
        destination: buyUrl,
        channels: preview,
        externalPostsCreated: false,
      });
    }

    const results: PublishResult[] = [];

    // Test each requested channel
    for (const channel of testChannels) {
      if (channel === 'telegram') {
        if (!channelsConfig.telegram?.enabled) {
          results.push({
            channel: 'telegram',
            success: false,
            message: 'Telegram not enabled',
            error: 'Telegram not enabled in channels.config.json'
          });
          continue;
        }

        if (!process.env.TELEGRAM_BOT_TOKEN) {
          results.push({
            channel: 'telegram',
            success: false,
            message: 'Telegram token missing',
            error: 'TELEGRAM_BOT_TOKEN not found in environment'
          });
          continue;
        }

        const result = await publishToTelegram(
          process.env.TELEGRAM_BOT_TOKEN,
          channelsConfig.telegram.chat_id,
          imageUrl,
          caption,
          buyUrl
        );
        results.push(result);
      } else if (channel === 'facebook') {
        if (!metaCanPublish(metaHealth.facebook?.status)) {
          results.push({ channel: 'facebook', success: false, message: 'Facebook token health is not publishable', error: 'Meta token health could not verify Facebook publishing.' });
          continue;
        }
        if (!channelsConfig.facebook?.enabled) {
          results.push({
            channel: 'facebook',
            success: false,
            message: 'Facebook not enabled',
            error: 'Facebook not enabled in channels.config.json'
          });
          continue;
        }

        const credentials = await getMetaPublishCredentials('facebook');

        if (!credentials || getFacebookCredentialError(credentials.id, credentials.accessToken)) {
          results.push({
            channel: 'facebook',
            success: false,
            message: 'Facebook credentials missing',
            error: 'Facebook Page credentials are missing or malformed'
          });
          continue;
        }

        const fbResult = await publishToFacebook(credentials.id, credentials.accessToken, {
          message: `${title_en || title_ar}\n\n${description_en || description_ar}\n\n${buyUrl}`,
          link: buyUrl,
          image_url: imageUrl,
        });
        results.push({
          channel: 'facebook',
          success: fbResult.success,
          message: fbResult.success ? 'Facebook post published' : 'Facebook publishing failed',
          externalId: fbResult.postId,
          error: fbResult.error,
        });
      } else if (channel === 'instagram') {
        if (!metaCanPublish(metaHealth.instagram?.status)) {
          results.push({ channel: 'instagram', success: false, message: 'Instagram token health is not publishable', error: 'Meta token health could not verify Instagram publishing.' });
          continue;
        }
        if (!channelsConfig.instagram?.enabled) {
          results.push({
            channel: 'instagram',
            success: false,
            message: 'Instagram not enabled',
            error: 'Instagram not enabled in channels.config.json'
          });
          continue;
        }

        const credentials = await getMetaPublishCredentials('instagram');

        if (!credentials || !/^\d{10,20}$/.test(credentials.id)) {
          results.push({
            channel: 'instagram',
            success: false,
            message: 'Instagram credentials missing',
            error: 'Instagram business account credentials are missing or malformed'
          });
          continue;
        }

        const igResult = await publishToInstagram(credentials.id, credentials.accessToken, {
          imageUrl: imageUrl,
          caption: `${title_en || title_ar}\n\n${description_en || description_ar}\n\n${buyUrl}`,
        });
        results.push({
          channel: 'instagram',
          success: igResult.success,
          message: igResult.success ? 'Instagram post published' : 'Instagram publishing failed',
          externalId: igResult.postId,
          error: igResult.error,
        });
      } else if (channel === 'threads') {
        if (!channelsConfig.threads?.enabled) {
          results.push({
            channel: 'threads',
            success: false,
            message: 'Threads not enabled',
            error: 'Threads not enabled in channels.config.json'
          });
          continue;
        }

        const threadsUserId = process.env[channelsConfig.threads.user_id_env];
        const threadsAccessToken = process.env[channelsConfig.threads.access_token_env];

        if (!threadsUserId || !threadsAccessToken) {
          results.push({
            channel: 'threads',
            success: false,
            message: 'Threads credentials missing',
            error: 'THREADS_USER_ID or THREADS_ACCESS_TOKEN not configured'
          });
          continue;
        }

        const threadsResult = await publishToThreads(threadsUserId, threadsAccessToken, {
          text: `${title_en || title_ar}\n\n${description_en || description_ar}\n\n${buyUrl}`,
          mediaUrl: imageUrl,
        });
        results.push({
          channel: 'threads',
          success: threadsResult.success,
          message: threadsResult.success ? 'Threads post published' : 'Threads publishing failed',
          externalId: threadsResult.postId,
          error: threadsResult.error,
        });
      } else if (channel === 'linkedin') {
        if (!channelsConfig.linkedin?.enabled) {
          results.push({
            channel: 'linkedin',
            success: false,
            message: 'LinkedIn not enabled',
            error: 'LinkedIn not enabled in channels.config.json'
          });
          continue;
        }

        const linkedinOrgId = process.env[channelsConfig.linkedin.organization_id_env];
        const linkedinAccessToken = process.env[channelsConfig.linkedin.access_token_env];

        if (!linkedinOrgId || !linkedinAccessToken) {
          results.push({
            channel: 'linkedin',
            success: false,
            message: 'LinkedIn credentials missing',
            error: 'LINKEDIN_ORGANIZATION_ID or LINKEDIN_ACCESS_TOKEN not configured'
          });
          continue;
        }

        const linkedinResult = await publishToLinkedIn(linkedinOrgId, linkedinAccessToken, {
          text: `${title_en || title_ar}\n\n${description_en || description_ar}\n\n${buyUrl}`,
          link: buyUrl,
        });
        results.push({
          channel: 'linkedin',
          success: linkedinResult.success,
          message: linkedinResult.success ? 'LinkedIn post published' : 'LinkedIn publishing failed',
          externalId: linkedinResult.postId,
          error: linkedinResult.error,
        });
      } else {
        results.push({
          channel,
          success: false,
          message: 'Unknown channel',
          error: `Channel '${channel}' is not supported`
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    return NextResponse.json({
      success: successCount > 0,
      message: `Tested ${results.length} channels: ${successCount} succeeded, ${failureCount} failed`,
      results,
      summary: {
        total: results.length,
        succeeded: successCount,
        failed: failureCount
      },
      testData: {
        bookId,
        imageUrl,
        price,
        title_ar,
        title_en,
        campaignType,
        channelsTested: testChannels
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: safeError(error instanceof Error ? error.message : undefined)
      },
      { status: 500 }
    );
  }
}

// GET endpoint for quick browser test
export async function GET(request: NextRequest) {
  if (!isCronBearerAuthorized(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json({
    message: 'Test endpoint ready. Authorized POST requests may set dryRun: true to preview without publishing.',
    usage: {
      method: 'POST',
      body: {
        bookId: 'string (optional)',
        imageUrl: 'string (optional)',
        price: 'number (optional)',
        title_ar: 'string (optional)',
        title_en: 'string (optional)',
        description_ar: 'string (optional)',
        description_en: 'string (optional)',
        campaignType: 'string (optional)',
        channels: 'array (optional) - specify which channels to test, e.g., ["telegram", "facebook"]'
      },
      example: {
        bookId: 'test-book-001',
        campaignType: 'manual_test',
        channels: ['telegram', 'facebook']
      }
    },
    config: {
      telegram: channelsConfig.telegram?.enabled || false,
      facebook: channelsConfig.facebook?.enabled || false,
      instagram: channelsConfig.instagram?.enabled || false,
      threads: channelsConfig.threads?.enabled || false,
      linkedin: channelsConfig.linkedin?.enabled || false,
    }
  });
}
