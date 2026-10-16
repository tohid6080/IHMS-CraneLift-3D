# IHMS CraneLift 3D

اپلیکیشنِ برنامه‌ریزی و تحلیلِ لیفتِ جرثقیل — Next.js (React 19) + Three.js،
با بسته‌بندیِ اندروید از طریقِ Capacitor.

## توسعه

```bash
npm install
npm run dev      # سرور توسعه روی پورت 3000
npm run build    # خروجی استاتیک در out/ (برای بسته‌بندیِ Capacitor)
npm run lint
```

> این اپ کاملاً کلاینت‌ساید است (بدونِ API route/SSR واقعی) — خروجیِ
> `next build` به‌صورتِ Static Export (`output: "export"`) در پوشه‌ی
> `out/` تولید می‌شود.

## ساختِ APK اندروید

از طریقِ GitHub Actions (`.github/workflows/build-android.yml`، اجرای دستی
با Workflow Dispatch) — یک APK با امضایِ `debug` ثابت می‌سازد که برای تست و
sideload مناسب است. فایل‌های محلی:

```bash
npm run cap:add     # افزودنِ پلتفرمِ اندروید (یک‌بار)
npm run cap:sync    # ساختِ وب + sync داخلِ پروژه‌ی اندروید
npm run cap:open    # باز کردنِ پروژه در Android Studio
```

## لایسنس/پرداخت (خریدِ درون‌برنامه‌ای کافه‌بازار)

منطقِ لایسنس در `src/lib/cranelift/licensing.ts` + `store.ts` +
`src/lib/cranelift/bazaarBilling.ts` است. فعال‌سازیِ نسخه‌ی Pro **فقط** از
طریقِ نتیجه‌ی تأییدشده‌ی خریدِ Poolakey (SDK رسمیِ کافه‌بازار) انجام می‌شود —
هیچ کدِ فعال‌سازیِ دستی‌واردشونده در این نسخه وجود ندارد (نسخه‌های قبلی این
پروژه یک لیستِ کدِ دموی هاردکدشده در کلاینت داشتند که کاملاً قابلِ‌دور زدن
بود — به همین دلیل کاملاً حذف شد).

اتصالِ واقعیِ Poolakey هنوز سیم‌کشی نشده (نیاز به حسابِ توسعه‌دهنده‌ی
کافه‌بازار + کلیدِ RSA + شناسه‌ی محصول دارد) — راهنمای کاملِ فازِ ۲ در
[`android-native/bazaar-billing/README.md`](android-native/bazaar-billing/README.md).

## یادداشتِ امنیتی

این پروژه از یک اسکفولدِ عمومیِ Next.js+Prisma+بان (ابزارِ ساختِ AI) شروع شده
بود؛ فایل‌های زیرساختیِ اختصاصیِ همان محیط (`.zscripts/`، `mini-services/`،
`Caddyfile`، `tests/`، `examples/`، Prisma/next-authِ استفاده‌نشده) حذف شدند
چون نه برایِ این اپ لازم بودند و نه برایِ بسته‌بندیِ اندروید — `Caddyfile`ِ
اصلی به‌خصوص یک reverse-proxyِ بازِ خطرناک به هر پورتِ دلخواهِ محلی داشت که
هرگز نباید در یک وب‌سرورِ عمومی دیپلوی شود.
