"use client";

import { useState } from "react";
import { Shield, CheckCircle, Loader2, AlertCircle, LogOut } from "lucide-react";

type Order = {
  id: string;
  customer_name: string;
  customer_email: string;
  status: string;
  reference_id: string;
  payment_method: string;
  amount: number;
  created_at: string;
};

export default function AdminOrdersPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!response.ok) throw new Error((await response.json()).error || "تعذر تسجيل الدخول");
      setIsAuthenticated(true);
      setPassword("");
      await fetchOrders();
    } catch (error) {
      alert(error instanceof Error ? error.message : "تعذر تسجيل الدخول");
    } finally {
      setLoading(false);
    }
  };

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/orders/list", { cache: "no-store" });
      if (!response.ok) throw new Error("غير مصرح بعرض الطلبات");
      const data: { orders?: Order[] } = await response.json();
      if (response.ok && data.orders) {
        setOrders(data.orders);
      }
    } catch (error) {
      console.error("خطأ في جلب الطلبات:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (referenceId: string) => {
    setConfirmingId(referenceId);
    try {
      const response = await fetch("/api/orders/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referenceId })
      });

      if (response.ok) {
        const result: { emailSent?: boolean } = await response.json();
        alert(result.emailSent
          ? `تم تأكيد الطلب ${referenceId} وإرسال روابط التنزيل.`
          : `تم تأكيد الطلب ${referenceId}. يستطيع العميل التنزيل من صفحة حالة الطلب.`);
        fetchOrders(); // تحديث القائمة
      } else {
        const data: { error?: string } = await response.json();
        alert(data.error || "فشل في تأكيد الطلب.");
      }
    } catch (error) {
      console.error(error);
      alert("خطأ في الاتصال.");
    } finally {
      setConfirmingId(null);
    }
  };

  // شاشة تسجيل الدخول
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0A192F] flex items-center justify-center p-4">
        <form onSubmit={handleLogin} className="bg-[#112240] p-8 rounded-2xl border border-[#8892B0]/20 w-full max-w-md space-y-6">
          <div className="text-center">
            <Shield className="w-12 h-12 text-[#00E5FF] mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-white">لوحة تحكم الطلبات</h1>
            <p className="text-[#8892B0] text-sm mt-2">محمية - أدخل كلمة المرور للمتابعة</p>
          </div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="كلمة المرور"
            className="w-full bg-[#0A192F] border border-[#8892B0]/30 rounded-lg p-3 text-white focus:border-[#00E5FF] outline-none"
          />
          <button type="submit" className="w-full bg-[#00E5FF] text-[#0A192F] font-bold py-3 rounded-lg hover:bg-[#00E5FF]/90 transition">
            دخول
          </button>
        </form>
      </div>
    );
  }

  // لوحة التحكم
  return (
    <div className="min-h-screen bg-[#0A192F] font-cairo text-white p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">الطلبات الواردة</h1>
            <p className="text-[#8892B0] mt-1">إدارة وتأكيد مدفوعات العملاء</p>
          </div>
          <div className="flex gap-3">
            <button onClick={fetchOrders} className="px-4 py-2 bg-[#112240] border border-[#8892B0]/30 rounded-lg hover:bg-[#8892B0]/10 transition">
              🔄 تحديث
            </button>
            <button onClick={async () => { await fetch("/api/admin/session", { method: "DELETE" }); setIsAuthenticated(false); setOrders([]); }} className="px-4 py-2 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/30 transition flex items-center gap-2">
              <LogOut className="w-4 h-4" /> خروج
            </button>
          </div>
        </div>

        {/* Orders List */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-10 h-10 text-[#00E5FF] animate-spin" />
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-20 bg-[#112240] rounded-2xl border border-[#8892B0]/20">
            <AlertCircle className="w-16 h-16 text-[#8892B0] mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">لا توجد طلبات حالياً</h2>
            <p className="text-[#8892B0]">ستظهر الطلبات الجديدة هنا بمجرد قيام العملاء بإتمام عملية الشراء.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {orders.map((order) => (
              <div key={order.id} className="bg-[#112240] p-6 rounded-2xl border border-[#8892B0]/20 space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-xl font-bold text-white">{order.customer_name}</h3>
                    <p className="text-sm text-[#8892B0]">{order.customer_email}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    order.status === "confirmed" 
                      ? "bg-green-500/20 text-green-400 border border-green-500/30" 
                      : "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
                  }`}>
                    {order.status === "confirmed" ? "مؤكد" : "بانتظار التأكيد"}
                  </span>
                </div>

                <div className="bg-[#0A192F] rounded-lg p-3 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[#8892B0]">رقم الطلب:</span>
                    <span className="text-[#00E5FF] font-mono font-bold">{order.reference_id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#8892B0]">وسيلة الدفع:</span>
                    <span className="text-white capitalize">{order.payment_method}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#8892B0]">المبلغ:</span>
                    <span className="text-[#00E5FF] font-bold">${order.amount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#8892B0]">التاريخ:</span>
                    <span className="text-white">{new Date(order.created_at).toLocaleDateString('ar-EG')}</span>
                  </div>
                </div>

                {order.status === "pending_verification" && (
                  <button
                    onClick={() => handleConfirm(order.reference_id)}
                    disabled={confirmingId === order.reference_id}
                    className="w-full bg-green-600 text-white font-bold py-3 rounded-lg hover:bg-green-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {confirmingId === order.reference_id ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <CheckCircle className="w-5 h-5" />
                    )}
                    {confirmingId === order.reference_id ? "جاري التأكيد..." : "✓ تأكيد الدفع وفتح التحميل"}
                  </button>
                )}

                {order.status === "confirmed" && (
                  <div className="w-full bg-[#0A192F] border border-green-500/30 text-green-400 font-bold py-3 rounded-lg flex items-center justify-center gap-2">
                    <CheckCircle className="w-5 h-5" />
                    تم تسليم الكتاب للعميل
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
