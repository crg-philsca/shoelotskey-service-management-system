"""
Shoelotskey SMS - Dual-Mode Cache Layer (Redis + In-Memory Fallback)
Provides high-performance caching for sales analytics, order lookups, and report aggregations
with automatic invalidation on order mutations.
"""

import os
import time
import json
import threading
from typing import Any, Optional


class InMemoryCache:
    """Thread-safe in-memory cache with TTL support and prefix invalidation."""
    def __init__(self):
        self._lock = threading.Lock()
        self._store: dict = {}

    def get(self, key: str) -> Optional[Any]:
        now = time.time()
        with self._lock:
            entry = self._store.get(key)
            if not entry:
                return None
            val, expiry = entry
            if expiry is not None and now > expiry:
                self._store.pop(key, None)
                return None
            return val

    def set(self, key: str, value: Any, ttl: Optional[int] = 30) -> None:
        expiry = (time.time() + ttl) if ttl else None
        with self._lock:
            self._store[key] = (value, expiry)

    def invalidate_prefix(self, prefix: str) -> int:
        count = 0
        with self._lock:
            keys_to_del = [k for k in self._store if k.startswith(prefix)]
            for k in keys_to_del:
                self._store.pop(k, None)
                count += 1
        return count

    def clear(self) -> None:
        with self._lock:
            self._store.clear()


class CacheService:
    """
    Unified Cache Manager:
    Attempts to connect to Redis if REDIS_URL is provided in environment variables;
    otherwise seamlessly operates the in-memory cache fallback.
    """
    def __init__(self):
        self.redis_client = None
        self.memory_cache = InMemoryCache()
        self.is_redis_active = False

        redis_url = os.getenv("REDIS_URL")
        if redis_url:
            try:
                import redis
                client = redis.from_url(redis_url, socket_timeout=2, socket_connect_timeout=2)
                client.ping()
                self.redis_client = client
                self.is_redis_active = True
                print("[CACHE] Redis connection established successfully.")
            except Exception as e:
                print(f"[CACHE] Redis not reachable ({e}). Using thread-safe In-Memory Cache.")
        else:
            print("[CACHE] Initialized high-performance In-Memory Cache (Redis fallback active).")

    def get(self, key: str) -> Optional[Any]:
        if self.is_redis_active and self.redis_client:
            try:
                raw = self.redis_client.get(key)
                if raw:
                    return json.loads(raw)
                return None
            except Exception:
                pass
        return self.memory_cache.get(key)

    def set(self, key: str, value: Any, ttl: int = 30) -> None:
        if self.is_redis_active and self.redis_client:
            try:
                serialized = json.dumps(value, default=str)
                self.redis_client.setex(key, ttl, serialized)
                return
            except Exception:
                pass
        self.memory_cache.set(key, value, ttl=ttl)

    def invalidate_prefix(self, prefix: str) -> int:
        """Invalidates all cache keys matching the given prefix (e.g. 'orders:', 'sales:')."""
        count = 0
        if self.is_redis_active and self.redis_client:
            try:
                keys = self.redis_client.keys(f"{prefix}*")
                if keys:
                    count += self.redis_client.delete(*keys)
            except Exception:
                pass
        count += self.memory_cache.invalidate_prefix(prefix)
        return count

    def clear(self) -> None:
        if self.is_redis_active and self.redis_client:
            try:
                self.redis_client.flushdb()
            except Exception:
                pass
        self.memory_cache.clear()


# Global cache singleton instance
cache_service = CacheService()
