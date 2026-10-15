/**
 * CraneLift Pro 3D — موتور تحلیل لیفت
 * -----------------------------------------------------------
 * حل هندسه بوم (شعاع ↔ زاویه)، درون‌یابی لودچارت و انجام
 * بررسی‌های کامل ایمنی برای تعیین «مجاز / نیازمند بررسی / غیرمجاز».
 */

import type {
  AnalysisCheck,
  AnalysisResult,
  AnalysisWarning,
  Crane,
  GeometrySolution,
  LiftInputs,
  LoadChart,
} from "./types";

// ───────────────────────── ابزار ریاضی ─────────────────────────
const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;
const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));

/** ارتفاع بلاک قلاب (تقریب ثابت) */
export const HOOK_BLOCK_HEIGHT_M = 0.8;

// ───────────────────────── درون‌یابی لودچارت ─────────────────────────

/** ظرفیت در یک بخش (طول بوم مشخص) بر اساس شعاع با درون‌یابی خطی */
function capacityInSection(
  points: { radiusM: number; capacityT: number }[],
  radiusM: number
): { capacity: number | null; clampedLow: boolean } {
  if (points.length === 0) return { capacity: null, clampedLow: false };
  const sorted = [...points].sort((a, b) => a.radiusM - b.radiusM);
  const minR = sorted[0].radiusM;
  const maxR = sorted[sorted.length - 1].radiusM;

  // شعاع کمتر از حداقل جدول → از نقطه اول استفاده (محدودیت سازه‌ای بوم)
  if (radiusM <= minR) return { capacity: sorted[0].capacityT, clampedLow: true };
  // شعاع بیشتر از بیشینه این بخش → این کانفیگ بوم به آن شعاع نمی‌رسد
  if (radiusM > maxR) return { capacity: null, clampedLow: false };

  for (let i = 1; i < sorted.length; i++) {
    const p0 = sorted[i - 1];
    const p1 = sorted[i];
    if (radiusM <= p1.radiusM) {
      const t = (radiusM - p0.radiusM) / (p1.radiusM - p0.radiusM);
      return { capacity: p0.capacityT + t * (p1.capacityT - p0.capacityT), clampedLow: false };
    }
  }
  return { capacity: sorted[sorted.length - 1].capacityT, clampedLow: false };
}

export interface CapacityLookupResult {
  capacityT: number | null; // null → خارج از محدوده لودچارت
  clampedLow: boolean; // شعاع زیر حداقل جدول بود (ظرفیت با نقطه مرزی)
  boomClamped: boolean; // طول بوم بین سکشن‌ها درون‌یابی شد
}

/**
 * درون‌یابی دوگانه لودچارت: ابتدا ظرفیت در هر سکشن مجاور،
 * سپس درون‌یابی بر اساس طول بوم.
 */
export function lookupCapacity(
  chart: LoadChart | null,
  boomLengthM: number,
  radiusM: number
): CapacityLookupResult {
  if (!chart || chart.sections.length === 0)
    return { capacityT: null, clampedLow: false, boomClamped: false };

  const sections = [...chart.sections].sort(
    (a, b) => a.boomLengthM - b.boomLengthM
  );
  const minBoom = sections[0].boomLengthM;
  const maxBoom = sections[sections.length - 1].boomLengthM;
  const boomClamped = boomLengthM < minBoom || boomLengthM > maxBoom;

  // یافتن دو سکشن مجاور
  let a = sections[0];
  let b = sections[sections.length - 1];
  for (let i = 1; i < sections.length; i++) {
    if (boomLengthM <= sections[i].boomLengthM) {
      a = sections[i - 1];
      b = sections[i];
      break;
    }
  }

  const ra = capacityInSection(a.points, radiusM);
  const rb = capacityInSection(b.points, radiusM);

  // اگر یکی از سکشن‌ها به شعاع نمی‌رسد، از دیگری استفاده کن
  if (ra.capacity === null && rb.capacity === null)
    return { capacityT: null, clampedLow: false, boomClamped };
  if (ra.capacity === null)
    return { capacityT: rb.capacity, clampedLow: rb.clampedLow, boomClamped };
  if (rb.capacity === null)
    return { capacityT: ra.capacity, clampedLow: ra.clampedLow, boomClamped };

  if (a.boomLengthM === b.boomLengthM)
    return { capacityT: ra.capacity, clampedLow: ra.clampedLow, boomClamped };

  const t = clamp(
    (boomLengthM - a.boomLengthM) / (b.boomLengthM - a.boomLengthM),
    0,
    1
  );
  return {
    capacityT: ra.capacity + t * (rb.capacity - ra.capacity),
    clampedLow: ra.clampedLow || rb.clampedLow,
    boomClamped,
  };
}

