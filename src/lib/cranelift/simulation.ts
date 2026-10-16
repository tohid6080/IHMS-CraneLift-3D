/**
 * CraneLift Pro 3D — موتور شبیه‌سازی جابجایی دوعرشه‌ای (دو پرچم A → B)
 * -----------------------------------------------------------
 * ۱) planTransfer: تحلیل کامل در «هر دو» نقطه (برداشت A و جایگذاری B)
 *    با استفاده از همان موتور analyzeLift + تجمیع ایرادها با راهکار اصلاحی.
 * ۲) buildTimeline + sampleTimeline: ساخت خط‌زمان انیمیشن حرکت جرثقیل:
 *    چرخش به سمت A → تنظیم بوم → پایین رفتن قلاب → قلاب‌کردن بار → بالا کشیدن
 *    → چرخش به سمت B → تنظیم بوم → پایین گذاشتن بار → آزادکردن.
 */

import type {
  Crane,
  LiftInputs,
  LoadChart,
  TransferIssue,
  TransferPointResult,
  TransferResult,
} from "./types";
import { analyzeLift, HOOK_BLOCK_HEIGHT_M, solveGeometry } from "./analysis";

const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/** افت عمودی اسلینگ‌ها از زیر بلاک قلاب تا بالای بار (مطابق موتور تحلیل) */
export function slingDropM(inputs: LiftInputs): number {
  const halfSpan = Math.max(inputs.loadDims.lengthM, inputs.loadDims.widthM) / 2;
  const beta = Math.max(inputs.rigging.slingAngleDeg, 10);
  if (inputs.rigging.useSpreader) return 1.2 + halfSpan * 0.25;
  return halfSpan * Math.tan(beta * D2R);
}

/** ارتفاع زیر بلاک قلاب برای بالاکشیدن بار از سطحی با ارتفاع مشخص */
function attachHookTopY(inputs: LiftInputs, tipHeightM: number, groundY: number): number {
  const need = groundY + inputs.loadDims.heightM + slingDropM(inputs) + HOOK_BLOCK_HEIGHT_M + 0.15;
  // قلاب نمی‌تواند بالاتر از نوک بوم برود
  return Math.max(1, Math.min(need, tipHeightM - 0.25));
}

/** راهکار اصلاحی پیشنهادی برای هر کد هشدار */
const FIX_BY_CODE: Record<string, string> = {
  CAPACITY:
    "بار را سبک‌تر کنید، جرثقیل را نزدیک‌تر به نقطه ببرید (شعاع کمتر)، کانترویت بیشتری ببندید یا جرثقیل بزرگ‌تر انتخاب کنید.",
  NEAR_CAPACITY:
    "حاشیه ایمنی بیشتری اعمال کنید (ضریب ۱٫۱ یا بیشتر) یا شعاع را کاهش دهید.",
  OUT_OF_CHART:
    "شعاع یا طول بوم را داخل محدوده لودچارت تنظیم کنید؛ اگر بار در این شعاع لازم است جرثقیل بزرگ‌تر لازم است.",
  LOW_RADIUS_CLAMP:
    "شعاع را کمی بیشتر کنید تا داخل بازه جدول قرار گیرد.",
  BOOM_ANGLE:
    "طول بوم را تغییر دهید تا زاویه بوم داخل بازه مجاز جرثقیل قرار گیرد.",
  HOOK_HEIGHT:
    "بوم بلندتر انتخاب کنید یا از جیب استفاده کنید؛ ارتفاع برداشت/جایگذاری را کم کنید.",
  HOOK_HEIGHT_NEAR:
    "حاشیه ارتفاع کم است؛ با بوم کمی بلندتر مانور مطمئن‌تری خواهید داشت.",
  WIND: "تا کاهش باد صبر کنید یا لیفت را به زمان دیگری موکول کنید.",
  WIND_NEAR: "باد نزدیک به حد مجاز است؛ آنومومتر باید در دید اپراتور باشد.",
  SLOPE: "سطح زیر جرثقیل را تراز و کوبیده کنید (شیب بیش از حد مجاز است).",
  SLOPE_WARN: "زیر اوت‌ریگرها را تراز کنید تا بارگذاری نامتقارن ایجاد نشود.",
  SLING_ANGLE:
    "زاویه اسلینگ را بیشتر کنید (حداقل ۴۵ و ترجیحاً ۶۰ درجه) یا از تیر پخش‌کننده استفاده کنید.",
  ROPE_LINE_PULL:
    "تعداد رشته‌های قرقره را بیشتر کنید یا سیم بکسل با MBL بالاتر (قطر بزرگ‌تر/مغز فولادی) ببندید.",
  ROPE_NEAR: "کشش سیم نزدیک حد کاری است؛ تعداد رشته‌ها را افزایش دهید.",
  RADIUS: "شعاع را داخل بازه مجاز جرثقیل تنظیم کنید.",
  GEOMETRY:
    "هندسه درخواستی با این بوم قابل دستیابی نیست؛ شعاع یا طول بوم را اصلاح کنید.",
  JIB_FACTOR:
    "لودچارت رسمی جیب سازنده را وارد کنید تا ظرفیت دقیق‌تر محاسبه شود.",
};

