import easyocr
import pymupdf
import io
from PIL import Image
import numpy as np

reader = easyocr.Reader(['en'], gpu=False)
doc = pymupdf.open(r"docs/Official Documentation/Capstone Subject/Guidelines/CAPSTONE PROJECT 2.pdf")
pix = doc[0].get_pixmap(dpi=150)
img = Image.open(io.BytesIO(pix.tobytes("png")))
results = reader.readtext(np.array(img))
print("Extracted:")
for bbox, text, prob in results:
    print(f"  {text} (prob: {prob:.2f})")
