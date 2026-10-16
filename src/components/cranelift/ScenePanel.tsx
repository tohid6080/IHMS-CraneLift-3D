"use client";

/**
 * CraneLift Pro 3D — پنل نمایش سه‌بعدی
 * -----------------------------------------------------------
 * کانواس سه‌بعدی (client-only) + آمار سریع + دکمه بزرگ تحلیل (Play).
 * در کنار مراحل ۳ تا ۵ به‌صورت sticky نمایش داده می‌شود.
 */

import dynamic from "next/dynamic";
import { useState } from "react";
import { Play, Box, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useLiftStore } from "@/lib/cranelift/store";
import { getCraneById } from "@/lib/cranelift/cranes";
import { solveGeometry, STATUS_COLORS, STATUS_LABELS } from "@/lib/cranelift/analysis";
import { runAnalysis } from "./run-analysis";
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

  const customCranes = useLiftStore((s) => s.customCranes);
  const crane = getCraneById(selectedId, customCranes);
  const geo = crane ? solveGeometry(crane, inputs) : null;
  const grossT = inputs.loadWeightT + inputs.hookBlockWeightT + inputs.riggingWeightT;

  const handlePlay = async () => {
    if (!crane) {
      toast({ title: "ابتدا جرثقیل انتخاب کنید", variant: "destructive" });
      return;
    }
    setRunning(true);
    try {
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
          disabled={running || !crane}
          onClick={handlePlay}
          className="h-14 w-full gap-3 border-2 border-amber-300/40 bg-amber-500 text-lg font-black text-black shadow-[0_0_36px_rgba(245,158,11,0.28)] transition-all hover:bg-amber-400 hover:shadow-[0_0_48px_rgba(245,158,11,0.4)] active:scale-[0.99]"
        >
          <Play className="size-6 fill-black" />
          {running ? "در حال تحلیل..." : "تحلیل لیفت / Play"}
        </Button>
        <p className="text-center text-[11px] text-muted-foreground">
          چرخش: درگ • زوم: اسکرول • جابه‌جایی: درگ راست‌کلیک
        </p>
      </CardContent>
    </Card>
  );
}
