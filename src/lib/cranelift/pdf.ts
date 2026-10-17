/**
 * IHMS CraneLift 3D — مولد گزارش PDF حرفه‌ای (فارسی، RTL)
 * -----------------------------------------------------------
 * تولید گزارش چندصفحه‌ای A4 در سمت کلاینت با html2canvas + jsPDF:
 *   ۱) ساخت یک عنصر DOM مخفی برای گزارش — فقط استایل inline با رنگ HEX
 *      (⚠️ هرگز از کلاس‌های Tailwind یا CSS variables استفاده نکنید؛
 *      html2canvas رنگ‌های oklch را نمی‌فهمد و خروجی خراب می‌شود)
 *   ۲) رندر کل گزارش به یک Canvas با scale: 2
 *   ۳) برش عمودی به صفحات A4 (۲۱۰×۲۹۷mm) و افزودن به jsPDF و ذخیره
 *
 * این ماژول در سطح بالا به window/document دسترسی ندارد (import امن است)،
 * اما توابع خروجی فقط باید در مرورگر (event handler کلاینت) صدا زده شوند.
 */

import { withBasePath } from "@/lib/basePath";
import { CRANE_TYPE_LABELS } from "./types";
import { STATUS_LABELS } from "./analysis";
import { SCENE_OBJECT_CATALOG, sceneObjectLabel } from "./scene-objects";
import type {
  AnalysisResult,
  CheckLevel,
  Crane,
  LiftInputs,
  LoadChart,
  ReportData,
  TransferResult,
  WarningLevel,
} from "./types";
import { effectiveRope } from "./wire-rope";

// ───────────────────────── انواع محلی ─────────────────────────

/** سلول جدول: متن ساده یا متن با رنگ/بولد */
interface RichCell {
  text: string;
  color?: string;
  bold?: boolean;
}

type Cell = string | RichCell;

type StyleMap = Partial<CSSStyleDeclaration>;

// ───────────────────────── ثابت‌ها ─────────────────────────

/** عرض صفحه A4 بر حسب میلی‌متر */
const PAGE_W_MM = 210;
/** ارتفاع صفحه A4 بر حسب میلی‌متر */
const PAGE_H_MM = 297;
/** عرض پیکسلی بوم گزارش (A4 در ۹۶dpi) */
const REPORT_W_PX = 794;
/** ضریب رزولوشن رندر html2canvas */
const RENDER_SCALE = 2;
/** کیفیت JPEG صفحات PDF */
const JPEG_QUALITY = 0.92;
/** حداکثر تعداد نقاط نمایش‌داده‌شده در جدول لودچارت */
const MAX_CHART_POINTS = 16;

/**
 * رنگ پس‌زمینه بنر نتیجه نهایی.
 * نسخه پرینت (تیره‌تر از STATUS_COLORS) برای کنتراست بهتر متن سفید روی کاغذ.
 */
const BANNER_BG: Record<AnalysisResult["status"], string> = {
  allowed: "#16a34a",
  caution: "#ca8a04",
  "not-allowed": "#dc2626",
};

/** عنوان بنر نتیجه نهایی */
const BANNER_TITLE: Record<AnalysisResult["status"], string> = {
  allowed: "نتیجه نهایی: مجاز است",
  caution: "نتیجه نهایی: نیازمند بررسی بیشتر",
  "not-allowed": "نتیجه نهایی: غیرمجاز",
};

/** علامت وضعیت هر ردیف جدول بررسی‌ها (کاراکترهای مطمئن برای html2canvas) */
const CHECK_MARKS: Record<CheckLevel, RichCell> = {
  pass: { text: "✓", color: "#16a34a", bold: true },
  warn: { text: "⚠", color: "#b45309", bold: true },
  fail: { text: "✗", color: "#dc2626", bold: true },
};

/** رنگ مربع کنار هر هشدار بر اساس سطح */
const WARNING_COLORS: Record<WarningLevel, string> = {
  info: "#52525b",
  warning: "#ca8a04",
  danger: "#dc2626",
};

/** توصیه‌های ثابت ایمنی لیفت (چک‌لیست چاپی) */
const SAFETY_TIPS: readonly string[] = [
  "کنترل ظرفیت تحمل زمین زیر اوت‌ریگرها/شنی‌ها و استفاده از تخته‌های توزیع بار",
  "پایش مستمر سرعت باد با بادسنج؛ توقف لیفت در صورت تندباد بالاتر از حد مجاز",
  "تراز بودن کامل جرثقیل پیش از لیفت (شیب بیش از حد مجاز ممنوع)",
  "بازرسی گواهی‌دار اسلینگ‌ها، شکل‌ها و بلاک قلاب پیش از هر شیفت",
  "تعیین و علامت‌گذاری منطقه ممنوعه (Exclusion Zone) و ممنوعیت عبور بار از روی پرسنل",
  "لیفت آزمایشی: جدا کردن بار چند سانتی‌متر از زمین، کنترل ترازی و توقف ۵ دقیقه‌ای",
  "رادیو-راهنما و دستور لیفت واحد توسط یک سرپرست لیفت دارای صلاحیت",
  "رعایت فاصله ایمن از خطوط برق و موانع (طبق جدول فاصله مجاز)",
];

