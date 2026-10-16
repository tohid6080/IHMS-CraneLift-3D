"use client";

/**
 * IHMS CraneLift 3D — نمای جدولی لودچارت (سبک کاتالوگ سازنده)
 * -----------------------------------------------------------
 * جدول اصلی کاتالوگ مثل PDF سازنده:
 *   • ردیف‌ها = شعاع کار (صعودی — اجتماع نقاط همه سکشن‌ها)
 *   • ستون‌ها = طول بوم (صعودی — هر ستون یک LoadChartSection)
 *   • سلول‌ها = ظرفیت بر حسب «تن»؛ تقاطع خالی «—»
 * ستون اول (شعاع) و هدر Sticky هستند و با RTL سازگارند (لبه شروع = راست).
 *
 * ویرایش (editable): هر سلول یک Input کوچک با state متنی محلی است تا تایپ
 * اعشار روان باشد. قوانین ثبت:
 *   • متن خالی  → حذف نقطه (جفت شعاع/ظرفیت) از آن سکشن
 *   • عدد مثبت  → upsert نقطه در سکشن همان ستون (گرد به ۲ رقم، > ۰)
 *   • نامعتبر   → بی‌اثر (در blur به مقدار واقعی برمی‌گردد)
 * اگر سکشنِ ستون وجود نداشته باشد، upsert همان را می‌سازد؛ اجتماع شعاع‌ها
 * به‌صورت مشتق‌شده از props بازمحاسبه می‌شود. خروجی همیشه از طریق
 * onEdit(nextSections) به والد می‌رود (والد با updateActivePageSections
 * می‌پیچد).
 *
 * نوار ابزار مدیریت ردیف/ستون فقط در حالت ویرایش رندر می‌شود.
 */

import { useState } from "react";
import type { CSSProperties } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { LoadChart, LoadChartSection } from "@/lib/cranelift/types";

export interface LoadChartTableViewProps {
  chart: LoadChart;
  editable: boolean;
  onEdit: (nextSections: LoadChartSection[]) => void;
  highlight?: {
    radiusM?: number;
    grossLoadT?: number;
    boomLengthM?: number;
  };
}

/** گرد به ۲ رقم اعشار */
const round2 = (v: number): number => Math.round(v * 100) / 100;
/** گرد به ۱ رقم اعشار */
const round1 = (v: number): number => Math.round(v * 10) / 10;
/** نمایش عدد بدون صفرهای انتهایی */
const fmt = (v: number): string => String(round2(v));

// ── استایل‌های Sticky — سازگار با RTL (لبه شروع = راست) ──
const START_STICKY: CSSProperties = {
  position: "sticky",
  insetInlineStart: 0,
  zIndex: 5,
};
const END_STICKY: CSSProperties = {
  position: "sticky",
  insetInlineEnd: 0,
  zIndex: 5,
};
const TOP_STICKY: CSSProperties = { position: "sticky", top: 0, zIndex: 10 };
const TOP_STICKY_2: CSSProperties = { position: "sticky", top: 32, zIndex: 10 };
const CORNER_STICKY: CSSProperties = {
  position: "sticky",
  top: 0,
  insetInlineStart: 0,
  zIndex: 20,
};
const END_HEAD_STICKY: CSSProperties = {
  position: "sticky",
  top: 0,
  insetInlineEnd: 0,
  zIndex: 20,
};

const TD_BASE = "border-b px-1.5 py-1 text-center align-middle";

