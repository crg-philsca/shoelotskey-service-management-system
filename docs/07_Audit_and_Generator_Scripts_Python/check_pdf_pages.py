import pymupdf
import glob
import os

print("=== CHECKING ALL PDF PAGE COUNTS ===")
for p in glob.glob("**/*.pdf", recursive=True):
    if any(ign in p for ign in ['node_modules', '.git', 'site-packages', 'venv', '.gemini']):
        continue
    try:
        doc = pymupdf.open(p)
        print(f"{len(doc):>4} pages | {os.path.getsize(p):>10} bytes | {p}")
    except Exception as e:
        print(f"Error {p}: {e}")
