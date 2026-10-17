import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const books = [
  { id: 'emergency', name: 'أشعة الطوارئ', price: 18.99, stripe: 'price_emergency' },
  { id: 'chest', name: 'أشعة الصدر', price: 16.99, stripe: 'price_chest' },
  { id: 'brain', name: 'أشعة المخ', price: 19.99, stripe: 'price_brain' }
]

const hooks = [
  'لو بتتلخبط في Emergency... ده هيخلصك!',
  '90% من الدكاترة بيغلطوا في النقطة دي!',
  'حالة طوارئ شفتها امبارح - هتغير تفكيرك!',
  'السر اللي محدش بيقوله عن أشعة الصدر'
]

export async function GET() {
  try {
    const randomBook = books[Math.floor(Math.random() * books.length)]
    const randomHook = hooks[Math.floor(Math.random() * hooks.length)]
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    let supabaseStatus = 'not configured'
    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey)
      const { error } = await supabase.from('campaigns').insert({
        book_id: randomBook.id,
        hook: randomHook,
        price: randomBook.price,
        status: 'generated',
        created_at: new Date().toISOString()
      })
      supabaseStatus = error ? `error: ${error.message}` : 'saved to DB ✅'
    }

    return NextResponse.json({
      success: true,
      message: '🚀 حملة تلقائية اتعملت!',
      time: new Date().toISOString(),
      campaign: {
        book: randomBook.name,
        hook: randomHook,
        price: randomBook.price,
        checkout: `https://hidden-radiology.com/checkout?book=${randomBook.id}`
      },
      supabase: supabaseStatus,
      next_runs: '9am & 6pm Cairo time (via vercel.json crons)'
    })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}

export async function POST() { return GET() }