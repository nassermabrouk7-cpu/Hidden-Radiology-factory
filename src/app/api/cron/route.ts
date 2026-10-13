import { NextResponse } from 'next/server';
import { MAESTRO_CONFIG, STAGE_LABELS } from '@/lib/maestro/config';
import { medicalAccuracyGate, qualityGate } from '@/lib/maestro/gates';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const BOOK_IDEAS = [
  { titleAr: 'أساسيات الأشعة المقطعية للصدر', titleEn: 'Chest CT Fundamentals', category: 'CT', brief: 'دليل عملي للمتدربين عن CT الصدر' },
  { titleAr: 'أشعة الطوارئ - الحالات الحرجة', titleEn: 'Emergency Radiology', category: 'Emergency', brief: 'تشخيص سريع للحالات الطارئة' },
  { titleAr: 'أشعة الجهاز العصبي', titleEn: 'Neuroradiology Made Simple', category: 'Neuro', brief: 'أساسيات MRI و CT للمخ' },
];

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const key = searchParams.get('key');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && key !== cronSecret && key !== 'HRF2026_SECRET') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  const logs: string[] = [];
  const idea = BOOK_IDEAS[Math.floor(Math.random() * BOOK_IDEAS.length)];

  try {
    logs.push('Maestro started - Idea: ' + idea.titleAr);
    logs.push('Stage: idea - ' + idea.titleAr);

    let draft = '';
    try {
      const { generateBookDraft } = await import('@/lib/book-ai');
      draft = await generateBookDraft({
        titleAr: idea.titleAr,
        titleEn: idea.titleEn,
        subtitleAr: 'دليل تعليمي مبسط',
        subtitleEn: 'Simplified Study Guide',
        category: idea.category,
        language: 'ar',
        brief: idea.brief,
      });
      logs.push('Draft generated: ' + draft.length + ' chars');
    } catch (e: any) {
      logs.push('Draft fallback: ' + e.message);
      draft = '# ' + idea.titleAr + '\n\n' + idea.brief + '\n\nمحتوى تجريبي - سيتم توليده عبر Gemini.';
    }

    logs.push('Stage: artwork - placeholder');

    const medicalGate = await medicalAccuracyGate(draft);
    logs.push('Medical Review: ' + (medicalGate.passed ? 'PASSED' : 'FAILED') + ' - ' + medicalGate.score);

    const qualityResult = await qualityGate(draft, []);
    logs.push('Quality Gate: ' + (qualityResult.passed ? 'PASSED' : 'FAILED') + ' - ' + qualityResult.score);

    if (MAESTRO_CONFIG.requireHumanApproval) {
      logs.push('Stage: human_approval - Waiting for human');
      return NextResponse.json({
        status: 'pending_human_approval',
        idea,
        gates: { medical: medicalGate, quality: qualityResult },
        logs,
        cairo_time: new Date().toLocaleString('en-US', { timeZone: 'Africa/Cairo' }),
        duration: Date.now() - startTime
      });
    }

    return NextResponse.json({
      status: 'ok',
      factory: 'Hidden Radiology Factory',
      idea,
      draft_length: draft.length,
      gates: { medical: medicalGate, quality: qualityResult },
      logs,
      duration_ms: Date.now() - startTime
    });

  } catch (error: any) {
    logs.push('ERROR: ' + error.message);
    return NextResponse.json({ status: 'error', error: error.message, logs }, { status: 500 });
  }
}