function fixFor(code: string): string {
  return FIX_BY_CODE[code] ?? "پارامترهای مرتبط را اصلاح و تحلیل را تکرار کنید.";
}

/**
 * تحلیل کامل جابجایی از نقطه برداشت A تا نقطه جایگذاری B.
 * هر دو نقطه با موتور تحلیل اصلی بررسی می‌شوند (بدترین حالت = وضعیت کل).
 */
export function planTransfer(
  crane: Crane,
  chart: LoadChart | null,
  inputs: LiftInputs,
  pick: { x: number; z: number },
  place: { x: number; z: number }
): TransferResult {
  const defs: {
    point: "A" | "B";
    title: string;
    p: { x: number; z: number };
    groundY: number;
  }[] = [
    { point: "A", title: "برداشت بار", p: pick, groundY: inputs.pickHeightM },
    { point: "B", title: "جایگذاری بار", p: place, groundY: inputs.placeHeightM },
  ];

  const points: TransferPointResult[] = [];
  const issues: TransferIssue[] = [];

  for (const d of defs) {
    const radiusM = Math.round(Math.hypot(d.p.x, d.p.z) * 10) / 10;
    const azimuthDeg = (Math.atan2(d.p.z, d.p.x) * R2D + 360) % 360;
    // ارتفاع قلاب مورد نیاز در این نقطه = ارتفاع سطح + ارتفاع بار
    const pointInputs: LiftInputs = {
      ...inputs,
      radiusMode: "radius",
      radiusM: radiusM,
      requiredHookHeightM: Math.round((d.groundY + inputs.loadDims.heightM) * 10) / 10,
    };
    const result = analyzeLift(crane, chart, pointInputs);
    const geo = solveGeometry(crane, pointInputs);

    points.push({
      point: d.point,
      title: d.title,
      worldX: d.p.x,
      worldZ: d.p.z,
      radiusM,
      azimuthDeg,
      boomAngleDeg: crane.type === "tower" ? 0 : geo.ok ? geo.boomAngleDeg : null,
      tipHeightM: geo.ok ? geo.tipHeightM : null,
      result,
    });

    // ایرادهای این نقطه (فقط هشدار و خطر — اطلاعات کافی نیست)
    for (const w of result.warnings) {
      if (w.level === "info") continue;
      issues.push({
        point: d.point,
        level: w.level,
        code: w.code,
        message: `[${d.point} — ${d.title}] ${w.message}`,
        fix: fixFor(w.code),
      });
    }
  }

  const worst = points.some((p) => p.result.status === "not-allowed")
    ? "not-allowed"
    : points.some((p) => p.result.status === "caution")
      ? "caution"
      : "allowed";

  const firstDanger = issues.find((i) => i.level === "danger");
  const firstWarn = issues.find((i) => i.level === "warning");

  const conclusion =
    worst === "allowed"
      ? "جابجایی از نقطه برداشت (A) تا نقطه جایگذاری (B) در هر دو حالت مجاز است؛ اجرا با رعایت دستورالعمل لیفت بلامانع است."
      : worst === "caution"
        ? `جابجایی به‌صورت مشروط مجاز است؛ ${firstWarn?.message ?? "به حد مجاز نزدیک است."}`
        : `جابجایی غیرمجاز است — اصلاح لازم: ${firstDanger?.message ?? "شرایط لیفت بازنگری شود."}`;

  return {
    status: worst,
    checkedAt: new Date().toISOString(),
    points,
    issues,
    conclusion,
  };
}

