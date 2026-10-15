"use client";

/**
 * CraneLift Pro 3D — پوسته اصلی اپلیکیشن
 * -----------------------------------------------------------
 * هدر (لوگو + تم + ریست)، نوار مراحل (Stepper)، محتوای مرحله جاری
 * + پنل سه‌بعدی sticky، مونتاژ مخفی منحنی لودچارت (برای اسکرین‌شات
 * گزارش) و فوتر چسبان با ناوبری مراحل.
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

const STEPS = [
  { title: "انتخاب جرثقیل", icon: Truck },
  { title: "لودچارت", icon: BarChart3 },
  { title: "اطلاعات لیفت", icon: ClipboardList },
  { title: "صحنه سه‌بعدی", icon: Boxes },
  { title: "تحلیل لیفت", icon: PlayCircle },
  { title: "گزارش PDF", icon: FileDown },
] as const;

/** دکمه تغییر تم — بدون state اضافه: آیکون با کلاس dark کنترل می‌شود */
function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="تغییر تم روشن/تاریک"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <Sun className="hidden size-5 text-amber-500 dark:block" />
      <Moon className="size-5 dark:hidden" />
    </Button>
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
  const customCharts = useLiftStore((s) => s.customCharts);
  const inputs = useLiftStore((s) => s.inputs);
  const result = useLiftStore((s) => s.result);
  const meta = useLiftStore((s) => s.meta);
  const resetAll = useLiftStore((s) => s.resetAll);

  const crane = getCraneById(selectedCraneId);
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
      {/* ═══ هدر ═══ */}
      <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between gap-3 px-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.35)]">
              <HardHat className="size-6 text-black" />
            </div>
            <div>
              <h1 className="text-base font-black leading-tight sm:text-lg" dir="ltr">
                CraneLift <span className="text-amber-500">Pro 3D</span>
              </h1>
              <p className="text-[11px] text-muted-foreground">
                برنامه‌ریزی و تحلیل لیفت جرثقیل
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {crane && (
              <span
                className="hidden rounded-md border bg-muted/50 px-2.5 py-1 text-xs md:inline-block"
                dir="ltr"
              >
                {crane.name}
              </span>
            )}
            <span
              className="hidden rounded-md border bg-muted/50 px-2.5 py-1 text-xs text-muted-foreground lg:inline-block"
              dir="ltr"
            >
              {meta.projectId}
            </span>
            <ThemeToggle />
            <Button
              variant="ghost"
              size="icon"
              aria-label="شروع پروژه جدید"
              onClick={handleReset}
            >
              <RotateCcw className="size-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* ═══ نوار مراحل ═══ */}
      <nav aria-label="مراحل برنامه‌ریزی لیفت" className="mx-auto w-full max-w-[1400px] px-4 pt-4">
        <ol className="scroll-slim flex gap-1.5 overflow-x-auto pb-1">
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
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors disabled:opacity-50 ${
                    active
                      ? "border-amber-500 bg-amber-500 font-bold text-black"
                      : done
                        ? "border-green-500/30 bg-green-500/10 text-green-500"
                        : "border-border text-muted-foreground hover:border-amber-500/40 hover:text-foreground"
                  }`}
                >
                  <span className="flex size-5 items-center justify-center rounded-full bg-black/10 text-[11px] font-bold dark:bg-white/10">
                    {i + 1}
                  </span>
                  <Icon className="size-4" />
                  <span className="hidden sm:inline">{s.title}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

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
