"""
Shoelotskey SMS - Comprehensive Cyberattack Defense & Input Sanitization
Guards against:
- XSS / Script Injection (<script>, javascript:, event handlers, DOM payloads)
- XML / XXE (XML External Entity, DOCTYPE, ENTITY, XML namespaces, XML content types)
- SQL Injection (SQLi syntax, UNION, comments, drop/alter, boolean tautologies, null bytes)
- API Attacks (Brute-force sliding-window rate limiting, timing attacks via constant-time compare, oversized payload DoS)
"""

import re
import html
import secrets
from typing import Optional, Tuple
from fastapi import HTTPException, Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from rate_limiter import SlidingWindowRateLimiter, extract_client_ip

# -------------------------------------------------------------
# 1. ATTACK REGEX PATTERNS
# -------------------------------------------------------------

# XSS & Script Injection Patterns
SCRIPT_ATTACK_PATTERN = re.compile(
    r"(?:"
    r"<\s*script[^>]*>|"
    r"<\s*\/\s*script\s*>|"
    r"javascript\s*:|"
    r"vbscript\s*:|"
    r"data\s*:\s*text\/(?:html|javascript)|"
    r"on(?:abort|blur|change|click|dblclick|error|focus|input|keydown|keypress|keyup|load|mousedown|mousemove|mouseout|mouseover|mouseup|reset|resize|scroll|select|submit|unload)\s*=|"
    r"<\s*(?:iframe|object|embed|svg|applet|meta|link|base|style)\b|"
    r"document\s*\.\s*(?:cookie|location|write)|"
    r"window\s*\.\s*(?:location|open)|"
    r"eval\s*\("
    r")",
    re.IGNORECASE
)

# XML / XXE Injection Patterns
XML_XXE_ATTACK_PATTERN = re.compile(
    r"(?:"
    r"<\?xml\b|"
    r"<!DOCTYPE\b|"
    r"<!ENTITY\b|"
    r"SYSTEM\s+[\"']|"
    r"PUBLIC\s+[\"']|"
    r"xmlns(?::\w+)?\s*=|"
    r"<\s*\/?\s*xml\b|"
    r"file:\/\/\/"
    r")",
    re.IGNORECASE
)

# SQL Injection Patterns
SQLI_ATTACK_PATTERN = re.compile(
    r"(?:"
    r"['\"];\s*(?:--|\/\*)|"
    r"(?:--|\/\*[\s\S]*?\*\/)|"
    r"\b(?:UNION(?:\s+ALL)?\s+SELECT)\b|"
    r"\b(?:SELECT|INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|EXEC|EXECUTE)\b\s+.*?\b(?:FROM|INTO|TABLE|DATABASE|WHERE)\b|"
    r"['\"]\s+(?:OR|AND)\s+['\"0-9a-zA-Z]+\s*=\s*['\"0-9a-zA-Z]+|"
    r"\bOR\s+1\s*=\s*1\b|"
    r"\bAND\s+1\s*=\s*1\b|"
    r"'\s*OR\s*'\s*=\s*'|"
    r"\"\s*OR\s*\"\s*=\s*\""
    r")",
    re.IGNORECASE
)

# -------------------------------------------------------------
# 2. RATE LIMITERS FOR AUTHENTICATION & CODES
# -------------------------------------------------------------
# 10 verification requests per 60 seconds per IP
auth_code_rate_limiter = SlidingWindowRateLimiter(max_requests=10, window_seconds=60)

# 5 supervisor secondary authorizations per 60 seconds per IP
supervisor_auth_rate_limiter = SlidingWindowRateLimiter(max_requests=5, window_seconds=60)

# 5 password recovery requests per 60 seconds per IP
forgot_password_rate_limiter = SlidingWindowRateLimiter(max_requests=5, window_seconds=60)

# 30 public tracking requests per 60 seconds per IP (anti-scraping)
tracking_rate_limiter = SlidingWindowRateLimiter(max_requests=30, window_seconds=60)


# -------------------------------------------------------------
# 3. CORE VALIDATION & SANITIZATION FUNCTIONS
# -------------------------------------------------------------

def validate_and_sanitize_auth_code(raw_code: Optional[str]) -> str:
    """
    Validates, sanitizes, and verifies authorization code input.
    - Strips null bytes and whitespace.
    - Enforces max length (64 chars) to prevent ReDoS/buffer attacks.
    - Rejects script, XML/XXE, or SQL injection vectors.
    - Returns sanitized clean string.
    """
    if raw_code is None:
        raise HTTPException(status_code=400, detail="Authorization code is required.")
    
    code = str(raw_code).strip()
    
    # Check null bytes
    if "\x00" in code:
        raise HTTPException(status_code=400, detail="Invalid characters detected in authorization code.")
        
    # Check length
    if len(code) == 0:
        raise HTTPException(status_code=400, detail="Authorization code cannot be empty.")
    if len(code) > 64:
        raise HTTPException(status_code=400, detail="Authorization code exceeds maximum permitted length (64 characters).")
        
    # Attack pattern inspection
    if SCRIPT_ATTACK_PATTERN.search(code):
        raise HTTPException(status_code=400, detail="Potential script injection detected in authorization code.")
    if XML_XXE_ATTACK_PATTERN.search(code):
        raise HTTPException(status_code=400, detail="Potential XML/XXE payload detected in authorization code.")
    if SQLI_ATTACK_PATTERN.search(code):
        raise HTTPException(status_code=400, detail="Potential SQL injection detected in authorization code.")
        
    # Ensure allowed character set (alphanumeric, dashes, underscores)
    if not re.match(r"^[A-Za-z0-9_\-\.@]+$", code):
        raise HTTPException(status_code=400, detail="Authorization code contains invalid characters. Use letters, numbers, hyphens, and underscores only.")
        
    return code


