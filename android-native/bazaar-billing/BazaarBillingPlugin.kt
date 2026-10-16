package com.ihms.cranelift3d

import android.app.Activity
import android.content.Intent
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import ir.cafebazaar.poolakey.Payment
import ir.cafebazaar.poolakey.config.PaymentConfiguration
import ir.cafebazaar.poolakey.config.SecurityCheck
import ir.cafebazaar.poolakey.request.PurchaseRequest

/**
 * IHMS CraneLift 3D — پلاگینِ Capacitor برایِ خریدِ درون‌برنامه‌ایِ کافه‌بازار
 * (Poolakey SDK).
 *
 * این فایل دستی نوشته شده و در این سندباکس کامپایل/تست نشده — چون:
 *  ۱) ساختِ اندرویدِ واقعی نیازمندِ Android SDK/Gradle است که این‌جا در
 *     دسترس نیست،
 *  ۲) تستِ واقعیِ خرید نیازمندِ حسابِ توسعه‌دهنده‌یِ کافه‌بازار + کلیدِ
 *     RSAِ عمومی + یک دستگاهِ واقعی با اپِ کافه‌بازار نصب‌شده است.
 * پیش از انتشارِ نهایی حتماً روی یک دستگاهِ واقعی تست شود.
 *
 * ── مواردی که باید پیش از استفاده پر شوند ──
 *  - BAZAAR_RSA_PUBLIC_KEY : کلیدِ RSAِ عمومیِ اپ از پنلِ توسعه‌دهندگانِ
 *    کافه‌بازار (developers.cafebazaar.ir → اپ شما → تنظیمات → کلید RSA).
 *  - PRODUCT_ID_PRO : شناسه‌یِ محصولِ «نسخه‌ی حرفه‌ای» که در پنلِ
 *    «محصولاتِ درون‌برنامه‌ای» تعریف می‌کنید (مثلاً "cranelift_pro_lifetime").
 */
@CapacitorPlugin(name = "BazaarBilling")
class BazaarBillingPlugin : Plugin() {

    // TODO: پیش از انتشار، این دو مقدار را از پنلِ کافه‌بازار پر کنید.
    private val rsaPublicKey: String = "BAZAAR_RSA_PUBLIC_KEY_PLACEHOLDER"
    private val productIdPro: String = "cranelift_pro_lifetime"

    private val paymentConfig by lazy {
        PaymentConfiguration(
            localSecurityCheck = SecurityCheck.Enable(rsaPublicKey)
        )
    }

    private val payment by lazy { Payment(context, paymentConfig) }

    private var pendingPurchaseCall: PluginCall? = null
    private val purchaseRequestCode = 1001

    override fun load() {
        super.load()
        payment.connect {
            connectionSucceed = { /* آماده برای خرید/پرس‌وجو */ }
            connectionFailed = { /* اتصال به بازار برقرار نشد (مثلاً بازار نصب نیست) */ }
            disconnected = { /* اتصال قطع شد */ }
        }
    }

    @PluginMethod
    fun purchasePro(call: PluginCall) {
        val activity: Activity = activity ?: run {
            call.reject("اکتیویتی در دسترس نیست.")
            return
        }
        pendingPurchaseCall = call
        payment.purchaseProduct(
            activity = activity,
            request = PurchaseRequest(productId = productIdPro),
            requestCode = purchaseRequestCode
        ) {
            purchaseFlowBegan = { /* دیالوگِ پرداختِ بازار باز شد */ }
            failedToBeginFlow = { throwable ->
                pendingPurchaseCall?.let { c ->
                    val ret = JSObject()
                    ret.put("success", false)
                    ret.put("error", throwable.message ?: "شروعِ فرایندِ خرید ناموفق بود.")
                    c.resolve(ret)
                }
                pendingPurchaseCall = null
            }
        }
    }

    @PluginMethod
    fun queryPurchases(call: PluginCall) {
        payment.getPurchasedProducts {
            querySucceed = { purchasedProducts ->
                val owned = purchasedProducts.any { it.productId == productIdPro }
                val token = purchasedProducts.firstOrNull { it.productId == productIdPro }?.purchaseToken
                val ret = JSObject()
                ret.put("owned", owned)
                if (token != null) ret.put("purchaseToken", token)
                call.resolve(ret)
            }
            queryFailed = { throwable ->
                // شکستِ پرس‌وجو = نامشخص، نه لزوماً «مالک نیست». برای احتیاط
                // owned=false برگردانده می‌شود تا وضعیتِ محلیِ قدیمی override نشود
                // مگر این‌که در لایه‌ی JS تصمیمِ دیگری گرفته شود.
                call.reject(throwable.message ?: "پرس‌وجوی خریدها ناموفق بود.")
            }
        }
    }

    override fun handleOnActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.handleOnActivityResult(requestCode, resultCode, data)
        if (requestCode != purchaseRequestCode) return
        val call = pendingPurchaseCall ?: return

        payment.onActivityResult(requestCode, resultCode, data) {
            purchaseSucceed = { purchaseInfo ->
                val ret = JSObject()
                ret.put("success", true)
                ret.put("purchaseToken", purchaseInfo.purchaseToken)
                ret.put("orderId", purchaseInfo.orderId)
                call.resolve(ret)
                pendingPurchaseCall = null
            }
            purchaseCanceled = {
                val ret = JSObject()
                ret.put("success", false)
                ret.put("cancelled", true)
                call.resolve(ret)
                pendingPurchaseCall = null
            }
            purchaseFailed = { throwable ->
                val ret = JSObject()
                ret.put("success", false)
                ret.put("error", throwable.message ?: "خرید ناموفق بود.")
                call.resolve(ret)
                pendingPurchaseCall = null
            }
        }
    }

    override fun handleOnDestroy() {
        super.handleOnDestroy()
        payment.disconnect()
    }
}
