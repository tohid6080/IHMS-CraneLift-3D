/**
 * CraneLift Pro 3D — انواع داده (Types)
 * -----------------------------------------------------------
 * تمام ساختارهای داده‌ای که در سراسر برنامه استفاده می‌شوند.
 * واحدها: وزن = تن (t) | طول = متر (m) | زاویه = درجه (deg) | باد = متر بر ثانیه (m/s)
 */

/** نوع جرثقیل */
export type CraneType = "mobile" | "crawler" | "tower";

/** برچسب‌های فارسی نوع جرثقیل */
export const CRANE_TYPE_LABELS: Record<CraneType, string> = {
  mobile: "جرثقیل سیار (All-Terrain)",
  crawler: "جرثقیل شنی (Crawler)",
  tower: "جرثقیل برجی (Tower)",
};

/** مشخصات فنی پایه هر جرثقیل */
export interface CraneSpecs {
  maxCapacityT: number; // ظرفیت اسمی (تن)
  mainBoomMinM: number; // حداقل طول بوم اصلی
  mainBoomMaxM: number; // حداکثر طول بوم اصلی
  jibMinM: number; // حداقل طول جیب
  jibMaxM: number; // حداکثر طول جیب
  jibCapacityFactor: number; // ضریب کاهش ظرفیت در صورت استفاده از جیب
  selfWeightT: number; // وزن خود جرثقیل (تن)
  counterweightT: number; // وزن کانترویت (تن)
  outriggerSpanM: number; // دهانه اوت‌ریگر / فاصله مرکز شنی‌ها (متر)
  windLimitMs: number; // حداکثر سرعت باد مجاز در حین کار (m/s)
  minBoomAngleDeg: number; // حداقل زاویه بوم از افق
  maxBoomAngleDeg: number; // حداکثر زاویه بوم از افق
  pivotHeightM: number; // ارتفاع پین پایه بوم از سطح زمین
  pivotOffsetM: number; // فاصله پین بوم از مرکز دوران (سوپراستراکچر)
  freestandingHookHeightM?: number; // ارتفاع آزاد قلاب (فقط جرثقیل برجی)
  minRadiusM: number; // حداقل شعاع کاری
  maxRadiusM: number; // حداکثر شعاع کاری
}

/** مدل جرثقیل */
export interface Crane {
  id: string; // شناسه یکتا (slug)
  name: string; // نام کامل مدل
  manufacturer: string; // سازنده
  type: CraneType;
  image: string; // مسیر تصویر در public
  specs: CraneSpecs;
  description: string; // توضیح کوتاه فارسی
}

/** یک نقطه لودچارت: ظرفیت مجاز در یک شعاع مشخص */
export interface LoadChartPoint {
  radiusM: number;
  capacityT: number;
}

/** بخش لودچارت: منحنی ظرفیت برای یک طول بوم مشخص */
export interface LoadChartSection {
  boomLengthM: number;
  points: LoadChartPoint[];
}

/** لودچارت کامل یک جرثقیل */
export interface LoadChart {
  craneId: string;
  sections: LoadChartSection[];
  source: "default" | "custom"; // مرجع یا سفارشی (ویرایش/آپلود کاربر)
  updatedAt: string; // ISO date
}

/** ابعاد بار */
export interface LoadDims {
  lengthM: number;
  widthM: number;
  heightM: number;
}

/** اطلاعات ریگینگ */
export interface RiggingConfig {
  slingCount: number; // تعداد اسلینگ (۲ یا ۴)
  slingAngleDeg: number; // زاویه اسلینگ از افق
  useSpreader: boolean; // استفاده از تیر پخش‌کننده (Spreader)
}

/** مانع احتمالی در صحنه سه‌بعدی */
export interface ObstacleConfig {
  enabled: boolean;
  xM: number; // مختصات X (متر)
  zM: number; // مختصات Z (متر)
  heightM: number;
  widthM: number;
}

/** ورودی‌های بار و شرایط لیفت */
export interface LiftInputs {
  // ── بار ──
  loadWeightT: number; // وزن بار (تن)
  loadDims: LoadDims; // ابعاد بار
  hookBlockWeightT: number; // وزن قلاب و بلاک
  riggingWeightT: number; // وزن متعلقات ریگینگ (اسلینگ، شکل و ...)

  // ── ریگینگ ──
  rigging: RiggingConfig;