// ───────────────────────── قالب‌بندی اعداد و تاریخ ─────────────────────────

/** عدد → رشته با حداکثر ۲ رقم اعشار (ورودی‌های کاربر) */
function num(v: number): string {
  return Number.isFinite(v) ? String(Math.round(v * 100) / 100) : "—";
}

/** عدد اختیاری + واحد → سلول متنی؛ null/undefined → «—» */
function fmtNum(
  v: number | null | undefined,
  unit: string,
  digits = 1
): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  const s = v.toFixed(digits);
  return unit === "°" || unit === "٪" ? `${s}${unit}` : `${s} ${unit}`;
}

/** تاریخ ISO → رشته شمسی؛ نامعتبر → «—» */
function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("fa-IR");
}

// ───────────────────────── سازنده‌های DOM ─────────────────────────

/** ساخت یک عنصر با استایل inline و فرزندان (متن یا نود) */
function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  style: StyleMap,
  ...children: Array<Node | string | null | undefined>
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  Object.assign(node.style, style);
  for (const child of children) {
    if (child === null || child === undefined) continue;
    node.appendChild(
      typeof child === "string" ? document.createTextNode(child) : child
    );
  }
  return node;
}

/** سلول rich → نود (span رنگی/بولد یا text ساده) */
function richNode(cell: Cell): Node {
  if (typeof cell === "string") return document.createTextNode(cell);
  const span = document.createElement("span");
  span.style.color = cell.color ?? "#1c1917";
  if (cell.bold) span.style.fontWeight = "700";
  span.textContent = cell.text;
  return span;
}

/** جفت برچسب/مقدار برای جدول‌های دوستونه */
function kv(label: string, value: Cell): [string, Cell] {
  return [label, value];
}

/** تیتر بخش با نوار کهربایی سمت راست */
function h2(text: string): HTMLDivElement {
  return el(
    "div",
    {
      fontSize: "15px",
      fontWeight: "700",
      color: "#1c1917",
      borderRight: "4px solid #f59e0b",
      paddingRight: "10px",
      marginTop: "26px",
      marginBottom: "10px",
    },
    text
  );
}

/** جدول عمومی با سرستون (اختیاراً ستون‌های وسط‌چین) */
function table(
  headers: string[],
  rows: Cell[][],
  opts?: { centerCols?: number[] }
): HTMLTableElement {
  const t = document.createElement("table");
  Object.assign(t.style, {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "12.5px",
    marginTop: "2px",
  });

  const headRow = t.createTHead().insertRow();
  headers.forEach((header, i) => {
    const th = document.createElement("th");
    Object.assign(th.style, {
      border: "1px solid #e4e4e7",
      background: "#f5f5f4",
      color: "#44403c",
      fontWeight: "700",
      fontSize: "12px",
      padding: "7px 12px",
      textAlign: opts?.centerCols?.includes(i) ? "center" : "right",
    });
    th.textContent = header;
    headRow.appendChild(th);
  });

  const body = t.createTBody();
  for (const row of rows) {
    const tr = body.insertRow();
    row.forEach((cell, i) => {
      const td = tr.insertCell();
      Object.assign(td.style, {
        border: "1px solid #e4e4e7",
        padding: "6px 12px",
        textAlign: opts?.centerCols?.includes(i) ? "center" : "right",
        verticalAlign: "top",
      });
      td.appendChild(richNode(cell));
    });
  }
  return t;
}

/** جدول دوستونه برچسب/مقدار */
function kvTable(rows: Array<[string, Cell]>): HTMLTableElement {
  const t = document.createElement("table");
  Object.assign(t.style, {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "12.5px",
    marginTop: "2px",
  });
  const body = t.createTBody();
  for (const [label, value] of rows) {
    const tr = body.insertRow();

    const tdLabel = tr.insertCell();
    Object.assign(tdLabel.style, {
      width: "32%",
      border: "1px solid #e4e4e7",
      background: "#fafaf9",
      color: "#57534e",
      fontWeight: "600",
      padding: "6px 12px",
      textAlign: "right",
      verticalAlign: "top",
    });
    tdLabel.textContent = label;

    const tdValue = tr.insertCell();
    Object.assign(tdValue.style, {
      border: "1px solid #e4e4e7",
      padding: "6px 12px",
      textAlign: "right",
      verticalAlign: "top",
    });
    tdValue.appendChild(richNode(value));
  }
  return t;
}

// ───────────────────────── بخش‌های گزارش ─────────────────────────

