import { NextResponse } from 'next/server';
export async function GET(){
  return NextResponse.json({
    success: true,
    message: '✅ المصنع التلقائي شغال!',
    time: new Date().toISOString(),
    campaign: {
      book: 'أشعة الطوارئ',
      hook: 'لو بتتلخبط في Emergency...',
      price: 18.99
    }
  });
}
export async function POST(){ return GET(); }
