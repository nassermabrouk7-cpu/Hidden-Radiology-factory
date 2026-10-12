"use client";
import {useState,useEffect} from "react";
export default function Maestro(){
 const [runs,setRuns]=useState([]);
 useEffect(()=>{fetch("/api/maestro/runs").then(r=>r.json()).then(d=>setRuns(d.runs||[])).catch(()=>{});},[]);
 return (
  <div style={{padding:24,fontFamily:"system-ui",maxWidth:800,margin:"0 auto"}} dir="rtl">
   <h1 style={{fontSize:28,fontWeight:900}}>🏭 مايسترو المصنع</h1>
   <p>الرابط: https://hidden-radiology-project-chi.vercel.app</p>
   <button onClick={async()=>{
     const topic=prompt("اكتب موضوع الكتاب:","Chest X-Ray Mastery");
     if(!topic)return;
     const res=await fetch("/api/maestro/run?topic="+encodeURIComponent(topic));
     const json=await res.json();
     alert(JSON.stringify(json,null,2));
     location.reload();
   }} style={{background:"black",color:"white",padding:"14px 28px",borderRadius:12,fontWeight:800,marginTop:16,cursor:"pointer"}}>🚀 شغل المصنع الآن</button>
   <div style={{marginTop:24}}>
    {runs.length===0?<div style={{border:"2px dashed #ccc",padding:24,textAlign:"center",borderRadius:12}}>لسه مفيش تشغيلات</div>:runs.map((r:any)=><div key={r.id} style={{border:"1px solid #eee",padding:16,borderRadius:12,marginBottom:12,background:"white"}}><b>{r.topic}</b><br/><span style={{background:r.status==="completed"?"#dcfce7":r.status==="failed"?"#fee2e2":"#fef9c3",padding:"2px 8px",borderRadius:999,fontSize:12}}>{r.status} - {r.stage}</span><br/><small>{new Date(r.created_at).toLocaleString("ar-EG")}</small></div>)}
   </div>
  </div>
 )
}
