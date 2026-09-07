import re
import os

file_path = r"C:\Users\charm\Desktop\Shoelotskey_Revised_Evaluation_Instruments.html"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# We want to find lines like: <td>1. Some text (explanation) and more text (another explanation).</td>
# and convert to: <td>1. Some text and more text.<br><span style="font-size: 0.85em; color: #555;"><i>Note: (explanation); (another explanation)</i></span></td>

def process_line(match):
    full_td = match.group(0)
    # Ignore <tr><td colspan="5"> headers
    if "colspan" in full_td or "<strong>" in full_td:
        return full_td
        
    # Extract the inner text
    inner_match = re.search(r'<td>(.*?)</td>', full_td)
    if not inner_match:
        return full_td
        
    inner_text = inner_match.group(1)
    
    # Find all parenthetical statements
    parens = re.findall(r'\((.*?)\)', inner_text)
    if not parens:
        return full_td
        
    # Remove parens from main text
    main_text = re.sub(r'\s*\((.*?)\)', '', inner_text)
    
    # Format the explanations
    notes = "; ".join([f"({p})" for p in parens])
    
    new_td = f'<td>{main_text}<br><span style="font-size: 0.85em; color: #666;"><i>Note: {notes}</i></span></td>'
    return new_td

# Apply only to the <td> elements that contain a number e.g. "1. "
new_content = re.sub(r'<td>\d+\.\s.*?</td>', process_line, content)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(new_content)

print("Done")
