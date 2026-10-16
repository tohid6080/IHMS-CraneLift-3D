"use client";

/**
 * CraneLift Pro 3D — مرحله ۶: گزارش PDF
 * -----------------------------------------------------------
 * تکمیل متادیتای پروژه، پیش‌نمایش تصاویر ثبت‌شده، ساخت پیش‌نمایش
 * گزارش و دانلود PDF حرفه‌ای (jsPDF + html2canvas).
 */

import { useState } from "react";
import Image from "next/image";
import {
  FileDown,
  FileText,
  Loader2,
  RotateCcw,
  Camera,
  ImageIcon,
  User,
  Building,
  MapPin,
  FolderKanban,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useLiftStore } from "@/lib/cranelift/store";
import { getCraneById } from "@/lib/cranelift/cranes";
import { getChartFor } from "@/lib/cranelift/load-charts";
import { STATUS_COLORS, STATUS_LABELS } from "@/lib/cranelift/analysis";
import { downloadPDFReport, buildReportDataURL } from "@/lib/cranelift/pdf";
import { runAnalysis } from "../run-analysis";
import { useToast } from "@/hooks/use-toast";

export default function Step6Report() {
  const { toast } = useToast();
  const [busy, setBusy] = useState<"pdf" | "preview" | "capture" | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const meta = useLiftStore((s) => s.meta);
  const setMeta = useLiftStore((s) => s.setMeta);
  const selectedId = useLiftStore((s) => s.selectedCraneId);
  const customCharts = useLiftStore((s) => s.customCharts);
  const inputs = useLiftStore((s) => s.inputs);
  const result = useLiftStore((s) => s.result);
  const screenshot3D = useLiftStore((s) => s.screenshot3D);
  const chartImage = useLiftStore((s) => s.chartImage);
  const resetAll = useLiftStore((s) => s.resetAll);

  const customCranes = useLiftStore((s) => s.customCranes);
  const crane = getCraneById(selectedId, customCranes);

  if (!crane) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-10 text-muted-foreground">
          <AlertTriangle className="size-10 text-amber-500/60" />
          ابتدا جرثقیل انتخاب و تحلیل را اجرا کنید
        </CardContent>
      </Card>
    );
  }

  const chart = getChartFor(crane.id, customCharts);

  const assembleData = () => ({
    meta,
    crane,
    chart,
    inputs,
    result,
    screenshot3D,
    chartImage,
  });

  const handleCapture = async () => {
    setBusy("capture");
    try {
      await runAnalysis();
      toast({ title: "تصاویر به‌روزرسانی شد", description: "اسکرین‌شات سه‌بعدی و منحنی لودچارت ثبت شدند." });
    } finally {
      setBusy(null);
    }
  };

  const handlePreview = async () => {
    setBusy("preview");
    try {
      const url = await buildReportDataURL(assembleData());
      setPreviewUrl(url);
    } catch (e) {
      toast({
        title: "خطا در ساخت پیش‌نمایش",
        description: e instanceof Error ? e.message : "دوباره تلاش کنید",
        variant: "destructive",
      });
    } finally {
      setBusy(null);
    }
  };

  const handleDownload = async () => {
    if (!result) {
      toast({
        title: "ابتدا تحلیل را اجرا کنید",
        description: "در مرحله ۵ دکمه «تحلیل لیفت / Play» را بزنید.",
        variant: "destructive",
      });
      return;
    }
    setBusy("pdf");
    try {
      // تازه‌سازی تصاویر قبل از ساخت گزارش
      await runAnalysis();
      await downloadPDFReport(assembleData());
      toast({ title: "گزارش PDF آماده شد", description: "فایل در مسیر دانلودها ذخیره شد." });
    } catch (e) {
      toast({
        title: "خطا در ساخت گزارش PDF",
        description: e instanceof Error ? e.message : "دوباره تلاش کنید",
        variant: "destructive",
      });
    } finally {
      setBusy(null);
    }
  };

  const handleReset = () => {
    resetAll();
    setPreviewUrl(null);
    toast({ title: "پروژه جدید آغاز شد", description: "همه داده‌ها بازنشانی شدند." });
  };

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {/* متادیتای پروژه */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FolderKanban className="size-5 text-amber-500" />
            مشخصات پروژه
          </CardTitle>
          <CardDescription>این اطلاعات در سربرگ گزارش PDF درج می‌شود.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs">
              <FolderKanban className="size-3.5" /> کد پروژه
            </Label>
            <Input value={meta.projectId} disabled dir="ltr" className="text-center" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">نام پروژه</Label>
            <Input
              value={meta.projectName}
              onChange={(e) => setMeta({ projectName: e.target.value })}
              placeholder="مثال: نصب استراکچر واحد ۱۰۰"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs">
              <MapPin className="size-3.5" /> محل پروژه
            </Label>
            <Input
              value={meta.location}
              onChange={(e) => setMeta({ location: e.target.value })}
              placeholder="مثال: پالایشگاه آبادان — واحد NHT"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">تاریخ</Label>
            <Input disabled value={new Date(meta.date).toLocaleDateString("fa-IR")} className="text-center" />
          </div>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs">
              <User className="size-3.5" /> مهندس ناظر
            </Label>
            <Input
              value={meta.engineerName}
              onChange={(e) => setMeta({ engineerName: e.target.value })}
              placeholder="نام و نام خانوادگی"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs">
              <Building className="size-3.5" /> شرکت / پیمانکار
            </Label>
            <Input
              value={meta.companyName}
              onChange={(e) => setMeta({ companyName: e.target.value })}
              placeholder="نام شرکت"
            />
          </div>
        </CardContent>
      </Card>

      {/* خلاصه وضعیت + تصاویر */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ImageIcon className="size-5 text-amber-500" />
            خلاصه و تصاویر گزارش
          </CardTitle>
          <CardDescription>
            تصاویر هنگام اجرای تحلیل ثبت می‌شوند؛ پیش از دانلود، به‌روزرسانی کنید.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* وضعیت */}
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <div className="text-xs text-muted-foreground">وضعیت تحلیل</div>
              <div className="text-sm font-bold" dir="ltr">
                {crane.name}
              </div>
            </div>
            {result ? (
              <Badge
                className="text-black"
                style={{ backgroundColor: STATUS_COLORS[result.status] }}
              >
                {STATUS_LABELS[result.status]} — {result.utilizationPct?.toFixed(0)}٪ ظرفیت
              </Badge>
            ) : (
              <Badge variant="destructive">تحلیل اجرا نشده</Badge>
            )}
          </div>

          {/* تصاویر */}
          <div className="grid grid-cols-2 gap-3">
            {(
              [
                ["نمای سه‌بعدی", screenshot3D],
                ["منحنی لودچارت", chartImage],
              ] as [string, string | null][]
            ).map(([label, img]) => (
              <div key={label} className="space-y-1">
                <div className="text-xs text-muted-foreground">{label}</div>
                <div className="flex h-28 items-center justify-center overflow-hidden rounded-lg border bg-muted/40">
                  {img ? (
                    <img src={img} alt={label} className="h-full w-full object-contain" />
                  ) : (
                    <span className="text-xs text-muted-foreground">ثبت نشده</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={handleCapture}
            disabled={busy !== null}
          >
            {busy === "capture" ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4 text-amber-500" />}
            به‌روزرسانی تصاویر (تحلیل مجدد)
          </Button>
        </CardContent>
      </Card>

      {/* ساخت گزارش */}
      <Card className="border-amber-500/40 lg:col-span-2">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="size-5 text-amber-500" />
            گزارش حرفه‌ای PDF
          </CardTitle>
          <CardDescription>
            شامل مشخصات پروژه و جرثقیل، جدول ورودی‌ها، تصویر سه‌بعدی، لودچارت، نتایج با
            رنگ‌بندی، توصیه‌های ایمنی و کادر امضای مهندس — آماده چاپ.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          <Button
            size="lg"
            className="flex-1 gap-2 bg-amber-500 text-black hover:bg-amber-400"
            onClick={handleDownload}
            disabled={busy !== null}
          >
            {busy === "pdf" ? <Loader2 className="size-5 animate-spin" /> : <FileDown className="size-5" />}
            دریافت گزارش PDF
          </Button>
          <Button size="lg" variant="outline" className="flex-1 gap-2" onClick={handlePreview} disabled={busy !== null}>
            {busy === "preview" ? <Loader2 className="size-5 animate-spin" /> : <FileText className="size-5" />}
            پیش‌نمایش گزارش در مرورگر
          </Button>
          <Button size="lg" variant="outline" className="gap-2 text-red-500 hover:text-red-400" onClick={handleReset}>
            <RotateCcw className="size-4" />
            پروژه جدید
          </Button>
        </CardContent>
      </Card>

      {/* پیش‌نمایش */}
      {previewUrl && (
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">پیش‌نمایش گزارش (تمام صفحات)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-[600px] overflow-y-auto scroll-slim rounded-lg border bg-muted/30 p-3">
              <img
                src={previewUrl}
                alt="پیش‌نمایش گزارش PDF"
                className="mx-auto max-w-full rounded-md border bg-white shadow"
                dir="ltr"
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
