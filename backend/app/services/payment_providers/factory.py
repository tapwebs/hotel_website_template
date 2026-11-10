from typing import Optional
from backend.app.core.config import settings
from backend.app.services.payment_providers.base import PaymentConfigurationError, PaymentProvider
from backend.app.services.payment_providers.demo_provider import DemoPaymentProvider
from backend.app.services.payment_providers.razorpay_provider import RazorpayPaymentProvider
from backend.app.services.payment_providers.bank_provider import BankGatewayPaymentProvider


def get_payment_provider(provider_override: Optional[str] = None) -> PaymentProvider:
    """
    Factory to retrieve the configured payment provider adapter.
    Defaults to 'demo' when no provider is explicitly configured or passed.
    """
    raw_name = (provider_override or settings.PAYMENT_PROVIDER or "demo").strip().lower()
    if raw_name in ("demo", "local", "cash_register"):
        return DemoPaymentProvider()
    elif raw_name == "razorpay":
        provider = RazorpayPaymentProvider()
        return provider
    elif raw_name in ("bank", "bank_gateway"):
        provider = BankGatewayPaymentProvider()
        return provider
    else:
        raise PaymentConfigurationError(
            f"Unsupported payment provider: '{raw_name}'. Configured options are 'demo', 'razorpay', or 'bank'.",
            details={"configured_provider": raw_name}
        )


def refund_provider_for(provider: Optional[str], transaction_ref: Optional[str]) -> Optional[PaymentProvider]:
    """The gateway that must reverse an existing payment, or None when the money was taken offline.

    Payment.provider records where the money was captured. Many values are written across the app
    (CASH_REGISTER, PINE_LABS_POS, POS_TERMINAL, BANK_CSV, ...); only payments captured by an online gateway
    can be refunded through it. Everything else is handed back at the desk and only recorded here.
    This never looks at PAYMENT_PROVIDER: switching the active gateway must not change how old payments refund.
    """
    name = (provider or "").strip().upper()
    if name == "DEMO":
        return DemoPaymentProvider()
    if name in ("BANK", "BANK_GATEWAY"):
        return BankGatewayPaymentProvider()
    # A Razorpay refund needs the gateway payment id (pay_...). Rows without one were recorded by staff, not captured online.
    if name == "RAZORPAY" and (transaction_ref or "").startswith("pay_"):
        return RazorpayPaymentProvider()
    return None
