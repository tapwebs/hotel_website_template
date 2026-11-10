import httpx
from typing import Optional
from backend.app.core.config import settings
from backend.app.core.errors import ValidationException

TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"


async def verify_turnstile_token(token: Optional[str], client_ip: Optional[str] = None) -> bool:
    """
    Verifies Cloudflare Turnstile token for public forms and booking checkout.
    When TURNSTILE_SECRET_KEY is unset (e.g. in local development or test suites),
    verification passes automatically.
    """
    secret = settings.TURNSTILE_SECRET_KEY
    if not secret:
        return True

    if not token:
        raise ValidationException("CAPTCHA verification token is required.")

    async with httpx.AsyncClient(timeout=5.0) as client:
        try:
            resp = await client.post(
                TURNSTILE_VERIFY_URL,
                data={
                    "secret": secret,
                    "response": token,
                    "remoteip": client_ip or ""
                }
            )
            result = resp.json()
            if not result.get("success"):
                raise ValidationException("CAPTCHA challenge failed. Please refresh and try again.")
            return True
        except ValidationException:
            raise
        except Exception:
            # Fallback or transient network issue with Turnstile
            return False
