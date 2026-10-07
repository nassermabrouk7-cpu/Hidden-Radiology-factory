"use client";

import Link from "next/link";
import { useState } from "react";
import { useLanguage } from "@/context/LanguageContext";
import Navbar from "@/components/Navbar";
import { CheckCircle, Download, Mail, BookOpen, Award } from "lucide-react";

export default function HomePage() {
  const { lang, t } = useLanguage();
  const isRTL = lang === "ar";
  const [email, setEmail] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleFreebieSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitted(true);
    setTimeout(() => setIsSubmitted(false), 3000);
    setEmail("");
  };

  return (
    <div dir={isRTL ? "rtl" : "ltr"} className="min-h-screen bg-[#0A192F] text-white font-sans">
      <Navbar />

      <main className="relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-[#00E5FF]/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-6xl mx-auto px-6 py-4 md:py-6 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 mb-4 text-sm font-semibold text-[#00E5FF] bg-[#00E5FF]/10 rounded-full border border-[#00E5FF]/20">
            <Award className="w-4 h-4" />
            <span>{t.hero_badge || (lang === 'ar' ? "خبرة تتجاوز 30 عاماً في مجال الأشعة" : "Over 30 Years of Radiology Excellence")}</span>
          </div>

          <h1 className="text-4xl md:text-6xl font-black leading-tight mb-4 tracking-tight">
            {lang === 'ar' ? "لا تكتفِ برؤية الأشعة.." : "Don't Just Read X-Rays.."}
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00E5FF] to-blue-500">
              {lang === 'ar' ? "افهمها بخبرة حقيقية." : "Master Them with Real Expertise."}
            </span>
          </h1>

          <p className="text-lg md:text-xl text-[#8892B0] max-w-3xl mx-auto mb-8 leading-relaxed">
            {lang === 'ar' 
              ? "منصة Hidden Radiology هي مرجعك الشامل الذي يجمع بين الدقة الأكاديمية والخبرة السريرية. مكتبة رقمية مصممة لطلاب العلم، فنيي الأشعة، والأطباء، لضمان أعلى معايير التشخيص والسلامة."
              : "Hidden Radiology is your comprehensive reference combining academic precision with clinical expertise. A digital library designed for students, technicians, and physicians."}
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Link
              href="/library"
              className="px-8 py-4 bg-[#00E5FF] text-[#0A192F] font-bold text-lg rounded-xl hover:bg-[#00b8cc] transition-all shadow-lg shadow-[#00E5FF]/20 flex items-center justify-center gap-2"
            >
              <BookOpen className="w-5 h-5" />
              {t.btn_library || (lang === 'ar' ? "تصفح المكتبة الآن" : "Browse Library Now")}
            </Link>
            <Link
              href="#free-guide"
              className="px-8 py-4 border border-[#8892B0]/30 text-[#8892B0] font-semibold text-lg rounded-xl hover:border-[#00E5FF] hover:text-[#00E5FF] transition-all flex items-center justify-center gap-2"
            >
              <Download className="w-5 h-5" />
              {lang === 'ar' ? "احصل على دليل مجاني" : "Get a Free Guide"}
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto border-t border-[#112240] pt-12">
            <div className="text-center p-4">
              <div className="text-4xl md:text-5xl font-black text-[#00E5FF] mb-2">34+</div>
              <div className="text-[#8892B0] font-medium">{t.stat_books || (lang === 'ar' ? "مرجعاً متخصصاً" : "Specialized References")}</div>
            </div>
            <div className="text-center p-4 border-x border-[#112240]">
              <div className="text-4xl md:text-5xl font-black text-[#00E5FF] mb-2">2</div>
              <div className="text-[#8892B0] font-medium">{t.stat_languages || (lang === 'ar' ? "لغة (عربي / إنجليزي)" : "Languages (AR / EN)")}</div>
            </div>
            <div className="text-center p-4">
              <div className="text-4xl md:text-5xl font-black text-[#00E5FF] mb-2">30+</div>
              <div className="text-[#8892B0] font-medium">{t.stat_experience || (lang === 'ar' ? "عاماً من الخبرة السريرية" : "Years of Clinical Experience")}</div>
            </div>
          </div>
        </div>

        <div id="free-guide" className="bg-[#112240] border-y border-[#00E5FF]/20 py-16 px-6">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#00E5FF]/10 text-[#00E5FF] mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 12 20 22 4 22 4 12" />
                <rect width="20" height="5" x="2" y="7" />
                <line x1="12" x2="12" y1="22" y2="7" />
                <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
                <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
              </svg>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              {lang === 'ar' ? "لا تخرج فارغ اليدين!" : "Don't Leave Empty-Handed!"}
            </h2>
            <p className="text-[#8892B0] mb-8 text-lg">
              {lang === 'ar' 
                ? "احصل فوراً على دليلنا المجاني: '5 خطوات ذهبية لقراءة أشعة الصدر بشكل صحيح'. أدخل بريدك الإلكتروني وسنرسله لك فوراً."
                : "Get our free guide instantly: '5 Golden Steps to Read Chest X-Rays Correctly'. Enter your email and we'll send it right away."}
            </p>

            {isSubmitted ? (
              <div className="bg-green-500/10 border border-green-500/30 text-green-400 p-4 rounded-xl flex items-center justify-center gap-2">
                <CheckCircle className="w-5 h-5" />
                <span className="font-bold">{lang === 'ar' ? "تم الإرسال بنجاح! تحقق من بريدك الوارد." : "Sent successfully! Check your inbox."}</span>
              </div>
            ) : (
              <form onSubmit={handleFreebieSubmit} className="flex flex-col sm:flex-row gap-3 max-w-lg mx-auto">
                <div className="relative flex-1">
                  <Mail className={`absolute top-1/2 -translate-y-1/2 w-5 h-5 text-[#8892B0] ${isRTL ? 'right-4' : 'left-4'}`} />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={lang === 'ar' ? "أدخل بريدك الإلكتروني" : "Enter your email address"}
                    className={`w-full ${isRTL ? 'pr-12 pl-4' : 'pl-12 pr-4'} py-4 bg-[#0A192F] border border-[#8892B0]/30 rounded-xl text-white focus:border-[#00E5FF] focus:outline-none transition-colors`}
                  />
                </div>
                <button
                  type="submit"
                  className="px-8 py-4 bg-[#00E5FF] text-[#0A192F] font-bold rounded-xl hover:bg-[#00b8cc] transition-all whitespace-nowrap flex items-center justify-center gap-2"
                >
                  <Download className="w-5 h-5" />
                  {lang === 'ar' ? "أرسل لي الدليل مجاناً" : "Send Me The Free Guide"}
                </button>
              </form>
            )}
            <p className="text-xs text-[#8892B0] mt-4 flex items-center justify-center gap-1">
              <CheckCircle className="w-3 h-3" />
              {lang === 'ar' ? "نحن نحترم خصوصيتك. لا رسائل مزعجة، فقط قيمة حقيقية." : "We respect your privacy. No spam, only real value."}
            </p>
          </div>
        </div>
      </main>

      <footer className="text-center py-8 text-[#8892B0] text-sm border-t border-[#112240]">
        {t.footer_text || (lang === 'ar' ? "جميع الحقوق محفوظة © 2026 Hidden Radiology" : "All rights reserved © 2026 Hidden Radiology")}
      </footer>
    </div>
  );
}
