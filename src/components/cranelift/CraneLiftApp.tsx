"use client";

/**
 * CraneLift Pro 3D — پوسته اصلی اپلیکیشن (استایل LMI)
 * -----------------------------------------------------------
 * نوار ابزار بالایی به سبک نمایشگرهای صنعتی LMI: کاشی‌های مربعی
 * مراحل (کاشی فعال با حاشیه کهربایی درخشان) + لوگوی فشرده در ابتدا
 * و کاشی تم/ریست در انتها؛ محتوای مرحله جاری + پنل سه‌بعدی sticky،
 * مونتاژ مخفی منحنی لودچارت (برای اسکرین‌شات گزارش)، نوار وضعیت LMI
 * بالای فوتر و فوتر چسبان با ناوبری مراحل.
 */

import { ThemeProvider, useTheme } from "next-themes";
import {
  HardHat,
  Truck,
  BarChart3,
  ClipboardList,
  Boxes,
  PlayCircle,
  FileDown,
  Sun,
  Moon,
  RotateCcw,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useLiftStore, useHydrateLiftStore } from "@/lib/cranelift/store";
import { getCraneById } from "@/lib/cranelift/cranes";
import { getChartFor } from "@/lib/cranelift/load-charts";
import Step1Crane from "./steps/Step1Crane";
import Step2Chart from "./steps/Step2Chart";
import Step3Inputs from "./steps/Step3Inputs";
import Step4Scene from "./steps/Step4Scene";
import Step5Analysis from "./steps/Step5Analysis";
import Step6Report from "./steps/Step6Report";
import ScenePanel from "./ScenePanel";
import LoadChartCurve from "./LoadChartCurve";
import LmiStatusBar from "./LmiStatusBar";

const STEPS = [
  { title: "انتخاب جرثقیل", icon: Truck },
  { title: "لودچارت", icon: BarChart3 },
  { title: "اطلاعات لیفت", icon: ClipboardList },
  { title: "صحنه سه‌بعدی", icon: Boxes },
  { title: "تحلیل لیفت", icon: PlayCircle },
  { title: "گزارش PDF", icon: FileDown },
] as const;

/** ابعاد کاشی LMI: ~۵۲px موبایل → ۶۴/۷۲px دسکتاپ */
const TILE_SIZE = "size-13 sm:size-16 md:size-18";

/** کاشی تم — بدون state اضافه: آیکون با کلاس dark کنترل می‌شود */
function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <button
      type="button"
      aria-label="تغییر تم روشن/تاریک"
      title="تغییر تم روشن/تاریک"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className={`${TILE_SIZE} flex shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg border-2 border-border text-muted-foreground transition-colors hover:border-amber-500/50 hover:text-amber-500`}
    >
      <Sun className="hidden size-6 text-amber-500 dark:block" />
      <Moon className="size-6 dark:hidden" />
      <span className="text-[10px] font-medium leading-none">تم</span>
    </button>
  );
}

/** اسپلش تا هیدراته‌شدن استور از localStorage */
function Splash() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
      <div className="flex size-16 animate-pulse items-center justify-center rounded-2xl bg-amber-500">
        <HardHat className="size-9 text-black" />
      </div>
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        در حال بارگذاری CraneLift Pro 3D...
      </div>
    </div>
  );
}

