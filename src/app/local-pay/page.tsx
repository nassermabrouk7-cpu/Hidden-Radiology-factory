"use client";

import { useState } from "react";
import {
  Copy,
  CheckCircle,
  MessageCircle,
  CreditCard,
  Smartphone,
  Shield,
  ArrowLeft,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";

export default function LocalPayPage() {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const paymentMethods = [
    {
      id: "vodafone",
      title: "Vodafone Cash & Fawry",
      subtitle: "فودافون كاش وفوري",
      number: "01002293344",
      color: "from-red-500 to-red-700",
      icon: Smartphone,
      badge: "FAST • VERIFIED",
    },
    {
      id: "etisalat",
      title: "Etisalat Cash",
      subtitle: "اتصالات كاش",
      number: "01115440838",
      color: "from-green-500 to-green-700",
      icon: Smartphone,
      badge: "SECURE • INSTANT",
    },
    {
      id: "instapay",
      title: "InstaPay",
      subtitle: "إنستاباي",
      number: "01002293344",
      color: "from-purple-500 to-purple-700",
      icon: CreditCard,
      badge: "BANK TRANSFER",
    },
    {
      id: "paypal",
      title: "PayPal",
      subtitle: "باي بال (دولي)",
      number: "paypal.me/NasserMabrouk",
      color: "from-blue-500 to-blue-700",
      icon: CreditCard,
      badge: "INTERNATIONAL",
      isLink: true,
      link: "https://paypal.me/NasserMabrouk",
    },
  ];

  return (
    <div className="min-h-screen bg-dark font-cairo text-light">
      {/* Header */}
      <div className="border-b border-neon/20 bg-darker/50 backdrop-blur-sm">
        <div className="mx-auto max-w-6xl px-6 py-4">
          <div className="flex items-center justify-between">
            <Link
              href="/"
              className="flex items-center gap-2 text-silver transition hover:text-neon"
            >
              <ArrowLeft className="h-5 w-5" />
              <span>العودة للرئيسية</span>
            </Link>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-neon" />
              <span className="text-sm text-silver">SECURE PAYMENTS • 24/7 SUPPORT</span>
            </div>
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <div className="mx-auto max-w-6xl px-6 py-12 text-center">
        <div className="mb-4 inline-block rounded-full border border-neon/30 bg-neon/10 px-4 py-1 text-sm text-neon">
          MEDICAL PUBLISHING PLATFORM
        </div>
        <h1 className="mb-3 text-5xl font-bold text-light">
          UNIFIED <span className="text-neon">PAYMENT</span>
        </h1>
        <p className="mb-8 text-lg text-silver">
          اختر وسيلة الدفع المناسبة لك • جميع الطرق آمنة ومضمونة
        </p>

        {/* WhatsApp CTA */}
        <a
          href="https://wa.me/201115440838?text=مرحباً،%20أرغب%20في%20شراء%20كتاب%20من%20Hidden%20Radiology"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-full bg-green-600 px-6 py-3 font-bold text-white transition hover:bg-green-700"
        >
          <MessageCircle className="h-5 w-5" />
          <span>تواصل معنا عبر واتساب</span>
        </a>
      </div>

      {/* Payment Methods Grid */}
      <div className="mx-auto max-w-6xl px-6 pb-16">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {paymentMethods.map((method) => {
            const Icon = method.icon;
            const isCopied = copiedId === method.id;

            return (
              <div
                key={method.id}
                className="group relative overflow-hidden rounded-2xl border border-silver/20 bg-darker p-6 transition-all hover:border-neon/50 hover:shadow-[0_0_30px_rgba(0,229,255,0.15)]"
              >
                {/* Gradient Accent */}
                <div
                  className={`absolute top-0 left-0 h-1 w-full bg-gradient-to-r ${method.color}`}
                />

                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br ${method.color}`}
                    >
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-light">
                        {method.title}
                      </h3>
                      <p className="text-sm text-silver">{method.subtitle}</p>
                    </div>
                  </div>
                  <span className="rounded-full border border-neon/30 bg-neon/10 px-3 py-1 text-xs font-bold text-neon">
                    {method.badge}
                  </span>
                </div>

                {/* Number / Link */}
                <div className="mt-6 rounded-lg border border-silver/20 bg-dark p-4">
                  {method.isLink ? (
                    <a
                      href={method.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between text-xl font-bold text-neon transition hover:text-neon/80"
                    >
                      <span>{method.number}</span>
                      <ExternalLink className="h-5 w-5" />
                    </a>
                  ) : (
                    <div className="flex items-center justify-between">
                      <span className="text-2xl font-bold tracking-wider text-neon">
                        {method.number}
                      </span>
                      <button
                        onClick={() => copyToClipboard(method.number, method.id)}
                        className="flex items-center gap-2 rounded-lg border border-silver/30 bg-dark px-4 py-2 text-sm text-silver transition hover:border-neon hover:text-neon"
                      >
                        {isCopied ? (
                          <>
                            <CheckCircle className="h-4 w-4 text-green-400" />
                            <span className="text-green-400">تم النسخ</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-4 w-4" />
                            <span>نسخ</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {/* Instructions */}
                <div className="mt-4 space-y-1 text-xs text-silver/70">
                  {method.id === "vodafone" && (
                    <p>• يمكن الدفع عبر فودافون كاش أو أي فرع فوري</p>
                  )}
                  {method.id === "etisalat" && (
                    <p>• متاح أيضاً عبر اتصالات كاش</p>
                  )}
                  {method.id === "instapay" && (
                    <p>• تحويل بنكي فوري عبر تطبيق إنستاباي</p>
                  )}
                  {method.id === "paypal" && (
                    <p>• للدفع الدولي بالبطاقات البنكية</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* WhatsApp Confirmation Card */}
        <div className="mt-8 rounded-2xl border border-green-500/30 bg-green-500/5 p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-600">
              <MessageCircle className="h-8 w-8 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="mb-1 text-xl font-bold text-light">
                بعد التحويل، أرسل إثبات الدفع عبر واتساب
              </h3>
              <p className="mb-3 text-sm text-silver">
                سيتم إرسال الكتاب إليك فوراً خلال دقائق
              </p>
              <a
                href="https://wa.me/201115440838?text=مرحباً،%20قمت%20بتحويل%20مبلغ%20الكتاب،%20مرفق%20إثبات%20التحويل"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-6 py-2 font-bold text-white transition hover:bg-green-700"
              >
                <MessageCircle className="h-5 w-5" />
                <span>إرسال إثبات التحويل</span>
              </a>
            </div>
          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-12 text-center text-sm text-silver/60">
          <p>
            📧 للدعم الفني:{" "}
            <span className="text-neon">HiddenRadiology.com</span>
          </p>
          <p className="mt-2">
            🔒 جميع المعاملات آمنة ومحمية • تسليم فوري للكتب
          </p>
        </div>
      </div>
    </div>
  );
}