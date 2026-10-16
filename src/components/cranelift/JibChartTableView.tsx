"use client";

/**
 * CraneLift Pro 3D — نمای جدولی ظرفیت جیب (سبک کاتالوگ TJ سازنده)
 * -----------------------------------------------------------
 * ساختار مثل کاتالوگ واقعی:
 *   • ردیف‌ها = زاویه بوم (نزولی، مثل کاتالوگ ۷۸ → ۵۶)
 *   • ستون‌ها = گروه‌بندی «طول جیب × زاویه انحراف جیب» با هدر دولایه
 *     (مثلاً «جیب ۹.۲م: ۰° | ۱۵° | ۳۰°» ، «جیب ۱۶م: ۰° | ۱۵° | ۳۰°»)
 *   • سلول‌ها = ظرفیت بر حسب «تن» یا «—» (خارج از محدوده)
 * ترتیب ستون‌ها دقیقاً با ایندکس‌گذاری lookupJibCapacity یکی است:
 *   globalIndex = jibIdx * offsetAnglesDeg.length + offsetIdx
 *
 * ویرایش (وقتی onEdit داده شده): سلول‌ها Input کوچک با state متنی محلی؛
 *   • متن خالی → null (حذف مقدار)
 *   • عدد مثبت → ثبت در row.capacities با گرد کردن به ۲ رقم
 *   • ردیف‌ها همیشه نزولی بر اساس زاویه بوم مرتب می‌مانند.
 * اگر جدول نباشد ولی onEdit داده شده باشد، می‌توان از حالت خالی یک
 * جدول سبک کاتالوگ (۹.۲ و ۱۶ متر × انحراف ۰/۱۵/۳۰) ساخت.
 */

import { useState } from "react";
import type { CSSProperties } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { JibChartRow, JibChartTable } from "@/lib/cranelift/types";

export interface JibChartTableViewProps {
  table?: JibChartTable | null;
  onEdit?: (next: JibChartTable) => void;
  highlight?: {
    boomAngleDeg?: number;
    jibLengthM?: number;
    jibAngleDeg?: number;
  };
}

/** گرد به ۲ رقم اعشار */
const round2 = (v: number): number => Math.round(v * 100) / 100;
/** نمایش عدد بدون صفرهای انتهایی */
const fmt = (v: number): string => String(round2(v));

// ── استایل‌های Sticky — سازگار با RTL ──
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

/** جدول جیب خالی سبک کاتالوگ: جیب ۹.۲ و ۱۶ م × انحراف ۰/۱۵/۳۰ — بوم ۷۸→۵۶ */
function seedEmptyJibTable(): JibChartTable {
  const rows: JibChartRow[] = [];
  for (let a = 78; a >= 56; a -= 2) {
    rows.push({
      boomAngleDeg: a,
      capacities: [null, null, null, null, null, null],
    });
  }
  return { jibLengthsM: [9.2, 16], offsetAnglesDeg: [0, 15, 30], rows };
}

