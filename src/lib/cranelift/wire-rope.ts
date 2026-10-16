/**
 * IHMS CraneLift 3D — موتور محاسبه سیم بکسل
 * -----------------------------------------------------------
 * ۱) جدول مشخصات سیم بکسل وینچ هر جرثقیل مرجع (تعداد رشته، قطر، MBL)
 * ۲) محاسبه MBL بر اساس ساختار (6x19 / 6x36 / 8x19 / 8x36)،
 *    نوع مغز (کنفی FC / فولادی IWRC) و گرید فولاد
 * ۳) SWL با ضرایب اطمینان مختلف + یافتن حداقل قطر لازم برای یک بار مشخص
 *
 * فرمول تقریبی صنعتی:  MBL(تن) = k × d²
 * که d قطر سیم بر حسب میلی‌متر و k ضریب ساختار/مغز در گرید ۱۹۶۰ است.
 * ضرایب بر اساس کاتالوگ‌های رایج (API 9A / EN 12385) گرد شده‌اند.
 */

import type { Crane, RopeConstruction, RopeCore } from "./types";

// ───────────────────────── ضرایب MBL (تن بر mm²) در گرید ۱۹۶۰ ─────────────────────────

const MBL_COEF: Record<RopeConstruction, Record<RopeCore, number>> = {
  "6x19": { FC: 0.0554, IWRC: 0.06 },
  "6x36": { FC: 0.0576, IWRC: 0.0645 },
  "8x19": { FC: 0.0534, IWRC: 0.0584 },
  "8x36": { FC: 0.0554, IWRC: 0.062 },
};

export const ROPE_CONSTRUCTIONS: RopeConstruction[] = ["6x19", "6x36", "8x19", "8x36"];

export const ROPE_CORE_LABELS: Record<RopeCore, string> = {
  FC: "مغز کنفی (FC)",
  IWRC: "مغز فولادی (IWRC)",
};

export const ROPE_CONSTRUCTION_LABELS: Record<RopeConstruction, string> = {
  "6x19": "6×19 (سخت — مقاومت سایشی)",
  "6x36": "6×36 (انعطاف‌پذیر — پرکاربرد)",
  "8x19": "8×19 (بسیار انعطاف‌پذیر)",
  "8x36": "8×36 (انعطاف بالا — قرقره زیاد)",
};

export const ROPE_GRADES = [1960, 2160] as const;

/** قطرهای استاندارد سیم بکسل (میلی‌متر) */
export const STANDARD_DIAMETERS = [
  8, 10, 12, 13, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40, 42, 44, 46, 48, 52,
];

/** ضریب اطمینان استاندارد سیم بکسل بالابر جرثقیل (ISO 4309) */
export const HOIST_SAFETY_FACTOR = 5;

/** MBL سیم بکسل بر حسب تن */
export function ropeMBLT(
  diameterMm: number,
  construction: RopeConstruction,
  core: RopeCore,
  gradeMPa: number = 1960
): number {
  const k = MBL_COEF[construction][core];
  return k * diameterMm * diameterMm * (gradeMPa / 1960);
}

/** SWL (ظرفیت کاری) با ضریب اطمینان مشخص */
export function ropeSWLT(
  diameterMm: number,
  construction: RopeConstruction,
  core: RopeCore,
  safetyFactor: number = HOIST_SAFETY_FACTOR,
  gradeMPa: number = 1960
): number {
  return ropeMBLT(diameterMm, construction, core, gradeMPa) / Math.max(safetyFactor, 1);
}

/** MBL بر حسب کیلونیوتن (برای نمایش) */
export function mblTToKN(t: number): number {
  return t * 9.81;
}

/**
 * حداقل قطر استاندارد سیم برای تحمل SWL لازم
 * (مثلاً بار کل ÷ تعداد رشته = کشش هر رشته؛ SWL لازم = کشش × ضریب اطمینان)
 */
export function minDiameterMm(
  requiredLinePullT: number,
  construction: RopeConstruction,
  core: RopeCore,
  safetyFactor: number = HOIST_SAFETY_FACTOR,
  gradeMPa: number = 1960
): number | null {
  const needMBL = Math.max(requiredLinePullT, 0.01) * safetyFactor;
  for (const d of STANDARD_DIAMETERS) {
    if (ropeMBLT(d, construction, core, gradeMPa) >= needMBL) return d;
  }
  return null;
}

// ───────────────────────── مشخصات سیم جرثقیل‌های مرجع ─────────────────────────

export interface CraneRopeSpec {
  maxPartsOfLine: number; // حداکثر تعداد رشته در قلاب
  diameterMm: number; // قطر سیم وینچ
  mblT: number; // MBL هر رشته (تن)
  core: RopeCore;
}

