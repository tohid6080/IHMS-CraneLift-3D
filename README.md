# IHMS CraneLift 3D

اپلیکیشنِ برنامه‌ریزی و تحلیلِ لیفتِ جرثقیل — Next.js (React 19) + Three.js،
با بسته‌بندیِ اندروید از طریقِ Capacitor، و نسخه‌ی وبِ آزمایشی روی GitHub
Pages (تعبیه‌شده با iframe داخلِ سامانه‌ی IHMS).

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

## نسخه‌ی وب (GitHub Pages)

از طریقِ GitHub Actions (`.github/workflows/deploy-pages.yml`، اجرا به‌ازایِ
هر push به `main`) روی `https://tohid6080.github.io/IHMS-CraneLift-3D/`
دیپلوی می‌شود. نیازمندِ فعال‌بودنِ GitHub Pages در تنظیماتِ ریپو (Settings →
Pages → Build and deployment → Source: **GitHub Actions**).

چون آدرسِ Pages زیرِ ساب‌پاثِ پروژه است (نه ریشه‌ی دامنه)، `next.config.ts`
با `GH_PAGES=true` یک `basePath`/`assetPrefix` ست می‌کند — این env فقط در
وورک‌فلوی دیپلویِ وب ست می‌شود، بیلدِ اندروید/Capacitor کاملاً دست‌نخورده
می‌ماند.

این نسخه‌ی وب در سامانه‌ی IHMS (`ihmsapp.ir/cranelift/`) با یک iframe تعبیه
شده. بازدیدکنندگانِ وب (غیرِ اندرویدِ نیتیو) قبل از استفاده از ابزار، یک
کادرِ ورود/ثبت‌نامِ آزمایشیِ ۱روزه می‌بینند (`src/components/cranelift/
TrialGate.tsx` + `src/lib/cranelift/trialAuth.ts`) — فقط نام/موبایل/شرکت در
Supabaseِ IHMS ثبت می‌شود؛ هیچ داده‌ی برنامه‌ریزیِ لیفتی هرگز به سرور نمی‌رود
و در این حالت به‌جایِ `localStorage`، در `sessionStorage` نگه‌داری می‌شود (با
بستنِ تب پاک می‌شود — نگاه کنید به `src/lib/cranelift/store.ts`).

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

اتصالِ واقعیِ Poolakey سیم‌کشی شده (کلیدِ RSA واقعیِ حسابِ کافه‌بازار +
شناسه‌ی محصولِ `cranelift_pro_lifetime` در `BazaarBillingPlugin.kt` تنظیم
شده‌اند) — جزئیات در
[`android-native/bazaar-billing/README.md`](android-native/bazaar-billing/README.md).
این مسیر فقط در بیلدِ اندرویدِ نیتیو کار می‌کند؛ نسخه‌ی وب خریدی ندارد.

## یادداشتِ امنیتی

این پروژه از یک اسکفولدِ عمومیِ Next.js+Prisma+بان (ابزارِ ساختِ AI) شروع شده
بود؛ فایل‌های زیرساختیِ اختصاصیِ همان محیط (`.zscripts/`، `mini-services/`،
`Caddyfile`، `tests/`، `examples/`، Prisma/next-authِ استفاده‌نشده) حذف شدند
چون نه برایِ این اپ لازم بودند و نه برایِ بسته‌بندیِ اندروید — `Caddyfile`ِ
اصلی به‌خصوص یک reverse-proxyِ بازِ خطرناک به هر پورتِ دلخواهِ محلی داشت که
هرگز نباید در یک وب‌سرورِ عمومی دیپلوی شود.