// ───────────────────────── حل هندسه بوم ─────────────────────────

/**
 * حل رابطه شعاع ↔ زاویه بوم (با احتساب جیب).
 * جرثقیل برجی: بوم افقی است و شعاع = موقعیت تالی.
 */
export function solveGeometry(
  crane: Crane,
  inputs: LiftInputs
): GeometrySolution {
  const s = crane.specs;

  if (crane.type === "tower") {
    const radius = clamp(inputs.radiusM, 0, 100);
    return {
      ok: true,
      boomAngleDeg: 0,
      radiusM: radius,
      tipRadiusM: radius,
      tipHeightM: s.freestandingHookHeightM ?? 0,
    };
  }

  const L = inputs.boomLengthM;
  const jibH = inputs.useJib ? inputs.jibLengthM * Math.cos(inputs.jibAngleDeg * D2R) : 0;
  const jibV = inputs.useJib ? inputs.jibLengthM * Math.sin(inputs.jibAngleDeg * D2R) : 0;

  let boomAngleDeg: number;
  let radiusM: number;

  if (inputs.radiusMode === "radius") {
    // از شعاع، زاویه بوم را حل کن
    const horizontal = inputs.radiusM - s.pivotOffsetM - jibH;
    const ratio = horizontal / L;
    if (ratio > 1) {
      return {
        ok: false,
        error: `شعاع ${inputs.radiusM} متر با بوم ${L} متری قابل دستیابی نیست (حداکثر ≈ ${(
          L * Math.cos(s.minBoomAngleDeg * D2R) + s.pivotOffsetM + jibH
        ).toFixed(1)} متر).`,
        boomAngleDeg: s.minBoomAngleDeg,
        radiusM: inputs.radiusM,
        tipRadiusM: inputs.radiusM,
        tipHeightM: s.pivotHeightM + L * Math.sin(s.minBoomAngleDeg * D2R) + jibV,
      };
    }
    if (ratio < Math.cos(s.maxBoomAngleDeg * D2R) - 0.05) {
      return {
        ok: false,
        error: `شعاع ${inputs.radiusM} متر برای بوم ${L} متری خیلی کم است؛ زاویه بوم از حد مجاز (${s.maxBoomAngleDeg}°) بیشتر می‌شود.`,
        boomAngleDeg: s.maxBoomAngleDeg,
        radiusM: inputs.radiusM,
        tipRadiusM: inputs.radiusM,
        tipHeightM: s.pivotHeightM + L * Math.sin(s.maxBoomAngleDeg * D2R) + jibV,
      };
    }
    boomAngleDeg = Math.acos(clamp(ratio, -1, 1)) * R2D;
    radiusM = inputs.radiusM;
  } else {
    // از زاویه بوم، شعاع را محاسبه کن
    boomAngleDeg = inputs.boomAngleDeg;
    radiusM = s.pivotOffsetM + L * Math.cos(boomAngleDeg * D2R) + jibH;
  }

  const tipRadiusM = s.pivotOffsetM + L * Math.cos(boomAngleDeg * D2R) + jibH;
  const tipHeightM =
    s.pivotHeightM + L * Math.sin(boomAngleDeg * D2R) + jibV;

  return { ok: true, boomAngleDeg, radiusM, tipRadiusM, tipHeightM };
}

/** طول مؤثر اسلینگ‌ها برای رساندن قلاب تا بالای بار */
function slingVerticalDrop(inputs: LiftInputs): number {
  const halfSpan = Math.max(inputs.loadDims.lengthM, inputs.loadDims.widthM) / 2;
  const beta = Math.max(inputs.rigging.slingAngleDeg, 10);
  if (inputs.rigging.useSpreader) {
    // با تیر پخش‌کننده: اسلینگ‌های بالایی تقریباً عمودی + فاصله تیر
    return 1.2 + halfSpan * 0.25;
  }
  return halfSpan * Math.tan(beta * D2R);
}

// ───────────────────────── تحلیل کامل ─────────────────────────

