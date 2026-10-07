import re

with open("backend/models.py", "r", encoding="utf-8") as f:
    content = f.read()

# find all table names and columns
classes = re.split(r'\n(?=class\s+\w+\(Base\):)', content)
print(f"Total model blocks: {len(classes)}")

for blk in classes:
    m = re.search(r'class\s+(\w+)\(Base\):', blk)
    if not m:
        continue
    cname = m.group(1)
    t_match = re.search(r'__tablename__\s*=\s*[\'"](\w+)[\'"]', blk)
    tname = t_match.group(1) if t_match else "unknown"
    
    cols = re.findall(r'(\w+)\s*=\s*Column\(([^)]+)\)', blk)
    col_names = [c[0] for c in cols]
    fks = re.findall(r'ForeignKey\([\'"]([^\'"]+)[\'"]', blk)
    
    print(f"\nModel: {cname} -> Table: '{tname}' ({len(col_names)} columns)")
    print(f"  Columns: {', '.join(col_names[:10])}{'...' if len(col_names)>10 else ''}")
    if fks:
        print(f"  Foreign Keys: {fks}")
