'use client';
import { useState, useEffect } from 'react';

export default function MaestroAdminPage() {
  const [lastRun, setLastRun] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const runFactory = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/cron?key=HRF2026_SECRET');
      const data = await res.json();
      setLastRun(data);
    } catch(e) { alert('فشل'); }
    setLoading(false);
  };

  useEffect(() => { runFactory(); }, []);

  return (
    <div className="min-h-screen bg-[#050505] text-white p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold">🎛️ MAESTRO - مصنع Hidden Radiology</h1>
        <p className="text-gray-500 mt-2">يمنع تكرار 36 كتاب موجود - يعمل تلقائيا 7 صباحا بتوقيت القاهرة</p>

        <div className="grid grid-cols-3 gap-4 mt-8">
          <div className="bg-[#111] border border-[#222] p-6 rounded-2xl">
            <div className="text-2xl">📚</div>
            <div className="text-xl font-bold mt-2">36 كتاب</div>
            <div className="text-xs text-gray-500">موجود - ممنوع التكرار</div>
            <div className="mt-3 text- text-yellow-500">⚠️ المصنع يفحص العناوين قبل التوليد</div>
          </div>
          <div className="bg-[#111] border border-green-900 p-6 rounded-2xl">
            <div className="text-2xl">✅</div>
            <div className="text-xl font-bold mt-2">{lastRun?.gates?.medical?.score || '--'}% طبي</div>
            <div className="text-xs text-gray-500">{lastRun?.gates?.quality?.score || '--'}% جودة</div>
          </div>
          <div className="bg-[#111] border border-blue-900 p-6 rounded-2xl">
            <div className="text-2xl">⏰</div>
            <div className="text-xl font-bold mt-2">05:00 UTC</div>
            <div className="text-xs text-gray-500">7 صباحا مصر - يوميا</div>
          </div>
        </div>

        <div className="mt-8 bg-[#111] border border-[#222] rounded-2xl p-6">
          <div className="flex justify-between items-center">
            <h2 className="font-bold">آخر إنتاج</h2>
            <button onClick={runFactory} disabled={loading} className="bg-white text-black px-4 py-2 rounded-lg text-xs font-bold">
              {loading? 'جاري...' : '▶️ شغل الآن'}
            </button>
          </div>
          {lastRun && (
            <div className="mt-4 bg-black p-4 rounded-xl font-mono text-xs">
              <div>📖 {lastRun.idea?.titleAr} - {lastRun.idea?.titleEn}</div>
              <div className="mt-2 flex gap-2">
                <span className={`px-2 py-1 rounded ${lastRun.gates?.medical?.passed? 'bg-green-950 text-green-400' : 'bg-red-950 text-red-400'}`}>
                  طبي {lastRun.gates?.medical?.score}%
                </span>
                <span className={`px-2 py-1 rounded ${lastRun.gates?.quality?.passed? 'bg-green-950 text-green-400' : 'bg-red-950 text-red-400'}`}>
                  جودة {lastRun.gates?.quality?.score}%
                </span>
                <span className="px-2 py-1 rounded bg-[#222]">{lastRun.draft_length} حرف</span>
              </div>
              <div className="mt-3 text-gray-500">{lastRun.cairo_time}</div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                <button className="bg-green-600 py-2 rounded-lg">✅ نشر</button>
                <button className="bg-[#222] py-2 rounded-lg">👁️ معاينة {lastRun.draft_preview?.substring(0,50)}...</button>
                <button className="bg-red-900 py-2 rounded-lg">❌ رفض</button>
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 bg-yellow-950/20 border border-yellow-900/30 p-4 rounded-xl text-xs">
          <b className="text-yellow-400">منطق منع التكرار المضاف:</b><br/>
          <code className="text-gray-400">
            1. المصنع يجلب 36 عنوان من /api/products<br/>
            2. قبل التوليد: isDuplicate(newTitle)? skip : generate<br/>
            3. لو مكرر، يولد فكرة جديدة برقم عشوائي<br/>
            4. الهدف الحالي: دعاية للكتب الموجودة عبر marketing_content
          </code>
        </div>
      </div>
    </div>
  );
}