"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCart } from "@/context/CartContext";
import { useLanguage } from "@/context/LanguageContext";
import { CreditCard, Smartphone, Wallet, Shield, CheckCircle, Loader2, Copy, MessageCircle, AlertCircle } from "lucide-react";

export default function CheckoutPage() {
  const router = useRouter();
  const { items, totalPrice, clearCart } = useCart();
  const { lang } = useLanguage();
  const isRTL = lang === "ar";

  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("instapay");
  const [formData, setFormData] = useState({ name: "", email: "", phone: "" });
  const [orderCreated, setOrderCreated] = useState(false);
  const [referenceId, setReferenceId] = useState("");
  const [orderTotal, setOrderTotal] = useState(0);
  const [emailError, setEmailError] = useState("");

  useEffect(() => {
    if (items.length === 0 && !orderCreated) router.push("/library");
  }, [items, router, orderCreated]);

  const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleEmailChange = (email: string) => {
    setFormData({...formData, email});
    setEmailError(email && !validateEmail(email) ? (isRTL ? "بريد غير صالح" : "Invalid email") : "");
  };

  const paymentOptions = [
    { id: "instapay", name: isRTL ? "إنستا باي" : "Instapay", number: "01002293344", icon: Smartphone, color: "bg-purple-600" },
    { id: "vodafone", name: isRTL ? "فودافون كاش + فوري" : "Vodafone Cash & Fawry", number: "01002293344", icon: Smartphone, color: "bg-red-600" },
    { id: "etisalat", name: isRTL ? "اتصالات كاش" : "Etisalat Cash", number: "01115440838", icon: Smartphone, color: "bg-green-600" },
    { id: "paypal", name: "PayPal", number: "paypal.me/NasserMabrouk", icon: CreditCard, color: "bg-blue-600" },
  ];

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert(isRTL ? "تم النسخ!" : "Copied!");
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateEmail(formData.email)) {
      setEmailError(isRTL ? "يرجى إدخال بريد صحيح" : "Please enter valid email");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/orders/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: formData.name,
          customerEmail: formData.email,
          customerPhone: formData.phone,
          items: items,
          paymentMethod: paymentMethod,
          language: lang
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "فشل إنشاء الطلب");
      }

      const createdOrder: { referenceId?: string; totalAmount?: number } = await response.json();
      if (!createdOrder.referenceId || typeof createdOrder.totalAmount !== "number") {
        throw new Error(isRTL ? "استجابة غير صالحة من الخادم" : "Invalid server response");
      }
      setReferenceId(createdOrder.referenceId);
      setOrderTotal(createdOrder.totalAmount);
      setOrderCreated(true);
      clearCart();
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : (isRTL ? "حدث خطأ" : "Error occurred"));
    } finally {
      setLoading(false);
    }
  };

  if (orderCreated) {
    const selectedMethod = paymentOptions.find(p => p.id === paymentMethod);
    const whatsappMessage = isRTL 
      ? `مرحباً، أرغب في تأكيد طلبي رقم ${referenceId}\nالمبلغ: $${orderTotal.toFixed(2)}\nوسيلة الدفع: ${selectedMethod?.name}`
      : `Hello, I want to confirm order ${referenceId}\nAmount: $${orderTotal.toFixed(2)}\nPayment: ${selectedMethod?.name}`;

    return (
      <div dir={isRTL ? "rtl" : "ltr"} className="min-h-screen bg-[#0A192F] text-white font-sans flex items-center justify-center p-4">
        <div className="bg-[#112240] p-6 md:p-8 rounded-2xl border border-[#00E5FF]/30 text-center max-w-lg w-full space-y-6">
          <div className="w-20 h-20 mx-auto bg-green-500/20 rounded-full flex items-center justify-center">
            <CheckCircle className="w-10 h-10 text-green-400" />
          </div>
          <h2 className="text-2xl font-bold">{isRTL ? "تم استلام طلبك!" : "Order Received!"}</h2>
          <p className="text-[#8892B0]">{isRTL ? "رقم الطلب:" : "Order:"} <span className="text-[#00E5FF] font-bold text-xl">{referenceId}</span></p>
          
          <div className="bg-[#0A192F] p-4 rounded-xl border border-[#8892B0]/20 space-y-3">
            <h3 className="font-bold text-sm flex items-center gap-2 text-yellow-400">
              <Wallet className="w-4 h-4" />
              {isRTL ? "الخطوة الأخيرة:" : "Final Step:"}
            </h3>
            <p className="text-sm text-[#8892B0]">
              {paymentMethod === "paypal" 
                ? (isRTL ? "أكمل الدفع عبر PayPal ثم أرسل الإيصال" : "Complete PayPal payment then send receipt")
                : (isRTL ? `حول لـ ${selectedMethod?.number} وأرسل الصورة` : `Transfer to ${selectedMethod?.number} and send screenshot`)
              }
            </p>
          </div>

          {paymentMethod === "paypal" && (
            <a
              href={`https://paypal.me/NasserMabrouk/${orderTotal.toFixed(2)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full rounded-xl bg-blue-600 py-4 font-bold text-white"
            >
              {isRTL ? `الدفع عبر PayPal — $${orderTotal.toFixed(2)}` : `Pay with PayPal — $${orderTotal.toFixed(2)}`}
            </a>
          )}

          <Link
            href={`/order/${encodeURIComponent(referenceId)}?method=${encodeURIComponent(paymentMethod)}&lang=${lang}`}
            className="block text-sm text-[#00E5FF] underline"
          >
            {isRTL ? "متابعة حالة الطلب والتنزيل بعد التأكيد" : "Track your order and download after confirmation"}
          </Link>

          <a 
            href={`https://wa.me/201115440838?text=${encodeURIComponent(whatsappMessage)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-4 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition-all flex items-center justify-center gap-2"
          >
            <MessageCircle className="w-5 h-5" />
            {isRTL ? "إرسال عبر واتساب" : "Send via WhatsApp"}
          </a>
          
          <button onClick={() => router.push("/library")} className="text-[#8892B0] hover:text-white text-sm underline">
            {isRTL ? "العودة للمكتبة" : "Back to Library"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div dir={isRTL ? "rtl" : "ltr"} className="min-h-screen bg-[#0A192F] text-white font-sans py-8 md:py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-6 md:mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#00E5FF]/10 border border-[#00E5FF]/30 text-[#00E5FF] text-sm mb-4">
            <Shield className="w-4 h-4" />
            <span>{isRTL ? "دفع آمن - 4 وسائل" : "4 Payment Methods"}</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold mb-2">{isRTL ? "إتمام الشراء" : "Checkout"}</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
          <div className="bg-[#112240] p-4 md:p-6 rounded-2xl border border-[#8892B0]/20 h-fit">
            <h2 className="text-lg md:text-xl font-bold mb-4">{isRTL ? "ملخص الطلب" : "Order Summary"}</h2>
            <div className="space-y-3 mb-6 max-h-64 overflow-y-auto">
              {items.map((item) => (
                <div key={item.id} className="flex gap-3 bg-[#0A192F] p-3 rounded-lg">
                  <img src={item.cover_url} alt={isRTL ? item.title_ar : item.title_en} className="w-16 h-20 object-cover rounded flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-sm line-clamp-2">{isRTL ? item.title_ar : item.title_en}</h3>
                    <p className="text-[#00E5FF] font-bold mt-1">${item.price} × {item.quantity}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-[#8892B0]/20 pt-4 flex items-center justify-between">
              <span className="text-lg font-bold">{isRTL ? "الإجمالي" : "Total"}</span>
              <span className="text-2xl font-black text-[#00E5FF]">${totalPrice.toFixed(2)}</span>
            </div>
          </div>

          <div className="bg-[#112240] p-4 md:p-6 rounded-2xl border border-[#8892B0]/20">
            <h2 className="text-lg md:text-xl font-bold mb-4">{isRTL ? "وسيلة الدفع" : "Payment Method"}</h2>
            <form onSubmit={handleCheckout} className="space-y-4">
              <div className="space-y-2 md:space-y-3">
                {paymentOptions.map((option) => {
                  const Icon = option.icon;
                  return (
                    <label key={option.id} className={`flex items-center gap-3 p-3 md:p-4 rounded-xl border-2 cursor-pointer transition-all ${paymentMethod === option.id ? "border-[#00E5FF] bg-[#00E5FF]/10" : "border-[#8892B0]/20 hover:border-[#8892B0]/50"}`}>
                      <input type="radio" name="payment" value={option.id} checked={paymentMethod === option.id} onChange={(e) => setPaymentMethod(e.target.value)} className="hidden" />
                      <div className={`w-10 h-10 rounded-lg ${option.color} flex items-center justify-center text-white flex-shrink-0`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm">{option.name}</p>
                        <p className="text-xs text-[#8892B0] truncate">{option.number}</p>
                      </div>
                      {paymentMethod === option.id && <CheckCircle className="w-5 h-5 text-[#00E5FF] flex-shrink-0" />}
                    </label>
                  );
                })}
              </div>

              <div className="space-y-3 pt-4 border-t border-[#8892B0]/20">
                <input type="text" required value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} placeholder={isRTL ? "الاسم الكامل" : "Full Name"} className="w-full bg-[#0A192F] border border-[#8892B0]/30 rounded-lg p-3 text-white focus:border-[#00E5FF] outline-none" />
                <div>
                  <input type="email" required value={formData.email} onChange={(e) => handleEmailChange(e.target.value)} placeholder={isRTL ? "البريد الإلكتروني" : "Email Address"} className={`w-full bg-[#0A192F] border rounded-lg p-3 text-white focus:border-[#00E5FF] outline-none ${emailError ? "border-red-500" : "border-[#8892B0]/30"}`} />
                  {emailError && <p className="text-red-500 text-xs mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{emailError}</p>}
                </div>
                <input type="tel" required value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} placeholder={isRTL ? "رقم الهاتف" : "Phone Number"} className="w-full bg-[#0A192F] border border-[#8892B0]/30 rounded-lg p-3 text-white focus:border-[#00E5FF] outline-none" />
              </div>

              {(paymentMethod === "instapay" || paymentMethod === "vodafone" || paymentMethod === "etisalat") && (
                <div className="bg-[#0A192F] p-4 rounded-xl border border-[#8892B0]/20 space-y-2">
                  <p className="text-sm text-[#8892B0]">{isRTL ? "رقم التحويل:" : "Transfer to:"}</p>
                  <div className="flex items-center justify-between bg-[#112240] p-3 rounded-lg">
                    <span className="text-lg md:text-xl font-bold text-[#00E5FF] font-mono">
                      {paymentOptions.find(p => p.id === paymentMethod)?.number}
                    </span>
                    <button type="button" onClick={() => copyToClipboard(paymentOptions.find(p => p.id === paymentMethod)?.number || "")} className="p-2 hover:bg-[#00E5FF]/20 rounded-lg text-[#00E5FF]">
                      <Copy className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )}

              <button type="submit" disabled={loading || !!emailError} className="w-full bg-[#00E5FF] text-[#0A192F] font-bold py-4 rounded-xl hover:bg-[#00b8cc] transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-6">
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                {loading ? (isRTL ? "جاري..." : "Processing...") : (isRTL ? "تأكيد الطلب" : "Confirm Order")}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
