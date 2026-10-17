import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const hooksTemplates = [
  'لو بتتلخبط في {TITLE}... ده هيخلصك! 🚨',
  '90% من الدكاترة بيغلطوا في النقطة دي - {TITLE}',
  'السر اللي محدش بيقوله عن {TITLE}',
  'حالة شفتها امبارح هتغير تفكيرك في {TITLE}',
  '{TITLE} - الشرح اللي كنت بتدور عليه'
]

export async function GET() {
  try {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const { data: products } = await supabase.from('products').select('id, title_ar, title_en, price, category, cover_url').eq('is_active', true)
    if (!products || products.length === 0) return NextResponse.json({ success: false, error: 'No products' }, { status: 500 })
    
    const randomProduct = products[Math.floor(Math.random() * products.length)]
    const hookTemplate = hooksTemplates[Math.floor(Math.random() * hooksTemplates.length)]
    const displayTitle = randomProduct.title_ar || randomProduct.title_en
    const randomHook = hookTemplate.replace('{TITLE}', displayTitle)
    const originalPrice = Math.round(randomProduct.price * 1.8 * 100) / 100
    const discount = Math.round(((originalPrice - randomProduct.price) / originalPrice) * 100)

    const { error } = await supabase.from('campaigns').insert({
      book_id: randomProduct.id,
      hook: randomHook,
      price: randomProduct.price,
      original_price: originalPrice,
      discount: discount,
      status: 'generated'
    })

    return NextResponse.json({
      success: true,
      message: `🚀 ${displayTitle}`,
      campaign: { book: displayTitle, hook: randomHook, price: randomProduct.price, original_price: originalPrice, discount: `${discount}% OFF` },
      supabase: error ? error.message : 'saved ✅ بالسعر الحقيقي من products'
    })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}
export async function POST(){ return GET() }