/** الف) نوار سربرگ + شبکه متادیتای پروژه (بدون حاشیه) */
function headerBand(data: ReportData): HTMLElement {
  // سربرگ با لوگوی IHMS (تصویر هم‌مبلا /logo.png)
  const logo = el("img", {
    width: "74px",
    height: "74px",
    objectFit: "contain",
    borderRadius: "10px",
    background: "#ffffff",
    border: "2px solid #1c1917",
  });
  logo.src = withBasePath("/logo.png");
  logo.alt = "IHMS — Integrated HSE Management System";

  const band = el(
    "div",
    {
      background: "#f59e0b",
      color: "#1c1917",
      borderRadius: "12px",
      padding: "18px 24px",
      display: "flex",
      alignItems: "center",
      gap: "18px",
      textAlign: "start",
    },
    logo,
    el(
      "div",
      { flex: "1" },
      el(
        "div",
        { fontSize: "20px", fontWeight: "700", lineHeight: "1.6" },
        "گزارش برنامه‌ریزی و تحلیل لیفت جرثقیل"
      ),
      el(
        "div",
        {
          fontSize: "12px",
          fontWeight: "600",
          color: "#44403c",
          marginTop: "2px",
          direction: "ltr",
        },
        "IHMS CraneLift 3D — Lift Plan & Analysis Report"
      ),
      el(
        "div",
        { fontSize: "10.5px", color: "#57534e", marginTop: "2px", direction: "ltr" },
        "Integrated HSE Management System"
      )
    )
  );

  const metaItem = (label: string, value: string): HTMLElement =>
    el(
      "div",
      { width: "50%", boxSizing: "border-box", padding: "3px 0", fontSize: "12.5px" },
      el("span", { fontWeight: "700", color: "#57534e" }, `${label}: `),
      el("span", { color: "#1c1917" }, value)
    );

  const meta = el(
    "div",
    { display: "flex", flexWrap: "wrap", marginTop: "14px" },
    metaItem("کد پروژه", data.meta.projectId || "—"),
    metaItem("نام پروژه", data.meta.projectName || "—"),
    metaItem("محل پروژه", data.meta.location || "—"),
    metaItem("تاریخ", formatDate(data.meta.date)),
    metaItem("مهندس ناظر", data.meta.engineerName || "—"),
    metaItem("شرکت", data.meta.companyName || "—")
  );

  return el("div", {}, band, meta);
}

/** ب) بنر نتیجه نهایی (سبز/کهربایی/قرمز یا کهربایی اگر تحلیل نشده) */
function resultBanner(result: AnalysisResult | null): HTMLElement {
  if (!result) {
    return el(
      "div",
      {
        background: "#f59e0b",
        color: "#1c1917",
        fontWeight: "700",
        fontSize: "14px",
        borderRadius: "10px",
        padding: "14px 18px",
        marginTop: "16px",
      },
      "تحلیل اجرا نشده است"
    );
  }
  return el(
    "div",
    {
      background: BANNER_BG[result.status],
      color: "#ffffff",
      borderRadius: "10px",
      padding: "14px 18px",
      marginTop: "16px",
    },
    el(
      "div",
      { fontWeight: "700", fontSize: "15px" },
      BANNER_TITLE[result.status]
    ),
    el(
      "div",
      { fontSize: "12.5px", lineHeight: "1.8", marginTop: "4px" },
      result.conclusion
    )
  );
}

/** پ) ردیف‌های «۱. مشخصات جرثقیل» */
function craneRows(crane: Crane): Array<[string, Cell]> {
  const s = crane.specs;
  return [
    kv("مدل", crane.name),
    kv("سازنده", crane.manufacturer),
    kv("نوع", CRANE_TYPE_LABELS[crane.type]),
    kv("ظرفیت اسمی", `${num(s.maxCapacityT)} تن`),
    kv("بوم اصلی", `${num(s.mainBoomMinM)} – ${num(s.mainBoomMaxM)} متر`),
    kv(
      "جیب",
      s.jibMaxM > 0
        ? `${num(s.jibMinM)} – ${num(s.jibMaxM)} متر`
        : "—"
    ),
    kv("وزن خود جرثقیل", `${num(s.selfWeightT)} تن`),
    kv("کانترویت", `${num(s.counterweightT)} تن`),
    kv("دهانه اوت‌ریگر / شنی", `${num(s.outriggerSpanM)} متر`),
    kv("حداکثر باد مجاز", `${num(s.windLimitMs)} m/s`),
    kv("شعاع کاری", `${num(s.minRadiusM)} – ${num(s.maxRadiusM)} متر`),
  ];
}

