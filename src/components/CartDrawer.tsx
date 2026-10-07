"use client";

import { useCart } from "@/context/CartContext";
import { useLanguage } from "@/context/LanguageContext";
import { X, Plus, Minus, Trash2, ShoppingBag } from "lucide-react";
import Link from "next/link";

export default function CartDrawer() {
  const { items, removeFromCart, updateQuantity, totalPrice, isCartOpen, setIsCartOpen } = useCart();
  const { lang, t } = useLanguage();
  const isRTL = lang === "ar";

  if (!isCartOpen) return null;

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity"
        onClick={() => setIsCartOpen(false)}
      />

      <div className={`fixed top-0 ${isRTL ? 'right-0' : 'left-0'} h-full w-full max-w-md bg-[#112240] border-${isRTL ? 'l' : 'r'} border-[#00E5FF]/20 shadow-2xl z-50 flex flex-col`}>
        
        <div className="flex items-center justify-between p-6 border-b border-[#1a2f4a]">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-[#00E5FF]" />
            {lang === "ar" ? "سلة المشتريات" : "Shopping Cart"}
          </h2>
          <button 
            onClick={() => setIsCartOpen(false)}
            className="p-2 hover:bg-[#0A192F] rounded-lg transition-colors text-gray-400 hover:text-white"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {items.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <ShoppingBag className="w-16 h-16 mx-auto mb-4 opacity-20" />
              <p className="text-lg">{lang === "ar" ? "سلتك فارغة حالياً" : "Your cart is currently empty"}</p>
              <button 
                onClick={() => setIsCartOpen(false)}
                className="mt-4 text-[#00E5FF] hover:underline font-semibold"
              >
                {lang === "ar" ? "تصفح المكتبة" : "Browse the library"}
              </button>
            </div>
          ) : (
            items.map((item) => (
              <div key={item.id} className="flex gap-4 bg-[#0A192F] p-4 rounded-xl border border-[#1a2f4a]">
                <img 
                  src={item.cover_url} 
                  alt={lang === "ar" ? item.title_ar : item.title_en}
                  className="w-20 h-24 object-cover rounded-lg bg-[#112240]"
                />
                <div className="flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-sm line-clamp-2 mb-1">
                      {lang === "ar" ? item.title_ar : item.title_en}
                    </h3>
                    <p className="text-[#00E5FF] font-bold">${item.price}</p>
                  </div>
                  
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-3 bg-[#112240] rounded-lg p-1 border border-[#1a2f4a]">
                      <button 
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        className="p-1 hover:text-[#00E5FF] transition-colors"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="text-sm font-bold w-4 text-center">{item.quantity}</span>
                      <button 
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        className="p-1 hover:text-[#00E5FF] transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    <button 
                      onClick={() => removeFromCart(item.id)}
                      className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {items.length > 0 && (
          <div className="p-6 border-t border-[#1a2f4a] bg-[#0A192F]">
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-400">{lang === "ar" ? "الإجمالي" : "Total"}</span>
              <span className="text-2xl font-black text-[#00E5FF]">${totalPrice.toFixed(2)}</span>
            </div>
            <Link
              href="/checkout"
              onClick={() => setIsCartOpen(false)}
              className="w-full py-4 bg-[#00E5FF] text-[#0A192F] font-bold text-lg rounded-xl hover:bg-[#00b8cc] transition-all text-center block shadow-lg shadow-[#00E5FF]/20"
            >
              {lang === "ar" ? "إتمام الشراء والدفع" : "Proceed to Checkout"}
            </Link>
            <p className="text-xs text-center text-gray-500 mt-3 flex items-center justify-center gap-1">
              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
              {lang === "ar" ? "دفع آمن عبر Gumroad" : "Secure Payment via Gumroad"}
            </p>
          </div>
        )}
      </div>
    </>
  );
}
