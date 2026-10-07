"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

type Language = "ar" | "en";

interface LanguageContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: Record<string, string>;
}

const translations = {
  ar: {
    nav_home: "الرئيسية",
    nav_library: "المكتبة",
    nav_about: "من نحن",
    nav_contact: "تواصل معنا",
    hero_badge: "خبرة تتجاوز 30 عاماً في مجال الأشعة",
    hero_title: "منصتك الشاملة للمراجع الطبية في الأشعة",
    hero_subtitle: "اكتشف مكتبة ضخمة تضم مراجع متخصصة (عربي وإنجليزي)، مصممة لطلاب العلم، فنيي الأشعة، والأطباء، لضمان أعلى معايير الجودة والسلامة.",
    btn_library: "تصفح المكتبة الآن",
    btn_contact: "تواصل معنا",
    stat_books: "كتاباً مرجعياً",
    stat_languages: "لغة (عربي / إنجليزي)",
    stat_experience: "عاماً من الخبرة",
    library_title: "مكتبة Hidden Radiology",
    library_subtitle: "مراجع متخصصة في الأشعة",
    no_products: "لا توجد منتجات",
    loading: "جاري التحميل...",
    buy: "شراء",
    footer_text: "جميع الحقوق محفوظة © 2026 Hidden Radiology",
  },
  en: {
    nav_home: "Home",
    nav_library: "Library",
    nav_about: "About",
    nav_contact: "Contact",
    hero_badge: "Over 30 Years of Radiology Excellence",
    hero_title: "Your Comprehensive Radiology Medical Reference",
    hero_subtitle: "Discover a massive library of specialized books (Arabic & English), designed for students, technicians, and physicians to ensure the highest quality and safety standards.",
    btn_library: "Browse Library Now",
    btn_contact: "Contact Us",
    stat_books: "Reference Books",
    stat_languages: "Languages (AR / EN)",
    stat_experience: "Years of Experience",
    library_title: "Hidden Radiology Library",
    library_subtitle: "Specialized Radiology References",
    no_products: "No products found",
    loading: "Loading...",
    buy: "Buy Now",
    footer_text: "All rights reserved © 2026 Hidden Radiology",
  }
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Language>("ar");

  useEffect(() => {
    const saved = localStorage.getItem("hr_lang") as Language;
    if (saved && (saved === "ar" || saved === "en")) {
      // Hydrate browser storage after mount to keep server and client markup aligned.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLang(saved);
    }
  }, []);

  const changeLang = (newLang: Language) => {
    setLang(newLang);
    localStorage.setItem("hr_lang", newLang);
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang: changeLang, t: translations[lang] }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used within LanguageProvider");
  return context;
}
