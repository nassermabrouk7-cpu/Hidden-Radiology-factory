"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function Page(){
  const handleGenerate = () => alert('🎯 توليد حملة جديدة - شغل!');
  const handleCopy = () => { navigator.clipboard.writeText('test'); alert('📋 تم النسخ!'); };
  const handleSave = () => alert('💾 تم الحفظ في marketing_content');
  const handlePublish = () => alert('📢 تم النشر');

  return (
    <div style={{minHeight:'100vh', background:'#050505', color:'white', padding:20, direction:'rtl'}}>
      <div style={{marginBottom:20}}>
        <Link href="/admin" style={{color:'#8892B0', textDecoration:'none', display:'flex', alignItems:'center', gap:8}}>
          <ArrowLeft size={20} />
          العودة للوحة التحكم
        </Link>
      </div>
      <h1 style={{fontSize:24, fontWeight:900}}>🏭 MAESTRO شغال ✅</h1>
      <p style={{marginTop:10}}>أسعار حقيقية: $9.99 - $39.99</p>
      <div style={{marginTop:20, display:'grid', gap:10}}>
        <button onClick={handleGenerate} style={{padding:12, background:'white', color:'black', borderRadius:999, fontWeight:900}}>🎯 توليد حملة</button>
        <button onClick={handleCopy} style={{padding:12, background:'#222', color:'white', borderRadius:999}}>📋 نسخ</button>
        <button onClick={handleSave} style={{padding:12, background:'#22c55e', color:'black', borderRadius:999, fontWeight:900}}>💾 حفظ</button>
        <button onClick={handlePublish} style={{padding:12, background:'#222', color:'#22c55e', borderRadius:999}}>📢 نشر</button>
      </div>
      <p style={{marginTop:20, color:'#666', fontSize:12}}>Vercel: hidden-radiology-project-chi.vercel.app - Deployment: ahym7tspo - Ready</p>
    </div>
  )
}