// ───────────────────────── خط‌زمان انیمیشن ─────────────────────────

export interface SegPose {
  slewDeg: number; // زاویه چرخش سوپراستراکچر (جهانی، همان inputs.slewAngleDeg)
  boomDeg: number; // زاویه بوم از افق
  hookTopY: number; // ارتفاع بالای بلاک قلاب
  hookX: number; // شعاع محلی قلاب
}

export interface TimelineSeg {
  name: string;
  label: string;
  dur: number; // ثانیه
  from: SegPose;
  to: SegPose;
  point: "A" | "B" | "travel";
  attachedFrom: boolean;
  attachedTo: boolean;
  statusColor: string;
}

export interface Timeline {
  segs: TimelineSeg[];
  total: number;
  /** برای کلمپ کردن ارتفاع قلاب به نوک بوم */
  pivotHeightM: number;
  boomLengthM: number;
  jibVM: number;
  isTower: boolean;
  towerH: number;
}

export interface SimPose extends SegPose {
  attached: boolean;
  loadGround: "A" | "B" | null;
  statusColor: string;
  phaseLabel: string;
  point: "A" | "B" | "travel";
  radiusM: number;
  progress: number; // ۰..۱ کل مسیر
}

/** زاویه چرخش معادل مختصات جهانی (نقشه: rotation.y = -atan2(z,x)) */
export function slewDegFor(x: number, z: number): number {
  return Math.atan2(z, x) * R2D;
}

function shortestSlew(fromDeg: number, toDeg: number): number {
  let d = ((toDeg - fromDeg + 540) % 360) - 180;
  if (d === -180) d = 180; // مسیر کامل به‌جای نیم‌چرخش مبهم
  return fromDeg + d;
}

/**
 * ساخت خط‌زمان حرکت بر اساس نتیجه planTransfer.
 * startPose = پوز فعلی ایستای صحنه (قبل از شروع حرکت).
 */
