/**
 * IHMS CraneLift 3D — انواع داده (Types)
 * -----------------------------------------------------------
 * تمام ساختارهای داده‌ای که در سراسر برنامه استفاده می‌شوند.
 * واحدها: وزن = تن (t) | طول = متر (m) | زاویه = درجه (deg) | باد = متر بر ثانیه (m/s)
 */

/** نوع جرثقیل */
export type CraneType = "mobile" | "crawler" | "tower";

/** نوع مغز سیم بکسل: کنفی (FC) یا فولادی (IWRC) */
export type RopeCore = "FC" | "IWRC";

/** ساختار سیم بکسل */
export type RopeConstruction = "6x19" | "6x36" | "8x19" | "8x36";

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

  // ── سیم بکسل و قرقره (اختیاری — برای جرثقیل‌های سفارشی قدیمی undefined است) ──
  maxPartsOfLine?: number; // حداکثر تعداد رشته سیم بکسل در قلاب
  ropeDiameterMm?: number; // قطر سیم بکسل وینچ (میلی‌متر)
  ropeMBLT?: number; // حداقل نیروی گسیختگی سیم (MBL — تن)
  ropeCore?: RopeCore; // نوع مغز سیم بکسل
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

/**
 * یک ردیف جدول جیب: ظرفیت‌ها بر اساس زاویه بوم (مثل کاتالوگ)
 * مقادیر null = خارج از محدوده مجاز
 */
export interface JibChartRow {
  boomAngleDeg: number; // زاویه بوم (ردیف جدول)
  capacities: (number | null)[]; // به تعداد ستون‌ها (جیب × زاویه)
}

/**
 * جدول ظرفیت جیب — مطابق کاتالوگ (TJ):
 * ردیف‌ها = زاویه بوم | ستون‌ها = (طول جیب × زاویه انحراف جیب)
 * capacities مقدارها بر حسب «تن»
 */
export interface JibChartTable {
  jibLengthsM: number[]; // طول‌های جیب (مثلاً [9.2, 16])
  offsetAnglesDeg: number[]; // زاویه انحراف جیب نسبت به بوم (مثلاً [0, 15, 30])
  rows: JibChartRow[]; // مرتب نزولی بر اساس زاویه بوم (مثل کاتالوگ: 78→56)
}

/**
 * یک «صفحه» لودچارت — مطابق کاتالوگ واقعی سازنده:
 * هر صفحه = یک کانفیگ کانترویت/ضریب قرقره با جدول اصلی (بوم) + جدول جیب + یادداشت‌ها
 */
export interface LoadChartPage {
  id: string; // شناسه یکتا در داخل چارت
  label: string; // عنوان صفحه (مثلاً «کانترویت ۸.۵ تن — ۱۰۰٪»)
  counterweightT?: number; // کانترویت این کانفیگ (تن)
  partsOfLinePct?: number; // درصد قرقره (۱۰۰ یا ۵۰)
  sections: LoadChartSection[]; // جدول اصلی: ظرفیت بر اساس (طول بوم، شعاع)
  jibTable?: JibChartTable; // جدول جیب (اختیاری)
  notes: string[]; // یادداشت‌های پای جدول (مثل کاتالوگ)
}

/** لودچارت کامل یک جرثقیل */
export interface LoadChart {
  craneId: string;
  sections: LoadChartSection[]; // سکشن‌های «صفحه فعال» (برای سازگاری با موتور تحلیل)
  source: "default" | "custom"; // مرجع یا سفارشی (ویرایش/آپلود کاربر)
  updatedAt: string; // ISO date
  pages?: LoadChartPage[]; // صفحات کاتالوگ (کانفیگ‌های کانترویت)
  activePageId?: string; // صفحه فعال
  capacityUnit?: "t"; // واحدهای جدول (همیشه تن — برای نمایش)
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