function CraneLiftAppInner() {
  const { toast } = useToast();
  const hydrated = useHydrateLiftStore();
  const step = useLiftStore((s) => s.step);
  const setStep = useLiftStore((s) => s.setStep);
  const next = useLiftStore((s) => s.next);
  const prev = useLiftStore((s) => s.prev);
  const selectedCraneId = useLiftStore((s) => s.selectedCraneId);
  const customCranes = useLiftStore((s) => s.customCranes);
  const customCharts = useLiftStore((s) => s.customCharts);
  const inputs = useLiftStore((s) => s.inputs);
  const result = useLiftStore((s) => s.result);
  const resetAll = useLiftStore((s) => s.resetAll);

  const crane = getCraneById(selectedCraneId, customCranes);
  const chart = crane ? getChartFor(crane.id, customCharts) : null;
  const grossT = inputs.loadWeightT + inputs.hookBlockWeightT + inputs.riggingWeightT;

  /** مجوز ناوبری به هر مرحله */
  const canGo = (i: number) => (i === 0 ? true : !!selectedCraneId);

  const handleNext = () => {
    if (step === 0 && !selectedCraneId) {
      toast({ title: "ابتدا یک جرثقیل انتخاب کنید", variant: "destructive" });
      return;
    }
    if (step === 4 && !result) {
      toast({
        title: "ابتدا تحلیل را اجرا کنید",
        description: "در مرحله ۵ دکمه بزرگ «تحلیل لیفت / Play» را بزنید.",
        variant: "destructive",
      });
      return;
    }
    next();
  };

  const handleReset = () => {
    resetAll();
    toast({ title: "پروژه جدید آغاز شد" });
  };

  if (!hydrated) return <Splash />;

  const showScenePanel = step >= 2 && step <= 4;
  const StepComponent = [
    <Step1Crane key="s0" />,
    <Step2Chart key="s1" />,
    <Step3Inputs key="s2" />,
    <Step4Scene key="s3" />,
    <Step5Analysis key="s4" />,
    <Step6Report key="s5" />,
  ][step];

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* ═══ نوار ابزار LMI: لوگو + کاشی مراحل + تم/ریست ═══ */}
      <header className="sticky top-0 z-40 border-b border-slate-300/70 bg-slate-200/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.55),inset_0_-2px_6px_rgba(15,23,42,0.10)] backdrop-blur dark:border-slate-700/70 dark:bg-slate-900/90 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-2px_6px_rgba(0,0,0,0.45)]">
        <div className="mx-auto flex w-full max-w-[1400px] items-center gap-1.5 px-2 sm:gap-2.5 sm:px-4">
          {/* لوگوی فشرده — ابتدای نوار */}
          <div className="flex shrink-0 items-center gap-2 py-1.5">
            <div className="flex size-9 items-center justify-center rounded-lg bg-amber-500 shadow-[0_0_16px_rgba(245,158,11,0.4)] sm:size-10">
              <HardHat className="size-5 text-black sm:size-6" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-sm font-black leading-tight" dir="ltr">
                CraneLift <span className="text-amber-500">Pro 3D</span>
              </h1>
              <p className="text-[10px] leading-tight text-muted-foreground">
                برنامه‌ریزی و تحلیل لیفت جرثقیل
              </p>
            </div>
          </div>

          <div aria-hidden className="hidden h-10 w-px shrink-0 bg-slate-400/30 md:block" />

          {/* کاشی‌های مراحل — اسکرول افقی در صفحه باریک */}
          <nav
            aria-label="مراحل برنامه‌ریزی لیفت"
            className="scroll-slim min-w-0 flex-1 overflow-x-auto py-1.5"
          >
            <ol className="flex w-max items-center gap-1.5 sm:gap-2">
              {STEPS.map((s, i) => {
                const Icon = s.icon;
                const active = i === step;
                const done = i < step;
                return (
                  <li key={s.title} className="shrink-0">
                    <button
                      type="button"
                      disabled={!canGo(i)}
                      onClick={() => canGo(i) && setStep(i)}
                      aria-current={active ? "step" : undefined}
                      title={
                        canGo(i) ? s.title : `${s.title} — ابتدا جرثقیل انتخاب کنید`
                      }
                      className={`${TILE_SIZE} relative flex flex-col items-center justify-center gap-0.5 rounded-lg border-2 bg-card/70 transition-colors ${
                        active
                          ? "border-amber-500 bg-amber-500/15 text-amber-600 shadow-[0_0_14px_rgba(245,158,11,0.45)] dark:text-amber-400"
                          : done
                            ? "border-green-500/40 bg-green-500/5 text-green-600 dark:text-green-400"
                            : "text-muted-foreground hover:border-amber-500/40 hover:text-foreground"
                      } ${canGo(i) ? "" : "cursor-not-allowed opacity-40"}`}
                    >
                      <Icon className="size-6" />
                      <span className="line-clamp-2 px-0.5 text-center text-[10px] font-medium leading-[1.2]">
                        {s.title}
                      </span>
                      {done && (
                        <span
                          aria-hidden
                          className="absolute -end-1 -top-1 rounded-full bg-background"
                        >
                          <CheckCircle2 className="size-4 text-green-500" />
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>

          {/* تم و ریست — انتهای نوار (هم‌ارتفاع کاشی‌ها) */}
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <ThemeToggle />
            <button
              type="button"
              aria-label="شروع پروژه جدید"
              title="شروع پروژه جدید"
              onClick={handleReset}
              className={`${TILE_SIZE} flex flex-col items-center justify-center gap-0.5 rounded-lg border-2 border-border text-muted-foreground transition-colors hover:border-red-500/50 hover:text-red-500`}
            >
              <RotateCcw className="size-6" />
              <span className="text-[10px] font-medium leading-none">ریست</span>
            </button>
          </div>
        </div>
      </header>

      {/* ═══ محتوای اصلی ═══ */}
      <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6">
        {showScenePanel ? (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px] xl:grid-cols-[minmax(0,1fr)_440px]">
            <div className="min-w-0">{StepComponent}</div>
            <aside className="self-start lg:sticky lg:top-24">
              <ScenePanel />
            </aside>
          </div>
        ) : (
          StepComponent
        )}
      </main>

      {/* ═══ مونتاژ مخفی منحنی لودچارت (اسکرین‌شات گزارش) ═══ */}
      {chart && (
        <div
          id="loadchart-curve"
          aria-hidden
          style={{
            position: "fixed",
            left: "-12000px",
            top: 0,
            width: "920px",
            height: "460px",
            background: "#ffffff",
            padding: "14px",
            borderRadius: "12px",
          }}
        >
          <LoadChartCurve
            chart={chart}
            highlight={{
              radiusM: inputs.radiusM,
              grossLoadT: grossT,
              boomLengthM: inputs.boomLengthM,
            }}
            height={420}
          />
        </div>
      )}

      {/* ═══ نوار وضعیت LMI (بالا و خارج از فوتر — جریان صفحه) ═══ */}
      <LmiStatusBar />

      {/* ═══ فوتر چسبان ═══ */}
      <footer className="mt-auto border-t bg-card">
        <div className="mx-auto flex max-w-[1400px] flex-col items-center justify-between gap-2 px-4 py-3 sm:flex-row">
          <p className="text-center text-[11px] leading-relaxed text-muted-foreground sm:text-start">
            CraneLift Pro 3D © ۲۰۲۵ — لودچارت‌های مرجع تقریبی و برای برنامه‌ریزی اولیه است؛
            پیش از لیفت واقعی، لودچارت رسمی سازنده ملاک عمل است.
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={step === 0}
              onClick={prev}
              className="gap-1"
            >
              <ChevronRight className="size-4" />
              قبلی
            </Button>
            <span className="min-w-16 text-center text-xs text-muted-foreground">
              مرحله {step + 1} از {STEPS.length}
            </span>
            <Button
              size="sm"
              disabled={step === STEPS.length - 1}
              onClick={handleNext}
              className="gap-1 bg-amber-500 text-black hover:bg-amber-400"
            >
              بعدی
              <ChevronLeft className="size-4" />
            </Button>
          </div>
        </div>
      </footer>
    </div>
  );
}

/** ریشه اپ: ThemeProvider + گیت هیدریشن */
export default function CraneLiftApp() {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
      <CraneLiftAppInner />
    </ThemeProvider>
  );
}
