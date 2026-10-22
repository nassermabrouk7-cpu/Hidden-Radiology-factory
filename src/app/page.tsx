import { createClient } from '@supabase/supabase-js'

interface CampaignRow {
  id: string;
  book_id: string;
  created_at: string;
  hook: string;
  price: number;
}

const bookNames: Record<string, string> = {
  emergency: '🚨 أشعة الطوارئ',
  chest: '🫁 أشعة الصدر',
  brain: '🧠 أشعة المخ'
}

export default async function Page(){
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data } = await supabase.from('campaigns').select('*').order('created_at', {ascending: false}).limit(50)
  const campaigns = (data ?? []) as CampaignRow[];
  
  return (
    <div style={{minHeight:'100vh', background:'#020617', color:'white', fontFamily:'Cairo, Arial', direction:'rtl'}}>
      <div style={{maxWidth:1100, margin:'0 auto', padding:16}}>
        <div style={{display:'flex', alignItems:'center', gap:12, marginBottom:24, borderBottom:'1px solid #1e293b', paddingBottom:16, flexWrap:'wrap'}}>
          <img src="/logos/hr-icon.png" alt="HR" style={{width:48, height:48, borderRadius:12}} />
          <div style={{flex:1, minWidth:0}}>
            <h1 style={{margin:0, fontSize:20, lineHeight:1.2}}>Hidden Radiology</h1>
            <p style={{margin:0, color:'#38bdf8', fontSize:14}}>الأشعة الخفية - See Beyond The Image</p>
          </div>
          <div style={{display:'flex', gap:6, flexWrap:'wrap'}}>
            <span style={{background:'#16a34a', padding:'4px 10px', borderRadius:16, fontSize:12}}>✅ شغال</span>
              <span style={{background:'#0f172a', border:'1px solid #1e293b', padding:'4px 10px', borderRadius:16, fontSize:12}}>{campaigns.length} حملة</span>
          </div>
        </div>
        
        <div style={{background:'#0f172a', borderRadius:12, overflowX:'auto', border:'1px solid #1e293b'}}>
          <table style={{width:'100%', borderCollapse:'collapse', fontSize:14}}>
            <thead><tr style={{background:'#1e293b', textAlign:'right'}}><th style={{padding:12}}>وقت</th><th>كتاب</th><th>Hook</th><th>سعر</th></tr></thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.id} style={{borderTop:'1px solid #1e293b'}}>
                  <td style={{padding:12}}>{new Date(c.created_at).toLocaleString('ar-EG')}</td>
                  <td>{bookNames[c.book_id] || c.book_id}</td>
                  <td>{c.hook}</td>
                  <td style={{color:'#22c55e', fontWeight:'bold'}}>${c.price}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{marginTop:16, display:'flex', gap:8}}>
          <a href="/api/auto-post" style={{background:'#0ea5e9', padding:'12px 20px', color:'white', borderRadius:12, textDecoration:'none', fontWeight:'bold', fontSize:14, display:'inline-block'}}>▶️ شغل حملة حالاً</a>
        </div>

        <div style={{marginTop:32, textAlign:'center', opacity:0.6}}>
          <img src="/logos/logo-ar.png" alt="Hidden Radiology" style={{width:180, maxWidth:'100%'}} />
          <p style={{fontSize:12, marginTop:12}}>Hidden Radiology © 2026</p>
        </div>
      </div>
    </div>
  )
}
