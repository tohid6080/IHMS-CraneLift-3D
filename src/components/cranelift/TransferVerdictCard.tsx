"use client";

/**
 * CraneLift Pro 3D — کارت نتیجه شبیه‌سازی جابجایی دوعرچه‌ای (A → B)
 * در مرحله ۴ (پس از پایان انیمیشن) و مرحله ۵ (خلاصه تحلیل) استفاده می‌شود.
 */

import { AlertTriangle, CheckCircle2, Info, Wrench, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { STATUS_COLORS, STATUS_LABELS } from "@/lib/cranelift/analysis";
import type { TransferIssue, TransferResult } from "@/lib/cranelift/types";

const LEVEL_ICON = {
  info: Info,
  warning: AlertTriangle,
  danger: XCircle,
} as const;

const LEVEL_CLS = {
  info: "border bg-muted/50 text-muted-foreground",
  warning: "border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  danger: "border border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400",
} as const;

function IssueRow({ issue }: { issue: TransferIssue }) {
  const Icon = LEVEL_ICON[issue.level];
  return (
    <div className={`flex items-start gap-2.5 rounded-lg p-3 ${LEVEL_CLS[issue.level]}`}>
      <Icon className="mt-0.5 size-4.5 shrink-0" />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-sm leading-relaxed">{issue.message}</p>
        <p className="flex items-start gap-1.5 text-xs leading-relaxed opacity-90">
          <Wrench className="mt-0.5 size-3.5 shrink-0" />
          <span>
            <span className="font-bold">راهکار: </span>
            {issue.fix}
          </span>
        </p>
      </div>
    </div>
  );
}

export default function TransferVerdictCard({
  transfer,
  compact,
}: {
  transfer: TransferResult;
  /** حالت فشرده (برای پنل کناری) */
  compact?: boolean;
}) {
  const Icon =
    transfer.status === "allowed"
      ? CheckCircle2
      : transfer.status === "caution"
        ? AlertTriangle
        : XCircle;
  const color = STATUS_COLORS[transfer.status];

  return (
    <Card className="border-2" style={{ borderColor: `${color}66` }}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between gap-2 text-sm">
          <span>نتیجه جابجایی دوپرچمی (A → B)</span>
          <Badge className="text-black" style={{ backgroundColor: color }}>
            {STATUS_LABELS[transfer.status]}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* نتیجه هر نقطه */}
        <div className="grid grid-cols-2 gap-2">
          {transfer.points.map((p) => {
            const st = p.result.status;
            const c = STATUS_COLORS[st];
            return (
              <div
                key={p.point}
                className="rounded-lg border p-3"
                style={{ borderColor: `${c}55`, background: `${c}0d` }}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-bold" style={{ color: c }}>
                    {p.point} — {p.title}
                  </span>
                  <span className="text-[10px] text-muted-foreground" dir="ltr">
                    R = {p.radiusM.toFixed(1)} m
                  </span>
                </div>
                <div className="mt-1 flex items-baseline gap-1.5" dir="ltr">
                  <span className="text-lg font-black" style={{ color: c }}>
                    {p.result.utilizationPct != null ? `${p.result.utilizationPct.toFixed(0)}%` : "—"}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    ظرفیت {p.result.ratedCapacityT != null ? `${p.result.ratedCapacityT.toFixed(1)}t` : "—"}
                  </span>
                </div>
                {p.boomAngleDeg != null && (
                  <div className="mt-0.5 text-[11px] text-muted-foreground" dir="ltr">
                    Boom {p.boomAngleDeg.toFixed(1)}°
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* نتیجه‌گیری */}
        <p className="rounded-lg bg-muted/40 p-3 text-sm leading-relaxed">{transfer.conclusion}</p>

        {/* ایرادها + راهکار */}
        {transfer.issues.length > 0 && !compact && (
          <div className="space-y-2">
            <div className="text-xs font-bold text-muted-foreground">
              ایرادها و راهکار اصلاح ({transfer.issues.length})
            </div>
            <div className="max-h-72 space-y-2 overflow-y-auto scroll-slim pe-1">
              {transfer.issues.map((i, idx) => (
                <IssueRow key={idx} issue={i} />
              ))}
            </div>
          </div>
        )}
        {transfer.issues.length > 0 && compact && (
          <p className="text-xs text-muted-foreground">
            {transfer.issues.filter((i) => i.level === "danger").length} ایراد قرمز و{" "}
            {transfer.issues.filter((i) => i.level === "warning").length} هشدار — جزئیات در مرحله
            تحلیل.
          </p>
        )}
        {transfer.issues.length === 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-500">
            <CheckCircle2 className="size-4" />
            هر دو نقطه بدون ایراد — لیفت مجاز است.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
