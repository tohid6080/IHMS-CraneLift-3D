/**
 * IHMS CraneLift 3D — موتور لایسنس و محدودیت نسخه رایگان (Freemium)
 * -----------------------------------------------------------
 * طرح: رایگان تا سقف مشخص + خریدِ یک‌بارِ نسخه‌ی Pro از طریقِ خریدِ درون‌برنامه‌ایِ
 * رسمیِ کافه‌بازار (Poolakey). فعال‌سازی فقط از مسیرِ پلاگینِ نیتیوِ
 * BazaarBilling انجام می‌شود (ر.ک. android/BazaarBillingPlugin) — هیچ کدِ
 * فعال‌سازیِ قابلِ‌واردکردن توسطِ کاربر در این نسخه وجود ندارد، چون چنین کدی
 * همیشه در باندلِ کلاینت قابلِ‌استخراج است و قابلِ‌دورزدن می‌شود.
 */

export type PlanType = "free" | "pro";

export interface LicenseState {
  plan: PlanType;
  purchaseToken?: string; // توکنِ خریدِ بازار، برای ارجاعِ احتمالیِ آینده (پشتیبانی/رفاند)
  activatedAt?: string; // ISO
}

export const DEFAULT_LICENSE: LicenseState = { plan: "free" };

// ───────────────────────── سهمیه نسخه رایگان ─────────────────────────

export type QuotaKind = "analysis" | "rope" | "pdf";

export const FREE_LIMITS: Record<QuotaKind, number> = {
  analysis: 5, // تحلیل در روز
  rope: 5, // استفاده از محاسبه‌گر سیم بکسل در روز
  pdf: 1, // گزارش PDF در روز (با واترمارک)
};

export const QUOTA_LABELS: Record<QuotaKind, string> = {
  analysis: "اجرای تحلیل",
  rope: "محاسبه‌گر سیم بکسل",
  pdf: "خروجی گزارش PDF",
};

export interface UsageCounters {
  date: string; // YYYY-MM-DD محلی
  analysis: number;
  rope: number;
  pdf: number;
}

export function todayKey(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function freshUsage(): UsageCounters {
  return { date: todayKey(), analysis: 0, rope: 0, pdf: 0 };
}

/** نتیجه بررسی سهمیه */
export interface QuotaCheck {
  ok: boolean;
  remaining: number; // Infinity = نامحدود
  limit: number | null; // null = نامحدود (Pro)
  used: number;
}

export function isPro(license: LicenseState | undefined | null): boolean {
  return license?.plan === "pro";
}

/** بررسی سهمیه یک قابلیت — بدون مصرف */
export function quotaCheck(
  plan: PlanType,
  usage: UsageCounters | undefined | null,
  kind: QuotaKind
): QuotaCheck {
  const used = usage?.date === todayKey() ? (usage[kind] ?? 0) : 0;
  if (plan === "pro") return { ok: true, remaining: Infinity, limit: null, used };
  const limit = FREE_LIMITS[kind];
  return { ok: used < limit, remaining: Math.max(0, limit - used), limit, used };
}

/** مصرف یک واحد سهمیه (برگرداندن شمارنده جدید) */
export function consumeQuota(
  plan: PlanType,
  usage: UsageCounters | undefined | null,
  kind: QuotaKind
): UsageCounters {
  const base = usage?.date === todayKey() ? usage : freshUsage();
  return { ...base, [kind]: (base[kind] ?? 0) + 1 };
}

/** متن نمایشی باقی‌مانده سهمیه */
export function remainingText(c: QuotaCheck): string {
  if (c.limit === null) return "نامحدود";
  return `${c.remaining} از ${c.limit}`;
}

// ───────────────────────── اطلاعات پلن‌ها (برای دیالوگ ارتقا) ─────────────────────────

export interface PlanInfo {
  id: PlanType | "enterprise";
  title: string;
  price: string;
  period: string;
  features: { ok: boolean; text: string }[];
}

export const PLANS: PlanInfo[] = [
  {
    id: "free",
    title: "رایگان",
    price: "۰ تومان",
    period: "برای همیشه",
    features: [
      { ok: true, text: "۱۳ جرثقیل مرجع + جرثقیل سفارشی" },
      { ok: true, text: "لودچارت جدولی کاتالوگی + ویرایش و ورود CSV" },
      { ok: true, text: "صحنه سه‌بعدی + جابه‌جایی جرثقیل + تجهیزات محوطه" },
      { ok: true, text: "۵ اجرای کامل در روز (تحلیل + شبیه‌سازی حرکت با Play)" },
      { ok: true, text: "۵ بار محاسبه‌گر سیم بکسل در روز" },
      { ok: true, text: "۱ گزارش PDF در روز (با واترمارک)" },
      { ok: false, text: "تحلیل و شبیه‌سازی نامحدود" },
      { ok: false, text: "گزارش PDF نامحدود و بدون واترمارک" },
    ],
  },
  {
    id: "pro",
    title: "حرفه‌ای (Pro)",
    price: "۵٬۰۰۰٬۰۰۰ ریال",
    period: "پرداخت یک‌بار — مادام‌العمر، یک ایستگاه کاری",
    features: [
      { ok: true, text: "همه امکانات نسخه رایگان" },
      { ok: true, text: "تحلیل + شبیه‌سازی حرکت نامحدود (دکمه Play بدون سهمیه)" },
      { ok: true, text: "محاسبه‌گر سیم بکسل نامحدود (مغزکنفی/مغزفولادی)" },
      { ok: true, text: "گزارش PDF نامحدود، بدون واترمارک + امضای مهندس" },
      { ok: true, text: "تحلیل جابجایی دوعرچه‌ای با راهکار اصلاح ایرادها" },
      { ok: true, text: "به‌روزرسانی لودچارت جرثقیل‌های جدید" },
    ],
  },
  {
    id: "enterprise",
    title: "سازمانی",
    price: "تماس بگیرید",
    period: "چند کاربره — نصب درون‌سازمانی",
    features: [
      { ok: true, text: "همه امکانات Pro برای تمام کاربران" },
      { ok: true, text: "لوگو و برند اختصاصی در گزارش‌ها" },
      { ok: true, text: "بانک مرکزی لودچارت‌های شرکت + کنترل نسخه" },
      { ok: true, text: "پشتیبانی اختصاصی و آموزش تیم فنی" },
    ],
  },
];
