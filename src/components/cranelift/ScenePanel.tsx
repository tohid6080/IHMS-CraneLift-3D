"use client";

/**
 * CraneLift Pro 3D — پنل نمایش سه‌بعدی
 * -----------------------------------------------------------
 * کانواس سه‌بعدی (client-only) + آمار سریع + دکمه بزرگ تحلیل (Play).
 * اگر هر دو پرچم A/B ثبت شده باشند، پس از تحلیل، شبیه‌سازی حرکت جرثقیل
 * (برداشت از A و جایگذاری در B) هم اجرا می‌شود (مخصوص نسخه حرفه‌ای).
 */

import dynamic from "next/dynamic";
import { useState } from "react";
import { Play, Box, AlertTriangle, Flag, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useLiftStore } from "@/lib/cranelift/store";
import { getCraneById } from "@/lib/cranelift/cranes";
import { solveGeometry, STATUS_COLORS, STATUS_LABELS } from "@/lib/cranelift/analysis";
import { isPro, quotaCheck } from "@/lib/cranelift/licensing";
import { runAnalysis, startTransferSim } from "./run-analysis";
import { useSim } from "./three/sim-store";
import { useUiStore } from "./ui-store";
import { useToast } from "@/hooks/use-toast";

// کانواس سه‌بعدی فقط در مرورگر
const CraneScene = dynamic(() => import("./three/CraneScene"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-[#18181b]">
      <Skeleton className="h-full w-full rounded-xl opacity-30" />
    </div>
  ),
});

