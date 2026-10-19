"use client";

/**
 * IHMS CraneLift 3D — پوسته اصلی اپلیکیشن (استایل LMI)
 * -----------------------------------------------------------
 * نوار ابزار بالایی به سبک نمایشگرهای صنعتی LMI: کاشی‌های مربعی
 * مراحل (کاشی فعال با حاشیه کهربایی درخشان) + لوگوی فشرده در ابتدا
 * و کاشی تم/ریست در انتها؛ محتوای مرحله جاری + پنل سه‌بعدی sticky،
 * مونتاژ مخفی منحنی لودچارت (برای اسکرین‌شات گزارش)، نوار وضعیت LMI
 * بالای فوتر و فوتر چسبان با ناوبری مراحل.
 */

import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { ThemeProvider, useTheme } from "next-themes";
import {
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
  Cable,
  Crown,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { withBasePath } from "@/lib/basePath";
import { useLiftStore, useHydrateLiftStore } from "@/lib/cranelift/store";
import { getStoredTrial, isTrialActive, type StoredTrial } from "@/lib/cranelift/trialAuth";
import TrialGate from "./TrialGate";
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
import RopeCalculatorDialog from "./RopeCalculatorDialog";
import UpgradeDialog from "./UpgradeDialog";
import { useUiStore } from "./ui-store";
import { quotaCheck } from "@/lib/cranelift/licensing";

const STEPS = [
  { title: "انتخاب جرثقیل", icon: Truck },
  { title: "لودچارت", icon: BarChart3 },
  { title: "اطلاعات لیفت", icon: ClipboardList },
  { title: "صحنه سه‌بعدی", icon: Boxes },
  { title: "تحلیل لیفت", icon: PlayCircle },
  { title: "گزارش PDF", icon: FileDown },
] as const;

/** ابعاد کاشی LMI: ~۴۴px موبایل → ۶۴/۷۲px دسکتاپ.
 * روی صفحه‌ی خیلی باریک (۳۶۰px)، ۴ کاشیِ ابزار (سمتِ چپِ نوار، shrink-0)
 * با کاشی‌هایِ مرحله رقابت می‌کردند و نوارِ مراحل را به یک کاشی فشرده
 * می‌کردند — اندازه‌ی پایه از ۵۲ به ۴۴px کم شد تا فضایِ بیشتری برایِ
 * نوارِ اسکرول‌شوندهٔ مراحل بماند؛ sm/md دست‌نخورده‌اند. */
const TILE_SIZE = "size-11 sm:size-16 md:size-18";

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
      <span className="hidden text-[10px] font-medium leading-none sm:block">تم</span>
    </button>
  );
}

