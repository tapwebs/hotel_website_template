"""In-process sliding-window rate limiter with reverse-proxy real IP detection.

Per-process memory for single-instance / Coolify worker deployments.
When deployed behind reverse proxies (Traefik, Nginx, Caddy), client IPs are safely
extracted from X-Forwarded-For headers.
"""
import ipaddress
import time
from collections import deque
from typing import Deque, Dict, Optional

from fastapi import HTTPException, Request
from backend.app.core.config import settings

_hits: Dict[str, Deque[float]] = {}  # per worker process: with N uvicorn workers a client can get up to N x the limit


def _is_trusted_proxy(ip: str) -> bool:
    try:
        addr = ipaddress.ip_address(ip)
        return addr.is_loopback or addr.is_private
    except ValueError:
        return False


def get_client_ip(request: Request, trust_proxy: Optional[bool] = None) -> str:
    """Extract real client IP safely, prioritizing trusted reverse-proxy headers (X-Real-IP, X-Forwarded-For) only from authorized proxies."""
    socket_ip = request.client.host if request.client and request.client.host else "127.0.0.1"

    should_trust = trust_proxy if trust_proxy is not None else (settings.TRUST_PROXY or _is_trusted_proxy(socket_ip))

    if should_trust:
        # 1. Traefik/Nginx authoritative client IP header
        real_ip = request.headers.get("x-real-ip")
        if real_ip and real_ip.strip():
            return real_ip.strip()

        # 2. X-Forwarded-For: parse right-to-left to bypass client-injected spoofed prefixes
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            ips = [i.strip() for i in forwarded.split(",") if i.strip()]
            if ips:
                # Last entry before reverse proxy represents the authentic external client IP
                return ips[-1]

    return socket_ip


def hit(key: str, limit: int, window_seconds: int) -> None:
    """Count one call for `key`; raise HTTP 429 when it is over `limit` within the window."""
    now = time.monotonic()
    q = _hits.setdefault(key, deque())
    while q and now - q[0] > window_seconds:
        q.popleft()
    if len(q) >= limit:
        # Calculate retry-after based on oldest entry in current window
        retry_after = max(1, int(window_seconds - (now - q[0]))) if q else window_seconds
        raise HTTPException(
            status_code=429,
            detail="Too many requests. Please wait a moment.",
            headers={"Retry-After": str(retry_after)}
        )
    q.append(now)
    if len(_hits) > 5000:  # Drop idle keys so memory does not grow unbounded
        for k in [k for k, v in _hits.items() if not v or now - v[-1] > window_seconds]:
            _hits.pop(k, None)


def refund(key: str) -> None:
    """Refund the most recent hit for `key` (e.g. after successful authentication)."""
    q = _hits.get(key)
    if q:
        q.pop()
        if not q:
            _hits.pop(key, None)


def reset() -> None:
    """Clear all active rate-limiting buckets."""
    _hits.clear()