/** ت) ردیف‌های «۲. خلاصه ورودی‌های لیفت» */
function inputRows(crane: Crane, inputs: LiftInputs): Array<[string, Cell]> {
  const gross =
    inputs.loadWeightT + inputs.hookBlockWeightT + inputs.riggingWeightT;
  const rope = effectiveRope(crane, inputs);
  const rows: Array<[string, Cell]> = [
    kv("وزن بار", `${num(inputs.loadWeightT)} تن`),
    kv(
      "ابعاد بار (طول×عرض×ارتفاع)",
      `${num(inputs.loadDims.lengthM)} × ${num(inputs.loadDims.widthM)} × ${num(
        inputs.loadDims.heightM
      )} متر`
    ),
    kv("وزن بلاک قلاب", `${num(inputs.hookBlockWeightT)} تن`),
    kv("وزن ریگینگ", `${num(inputs.riggingWeightT)} تن`),
    kv("بار کل", { text: `${num(gross)} تن`, color: "#b45309", bold: true }),
    kv("تعداد اسلینگ", num(inputs.rigging.slingCount)),
    kv("زاویه اسلینگ از افق", `${num(inputs.rigging.slingAngleDeg)}°`),
    kv("تیر پخش‌کننده", inputs.rigging.useSpreader ? "بله" : "خیر"),
    kv(
      "تعداد رشته سیم بکسل (قرقره)",
      `${rope.parts} رشته${
        rope.overridden ? " — سیم از محاسبه‌گر" : " — سیم پیش‌فرض جرثقیل"
      }`
    ),
    kv(
      "مشخصات سیم بکسل وینچ",
      `${num(rope.diameterMm)}mm ${
        rope.core === "IWRC" ? "مغز فولادی (IWRC)" : "مغز کنفی (FC)"
      } — MBL ${num(rope.mblT)} تن / SWL ${num(rope.swlT)} تن`
    ),
    kv(
      "کشش هر رشته سیم",
      `${num(gross / rope.parts)} تن (ظرفیت قلاب محدود به سیم: ${num(
        rope.parts * rope.swlT
      )} تن)`
    ),
    kv("شعاع کاری", `${num(inputs.radiusM)} متر`),
    kv("طول بوم", `${num(inputs.boomLengthM)} متر`),
    kv(
      "زاویه بوم",
      crane.type === "tower" ? "—" : `${num(inputs.boomAngleDeg)}°`
    ),
    kv(
      "جیب",
      inputs.useJib
        ? `${num(inputs.jibLengthM)} متر / ${num(inputs.jibAngleDeg)}°`
        : "بدون جیب"
    ),
    kv("ارتفاع قلاب مورد نیاز", `${num(inputs.requiredHookHeightM)} متر`),
    kv("ارتفاع بار هنگام برداشت (A)", `${num(inputs.pickHeightM)} متر`),
    kv("ارتفاع جایگذاری بار (B)", `${num(inputs.placeHeightM)} متر`),
    kv(
      "سرعت باد",
      `${num(inputs.windSpeedMs)} m/s${inputs.windGust ? " (تندباد)" : ""}`
    ),
    kv("شیب زمین", `${num(inputs.groundSlopeDeg)}°`),
    kv("ضریب ایمنی", `× ${num(inputs.safetyFactor)}`),
    kv("زاویه چرخش", `${num(inputs.slewAngleDeg)}°`),
  ];
  const notes = inputs.notes.trim();
  if (notes) rows.push(kv("یادداشت‌ها", notes));
  return rows;
}

/** یک تصویر با کپشن */
function figure(src: string, caption: string): HTMLElement {
  const img = el("img", {
    width: "350px",
    height: "200px",
    objectFit: "contain",
    border: "1px solid #d4d4d8",
    borderRadius: "8px",
    background: "#fafaf9",
  });
  img.src = src;
  img.alt = caption;
  return el(
    "div",
    { textAlign: "center" },
    img,
    el(
      "div",
      { fontSize: "11.5px", color: "#57534e", marginTop: "4px" },
      caption
    )
  );
}

/** ث) بلوک «۳. تصاویر» — فقط اگر دست‌کم یک تصویر موجود باشد */
function imagesBlock(data: ReportData): HTMLElement | null {
  const items: HTMLElement[] = [];
  if (data.screenshot3D)
    items.push(
      figure(
        data.screenshot3D,
        "نمای سه‌بعدی صحنه — جرثقیل، پرچم‌های A/B و تجهیزات محوطه (زاویه بوم و مشخصات روی صحنه)"
      )
    );
  if (data.chartImage)
    items.push(figure(data.chartImage, "منحنی لودچارت (ظرفیت-شعاع)"));
  if (items.length === 0) return null;
  return el(
    "div",
    { display: "flex", flexWrap: "wrap", gap: "18px", marginTop: "4px" },
    ...items
  );
}

/** ج۲) بلوک «۴. صحنه سه‌بعدی و تجهیزات محوطه» — موقعیت‌ها + جدول تجهیزات */
function sceneBlock(data: ReportData): HTMLElement {
  const wrap = el("div", {});

  const o = data.cranePos ?? null;
  const posText = o ? `X = ${num(o.x)} m ، Z = ${num(o.z)} m` : "مرکز صحنه (0، 0)";

  const kvRows: Array<[string, Cell]> = [
    ["محل استقرار جرثقیل", posText],
    ["ارتفاع برداشت بار (A)", `${num(data.inputs.pickHeightM)} متر`],
    ["ارتفاع جایگذاری بار (B)", `${num(data.inputs.placeHeightM)} متر`],
    ["شیب نمایشی زمین", `${num(data.inputs.groundSlopeDeg)} درجه`],
  ];
  wrap.appendChild(kvTable(kvRows));

  const objs = data.sceneObjects ?? [];
  if (objs.length === 0) {
    wrap.appendChild(
      el(
        "div",
        { fontSize: "11.5px", color: "#78716c", marginTop: "6px" },
        "تجهیز خاصی در صحنه سه‌بعدی ثبت نشده است."
      )
    );
    return wrap;
  }

  wrap.appendChild(
    el(
      "div",
      { fontSize: "11.5px", color: "#57534e", margin: "6px 0 4px" },
      `تجهیزات محوطه (${objs.length} مورد) — ابعاد پایه بر حسب متر:`
    )
  );

  const rows: Cell[][] = objs.map((obj, i) => {
    const m = SCENE_OBJECT_CATALOG[obj.type];
    const dims = `${num(m.w * obj.scale)}×${num(m.d * obj.scale)}×${num(m.h * obj.scale)}`;
    return [
      { text: String(i + 1), color: "#57534e" },
      sceneObjectLabel(obj.type),
      `${num(obj.x)}`, `${num(obj.z)}`,
      `${num(obj.rotDeg)}°`,
      dims,
    ];
  });
  wrap.appendChild(
    table(
      ["#", "نوع تجهیز", "X (m)", "Z (m)", "چرخش", "ابعاد (ط×ع×ح)"],
      rows,
      { centerCols: [0, 2, 3, 4, 5] }
    )
  );
  return wrap;
}

