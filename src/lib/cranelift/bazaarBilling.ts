/**
 * IHMS CraneLift 3D — پل ارتباطی با پلاگینِ نیتیوِ خریدِ درون‌برنامه‌ایِ
 * کافه‌بازار (Poolakey)
 * -----------------------------------------------------------
 * این فایل فقط یک wrapper نازک روی پلاگینِ Capacitor به نامِ "BazaarBilling"
 * است (پیاده‌سازیِ Kotlin در android/bazaar-billing-plugin، ر.ک. README آن
 * پوشه). روی وب/دمو (جایی که پلاگینِ نیتیو در دسترس نیست) هر دو متد با یک
 * خطای روشن reject می‌شوند تا UI بتواند پیام مناسب نشان دهد — هیچ fallback
 * ساختگی یا کدِ فعال‌سازیِ محلی در این‌جا وجود ندارد.
 */

import { registerPlugin, Capacitor } from "@capacitor/core";

export interface PurchaseResult {
  success: boolean;
  purchaseToken?: string;
  orderId?: string;
  /** کاربر انصراف داد؛ خطای واقعی نیست */
  cancelled?: boolean;
  error?: string;
}

export interface QueryPurchasesResult {
  owned: boolean;
  purchaseToken?: string;
}

export interface BazaarBillingPlugin {
  /** باز کردنِ فرایندِ خریدِ Poolakey برای SKU پرو (ر.ک. android/.../BazaarBillingPlugin.kt) */
  purchasePro(): Promise<PurchaseResult>;
  /** پرس‌وجوی خریدهای فعلیِ کاربر نزدِ بازار (برای sync در هر بار اجرای اپ) */
  queryPurchases(): Promise<QueryPurchasesResult>;
}

const BazaarBilling = registerPlugin<BazaarBillingPlugin>("BazaarBilling");

/** آیا اپ داخلِ اندرویدِ نیتیو (نه مرورگر/دمو) اجرا می‌شود و پلاگین در دسترس است؟ */
export function isNativeBillingAvailable(): boolean {
  try {
    return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("BazaarBilling");
  } catch {
    return false;
  }
}

/** خریدِ نسخه‌ی Pro از طریقِ کافه‌بازار. فقط روی اندرویدِ نیتیو کار می‌کند. */
export async function purchaseProViaBazaar(): Promise<PurchaseResult> {
  if (!isNativeBillingAvailable()) {
    return {
      success: false,
      error: "خرید فقط در نسخه‌ی اندرویدِ نصب‌شده از کافه‌بازار ممکن است.",
    };
  }
  try {
    return await BazaarBilling.purchasePro();
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "خطای نامشخص در ارتباط با بازار." };
  }
}

/** پرس‌وجوی وضعیتِ مالکیتِ Pro نزدِ بازار (در شروعِ اپ صدا زده می‌شود). */
export async function queryProOwnership(): Promise<QueryPurchasesResult | null> {
  if (!isNativeBillingAvailable()) return null;
  try {
    return await BazaarBilling.queryPurchases();
  } catch {
    return null;
  }
}
