/**
 * IHMS CraneLift 3D — دیتابیس جرثقیل‌ها
 * -----------------------------------------------------------
 * ۱۲ مدل رایج و واقعی جرثقیل (سیار / شنی / برجی) با مشخصات پایه.
 * ⚠️ توجه: مشخصات بر اساس داده‌های عمومی سازندگان گردآوری و گرد شده‌اند
 * و صرفاً برای برنامه‌ریزی اولیه/آموزشی است. پیش از هر لیفت واقعی،
 * لودچارت رسمی سازنده ملاک عمل است.
 */

import type { Crane } from "./types";

/** تعریف مختصر برای خوانایی */
const spec = (
  maxCapacityT: number,
  mainBoom: [number, number],
  jib: [number, number],
  jibCapacityFactor: number,
  selfWeightT: number,
  counterweightT: number,
  outriggerSpanM: number,
  windLimitMs: number,
  angles: [number, number],
  pivotHeightM: number,
  pivotOffsetM: number,
  radius: [number, number],
  freestandingHookHeightM?: number
) => ({
  maxCapacityT,
  mainBoomMinM: mainBoom[0],
  mainBoomMaxM: mainBoom[1],
  jibMinM: jib[0],
  jibMaxM: jib[1],
  jibCapacityFactor,
  selfWeightT,
  counterweightT,
  outriggerSpanM,
  windLimitMs,
  minBoomAngleDeg: angles[0],
  maxBoomAngleDeg: angles[1],
  pivotHeightM,
  pivotOffsetM,
  minRadiusM: radius[0],
  maxRadiusM: radius[1],
  ...(freestandingHookHeightM !== undefined ? { freestandingHookHeightM } : {}),
});