/** ج) ردیف‌های «۴. نتایج تحلیل» — مقادیر null → «—» */
function resultRows(result: AnalysisResult | null): Array<[string, Cell]> {
  let utilization: Cell = "—";
  const up = result?.utilizationPct;
  if (up !== null && up !== undefined && Number.isFinite(up)) {
    utilization = {
      text: `${up.toFixed(1)}٪`,
      bold: true,
      color: up > 100 ? "#dc2626" : up >= 80 ? "#b45309" : "#16a34a",
    };
  }

  let hookMargin: Cell = "—";
  const hm = result?.hookHeightMarginM;
  if (hm !== null && hm !== undefined && Number.isFinite(hm)) {
    hookMargin = {
      text: `${hm.toFixed(1)} متر`,
      color: hm < 0 ? "#dc2626" : "#1c1917",
    };
  }

  const rated: Cell =
    result === null
      ? "—"
      : result.ratedCapacityT === null
      ? "خارج از محدوده"
      : `${result.ratedCapacityT.toFixed(1)} تن`;

  return [
    kv("ظرفیت مجاز لودچارت", rated),
    kv("ظرفیت با مارجین ایمنی", fmtNum(result?.effectiveCapacityT, "تن")),
    kv("بار کل", fmtNum(result?.grossLoadT, "تن")),
    kv("درصد استفاده از ظرفیت", utilization),
    kv("گشتاور بار", fmtNum(result?.loadMomentTm, "t·m")),
    kv("گشتاور مجاز", fmtNum(result?.allowedMomentTm, "t·m")),
    kv("نسبت گشتاور", fmtNum(result?.momentRatioPct, "٪")),
    kv("زاویه بوم", fmtNum(result?.boomAngleDeg, "°")),
    kv("شعاع نوک بوم/جیب", fmtNum(result?.tipRadiusM, "متر")),
    kv("ارتفاع نوک", fmtNum(result?.tipHeightM, "متر")),
    kv("ارتفاع قابل استفاده قلاب", fmtNum(result?.availableHookHeightM, "متر")),
    kv("مارجین ارتفاع", hookMargin),
    kv("کشش هر اسلینگ", fmtNum(result?.slingTensionT, "تن")),
    kv("ضریب بار اسلینگ", fmtNum(result?.slingLoadFactorPct, "٪")),
    kv("تعداد رشته در قلاب", result?.partsOfLine != null ? `${result.partsOfLine} رشته` : "—"),
    kv("کشش هر رشته سیم", fmtNum(result?.linePullPerPartT, "تن", 2)),
    kv("ظرفیت کاری هر رشته (MBL÷۵)", fmtNum(result?.ropeSWLT, "تن", 2)),
    kv("ظرفیت قلاب محدود به سیم بکسل", fmtNum(result?.ropeLimitedCapacityT, "تن")),
    kv("نسبت باد به حد مجاز", fmtNum(result?.windRatioPct, "٪")),
  ];
}

