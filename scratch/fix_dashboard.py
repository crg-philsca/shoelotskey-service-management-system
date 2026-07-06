import os

file_path = r'c:\Users\charm\Desktop\Shoelotskey Service Management System\src\app\pages\Dashboard.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Harden the tr onClick
old_tr = '''                                   <tr
                                     key={order.id}
                                     className="hover:bg-gray-50 cursor-pointer"
                                     onClick={() => {
                                       setSelectedOrder(order);
                                       setIsEditing(false);
                                     }}
                                   >'''

new_tr = '''                                   <tr
                                     key={order.id}
                                     className="hover:bg-gray-50 cursor-pointer transition-colors"
                                     onClick={(e) => {
                                       e.stopPropagation();
                                       if (order) setSelectedOrder({...order});
                                       setIsEditing(false);
                                     }}
                                   >'''

# 2. Harden the createdAt date
old_date1 = "{dateFnsFormat(new Date(order.createdAt), 'MM/dd/yy')}"
new_date1 = "{(() => { const d = new Date(order.createdAt); return isNaN(d.getTime()) ? '-' : dateFnsFormat(d, 'MM/dd/yy'); })()}"

# 3. Harden the predicted date
old_date2 = "order.predictedCompletionDate ? dateFnsFormat(new Date(order.predictedCompletionDate), 'MM/dd/yy') : '-'"
new_date2 = "(() => { if (!order.predictedCompletionDate) return '-'; const d = new Date(order.predictedCompletionDate); return isNaN(d.getTime()) ? '-' : dateFnsFormat(d, 'MM/dd/yy'); })()"

content = content.replace(old_date1, new_date1)
content = content.replace(old_date2, new_date2)

# If exact string replace fails for the tr block, we use a more flexible search
if old_tr in content:
    content = content.replace(old_tr, new_tr)
else:
    # Try with potentially different whitespace
    import re
    pattern = r'<tr\s+key=\{order\.id\}\s+className="hover:bg-gray-50 cursor-pointer"\s+onClick=\{\(\) => \{\s+setSelectedOrder\(order\);\s+setIsEditing\(false\);\s+\}\}\s+>'
    replacement = '''<tr
                                     key={order.id}
                                     className="hover:bg-gray-50 cursor-pointer transition-colors"
                                     onClick={(e) => {
                                       e.stopPropagation();
                                       if (order) setSelectedOrder({...order});
                                       setIsEditing(false);
                                     }}
                                   >'''
    content = re.sub(pattern, replacement, content)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Replacement complete")