/** اسپلش تا هیدراته‌شدن استور از localStorage — لوگوی بزرگ IHMS */
function Splash() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6">
      <img
        src={withBasePath("/logo.png")}
        alt="لوگوی IHMS — Integrated HSE Management System"
        className="w-44 animate-pulse rounded-3xl shadow-[0_0_60px_rgba(20,83,45,0.35)] sm:w-56 md:w-64"
      />
      <div className="text-center">
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl" dir="ltr">
          IHMS <span className="text-emerald-700 dark:text-emerald-400">CraneLift 3D</span>
        </h1>
        <p className="mt-1.5 text-xs font-medium text-muted-foreground sm:text-sm">
          Integrated HSE Management System — برنامه‌ریزی و تحلیل لیفت جرثقیل
        </p>
      </div>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        در حال بارگذاری IHMS CraneLift 3D...
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
  const license = useLiftStore((s) => s.license);
  const usage = useLiftStore((s) => s.usage);
  const consume = useLiftStore((s) => s.consume);
  const ropeOpen = useUiStore((s) => s.ropeOpen);
  const setRopeOpen = useUiStore((s) => s.setRopeOpen);
  const upgradeOpen = useUiStore((s) => s.upgradeOpen);
  const setUpgradeOpen = useUiStore((s) => s.setUpgradeOpen);

  // ── گیتِ ورودِ آزمایشیِ وب — فقط در مرورگر (نه در اندرویدِ نیتیو، که
  // کاربرش همان خریدارِ کافه‌بازار است و مسیرِ Poolakey را طی می‌کند) ──
  const isWeb = !Capacitor.isNativePlatform();
  const [trial, setTrial] = useState<StoredTrial | null>(null);
  const [trialChecked, setTrialChecked] = useState(false);
  // خواندنِ localStorage همگام است؛ این بلوک فقط وقتی اجرا می‌شود که
  // hydrated از قبل true شده باشد (یعنی حتماً سمتِ کلاینت هستیم — نگاه
  // کنید به useHydrateLiftStore)، پس هرگز در رندرِ SSR اجرا نمی‌شود و
  // ناهمخوانیِ هیدریشن ایجاد نمی‌کند.
  if (hydrated && !trialChecked) {
    setTrialChecked(true);
    setTrial(isWeb ? getStoredTrial() : null);
  }
  const trialActive = isWeb && isTrialActive(trial);

  // هشدارِ مرورگریِ بستن/ترکِ صفحه — یادآوری که دادهٔ پروژه ذخیره نمی‌شود
  useEffect(() => {
    if (!trialActive) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [trialActive]);

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

  /** باز کردن محاسبه‌گر سیم بکسل با کنترل سهمیه نسخه رایگان */
  const handleRopeTool = () => {
    const q = quotaCheck(license.plan, usage, "rope");
    if (!q.ok) {
      toast({
        title: "سهمیه محاسبه‌گر سیم بکسل امروز تمام شد",
        description: `سقف نسخه رایگان: ${q.limit} بار در روز. برای استفاده نامحدود، ارتقا دهید.`,
        variant: "destructive",
      });
      setUpgradeOpen(true);
      return;
    }
    consume("rope");
    setRopeOpen(true);
  };

  if (!hydrated || !trialChecked) return <Splash />;

  if (isWeb && !trialActive) {
    return <TrialGate expired={!!trial} onSuccess={setTrial} />;
  }

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
            <img
              src={withBasePath("/logo.png")}
              alt="لوگوی IHMS"
              className="size-10 rounded-xl bg-white/90 object-contain shadow-sm ring-1 ring-slate-400/40 sm:size-11"
            />
            <div className="hidden sm:block">
              <h1 className="text-sm font-black leading-tight" dir="ltr">
                IHMS <span className="text-amber-500">CraneLift 3D</span>
              </h1>
              <p className="text-[10px] leading-tight text-muted-foreground">
                Integrated HSE Management System
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

          {/* ابزارها و تم و ریست — انتهای نوار (هم‌ارتفاع کاشی‌ها) */}
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            {/* محاسبه‌گر سیم بکسل */}
            <button
              type="button"
              aria-label="محاسبه‌گر تناژ سیم بکسل"
              title="محاسبه‌گر تناژ سیم بکسل (مغزکنفی / مغزفولادی)"
              onClick={handleRopeTool}
              className={`${TILE_SIZE} flex flex-col items-center justify-center gap-0.5 rounded-lg border-2 border-border text-muted-foreground transition-colors hover:border-amber-500/50 hover:text-amber-500`}
            >
              <Cable className="size-6" />
              <span className="hidden text-[10px] font-medium leading-none sm:block">سیم بکسل</span>
            </button>
            {/* ارتقا / وضعیت پلن */}
            <button
              type="button"
              aria-label={license.plan === "pro" ? "پلن حرفه‌ای فعال است" : "ارتقا به نسخه حرفه‌ای"}
              title={
                license.plan === "pro"
                  ? "نسخه حرفه‌ای فعال"
                  : "ارتقا به نسخه حرفه‌ای (پلن‌ها و خرید)"
              }
              onClick={() => setUpgradeOpen(true)}
              className={`${TILE_SIZE} flex flex-col items-center justify-center gap-0.5 rounded-lg border-2 transition-colors ${
                license.plan === "pro"
                  ? "border-green-500/50 text-green-500"
                  : "border-amber-500/60 bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 dark:text-amber-400"
              }`}
            >
              {license.plan === "pro" ? (
                <CheckCircle2 className="size-6" />
              ) : (
                <Crown className="size-6" />
              )}
              <span className="hidden text-[10px] font-medium leading-none sm:block">
                {license.plan === "pro" ? "Pro فعال" : "ارتقا"}
              </span>
            </button>
            <ThemeToggle />
            <button
              type="button"
              aria-label="شروع پروژه جدید"
              title="شروع پروژه جدید"
              onClick={handleReset}
              className={`${TILE_SIZE} flex flex-col items-center justify-center gap-0.5 rounded-lg border-2 border-border text-muted-foreground transition-colors hover:border-red-500/50 hover:text-red-500`}
            >
              <RotateCcw className="size-6" />
              <span className="hidden text-[10px] font-medium leading-none sm:block">ریست</span>
            </button>
          </div>
        </div>
      </header>

      {/* ═══ هشدارِ دائمیِ نسخه‌ی آزمایشیِ وب — بدون سرور، پاک‌شونده با بستنِ تب ═══ */}
      {isWeb && (
        <div className="flex items-center justify-center gap-1.5 bg-amber-500/15 px-3 py-1.5 text-center text-[11px] font-medium leading-relaxed text-amber-700 dark:text-amber-400">
          <ShieldAlert className="size-3.5 shrink-0" />
          نسخه‌ی آزمایشیِ وب — اطلاعاتِ این پروژه روی هیچ سروری ذخیره نمی‌شود و با بستن یا ترکِ این
          صفحه برای همیشه پاک خواهد شد.
        </div>
      )}

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
            IHMS CraneLift 3D © ۲۰۲۵ — لودچارت‌های مرجع تقریبی و برای برنامه‌ریزی اولیه است؛
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

      {/* ═══ دیالوگ‌های سراسری ═══ */}
      <RopeCalculatorDialog open={ropeOpen} onOpenChange={setRopeOpen} />
      <UpgradeDialog open={upgradeOpen} onOpenChange={setUpgradeOpen} />
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