/** و) بلوک «۷. شبیه‌سازی جابجایی دوعرشه‌ای» — جدول دو نقطه + ایرادها و راهکار */
function transferBlock(transfer: TransferResult): HTMLElement {
  const wrap = el("div", {});
  wrap.appendChild(h2("۸. شبیه‌سازی جابجایی دوپرچمی (A → B)"));

  // بنر وضعیت کل
  wrap.appendChild(
    el(
      "div",
      {
        background: BANNER_BG[transfer.status],
        color: "#ffffff",
        borderRadius: "8px",
        padding: "10px 16px",
        marginTop: "4px",
      },
      el(
        "div",
        { fontWeight: "700", fontSize: "13.5px" },
        `نتیجه جابجایی: ${STATUS_LABELS[transfer.status]}`
      ),
      el(
        "div",
        { fontSize: "12px", lineHeight: "1.8", marginTop: "3px" },
        transfer.conclusion
      )
    )
  );

  // جدول هر نقطه
  const rows: Cell[][] = transfer.points.map((p) => {
    const up = p.result.utilizationPct;
    const util: Cell =
      up !== null && up !== undefined && Number.isFinite(up)
        ? {
            text: `${up.toFixed(1)}٪`,
            bold: true,
            color: up > 100 ? "#dc2626" : up >= 80 ? "#b45309" : "#16a34a",
          }
        : "—";
    return [
      `${p.point} — ${p.title}`,
      `${num(p.radiusM)} متر`,
      p.boomAngleDeg != null ? `${num(p.boomAngleDeg)}°` : "—",
      p.result.ratedCapacityT === null
        ? "خارج از محدوده"
        : `${num(p.result.ratedCapacityT)} تن`,
      util,
      STATUS_LABELS[p.result.status],
    ];
  });
  wrap.appendChild(
    table(
      ["نقطه", "شعاع", "زاویه بوم", "ظرفیت مجاز", "استفاده از ظرفیت", "وضعیت"],
      rows,
      { centerCols: [1, 2, 3, 4, 5] }
    )
  );

  // ایرادها + راهکار اصلاح
  if (transfer.issues.length > 0) {
    const list = el("div", { marginTop: "8px" });
    for (const issue of transfer.issues) {
      list.appendChild(
        el(
          "div",
          { display: "flex", alignItems: "flex-start", marginBottom: "6px" },
          el("span", {
            display: "inline-block",
            width: "9px",
            height: "9px",
            flexShrink: "0",
            background: WARNING_COLORS[issue.level],
            borderRadius: "2px",
            marginTop: "8px",
            marginLeft: "9px",
          }),
          el(
            "div",
            {},
            el(
              "div",
              { color: "#1c1917", fontWeight: "600" },
              issue.message
            ),
            el(
              "div",
              { color: "#57534e", fontSize: "11.5px" },
              `راهکار اصلاح: ${issue.fix}`
            )
          )
        )
      );
    }
    wrap.appendChild(list);
  } else {
    wrap.appendChild(
      el(
        "div",
        { color: "#57534e", marginTop: "6px" },
        "هر دو نقطه بدون ایراد — جابجایی از نظر فنی مجاز است."
      )
    );
  }
  return wrap;
}

/** چ) بلوک «۵. جدول بررسی‌های ایمنی» با علامت ✓ / ⚠ / ✗ */
function checksBlock(result: AnalysisResult | null): HTMLElement {
  if (!result || result.checks.length === 0) {
    return el(
      "div",
      { fontSize: "12px", color: "#78716c" },
      "بررسی‌ای برای نمایش وجود ندارد (تحلیل اجرا نشده است)."
    );
  }
  return table(
    ["بررسی", "مقدار", "حد مجاز", "وضعیت"],
    result.checks.map(
      (c): Cell[] => [c.label, c.value, c.limit, CHECK_MARKS[c.level]]
    ),
    { centerCols: [3] }
  );
}

/** ح) بلوک «۶. هشدارها» — مربع رنگی بر اساس سطح + پیام */
function warningsBlock(result: AnalysisResult | null): HTMLElement {
  const wrap = el("div", {});
  const list = result?.warnings ?? [];
  if (list.length === 0) {
    wrap.appendChild(
      el("div", { color: "#57534e" }, "هشدار خاصی ثبت نشد.")
    );
    return wrap;
  }
  for (const w of list) {
    wrap.appendChild(
      el(
        "div",
        { display: "flex", alignItems: "flex-start", marginBottom: "5px" },
        el("span", {
          display: "inline-block",
          width: "9px",
          height: "9px",
          flexShrink: "0",
          background: WARNING_COLORS[w.level],
          borderRadius: "2px",
          marginTop: "8px",
          marginLeft: "9px",
        }),
        el("span", { color: "#1c1917" }, w.message)
      )
    );
  }
  return wrap;
}

/** خ) بلوک «۹. لودچارت استفاده‌شده» — بج + جدول نزدیک‌ترین سکشن به طول بوم */
function chartBlock(chart: LoadChart | null, boomLengthM: number): HTMLElement {
  const wrap = el("div", {});
  if (!chart || chart.sections.length === 0) {
    wrap.appendChild(h2("۹. لودچارت استفاده‌شده"));
    wrap.appendChild(
      el("div", { fontSize: "12px", color: "#78716c" }, "لودچارتی ثبت نشده")
    );
    return wrap;
  }

  const isCustom = chart.source === "custom";
  const badge = el(
    "span",
    {
      display: "inline-block",
      padding: "1px 12px",
      borderRadius: "999px",
      fontSize: "11px",
      fontWeight: "700",
      marginRight: "8px",
      verticalAlign: "middle",
      background: isCustom ? "#f59e0b" : "#52525b",
      color: isCustom ? "#1c1917" : "#ffffff",
    },
    isCustom ? "سفارشی" : "مرجع"
  );

  const title = h2("۹. لودچارت استفاده‌شده");
  title.appendChild(badge);
  wrap.appendChild(title);

  // نزدیک‌ترین سکشن (طول بوم) به طول بوم لیفت فعلی
  let best = chart.sections[0];
  for (const section of chart.sections) {
    if (
      Math.abs(section.boomLengthM - boomLengthM) <
      Math.abs(best.boomLengthM - boomLengthM)
    ) {
      best = section;
    }
  }

  const points = [...best.points].sort((a, b) => a.radiusM - b.radiusM);
  const shown = points.slice(0, MAX_CHART_POINTS);
  const rows: Cell[][] = shown.map((p) => [num(p.radiusM), num(p.capacityT)]);
  if (points.length > shown.length) rows.push(["...", "..."]);

  wrap.appendChild(
    el(
      "div",
      { fontSize: "11.5px", color: "#57534e", marginBottom: "6px" },
      `سکشن انتخاب‌شده: طول بوم ${num(best.boomLengthM)} متر (${points.length} نقطه)`
    )
  );
  wrap.appendChild(
    table(["شعاع (م)", "ظرفیت مجاز (تن)"], rows, { centerCols: [0, 1] })
  );
  return wrap;
}

