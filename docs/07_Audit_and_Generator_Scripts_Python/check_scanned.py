import pymupdf

paths = [
    r"docs/Official Documentation/Capstone Subject/Guidelines/CAPSTONE PROJECT 2.pdf",
    r"docs/Official Documentation/Capstone Subject/Submissions/REVISIONS AND COMMENTS.pdf"
]

for p in paths:
    doc = pymupdf.open(p)
    print("PATH:", p, "PAGES:", len(doc))
    for i in range(len(doc)):
        page = doc[i]
        t = page.get_text()
        imgs = page.get_images()
        print(f"  Page {i+1}: text len={len(t)}, images={len(imgs)}")
        if len(t) > 0 and len(t) < 500:
            print("   snippet:", repr(t[:200]))