export function buildTimeline(
  crane: Crane,
  inputs: LiftInputs,
  transfer: TransferResult,
  startPose: SegPose,
  speeds = { slew: 7, boom: 4, hoist: 5, min: 0.8 } // درجه/ثانیه، درجه/ثانیه، متر/ثانیه
): Timeline {
  const A = transfer.points[0];
  const B = transfer.points[1];
  const isTower = crane.type === "tower";
  const jibVM = inputs.useJib ? inputs.jibLengthM * Math.sin(inputs.jibAngleDeg * D2R) : 0;

  const segs: TimelineSeg[] = [];
  const colorA =
    A.result.status === "allowed" ? "#22c55e" : A.result.status === "caution" ? "#eab308" : "#ef4444";
  const colorB =
    B.result.status === "allowed" ? "#22c55e" : B.result.status === "caution" ? "#eab308" : "#ef4444";

  const tipY = (boomDeg: number): number =>
    isTower
      ? crane.specs.freestandingHookHeightM ?? 50
      : crane.specs.pivotHeightM +
        inputs.boomLengthM * Math.sin(clamp(boomDeg, 0, 89) * D2R) +
        jibVM;

  // ارتفاع‌های کلیدی
  const travelY = Math.max(
    1.5,
    Math.min(tipY(A.boomAngleDeg ?? 0), tipY(B.boomAngleDeg ?? 0)) - 0.3
  );
  const attachYA = attachHookTopY(inputs, tipY(A.boomAngleDeg ?? 0), inputs.pickHeightM);
  const attachYB = attachHookTopY(inputs, tipY(B.boomAngleDeg ?? 0), inputs.placeHeightM);

  const push = (
    name: string,
    label: string,
    to: SegPose,
    point: "A" | "B" | "travel",
    attached: boolean,
    color: string,
    speedFactor = 1
  ) => {
    const from = segs.length === 0 ? startPose : { ...segs[segs.length - 1].to };
    // چرخش همیشه از کوتاه‌ترین مسیر
    const toSlew = point === "travel" ? to.slewDeg : shortestSlew(from.slewDeg, to.slewDeg);
    const dSlew = Math.abs(toSlew - from.slewDeg);
    const dBoom = Math.abs(to.boomDeg - from.boomDeg);
    const dHook = Math.abs(to.hookTopY - from.hookTopY);
    const dur = Math.max(
      speeds.min,
      dSlew / (speeds.slew * speedFactor),
      dBoom / (speeds.boom * speedFactor),
      dHook / (speeds.hoist * speedFactor)
    );
    segs.push({
      name,
      label,
      dur,
      from: { ...from, slewDeg: from.slewDeg },
      to: { ...to, slewDeg: toSlew },
      point,
      attachedFrom: attached,
      attachedTo: attached,
      statusColor: color,
    });
  };

  // ۱) هم‌تراژی با نقطه A (چرخش + بوم + قلاب در ارتفاع سفر)
  push(
    "ALIGN_A",
    "حرکت به سمت نقطه برداشت (A)",
    { slewDeg: A.azimuthDeg, boomDeg: A.boomAngleDeg ?? startPose.boomDeg, hookTopY: Math.max(travelY, attachYA), hookX: A.radiusM },
    "A",
    false,
    colorA
  );
  // ۲) پایین رفتن قلاب تا بار
  push(
    "LOWER_A",
    "پایین رفتن قلاب به سمت بار",
    { slewDeg: A.azimuthDeg, boomDeg: A.boomAngleDeg ?? startPose.boomDeg, hookTopY: attachYA, hookX: A.radiusM },
    "A",
    false,
    colorA
  );
  // ۳) قلاب‌کردن (مکث — اتصال در پایان)
  segs.push({
    name: "ATTACH",
    label: "قلاب‌کردن و بستن اسلینگ‌ها",
    dur: 1.1,
    from: { ...segs[segs.length - 1].to },
    to: { ...segs[segs.length - 1].to },
    point: "A",
    attachedFrom: false,
    attachedTo: true,
    statusColor: colorA,
  });
  // ۴) بالا کشیدن بار تا ارتفاع سفر
  push(
    "HOIST",
    "بالا کشیدن بار تا ارتفاع سفر",
    { slewDeg: A.azimuthDeg, boomDeg: A.boomAngleDeg ?? startPose.boomDeg, hookTopY: Math.max(travelY, attachYA), hookX: A.radiusM },
    "travel",
    true,
    colorA
  );
  // ۵) چرخش به سمت B
  push(
    "SLEW_B",
    "چرخش سوپراستراکچر به سمت نقطه B",
    { slewDeg: B.azimuthDeg, boomDeg: A.boomAngleDeg ?? startPose.boomDeg, hookTopY: Math.max(travelY, attachYA), hookX: A.radiusM },
    "travel",
    true,
    colorB
  );
  // ۶) تنظیم بوم برای شعاع B (قلاب در ارتفاع سفرِ B)
  const travelYB = Math.min(tipY(B.boomAngleDeg ?? 0) - 0.3, Math.max(travelY, attachYB));
  push(
    "BOOM_B",
    "تنظیم زاویه بوم برای شعاع جایگذاری",
    { slewDeg: B.azimuthDeg, boomDeg: B.boomAngleDeg ?? startPose.boomDeg, hookTopY: travelYB, hookX: B.radiusM },
    "B",
    true,
    colorB
  );
  // ۷) پایین گذاشتن بار در ارتفاع جایگذاری
  push(
    "LOWER_B",
    "پایین گذاشتن بار در نقطه جایگذاری",
    { slewDeg: B.azimuthDeg, boomDeg: B.boomAngleDeg ?? startPose.boomDeg, hookTopY: attachYB, hookX: B.radiusM },
    "B",
    true,
    colorB
  );
  // ۸) آزادکردن بار (مکث — جدا شدن در پایان)
  segs.push({
    name: "RELEASE",
    label: "آزادسازی بار و بازکردن اسلینگ‌ها",
    dur: 1.1,
    from: { ...segs[segs.length - 1].to },
    to: { ...segs[segs.length - 1].to },
    point: "B",
    attachedFrom: true,
    attachedTo: false,
    statusColor: colorB,
  });

  const total = segs.reduce((s, x) => s + x.dur, 0);
  return {
    segs,
    total,
    pivotHeightM: crane.specs.pivotHeightM,
    boomLengthM: inputs.boomLengthM,
    jibVM,
    isTower,
    towerH: crane.specs.freestandingHookHeightM ?? 50,
  };
}

