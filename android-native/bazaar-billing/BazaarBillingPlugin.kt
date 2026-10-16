package com.ihms.cranelift3d

import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import ir.cafebazaar.poolakey.Connection
import ir.cafebazaar.poolakey.Payment
import ir.cafebazaar.poolakey.config.PaymentConfiguration
import ir.cafebazaar.poolakey.config.SecurityCheck
import ir.cafebazaar.poolakey.request.PurchaseRequest

/**
 * IHMS CraneLift 3D — پلاگینِ Capacitor برایِ خریدِ درون‌برنامه‌ایِ کافه‌بازار
 * (Poolakey SDK).
 *
 * به‌روزرسانی‌شده بر اساسِ مستندِ رسمیِ پولکی (پیشخوانِ توسعه‌دهندگانِ
 * کافه‌بازار) — از APIِ فعلیِ مبتنی‌بر ActivityResultRegistry استفاده
 * می‌کند (نه الگویِ قدیمی‌ترِ requestCode/onActivityResult که نسخه‌ی اولِ
 * این فایل از حافظه نوشته بود).
 *
 * امضایِ API (نام‌هایِ callback، نوعِ خروجیِ payment.connect یعنی
 * Connection، و پراپرتی‌هایِ PurchaseInfo یعنی purchaseToken/orderId/
 * productId) مستقیماً از سورسِ واقعیِ github.com/cafebazaar/Poolakey
 * تأیید شد — نه فقط حدس. تنها چیزی که هنوز روی دستگاهِ واقعی تست نشده،
 * خودِ جریانِ عملیِ خرید (دیالوگِ بازار، لغو، بازگشت به اپ) است.
 *
 * ── مواردی که باید پیش از استفاده پر شوند ──
 *  - BAZAAR_RSA_PUBLIC_KEY : کلیدِ RSAِ عمومیِ اپ از پیشخوانِ
 *    توسعه‌دهندگانِ کافه‌بازار → برنامه‌ی شما → تبِ «پرداختِ درون‌برنامه‌ای».
 *  - PRODUCT_ID_PRO : شناسه‌یِ محصولِ «نسخه‌ی حرفه‌ای» که در همان تب
 *    تعریف می‌کنید.
 */
@CapacitorPlugin(name = "BazaarBilling")
class BazaarBillingPlugin : Plugin() {

    // TODO: productIdPro را با شناسه‌ی واقعیِ محصولی که در پیشخوانِ بازار
    // می‌سازید جایگزین کنید (فعلاً placeholder است).
    private val rsaPublicKey: String =
        "MIHNMA0GCSqGSIb3DQEBAQUAA4G7ADCBtwKBrwDR5IXje+nLjoF/kbtJJ0aSeJcTPibdetAHM+v4" +
            "MIAlovTMLBf1gX8bGclAoFOXLMQNSMWZAKvCmDSgH7ZAI2rCXWdPf5oQFj+oQBJshtF1z6GInbfS" +
            "dQgMGgKb7Cz/6X5coEpLK3hEsloVc7mN14/9CQqUmCZmvYGTFrXvnulUHWDK8O+UyxSQhjmFFXcp" +
            "RmD3Sw40YK8x1V0vTQaVlRUVy88wNAoHkra6kk8xQTsCAwEAAQ=="
    private val productIdPro: String = "cranelift_pro_lifetime"

    private val paymentConfig by lazy {
        PaymentConfiguration(localSecurityCheck = SecurityCheck.Enable(rsaPublicKey))
    }

    private val payment by lazy { Payment(context = context, config = paymentConfig) }
    private var paymentConnection: Connection? = null

    override fun load() {
        super.load()
        paymentConnection = payment.connect {
            connectionSucceed { /* آماده برای خرید/پرس‌وجو */ }
            connectionFailed { /* اتصال به بازار برقرار نشد (مثلاً بازار نصب نیست) */ }
            disconnected { /* اتصال قطع شد */ }
        }
    }

    @PluginMethod
    fun purchasePro(call: PluginCall) {
        val act = activity ?: run {
            call.reject("اکتیویتی در دسترس نیست.")
            return
        }
        payment.purchaseProduct(
            registry = act.activityResultRegistry,
            request = PurchaseRequest(productId = productIdPro)
        ) {
            purchaseFlowBegan { /* دیالوگِ پرداختِ بازار باز شد */ }
            failedToBeginFlow { throwable ->
                val ret = JSObject()
                ret.put("success", false)
                ret.put("error", throwable.message ?: "شروعِ فرایندِ خرید ناموفق بود.")
                call.resolve(ret)
            }
            purchaseSucceed { purchaseEntity ->
                val ret = JSObject()
                ret.put("success", true)
                ret.put("purchaseToken", purchaseEntity.purchaseToken)
                ret.put("orderId", purchaseEntity.orderId)
                call.resolve(ret)
            }
            purchaseCanceled {
                val ret = JSObject()
                ret.put("success", false)
                ret.put("cancelled", true)
                call.resolve(ret)
            }
            purchaseFailed { throwable ->
                val ret = JSObject()
                ret.put("success", false)
                ret.put("error", throwable.message ?: "خرید ناموفق بود.")
                call.resolve(ret)
            }
        }
    }

    @PluginMethod
    fun queryPurchases(call: PluginCall) {
        payment.getPurchasedProducts {
            querySucceed { purchasedProducts ->
                val owned = purchasedProducts.any { it.productId == productIdPro }
                val token = purchasedProducts.firstOrNull { it.productId == productIdPro }?.purchaseToken
                val ret = JSObject()
                ret.put("owned", owned)
                if (token != null) ret.put("purchaseToken", token)
                call.resolve(ret)
            }
            queryFailed { throwable ->
                // شکستِ پرس‌وجو = نامشخص، نه لزوماً «مالک نیست».
                call.reject(throwable.message ?: "پرس‌وجوی خریدها ناموفق بود.")
            }
        }
    }

    override fun handleOnDestroy() {
        super.handleOnDestroy()
        paymentConnection?.disconnect()
    }
}
