"use client";

import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import { useLanguage } from "@/context/LanguageContext";
import { useCart } from "@/context/CartContext";
import { ShoppingCart, Check } from "lucide-react";

type Product = {
  id: string;
  title_ar: string;
  title_en: string;
  category: string;
  price: number;
  cover_url: string;
  language: string;
};

export default function LibraryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const { lang, t } = useLanguage();
  const { addToCart, items } = useCart();
  
  const currentLang = lang || "ar";
  const isRTL = currentLang === "ar";

  useEffect(() => {
    async function fetchProducts() {
      setLoading(true);
      setLoadError(false);
      try {
        const response = await fetch("/api/products", { cache: "no-store" });
        if (!response.ok) throw new Error("Product catalog request failed");
        const result: { products?: Product[] } = await response.json();
        setProducts(Array.isArray(result.products) ? result.products : []);
      } catch (error) {
        console.error("خطأ في جلب المنتجات:", error);
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    }
    fetchProducts();
  }, []);

  const filteredProducts = products.filter(p => 
    p.language && p.language.toLowerCase().trim() === currentLang.toLowerCase().trim()
  );

  const handleAddToCart = (product: Product) => {
    addToCart({
      id: product.id,
      title_ar: product.title_ar,
      title_en: product.title_en,
      price: product.price,
      cover_url: product.cover_url,
      language: product.language,
    });
    setAddedIds(prev => new Set(prev).add(product.id));
    setTimeout(() => {
      setAddedIds(prev => {
        const next = new Set(prev);
        next.delete(product.id);
        return next;
      });
    }, 1500);
  };

  const isInCart = (id: string) => items.some(item => item.id === id);

  return (
    <div dir={isRTL ? "rtl" : "ltr"} className="min-h-screen bg-[#0A192F] text-white font-sans">
      <Navbar />
      <div className="text-center py-12 px-6">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">{t.library_title || (isRTL ? 'مكتبة Hidden Radiology' : 'Hidden Radiology Library')}</h1>
        <p className="text-gray-400 text-lg">{t.library_subtitle || (isRTL ? 'مراجع متخصصة في الأشعة' : 'Specialized Radiology References')}</p>
      </div>

      <div className="max-w-7xl mx-auto px-6 pb-20">
        {loading ? (
          <div className="text-center py-20 text-gray-400 text-xl">{t.loading || "جاري التحميل..."}</div>
        ) : loadError ? (
          <div className="text-center py-20 text-gray-400 text-xl">
            {isRTL ? "تعذر تحميل المنتجات. حاول تحديث الصفحة." : "Could not load products. Please refresh the page."}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-20 text-gray-400 text-xl">{t.no_products || "لا توجد منتجات"}</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProducts.map((product) => {
              const isAdded = addedIds.has(product.id);
              const inCart = isInCart(product.id);
              return (
                <div key={product.id} className="bg-[#112240] rounded-lg overflow-hidden hover:shadow-2xl hover:shadow-[#00E5FF]/10 transition-all group border border-[#1a2f4a]">
                  <div className="relative h-80 bg-[#0A192F] overflow-hidden">
                    <img
                      src={product.cover_url}
                      alt={currentLang === "ar" ? product.title_ar : product.title_en}
                      className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='600'%3E%3Crect fill='%23112240' width='400' height='600'/%3E%3Ctext fill='%2300E5FF' font-family='sans-serif' font-size='24' font-weight='bold' x='50%25' y='50%25' text-anchor='middle'%3EHidden%3C/text%3E%3Ctext fill='%238892B0' font-family='sans-serif' font-size='18' x='50%25' y='50%25' text-anchor='middle' dy='2.5em'%3ERadiology%3C/text%3E%3C/svg%3E";
                      }}
                    />
                  </div>
                  <div className="p-5">
                    <div className="text-xs text-[#00E5FF] font-semibold mb-2 uppercase tracking-wider">
                      {product.category}
                    </div>
                    <h3 className="font-bold text-lg mb-4 line-clamp-2 leading-snug">
                      {currentLang === "ar" ? product.title_ar : product.title_en}
                    </h3>
                    <div className="flex items-center justify-between pt-4 border-t border-[#1a2f4a]">
                      <span className="text-2xl font-bold text-[#00E5FF]">${product.price}</span>
                      
                      <button
                        onClick={() => handleAddToCart(product)}
                        disabled={isAdded}
                        className={`px-4 py-2.5 rounded-lg font-bold text-sm transition-all flex items-center gap-2 ${isAdded ? "bg-green-500 text-white" : inCart ? "bg-[#00E5FF]/20 text-[#00E5FF] border border-[#00E5FF]/30" : "bg-[#00E5FF] text-[#0A192F] hover:bg-[#00b8cc] shadow-lg shadow-[#00E5FF]/20"}`}
                      >
                        {isAdded ? (
                          <><Check className="w-4 h-4" />{currentLang === "ar" ? "تمت الإضافة" : "Added"}</>
                        ) : inCart ? (
                          <><ShoppingCart className="w-4 h-4" />{currentLang === "ar" ? "في السلة" : "In Cart"}</>
                        ) : (
                          <><ShoppingCart className="w-4 h-4" />{currentLang === "ar" ? "أضف للسلة" : "Add to Cart"}</>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
