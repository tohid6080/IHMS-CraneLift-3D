"use client";

/**
 * CraneLift Pro 3D — دیالوگ ارتقا (پلن‌ها + فعال‌سازی کد)
 * -----------------------------------------------------------
 * جدول مقایسه پلن‌ها (رایگان / حرفه‌ای / سازمانی) و ورود کد فعال‌سازی.
 * کدهای دمو داخل licensing.ts هستند؛ در نسخه تجاری جای اعتبارسنجی سروری می‌گیرد.
 */

import { useState } from "react";
import { Check, Crown, KeyRound, X, Loader2, BadgeCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useLiftStore } from "@/lib/cranelift/store";
import { PLANS, PRO_DEMO_CODES } from "@/lib/cranelift/licensing";
import { useToast } from "@/hooks/use-toast";

export default function UpgradeDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { toast } = useToast();
  const license = useLiftStore((s) => s.license);
  const activate = useLiftStore((s) => s.activate);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleActivate = () => {
    setError(null);
    if (!code.trim()) {
      setError("کد فعال‌سازی را وارد کنید.");
      return;
    }
    setBusy(true);
    // تأخیر کوتاه برای حس اعتبارسنجی
    setTimeout(() => {
      const ok = activate(code);
      setBusy(false);
      if (ok) {
        toast({
          title: "🎉 نسخه حرفه‌ای فعال شد",
          description: "همه امکانات Pro بدون محدودیت در دسترس است.",
        });
        setCode("");
        onOpenChange(false);
      } else {
        setError("کد واردشده معتبر نیست. کد را از فروشنده دریافت کنید.");
      }
    }, 450);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto scroll-slim">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Crown className="size-5 text-amber-500" />
            ارتقای CraneLift Pro 3D
          </DialogTitle>
          <DialogDescription>
            نسخه رایگان تا سقف مشخص کار می‌کند؛ برای شبیه‌سازی حرکت و گزارش نامحدود، پلن حرفه‌ای
            را فعال کنید.
          </DialogDescription>
        </DialogHeader>

        {/* ── کارت‌های پلن ── */}
        <div className="grid gap-3 md:grid-cols-3">
          {PLANS.map((p) => {
            const isCurrent =
              (p.id === "free" && license.plan === "free") ||
              (p.id === "pro" && license.plan === "pro");
            const highlight = p.id === "pro";
            return (
              <div
                key={p.id}
                className={`relative flex flex-col rounded-xl border-2 p-4 ${
                  highlight
                    ? "border-amber-500/60 bg-amber-500/5 shadow-[0_0_24px_rgba(245,158,11,0.15)]"
                    : "border-border"
                }`}
              >
                {highlight && (
                  <Badge className="absolute -top-2.5 start-3 bg-amber-500 text-black">
                    پیشنهاد ما
                  </Badge>
                )}
                <div className="text-sm font-black">{p.title}</div>
                <div className="mt-1 text-lg font-black text-amber-500">{p.price}</div>
                <div className="text-[11px] text-muted-foreground">{p.period}</div>
                <ul className="mt-3 flex-1 space-y-1.5">
                  {p.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-xs leading-relaxed">
                      {f.ok ? (
                        <Check className="mt-0.5 size-3.5 shrink-0 text-green-500" />
                      ) : (
                        <X className="mt-0.5 size-3.5 shrink-0 text-red-400" />
                      )}
                      <span className={f.ok ? "" : "text-muted-foreground line-through decoration-red-400/50"}>
                        {f.text}
                      </span>
                    </li>
                  ))}
                </ul>
                {isCurrent && (
                  <div className="mt-3 flex items-center justify-center gap-1.5 rounded-lg border border-green-500/40 bg-green-500/10 py-2 text-xs font-bold text-green-500">
                    <BadgeCheck className="size-4" />
                    پلن فعال شما
                  </div>
                )}
                {!isCurrent && p.id === "pro" && (
                  <Button
                    className="mt-3 bg-amber-500 text-black hover:bg-amber-400"
                    onClick={() => {
                      document.getElementById("activation-code-input")?.focus();
                    }}
                  >
                    فعال‌سازی با کد
                  </Button>
                )}
                {!isCurrent && p.id === "enterprise" && (
                  <Button variant="outline" className="mt-3" disabled>
                    تماس با فروش
                  </Button>
                )}
              </div>
            );
          })}
        </div>

        {/* ── فعال‌سازی ── */}
        <div className="rounded-xl border-2 border-dashed border-amber-500/40 p-4">
          <div className="flex items-center gap-2 text-sm font-bold">
            <KeyRound className="size-4 text-amber-500" />
            فعال‌سازی نسخه حرفه‌ای
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            کد لایسنس خریداری‌شده را وارد کنید (پس از پرداخت، کد برای شما ارسال می‌شود).
          </p>
          <div className="mt-3 flex gap-2">
            <Input
              id="activation-code-input"
              dir="ltr"
              placeholder="CLP-PRO-XXXX-XXXX"
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setError(null);
              }}
              onKeyDown={(e) => e.key === "Enter" && handleActivate()}
              className="flex-1 text-center font-mono"
            />
            <Button
              className="gap-1.5 bg-amber-500 text-black hover:bg-amber-400"
              onClick={handleActivate}
              disabled={busy}
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
              فعال‌سازی
            </Button>
          </div>
          {error && <p className="mt-2 text-xs font-medium text-red-500">{error}</p>}
          <div className="mt-3 rounded-lg bg-muted/50 p-2.5">
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              <span className="font-bold text-amber-500">کدهای آزمایشی (دمو):</span>{" "}
              {PRO_DEMO_CODES.slice(0, 3).map((c) => (
                <button
                  key={c}
                  type="button"
                  dir="ltr"
                  className="mx-1 rounded bg-background px-1.5 py-0.5 font-mono text-[10px] hover:text-amber-500"
                  onClick={() => setCode(c)}
                >
                  {c}
                </button>
              ))}
              — با کلیک، در فیلد قرار می‌گیرد.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
