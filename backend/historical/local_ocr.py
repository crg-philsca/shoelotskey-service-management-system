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

import time

EASYOCR_VERSION = "easyocr-v1"
TESSERACT_VERSION = "tesseract-v1"

_easyocr_reader = None
_gemini_quota_exhausted_until = 0.0

DEFAULT_TESSERACT_PATHS = [
    r"C:\Program Files\Tesseract-OCR\tesseract.exe",
    r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
]


def mark_gemini_quota_exhausted(duration_seconds: float = 60.0) -> None:
    global _gemini_quota_exhausted_until
    _gemini_quota_exhausted_until = time.time() + float(duration_seconds)


def is_gemini_quota_exhausted() -> bool:
    return time.time() < _gemini_quota_exhausted_until


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


def _preprocess_handwritten_image(image_bytes: bytes):
    """
    Optimized preprocessing for handwritten receipt slips:
    1. Upscales small images so handwritten strokes are distinct.
    2. Converts to grayscale, eliminating yellow/pink carbon paper tint.
    3. Auto-contrasts and median filters to remove speckles.
    4. Generates both enhanced contrast grayscale and Otsu-binarized black & white.
    """
    from PIL import Image, ImageEnhance, ImageFilter, ImageOps

    img = Image.open(BytesIO(image_bytes)).convert("RGB")
    w, h = img.size
    target_side = 1600
    if max(w, h) < target_side:
        scale = target_side / float(max(w, h))
        img = img.resize((max(1, int(w * scale)), max(1, int(h * scale))), Image.Resampling.LANCZOS)
    elif max(w, h) > 2400:
        scale = 2400 / float(max(w, h))
        img = img.resize((max(1, int(w * scale)), max(1, int(h * scale))), Image.Resampling.LANCZOS)

    gray = img.convert("L")
    gray = ImageOps.autocontrast(gray, cutoff=2)
    denoised = gray.filter(ImageFilter.MedianFilter(size=3))
    img_contrast = ImageEnhance.Contrast(denoised).enhance(1.8)

    # Otsu thresholding
    hist = img_contrast.histogram()
    total = sum(hist)
    sum_b = 0
    w_b = 0
    max_var = 0.0
    thresh = 128
    sum_all = sum(i * hist[i] for i in range(256))
    for i in range(256):
        w_b += hist[i]
        if w_b == 0:
            continue
        w_f = total - w_b
        if w_f == 0:
            break
        sum_b += i * hist[i]
        m_b = sum_b / w_b
        m_f = (sum_all - sum_b) / w_f
        var_between = w_b * w_f * (m_b - m_f) ** 2
        if var_between > max_var:
            max_var = var_between
            thresh = i

    img_bin = img_contrast.point(lambda p: 255 if p > thresh else 0)
    return img_contrast, img_bin


def _preprocess_image(image_bytes: bytes):
    img_contrast, _ = _preprocess_handwritten_image(image_bytes)
    return img_contrast


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

    img_contrast, img_bin = _preprocess_handwritten_image(image_bytes)

    # Handwritten receipt forms have tabular/sparse cells and handwritten notes.
    # PSM 11 (sparse text) and PSM 4 (single column variable) with LSTM OEM 1
    # are vastly superior to PSM 6 (single uniform block) on handwriting.
    candidates = [
        ("--psm 11 --oem 1 -c preserve_interword_spaces=1", img_bin),
        ("--psm 11 --oem 1 -c preserve_interword_spaces=1", img_contrast),
        ("--psm 4 --oem 1 -c preserve_interword_spaces=1", img_contrast),
        ("--psm 6 --oem 1", img_contrast),
    ]

    best_text = ""
    best_conf = 0.0

    for cfg, img_target in candidates:
        try:
            text = pytesseract.image_to_string(img_target, config=cfg)
            if not text or not text.strip():
                continue
            _, conf = parse_raw_ocr_text(text, TESSERACT_VERSION)
            if conf > best_conf or not best_text:
                best_text = text
                best_conf = conf
                if best_conf >= 0.45:
                    break
        except Exception:
            continue

    return best_text, best_conf


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