/** د) بلوک «۹. توصیه‌های ایمنی» — چک‌لیست ثابت با پیشوند □ */
function safetyTipsBlock(): HTMLElement {
  const wrap = el("div", {});
  for (const tip of SAFETY_TIPS) {
    wrap.appendChild(
      el(
        "div",
        { display: "flex", alignItems: "flex-start", marginBottom: "4px" },
        el("span", { color: "#b45309", fontWeight: "700", marginLeft: "8px" }, "□"),
        el("span", { color: "#1c1917" }, tip)
      )
    );
  }
  return wrap;
}

/** یک کادر امضا */
function signBox(title: string): HTMLElement {
  return el(
    "div",
    {
      width: "48%",
      height: "100px",
      border: "2px dashed #737373",
      borderRadius: "8px",
      boxSizing: "border-box",
      padding: "10px 14px",
    },
    el(
      "div",
      { fontWeight: "700", fontSize: "12.5px", color: "#44403c" },
      title
    ),
    el(
      "div",
      { fontSize: "11.5px", color: "#78716c", marginTop: "8px" },
      "نام: ............"
    ),
    el(
      "div",
      { fontSize: "11.5px", color: "#78716c" },
      "تاریخ: ............"
    )
  );
}

/** ذ) بلوک «۱۰. تأییدات» — دو کادر امضا کنار هم */
function signaturesBlock(): HTMLElement {
  return el(
    "div",
    { display: "flex", justifyContent: "space-between" },
    signBox("امضا و مهر — مهندس ناظر"),
    signBox("امضا و مهر — سرپرست لیفت")
  );
}

/** ر) پانوشت گزارش */
function footerBlock(): HTMLElement {
  return el(
    "div",
    {
      borderTop: "1px solid #e4e4e7",
      marginTop: "28px",
      paddingTop: "10px",
      fontSize: "10.5px",
      color: "#78716c",
      lineHeight: "1.8",
    },
    el(
      "div",
      {},
      "این گزارش توسط IHMS CraneLift 3D تولید شده است. داده‌های لودچارت مرجع، تقریبی و صرفاً برای برنامه‌ریزی اولیه است؛ پیش از اجرای لیفت واقعی، لودچارت رسمی سازنده ملاک عمل است."
    ),
    el(
      "div",
      { marginTop: "2px" },
      `زمان تولید گزارش: ${new Date().toLocaleString("fa-IR")}`
    )
  );
}

// ───────────────────────── ساخت DOM گزارش ─────────────────────────

