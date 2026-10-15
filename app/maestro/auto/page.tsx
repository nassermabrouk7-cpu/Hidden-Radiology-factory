export default function AutoPage(){
  return (
    <div style={{padding:40, background:'black', color:'white', minHeight:'100vh', direction:'rtl'}}>
      <h1>🤖 المصنع التلقائي - شغال ✅</h1>
      <div style={{marginTop:20, padding:20, background:'#0a0a0a', borderRadius:16, border:'1px solid #222'}}>
        <p>⏰ يشتغل تلقائيا:</p>
        <p>• 9:00 صباحا</p>
        <p>• 6:00 مساء</p>
        <p style={{marginTop:20, color:'#22c55e'}}>✅ كل يوم هينزل إعلان جديد تلقائي</p>
        <p style={{marginTop:10, fontSize:12, color:'#888'}}>API: /api/auto-post</p>
        <button onClick={()=>fetch('/api/auto-post').then(r=>r.json()).then(d=>alert('تم: '+JSON.stringify(d.campaign).slice(0,200)))} style={{marginTop:20, padding:'12px 20px', background:'#22c55e', color:'black', borderRadius:999, fontWeight:900}}>🧪 جرب النشر الآن</button>
      </div>
      <div style={{marginTop:20, padding:20, background:'#08101e', borderRadius:16}}>
        <p style={{fontSize:12}}>للتجربة افتح:</p>
        <code style={{fontSize:11}}>https://hidden-radiology-project-chi.vercel.app/api/auto-post</code>
      </div>
    </div>
  )
}
