import pypdf
import os
import glob

def dump_pdf_info(filename):
    print(f"=== {filename} ===")
    if not os.path.exists(filename):
        print(f"File not found: {filename}")
        return
    try:
        reader = pypdf.PdfReader(filename)
        print(f"Total pages: {len(reader.pages)}")
        for i in range(len(reader.pages)):
            text = reader.pages[i].extract_text()
            print(f"--- Page {i+1} ---")
            print(text if text else "[NO TEXT]")
    except Exception as e:
        print(f"Error reading {filename}: {e}")

if __name__ == "__main__":
    targets = [
        r"docs/Official Documentation/Capstone Subject/Submissions/REVISIONS AND COMMENTS.pdf",
        r"docs/Official Documentation/Matrix/MATRIX-OF-CAPSTONE-PROJECT-REVISIONS (3).pdf",
    ]
    for t in targets:
        dump_pdf_info(t)
