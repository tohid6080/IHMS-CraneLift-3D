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
  title: "CraneLift Pro 3D — برنامه‌ریزی و تحلیل لیفت جرثقیل",
  description:
    "اپلیکیشن حرفه‌ای برنامه‌ریزی لیفت جرثقیل: انتخاب از ۱۲ مدل واقعی، لودچارت تعاملی، شبیه‌سازی سه‌بعدی، تحلیل ایمنی و گزارش PDF حرفه‌ای.",
  keywords: ["جرثقیل", "لیفت پلن", "لودچارت", "crane lift plan", "load chart", "3D crane"],
  authors: [{ name: "CraneLift Pro" }],
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