export default function ScenePanel() {
  const { toast } = useToast();
  const [running, setRunning] = useState(false);
  const selectedId = useLiftStore((s) => s.selectedCraneId);
  const inputs = useLiftStore((s) => s.inputs);
  const result = useLiftStore((s) => s.result);
  const setStep = useLiftStore((s) => s.setStep);
  const license = useLiftStore((s) => s.license);
  const usage = useLiftStore((s) => s.usage);
  const consume = useLiftStore((s) => s.consume);
  const pickPoint = useLiftStore((s) => s.pickPoint);
  const placePoint = useLiftStore((s) => s.placePoint);
  const simActive = useSim((s) => s.active);
  const simPose = useSim((s) => s.pose);
  const setUpgradeOpen = useUiStore((s) => s.setUpgradeOpen);

  const customCranes = useLiftStore((s) => s.customCranes);
  const crane = getCraneById(selectedId, customCranes);
  const geo = crane ? solveGeometry(crane, inputs) : null;
  const grossT = inputs.loadWeightT + inputs.hookBlockWeightT + inputs.riggingWeightT;
  const bothFlags = !!(pickPoint && placePoint);

  const handlePlay = async () => {
    if (!crane) {
      toast({ title: "ابتدا جرثقیل انتخاب کنید", variant: "destructive" });
      return;
    }
    // سهمیه نسخه رایگان
    const q = quotaCheck(license.plan, usage, "analysis");
    if (!q.ok) {
      toast({
        title: "سهمیه تحلیل رایگان امروز تمام شد",
        description: `سقف نسخه رایگان: ${q.limit} تحلیل در روز. برای تحلیل نامحدود و شبیه‌سازی حرکت، ارتقا دهید.`,
        variant: "destructive",
      });
      setUpgradeOpen(true);
      return;
    }
    setRunning(true);
    try {
      consume("analysis");
      const r = await runAnalysis();
      if (!r) return;
      const titles = {
        allowed: "✅ لیفت مجاز است",
        caution: "⚠️ نیازمند بررسی بیشتر",
        "not-allowed": "⛔ لیفت غیرمجاز است",
      } as const;
      toast({
        title: titles[r.status],
        description:
          r.status === "allowed"
            ? `استفاده از ظرفیت: ${r.utilizationPct?.toFixed(0)}٪`
            : r.warnings.find((w) => w.level === "danger")?.message ?? r.conclusion,
        variant: r.status === "not-allowed" ? "destructive" : "default",
      });

      if (bothFlags) {
        // شبیه‌سازی حرکت دو پرچم — مخصوص Pro
        if (!isPro(license)) {
          toast({
            title: "شبیه‌سازی حرکت مخصوص نسخه حرفه‌ای است",
            description:
              "با دو پرچم A و B، حرکت کامل جرثقیل (برداشت تا جایگذاری) شبیه‌سازی می‌شود.",
            variant: "destructive",
          });
          setUpgradeOpen(true);
          setStep(4);
          return;
        }
        const st = startTransferSim();
        if (st === "started") {
          setStep(3); // رفتن به مرحله صحنه برای تماشای حرکت
          return;
        }
      }
      setStep(4);
    } finally {
      setRunning(false);
    }
  };

  return (
    <Card className="overflow-hidden border-2">
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Box className="size-5 text-amber-500" />
          نمای سه‌بعدی لیفت
        </CardTitle>
        {result && (
          <Badge
            className="text-black"
            style={{ backgroundColor: STATUS_COLORS[result.status] }}
          >
            {STATUS_LABELS[result.status]}
          </Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="h-[340px] overflow-hidden rounded-xl border border-border bg-[#18181b] lg:h-[420px]">
          {crane ? (
            <CraneScene />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
              <AlertTriangle className="size-10 text-amber-500/60" />
              <p className="text-sm">برای مشاهده صحنه سه‌بعدی، ابتدا جرثقیل انتخاب کنید</p>
            </div>
          )}
        </div>

        {/* نوار فاز شبیه‌سازی حرکت */}
        {(simActive || simPose) && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-2.5">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="flex items-center gap-1.5 font-bold text-amber-500">
                {simActive ? <Loader2 className="size-3.5 animate-spin" /> : <Flag className="size-3.5" />}
                {simPose?.phaseLabel ?? "آماده‌سازی حرکت..."}
              </span>
              <span className="text-muted-foreground" dir="ltr">
                R {simPose?.radiusM.toFixed(1) ?? "—"} m · Boom {simPose?.boomDeg.toFixed(0) ?? "—"}°
              </span>
            </div>
            <Progress value={(simPose?.progress ?? 0) * 100} className="mt-2 h-1.5" />
          </div>
        )}

        {/* آمار سریع */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg border bg-muted/40 px-2 py-1.5">
            <div className="text-[11px] text-muted-foreground">شعاع</div>
            <div className="text-sm font-bold" dir="ltr">
              {geo?.ok ? `${geo.radiusM.toFixed(1)} m` : "—"}
            </div>
          </div>
          <div className="rounded-lg border bg-muted/40 px-2 py-1.5">
            <div className="text-[11px] text-muted-foreground">بار کل</div>
            <div className="text-sm font-bold text-amber-500" dir="ltr">
              {grossT.toFixed(1)} t
            </div>
          </div>
          <div className="rounded-lg border bg-muted/40 px-2 py-1.5">
            <div className="text-[11px] text-muted-foreground">ظرفیت مجاز</div>
            <div className="text-sm font-bold" dir="ltr">
              {result?.ratedCapacityT != null ? `${result.ratedCapacityT.toFixed(1)} t` : "—"}
            </div>
          </div>
        </div>

        {/* دکمه بزرگ Play */}
        <Button
          size="lg"
          disabled={running || !crane || simActive}
          onClick={handlePlay}
          className="h-14 w-full gap-3 border-2 border-amber-300/40 bg-amber-500 text-lg font-black text-black shadow-[0_0_36px_rgba(245,158,11,0.28)] transition-all hover:bg-amber-400 hover:shadow-[0_0_48px_rgba(245,158,11,0.4)] active:scale-[0.99]"
        >
          <Play className="size-6 fill-black" />
          {running
            ? "در حال تحلیل..."
            : simActive
              ? "در حال حرکت جرثقیل..."
              : "تحلیل لیفت / Play"}
        </Button>
        <p className="text-center text-[11px] text-muted-foreground">
          {bothFlags
            ? "دو پرچم ثبت شده — پس از تحلیل، حرکت کامل جرثقیل از A تا B شبیه‌سازی می‌شود."
            : "برای شبیه‌سازی حرکت، در مرحله ۴ دو پرچم A و B روی زمین بگذارید."}
          {" • "}
          چرخش: درگ • زوم: اسکرول
        </p>
      </CardContent>
    </Card>
  );
}