/** اجرای تحلیل کامل لیفت */
export function analyzeLift(
  crane: Crane,
  chart: LoadChart | null,
  inputs: LiftInputs
): AnalysisResult {
  const s = crane.specs;
  const warnings: AnalysisWarning[] = [];
  const checks: AnalysisCheck[] = [];
  const isTower = crane.type === "tower";

  // ── بار کل ──
  const grossLoadT =
    inputs.loadWeightT + inputs.hookBlockWeightT + inputs.riggingWeightT;

  // ── هندسه ──
  const geo = solveGeometry(crane, inputs);
  if (!geo.ok) {
    warnings.push({
      level: "danger",
      code: "GEOMETRY",
      message: geo.error ?? "هندسه لیفت نامعتبر است.",
    });
  }

  // ── ظرفیت لودچارت ──
  const lookup = geo.ok
    ? lookupCapacity(chart, inputs.boomLengthM, geo.radiusM)
    : { capacityT: null, clampedLow: false, boomClamped: false };

  let rated = lookup.capacityT;
  if (rated !== null && inputs.useJib && !isTower) {
    rated = rated * s.jibCapacityFactor;
    warnings.push({
      level: "info",
      code: "JIB_FACTOR",
      message: `ظرفیت با احتساب ضریب جیب (${s.jibCapacityFactor}) کاهش یافت. لودچارت جیب رسمی سازنده را بررسی کنید.`,
    });
  }

  const effective = rated !== null ? rated / Math.max(inputs.safetyFactor, 1) : null;
  const utilization =
    effective !== null ? (grossLoadT / effective) * 100 : null;

  // ── گشتاور ──
  const radius = geo.ok ? geo.radiusM : NaN;
  const loadMoment = geo.ok ? grossLoadT * radius : null;
  const allowedMoment = effective !== null && geo.ok ? effective * radius : null;
  const momentRatio =
    loadMoment !== null && allowedMoment !== null && allowedMoment > 0
      ? (loadMoment / allowedMoment) * 100
      : null;

  // ── ارتفاع قلاب ──
  let availableHook: number | null = null;
  if (geo.ok) {
    availableHook = isTower
      ? (s.freestandingHookHeightM ?? 0) - HOOK_BLOCK_HEIGHT_M
      : geo.tipHeightM - HOOK_BLOCK_HEIGHT_M;
    // کسری که اسلینگ‌ها از ارتفاع قلاب می‌گیرند
    availableHook -= slingVerticalDrop(inputs);
  }
  const hookMargin =
    availableHook !== null ? availableHook - inputs.requiredHookHeightM : null;

  // ── باد ──
  const windMs = inputs.windGust ? inputs.windSpeedMs * 1.2 : inputs.windSpeedMs;
  const windRatio = (windMs / s.windLimitMs) * 100;

  // ── ریگینگ ──
  const beta = Math.max(inputs.rigging.slingAngleDeg, 5);
  const sinB = Math.sin(beta * D2R);
  const slingTension = grossLoadT / (inputs.rigging.slingCount * sinB);
  const slingFactor = 1 / sinB; // ضریب افزایش بار اسلینگ

  // ═══════════════ بررسی‌ها ═══════════════

  // ۱) ظرفیت
  if (rated === null) {
    checks.push({
      label: "ظرفیت لودچارت",
      value: "خارج از محدوده جدول",
      limit: "درون محدوده",
      level: "fail",
    });
    warnings.push({
      level: "danger",
      code: "OUT_OF_CHART",
      message:
        "شعاع/بوم درخواستی خارج از محدوده لودچارت است. کانفیگ را تغییر دهید یا لودچارت رسمی را وارد کنید.",
    });
  } else {
    const pct = utilization ?? 999;
    checks.push({
      label: "ظرفیت مجاز در این کانفیگ",
      value: `${rated.toFixed(1)} تن`,
      limit: `بار کل ${grossLoadT.toFixed(1)} تن`,
      level: pct > 100 ? "fail" : pct >= 80 ? "warn" : "pass",
    });
    if (pct > 100) {
      warnings.push({
        level: "danger",
        code: "CAPACITY",
        message: `بار کل (${grossLoadT.toFixed(1)} تن) از ظرفیت مجاز (${rated.toFixed(
          1
        )} تن) بیشتر است — لیفت غیرمجاز!`,
      });
    } else if (pct >= 80) {
      warnings.push({
        level: "warning",
        code: "NEAR_CAPACITY",
        message: `ظرفیت با ${pct.toFixed(
          0
        )}٪ در حال استفاده است — به حد مجاز نزدیک.`,
      });
    }
  }

  if (lookup.clampedLow) {
    warnings.push({
      level: "warning",
      code: "LOW_RADIUS_CLAMP",
      message:
        "شعاع از حداقل شعاع لودچارت کمتر است؛ ظرفیت با نقطه مرزی جدول تخمین زده شد.",
    });
  }

  // ۲) گشتاور
  if (momentRatio !== null) {
    checks.push({
      label: "نسبت گشتاور بار به مجاز",
      value: `${loadMoment!.toFixed(0)} t·m`,
      limit: `${allowedMoment!.toFixed(0)} t·m`,
      level: momentRatio > 100 ? "fail" : momentRatio >= 80 ? "warn" : "pass",
    });
  }

  // ۳) بوم
  if (!isTower && geo.ok) {
    const angle = geo.boomAngleDeg;
    checks.push({
      label: "زاویه بوم",
      value: `${angle.toFixed(1)}°`,
      limit: `${s.minBoomAngleDeg}° تا ${s.maxBoomAngleDeg}°`,
      level:
        angle < s.minBoomAngleDeg || angle > s.maxBoomAngleDeg ? "fail" : "pass",
    });
    if (angle < s.minBoomAngleDeg || angle > s.maxBoomAngleDeg) {
      warnings.push({
        level: "danger",
        code: "BOOM_ANGLE",
        message: `زاویه بوم (${angle.toFixed(1)}°) خارج از محدوده مجاز جرثقیل است.`,
      });
    }
  }

  // ۴) باد
  checks.push({
    label: "سرعت باد",
    value: `${windMs.toFixed(1)} m/s${inputs.windGust ? " (تندباد)" : ""}`,
    limit: `حداکثر ${s.windLimitMs} m/s`,
    level: windRatio > 100 ? "fail" : windRatio >= 90 ? "warn" : "pass",
  });
  if (windRatio > 100) {
    warnings.push({
      level: "danger",
      code: "WIND",
      message: `سرعت باد (${windMs.toFixed(
        1
      )} m/s) از حد مجاز کاری این جرثقیل (${s.windLimitMs} m/s) بیشتر است — لیفت ممنوع.`,
    });
  } else if (windRatio >= 90) {
    warnings.push({
      level: "warning",
      code: "WIND_NEAR",
      message: "باد به حد مجاز نزدیک است؛ مانومتر باد باید زیر نظر اپراتور باشد.",
    });
  }

  // ۵) شیب زمین
  const slopeLimits: Record<string, [number, number]> = {
    mobile: [0.5, 1.0],
    crawler: [1.0, 2.0],
    tower: [0.3, 0.5],
  };
  const [slopeWarn, slopeFail] = slopeLimits[crane.type];
  checks.push({
    label: "شیب زمین",
    value: `${inputs.groundSlopeDeg.toFixed(2)}°`,
    limit: `≤ ${slopeWarn}° (کامل) / ≤ ${slopeFail}° (حداکثر)`,
    level:
      inputs.groundSlopeDeg > slopeFail
        ? "fail"
        : inputs.groundSlopeDeg > slopeWarn
        ? "warn"
        : "pass",
  });
  if (inputs.groundSlopeDeg > slopeFail) {
    warnings.push({
      level: "danger",
      code: "SLOPE",
      message: `شیب زمین (${inputs.groundSlopeDeg}°) بیش از حد مجاز است؛ جرثقیل باید تراز شود.`,
    });
  } else if (inputs.groundSlopeDeg > slopeWarn) {
    warnings.push({
      level: "warning",
      code: "SLOPE_WARN",
      message:
        "شیب زمین باعث کاهش ظرفیت و بارگذاری نامتقارن اوت‌ریگرها می‌شود؛ تراز‌بندی توصیه می‌شود.",
    });
  }

  // ۶) زاویه اسلینگ
  const slingLevel =
    beta >= 60 ? "pass" : beta >= 45 ? "warn" : "fail";
  checks.push({
    label: "زاویه اسلینگ از افق",
    value: `${beta}°`,
    limit: "≥ 60° ایده‌آل / ≥ 45° حداقل",
    level: slingLevel,
  });
  if (slingLevel !== "pass") {
    warnings.push({
      level: slingLevel === "fail" ? "danger" : "warning",
      code: "SLING_ANGLE",
      message:
        beta < 45
          ? `زاویه اسلینگ ${beta}° خیلی کم است؛ نیروی هر اسلینگ ${slingFactor.toFixed(
              2
            )} برابر می‌شود — خطر پارگی اسلینگ.`
          : "زاویه اسلینگ کمتر از ۶۰ درجه است؛ استفاده از تیر پخش‌کننده بررسی شود.",
    });
  }

  // ۷) ارتفاع قلاب
  if (hookMargin !== null) {
    checks.push({
      label: "ارتفاع قلاب",
      value: `موجود ${availableHook!.toFixed(1)} متر`,
      limit: `نیاز ${inputs.requiredHookHeightM.toFixed(1)} متر`,
      level:
        hookMargin < 0 ? "fail" : hookMargin < 1 ? "warn" : "pass",
    });
    if (hookMargin < 0) {
      warnings.push({
        level: "danger",
        code: "HOOK_HEIGHT",
        message: `ارتفاع قابل استفاده قلاب (${availableHook!.toFixed(
          1
        )} متر) کمتر از نیاز پروژه است؛ بوم/جیب بلندتر یا ارتفاع بار کمتر لازم است.`,
      });
    } else if (hookMargin < 1) {
      warnings.push({
        level: "warning",
        code: "HOOK_HEIGHT_NEAR",
        message: "حاشیه ارتفاع قلاب کمتر از ۱ متر است؛ مانور محدود خواهد بود.",
      });
    }
  }

  // ۸) شعاع
  if (geo.ok) {
    const rLevel =
      inputs.radiusM > s.maxRadiusM || inputs.radiusM < s.minRadiusM
        ? "fail"
        : "pass";
    checks.push({
      label: "شعاع کاری",
      value: `${geo.radiusM.toFixed(1)} متر`,
      limit: `${s.minRadiusM} تا ${s.maxRadiusM} متر`,
      level: rLevel,
    });
    if (rLevel === "fail") {
      warnings.push({
        level: "danger",
        code: "RADIUS",
        message: "شعاع کاری خارج از محدوده مجاز جرثقیل است.",
      });
    }
  }

  // ۹) ضریب ایمنی
  checks.push({
    label: "ضریب ایمنی اعمال‌شده",
    value: `× ${inputs.safetyFactor.toFixed(2)}`,
    limit: "مارجین مازاد بر لودچارت",
    level: "pass",
  });
  if (inputs.safetyFactor < 1.05) {
    warnings.push({
      level: "info",
      code: "SF_LOW",
      message:
        "بدون مارجین ایمنی مازاد؛ طبق رویه شرکت، حاشیه ۱۰٪ (ضریب ۱٫۱) توصیه می‌شود.",
    });
  }

  // ═══════════════ وضعیت نهایی ═══════════════
  const hasDanger =
    warnings.some((w) => w.level === "danger") ||
    (utilization !== null && utilization > 100);
  const hasWarn =
    warnings.some((w) => w.level === "warning") ||
    (utilization !== null && utilization >= 80);

  const status: AnalysisResult["status"] = hasDanger
    ? "not-allowed"
    : hasWarn
    ? "caution"
    : "allowed";

  const conclusion =
    status === "allowed"
      ? `لیفت مجاز است. بار کل ${grossLoadT.toFixed(1)} تن با ${utilization?.toFixed(
          0
        )}٪ از ظرفیت، در محدوده ایمن قرار دارد. اجرا با رعایت دستورالعمل لیفت مجاز است.`
      : status === "caution"
      ? `لیفت به‌صورت مشروط مجاز است؛ به حد مجاز نزدیک است (${utilization?.toFixed(
          0
        )}٪ ظرفیت). تأیید سرپرست لیفت و کنترل مجدد شرایط الزامی است.`
      : "لیفت غیرمجاز است. هشدارهای قرمز را برطرف کنید (جرثقیل بزرگ‌تر، بوم کوتاه‌تر، شعاع کمتر یا بار کمتر) و مجدداً تحلیل بگیرید.";

  return {
    status,
    timestamp: new Date().toISOString(),
    craneId: crane.id,
    ratedCapacityT: rated,
    effectiveCapacityT: effective,
    grossLoadT,
    utilizationPct: utilization,
    loadMomentTm: loadMoment,
    allowedMomentTm: allowedMoment,
    momentRatioPct: momentRatio,
    boomAngleDeg: geo.ok && !isTower ? geo.boomAngleDeg : null,
    tipRadiusM: geo.ok ? geo.tipRadiusM : null,
    tipHeightM: geo.ok ? geo.tipHeightM : null,
    availableHookHeightM: availableHook,
    requiredHookHeightM: inputs.requiredHookHeightM,
    hookHeightMarginM: hookMargin,
    slingTensionT: slingTension,
    slingLoadFactorPct: slingFactor * 100,
    windRatioPct: windRatio,
    warnings,
    checks,
    conclusion,
  };
}

/** رنگ وضعیت برای UI و سه‌بعدی */
export const STATUS_COLORS = {
  allowed: "#22c55e", // سبز
  caution: "#eab308", // زرد
  "not-allowed": "#ef4444", // قرمز
} as const;

export const STATUS_LABELS = {
  allowed: "مجاز",
  caution: "نیازمند بررسی",
  "not-allowed": "غیرمجاز",
} as const;
