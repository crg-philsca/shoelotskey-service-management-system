"""
Shoelotskey SMS - Thread-Safe Sliding Window IP Rate Limiter
Defense-in-depth against credential brute-force and dictionary attacks on authentication endpoints.
"""

import time
import threading
from typing import Dict, List, Tuple
from fastapi import Request


class SlidingWindowRateLimiter:
    def __init__(self, max_requests: int = 5, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._lock = threading.Lock()
        self._requests: Dict[str, List[float]] = {}
        self._last_cleanup = time.time()

    def _cleanup_stale(self, now: float):
        """Remove IPs that have no requests in the current window."""
        stale_cutoff = now - self.window_seconds
        stale_ips = [
            ip for ip, timestamps in self._requests.items()
            if not timestamps or timestamps[-1] < stale_cutoff
        ]
        for ip in stale_ips:
            self._requests.pop(ip, None)
        self._last_cleanup = now

    def check(self, client_ip: str) -> Tuple[bool, int]:
        """
        Checks if the client IP is within rate limits.
        Returns:
            (is_allowed: bool, retry_after_seconds: int)
        """
        now = time.time()
        with self._lock:
            if now - self._last_cleanup > 300:
                self._cleanup_stale(now)

            timestamps = self._requests.get(client_ip, [])
            cutoff = now - self.window_seconds
            # Keep only timestamps within the active sliding window
            timestamps = [ts for ts in timestamps if ts > cutoff]

            if len(timestamps) >= self.max_requests:
                # Rate limit exceeded. Time until oldest request exits the window
                oldest = timestamps[0]
                retry_after = max(1, int(self.window_seconds - (now - oldest)))
                self._requests[client_ip] = timestamps
                return False, retry_after

            # Allow request and append timestamp
            timestamps.append(now)
            self._requests[client_ip] = timestamps
            return True, 0

    def reset(self, client_ip: str):
        """Reset rate limit history for a specific IP (e.g. after successful login)."""
        with self._lock:
            self._requests.pop(client_ip, None)


# Global singleton instance for login endpoint (5 attempts per 60 seconds per IP)
login_rate_limiter = SlidingWindowRateLimiter(max_requests=5, window_seconds=60)


def extract_client_ip(request: Request) -> str:
    """Safely extracts real client IP addressing reverse proxies (X-Forwarded-For)."""
    if not request:
        return "127.0.0.1"

    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        # Take the leftmost IP in the list (originating client)
        client_ip = forwarded.split(",")[0].strip()
        if client_ip:
            return client_ip

    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip.strip()

    if request.client and request.client.host:
        return request.client.host.strip()

    return "127.0.0.1"
