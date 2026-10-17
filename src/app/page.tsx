import { createClient } from '@supabase/supabase-js'

const bookNames: any = {
  emergency: '🚨 أشعة الطوارئ',
  chest: '🫁 أشعة الصدر',
  brain: '🧠 أشعة المخ'
}

export default async function Page(){
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data } = await supabase.from('campaigns').select('*').order('created_at', {ascending: false}).limit(50)
  
  return (
    <div style={{minHeight:'100vh', background:'#020617', color:'white', fontFamily:'Cairo, Arial', direction:'rtl'}}>
      <div style={{maxWidth:1100, margin:'0 auto', padding:24}}>
        <div style={{display:'flex', alignItems:'center', gap:16, marginBottom:32, borderBottom:'1px solid #1e293b', paddingBottom:24}}>
          <img src="/logos/hr-icon.png" alt="HR" style={{width:64, height:64, borderRadius:16}} onError={(e:any)=>e.target.style.display='none'} />
          <div>
            <h1 style={{margin:0, fontSize:28}}>Hidden Radiology</h1>
            <p style={{margin:0, color:'#38bdf8'}}>الأشعة الخفية - See Beyond The Image</p>
          </div>
          <div style={{marginRight:'auto', display:'flex', gap:8}}>
            <span style={{background:'#16a34a', padding:'6px 14px', borderRadius:20, fontSize:14}}>✅ شغال</span>
            <span style={{background:'#0f172a', border:'1px solid #1e293b', padding:'6px 14px', borderRadius:20, fontSize:14}}>{data?.length || 0} حملة</span>
          </div>
        </div>
        
        <div style={{background:'#0f172a', borderRadius:16, overflow:'hidden', border:'1px solid #1e293b'}}>
          <table style={{width:'100%', borderCollapse:'collapse'}}>
            <thead><tr style={{background:'#1e293b', textAlign:'right'}}><th style={{padding:16}}>وقت</th><th>كتاب</th><th>Hook</th><th>سعر</th></tr></thead>
            <tbody>
              {data?.map((c:any)=> (
                <tr key={c.id} style={{borderTop:'1px solid #1e293b'}}>
                  <td style={{padding:16}}>{new Date(c.created_at).toLocaleString('ar-EG')}</td>
                  <td>{bookNames[c.book_id] || c.book_id}</td>
                  <td>{c.hook}</td>
                  <td style={{color:'#22c55e', fontWeight:'bold'}}>${c.price}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{marginTop:24, display:'flex', gap:12}}>
          <a href="/api/auto-post" style={{background:'#0ea5e9', padding:'14px 28px', color:'white', borderRadius:12, textDecoration:'none', fontWeight:'bold'}}>▶️ شغل حملة حالاً</a>
        </div>

        <div style={{marginTop:40, textAlign:'center', opacity:0.6}}>
          <img src="/logos/logo-ar.png" alt="Hidden Radiology" style={{width:220}} onError={(e:any)=>e.target.style.display='none'} />
          <p style={{fontSize:12, marginTop:12}}>Hidden Radiology © 2026</p>
        </div>
      </div>
    </div>
  )
}