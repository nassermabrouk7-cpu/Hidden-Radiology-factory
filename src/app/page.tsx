import { createClient } from '@supabase/supabase-js'
export default async function Page(){
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { data } = await supabase.from('campaigns').select('*').order('created_at', {ascending: false}).limit(20)
  return (
    <div style={{padding:20, fontFamily:'Arial'}}>
      <h1>📊 مصنع الحملات التلقائي</h1>
      <p>✅ شغال كل يوم 9am و 6pm</p>
      <table border={1} cellPadding={10} style={{width:'100%'}}>
        <tr><th>وقت</th><th>كتاب</th><th>Hook</th><th>سعر</th></tr>
        {data?.map((c:any)=> <tr key={c.id}><td>{new Date(c.created_at).toLocaleString('ar-EG')}</td><td>{c.book_id}</td><td>{c.hook}</td><td>${c.price}</td></tr>)}
      </table>
    </div>
  )
}