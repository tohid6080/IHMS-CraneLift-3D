"use client";

/**
 * CraneLift Pro 3D — مرحله ۲ ویزارد: لودچارت سبک «کاتالوگ» (جدولی)
 * -----------------------------------------------------------
 * تجربهٔ جدولی مثل کاتالوگ PDF سازنده (مثلاً SANY STC500E):
 *   • صفحات کاتالوگ = کانفیگ‌های کانترویت/قرقره (تب‌ها) با افزودن/حذف
 *   • جدول اصلی: ردیف = شعاع، ستون = طول بوم (LoadChartTableView)
 *   • جدول جیب بر اساس زاویه بوم (JibChartTableView) + یادداشت‌های کاتالوگ
 *   • تب «منحنی» همان نمای قبلی (LoadChartCurve) است
 * تمام ویرایش‌ها از helperهای load-charts (updateActivePageSections /
 * updateActivePageJibTable / updateActivePageNotes / addChartPage /
 * removeChartPage / setActivePage) + setCustomChart عبور می‌کنند؛ هر
 * ویرایش مقداری، چارت را «سفارشی» می‌کند (دادهٔ مرجع دست‌نخورده می‌ماند).
 * میزبان اسکرین‌شات منحنی در حالت «منحنی»: div#step2-chart-host؛
 * id «loadchart-curve» متعلق به CraneLiftApp است و اینجا استفاده نشده.
 */

