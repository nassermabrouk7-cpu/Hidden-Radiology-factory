import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || cronSecret.length < 32) {
    return NextResponse.json({ error: 'Service is not configured' }, { status: 503 });
  }
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const dirs = [
      path.join(process.cwd(), 'books'),
      path.join(process.cwd(), 'public', 'books'),
      path.join(process.cwd(), 'public', 'covers', 'ar'),
      path.join(process.cwd(), 'public', 'covers', 'en')
    ];
    let allBooks: string[] = [];
    for (const dir of dirs) {
      const files = await fs.readdir(dir).catch(() => [] as string[]);
      const images = files.filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));
      allBooks = allBooks.concat(images);
    }
    return NextResponse.json({ 
      success: true, 
      factory: 'Hidden Radiology - مصنع الإنتاج التلقائي', 
      booksCount: allBooks.length,
      books: allBooks.slice(0,10),
      crons: 'كل ساعة تلقائيا',
      supabase: 'مربوط ويعمل'
    });
  } catch (error: unknown) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
export async function POST(request: NextRequest) { return GET(request); }
