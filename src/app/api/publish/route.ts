import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { isCronBearerAuthorized } from '@/lib/marketing-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || cronSecret.length < 32) {
    return NextResponse.json({ error: 'Service is not configured' }, { status: 503 });
  }

  if (!isCronBearerAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({
    success: true,
    factory: 'Hidden Radiology - مصنع الإنتاج التلقائي',
    marketingCron: 'Daily at 06:00 UTC',
    supabaseConfigured: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
  }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: NextRequest) { return GET(request); }