function ease(t: number): number {
  // smoothstep — نرم در شروع و پایان هر فاز
  return t * t * (3 - 2 * t);
}

/** نمونه‌گیری پوز در زمان t (ثانیه) — null یعنی انیمیشن تمام شده */
export function sampleTimeline(tl: Timeline, t: number): SimPose | null {
  if (t >= tl.total) return null;
  let acc = 0;
  let seg = tl.segs[0];
  let f = 0;
  for (const s of tl.segs) {
    if (t < acc + s.dur) {
      seg = s;
      f = (t - acc) / s.dur;
      break;
    }
    acc += s.dur;
  }
  const e = ease(clamp(f, 0, 1));
  const lerp = (a: number, b: number) => a + (b - a) * e;
  const boomDeg = lerp(seg.from.boomDeg, seg.to.boomDeg);
  const hookTopY = lerp(seg.from.hookTopY, seg.to.hookTopY);
  // قلاب هرگز بالاتر از نوک بوم نمی‌رود
  const tipNow = tl.isTower
    ? tl.towerH
    : tl.pivotHeightM + tl.boomLengthM * Math.sin(clamp(boomDeg, 0, 89) * D2R) + tl.jibVM;
  const hookY = Math.min(hookTopY, tipNow - 0.25);
  const attached = f > 0.95 ? seg.attachedTo : seg.attachedFrom;
  return {
    slewDeg: lerp(seg.from.slewDeg, seg.to.slewDeg),
    boomDeg,
    hookTopY: hookY,
    hookX: lerp(seg.from.hookX, seg.to.hookX),
    attached,
    loadGround: attached ? null : seg.point === "B" ? "B" : "A",
    statusColor: seg.statusColor,
    phaseLabel: seg.label,
    point: seg.point,
    radiusM: lerp(seg.from.hookX, seg.to.hookX),
    progress: clamp(t / tl.total, 0, 1),
  };
}

/** پوز پایانی (بار روی نقطه B) برای نمایش بعد از اتمام */
export function finalPoseOf(tl: Timeline): SimPose {
  const last = tl.segs[tl.segs.length - 1].to;
  return {
    ...last,
    attached: false,
    loadGround: "B",
    statusColor: tl.segs[tl.segs.length - 1].statusColor,
    phaseLabel: "پایان جابجایی — بار در نقطه B جایگذاری شد",
    point: "B",
    radiusM: last.hookX,
    progress: 1,
  };
}

/** پوز ایستای صحنه قبل از شروع (برای نقطه شروع خط‌زمان) */
export function staticPoseOf(crane: Crane, inputs: LiftInputs, pick: { x: number; z: number } | null): SegPose {
  const eff = pick
    ? {
        ...inputs,
        radiusMode: "radius" as const,
        radiusM: Math.hypot(pick.x, pick.z),
        slewAngleDeg: slewDegFor(pick.x, pick.z),
      }
    : inputs;
  const geo = solveGeometry(crane, eff);
  const isTower = crane.type === "tower";
  const jibVM = inputs.useJib ? inputs.jibLengthM * Math.sin(inputs.jibAngleDeg * D2R) : 0;
  const boomDeg = geo.ok && !isTower ? geo.boomAngleDeg : inputs.boomAngleDeg;
  const hookX = isTower ? geo.radiusM : crane.specs.pivotOffsetM + inputs.boomLengthM * Math.cos(boomDeg * D2R) + (inputs.useJib ? inputs.jibLengthM * Math.cos(inputs.jibAngleDeg * D2R) : 0);
  const hookTopY = isTower
    ? crane.specs.freestandingHookHeightM ?? 50
    : crane.specs.pivotHeightM + inputs.boomLengthM * Math.sin(boomDeg * D2R) + jibVM;
  return {
    slewDeg: eff.slewAngleDeg,
    boomDeg,
    hookTopY,
    hookX,
  };
}
