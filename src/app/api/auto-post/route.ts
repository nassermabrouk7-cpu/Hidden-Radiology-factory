import { NextResponse } from 'next/server';

const BOOKS = [
  {id:1, ar:'أساسيات الأشعة السينية', en:'Chest X-Ray Basics', price:14.99, sales:342, cat:'X-Ray'},
  {id:2, ar:'الأشعة المقطعية للبطن', en:'Abdominal CT', price:19.99, sales:289, cat:'CT'},
  {id:3, ar:'رنين المخ المتقدم', en:'Advanced Brain MRI', price:29.99, sales:156, cat:'MRI'},
  {id:4, ar:'أشعة العظام', en:'MSK Radiology', price:24.99, sales:412, cat:'MSK'},
  {id:6, ar:'أشعة الطوارئ', en:'Emergency Radiology', price:18.99, sales:567, cat:'Emergency'},
  {id:7, ar:'أشعة الأطفال', en:'Pediatric Radiology', price:21.99, sales:234, cat:'Peds'},
];

const HOOKS = [
  "لو بتتلخبط في {cat}... الكتاب ده هيخليك محترف في 7 أيام!",
  "342 طبيب اشترو الكتاب ده - اعرف ليه!",
  "بتضيع وقت في {cat}؟ الحل في 60 ثانية!",
];

export async function GET(){
  try {
    // اختار كتاب عشوائي مش متكرر اليوم
    const today = new Date().toISOString().split('T')[0];
    const book = BOOKS[Math.floor(Math.random() * BOOKS.length)];
    const hook = HOOKS[Math.floor(Math.random() * HOOKS.length)].replace('{cat}', book.cat);

    const campaign = {
      id: `camp_${Date.now()}`,
      book_id: book.id,
      book_title: book.ar,
      book_price: book.price,
      hook: hook,
      value: `✅ ${book.sales} طبيب اشتروه\n✅ شرح عربي مبسط\n✅ حالات حقيقية`,
      cta: `احصل عليه الآن بـ $${book.price} - الرابط في البايو!`,
      created_at: new Date().toISOString(),
      date: today,
      status: 'published',
      auto: true
    };

    // هنا هنحفظ في Supabase (لو عندك)
    // await supabase.from('marketing_content').insert(campaign)

    console.log('✅ Auto Campaign:', campaign);

    return NextResponse.json({
      success: true,
      message: 'تم توليد ونشر حملة تلقائيا',
      campaign: campaign,
      next_run: '9:00 AM & 6:00 PM daily'
    });
  } catch(e){
    return NextResponse.json({success:false, error: String(e)}, {status:500});
  }
}

export async function POST(req: Request){
  return GET();
}
