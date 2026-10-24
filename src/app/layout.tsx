import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import Script from "next/script";
import { LanguageProvider } from "@/context/LanguageContext";
import { CartProvider } from "@/context/CartContext";
import CartDrawer from "@/components/CartDrawer";
import "./globals.css";

// إعداد الخطوط
const cairo = localFont({
  src: [
    { path: "../../public/fonts/Cairo-Regular.ttf", weight: "400" },
    { path: "../../public/fonts/static/Cairo-SemiBold.ttf", weight: "600" },
    { path: "../../public/fonts/Cairo-Bold.ttf", weight: "700" },
    { path: "../../public/fonts/static/Cairo-Black.ttf", weight: "900" },
  ],
  variable: "--font-cairo",
  display: "swap",
});

// بيانات SEO والتحقق
export const metadata: Metadata = {
  title: "Hidden Radiology | مكتبة ومراجع الأشعة المتخصصة",
  description: "المنصة العربية الأولى المتخصصة في مراجع وكتب الأشعة. سلسلة أنا فاهم، دليل تموضع المريض، وأكثر من 36 مرجعاً متخصصاً.",
  keywords: ["كتب أشعة", "مراجع أشعة", "Radiology books", "أنا فاهم أشعة", "دليل تموضع المريض"],
  authors: [{ name: "Hidden Radiology", url: "https://hidden-radiology-project.vercel.app" }],
  other: {
    'google-site-verification': 'FkjOaMGD_rFmwgEvtVQd2Grd_Av-_UlB6yIuuWt4Yx4',
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#0A192F",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl" className="dark">
      <body className={`${cairo.variable} bg-dark text-silver`}>
        
        {/* 1. Google Analytics (مهم جداً لمتابعة الزوار) */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-EVPNCWLQVR"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-EVPNCWLQVR');
          `}
        </Script>

        {/* 2. مكونات المتجر الحيوية (اللغة، السلة، drawer) */}
        <LanguageProvider>
          <CartProvider>
            {children}
            <CartDrawer />
          </CartProvider>
        </LanguageProvider>
        
      </body>
    </html>
  );
}
