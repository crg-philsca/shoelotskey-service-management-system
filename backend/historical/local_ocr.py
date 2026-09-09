"""
Optional local OCR engines: EasyOCR and Tesseract.

Production Heroku uses Gemini Vision as the primary engine
(``historical.ocr_engine``). EasyOCR is NOT a production dependency — it pulls
PyTorch/CUDA and previously inflated the Heroku slug to ~3.6 GB. Install it only
locally via ``requirements-ocr-local.txt``. This module already no-ops when the
import is missing (``easyocr_available()`` / ``tesseract_available()``).
"""

from __future__ import annotations

import os
import shutil
from io import BytesIO
from pathlib import Path
from typing import Optional, Tuple

from historical.local_ocr_parser import parse_raw_ocr_text

EASYOCR_VERSION = "easyocr-v1"
TESSERACT_VERSION = "tesseract-v1"

_easyocr_reader = None
_gemini_quota_exhausted = False

DEFAULT_TESSERACT_PATHS = [
    r"C:\Program Files\Tesseract-OCR\tesseract.exe",
    r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
]


def mark_gemini_quota_exhausted() -> None:
    global _gemini_quota_exhausted
    _gemini_quota_exhausted = True


def is_gemini_quota_exhausted() -> bool:
    return _gemini_quota_exhausted


def _resolve_tesseract_cmd() -> Optional[str]:
    env = os.getenv("TESSERACT_CMD")
    if env and Path(env).exists():
        return env
    found = shutil.which("tesseract")
    if found:
        return found
    for p in DEFAULT_TESSERACT_PATHS:
        if Path(p).exists():
            return p
    return None


def _preprocess_image(image_bytes: bytes):
    from PIL import Image, ImageEnhance, ImageFilter

    img = Image.open(BytesIO(image_bytes)).convert("RGB")
    w, h = img.size
    if max(w, h) < 1200:
        scale = 1200 / max(w, h)
        img = img.resize((int(w * scale), int(h * scale)), Image.Resampling.LANCZOS)
    img = ImageEnhance.Contrast(img).enhance(1.4)
    img = img.filter(ImageFilter.SHARPEN)
    return img


def _get_easyocr_reader():
    global _easyocr_reader
    if _easyocr_reader is None:
        import easyocr
        _easyocr_reader = easyocr.Reader(["en"], gpu=False, verbose=False)
    return _easyocr_reader


def easyocr_available() -> bool:
    try:
        import easyocr  # noqa: F401
        return True
    except ImportError:
        return False


def tesseract_available() -> bool:
    try:
        import pytesseract
        cmd = _resolve_tesseract_cmd()
        if not cmd:
            return False
        pytesseract.pytesseract.tesseract_cmd = cmd
        return True
    except ImportError:
        return False


def paddleocr_available() -> bool:
    try:
        from paddleocr import PaddleOCR  # noqa: F401
        return True
    except Exception:
        return False


def run_tesseract_ocr(image_bytes: bytes) -> Tuple[str, float]:
    import pytesseract

    cmd = _resolve_tesseract_cmd()
    if not cmd:
        raise RuntimeError("Tesseract binary not found")
    pytesseract.pytesseract.tesseract_cmd = cmd
    img = _preprocess_image(image_bytes)
    text = pytesseract.image_to_string(img, config="--psm 6 --oem 3")
    _, confidence = parse_raw_ocr_text(text, TESSERACT_VERSION)
    return text, confidence


def run_easyocr_ocr(image_bytes: bytes) -> Tuple[str, float]:
    reader = _get_easyocr_reader()
    img = _preprocess_image(image_bytes)
    import numpy as np
    arr = np.array(img)
    lines = reader.readtext(arr, detail=0, paragraph=True)
    text = "\n".join(lines) if isinstance(lines, list) else str(lines)
    _, confidence = parse_raw_ocr_text(text, EASYOCR_VERSION)
    return text, confidence


def extract_local_from_bytes(
    image_bytes: bytes,
    *,
    prefer_easyocr: bool = True,
    engine: str = "auto",
) -> Tuple[dict, float, str]:
    """
    Run local OCR tier(s). engine: auto | easyocr | tesseract
    """
    raw_text = ""
    best_conf = 0.0
    best_data = None
    best_engine = "none"

    if engine in ("auto", "easyocr") and easyocr_available():
        try:
            raw_text, conf = run_easyocr_ocr(image_bytes)
            data, conf = parse_raw_ocr_text(raw_text, EASYOCR_VERSION)
            if conf >= 0.15 or engine == "easyocr":
                data["_raw_ocr_response"] = raw_text[:8000]
                return data, conf, EASYOCR_VERSION
            best_data, best_conf, best_engine = data, conf, EASYOCR_VERSION
        except Exception:
            if engine == "easyocr":
                raise

    if engine in ("auto", "tesseract") and tesseract_available():
        try:
            raw_text, conf = run_tesseract_ocr(image_bytes)
            data, conf = parse_raw_ocr_text(raw_text, TESSERACT_VERSION)
            if conf > best_conf or engine == "tesseract":
                data["_raw_ocr_response"] = raw_text[:8000]
                return data, conf, TESSERACT_VERSION
        except Exception:
            if engine == "tesseract":
                raise

    if best_data:
        return best_data, best_conf, best_engine

    empty, conf = parse_raw_ocr_text("", "none")
    return empty, conf, "none"
