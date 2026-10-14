"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Shield, Factory, Megaphone, ShoppingCart, LogOut, Loader2 } from "lucide-react";

export default function AdminDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/session", { cache: "no-store" })
      .then((response) => response.json())
      .then((data: { authenticated?: boolean }) => {
        if (active) setIsAuthenticated(data.authenticated === true);
      })
      .catch(() => { if (active) setIsAuthenticated(false); })
      .finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, []);

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
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
      setLoading(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/admin/session", { method: "DELETE" });
    setIsAuthenticated(false);
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0A192F] text-white">
        جارٍ التحقق من جلسة الإدارة...
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0A192F] p-4 text-white">
        <form onSubmit={handleLogin} className="w-full max-w-md space-y-6 rounded-2xl border border-[#8892B0]/20 bg-[#112240] p-8 shadow-2xl">
          <div className="mb-6 flex justify-center">
            <Shield className="h-16 w-16 text-[#00E5FF]" />
          </div>
          <h1 className="mb-2 text-center text-2xl font-bold">Hidden Radiology Admin</h1>
          <p className="mb-6 text-center text-sm text-[#8892B0]">لوحة التحكم الإدارية</p>
          <input
            type="password"
            placeholder="أدخل كلمة المرور"
            className="w-full rounded border border-[#8892B0]/30 bg-[#0A192F] p-3 text-white focus:border-[#00E5FF] focus:outline-none"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-[#00E5FF] py-3 font-bold text-[#0A192F] transition hover:bg-[#00E5FF]/90 disabled:opacity-50"
          >
            {loading ? "جارٍ التحقق..." : "دخول"}
          </button>
        </form>
      </div>
    );
  }

  const sections = [
    {
      href: "/admin/factory",
      icon: Factory,
      title: "مصنع الكتب",
      description: "إنتاج الكتب تلقائياً بالذكاء الاصطناعي",
      color: "from-purple-500 to-purple-600"
    },
    {
      href: "/admin/marketing",
      icon: Megaphone,
      title: "التسويق الإعلاني",
      description: "إدارة الحملات والمحتوى الإعلاني",
      color: "from-blue-500 to-blue-600"
    },
    {
      href: "/admin/orders",
      icon: ShoppingCart,
      title: "إدارة الطلبات",
      description: "مراجعة وتأكيد طلبات العملاء",
      color: "from-green-500 to-green-600"
    },
  ];

  return (
    <div className="min-h-screen bg-[#0A192F] text-white p-6 md:p-8">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-[#00E5FF]">لوحة التحكم الإدارية</h1>
            <p className="mt-2 text-[#8892B0]">Hidden Radiology Factory</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-red-400 hover:bg-red-500/20 transition"
          >
            <LogOut className="w-4 h-4" />
            خروج
          </button>
        </div>

        {/* Dashboard Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {sections.map((section) => (
            <Link
              key={section.href}
              href={section.href}
              className="group block rounded-2xl border border-[#8892B0]/20 bg-[#112240] p-6 transition hover:border-[#00E5FF]/50 hover:shadow-2xl hover:shadow-[#00E5FF]/10"
            >
              <div className={`mb-4 inline-flex rounded-lg bg-gradient-to-r ${section.color} p-3 text-white group-hover:scale-110 transition`}>
                <section.icon className="w-8 h-8" />
              </div>
              <h2 className="mb-2 text-xl font-bold">{section.title}</h2>
              <p className="text-[#8892B0]">{section.description}</p>
            </Link>
          ))}
        </div>

        {/* Info Section */}
        <div className="mt-8 rounded-2xl border border-[#8892B0]/20 bg-[#112240] p-6">
          <h3 className="mb-4 text-lg font-bold text-[#00E5FF]">معلومات النظام</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-[#8892B0]">
            <div>
              <span className="block text-white font-medium">الإطار:</span>
              Next.js 16.3.6 + React 19
            </div>
            <div>
              <span className="block text-white font-medium">قاعدة البيانات:</span>
              Supabase
            </div>
            <div>
              <span className="block text-white font-medium">النشر:</span>
              Vercel
            </div>
            <div>
              <span className="block text-white font-medium">المصادقة:</span>
              HMAC-SHA256
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
