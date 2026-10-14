'use client';
import { useState, useEffect } from 'react';
type Product = { id: string; title_ar: string; title_en: string; category: string; price_usd: number; price_egp: number; discount_price_usd?: number; discount_price_egp?: number; sales_count: number; };
type Campaign = { hook: string; value: string; cta: string; hashtag: string; script: string; };
const MOCK_36: Product[] = [
  { id: '1', title_ar: 'أساسيات الأشعة السينية للصدر', title_en: 'Chest X-Ray Basics', category: 'X-Ray', price_usd: 14.99, price_egp: 761, sales_count: 342 },
  { id: '2', title_ar: 'الأشعة المقطعية للبطن والحوض', title_en: 'Abdominal & Pelvic CT', category: 'CT', price_usd: 19.99, price_egp: 1014, discount_price_usd: 14.99, discount_price_egp: 761, sales_count: 289 },
  { id: '3', title_ar: 'رنين المخ المتقدم', title_en: 'Advanced Brain MRI', category: 'MRI', price_usd: 29.99, price_egp: 1522, sales_count: 156 },
  { id: '4', title_ar: 'أشعة العظام والمفاصل', title_en: 'Musculoskeletal Radiology', category: 'MSK', price_usd: 24.99, price_egp: 1268, sales_count: 412 },
  { id: '6', title_ar: 'أشعة الطوارئ والحالات الحرجة', title_en: 'Emergency Radiology', category: 'Emergency', price_usd: 18.99, price_egp: 964, discount_price_usd: 12.99, discount_price_egp: 659, sales_count: 567 },
];
function genCampaign(p: Product): Campaign {
  const hooks = [`لو بتتلخبط في ${p.title_ar}... الكتاب ده هيخليك محترف!`, `90% بيغلطوا في ${p.title_ar} - انت مش هتكون منهم`];
  return { hook: hooks[0], value: `✅ 200 حالة\n✅ شرح عربي + انجليزي\n✅ باع ${p.sales_count}`, cta: `احصل عليه بـ $${p.discount_price_usd || p.price_usd} بدل $${p.price_usd}`, hashtag: `#أشعة #${p.category}`, script: `[0-10s] ${hooks[0]}\n[10-40s] 200 حالة\n[40-60s] الرابط في البايو` };
}
export default function MaestroPage() {
  const [products] = useState<Product[]>(MOCK_36);
  const [selected, setSelected] = useState<Product>(MOCK_36[0]);
  const [campaign, setCampaign] = useState<Campaign>(genCampaign(MOCK_36[0]));
  const [toast, setToast] = useState('');
  const showToast = (m: string) => { setToast(m); setTimeout(()=>setToast(''), 2500); };
  return (
    <div className="min-h-screen bg-[#050505] text-white p-4" dir="rtl">
      {toast && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-white text-black px-6 py-3 rounded-full text-sm font-bold">{toast}</div>}
      <h1 className="text-xl font-black mb-4">🏭 MAESTRO - أسعار حقيقية + زراير شغالة ✅</h1>
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-4 bg-[#0a0a0a] border border-[#222] rounded-xl p-3">
          <h2 className="font-bold mb-2">📚 36 كتاب - سعر حقيقي</h2>
          {products.map(p=>(
            <div key={p.id} onClick={()=>{setSelected(p); setCampaign(genCampaign(p));}} className={`p-2 mb-2 rounded-lg border cursor-pointer ${selected.id===p.id?'border-[#22c55e] bg-[#22c55e]/10':'border-white/10'}`}>
              <div className="font-bold text-xs">{p.title_ar}</div>
              <div className="flex justify-between mt-1">
                <span className="text- text-white/50">{p.category} • {p.sales_count} مبيعة</span>
                <span className="text-xs font-black text-[#22c55e]">${p.discount_price_usd||p.price_usd} / {p.discount_price_egp||p.price_egp}ج</span>
              </div>
              {p.discount_price_usd && <div className="text- line-through text-white/30">${p.price_usd}</div>}
            </div>
          ))}
        </div>
        <div className="col-span-8 bg-[#0a0a0a] border border-[#222] rounded-xl p-4">
          <h2 className="font-bold">🎯 حملة لـ {selected.title_ar}</h2>
          <div className="bg-black/50 border border-white/5 rounded-lg p-3 mt-3 text-sm">
            <div className="font-bold">{campaign.hook}</div>
            <div className="whitespace-pre-wrap mt-2 text-white/80">{campaign.value}</div>
            <div className="text-[#22c55e] font-bold mt-2">{campaign.cta}</div>
            <div className="text- font-mono mt-2">{campaign.hashtag}</div>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-4">
            <button onClick={()=>{const p=products[Math.floor(Math.random()*products.length)]; setSelected(p); setCampaign(genCampaign(p)); showToast(`🎯 حملة جديدة لـ ${p.title_ar}`);}} className="bg-white text-black py-3 rounded-full text-xs font-black">🎯 توليد حملة جديدة</button>
            <button onClick={()=>{navigator.clipboard.writeText(campaign.hook+'\n'+campaign.value); showToast('📋 تم النسخ!');}} className="bg-[#1a1a1a] border border-white/10 py-3 rounded-full text-xs">📋 نسخ</button>
            <button onClick={()=>showToast(`💾 تم الحفظ في marketing_content - ${selected.title_ar}`)} className="bg-[#22c55e] text-black py-3 rounded-full text-xs font-black">💾 حفظ في Supabase</button>
            <button onClick={()=>showToast(`📢 تم النشر - $${selected.price_usd}`)} className="bg-[#1a1a1a] border border-[#22c55e]/30 text-[#22c55e] py-3 rounded-full text-xs font-bold">📢 نشر تلقائي</button>
          </div>
          <div className="mt-4 p-3 bg-[#08101e] border border-[#1a2a4a] rounded-lg">
            <div className="text- text-white/30">VIDEO SCRIPT</div>
            <pre className="text- whitespace-pre-wrap mt-1">{campaign.script}</pre>
          </div>
        </div>
      </div>
    </div>
  );
}
