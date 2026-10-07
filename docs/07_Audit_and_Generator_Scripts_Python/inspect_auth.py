with open("backend/main.py", "r", encoding="utf-8") as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if "/api/login" in line:
        print(f"Found /api/login at line {i+1}")
        for j in range(max(0, i-2), min(len(lines), i+80)):
            print(f"{j+1}: {lines[j].rstrip()}")
        break
