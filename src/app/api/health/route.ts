import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    factory: 'Hidden Radiology Factory Running',
    maestro: 'active',
    stages: ['idea','outline','writing','artwork','medical_review','quality_gate','human_approval','publishing','done'],
    time: new Date().toISOString(),
    cairo_time: new Date().toLocaleString('en-US', { timeZone: 'Africa/Cairo' }),
  });
}
