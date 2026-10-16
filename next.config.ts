import type { NextConfig } from "next";

// اپ فقط کلاینت‌ساید است (بدون API route/SSR واقعی) — خروجیِ استاتیک برای
// بسته‌بندی با Capacitor داخل اندروید لازم است.
const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
