"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Loader2, RefreshCw, ShieldCheck } from "lucide-react";

type OrderStatus = {
  referenceId: string;
  status: string;
  totalAmount: number;
  downloads: Array<{ title: string; url: string }>;
};

export default function OrderStatusPage() {
  const params = useParams<{ referenceId: string }>();
  const searchParams = useSearchParams();
  const referenceId = params.referenceId;
  const language = searchParams.get("lang") === "en" ? "en" : "ar";
  const isArabic = language === "ar";
  const [order, setOrder] = useState<OrderStatus | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`/api/orders/status?ref=${encodeURIComponent(referenceId)}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "تعذر تحميل حالة الطلب");
      setOrder(result.order);
      setError("");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "تعذر تحميل حالة الطلب");
    } finally {
      setLoading(false);
    }
  }, [referenceId]);

  useEffect(() => {
    const initialTimer = window.setTimeout(() => void refresh(), 0);
    const timer = window.setInterval(() => void refresh(), 15_000);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(timer);
    };
  }, [refresh]);

  const confirmed = order?.status === "confirmed";

  return (
    <main dir={isArabic ? "rtl" : "ltr"} className="flex min-h-screen items-center justify-center bg-[#0A192F] px-4 py-12 text-white">
      <section className="w-full max-w-xl space-y-6 rounded-2xl border border-[#00E5FF]/30 bg-[#112240] p-6 text-center md:p-8">
        <ShieldCheck className="mx-auto h-12 w-12 text-[#00E5FF]" />
        <h1 className="text-2xl font-bold">{isArabic ? "حالة الطلب" : "Order status"}</h1>
        <p className="text-[#8892B0]">{isArabic ? "رقم الطلب" : "Order reference"}: <span dir="ltr" className="break-all font-mono text-[#00E5FF]">{referenceId}</span></p>

        {loading ? (
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#00E5FF]" />
        ) : error ? (
          <p role="alert" className="text-red-300">{error}</p>
        ) : confirmed ? (
          <div className="space-y-4">
            <p className="font-semibold text-green-300">{isArabic ? "تم التحقق من الدفع. ملفاتك جاهزة." : "Payment verified. Your files are ready."}</p>
            {order.downloads.map((download) => (
              <a key={download.url} href={download.url} className="block rounded-xl bg-[#00E5FF] px-5 py-4 font-bold text-[#0A192F]" rel="noreferrer">
                {isArabic ? "تنزيل" : "Download"} — {download.title}
              </a>
            ))}
            <p className="text-xs text-[#8892B0]">{isArabic ? "روابط التنزيل صالحة لمدة 24 ساعة. أعد تحميل هذه الصفحة لإنشاء روابط جديدة." : "Download links expire in 24 hours. Reload this page to create fresh links."}</p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-yellow-200">{isArabic ? "طلبك بانتظار مراجعة إثبات الدفع من الإدارة." : "Your order is waiting for payment verification."}</p>
            {order && <p className="text-sm text-[#8892B0]">{isArabic ? "الإجمالي" : "Total"}: ${Number(order.totalAmount).toFixed(2)}</p>}
            <p className="text-xs text-[#8892B0]">{isArabic ? "تتحدث الحالة تلقائياً كل 15 ثانية." : "This page refreshes automatically every 15 seconds."}</p>
          </div>
        )}

        <button onClick={() => { setLoading(true); void refresh(); }} className="inline-flex items-center gap-2 text-sm text-[#00E5FF] underline">
          <RefreshCw className="h-4 w-4" /> {isArabic ? "تحديث الحالة الآن" : "Refresh status now"}
        </button>
      </section>
    </main>
  );
}
