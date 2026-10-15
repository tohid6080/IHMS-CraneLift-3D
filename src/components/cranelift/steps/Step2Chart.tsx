"use client";

/**
 * CraneLift Pro 3D — مرحله ۲ ویزارد: مشاهده / ویرایش / ورود لودچارت
 * -----------------------------------------------------------
 * - نمایش منحنی لودچارت جرثقیل انتخابی (مرجع یا سفارشی)
 * - خروجی CSV، ورود CSV (با اعتبارسنجی) و دانلود نمونه
 * - ویرایش دستی نقاط با ساخت خودکار نسخهٔ سفارشی
 * نکته: میزبان اسکرین‌شات نمودار در این مرحله «step2-chart-host» است؛
 * id «loadchart-curve» متعلق به میزبان دیگری است و اینجا استفاده نشده.
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
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Download,
  FileDown,
  Info,
  Plus,
  RotateCcw,
  Trash2,
  Truck,
  Upload,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import LoadChartCurve from "@/components/cranelift/LoadChartCurve";
import { getCraneById } from "@/lib/cranelift/cranes";
import { chartToCSV, csvToChart, sampleCSV } from "@/lib/cranelift/csv";
import { getChartFor } from "@/lib/cranelift/load-charts";
import { useLiftStore } from "@/lib/cranelift/store";
import type { LoadChart, LoadChartSection } from "@/lib/cranelift/types";

/** گردکردن به ۱ رقم اعشار */
const round1 = (v: number): number => Math.round(v * 10) / 10;

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

