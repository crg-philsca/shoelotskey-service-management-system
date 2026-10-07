import os
import glob
import datetime
import pymupdf

def scan_files():
    patterns = ['**/*.pdf', '**/*.docx', '**/*.pptx', '**/*.xlsx', '**/*.csv', '**/*.json', '**/*.html', '**/*.sql']
    results = []
    
    for pat in patterns:
        for p in glob.glob(pat, recursive=True):
            if any(ign in p for ign in ['node_modules', '.git', 'site-packages', 'venv', '.gemini', 'dist']):
                continue
            sz = os.path.getsize(p)
            mtime = os.path.getmtime(p)
            dt_str = datetime.datetime.fromtimestamp(mtime).strftime("%Y-%m-%d %H:%M:%S")
            
            # extra metadata if PDF
            extra = ""
            if p.lower().endswith(".pdf"):
                try:
                    doc = pymupdf.open(p)
                    extra = f"Pages: {len(doc)}"
                    # check if first page has text
                    txt_len = len(doc[0].get_text()) if len(doc) > 0 else 0
                    extra += f", P1 chars: {txt_len}"
                except Exception as e:
                    extra = f"Error: {e}"
            results.append((p, sz, dt_str, extra))
            
    return results

if __name__ == "__main__":
    files = scan_files()
    print(f"Total files discovered: {len(files)}")
    
    # Categorize
    categories = {
        "Manuscripts": [],
        "Presentations": [],
        "Revisions & Matrix": [],
        "Evaluation & Questionnaires (TAM/ISO/Validators)": [],
        "Machine Learning & Datasets": [],
        "Guidelines & Modules": [],
        "Documentation & Reports": [],
        "Codebase & Database": []
    }
    
    for item in sorted(files, key=lambda x: x[0]):
        p = item[0].lower()
        if "manuscript" in p or "chapter" in p:
            categories["Manuscripts"].append(item)
        elif p.endswith(".pptx") or "presentation" in p:
            categories["Presentations"].append(item)
        elif "matrix" in p or "revision" in p or "comment" in p:
            categories["Revisions & Matrix"].append(item)
        elif any(k in p for k in ["iso", "tam", "validator", "validity", "survey"]):
            categories["Evaluation & Questionnaires (TAM/ISO/Validators)"].append(item)
        elif any(k in p for k in ["ml", "prediction", "dataset", ".csv"]):
            categories["Machine Learning & Datasets"].append(item)
        elif any(k in p for k in ["guideline", "module", "capstone project 2.pdf", "advisory"]):
            categories["Guidelines & Modules"].append(item)
        elif any(k in p for k in [".html", "report", "documentation"]):
            categories["Documentation & Reports"].append(item)
        else:
            categories["Codebase & Database"].append(item)
            
    for cat, items in categories.items():
        print(f"\n==================================================")
        print(f"CATEGORY: {cat} ({len(items)} files)")
        print(f"==================================================")
        for path, sz, dt, extra in items:
            extra_str = f" | {extra}" if extra else ""
            print(f"  {sz:>10} bytes | {dt} | {path}{extra_str}")
