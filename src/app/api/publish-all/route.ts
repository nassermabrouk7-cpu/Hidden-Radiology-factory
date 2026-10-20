import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import channelsConfig from '@/channels.config.json';
import { publishToFacebook } from '@/lib/channels/facebook';
import { publishToInstagram } from '@/lib/channels/instagram';
import { publishToThreads } from '@/lib/channels/threads';
import { publishToLinkedIn } from '@/lib/channels/linkedin';

interface PublishRequest {
  bookId: string;
  campaignType: string;
  imageUrl: string;
  price: number;
  description_ar: string;
  description_en: string;
  title_ar: string;
  title_en: string;
  auto?: boolean;
}

interface PublishResult {
  channel: string;
  success: boolean;
  message: string;
  externalId?: string;
  error?: string;
  note?: string;
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
    // Step 1: Send photo
    const photoResponse = await fetch(
      `https://api.telegram.org/bot${botToken}/sendPhoto`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          photo: imageUrl,
          caption: caption.substring(0, 1024), // Telegram limit
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

// Supabase campaign logger (optional - skip if schema mismatch)
async function logToSupabase(
  data: PublishRequest,
  results: PublishResult[]
): Promise<PublishResult> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Try to log, but don't fail if schema doesn't match
    const { error } = await supabase.from('marketing_campaigns').insert({
      name: `${data.title_en || data.title_ar || 'Campaign'} - ${data.campaignType}`,
      objective: 'sales',
      audience: 'general',
      positioning: 'educational',
      product_id: data.bookId,
      status: 'published',
      metadata: {
        results: results,
        imageUrl: data.imageUrl,
        price: data.price,
        description_ar: data.description_ar,
        description_en: data.description_en,
        campaign_type: data.campaignType,
        channels_published: results.map(r => r.channel).join(',')
      }
    });

    if (error) {
      return {
        channel: 'supabase',
        success: false,
        message: 'Campaign logging skipped (schema mismatch)',
        error: error.message
      };
    }

    return {
      channel: 'supabase',
      success: true,
      message: 'Campaign logged successfully'
    };
  } catch (error) {
    return {
      channel: 'supabase',
      success: false,
      message: 'Campaign logging skipped',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function handlePublish(request: NextRequest, body: PublishRequest) {
  try {
    const autoMode = request.nextUrl.searchParams.get('auto') === 'true';

    // Auto mode: Select random book not published in last 7 days
    if (autoMode) {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      // Get products
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('*')
        .limit(50);

      if (productsError || !products || products.length === 0) {
        return NextResponse.json(
          { success: false, error: 'No products found' },
          { status: 404 }
        );
      }

      // Check recently published products (last 7 days)
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: recentCampaigns } = await supabase
        .from('marketing_campaigns')
        .select('product_id')
        .gte('created_at', sevenDaysAgo);

      const recentProductIds = new Set(
        recentCampaigns?.map(c => c.product_id) || []
      );

      // Filter out recently published
      const availableProducts = products.filter(
        p => !recentProductIds.has(p.id)
      );

      if (availableProducts.length === 0) {
        return NextResponse.json(
          { success: false, error: 'All products published in last 7 days' },
          { status: 400 }
        );
      }

      // Select random product
      const randomProduct = availableProducts[
        Math.floor(Math.random() * availableProducts.length)
      ];

      // Override body with selected product data
      body.bookId = randomProduct.id;
      body.imageUrl = randomProduct.cover_url;
      body.price = randomProduct.price;
      body.title_ar = randomProduct.title_ar;
      body.title_en = randomProduct.title_en;
      body.description_ar = randomProduct.description_ar || `مرجع متخصص في ${randomProduct.category}`;
      body.description_en = randomProduct.description_en || `Specialized reference in ${randomProduct.category}`;
      body.campaignType = 'auto_daily';
    }

    // Validate required fields
    if (!body.bookId || !body.imageUrl || !body.price) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: bookId, imageUrl, price' },
        { status: 400 }
      );
    }

    const results: PublishResult[] = [];
    const buyUrl = `${channelsConfig.website.base_url}/library?book=${encodeURIComponent(body.bookId)}`;
    const skippedChannels: string[] = [];

    // Telegram
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (channelsConfig.telegram.enabled && botToken && channelsConfig.telegram.chat_id) {
      const caption = body.description_ar || body.description_en || '';
      const telegramResult = await publishToTelegram(
        botToken,
        channelsConfig.telegram.chat_id,
        body.imageUrl,
        caption,
        buyUrl
      );
      results.push(telegramResult);
    } else if (!channelsConfig.telegram.enabled) {
      skippedChannels.push('telegram');
    } else {
      results.push({
        channel: 'telegram',
        success: false,
        message: 'Telegram publish skipped because required configuration is missing',
        error: 'TELEGRAM_BOT_TOKEN or telegram chat_id is missing',
      });
    }

    // Disabled networks are reported as skipped; they are never counted as successes.
    for (const channel of ['facebook', 'instagram', 'threads', 'linkedin'] as const) {
      if (channelsConfig[channel]?.enabled) {
        // Real publishers with try/catch for each channel
        try {
          if (channel === 'facebook') {
            const fbPageId = process.env[channelsConfig.facebook.page_id_env];
            const fbAccessToken = process.env[channelsConfig.facebook.access_token_env];
            
            if (fbPageId && fbAccessToken) {
              const fbResult = await publishToFacebook(fbPageId, fbAccessToken, {
                message: `${body.title_en || body.title_ar}\n\n${body.description_en || body.description_ar}\n\n${buyUrl}`,
                link: buyUrl,
                image_url: body.imageUrl,
              });
              results.push({
                channel: 'facebook',
                success: fbResult.success,
                message: fbResult.success ? 'Facebook post published' : 'Facebook publishing failed',
                externalId: fbResult.postId,
                error: fbResult.error,
              });
            } else {
              results.push({
                channel: 'facebook',
                success: false,
                message: 'Facebook credentials missing',
                error: 'FACEBOOK_PAGE_ID or FACEBOOK_PAGE_ACCESS_TOKEN not configured',
              });
            }
          } else if (channel === 'instagram') {
            let igAccountId = process.env[channelsConfig.instagram.business_account_id_env];
            const igAccessToken = process.env[channelsConfig.instagram.access_token_env];
            
            // Fallback: Instagram Business Account is often the same as Facebook Page ID
            if (!igAccountId && channelsConfig.facebook?.page_id_env) {
              igAccountId = process.env[channelsConfig.facebook.page_id_env];
            }
            
            if (igAccountId && igAccessToken) {
              const igResult = await publishToInstagram(igAccountId, igAccessToken, {
                imageUrl: body.imageUrl,
                caption: `${body.title_en || body.title_ar}\n\n${body.description_en || body.description_ar}\n\n${buyUrl}`,
              });
              results.push({
                channel: 'instagram',
                success: igResult.success,
                message: igResult.success ? 'Instagram post published' : 'Instagram publishing failed',
                externalId: igResult.postId,
                error: igResult.error,
              });
            } else {
              results.push({
                channel: 'instagram',
                success: false,
                message: 'Instagram credentials missing',
                error: 'INSTAGRAM_BUSINESS_ACCOUNT_ID or INSTAGRAM_ACCESS_TOKEN not configured',
              });
            }
          } else if (channel === 'threads') {
            const threadsUserId = process.env[channelsConfig.threads.user_id_env];
            const threadsAccessToken = process.env[channelsConfig.threads.access_token_env];
            
            if (threadsUserId && threadsAccessToken) {
              const threadsResult = await publishToThreads(threadsUserId, threadsAccessToken, {
                text: `${body.title_en || body.title_ar}\n\n${body.description_en || body.description_ar}\n\n${buyUrl}`,
                mediaUrl: body.imageUrl,
              });
              results.push({
                channel: 'threads',
                success: threadsResult.success,
                message: threadsResult.success ? 'Threads post published' : 'Threads publishing failed',
                externalId: threadsResult.postId,
                error: threadsResult.error,
              });
            } else {
              results.push({
                channel: 'threads',
                success: false,
                message: 'Threads credentials missing',
                error: 'THREADS_USER_ID or THREADS_ACCESS_TOKEN not configured',
              });
            }
          } else if (channel === 'linkedin') {
            const linkedinOrgId = process.env[channelsConfig.linkedin.organization_id_env];
            const linkedinAccessToken = process.env[channelsConfig.linkedin.access_token_env];
            
            if (linkedinOrgId && linkedinAccessToken) {
              const linkedinResult = await publishToLinkedIn(linkedinOrgId, linkedinAccessToken, {
                text: `${body.title_en || body.title_ar}\n\n${body.description_en || body.description_ar}\n\n${buyUrl}`,
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
                channel: 'linkedin',
                success: false,
                message: 'LinkedIn credentials missing',
                error: 'LINKEDIN_ORGANIZATION_ID or LINKEDIN_ACCESS_TOKEN not configured',
              });
            }
          }
        } catch (error) {
          results.push({
            channel,
            success: false,
            message: `${channel} publishing failed`,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      } else {
        skippedChannels.push(channel);
      }
    }

    // Supabase logging
    if (channelsConfig.supabase?.enabled) {
      const supabaseResult = await logToSupabase(body, results);
      results.push(supabaseResult);
    }

    // Count successes
    const channelResults = results.filter(r => r.channel !== 'supabase');
    const successCount = channelResults.filter(r => r.success).length;
    const failureCount = channelResults.filter(r => !r.success).length;

    return NextResponse.json({
      success: successCount > 0 && channelResults.every(r => r.success),
      message: `Published to ${successCount}/${channelResults.length} enabled channels`,
      results,
      skippedChannels,
      storefront: channelsConfig.website.enabled ? buyUrl : null,
      summary: {
        total: channelResults.length,
        succeeded: successCount,
        failed: failureCount,
        skipped: skippedChannels.length,
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

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  return handlePublish(request, {} as PublishRequest);
}

export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    return await handlePublish(request, await request.json());
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON request body' },
      { status: 400 }
    );
  }
}