  // ── هندسه بوم ──
  radiusMode: "radius" | "angle"; // ورودی بر اساس شعاع یا زاویه
  radiusM: number; // شعاع کاری (متر)
  boomAngleDeg: number; // زاویه بوم از افق
  boomLengthM: number; // طول بوم (متر)
  useJib: boolean; // استفاده از جیب
  jibLengthM: number; // طول جیب (متر)
  jibAngleDeg: number; // زاویه جیب از افق

  // ── ارتفاع ──
  requiredHookHeightM: number; // ارتفاع قلاب مورد نیاز (از سطح زمین تا زیر قلاب)

  // ── شرایط محیطی و ایمنی ──
  slewAngleDeg: number; // زاویه چرخش سوپراستراکچر (برای نمایش سه‌بعدی)
  windSpeedMs: number; // سرعت باد
  windGust: boolean; // لحظه‌ی تندباد (+۲۰٪)
  groundSlopeDeg: number; // شیب زمین (درجه)
  safetyFactor: number; // ضریب ایمنی مازاد بر لودچارت (۱ = بدون مارجین)
  obstacle: ObstacleConfig; // مانع در صحنه
  notes: string; // یادداشت‌ها
}

/** سطح هشدار */
export type WarningLevel = "info" | "warning" | "danger";

/** هشدار ایمنی */
export interface AnalysisWarning {
  level: WarningLevel;
  code: string; // کد داخلی
  message: string; // پیام فارسی
}

/** سطح نتیجه یک بررسی */
export type CheckLevel = "pass" | "warn" | "fail";

/** یک ردیف از جدول بررسی‌ها */
export interface AnalysisCheck {
  label: string; // عنوان بررسی
  value: string; // مقدار واقعی
  limit: string; // حد مجاز
  level: CheckLevel;
}

/** نتیجه کامل تحلیل لیفت */
export interface AnalysisResult {
  status: "allowed" | "caution" | "not-allowed";
  timestamp: string; // ISO
  craneId: string;

  // ظرفیت
  ratedCapacityT: number | null; // ظرفیت لودچارت در این کانفیگ
  effectiveCapacityT: number | null; // ظرفیت پس از ضریب جیب و ضریب ایمنی
  grossLoadT: number; // بار کل (بار + قلاب + ریگینگ)
  utilizationPct: number | null; // درصد استفاده از ظرفیت

  // گشتاور
  loadMomentTm: number | null; // گشتاور بار (t·m)
  allowedMomentTm: number | null; // گشتاور مجاز (t·m)
  momentRatioPct: number | null;

  // هندسه
  boomAngleDeg: number | null; // زاویه بوم حل‌شده (یا ورودی کاربر)
  tipRadiusM: number | null; // شعاع نوک بوم/جیب
  tipHeightM: number | null; // ارتفاع نوک بوم/جیب
  availableHookHeightM: number | null; // ارتفاع قابل استفاده قلاب
  requiredHookHeightM: number;
  hookHeightMarginM: number | null;

  // ریگینگ
  slingTensionT: number | null; // نیروی هر اسلینگ
  slingLoadFactorPct: number | null; // ضریب بار اسلینگ (1/sin β) ٪

  // باد
  windRatioPct: number | null; // نسبت باد به حد مجاز

  // جزئیات
  warnings: AnalysisWarning[];
  checks: AnalysisCheck[];
  conclusion: string; // نتیجه‌گیری متنی
}

/** متادیتای پروژه */
export interface ProjectMeta {
  projectId: string;
  projectName: string;
  location: string;
  engineerName: string; // نام مهندس ناظر (برای گزارش)
  companyName: string;
  date: string; // ISO
}

/** نتیجه حل هندسه شعاع ↔ زاویه بوم */
export interface GeometrySolution {
  ok: boolean;
  error?: string; // پیام خطای هندسی
  boomAngleDeg: number;
  radiusM: number;
  tipRadiusM: number;
  tipHeightM: number;
}

/** داده‌های گزارش PDF */
export interface ReportData {
  meta: ProjectMeta;
  crane: Crane;
  chart: LoadChart | null;
  inputs: LiftInputs;
  result: AnalysisResult | null;
  screenshot3D: string | null; // dataURL تصویر صحنه
  chartImage: string | null; // dataURL تصویر منحنی لودچارت
}
