"use client";

import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import { useCart } from "@/context/CartContext";
import { ShoppingCart } from "lucide-react";

export default function Navbar() {
  const { lang, setLang, t } = useLanguage();
  const { totalItems, setIsCartOpen } = useCart();
  const isRTL = lang === "ar";

  return (
    <nav dir={isRTL ? "rtl" : "ltr"} className="flex items-center justify-between px-6 py-4 border-b border-[#112240] sticky top-0 bg-[#0A192F]/95 backdrop-blur-sm z-50">
      <Link href="/" className="flex items-center gap-3">
        <div className="w-10 h-10 bg-[#00E5FF] rounded-lg flex items-center justify-center text-[#0A192F] font-bold text-xl">
          HR
        </div>
        <span className="text-xl font-bold">Hidden Radiology</span>
      </Link>

      <div className="flex items-center gap-4">
        <Link href="/library" className="text-gray-300 hover:text-[#00E5FF] transition-colors font-medium">
          {t.nav_library}
        </Link>

        {/* أيقونة السلة مع العدّاد */}
        <button
          onClick={() => setIsCartOpen(true)}
          className="relative p-2 text-gray-300 hover:text-[#00E5FF] transition-colors"
        >
          <ShoppingCart className="w-6 h-6" />
          {totalItems > 0 && (
            <span className="absolute -top-1 -right-1 bg-[#00E5FF] text-[#0A192F] text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
              {totalItems}
            </span>
          )}
        </button>

        <button
          onClick={() => setLang(lang === "ar" ? "en" : "ar")}
          className="px-5 py-2 border-2 border-[#00E5FF] text-[#00E5FF] rounded-lg hover:bg-[#00E5FF] hover:text-[#0A192F] transition-all font-bold text-sm"
        >
          {lang === "ar" ? "EN" : "AR"}
        </button>
      </div>
    </nav>
  );
}
