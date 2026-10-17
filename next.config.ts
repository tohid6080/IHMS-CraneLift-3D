import type { NextConfig } from "next";

// اپ فقط کلاینت‌ساید است (بدون API route/SSR واقعی) — خروجیِ استاتیک برای
// بسته‌بندی با Capacitor داخل اندروید لازم است.
//
// GH_PAGES=true فقط در وورک‌فلوی دیپلوی به GitHub Pages ست می‌شود (نه در
// بیلد اندروید/Capacitor) — چون روی Pages این ریپو زیرِ ساب‌پاثِ پروژه
// (tohid6080.github.io/IHMS-CraneLift-3D) سرو می‌شود، نه ریشه‌ی دامنه.
const isGhPages = process.env.GH_PAGES === "true";
const repoBasePath = "/IHMS-CraneLift-3D";

const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  ...(isGhPages
    ? {
        basePath: repoBasePath,
        assetPrefix: repoBasePath,
      }
    : {}),
  env: {
    NEXT_PUBLIC_BASE_PATH: isGhPages ? repoBasePath : "",
  },
};

export default nextConfig;
