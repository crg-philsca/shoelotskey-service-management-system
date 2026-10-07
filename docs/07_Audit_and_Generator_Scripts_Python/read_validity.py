import pandas as pd

excel_path = r"docs/Official Documentation/Validators/VALIDITY TEST RESULTS.xlsx"
xl = pd.ExcelFile(excel_path)
print("Sheet names:", xl.sheet_names)
for s in xl.sheet_names:
    print(f"\n--- Sheet: {s} ---")
    df = xl.parse(s)
    print(df.head(15))
