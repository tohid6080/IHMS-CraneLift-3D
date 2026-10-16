"use client";

/**
 * IHMS CraneLift 3D — دیالوگ ارتقا (پلن‌ها + خرید نسخه‌ی حرفه‌ای)
 * -----------------------------------------------------------
 * جدول مقایسه پلن‌ها (رایگان / حرفه‌ای / سازمانی) و دکمه‌ی خریدِ واقعی از
 * طریقِ خریدِ درون‌برنامه‌ایِ کافه‌بازار (Poolakey). فعال‌سازی فقط پس از
 * بازگشتِ نتیجه‌ی موفق از پلاگینِ نیتیو انجام می‌شود — هیچ کدِ دستی/دموی
 * قابلِ‌دورزدن در این نسخه وجود ندارد.
 */

import { useState } from "react";
import { Check, Crown, X, Loader2, BadgeCheck, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useLiftStore } from "@/lib/cranelift/store";
import { PLANS } from "@/lib/cranelift/licensing";
import { isNativeBillingAvailable, purchaseProViaBazaar } from "@/lib/cranelift/bazaarBilling";
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
  const activatePro = useLiftStore((s) => s.activatePro);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handlePurchase = async () => {
    setError(null);
    setBusy(true);
    const res = await purchaseProViaBazaar();
    setBusy(false);
    if (res.success && res.purchaseToken) {
      activatePro({ purchaseToken: res.purchaseToken, orderId: res.orderId });
      toast({
        title: "🎉 نسخه حرفه‌ای فعال شد",
        description: "همه امکانات Pro بدون محدودیت در دسترس است.",
      });
      onOpenChange(false);
    } else if (!res.cancelled) {
      setError(res.error || "خرید انجام نشد. دوباره تلاش کنید.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto scroll-slim">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Crown className="size-5 text-amber-500" />
            ارتقای IHMS CraneLift 3D
          </DialogTitle>
          <DialogDescription>
            نسخه رایگان تا سقف روزانه کار می‌کند (۵ اجرای تحلیل+شبیه‌سازی، ۵ محاسبه سیم، ۱ گزارش با
            واترمارک)؛ برای استفاده نامحدود و گزارش بدون واترمارک، پلن حرفه‌ای را فعال کنید.
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
                    className="mt-3 gap-1.5 bg-amber-500 text-black hover:bg-amber-400"
                    onClick={handlePurchase}
                    disabled={busy}
                  >
                    {busy ? <Loader2 className="size-4 animate-spin" /> : <ShoppingBag className="size-4" />}
                    خرید از کافه‌بازار
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

        {/* ── خرید ── */}
        <div className="rounded-xl border-2 border-dashed border-amber-500/40 p-4">
          <div className="flex items-center gap-2 text-sm font-bold">
            <ShoppingBag className="size-4 text-amber-500" />
            خرید نسخه حرفه‌ای
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            خرید و فعال‌سازی به‌صورتِ خودکار و از طریقِ درگاهِ رسمیِ کافه‌بازار انجام می‌شود —
            نیازی به واردکردنِ کد نیست.
          </p>
          <div className="mt-3">
            <Button
              className="w-full gap-1.5 bg-amber-500 text-black hover:bg-amber-400"
              onClick={handlePurchase}
              disabled={busy}
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <ShoppingBag className="size-4" />}
              خرید از کافه‌بازار — {PLANS.find((p) => p.id === "pro")?.price}
            </Button>
          </div>
          {error && <p className="mt-2 text-xs font-medium text-red-500">{error}</p>}
          {!isNativeBillingAvailable() && (
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
              خرید فقط از طریقِ نسخه‌ی اندرویدِ نصب‌شده از کافه‌بازار ممکن است.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
