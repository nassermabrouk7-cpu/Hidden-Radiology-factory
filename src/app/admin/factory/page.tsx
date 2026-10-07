"use client";

import { useState } from "react";
import { generateAndPublish } from "@/app/actions";
import { Loader2, Shield, CheckCircle, AlertCircle } from "lucide-react";

export default function FactoryPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; url?: string; error?: string } | null>(null);

  async function handleLogin() {
    setLoginLoading(true);
    try {
      const response = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!response.ok) throw new Error((await response.json()).error || "تعذر تسجيل الدخول");
      setPassword("");
      setIsAuthenticated(true);
    } catch (error) {
      alert(error instanceof Error ? error.message : "تعذر تسجيل الدخول");
    } finally {
      setLoginLoading(false);
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-dark p-4 font-cairo">
        <div className="w-full max-w-md rounded-lg border border-neon/20 bg-darker p-8 shadow-2xl">
          <div className="mb-6 flex justify-center">
            <Shield className="h-16 w-16 text-neon" />
          </div>
          <h1 className="mb-2 text-center text-2xl font-bold text-light">Hidden Radiology Admin</h1>
          <p className="mb-6 text-center text-sm text-silver">مصنع إنتاج الكتب التلقائي</p>
          <input
            type="password"
            placeholder="أدخل كلمة المرور"
            className="mb-4 w-full rounded border border-silver/30 bg-dark p-3 text-light focus:border-neon focus:outline-none"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void handleLogin()}
          />
          <button
            onClick={() => void handleLogin()}
            disabled={loginLoading}
            className="w-full rounded bg-neon py-3 font-bold text-dark transition hover:bg-neon/80"
          >
            دخول
          </button>
        </div>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    const formData = new FormData(e.currentTarget);
    const res = await generateAndPublish(formData);
    setResult(res);
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-dark p-8 font-cairo">
      <div className="mx-auto max-w-2xl rounded-lg border border-silver/20 bg-darker p-8 shadow-xl">
        <div className="mb-8 flex items-center gap-3">
          <Shield className="h-8 w-8 text-neon" />
          <h1 className="text-3xl font-bold text-neon">مصنع إنتاج الكتب التلقائي</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm text-silver">العنوان (عربي) *</label>
              <input name="title_ar" required className="w-full rounded border border-silver/30 bg-dark p-3 text-light focus:border-neon focus:outline-none" placeholder="مثال: دليل بروتوكولات الأشعة" />
            </div>
            <div>
              <label className="mb-2 block text-sm text-silver">العنوان (English) *</label>
              <input name="title_en" required className="w-full rounded border border-silver/30 bg-dark p-3 text-light focus:border-neon focus:outline-none" placeholder="e.g., Radiology Protocols Guide" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm text-silver">العنوان الفرعي (عربي)</label>
              <input name="subtitle_ar" className="w-full rounded border border-silver/30 bg-dark p-3 text-light focus:border-neon focus:outline-none" placeholder="أخطاء صامتة وحلول عملية" />
            </div>
            <div>
              <label className="mb-2 block text-sm text-silver">العنوان الفرعي (English)</label>
              <input name="subtitle_en" className="w-full rounded border border-silver/30 bg-dark p-3 text-light focus:border-neon focus:outline-none" placeholder="Silent Errors & Practical Solutions" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm text-silver">التصنيف</label>
              <select name="category" className="w-full rounded border border-silver/30 bg-dark p-3 text-light focus:border-neon focus:outline-none">
                <option>Quality & Safety</option>
                <option>CT</option>
                <option>MRI</option>
                <option>X-Ray</option>
                <option>Contrast</option>
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm text-silver">السعر ($)</label>
              <input name="price" type="number" step="0.01" defaultValue="9.99" className="w-full rounded border border-silver/30 bg-dark p-3 text-light focus:border-neon focus:outline-none" />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-neon py-4 font-bold text-dark transition hover:bg-neon/80 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                جاري التوليد والنشر... (قد يستغرق 15 ثانية)
              </>
            ) : (
              "⚡ Generate & Publish"
            )}
          </button>
        </form>

        {result && (
          <div className={`mt-6 rounded-lg p-4 ${result.success ? "border border-green-500/30 bg-green-500/10" : "border border-red-500/30 bg-red-500/10"}`}>
            {result.success ? (
              <div className="text-center">
                <CheckCircle className="mx-auto mb-2 h-8 w-8 text-green-400" />
                <p className="mb-2 font-bold text-green-400">✅ تم النشر بنجاح!</p>
                <a href={result.url} target="_blank" rel="noopener noreferrer" className="text-neon underline hover:text-neon/80">
                  فتح المنتج على Gumroad
                </a>
              </div>
            ) : (
              <div className="text-center">
                <AlertCircle className="mx-auto mb-2 h-8 w-8 text-red-400" />
                <p className="text-red-400">❌ فشل: {result.error}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
