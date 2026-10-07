import type { Metadata } from "next";
import localFont from "next/font/local";
import { LanguageProvider } from "@/context/LanguageContext";
import { CartProvider } from "@/context/CartContext";
import CartDrawer from "@/components/CartDrawer";
import GoogleAnalytics from "@/components/GoogleAnalytics";
import "./globals.css";

const cairo = localFont({
  src: [
    { path: "../../public/fonts/static/Cairo-Regular.ttf", weight: "400", style: "normal" },
    { path: "../../public/fonts/static/Cairo-SemiBold.ttf", weight: "600", style: "normal" },
    { path: "../../public/fonts/static/Cairo-Bold.ttf", weight: "700", style: "normal" },
    { path: "../../public/fonts/static/Cairo-Black.ttf", weight: "900", style: "normal" },
  ],
  variable: "--font-cairo",
});

export const metadata: Metadata = {
  title: "Hidden Radiology | مكتبة ومراجع الأشعة المتخصصة",
  description: "المنصة العربية الأولى المتخصصة في مراجع وكتب الأشعة.",
  keywords: ["كتب أشعة", "مراجع أشعة", "Radiology books"],
  authors: [{ name: "د. ناصر مبروك", url: "https://hidden-radiology-project.vercel.app" }],
  referrer: "no-referrer",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl">
      <body className={cairo.variable}>
        <GoogleAnalytics />
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