def validate_and_sanitize_username(raw_username: Optional[str]) -> str:
    """
    Validates and sanitizes username input.
    - Strips whitespace.
    - Rejects null bytes, script tags, XML/XXE patterns, and SQLi syntax.
    - Enforces length limits (3-50 chars).
    """
    if not raw_username:
        raise HTTPException(status_code=400, detail="Username is required.")
        
    username = str(raw_username).strip()
    
    if "\x00" in username:
        raise HTTPException(status_code=400, detail="Invalid null byte in username.")
        
    if len(username) < 2 or len(username) > 50:
        raise HTTPException(status_code=400, detail="Username must be between 2 and 50 characters.")
        
    if SCRIPT_ATTACK_PATTERN.search(username):
        raise HTTPException(status_code=400, detail="Potential script injection detected in username.")
    if XML_XXE_ATTACK_PATTERN.search(username):
        raise HTTPException(status_code=400, detail="Potential XML/XXE payload detected in username.")
    if SQLI_ATTACK_PATTERN.search(username):
        raise HTTPException(status_code=400, detail="Potential SQL injection detected in username.")
        
    # Validate character set (alphanumeric, dot, underscore, hyphen, @ for email logins)
    if not re.match(r"^[A-Za-z0-9_\-\.@]+$", username):
        raise HTTPException(status_code=400, detail="Username contains invalid characters.")
        
    return username


def validate_and_sanitize_password(raw_password: Optional[str]) -> str:
    """
    Validates password input before cryptographic hashing or verification.
    - Rejects null bytes.
    - Enforces maximum length (128 chars) to guard against Bcrypt DoS / ReDoS attacks.
    - Rejects script tags or XML declarations.
    """
    if not raw_password:
        raise HTTPException(status_code=400, detail="Password is required.")
        
    password = str(raw_password)
    
    if "\x00" in password:
        raise HTTPException(status_code=400, detail="Invalid character in password.")
        
    if len(password) > 128:
        raise HTTPException(status_code=400, detail="Password exceeds maximum allowed length.")
        
    if SCRIPT_ATTACK_PATTERN.search(password):
        raise HTTPException(status_code=400, detail="Malicious script pattern in password field.")
    if XML_XXE_ATTACK_PATTERN.search(password):
        raise HTTPException(status_code=400, detail="Malicious XML pattern in password field.")
        
    return password


def sanitize_text_field(raw_text: Optional[str], max_length: int = 255, field_name: str = "text") -> str:
    """
    Sanitizes general text fields (e.g. reasons, notes) by stripping null bytes and HTML-escaping.
    """
    if not raw_text:
        return ""
    text = str(raw_text).strip()
    if "\x00" in text:
        text = text.replace("\x00", "")
    if len(text) > max_length:
        text = text[:max_length]
    if SCRIPT_ATTACK_PATTERN.search(text):
        # Escape any HTML entities to prevent Stored XSS in audit trails or dashboards
        text = html.escape(text, quote=True)
    if XML_XXE_ATTACK_PATTERN.search(text):
        text = html.escape(text, quote=True)
    return text


def constant_time_compare(val1: str, val2: str) -> bool:
    """
    Performs constant-time string comparison to prevent side-channel timing attacks.
    """
    if not isinstance(val1, str) or not isinstance(val2, str):
        return False
    # Compare uppercase canonical representations
    return secrets.compare_digest(val1.strip().upper(), val2.strip().upper())


# -------------------------------------------------------------
# 4. FASTAPI CYBERATTACK DEFENSE MIDDLEWARE
# -------------------------------------------------------------

class CyberAttackDefenseMiddleware(BaseHTTPMiddleware):
    """
    Global ASGI middleware that:
    1. Blocks any XML content types (application/xml, text/xml, etc.) to completely eliminate XXE attack surface.
    2. Inspects URL query parameters for script injection, XXE, and SQLi syntax.
    3. Adds essential HTTP security headers (X-Content-Type-Options, X-XSS-Protection, etc.).
    """
    async def dispatch(self, request: Request, call_next):
        content_type = request.headers.get("content-type", "").lower()

        # Reject XML content-types globally
        if "xml" in content_type and not content_type.startswith("application/vnd.openxmlformats"):
            return Response(
                content='{"detail": "XML payloads and entity injection are strictly prohibited."}',
                status_code=415,
                media_type="application/json"
            )

        # Inspect query parameters for cyberattack vectors
        for key, value in request.query_params.items():
            if "\x00" in value:
                return Response(
                    content='{"detail": "Invalid null byte in request parameters."}',
                    status_code=400,
                    media_type="application/json"
                )
            if SCRIPT_ATTACK_PATTERN.search(value):
                return Response(
                    content='{"detail": "Potential script injection detected in query parameter."}',
                    status_code=400,
                    media_type="application/json"
                )
            if XML_XXE_ATTACK_PATTERN.search(value):
                return Response(
                    content='{"detail": "Potential XML/XXE payload detected in query parameter."}',
                    status_code=400,
                    media_type="application/json"
                )
            if SQLI_ATTACK_PATTERN.search(value):
                return Response(
                    content='{"detail": "Potential SQL injection detected in query parameter."}',
                    status_code=400,
                    media_type="application/json"
                )

        response: Response = await call_next(request)

        # Defense-in-depth: inject standard security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["X-Frame-Options"] = "SAMEORIGIN"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        return response