/** ر = تعداد رشته | ق = قطر (mm) | MBL بر اساس فرمول همین ماژول */
export const CRANE_ROPE_SPECS: Record<string, CraneRopeSpec> = {
  "ltm-1090-4-2": { maxPartsOfLine: 10, diameterMm: 22, mblT: 31.2, core: "IWRC" },
  "ltm-1100-5-2": { maxPartsOfLine: 12, diameterMm: 26, mblT: 43.6, core: "IWRC" },
  "ltm-1300-6-2": { maxPartsOfLine: 14, diameterMm: 30, mblT: 58.1, core: "IWRC" },
  gmk5250l: { maxPartsOfLine: 12, diameterMm: 30, mblT: 58.1, core: "IWRC" },
  "atf-220g-5": { maxPartsOfLine: 11, diameterMm: 28, mblT: 50.6, core: "IWRC" },
  "ac-220-5": { maxPartsOfLine: 11, diameterMm: 28, mblT: 50.6, core: "IWRC" },
  "lr-1300": { maxPartsOfLine: 12, diameterMm: 32, mblT: 66.0, core: "IWRC" },
  "manitowoc-16000": { maxPartsOfLine: 12, diameterMm: 36, mblT: 83.6, core: "IWRC" },
  cke2500: { maxPartsOfLine: 12, diameterMm: 30, mblT: 58.1, core: "IWRC" },
  scc8300: { maxPartsOfLine: 12, diameterMm: 32, mblT: 66.0, core: "IWRC" },
  "280ec-h": { maxPartsOfLine: 2, diameterMm: 26, mblT: 43.6, core: "IWRC" },
  "mdt-389": { maxPartsOfLine: 2, diameterMm: 26, mblT: 43.6, core: "IWRC" },
  stc500e: { maxPartsOfLine: 8, diameterMm: 20, mblT: 25.8, core: "IWRC" },
};

/**
 * مشخصات سیم یک جرثقیل — برای جرثقیل‌های سفارشیِ بدون داده سیم،
 * تخمین منطقی از ظرفیت اسمی انجام می‌شود تا بررسی سیم هرگز
 * به‌اشتباه «غیرمجاز» نزند.
 */
export function ropeSpecOf(crane: Crane): CraneRopeSpec {
  // ۱) جدول جرثقیل‌های مرجع
  const tab = CRANE_ROPE_SPECS[crane.id];
  if (tab) return tab;

  const s = crane.specs;
  // ۲) مشخصات ذخیره‌شده (جرثقیل سفارشی جدید)
  if (s.maxPartsOfLine && s.ropeDiameterMm && s.ropeMBLT) {
    return {
      maxPartsOfLine: s.maxPartsOfLine,
      diameterMm: s.ropeDiameterMm,
      mblT: s.ropeMBLT,
      core: s.ropeCore ?? "IWRC",
    };
  }
  // ── تخمین برای جرثقیل سفارشی قدیمی ──
  const parts = Math.min(12, Math.max(2, Math.ceil(s.maxCapacityT / 6)));
  const linePullPerPart = (s.maxCapacityT * 1.1) / parts; // کمی محتاطانه
  const mbl = Math.max(25.8, linePullPerPart * HOIST_SAFETY_FACTOR);
  const dia =
    STANDARD_DIAMETERS.find((d) => ropeMBLT(d, "6x36", "IWRC") >= mbl) ?? 32;
  return { maxPartsOfLine: parts, diameterMm: dia, mblT: mbl, core: "IWRC" };
}

export interface EffectiveRope {
  parts: number;
  mblT: number;
  swlT: number; // MBL ÷ ۵ (ضریب اطمینان بالابر)
  diameterMm: number;
  core: RopeCore;
  overridden: boolean; // آیا سیم از محاسبه‌گر کاربر آمده؟
}

/**
 * سیم مؤثر لیفت: تعداد رشته انتخابی کاربر (کلمپ به حداکثر جرثقیل)
 * و MBL کاربر در صورت استفاده از محاسبه‌گر سیم بکسل.
 */
export function effectiveRope(crane: Crane, inputs: { partsOfLine: number; ropeOverrideMblT: number | null }): EffectiveRope {
  const spec = ropeSpecOf(crane);
  const parts = Math.min(
    spec.maxPartsOfLine,
    Math.max(1, Math.round(inputs.partsOfLine > 0 ? inputs.partsOfLine : spec.maxPartsOfLine))
  );
  const overridden = inputs.ropeOverrideMblT != null && inputs.ropeOverrideMblT > 0;
  const mblT = overridden ? (inputs.ropeOverrideMblT as number) : spec.mblT;
  return {
    parts,
    mblT,
    swlT: mblT / HOIST_SAFETY_FACTOR,
    diameterMm: spec.diameterMm,
    core: spec.core,
    overridden,
  };
}