export default function LoadChartTableView({
  chart,
  editable,
  onEdit,
  highlight,
}: LoadChartTableViewProps) {
  // ── state محلی ──
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [newRadiusDraft, setNewRadiusDraft] = useState("");
  const [newBoomDraft, setNewBoomDraft] = useState("");

  // ── داده‌های مشتق‌شده (سبک — در هر رندر محاسبه می‌شود) ──
  const sections: LoadChartSection[] = [...chart.sections].sort(
    (a, b) => a.boomLengthM - b.boomLengthM
  );
  const booms = sections.map((s) => s.boomLengthM);

  const radiusSet = new Set<number>();
  const capMap = new Map<string, number>();
  for (const s of sections) {
    for (const p of s.points) {
      radiusSet.add(p.radiusM);
      capMap.set(`${s.boomLengthM}|${p.radiusM}`, p.capacityT);
    }
  }
  const radii = [...radiusSet].sort((a, b) => a - b);

  // هایلایت: نزدیک‌ترین ستون بوم + نزدیک‌ترین ردیف شعاع (حلقه کهربایی)
  const nearestBoom =
    highlight?.boomLengthM !== undefined && booms.length > 0
      ? booms.reduce((best, b) =>
          Math.abs(b - highlight.boomLengthM!) <
          Math.abs(best - highlight.boomLengthM!)
            ? b
            : best
        )
      : null;
  const nearestRadius =
    highlight?.radiusM !== undefined && radii.length > 0
      ? radii.reduce((best, r) =>
          Math.abs(r - highlight.radiusM!) <
          Math.abs(best - highlight.radiusM!)
            ? r
            : best
        )
      : null;

  // ستون هدف «افزودن شعاع»: تطابق دقیق با highlight وگرنه اولین ستون
  const targetBoom: number | null =
    highlight?.boomLengthM !== undefined &&
    booms.includes(highlight.boomLengthM)
      ? highlight.boomLengthM
      : booms.length > 0
        ? booms[0]
        : null;

  // ── عملگرهای ویرایش ──

  /** ثبت مقدار یک سلول: خالی = حذف نقطه | عدد مثبت = upsert | نامعتبر = بی‌اثر */
  const commitCell = (boom: number, radius: number, raw: string) => {
    const text = raw.trim();
    const next = structuredClone(sections);
    const si = next.findIndex((s) => s.boomLengthM === boom);
    if (text === "") {
      if (si === -1) return; // چیزی برای حذف نیست
      next[si] = {
        ...next[si],
        points: next[si].points.filter((p) => p.radiusM !== radius),
      };
      onEdit(next);
      return;
    }
    const v = parseFloat(text);
    if (!isFinite(v) || v <= 0) return; // نامعتبر → بدون ثبت (revert)
    const cap = round2(v);
    if (si === -1) {
      // سکشن ستون وجود ندارد → ساخته می‌شود
      next.push({
        boomLengthM: boom,
        points: [{ radiusM: radius, capacityT: cap }],
      });
    } else {
      const pi = next[si].points.findIndex((p) => p.radiusM === radius);
      if (pi >= 0) next[si].points[pi] = { radiusM: radius, capacityT: cap };
      else next[si].points.push({ radiusM: radius, capacityT: cap });
    }
    onEdit(next);
  };

  const parsedRadius = parseFloat(newRadiusDraft);
  const radiusTaken =
    isFinite(parsedRadius) && radiusSet.has(round2(parsedRadius));
  const canAddRadius =
    isFinite(parsedRadius) &&
    parsedRadius > 0 &&
    !radiusTaken &&
    booms.length > 0;

  const parsedBoom = parseFloat(newBoomDraft);
  const canAddBoom =
    isFinite(parsedBoom) &&
    parsedBoom > 0 &&
    !booms.includes(round1(parsedBoom));

  /** افزودن ردیف شعاع: نقطه با ظرفیت موقت ۰٫۱ تن در ستون هدف */
  const addRadius = () => {
    if (!canAddRadius || targetBoom === null) return;
    const radius = round2(parsedRadius);
    const next = structuredClone(sections);
    const sec = next.find((s) => s.boomLengthM === targetBoom);
    if (!sec) return;
    sec.points.push({ radiusM: radius, capacityT: 0.1 });
    onEdit(next);
    setNewRadiusDraft("");
  };

  /** افزودن ستون بوم: سکشن خالی → ستون جدید از «—» */
  const addBoom = () => {
    if (!canAddBoom) return;
    const boom = round1(parsedBoom);
    onEdit([...structuredClone(sections), { boomLengthM: boom, points: [] }]);
    setNewBoomDraft("");
  };

  /** حذف ستون (کل سکشن) — حداقل یک ستون می‌ماند */
  const deleteColumn = (boom: number) => {
    if (sections.length <= 1) return;
    onEdit(structuredClone(sections).filter((s) => s.boomLengthM !== boom));
  };

  /** حذف ردیف شعاع از همه ستون‌ها */
  const deleteRow = (radius: number) => {
    onEdit(
      structuredClone(sections).map((s) => ({
        ...s,
        points: s.points.filter((p) => p.radiusM !== radius),
      }))
    );
  };

  // ── نوار ابزار (فقط ویرایش) ──
  const radiusPlaceholder =
    radii.length > 0 ? fmt(round1(radii[radii.length - 1] + 1)) : "3";
  const boomPlaceholder =
    booms.length > 0 ? fmt(round1(Math.max(...booms) + 5)) : "45";

  const toolbar = editable ? (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border bg-muted/30 p-2.5">
      <div className="flex items-center gap-1.5">
        <Input
          type="number"
          dir="ltr"
          inputMode="decimal"
          min={0}
          step={0.1}
          className="h-8 w-24 text-center text-xs"
          placeholder={radiusPlaceholder}
          aria-label="مقدار شعاع جدید (متر)"
          value={newRadiusDraft}
          onChange={(e) => setNewRadiusDraft(e.target.value)}
        />
        <Button
          size="sm"
          variant="outline"
          className="h-8"
          disabled={!canAddRadius}
          onClick={addRadius}
        >
          <Plus aria-hidden="true" /> افزودن شعاع
        </Button>
      </div>
      <div className="flex items-center gap-1.5">
        <Input
          type="number"
          dir="ltr"
          inputMode="decimal"
          min={0}
          step={0.1}
          className="h-8 w-24 text-center text-xs"
          placeholder={boomPlaceholder}
          aria-label="طول بوم جدید (متر)"
          value={newBoomDraft}
          onChange={(e) => setNewBoomDraft(e.target.value)}
        />
        <Button
          size="sm"
          variant="outline"
          className="h-8"
          disabled={!canAddBoom}
          onClick={addBoom}
        >
          <Plus aria-hidden="true" /> افزودن طول بوم
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        {targetBoom !== null ? (
          <>
            شعاع جدید با ظرفیت موقت ۰٫۱ تن به ستون «بوم{" "}
            <span dir="ltr">{fmt(targetBoom)}</span> م» اضافه می‌شود؛ سپس مقدار
            واقعی را در سلول وارد کنید.
          </>
        ) : (
          <>برای شروع، ابتدا یک طول بوم اضافه کنید.</>
        )}
      </p>
    </div>
  ) : null;

  // ── حالت بدون ستون (بدون سکشن) ──
  if (booms.length === 0) {
    return (
      <div className="space-y-3">
        <div className="flex h-32 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
          جدول خالی است — برای شروع یک «طول بوم» اضافه کنید.
        </div>
        {toolbar}
      </div>
    );
  }

  // ── جدول اصلی ──
  return (
    <div className="space-y-3">
      <div className="scroll-slim max-h-[520px] overflow-auto rounded-lg border">
        <table className="w-full min-w-max border-separate border-spacing-0 text-xs tabular-nums">
          <thead>
            <tr>
              <th
                scope="col"
                rowSpan={2}
                style={CORNER_STICKY}
                className="min-w-24 border-b bg-muted px-2 text-center font-semibold"
              >
                شعاع{" "}
                <span className="font-normal text-muted-foreground">(متر)</span>
              </th>
              <th
                scope="colgroup"
                colSpan={booms.length}
                style={TOP_STICKY}
                className="h-8 border-b bg-muted px-2 text-center font-semibold"
              >
                طول بوم (متر) — ظرفیت{" "}
                <span className="font-normal text-muted-foreground">(تن)</span>
              </th>
              {editable && (
                <th
                  scope="col"
                  rowSpan={2}
                  aria-hidden="true"
                  style={END_HEAD_STICKY}
                  className="w-9 border-b border-s bg-muted"
                />
              )}
            </tr>
            <tr>
              {sections.map((s) => (
                <th
                  key={`boom-${s.boomLengthM}`}
                  scope="col"
                  style={TOP_STICKY_2}
                  className="h-8 min-w-16 border-b bg-muted px-1.5 text-center font-semibold"
                >
                  <span className="inline-flex items-center gap-0.5" dir="ltr">
                    {fmt(s.boomLengthM)}
                    {editable && (
                      <button
                        type="button"
                        aria-label={`حذف ستون بوم ${fmt(s.boomLengthM)} متر`}
                        title="حذف کل این ستون"
                        disabled={sections.length <= 1}
                        onClick={() => deleteColumn(s.boomLengthM)}
                        className="rounded-sm p-0.5 text-muted-foreground transition-colors hover:text-destructive disabled:opacity-30"
                      >
                        <X className="size-3" aria-hidden="true" />
                      </button>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {radii.length === 0 ? (
              <tr>
                <td
                  colSpan={booms.length + (editable ? 2 : 1)}
                  className="px-3 py-8 text-center text-muted-foreground"
                >
                  هیچ شعاعی ثبت نشده — از «افزودن شعاع» استفاده کنید یا مقدار
                  یکی از سلول‌ها را وارد کنید.
                </td>
              </tr>
            ) : (
              radii.map((r, ri) => {
                const tinted =
                  highlight?.radiusM !== undefined && r === highlight.radiusM;
                const rowBg = tinted
                  ? "bg-amber-500/10"
                  : ri % 2 === 1
                    ? "bg-muted/40"
                    : "bg-background";
                return (
                  <tr key={`r-${r}`}>
                    <th
                      scope="row"
                      style={START_STICKY}
                      className={`border-b border-s px-2 text-center font-semibold ${rowBg}`}
                    >
                      <span dir="ltr">{fmt(r)}</span>
                    </th>
                    {sections.map((s) => {
                      const key = `${s.boomLengthM}|${r}`;
                      const cap = capMap.get(key);
                      const ringed =
                        nearestBoom === s.boomLengthM && nearestRadius === r;
                      return (
                        <td
                          key={key}
                          className={`${TD_BASE} ${rowBg} ${
                            ringed ? "ring-2 ring-inset ring-amber-500" : ""
                          }`}
                        >
                          {editable ? (
                            <Input
                              type="number"
                              dir="ltr"
                              inputMode="decimal"
                              min={0}
                              step={0.1}
                              className="h-8 w-full min-w-14 rounded-sm border-transparent bg-transparent px-1 text-center text-xs shadow-none hover:border-input focus-visible:border-input focus-visible:ring-1"
                              aria-label={`ظرفیت بوم ${fmt(s.boomLengthM)} متر در شعاع ${fmt(r)} متر (تن)`}
                              value={drafts[key] ?? (cap !== undefined ? fmt(cap) : "")}
                              onChange={(e) => {
                                const raw = e.target.value;
                                setDrafts((d) => ({ ...d, [key]: raw }));
                                commitCell(s.boomLengthM, r, raw);
                              }}
                              onBlur={() =>
                                setDrafts((d) => {
                                  if (!(key in d)) return d;
                                  const nextDrafts = { ...d };
                                  delete nextDrafts[key];
                                  return nextDrafts;
                                })
                              }
                            />
                          ) : cap !== undefined ? (
                            <span dir="ltr">{fmt(cap)}</span>
                          ) : (
                            <span className="text-muted-foreground/60">—</span>
                          )}
                        </td>
                      );
                    })}
                    {editable && (
                      <td
                        style={END_STICKY}
                        className={`w-9 border-b border-s px-1 text-center ${rowBg}`}
                      >
                        <button
                          type="button"
                          aria-label={`حذف ردیف شعاع ${fmt(r)} متر از همه ستون‌ها`}
                          title="حذف این شعاع از همه ستون‌ها"
                          onClick={() => deleteRow(r)}
                          className="rounded-sm p-1 text-muted-foreground transition-colors hover:text-destructive"
                        >
                          <X className="size-3.5" aria-hidden="true" />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {toolbar}
    </div>
  );
}