export default function JibChartTableView({
  table,
  onEdit,
  highlight,
}: JibChartTableViewProps) {
  const editable = typeof onEdit === "function";

  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [newAngleDraft, setNewAngleDraft] = useState("");

  // ── جدول ثبت نشده ──
  if (!table) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-10 text-center">
        <p className="text-sm text-muted-foreground">
          جدول جیب برای این صفحه ثبت نشده است.
        </p>
        {editable && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onEdit?.(seedEmptyJibTable())}
          >
            <Plus aria-hidden="true" /> ساخت جدول جیب خالی (۹.۲ و ۱۶ م —
            انحراف ۰°/۱۵°/۳۰°)
          </Button>
        )}
      </div>
    );
  }

  const jibLens = table.jibLengthsM;
  const offsets = table.offsetAnglesDeg;
  const rows = [...table.rows].sort((a, b) => b.boomAngleDeg - a.boomAngleDeg);
  const totalCols = jibLens.length * offsets.length;
  const angles = rows.map((r) => r.boomAngleDeg);

  // ── هایلایت ──
  const hiRowAngle =
    highlight?.boomAngleDeg !== undefined && angles.length > 0
      ? angles.reduce((best, a) =>
          Math.abs(a - highlight.boomAngleDeg!) <
          Math.abs(best - highlight.boomAngleDeg!)
            ? a
            : best
        )
      : null;
  const hiJibIdx =
    highlight?.jibLengthM !== undefined && jibLens.length > 0
      ? jibLens.reduce(
          (best, len, i) =>
            Math.abs(len - highlight.jibLengthM!) <
            Math.abs(jibLens[best] - highlight.jibLengthM!)
              ? i
              : best,
          0
        )
      : null;
  // انحراف جیب نسبت به بوم مثل موتور تحلیل: |زاویه بوم − زاویه جیب|
  const hiOffVal =
    highlight?.boomAngleDeg !== undefined && highlight?.jibAngleDeg !== undefined
      ? Math.abs(highlight.boomAngleDeg - highlight.jibAngleDeg)
      : null;
  const hiOffIdx =
    hiOffVal !== null && offsets.length > 0
      ? offsets.reduce(
          (best, off, i) =>
            Math.abs(off - hiOffVal) < Math.abs(offsets[best] - hiOffVal)
              ? i
              : best,
          0
        )
      : null;

  // ── عملگرهای ویرایش ──

  /** ثبت مقدار یک سلول: خالی = null | عدد مثبت = ثبت | نامعتبر = بی‌اثر */
  const commitCell = (angle: number, colIdx: number, raw: string) => {
    if (!onEdit) return;
    const text = raw.trim();
    const nextRows = table.rows.map((row) => {
      if (row.boomAngleDeg !== angle) return row;
      const caps = [...row.capacities];
      while (caps.length <= colIdx) caps.push(null);
      if (text === "") {
        caps[colIdx] = null;
        return { ...row, capacities: caps };
      }
      const v = parseFloat(text);
      if (!isFinite(v) || v <= 0) return row; // نامعتبر → بدون ثبت
      caps[colIdx] = round2(v);
      return { ...row, capacities: caps };
    });
    onEdit({ ...table, rows: nextRows });
  };

  const parsedAngle = parseFloat(newAngleDraft);
  const canAddAngle =
    isFinite(parsedAngle) &&
    parsedAngle > 0 &&
    !angles.includes(Math.round(parsedAngle));

  /** افزودن ردیف زاویه بوم (مرتب نزولی مثل کاتالوگ) */
  const addAngle = () => {
    if (!onEdit || !canAddAngle) return;
    const angle = Math.round(parsedAngle);
    const caps = Array<number | null>(totalCols).fill(null);
    const nextRows: JibChartRow[] = [
      ...table.rows,
      { boomAngleDeg: angle, capacities: caps },
    ].sort((a, b) => b.boomAngleDeg - a.boomAngleDeg);
    onEdit({ ...table, rows: nextRows });
    setNewAngleDraft("");
  };

  /** حذف یک ردیف زاویه بوم */
  const deleteAngleRow = (angle: number) => {
    if (!onEdit) return;
    onEdit({ ...table, rows: table.rows.filter((r) => r.boomAngleDeg !== angle) });
  };

  /**
   * حذف یک «ستون انحراف» از همه جیب‌ها:
   * زاویه از offsetAnglesDeg حذف و ایندکس‌های متناظر (gi % oldLen === offIdx)
   * از capacities همه ردیف‌ها حذف می‌شود. حداقل یک انحراف می‌ماند.
   */
  const deleteOffset = (offIdx: number) => {
    if (!onEdit || offsets.length <= 1) return;
    const oldLen = offsets.length;
    const nextOffsets = offsets.filter((_, i) => i !== offIdx);
    const nextRows = table.rows.map((row) => ({
      ...row,
      capacities: row.capacities.filter((_, gi) => gi % oldLen !== offIdx),
    }));
    onEdit({ ...table, offsetAnglesDeg: nextOffsets, rows: nextRows });
  };

  // ── نوار ابزار (فقط ویرایش) ──
  const minAngle = angles.length > 0 ? angles[angles.length - 1] : 70;
  const anglePlaceholder = String(Math.max(1, Math.round(minAngle) - 2));

  const toolbar = editable ? (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border bg-muted/30 p-2.5">
      <div className="flex items-center gap-1.5">
        <Input
          type="number"
          dir="ltr"
          inputMode="numeric"
          min={0}
          step={1}
          className="h-8 w-20 text-center text-xs"
          placeholder={anglePlaceholder}
          aria-label="زاویه بوم جدید (درجه)"
          value={newAngleDraft}
          onChange={(e) => setNewAngleDraft(e.target.value)}
        />
        <Button
          size="sm"
          variant="outline"
          className="h-8"
          disabled={!canAddAngle}
          onClick={addAngle}
        >
          <Plus aria-hidden="true" /> افزودن زاویه بوم
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        ردیف‌ها مثل کاتالوگ نزولی مرتب می‌شوند (۷۸ → ۵۶). سلول خالی = «—»
        (خارج از محدوده مجاز).
      </p>
    </div>
  ) : null;

  // ── ساختار ناقص (بدون طول جیب یا بدون انحراف) ──
  if (jibLens.length === 0 || offsets.length === 0) {
    return (
      <div className="space-y-3">
        <div className="flex h-24 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
          ساختار جدول جیب ناقص است (طول جیب یا زاویه انحراف ثبت نشده).
        </div>
        {toolbar}
      </div>
    );
  }

  // ── جدول اصلی ──
  return (
    <div className="space-y-3">
      <div className="scroll-slim max-h-[420px] overflow-auto rounded-lg border">
        <table className="w-full min-w-max border-separate border-spacing-0 text-xs tabular-nums">
          <thead>
            <tr>
              <th
                scope="col"
                rowSpan={2}
                style={CORNER_STICKY}
                className="min-w-20 border-b bg-muted px-2 text-center font-semibold"
              >
                زاویه بوم{" "}
                <span className="font-normal text-muted-foreground">(درجه)</span>
              </th>
              {jibLens.map((len) => (
                <th
                  key={`jl-${len}`}
                  scope="colgroup"
                  colSpan={offsets.length}
                  style={TOP_STICKY}
                  className="h-8 border-b bg-muted px-2 text-center font-semibold"
                >
                  جیب <span dir="ltr">{fmt(len)}</span> متر
                </th>
              ))}
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
              {jibLens.map((len, ji) =>
                offsets.map((off, oi) => (
                  <th
                    key={`jc-${ji}-${oi}`}
                    scope="col"
                    style={TOP_STICKY_2}
                    className="h-8 border-b bg-muted px-1.5 text-center font-semibold"
                  >
                    <span className="inline-flex items-center gap-0.5" dir="ltr">
                      {off}°
                      {editable && (
                        <button
                          type="button"
                          aria-label={`حذف ستون انحراف ${off} درجه (در همه جیب‌ها)`}
                          title="حذف این ستون انحراف از همه جیب‌ها"
                          disabled={offsets.length <= 1}
                          onClick={() => deleteOffset(oi)}
                          className="rounded-sm p-0.5 text-muted-foreground transition-colors hover:text-destructive disabled:opacity-30"
                        >
                          <X className="size-3" aria-hidden="true" />
                        </button>
                      )}
                    </span>
                  </th>
                ))
              )}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={totalCols + (editable ? 2 : 1)}
                  className="px-3 py-8 text-center text-muted-foreground"
                >
                  هیچ زاویه بومی ثبت نشده — از «افزودن زاویه بوم» استفاده کنید.
                </td>
              </tr>
            ) : (
              rows.map((row, ri) => {
                const tinted = hiRowAngle === row.boomAngleDeg;
                const rowBg = tinted
                  ? "bg-amber-500/10"
                  : ri % 2 === 1
                    ? "bg-muted/40"
                    : "bg-background";
                return (
                  <tr key={`ja-${row.boomAngleDeg}`}>
                    <th
                      scope="row"
                      style={START_STICKY}
                      className={`border-b border-s px-2 text-center font-semibold ${rowBg}`}
                    >
                      <span dir="ltr">{row.boomAngleDeg}°</span>
                    </th>
                    {jibLens.map((len, ji) =>
                      offsets.map((off, oi) => {
                        const gi = ji * offsets.length + oi;
                        const cap = row.capacities[gi] ?? null;
                        const ringed =
                          tinted && hiJibIdx === ji && hiOffIdx === oi;
                        const key = `c-${row.boomAngleDeg}-${gi}`;
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
                                aria-label={`ظرفیت جیب ${fmt(len)} متر، انحراف ${off} درجه، بوم ${row.boomAngleDeg} درجه (تن)`}
                                value={
                                  drafts[key] ??
                                  (cap !== null ? fmt(cap) : "")
                                }
                                onChange={(e) => {
                                  const raw = e.target.value;
                                  setDrafts((d) => ({ ...d, [key]: raw }));
                                  commitCell(row.boomAngleDeg, gi, raw);
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
                            ) : cap !== null ? (
                              <span dir="ltr">{fmt(cap)}</span>
                            ) : (
                              <span className="text-muted-foreground/60">—</span>
                            )}
                          </td>
                        );
                      })
                    )}
                    {editable && (
                      <td
                        style={END_STICKY}
                        className={`w-9 border-b border-s px-1 text-center ${rowBg}`}
                      >
                        <button
                          type="button"
                          aria-label={`حذف ردیف زاویه بوم ${row.boomAngleDeg} درجه`}
                          title="حذف این ردیف"
                          onClick={() => deleteAngleRow(row.boomAngleDeg)}
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
