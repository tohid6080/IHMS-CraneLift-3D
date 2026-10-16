import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "IHMS CraneLift 3D — برنامه‌ریزی و تحلیل لیفت جرثقیل",
  description:
    "اپلیکیشن حرفه‌ای برنامه‌ریزی لیفت جرثقیل (IHMS): ۱۳ مدل واقعی + جرثقیل سفارشی، لودچارت جدولی کاتالوگی، صحنه سه‌بعدی با تجهیزات نیروگاه/پالایشگاه، جابه‌جایی جرثقیل، شبیه‌سازی حرکت دوپرچمی با یک دکمه Play، محاسبه‌گر سیم بکسل و گزارش PDF حرفه‌ای.",
  keywords: ["جرثقیل", "لیفت پلن", "لودچارت", "IHMS", "HSE", "crane lift plan", "load chart", "3D crane"],
  authors: [{ name: "IHMS — Integrated HSE Management System" }],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f59e0b",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