import { useRef, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Download,
  FileDown,
  Info,
  LineChart,
  Pencil,
  Plus,
  RotateCcw,
  Table2,
  Truck,
  Upload,
  X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import JibChartTableView from "@/components/cranelift/JibChartTableView";
import LoadChartCurve from "@/components/cranelift/LoadChartCurve";
import LoadChartTableView from "@/components/cranelift/LoadChartTableView";
import { getCraneById } from "@/lib/cranelift/cranes";
import { chartToCSV, csvToChart, sampleCSV } from "@/lib/cranelift/csv";
import {
  addChartPage,
  getActivePage,
  getChartFor,
  removeChartPage,
  setActivePage,
  updateActivePageJibTable,
  updateActivePageNotes,
  updateActivePageSections,
} from "@/lib/cranelift/load-charts";
import { useLiftStore } from "@/lib/cranelift/store";
import type {
  JibChartRow,
  JibChartTable,
  LoadChart,
  LoadChartSection,
} from "@/lib/cranelift/types";

/** گرد به ۱ رقم اعشار */
const round1 = (v: number): number => Math.round(v * 10) / 10;
/** نمایش عدد بدون صفرهای انتهایی */
const fmt = (v: number): string => String(Math.round(v * 100) / 100);

/** دانلود متن به‌صورت فایل (Blob) */
function downloadTextFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * چارت ویرایش‌شده → نسخه سفارشی (والد از قبل structuredClone گرفته؛
 * این helper فقط source/updatedAt را ثبت می‌کند.)
 */
function asCustomEdition(clone: LoadChart): LoadChart {
  clone.source = "custom";
  clone.updatedAt = new Date().toISOString();
  return clone;
}

export default function Step2Chart() {
  const { toast } = useToast();

  // ── استور ──
  const selectedCraneId = useLiftStore((s) => s.selectedCraneId);
  const customCharts = useLiftStore((s) => s.customCharts);
  const setCustomChart = useLiftStore((s) => s.setCustomChart);
  const customCranes = useLiftStore((s) => s.customCranes);
  const resetChart = useLiftStore((s) => s.resetChart);
  const inputs = useLiftStore((s) => s.inputs);
  const setStep = useLiftStore((s) => s.setStep);

  // ── وضعیت محلی ──
  const [view, setView] = useState<"table" | "curve">("table");
  const [addPageOpen, setAddPageOpen] = useState(false);
  const [newPageLabel, setNewPageLabel] = useState("");
  const [newPageCw, setNewPageCw] = useState("");
  const [newPagePct, setNewPagePct] = useState("");
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const crane = getCraneById(selectedCraneId, customCranes);
  const chart = crane ? getChartFor(crane.id, customCharts) : null;

  // ═══════════════ حالت خالی: بدون جرثقیل ═══════════════
  if (!crane) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center gap-4 py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
            <Truck className="h-8 w-8 text-amber-600" aria-hidden="true" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">
            ابتدا در مرحله ۱ یک جرثقیل انتخاب کنید
          </p>
          <Button
            onClick={() => setStep(0)}
            className="bg-amber-500 text-black hover:bg-amber-600"
          >
            رفتن به انتخاب جرثقیل
          </Button>
        </CardContent>
      </Card>
    );
  }

  const activePage = chart ? getActivePage(chart) : null;

  if (!chart || !activePage) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          لودچارتی برای این جرثقیل یافت نشد؛ لودچارت را از CSV وارد کنید.
        </CardContent>
      </Card>
    );
  }

  // ═══════════════ داده‌های مشتق‌شده ═══════════════
  const pages = chart.pages ?? [];

  // سکشن‌های صفحه فعال (جدول اصلی)
  const sections: LoadChartSection[] = [...activePage.sections].sort(
    (a, b) => a.boomLengthM - b.boomLengthM
  );
  const radiusUnion = new Set<number>();
  let totalPoints = 0;
  for (const s of sections) {
    for (const p of s.points) {
      radiusUnion.add(p.radiusM);
      totalPoints++;
    }
  }
  const radii = [...radiusUnion].sort((a, b) => a - b);

  // هایلایت مشترک جدول/منحنی
  const grossLoadT =
    inputs.loadWeightT + inputs.hookBlockWeightT + inputs.riggingWeightT;
  const nearestBoom =
    sections.length > 0
      ? sections.reduce((best, s) =>
          Math.abs(s.boomLengthM - inputs.boomLengthM) <
          Math.abs(best.boomLengthM - inputs.boomLengthM)
            ? s
            : best
        ).boomLengthM
      : undefined;
  const chartHighlight = {
    radiusM: inputs.radiusM,
    grossLoadT,
    boomLengthM: nearestBoom,
  };

  // ═══════════════ عملگرهای CSV ═══════════════

  /** خروجی CSV از سکشن‌های صفحه فعال */
  const handleExportCSV = () => {
    downloadTextFile(`${crane.id}-loadchart.csv`, chartToCSV(chart));
  };

  /** دانلود فایل نمونهٔ CSV */
  const handleSampleCSV = () => {
    downloadTextFile("sample-loadchart.csv", sampleCSV());
    toast({
      title: "نمونه CSV دانلود شد",
      description:
        "فایل نمونه را بر اساس ستون‌های boom_length, radius, capacity پر کنید.",
    });
  };

  /**
   * ورود CSV: جایگزینی محتوای «صفحه فعال» با سکشن‌های فایل
   * (صفحات دیگر دست‌نخورده می‌مانند) + ثبت نسخه سفارشی
   */
  const handleImportCSV = async (file: File) => {
    try {
      const text = await file.text();
      const res = csvToChart(crane.id, text);
      if (res.chart) {
        const next = asCustomEdition(
          updateActivePageSections(structuredClone(chart), res.chart.sections)
        );
        setCustomChart(crane.id, next);
        toast({
          title: "CSV در صفحه فعال ثبت شد",
          description: `${res.rowCount} ردیف در صفحه «${activePage.label}» جایگذاری شد؛ صفحات دیگر حفظ شدند.`,
        });
      }
      if (res.errors.length > 0) {
        toast({
          title: "هشدارهای اعتبارسنجی CSV",
          description: res.errors.slice(0, 3).join(" | "),
        });
      }
    } catch {
      toast({
        title: "خطا در پردازش فایل CSV",
        description: "فایل قابل خواندن نبود؛ فایل معتبر CSV را دوباره انتخاب کنید.",
        variant: "destructive",
      });
    }
  };

  /** بازگشت به لودچارت مرجع */
  const handleResetChart = () => {
    resetChart(crane.id);
    setEditingNotes(false);
    toast({
      title: "بازگشت به مرجع",
      description: "لودچارت سفارشی حذف شد و دادهٔ مرجع بازیابی شد.",
    });
  };

  // ═══════════════ عملگرهای صفحات کاتالوگ ═══════════════

  /** ورق‌زدن صفحه فعال (برای همگام‌ماندن تحلیل، ثبت می‌شود) */
  const switchPage = (pageId: string) => {
    if (pageId === activePage.id) return;
    const next = setActivePage(structuredClone(chart), pageId);
    setCustomChart(crane.id, next);
    setEditingNotes(false);
  };

  /** افزودن صفحه جدید (کانفیگ کانترویت/قرقره) */
  const submitNewPage = () => {
    const label = newPageLabel.trim();
    if (!label) return;
    const cw = parseFloat(newPageCw);
    const pct = parseFloat(newPagePct);
    const next = asCustomEdition(
      addChartPage(
        structuredClone(chart),
        label,
        isFinite(cw) && cw > 0 ? round1(cw) : undefined,
        isFinite(pct) && pct > 0 ? Math.round(pct) : undefined
      )
    );
    setCustomChart(crane.id, next);
    setAddPageOpen(false);
    setNewPageLabel("");
    setNewPageCw("");
    setNewPagePct("");
    toast({
      title: "صفحه جدید اضافه شد",
      description: `«${label}» ساخته و فعال شد؛ جدول این صفحه خالی است.`,
    });
  };

  /** حذف صفحه فعال (حداقل یک صفحه می‌ماند) */
  const handleRemovePage = (pageId: string) => {
    if (pages.length <= 1) return;
    const next = asCustomEdition(
      removeChartPage(structuredClone(chart), pageId)
    );
    setCustomChart(crane.id, next);
    toast({
      title: "صفحه حذف شد",
      description: "صفحه از کاتالوگ سفارشی حذف شد.",
    });
  };

  // ═══════════════ عملگرهای جدول اصلی / جیب / یادداشت‌ها ═══════════════

  /** ویرایش سکشن‌های صفحه فعال از جدول کاتالوگ */
  const handleSectionsEdit = (nextSections: LoadChartSection[]) => {
    const next = asCustomEdition(
      updateActivePageSections(structuredClone(chart), nextSections)
    );
    setCustomChart(crane.id, next);
  };

  /** ویرایش جدول جیب صفحه فعال */
  const handleJibEdit = (nextTable: JibChartTable) => {
    const next = asCustomEdition(
      updateActivePageJibTable(structuredClone(chart), activePage.id, nextTable)
    );
    setCustomChart(crane.id, next);
  };

  /** ساخت جدول جیب خالی سبک کاتالوگ TJ بر اساس مشخصات جرثقیل */
  const handleSeedJib = () => {
    const lensRaw = [crane.specs.jibMinM, crane.specs.jibMaxM].filter(
      (v) => v > 0
    );
    const jibLengthsM =
      lensRaw.length > 0 ? [...new Set(lensRaw)].sort((a, b) => a - b) : [9.2, 16];
    const rows: JibChartRow[] = [];
    for (let a = 78; a >= 56; a -= 2) {
      rows.push({
        boomAngleDeg: a,
        capacities: Array<number | null>(jibLengthsM.length * 3).fill(null),
      });
    }
    const seed: JibChartTable = {
      jibLengthsM,
      offsetAnglesDeg: [0, 15, 30],
      rows,
    };
    const next = asCustomEdition(
      updateActivePageJibTable(structuredClone(chart), activePage.id, seed)
    );
    setCustomChart(crane.id, next);
    toast({
      title: "جدول جیب ساخته شد",
      description: "جدول خالی سبک کاتالوگ TJ ساخته شد؛ مقادیر را وارد کنید.",
    });
  };

  /** شروع ویرایش یادداشت‌ها (هر یادداشت یک خط) */
  const startEditNotes = () => {
    setNotesDraft(activePage.notes.join("\n"));
    setEditingNotes(true);
  };

  /** ذخیره یادداشت‌های صفحه فعال */
  const saveNotes = () => {
    const notes = notesDraft
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    const next = asCustomEdition(
      updateActivePageNotes(structuredClone(chart), notes)
    );
    setCustomChart(crane.id, next);
    setEditingNotes(false);
    toast({
      title: "یادداشت‌ها ذخیره شد",
      description: `${notes.length} یادداشت در صفحه فعال ثبت شد.`,
    });
  };

  // ═══════════════ رندر ═══════════════
  return (
    <div className="space-y-4">
      {/* هدر: عنوان + نشان منبع + تب نمایش + عملگرهای CSV */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-bold">لودچارت — {crane.name}</h2>
          {chart.source === "custom" ? (
            <Badge className="bg-amber-500 text-black">سفارشی</Badge>
          ) : (
            <Badge variant="secondary">مرجع</Badge>
          )}
          <Tabs
            value={view}
            onValueChange={(v) => setView(v as "table" | "curve")}
          >
            <TabsList aria-label="حالت نمایش لودچارت" className="h-8">
              <TabsTrigger value="table" className="gap-1.5 px-3 text-xs">
                <Table2 className="size-3.5" aria-hidden="true" /> جدول کاتالوگ
              </TabsTrigger>
              <TabsTrigger value="curve" className="gap-1.5 px-3 text-xs">
                <LineChart className="size-3.5" aria-hidden="true" /> منحنی
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={handleExportCSV}>
            <Download aria-hidden="true" /> خروجی CSV
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload aria-hidden="true" /> ورود CSV
          </Button>
          <Button size="sm" variant="outline" onClick={handleSampleCSV}>
            <FileDown aria-hidden="true" /> نمونه CSV
          </Button>
          {chart.source === "custom" && (
            <Button size="sm" variant="outline" onClick={handleResetChart}>
              <RotateCcw aria-hidden="true" /> بازگشت به مرجع
            </Button>
          )}
        </div>
      </div>

      {/* ورودی فایل مخفی برای CSV */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        className="hidden"
        aria-label="انتخاب فایل CSV لودچارت"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleImportCSV(file);
          // بازنشانی تا انتخاب دوبارهٔ همان فایل هم کار کند
          e.target.value = "";
        }}
      />

      {/* صفحات کاتالوگ (کانفیگ‌های کانترویت/قرقره) */}
      <div className="space-y-2">
        <div
          className="flex flex-wrap items-center gap-2"
          role="tablist"
          aria-label="صفحات کاتالوگ لودچارت"
        >
          <span className="text-xs font-medium text-muted-foreground">
            صفحات کاتالوگ:
          </span>
          {pages.map((p) => {
            const active = p.id === activePage.id;
            return (
              <div key={p.id} className="relative">
                <Button
                  size="sm"
                  variant={active ? "default" : "outline"}
                  role="tab"
                  aria-selected={active}
                  className={
                    active
                      ? "h-8 bg-amber-500 pe-7 text-black hover:bg-amber-600"
                      : "h-8 pe-7"
                  }
                  onClick={() => switchPage(p.id)}
                >
                  {p.label}
                </Button>
                {active && pages.length > 1 && (
                  <button
                    type="button"
                    aria-label={`حذف صفحه ${p.label}`}
                    title="حذف این صفحه"
                    onClick={() => handleRemovePage(p.id)}
                    className="absolute end-1.5 top-1/2 -translate-y-1/2 rounded-sm p-0.5 opacity-60 transition-opacity hover:text-destructive hover:opacity-100"
                  >
                    <X className="size-3.5" aria-hidden="true" />
                  </button>
                )}
              </div>
            );
          })}
          <Button
            size="sm"
            variant="outline"
            className="h-8"
            aria-expanded={addPageOpen}
            onClick={() => setAddPageOpen((o) => !o)}
          >
            <Plus aria-hidden="true" /> افزودن صفحه (کانفیگ جدید)
          </Button>
        </div>

        {/* فرم کوچک افزودن صفحه */}
        {addPageOpen && (
          <div className="flex flex-wrap items-end gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3">
            <div className="space-y-1">
              <Label htmlFor="new-page-label" className="text-xs">
                عنوان صفحه
              </Label>
              <Input
                id="new-page-label"
                value={newPageLabel}
                onChange={(e) => setNewPageLabel(e.target.value)}
                placeholder="کانترویت ۶ تن — قرقره ۱۰۰٪"
                className="h-8 w-52 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="new-page-cw" className="text-xs">
                کانترویت (تن)
              </Label>
              <Input
                id="new-page-cw"
                type="number"
                dir="ltr"
                inputMode="decimal"
                min={0}
                step={0.1}
                value={newPageCw}
                onChange={(e) => setNewPageCw(e.target.value)}
                placeholder="8.5"
                className="h-8 w-24 text-center text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="new-page-pct" className="text-xs">
                قرقره (٪)
              </Label>
              <Input
                id="new-page-pct"
                type="number"
                dir="ltr"
                inputMode="numeric"
                min={0}
                step={1}
                value={newPagePct}
                onChange={(e) => setNewPagePct(e.target.value)}
                placeholder="100"
                className="h-8 w-20 text-center text-sm"
              />
            </div>
            <Button
              size="sm"
              className="h-8 bg-amber-500 text-black hover:bg-amber-600"
              disabled={!newPageLabel.trim()}
              onClick={submitNewPage}
            >
              افزودن
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8"
              onClick={() => setAddPageOpen(false)}
            >
              انصراف
            </Button>
          </div>
        )}
      </div>

      {/* کارت اصلی: جدول کاتالوگ یا منحنی */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">جدول ظرفیت اصلی</CardTitle>
            <div className="flex flex-wrap items-center gap-1.5">
              {activePage.counterweightT !== undefined && (
                <Badge variant="outline" className="text-xs font-normal">
                  کانترویت {fmt(activePage.counterweightT)} تن
                </Badge>
              )}
              {activePage.partsOfLinePct !== undefined && (
                <Badge variant="outline" className="text-xs font-normal">
                  قرقره {activePage.partsOfLinePct}٪
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {view === "table" ? (
            <>
              {/* نوار آمار کاتالوگ */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-md border bg-muted/40 px-2.5 py-1">
                  طول‌های بوم:{" "}
                  <b dir="ltr" className="tabular-nums">
                    {sections.length}
                  </b>
                </span>
                <span className="rounded-md border bg-muted/40 px-2.5 py-1">
                  بازه شعاع:{" "}
                  {radii.length > 0 ? (
                    <b dir="ltr" className="tabular-nums">
                      {fmt(radii[0])}–{fmt(radii[radii.length - 1])}
                    </b>
                  ) : (
                    "—"
                  )}{" "}
                  متر
                </span>
                <span className="rounded-md border bg-muted/40 px-2.5 py-1">
                  تعداد نقاط:{" "}
                  <b dir="ltr" className="tabular-nums">
                    {totalPoints}
                  </b>
                </span>
                <span className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-1">
                  واحد مقادیر: تن
                </span>
              </div>
              <LoadChartTableView
                chart={chart}
                editable
                onEdit={handleSectionsEdit}
                highlight={chartHighlight}
              />
            </>
          ) : (
            <div id="step2-chart-host">
              <LoadChartCurve chart={chart} highlight={chartHighlight} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* کارت جدول جیب (برای جرثقیل برجی نمایش داده نمی‌شود) */}
      {crane.type !== "tower" && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              جدول جیب — ظرفیت بر اساس زاویه بوم
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activePage.jibTable ? (
              <JibChartTableView
                table={activePage.jibTable}
                onEdit={handleJibEdit}
                highlight={{
                  boomAngleDeg: inputs.boomAngleDeg,
                  jibLengthM: inputs.jibLengthM,
                  jibAngleDeg: inputs.jibAngleDeg,
                }}
              />
            ) : (
              <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-10 text-center">
                <p className="text-sm text-muted-foreground">
                  برای این صفحه جدول جیب ثبت نشده است.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSeedJib}
                >
                  <Plus aria-hidden="true" /> افزودن جدول جیب (مثل کاتالوگ TJ)
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* کارت یادداشت‌های کاتالوگ */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">یادداشت‌های کاتالوگ</CardTitle>
            {editingNotes ? (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="h-8 bg-amber-500 text-black hover:bg-amber-600"
                  onClick={saveNotes}
                >
                  ذخیره
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8"
                  onClick={() => setEditingNotes(false)}
                >
                  انصراف
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="h-8"
                onClick={startEditNotes}
              >
                <Pencil aria-hidden="true" /> ویرایش یادداشت‌ها
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {editingNotes ? (
            <div className="space-y-2">
              <Textarea
                rows={7}
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
                aria-label="یادداشت‌های کاتالوگ — هر یادداشت در یک خط"
                placeholder="هر یادداشت را در یک خط وارد کنید..."
                className="min-h-32 text-sm leading-7"
              />
              <p className="text-xs text-muted-foreground">
                هر خط یک یادداشت مستقل است؛ خطوط خالی نادیده گرفته می‌شوند.
                ویرایش یادداشت‌ها هم چارت را «سفارشی» می‌کند.
              </p>
            </div>
          ) : activePage.notes.length > 0 ? (
            <ol className="list-decimal space-y-1.5 ps-6 text-sm leading-7">
              {activePage.notes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted-foreground">
              یادداشتی برای این صفحه ثبت نشده است.
            </p>
          )}
        </CardContent>
      </Card>

      {/* هشدار اطلاع‌رسانی */}
      <Alert className="border-amber-500/40 bg-amber-500/5">
        <Info aria-hidden="true" />
        <AlertTitle>توجه</AlertTitle>
        <AlertDescription>
          مقادیر قابل ویرایش هستند — لودچارت رسمی سازنده ملاک نهایی است.
          سلول‌های جدول را می‌توانید مستقیماً ویرایش کنید؛ نخستین ویرایش یک
          نسخه «سفارشی» می‌سازد و داده مرجع دست‌نخورده باقی می‌ماند.
        </AlertDescription>
      </Alert>
    </div>
  );
}