/** ساخت کامل DOM گزارش (عنصر مخفی خارج از دید — فقط استایل inline) */
function buildReportElement(data: ReportData): HTMLDivElement {
  const root = el("div", {
    position: "fixed",
    left: "-20000px",
    top: "0",
    width: `${REPORT_W_PX}px`,
    background: "#ffffff",
    color: "#1c1917",
    fontFamily: "'Vazirmatn', Tahoma, Arial, sans-serif",
    direction: "rtl",
    padding: "32px",
    boxSizing: "border-box",
    fontSize: "13px",
    lineHeight: "1.9",
    zIndex: "-1",
  });

  // الف) سربرگ + متادیتای پروژه
  root.appendChild(headerBand(data));
  // ب) بنر نتیجه نهایی
  root.appendChild(resultBanner(data.result));
  // پ) ۱. مشخصات جرثقیل
  root.appendChild(h2("۱. مشخصات جرثقیل"));
  root.appendChild(kvTable(craneRows(data.crane)));
  // ت) ۲. خلاصه ورودی‌های لیفت
  root.appendChild(h2("۲. خلاصه ورودی‌های لیفت"));
  root.appendChild(kvTable(inputRows(data.crane, data.inputs)));
  // ث) ۳. تصاویر (فقط در صورت وجود)
  const images = imagesBlock(data);
  if (images) {
    root.appendChild(h2("۳. تصاویر"));
    root.appendChild(images);
  }
  // ج۲) ۴. صحنه سه‌بعدی و تجهیزات محوطه
  root.appendChild(h2("۴. صحنه سه‌بعدی و تجهیزات محوطه"));
  root.appendChild(sceneBlock(data));
  // ج) ۵. نتایج تحلیل
  root.appendChild(h2("۵. نتایج تحلیل"));
  root.appendChild(kvTable(resultRows(data.result)));
  // چ) ۶. جدول بررسی‌های ایمنی
  root.appendChild(h2("۶. جدول بررسی‌های ایمنی"));
  root.appendChild(checksBlock(data.result));
  // ح) ۷. هشدارها
  root.appendChild(h2("۷. هشدارها"));
  root.appendChild(warningsBlock(data.result));
  // و) ۸. شبیه‌سازی جابجایی دوعرچه‌ای (در صورت اجرا)
  if (data.transfer) {
    root.appendChild(transferBlock(data.transfer));
  }
  // خ) ۹. لودچارت استفاده‌شده
  root.appendChild(chartBlock(data.chart, data.inputs.boomLengthM));
  // د) ۱۰. توصیه‌های ایمنی
  root.appendChild(h2("۱۰. توصیه‌های ایمنی"));
  root.appendChild(safetyTipsBlock());
  // ذ) ۱۱. تأییدات
  root.appendChild(h2("۱۱. تأییدات"));
  root.appendChild(signaturesBlock());
  // ر) پانوشت
  root.appendChild(footerBlock());

  // ── واترمارک نسخه رایگان ──
  if (data.planType === "free") {
    const wm = (topPct: number): HTMLElement => {
      const w = el(
        "div",
        {
          position: "absolute",
          left: "50%",
          top: `${topPct}%`,
          transform: "translate(-50%, -50%) rotate(-24deg)",
          fontSize: "44px",
          fontWeight: "700",
          color: "rgba(120, 113, 108, 0.13)",
          whiteSpace: "nowrap",
          pointerEvents: "none",
          direction: "ltr",
          letterSpacing: "3px",
        },
        "FREE VERSION — IHMS CraneLift 3D"
      );
      return w;
    };
    root.style.position = "fixed"; // اطمینان از anchor مطلق
    root.appendChild(wm(18));
    root.appendChild(wm(52));
    root.appendChild(wm(86));
  }

  return root;
}

// ───────────────────────── رندر و خروجی ─────────────────────────

/**
 * ساخت DOM + رندر کل گزارش به یک Canvas با html2canvas.
 * عنصر موقت همیشه در finally از body حذف می‌شود.
 */
async function renderReportCanvas(data: ReportData): Promise<HTMLCanvasElement> {
  const { default: html2canvas } = await import("html2canvas-pro");
  const element = buildReportElement(data);
  document.body.appendChild(element);
  try {
    await document.fonts.ready;
    return await html2canvas(element, {
      scale: RENDER_SCALE,
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false,
    });
  } finally {
    element.remove();
  }
}

/**
 * تولید و دانلود گزارش PDF چندصفحه‌ای A4 (فارسی، RTL).
 * فقط در مرورگر صدا زده شود — ارورها با پیام فارسی مجدداً پرتاب می‌شوند.
 */
export async function downloadPDFReport(data: ReportData): Promise<void> {
  try {
    const canvas = await renderReportCanvas(data);
    const { jsPDF } = await import("jspdf");

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
      compress: true,
    });
    pdf.setProperties({
      title: `IHMS CraneLift Report — ${data.meta.projectId}`,
      creator: "IHMS CraneLift 3D",
    });

    // برش عمودی گزارش به صفحات A4
    const imgWidth = PAGE_W_MM; // میلی‌متر
    const pxPerMm = canvas.width / imgWidth;
    const pageHeightPx = Math.floor(PAGE_H_MM * pxPerMm);

    let offsetPx = 0;
    let pageIndex = 0;
    while (offsetPx < canvas.height) {
      const sliceHeightPx = Math.min(pageHeightPx, canvas.height - offsetPx);

      const slice = document.createElement("canvas");
      slice.width = canvas.width;
      slice.height = sliceHeightPx;
      const ctx = slice.getContext("2d");
      if (!ctx) throw new Error("دسترسی به زمینه بوم (2D context) ممکن نیست.");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, slice.width, slice.height);
      ctx.drawImage(canvas, 0, -offsetPx);

      const sliceHeightMm = sliceHeightPx / pxPerMm;
      if (pageIndex > 0) pdf.addPage();
      pdf.addImage(
        slice.toDataURL("image/jpeg", JPEG_QUALITY),
        "JPEG",
        0,
        0,
        imgWidth,
        sliceHeightMm
      );

      offsetPx += sliceHeightPx;
      pageIndex += 1;
    }

    pdf.save(`IHMS-CraneLift-Report-${data.meta.projectId}.pdf`);
  } catch (err) {
    throw new Error(
      `خطا در ساخت گزارش PDF: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

/**
 * ساخت پیش‌نمایش سریع گزارش به‌صورت dataURL تصویر PNG
 * (کل گزارش در یک تصویر — برای نمایش زنده قبل از دانلود).
 * فقط در مرورگر صدا زده شود.
 */
export async function buildReportDataURL(data: ReportData): Promise<string> {
  try {
    const canvas = await renderReportCanvas(data);
    return canvas.toDataURL("image/png");
  } catch (err) {
    throw new Error(
      `خطا در ساخت گزارش PDF: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}
