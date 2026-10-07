import pymupdf
import io
from PIL import Image

def ocr_pdf(pdf_path, out_txt, max_pages=None):
    doc = pymupdf.open(pdf_path)
    total_pages = len(doc)
    pages_to_process = total_pages if max_pages is None else min(max_pages, total_pages)
    print(f"Processing {pdf_path} ({pages_to_process}/{total_pages} pages)...")
    
    # Let's try pytesseract or fallback to basic check
    import pytesseract
    
    lines_out = []
    for p_num in range(pages_to_process):
        page = doc[p_num]
        pix = page.get_pixmap(dpi=150)
        img = Image.open(io.BytesIO(pix.tobytes("png")))
        try:
            txt = pytesseract.image_to_string(img)
        except Exception as e:
            txt = f"[OCR ERROR: {e}]"
        lines_out.append(f"=== PAGE {p_num+1} ===\n{txt}\n")
        print(f"  Page {p_num+1} OCR done ({len(txt)} chars)")
    
    with open(out_txt, "w", encoding="utf-8") as f:
        f.write("\n".join(lines_out))
    print(f"Saved OCR to {out_txt}")

if __name__ == "__main__":
    ocr_pdf("docs/Official Documentation/Capstone Subject/Guidelines/CAPSTONE PROJECT 2.pdf", "scratch/ocr_capstone_project_2.txt")
    ocr_pdf("docs/Official Documentation/Capstone Subject/Submissions/REVISIONS AND COMMENTS.pdf", "scratch/ocr_revisions_and_comments.txt")
