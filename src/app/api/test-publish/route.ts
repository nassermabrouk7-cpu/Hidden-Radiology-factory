import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import channelsConfig from '@/channels.config.json';

interface PublishRequest {
  bookId?: string;
  campaignType?: string;
  imageUrl?: string;
  price?: number;
  description_ar?: string;
  description_en?: string;
  title_ar?: string;
  title_en?: string;
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

    // Check if Telegram is configured
    if (!channelsConfig.telegram?.enabled) {
      return NextResponse.json(
        { success: false, error: 'Telegram not enabled in channels.config.json' },
        { status: 400 }
      );
    }

    if (!process.env.TELEGRAM_BOT_TOKEN) {
      return NextResponse.json(
        { success: false, error: 'TELEGRAM_BOT_TOKEN not found in environment' },
        { status: 500 }
      );
    }

    // Publish to Telegram
    const result = await publishToTelegram(
      process.env.TELEGRAM_BOT_TOKEN,
      channelsConfig.telegram.chat_id,
      imageUrl,
      caption,
      buyUrl
    );

    return NextResponse.json({
      success: result.success,
      message: result.message,
      channel: result.channel,
      externalId: result.externalId,
      error: result.error,
      testData: {
        bookId,
        imageUrl,
        price,
        title_ar,
        title_en,
        campaignType,
        chatId: channelsConfig.telegram.chat_id,
        channelName: channelsConfig.telegram.channel_name || 'Radiology Hidden'
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
        campaignType: 'string (optional)'
      },
      example: {
        bookId: 'test-book-001',
        campaignType: 'manual_test'
      }
    },
    config: {
      telegramEnabled: channelsConfig.telegram?.enabled || false,
      chatId: channelsConfig.telegram?.chat_id || 'not configured',
      channelName: channelsConfig.telegram?.channel_name || 'not configured'
    }
  });
}