  // ── سیم بکسل و قرقره ──
  partsOfLine: number; // تعداد رشته سیم بکسل در قلاب (۰ = حداکثر جرثقیل)
  ropeOverrideMblT: number | null; // MBL سیم از محاسبه‌گر سیم بکسل (null = سیم پیش‌فرض جرثقیل)

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
  pickHeightM: number; // ارتفاع بار هنگام برداشت در نقطه A (مثلاً روی تریلی)
  placeHeightM: number; // ارتفاع جایگذاری بار در نقطه B

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

  // سیم بکسل و قرقره
  partsOfLine: number; // تعداد رشته فعال در قلاب
  ropeLimitedCapacityT: number | null; // ظرفیت محدودشده به سیم بکسل (رشته × SWL)
  linePullPerPartT: number | null; // کشش هر رشته سیم
  ropeSWLT: number | null; // ظرفیت کاری هر رشته (MBL ÷ ۵)
  ropeUtilizationPct: number | null; // درصد استفاده از ظرفیت سیم

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

/** ظرفیت جیب حل‌شده از جدول جیب (برای نمایش در تحلیل) */
export interface JibLookupInfo {
  capacityT: number | null;
  boomAngleUsedDeg: number | null;
  offsetUsedDeg: number | null;
  interpolated: boolean;
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

/** نتیجه تحلیل یک نقطه (برداشت یا جایگذاری) در جابجایی دوپرچمی */
export interface TransferPointResult {
  point: "A" | "B";
  title: string; // «برداشت» یا «جایگذاری»
  worldX: number;
  worldZ: number;
  radiusM: number; // شعاع از مرکز دوران
  azimuthDeg: number; // آزیموت جهانی (درجه)
  boomAngleDeg: number | null;
  tipHeightM: number | null;
  result: AnalysisResult;
}

/** یک ایراد/مشکل جابجایی با راهکار اصلاح */
export interface TransferIssue {
  point: "A" | "B" | "GLOBAL";
  level: WarningLevel;
  code: string;
  message: string;
  fix: string; // راهکار اصلاحی پیشنهادی
}

/** نتیجه کامل شبیه‌سازی جابجایی دوعرشه‌ای (A → B) */
export interface TransferResult {
  status: "allowed" | "caution" | "not-allowed";
  checkedAt: string; // ISO
  points: TransferPointResult[];
  issues: TransferIssue[];
  conclusion: string;
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
  transfer?: TransferResult | null; // نتیجه شبیه‌سازی جابجایی دوعرچه‌ای
  planType?: "free" | "pro"; // نوع لایسنس (برای واترمارک نسخه رایگان)
  sceneObjects?: SceneObjectInstance[]; // تجهیزات محوطه در صحنه سه‌بعدی
  cranePos?: { x: number; z: number } | null; // موقعیت استقرار جرثقیل (null = مرکز صحنه)
}

/** نقطه روی زمین صحنه سه‌بعدی (متر) */
export interface GroundPoint {
  x: number;
  z: number;
}

/** نوع تجهیز محوطه (نیروگاه / پالایشگاه) برای واقعی‌سازی صحنه */
export type SceneObjectType =
  | "foundation" // فونداسیون بتنی
  | "structure" // سازه فولادی چندطبقه
  | "column" // برج/کلومن فرآیندی
  | "tank" // مخزن ذخیره
  | "exchanger" // مبدل حرارتی
  | "coolingTower" // برج خنک‌کننده
  | "pipeRack" // راک لوله
  | "container" // کانتینر / شلتر
  | "boiler" // بویلر
  | "stack" // دودکش
  | "cableDrum" // قرقره کابل
  | "controlRoom" // اتاق کنترل
  | "transformer"; // ترانس قدرت

/** یک نمونه تجهیز گذاشته‌شده روی زمین صحنه */
export interface SceneObjectInstance {
  id: string;
  type: SceneObjectType;
  x: number; // متر (جهانی)
  z: number; // متر (جهانی)
  rotDeg: number; // چرخش حول محور عمود (درجه)
  scale: number; // ضریب بزرگ‌نمایی (۱ = اندازه پایه)
}
