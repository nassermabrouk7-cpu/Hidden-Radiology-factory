import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const hooksTemplates = [
  'لو بتتلخبط في {TITLE}... ده هيخلصك! 🚨',
  '90% من الدكاترة بيغلطوا في النقطة دي - {TITLE}',
  'السر اللي محدش بيقوله عن {TITLE}',
  'حالة شفتها امبارح هتغير تفكيرك في {TITLE}'
]

async function sendTelegram(text: string) {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN
    const chatId = process.env.TELEGRAM_CHAT_ID
    if (!token || !chatId) return 'telegram not configured'
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' })
    })
    return 'telegram sent ✅'
  } catch (e: any) { return `telegram error: ${e.message}` }
}

async function postToFacebook(message: string) {
  try {
    const token = process.env.FB_PAGE_ACCESS_TOKEN
    const pageId = process.env.FB_PAGE_ID
    if (!token || !pageId) return 'facebook not configured - حط التوكن'
    const res = await fetch(`https://graph.facebook.com/${pageId}/feed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, access_token: token })
    })
    const data = await res.json()
    return data.id ? `facebook posted ✅ ${data.id}` : `fb error: ${JSON.stringify(data)}`
  } catch (e: any) { return `fb error: ${e.message}` }
}

async function createStripeCheckout(title: string, price: number, productId: string) {
  try {
    const stripeKey = process.env.STRIPE_SECRET_KEY
    if (!stripeKey) return { url: `https://hidden-radiology.com/checkout?book=${productId}`, status: 'stripe not configured' }
    const Stripe = (await import('stripe')).default
    const stripe = new Stripe(stripeKey)
    const session = await stripe.checkout.sessions.create({
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: { name: title },
          unit_amount: Math.round(price * 100)
        },
        quantity: 1
      }],
      mode: 'payment',
      success_url: `${process.env.NEXT_PUBLIC_DOMAIN || 'https://hidden-radiology-project-chi.vercel.app'}/success?book=${productId}`,
      cancel_url: `${process.env.NEXT_PUBLIC_DOMAIN || 'https://hidden-radiology-project-chi.vercel.app'}/cancel`,
      metadata: { book_id: productId, title: title }
    })
    return { url: session.url, status: `stripe $${price} checkout created ✅` }
  } catch (e: any) { return { url: null, status: `stripe error: ${e.message}` } }
}

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

    const { url: checkoutUrl, status: stripeStatus } = await createStripeCheckout(displayTitle, randomProduct.price, randomProduct.id)
    
    const campaignText = `🚀 حملة جديدة!\n\n📚 ${displayTitle}\n💡 ${randomHook}\n💰 السعر الحقيقي: $${randomProduct.price} (بدل $${originalPrice} - ${discount}% OFF)\n🔗 ${checkoutUrl || ''}\n📂 ${randomProduct.category}`
    
    const [telegramStatus, fbStatus] = await Promise.all([
      sendTelegram(campaignText),
      postToFacebook(`${randomHook}\n\n📚 ${displayTitle} - $${randomProduct.price} بدل $${originalPrice}\n\n${checkoutUrl || 'https://hidden-radiology.com'}\n\n#اشعة #radiology #${randomProduct.category}`)
    ])

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
      campaign: { book: displayTitle, price: randomProduct.price, original: originalPrice, discount: `${discount}% OFF`, checkout: checkoutUrl },
      integrations: { supabase: error ? error.message : 'saved ✅ بالسعر الحقيقي', telegram: telegramStatus, facebook: fbStatus, stripe: stripeStatus }
    })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}
export async function POST(){ return GET() }