import zipfile
import xml.etree.ElementTree as ET

def dump_xlsx(filepath):
    print(f"=== XLSX: {filepath} ===")
    with zipfile.ZipFile(filepath, 'r') as z:
        # shared strings
        shared_strings = []
        if 'xl/sharedStrings.xml' in z.namelist():
            ss_root = ET.fromstring(z.read('xl/sharedStrings.xml'))
            for si in ss_root.findall('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}si'):
                text = "".join([t.text for t in si.iter('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t') if t.text])
                shared_strings.append(text)
        
        # workbook sheets
        wb_root = ET.fromstring(z.read('xl/workbook.xml'))
        sheets = wb_root.findall('.//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}sheet')
        
        for idx, sheet in enumerate(sheets):
            sheet_name = sheet.attrib.get('name')
            sheet_file = f'xl/worksheets/sheet{idx+1}.xml'
            print(f"\n--- SHEET: {sheet_name} ({sheet_file}) ---")
            if sheet_file in z.namelist():
                ws_root = ET.fromstring(z.read(sheet_file))
                rows = ws_root.findall('.//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}row')
                for r in rows[:30]:
                    row_data = []
                    for c in r.findall('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}c'):
                        v = c.find('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}v')
                        val = v.text if v is not None else ""
                        if c.attrib.get('t') == 's' and val.isdigit():
                            val = shared_strings[int(val)]
                        row_data.append(f"{c.attrib.get('r')}:{val}")
                    print("  " + " | ".join(row_data[:8]))

if __name__ == "__main__":
    dump_xlsx(r"docs/Official Documentation/Validators/VALIDITY TEST RESULTS.xlsx")
