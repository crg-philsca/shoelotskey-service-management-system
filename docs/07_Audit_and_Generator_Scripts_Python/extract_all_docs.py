import fitz # PyMuPDF
import os

def dump_pdf_text(filepath, max_pages=None, save_txt=None):
    print(f"\n==================================================")
    print(f"FILE: {filepath}")
    print(f"==================================================")
    if not os.path.exists(filepath):
        print("FILE NOT FOUND!")
        return ""
    
    doc = fitz.open(filepath)
    print(f"Page Count: {len(doc)}")
    full_text = []
    
    limit = len(doc) if max_pages is None else min(max_pages, len(doc))
    for page_num in range(limit):
        page = doc[page_num]
        text = page.get_text()
        full_text.append(f"--- PAGE {page_num + 1} ---\n{text}")
    
    combined = "\n".join(full_text)
    if save_txt:
        with open(save_txt, "w", encoding="utf-8") as f:
            f.write(combined)
        print(f"Saved {len(combined)} chars to {save_txt}")
    else:
        print(combined[:1500])
    return combined

if __name__ == "__main__":
    os.makedirs("scratch", exist_ok=True)
    
    files = [
        ("docs/Official Documentation/Capstone Subject/Guidelines/CAPSTONE PROJECT 2.pdf", "scratch/guidelines_capstone2.txt"),
        ("docs/Official Documentation/Capstone Subject/Submissions/REVISIONS AND COMMENTS.pdf", "scratch/revisions_and_comments.txt"),
        ("docs/Official Documentation/Matrix/MATRIX-OF-CAPSTONE-PROJECT-REVISIONS (3).pdf", "scratch/matrix_revisions_3.txt"),
        ("docs/Official Documentation/Capstone Subject/Modules/MABALLIAR-VISTA-IT411-CAPSTONE PROJECT-PRELIM-MODULES-2025-2026.pdf", "scratch/prelim_modules.txt"),
        ("docs/Official Documentation/Capstone Subject/Modules/MABALLIAR-VISTA-IT411-CAPSTONE PROJECT-MIDTERM-MODULES-2025-2026.pdf", "scratch/midterm_modules.txt"),
    ]
    
    for pdf_path, txt_out in files:
        dump_pdf_text(pdf_path, max_pages=None, save_txt=txt_out)
