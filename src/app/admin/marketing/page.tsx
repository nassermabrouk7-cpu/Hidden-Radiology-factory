"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, Shield } from "lucide-react";

type MarketingItem = {
  id: string; platform: string; language: string; content_type: string; title: string;
  hook: string; body: string; cta: string; hashtags: string[]; scheduled_at: string | null;
  status: string; error_message: string | null;
};

export default function MarketingAdminPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState("");
  const [items, setItems] = useState<MarketingItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const loadQueue = useCallback(async () => {
    setBusy(true);
    try {
      const response = await fetch("/api/marketing/queue", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "تعذر تحميل الإعلانات");
      setItems(Array.isArray(data.content) ? data.content : []);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر تحميل الإعلانات");
    } finally { setBusy(false); }
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/session", { cache: "no-store" })
      .then((response) => response.json())
      .then((data: { authenticated?: boolean }) => {
        if (!active) return;
        setAuthenticated(data.authenticated === true);
        if (data.authenticated) void loadQueue();
      })
      .catch(() => { if (active) setAuthenticated(false); })
      .finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, [loadQueue]);

  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    try {
      const response = await fetch("/api/admin/session", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "تعذر تسجيل الدخول");
      setPassword("");
      setAuthenticated(true);
      await loadQueue();
    } catch (error) { setMessage(error instanceof Error ? error.message : "تعذر تسجيل الدخول"); }
    finally { setBusy(false); }
  }

  async function approveItem(id: string) {
    setApprovingId(id);
    setMessage("");
    try {
      const response = await fetch("/api/marketing/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "تعذرت الموافقة على المحتوى");
      setItems((current) => current.map((item) => item.id === id ? { ...item, status: "approved" } : item));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذرت الموافقة على المحتوى");
    } finally {
      setApprovingId(null);
    }
  }

  if (checking) return <main className="flex min-h-screen items-center justify-center bg-[#0A192F] text-white">جارٍ التحقق من جلسة الإدارة...</main>;
  if (!authenticated) return (
    <main className="flex min-h-screen items-center justify-center bg-[#0A192F] p-4 text-white">
      <form onSubmit={login} className="w-full max-w-md space-y-5 rounded-2xl border border-white/10 bg-[#112240] p-8">
        <Shield className="mx-auto h-12 w-12 text-[#00E5FF]" />
        <h1 className="text-center text-2xl font-bold">لوحة الإعلانات التلقائية</h1>
        <input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required className="w-full rounded border border-white/20 bg-[#0A192F] p-3" placeholder="كلمة مرور الإدارة" />
        <button disabled={busy} className="w-full rounded bg-[#00E5FF] p-3 font-bold text-[#0A192F] disabled:opacity-50">{busy ? "جارٍ التحقق..." : "دخول"}</button>
        {message && <p role="alert" className="text-center text-red-300">{message}</p>}
      </form>
    </main>
  );

  return (
    <main dir="rtl" className="min-h-screen bg-[#0A192F] p-4 text-white md:p-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div><h1 className="text-3xl font-bold text-[#00E5FF]">محتوى الحملات الإعلانية</h1><p className="mt-2 text-slate-300">آخر 100 مادة إعلانية محفوظة. تبقى المنشورات معلقة حتى توافق عليها.</p></div>
          <button onClick={() => void loadQueue()} disabled={busy} className="flex items-center gap-2 rounded border border-[#00E5FF]/40 px-4 py-2 text-[#00E5FF] disabled:opacity-50">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} تحديث
          </button>
        </header>
        {message && <p role="alert" className="mb-5 rounded bg-red-500/10 p-4 text-red-300">{message}</p>}
        {items.length === 0 && !busy ? <p className="rounded-xl bg-[#112240] p-8 text-center text-slate-300">لا توجد حملات بعد. سيُنشئ التشغيل اليومي حملة عند تهيئة Gemini المجاني.</p> : null}
        <div className="space-y-4">
          {items.map((item) => (
            <article key={item.id} className="rounded-xl border border-white/10 bg-[#112240] p-5">
              <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded bg-[#00E5FF]/10 px-2 py-1 text-[#00E5FF]">{item.platform}</span>
                <span className="rounded bg-white/10 px-2 py-1">{item.language === "ar" ? "العربية" : "English"}</span>
                <span className="rounded bg-white/10 px-2 py-1">{item.status}</span>
                {item.scheduled_at && <time className="text-slate-400">{new Date(item.scheduled_at).toLocaleString(item.language === "ar" ? "ar-EG" : "en-US", { timeZone: "Africa/Cairo" })}</time>}
              </div>
              <h2 className="mb-2 text-xl font-bold">{item.title}</h2>
              <p className="mb-2 font-semibold text-[#00E5FF]">{item.hook}</p>
              <p className="whitespace-pre-wrap leading-7 text-slate-200">{item.body}</p>
              <p className="mt-3 font-semibold">{item.cta}</p>
              {item.hashtags?.length > 0 && <p className="mt-2 text-slate-400">{item.hashtags.map((tag) => tag.startsWith("#") ? tag : `#${tag}`).join(" ")}</p>}
              {item.error_message && <p className="mt-3 text-sm text-red-300">{item.error_message}</p>}
              {item.status === "queued" && <button onClick={() => void approveItem(item.id)} disabled={approvingId !== null} className="mt-4 rounded bg-[#00E5FF] px-4 py-2 font-bold text-[#0A192F] disabled:opacity-50">{approvingId === item.id ? "جارٍ الحفظ..." : "موافقة على هذا المنشور"}</button>}
              {item.status === "approved" && <p className="mt-4 text-sm font-semibold text-green-300">تمت الموافقة. لا يتم النشر الخارجي إلا إذا فُعّل صراحةً في إعدادات الخادم.</p>}
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
