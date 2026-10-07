import easyocr
import pymupdf
import io
from PIL import Image
import numpy as np
import time

reader = easyocr.Reader(['en'], gpu=False)

def run_ocr(pdf_path, out_path):
    print(f"Starting OCR for {pdf_path}")
    doc = pymupdf.open(pdf_path)
    output_lines = []
    
    for i, page in enumerate(doc):
        t0 = time.time()
        pix = page.get_pixmap(dpi=130)
        img = Image.open(io.BytesIO(pix.tobytes("png")))
        results = reader.readtext(np.array(img))
        page_text = " ".join([r[1] for r in results])
        output_lines.append(f"=== PAGE {i+1} ===\n{page_text}\n")
        print(f"Page {i+1}/{len(doc)} processed in {time.time()-t0:.2f}s, words: {len(results)}")
        
    with open(out_path, "w", encoding="utf-8") as f:
        f.write("\n".join(output_lines))
    print(f"Done! Saved to {out_path}")

if __name__ == "__main__":
    run_ocr(r"docs/Official Documentation/Capstone Subject/Guidelines/CAPSTONE PROJECT 2.pdf", "scratch/capstone2_mission_plan_ocr.txt")