/** کلون عمیق لودچارت به‌عنوان نسخهٔ سفارشی (هر ویرایشی = چارت سفارشی) */
function cloneAsCustom(c: LoadChart): LoadChart {
  const clone: LoadChart = structuredClone(c);
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
  const resetChart = useLiftStore((s) => s.resetChart);
  const inputs = useLiftStore((s) => s.inputs);
  const setStep = useLiftStore((s) => s.setStep);

  const crane = getCraneById(selectedCraneId);
  const chart = crane ? getChartFor(crane.id, customCharts) : null;

  // ── وضعیت محلی ──
  const [selectedBoom, setSelectedBoom] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  /** سکشن‌ها مرتب بر اساس طول بوم (محاسبه مستقیم — تعداد نقاط کم است) */
  const sortedSections = chart
    ? [...chart.sections].sort((a, b) => a.boomLengthM - b.boomLengthM)
    : [];

  /**
   * سکشن فعال: انتخاب دستی کاربر اگر هنوز معتبر باشد؛ در غیر این صورت
   * به‌صورت مشتق‌شده نزدیک‌ترین سکشن به طول بوم ورودی‌ها (بدون effect).
   */
  const manualValid =
    selectedBoom !== null &&
    sortedSections.some((s) => s.boomLengthM === selectedBoom);
  const effectiveBoom = manualValid
    ? selectedBoom
    : sortedSections.length > 0
      ? sortedSections.reduce(
          (best, s) =>
            Math.abs(s.boomLengthM - inputs.boomLengthM) <
            Math.abs(best.boomLengthM - inputs.boomLengthM)
              ? s
              : best,
          sortedSections[0]
        ).boomLengthM
      : null;
  const activeSection: LoadChartSection | null =
    sortedSections.find((s) => s.boomLengthM === effectiveBoom) ?? null;

  // ═══════════════ عملگرهای CSV ═══════════════

  /** خروجی CSV از لودچارت فعلی */
  const handleExportCSV = () => {
    if (!chart || !crane) return;
    downloadTextFile(`${crane.id}-loadchart.csv`, chartToCSV(chart));
  };

  /** دانلود فایل نمونهٔ CSV */
  const handleSampleCSV = () => {
    downloadTextFile("sample-loadchart.csv", sampleCSV());
    toast({
      title: "نمونه CSV دانلود شد",
      description: "فایل نمونه را بر اساس ستون‌های boom_length, radius, capacity پر کنید.",
    });
  };

  /** ورود CSV: اعتبارسنجی، ثبت نسخهٔ سفارشی و نمایش هشدارها */
  const handleImportCSV = async (file: File) => {
    if (!crane) return;
    try {
      const text = await file.text();
      const res = csvToChart(crane.id, text);
      if (res.chart) {
        setCustomChart(crane.id, res.chart);
        setEditing(false);
        toast({
          title: "لودچارت سفارشی ثبت شد",
          description: `لودچارت سفارشی با ${res.rowCount} ردیف ثبت شد.`,
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
    if (!crane) return;
    resetChart(crane.id);
    setEditing(false);
    toast({
      title: "بازگشت به مرجع",
      description: "لودچارت سفارشی حذف شد و دادهٔ مرجع بازیابی شد.",
    });
  };

  // ═══════════════ عملگرهای ویرایش جدول ═══════════════

  /** ثبت مقدار نهایی یک نقطه (روی کلون عمیق از چارت) */
  const commitPoint = (
    boom: number,
    idx: number,
    field: "radiusM" | "capacityT",
    value: number
  ) => {
    if (!chart || !crane) return;
    const clone = cloneAsCustom(chart);
    const sec = clone.sections.find((s) => s.boomLengthM === boom);
    const point = sec?.points[idx];
    if (!sec || !point) return;
    if (field === "radiusM") point.radiusM = value;
    else point.capacityT = value;
    setCustomChart(crane.id, clone);
  };

  /** حذف یک نقطه از سکشن فعال (حداقل یک نقطه باید بماند) */
  const handleDeletePoint = (boom: number, idx: number) => {
    if (!chart || !crane) return;
    const sec = chart.sections.find((s) => s.boomLengthM === boom);
    if (!sec) return;
    if (sec.points.length <= 1) {
      toast({
        title: "حذف نقطه ممکن نیست",
        description: "هر سکشن باید حداقل یک نقطه داشته باشد.",
      });
      return;
    }
    const clone = cloneAsCustom(chart);
    clone.sections
      .find((s) => s.boomLengthM === boom)!
      .points.splice(idx, 1);
    setCustomChart(crane.id, clone);
  };

  /** افزودن نقطه در انتهای سکشن فعال (ادامهٔ روند نزولی ظرفیت) */
  const handleAddPoint = () => {
    if (!chart || !crane || !activeSection) return;
    const clone = cloneAsCustom(chart);
    const sec = clone.sections.find(
      (s) => s.boomLengthM === activeSection.boomLengthM
    );
    if (!sec) return;
    const sortedPts = [...sec.points].sort((a, b) => a.radiusM - b.radiusM);
    const last = sortedPts[sortedPts.length - 1] ?? { radiusM: 4, capacityT: 10 };
    sec.points.push({
      radiusM: round1(last.radiusM + 2),
      capacityT: round1(Math.max(1, last.capacityT * 0.8)),
    });
    setCustomChart(crane.id, clone);
  };

  /** حذف سکشن فعال (حداقل یک سکشن باید بماند) */
  const handleRemoveSection = () => {
    if (!chart || !crane || !activeSection) return;
    if (chart.sections.length <= 1) {
      toast({
        title: "حذف ممکن نیست",
        description: "حداقل یک سکشن بوم باید در لودچارت باقی بماند.",
      });
      return;
    }
    const clone = cloneAsCustom(chart);
    clone.sections = clone.sections.filter(
      (s) => s.boomLengthM !== activeSection.boomLengthM
    );
    setCustomChart(crane.id, clone);
    toast({
      title: "سکشن بوم حذف شد",
      description: `بوم ${activeSection.boomLengthM} متری از لودچارت سفارشی حذف شد.`,
    });
  };

  /** افزودن سکشن طول بوم جدید با نقاط شروع پیش‌فرض */
  const handleAddSection = () => {
    if (!chart || !crane) return;
    const clone = cloneAsCustom(chart);
    const maxBoom = Math.max(...clone.sections.map((s) => s.boomLengthM), 0);
    const newBoom = round1(maxBoom + 6);
    const maxCap = crane.specs.maxCapacityT;
    const newSection: LoadChartSection = {
      boomLengthM: newBoom,
      points: [
        { radiusM: 4, capacityT: maxCap * 0.5 },
        { radiusM: 10, capacityT: maxCap * 0.25 },
        { radiusM: 16, capacityT: maxCap * 0.12 },
      ],
    };
    clone.sections.push(newSection);
    setCustomChart(crane.id, clone);
    setSelectedBoom(newBoom);
    toast({
      title: "سکشن بوم اضافه شد",
      description: `بوم ${newBoom} متری با نقاط پیش‌فرض اضافه شد؛ مقادیر را ویرایش کنید.`,
    });
  };

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

  // ═══════════════ مرحله ۲ کامل ═══════════════
  return (
    <div className="space-y-4">
      {/* هدر: عنوان + نشان منبع + عملگرهای CSV */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-bold">لودچارت — {crane.name}</h2>
          {chart?.source === "custom" ? (
            <Badge className="bg-amber-500 text-black">سفارشی</Badge>
          ) : (
            <Badge variant="secondary">مرجع</Badge>
          )}
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
          {chart?.source === "custom" && (
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

      {/* نمودار منحنی لودچارت */}
      <Card>
        <CardContent className="p-4">
          <div id="step2-chart-host">
            <LoadChartCurve
              chart={chart}
              highlight={{
                radiusM: inputs.radiusM,
                grossLoadT:
                  inputs.loadWeightT +
                  inputs.hookBlockWeightT +
                  inputs.riggingWeightT,
                boomLengthM: inputs.boomLengthM,
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* انتخاب سکشن بوم + جدول نقاط */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-base">
              بخش‌های بوم و جدول نقاط
            </CardTitle>
            <div className="flex items-center gap-2">
              <Label htmlFor="edit-table-switch" className="text-sm">
                ویرایش جدول
              </Label>
              <Switch
                id="edit-table-switch"
                checked={editing}
                onCheckedChange={setEditing}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* دکمه‌های انتخاب سکشن */}
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="انتخاب سکشن بوم">
            {sortedSections.map((s) => {
              const active = activeSection?.boomLengthM === s.boomLengthM;
              return (
                <Button
                  key={s.boomLengthM}
                  size="sm"
                  variant={active ? "default" : "outline"}
                  role="tab"
                  aria-selected={active}
                  className={
                    active ? "bg-amber-500 text-black hover:bg-amber-500" : ""
                  }
                  onClick={() => setSelectedBoom(s.boomLengthM)}
                >
                  بوم {s.boomLengthM} م
                </Button>
              );
            })}
          </div>

          {editing && chart?.source === "default" && (
            <p className="text-xs text-muted-foreground">
              نخستین ویرایش، یک نسخهٔ سفارشی از لودچارت مرجع می‌سازد (مرجع دست‌نخورده باقی می‌ماند).
            </p>
          )}

          <Separator />

          {/* جدول نقاط سکشن فعال */}
          {activeSection && (
            <div className="max-h-96 overflow-y-auto scroll-slim">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">شعاع (متر)</TableHead>
                    <TableHead className="text-right">ظرفیت (تن)</TableHead>
                    {editing && (
                      <TableHead className="w-16 text-right">حذف</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeSection.points.map((p, idx) => {
                    const rKey = `${activeSection.boomLengthM}:${idx}:radiusM`;
                    const cKey = `${activeSection.boomLengthM}:${idx}:capacityT`;
                    return (
                      <TableRow key={`${p.radiusM}-${idx}`}>
                        {/* سلول شعاع */}
                        <TableCell>
                          {editing ? (
                            <Input
                              type="number"
                              dir="ltr"
                              step="0.1"
                              min="0.1"
                              className="h-8 w-24 text-center"
                              aria-label={`شعاع نقطه ${idx + 1} بوم ${activeSection.boomLengthM} متر`}
                              value={drafts[rKey] ?? String(p.radiusM)}
                              onChange={(e) => {
                                const raw = e.target.value;
                                setDrafts((d) => ({ ...d, [rKey]: raw }));
                                const v = parseFloat(raw);
                                if (isFinite(v)) {
                                  commitPoint(
                                    activeSection.boomLengthM,
                                    idx,
                                    "radiusM",
                                    Math.max(0.1, round1(v))
                                  );
                                }
                              }}
                              onBlur={() =>
                                setDrafts((d) => {
                                  const next = { ...d };
                                  delete next[rKey];
                                  return next;
                                })
                              }
                            />
                          ) : (
                            <span dir="ltr" className="block text-center">
                              {p.radiusM}
                            </span>
                          )}
                        </TableCell>
                        {/* سلول ظرفیت */}
                        <TableCell>
                          {editing ? (
                            <Input
                              type="number"
                              dir="ltr"
                              step="0.1"
                              min="0.1"
                              className="h-8 w-24 text-center"
                              aria-label={`ظرفیت نقطه ${idx + 1} بوم ${activeSection.boomLengthM} متر`}
                              value={drafts[cKey] ?? String(p.capacityT)}
                              onChange={(e) => {
                                const raw = e.target.value;
                                setDrafts((d) => ({ ...d, [cKey]: raw }));
                                const v = parseFloat(raw);
                                if (isFinite(v)) {
                                  commitPoint(
                                    activeSection.boomLengthM,
                                    idx,
                                    "capacityT",
                                    Math.max(0.1, round1(v))
                                  );
                                }
                              }}
                              onBlur={() =>
                                setDrafts((d) => {
                                  const next = { ...d };
                                  delete next[cKey];
                                  return next;
                                })
                              }
                            />
                          ) : (
                            <span dir="ltr" className="block text-center">
                              {p.capacityT}
                            </span>
                          )}
                        </TableCell>
                        {/* حذف نقطه (فقط در ویرایش) */}
                        {editing && (
                          <TableCell className="text-center">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                              aria-label={`حذف نقطه در شعاع ${p.radiusM} متر`}
                              onClick={() =>
                                handleDeletePoint(
                                  activeSection.boomLengthM,
                                  idx
                                )
                              }
                            >
                              <Trash2 aria-hidden="true" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* عملگرهای ویرایش */}
          {editing && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={handleAddPoint}>
                <Plus aria-hidden="true" /> افزودن نقطه
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={handleRemoveSection}
              >
                <Trash2 aria-hidden="true" /> حذف این بوم
              </Button>
              <Button size="sm" variant="outline" onClick={handleAddSection}>
                <Plus aria-hidden="true" /> افزودن طول بوم
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* هشدار اطلاع‌رسانی */}
      <Alert>
        <Info aria-hidden="true" />
        <AlertTitle>توجه</AlertTitle>
        <AlertDescription>
          داده‌های مرجع تقریبی و برای برنامه‌ریزی اولیه است. برای لیفت واقعی،
          لودچارت رسمی سازنده را با CSV وارد کنید یا دستی ویرایش کنید.
        </AlertDescription>
      </Alert>
    </div>
  );
}
