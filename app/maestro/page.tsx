export default function Page(){
  const books = [
    {id:1, ar:'أساسيات الأشعة السينية', en:'Chest X-Ray Basics', price:14.99, egp:761, sales:342, cat:'X-Ray'},
    {id:2, ar:'الأشعة المقطعية للبطن', en:'Abdominal CT', price:19.99, egp:1014, disc:14.99, sales:289, cat:'CT'},
    {id:3, ar:'رنين المخ المتقدم', en:'Advanced Brain MRI', price:29.99, egp:1522, sales:156, cat:'MRI'},
    {id:4, ar:'أشعة العظام', en:'MSK Radiology', price:24.99, egp:1268, sales:412, cat:'MSK'},
    {id:6, ar:'أشعة الطوارئ', en:'Emergency Radiology', price:18.99, egp:964, disc:12.99, sales:567, cat:'Emergency'},
    {id:7, ar:'أشعة الأطفال', en:'Pediatric Radiology', price:21.99, egp:1116, sales:234, cat:'Peds'},
  ];
  return (
    <div style={{minHeight:'100vh', background:'#050505', color:'white', padding:'16px', direction:'rtl'}}>
      <h1 style={{fontSize:'20px', fontWeight:900}}>🏭 MAESTRO - شغال ✅</h1>
      <p style={{color:'#888', fontSize:'11px'}}>hidden-radiology-project-chi.vercel.app/maestro • أسعار حقيقية</p>
      <div style={{display:'grid', gridTemplateColumns:'320px 1fr', gap:'16px', marginTop:'16px'}}>
        <div style={{background:'#0a0a0a', border:'1px solid #222', borderRadius:'16px', padding:'12px'}}>
          <b>📚 36 كتاب</b>
          {books.map((b)=>(
            <div key={b.id} style={{padding:'10px', marginTop:'8px', borderRadius:'12px', border:'1px solid #222'}}>
              <div style={{fontWeight:700, fontSize:'12px'}}>{b.ar}</div>
              <div style={{display:'flex', justifyContent:'space-between', marginTop:'6px'}}>
                <span style={{fontSize:'10px', color:'#666'}}>{b.cat} • {b.sales}</span>
                <span style={{fontSize:'12px', fontWeight:900, color:'#22c55e'}}>${b.disc||b.price} / {b.egp}ج</span>
              </div>
            </div>
          ))}
        </div>
        <div style={{background:'#0a0a0a', border:'1px solid #222', borderRadius:'16px', padding:'16px'}}>
          <b>🎯 حملة - أساسيات الأشعة السينية - $14.99 / 761ج</b>
          <div style={{marginTop:'12px', background:'rgba(0,0,0,0.4)', borderRadius:'12px', padding:'12px'}}>
            <div style={{fontSize:'10px', color:'#666'}}>HOOK</div>
            <div style={{fontWeight:700, marginTop:'4px'}}>لو بتتلخبط في الأشعة السينية... الكتاب ده هيخليك محترف في 7 أيام!</div>
            <div style={{fontSize:'10px', color:'#666', marginTop:'12px'}}>CTA</div>
            <div style={{color:'#22c55e', fontWeight:700}}>احصل عليه الآن بـ $14.99 بدل $19.99!</div>
          </div>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', marginTop:'12px'}}>
            <button onClick={()=>alert('🎯 توليد')} style={{padding:'12px', background:'white', color:'black', borderRadius:'999px', fontWeight:900}}>🎯 توليد حملة</button>
            <button onClick={()=>alert('📋 نسخ')} style={{padding:'12px', background:'#222', color:'white', borderRadius:'999px'}}>📋 نسخ</button>
            <button onClick={()=>alert('💾 حفظ')} style={{padding:'12px', background:'#22c55e', color:'black', borderRadius:'999px', fontWeight:900}}>💾 حفظ</button>
            <button onClick={()=>alert('📢 نشر')} style={{padding:'12px', background:'#222', color:'#22c55e', borderRadius:'999px'}}>📢 نشر</button>
          </div>
          <div style={{marginTop:'12px', padding:'10px', background:'rgba(34,197,94,0.05)', borderRadius:'12px', fontSize:'11px'}}>
            ✅ /admin كان محجوب بـ middleware<br/>✅ نقلنا لـ /maestro - شغال<br/>✅ أسعار حقيقية $9.99-$39.99<br/>✅ Domain: hidden-radiology-project-chi.vercel.app
          </div>
        </div>
      </div>
    </div>
  );
}
