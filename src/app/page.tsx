export default async function Page(){
  const res = await fetch('https://hidden-radiology-project-chi.vercel.app/api/history', { cache: 'no-store' }).catch(()=>null)
  let data = []
  if(res?.ok){ data = await res.json() }

  return (
    <div style={{padding:24, fontFamily:'Arial', background:'#0f172a', color:'white', minHeight:'100vh'}}>
      <h1>📊 مصنع الحملات التلقائي</h1>
      <p style={{color:'#22c55e'}}>✅ شغال كل يوم 9am و 6pm بتوقيت القاهرة</p>
      <p>عدد الحملات: {data.length || 0}</p>
      <table border={1} cellPadding={12} style={{width:'100%', borderCollapse:'collapse', marginTop:16}}>
        <thead><tr style={{background:'#1e293b'}}><th>وقت</th><th>كتاب</th><th>Hook</th><th>سعر</th></tr></thead>
        <tbody>
          {data.length===0 && <tr><td colSpan={4} style={{textAlign:'center', padding:20}}>⏳ جاري تحميل الحملات... لو فضلت فاضية افتح /api/auto-post مرة</td></tr>}
          {data.map((c:any)=> <tr key={c.id}><td>{new Date(c.created_at).toLocaleString('ar-EG')}</td><td>{c.book_id}</td><td>{c.hook}</td><td>${c.price}</td></tr>)}
        </tbody>
      </table>
      <div style={{marginTop:20}}>
        <a href="/api/auto-post" style={{background:'#22c55e', padding:'10px 20px', color:'white', borderRadius:8, textDecoration:'none'}}>▶️ شغل حملة حالاً</a>
      </div>
    </div>
  )
}