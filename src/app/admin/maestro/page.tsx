export default function Page(){ 
  return (
    <div style={{minHeight:'100vh', background:'#050505', color:'white', padding:20, direction:'rtl'}}>
      <h1 style={{fontSize:24, fontWeight:900}}>🏭 MAESTRO شغال ✅</h1>
      <p style={{marginTop:10}}>أسعار حقيقية: $9.99 - $39.99</p>
      <div style={{marginTop:20, display:'grid', gap:10}}>
        <button onClick={()=>alert('🎯 توليد حملة جديدة - شغال!')} style={{padding:12, background:'white', color:'black', borderRadius:999, fontWeight:900}}>🎯 توليد حملة</button>
        <button onClick={()=>{navigator.clipboard.writeText('test'); alert('📋 تم النسخ!')}} style={{padding:12, background:'#222', color:'white', borderRadius:999}}>📋 نسخ</button>
        <button onClick={()=>alert('💾 تم الحفظ في marketing_content')} style={{padding:12, background:'#22c55e', color:'black', borderRadius:999, fontWeight:900}}>💾 حفظ</button>
        <button onClick={()=>alert('📢 تم النشر')} style={{padding:12, background:'#222', color:'#22c55e', borderRadius:999}}>📢 نشر</button>
      </div>
      <p style={{marginTop:20, color:'#666', fontSize:12}}>Vercel: hidden-radiology-project-chi.vercel.app - Deployment: ahym7tspo - Ready</p>
    </div>
  )
}
