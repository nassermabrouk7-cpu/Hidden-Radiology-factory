import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import channelsConfig from '@/channels.config.json';
import { publishToFacebook } from '@/lib/channels/facebook';
import { publishToInstagram } from '@/lib/channels/instagram';
import { publishToThreads } from '@/lib/channels/threads';
import { publishToLinkedIn } from '@/lib/channels/linkedin';

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
}

interface PublishResult {
  channel: string;
  success: boolean;
  message: string;
  externalId?: string;
  error?: string;
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
          parse_mode: 'HTML',
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

    if (!photoData.ok) {
      return {
        channel: 'telegram',
        success: false,
        message: 'Failed to send photo',
        error: photoData.description || 'Telegram API error'
      };
    }

    return {
      channel: 'telegram',
      success: true,
      message: 'Photo sent successfully',
      externalId: photoData.result.message_id.toString()
    };
  } catch (error) {
    return {
      channel: 'telegram',
      success: false,
      message: 'Telegram publishing failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: PublishRequest = await request.json();
    const testChannels = body.channels || ['telegram']; // Default to telegram only

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
        if (!channelsConfig.facebook?.enabled) {
          results.push({
            channel: 'facebook',
            success: false,
            message: 'Facebook not enabled',
            error: 'Facebook not enabled in channels.config.json'
          });
          continue;
        }

        const fbPageId = process.env[channelsConfig.facebook.page_id_env];
        const fbAccessToken = process.env[channelsConfig.facebook.access_token_env];

        if (!fbPageId || !fbAccessToken) {
          results.push({
            channel: 'facebook',
            success: false,
            message: 'Facebook credentials missing',
            error: 'FACEBOOK_PAGE_ID or FACEBOOK_PAGE_ACCESS_TOKEN not configured'
          });
          continue;
        }

        const fbResult = await publishToFacebook(fbPageId, fbAccessToken, {
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
        if (!channelsConfig.instagram?.enabled) {
          results.push({
            channel: 'instagram',
            success: false,
            message: 'Instagram not enabled',
            error: 'Instagram not enabled in channels.config.json'
          });
          continue;
        }

        const igAccountId = process.env[channelsConfig.instagram.business_account_id_env];
        const igAccessToken = process.env[channelsConfig.instagram.access_token_env];

        if (!igAccountId || !igAccessToken) {
          results.push({
            channel: 'instagram',
            success: false,
            message: 'Instagram credentials missing',
            error: 'INSTAGRAM_BUSINESS_ACCOUNT_ID or FACEBOOK_PAGE_ACCESS_TOKEN not configured'
          });
          continue;
        }

        const igResult = await publishToInstagram(igAccountId, igAccessToken, {
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
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// GET endpoint for quick browser test
export async function GET() {
  return NextResponse.json({
    message: 'Test endpoint ready. Use POST to publish.',
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
      chatId: channelsConfig.telegram?.chat_id || 'not configured',
      channelName: channelsConfig.telegram?.channel_name || 'not configured'
    }
  });
}