export const CRANES: Crane[] = [
  // ─────────────────────────────── جرثقیل‌های سیار ───────────────────────────────
  {
    id: "ltm-1090-4-2",
    name: "Liebherr LTM 1090-4.2",
    manufacturer: "Liebherr",
    type: "mobile",
    image: "/cranes/ltm-1090-4-2.jpg",
    specs: spec(
      90,
      [11.7, 52],
      [10, 19],
      0.75,
      48,
      18,
      7.1,
      9.8,
      [20, 82],
      2.4,
      1.7,
      [3, 44]
    ),
    description:
      "جرثقیل سیار ۴ محوره ۹۰ تنی؛ مناسب لیفت‌های شهری و صنعتی سبک تا متوسط با بوم تلسکوپی ۵۲ متری.",
  },
  {
    id: "ltm-1100-5-2",
    name: "Liebherr LTM 1100-5.2",
    manufacturer: "Liebherr",
    type: "mobile",
    image: "/cranes/ltm-1100-5-2.jpg",
    specs: spec(
      120,
      [12.3, 62],
      [19, 34],
      0.72,
      60,
      32,
      7.6,
      9.8,
      [20, 82],
      2.5,
      1.8,
      [3, 56]
    ),
    description:
      "جرثقیل ۵ محوره ۱۲۰ تنی با بوم تلسکوپی ۶۲ متری؛ گزینه محبوب برای نصب تجهیزات صنعتی.",
  },
  {
    id: "ltm-1300-6-2",
    name: "Liebherr LTM 1300-6.2",
    manufacturer: "Liebherr",
    type: "mobile",
    image: "/cranes/ltm-1300-6-2.jpg",
    specs: spec(
      300,
      [15.4, 83.5],
      [16, 51],
      0.7,
      96,
      93,
      9.5,
      9.8,
      [18, 82],
      3.0,
      2.2,
      [3.5, 78]
    ),
    description:
      "جرثقیل سنگین ۶ محوره ۳۰۰ تنی با بوم تلسکوپی تا ۸۳.۵ متر؛ مناسب لیفت‌های سنگین پالایشی و نیروگاهی.",
  },
  {
    id: "gmk5250l",
    name: "Grove GMK5250L",
    manufacturer: "Grove (Manitowoc)",
    type: "mobile",
    image: "/cranes/gmk5250l.jpg",
    specs: spec(
      250,
      [15.4, 70],
      [11, 21],
      0.72,
      72,
      65,
      8.6,
      9.8,
      [18, 82],
      2.8,
      2.0,
      [3, 64]
    ),
    description:
      "جرثقیل ۵ محوره ۲۵۰ تنی Grove با بوم ۷۰ متری و سیستم ECU کنترل لحظه؛ پرکاربرد در پروژه‌های نفت و گاز.",
  },
  {
    id: "atf-220g-5",
    name: "Tadano ATF 220G-5",
    manufacturer: "Tadano",
    type: "mobile",
    image: "/cranes/atf-220g-5.jpg",
    specs: spec(
      220,
      [13.6, 78],
      [9.5, 30],
      0.72,
      60,
      60,
      8.6,
      9.8,
      [18, 82],
      2.7,
      2.0,
      [3, 72]
    ),
    description:
      "جرثقیل تادانو ۲۲۰ تنی با بوم تلسکوپی ۷۸ متری؛ ترکیب سبکی و ظرفیت بالا برای مسیرهای محدود.",
  },
  {
    id: "ac-220-5",
    name: "Demag AC 220-5",
    manufacturer: "Demag (Tadano)",
    type: "mobile",
    image: "/cranes/ac-220-5.jpg",
    specs: spec(
      220,
      [13.4, 78],
      [10, 36],
      0.72,
      60,
      65,
      8.7,
      9.8,
      [18, 82],
      2.7,
      2.0,
      [3, 72]
    ),
    description:
      "جرثقیل دمگ ۲۲۰ تنی ۵ محوره با بوم ۷۸ متری و جیب تلسکوپی؛ مناسب نصب دودکش و استراکچرهای بلند.",
  },

  // ─────────────────────────────── جرثقیل‌های شنی ───────────────────────────────
  {
    id: "lr-1300",
    name: "Liebherr LR 1300",
    manufacturer: "Liebherr",
    type: "crawler",
    image: "/cranes/lr-1300.jpg",
    specs: spec(
      300,
      [12, 90],
      [21, 105],
      0.78,
      210,
      130,
      7.9,
      11.8,
      [17, 85],
      2.2,
      1.5,
      [4, 84]
    ),
    description:
      "جرثقیل شنی لیبهر ۳۰۰ تنی با بوم اصلی تا ۹۰ متر؛ امکان جیب لافینگ تا ۱۰۵ متر برای لیفت‌های دقیق بلند.",
  },
  {
    id: "manitowoc-16000",
    name: "Manitowoc 16000",
    manufacturer: "Manitowoc",
    type: "crawler",
    image: "/cranes/manitowoc-16000.jpg",
    specs: spec(
      400,
      [18, 97.5],
      [24, 108],
      0.78,
      280,
      175,
      9.1,
      11.8,
      [16, 85],
      2.6,
      1.8,
      [5, 90]
    ),
    description:
      "جرثقیل شنی ۴۰۰ تنی مانیتوواک با سیستم VICONIC؛ مناسب لیفت‌های فوق‌سنگین ماژول‌های فرآورشی.",
  },
  {
    id: "cke2500",
    name: "Kobelco CKE2500",
    manufacturer: "Kobelco",
    type: "crawler",
    image: "/cranes/cke2500.jpg",
    specs: spec(
      250,
      [18, 91],
      [15, 61],
      0.78,
      195,
      100,
      7.6,
      11.8,
      [17, 85],
      2.3,
      1.6,
      [5, 85]
    ),
    description:
      "جرثقیل شنی کوبلکو ۲۵۰ تنی با بوم لوله‌ای تا ۹۱ متر؛ اقتصادی و پرکاربرد در پروژه‌های زیرساختی.",
  },
  {
    id: "scc8300",
    name: "SANY SCC8300",
    manufacturer: "SANY",
    type: "crawler",
    image: "/cranes/scc8300.jpg",
    specs: spec(
      300,
      [15, 84],
      [12, 42],
      0.76,
      240,
      120,
      8.0,
      11.8,
      [17, 85],
      2.4,
      1.7,
      [5, 80]
    ),
    description:
      "جرثقیل شنی سانی ۳۰۰ تنی؛ انتخاب رایج برای لیفت‌های سنگین با بودجه بهینه در خاورمیانه.",
  },

  // ─────────────────────────────── جرثقیل‌های برجی ───────────────────────────────
  {
    id: "280ec-h",
    name: "Liebherr 280 EC-H",
    manufacturer: "Liebherr",
    type: "tower",
    image: "/cranes/280ec-h.jpg",
    specs: spec(
      12,
      [40, 75],
      [0, 0],
      1.0,
      42,
      0,
      4.6,
      13.8,
      [0, 0],
      0,
      0,
      [3, 75],
      62.4
    ),
    description:
      "جرثقیل برجی لیبهر کلاس ۲۸۰ تن‌متر با جیب تا ۷۵ متر؛ مناسب ساخت‌وساز شهری و بلندمرتبه‌سازی.",
  },
  {
    id: "mdt-389",
    name: "Potain MDT 389",
    manufacturer: "Potain (Manitowoc)",
    type: "tower",
    image: "/cranes/mdt-389.jpg",
    specs: spec(
      20,
      [45, 80],
      [0, 0],
      1.0,
      55,
      0,
      4.6,
      13.8,
      [0, 0],
      0,
      0,
      [3.5, 80],
      68.0
    ),
    description:
      "جرثقیل برجی بدون کلاهک (Topless) پوتن ۲۰ تنی با جیب تا ۸۰ متر؛ مناسب پروژه‌های بزرگ عمرانی با چند جرثقیل هم‌زمان.",
  },
  // ─────────────────────── SANY STC500E (۲۳款) ───────────────────────
  {
    id: "stc500e",
    name: "SANY STC500E",
    manufacturer: "SANY",
    type: "mobile",
    image: "/cranes/stc500e.jpg",
    specs: spec(
      50,           // حداکثر ظرفیت (تن)
      [11.7, 45],   // بوم: ۱۱.۷ تا ۴۵ متر (۵ تکه)
      [9.2, 16],    // جیب: ۹.۲ و ۱۶ متر (دو طبقه)
      0.75,         // فقط برای حالت بدون جدول جیب
      39,           // وزن خود (۳۹۰۰۰kg بدون کانترویت کمکی)
      8.5,          // کانترویت کامل: ۶ + ۲.۵
      7.46,         // دهانه اوت‌ریگر ۷.۴۶ × ۶.۰۵ متر
      9.8,          // حد باد کاری
      [10, 80],     // زاویه بوم
      2.3,          // ارتفاع پین بوم (تقریب)
      1.5,          // فاصله پین بوم از مرکز دوران (تقریب)
      [3, 38]       // محدوده شعاع جدول کاتالوگ
    ),
    description:
      "جرثقیل ۸×۴ سه‌به‌سه ۵۰ تنی سانی با بوم U شکل ۴۵ متری، جیب ۱۶ متری، گشتاور ۱۶۴۴kN·m و لودچارت رسمی کاتالوگ (کانترویت ۸.۵/۶ تن).",
  },
];

/** یافتن جرثقیل با شناسه (جرثقیل‌های سفارشی کاربر هم جستجو می‌شوند) */
export function getCraneById(
  id: string | null | undefined,
  customCranes: Crane[] = []
): Crane | undefined {
  if (!id) return undefined;
  return CRANES.find((c) => c.id === id) ?? customCranes.find((c) => c.id === id);
}
