import pymupdf

doc = pymupdf.open(r"docs/Official Documentation/TAM/TAM-Respondents-Result.pdf")
print("TAM Results Pages:", len(doc))
for i in range(len(doc)):
    t = doc[i].get_text()
    print(f"Page {i+1}: text len={len(t)}")
    if len(t) > 0:
        print("  Snippet:", repr(t[:300]))
