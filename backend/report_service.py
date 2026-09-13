"""
SHOELOTSKEY REPORT SERVICE
==========================
Authoritative Backend Calculation and Generation Engine for:
- Sales Report
- Expenses Report
- ROI Report

Ensures mathematical and financial parity across:
UI Totals == PDF Totals == CSV Totals == Print Totals

Supported Periods:
- Daily
- Weekly
- Monthly
- Quarterly
- Annually
- Custom (Start Date <= End Date)
"""

import io
import os
import csv
from datetime import datetime, date, timedelta
from typing import Dict, Any, List, Optional, Tuple
from decimal import Decimal
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from fastapi import HTTPException

from models import Order, Payment, Expense, Item, Service, InventoryLog
import pymupdf
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
LOGO_PATH = os.path.join(BASE_DIR, "static", "logo.png")
if not os.path.exists(LOGO_PATH):
    LOGO_PATH = os.path.join(os.path.dirname(BASE_DIR), "public", "logo.png")


# ---------------------------------------------------------------------------
# 1. TIMEFRAME RESOLUTION
# ---------------------------------------------------------------------------

def resolve_period_range(
    period_type: str,
    custom_start: Optional[str] = None,
    custom_end: Optional[str] = None,
    now: Optional[datetime] = None
) -> Tuple[datetime, datetime, str]:
    """
    Resolves the exact [start_dt, end_dt] and human-readable label matching
    the frontend salesAnalytics.ts date definitions.
    """
    if now is None:
        now = datetime.now()

    p_norm = (period_type or "daily").strip().lower()

    if p_norm == "daily":
        start_dt = datetime(now.year, now.month, now.day, 0, 0, 0)
        end_dt = datetime(now.year, now.month, now.day, 23, 59, 59, 999999)
        label = now.strftime("%B %d, %Y")
        return start_dt, end_dt, label

    elif p_norm == "weekly":
        # Monday to Sunday
        day_of_week = now.weekday()  # Monday is 0, Sunday is 6
        monday = now - timedelta(days=day_of_week)
        monday = datetime(monday.year, monday.month, monday.day, 0, 0, 0)
        sunday = monday + timedelta(days=6, hours=23, minutes=59, seconds=59, microseconds=999999)
        
        if monday.month == sunday.month:
            label = f"{monday.strftime('%B')} {monday.day} - {sunday.day}, {sunday.year}"
        else:
            label = f"{monday.strftime('%B %d')} - {sunday.strftime('%B %d, %Y')}"
        return monday, sunday, label

    elif p_norm == "monthly":
        start_dt = datetime(now.year, now.month, 1, 0, 0, 0)
        if now.month == 12:
            next_month = datetime(now.year + 1, 1, 1, 0, 0, 0)
        else:
            next_month = datetime(now.year, now.month + 1, 1, 0, 0, 0)
        end_dt = next_month - timedelta(microseconds=1)
        label = now.strftime("%B %Y")
        return start_dt, end_dt, label

    elif p_norm == "quarterly":
        quarter = (now.month - 1) // 3 + 1
        q_start_month = (quarter - 1) * 3 + 1
        start_dt = datetime(now.year, q_start_month, 1, 0, 0, 0)
        q_end_month = q_start_month + 2
        if q_end_month == 12:
            next_q = datetime(now.year + 1, 1, 1, 0, 0, 0)
        else:
            next_q = datetime(now.year, q_end_month + 1, 1, 0, 0, 0)
        end_dt = next_q - timedelta(microseconds=1)
        quarter_months = {
            1: "January - March",
            2: "April - June",
            3: "July - September",
            4: "October - December",
        }
        label = f"Q{quarter} {now.year} ({quarter_months[quarter]})"
        return start_dt, end_dt, label

    elif p_norm in ("annually", "annual"):
        start_dt = datetime(now.year, 1, 1, 0, 0, 0)
        end_dt = datetime(now.year, 12, 31, 23, 59, 59, 999999)
        label = f"{now.year}"
        return start_dt, end_dt, label

    elif p_norm == "custom":
        if not custom_start or not custom_end:
            raise HTTPException(status_code=400, detail="Custom date range requires both Start Date and End Date.")
        try:
            s_date = datetime.strptime(custom_start.strip(), "%Y-%m-%d")
            e_date = datetime.strptime(custom_end.strip(), "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Expected YYYY-MM-DD.")
        
        if s_date > e_date:
            raise HTTPException(status_code=400, detail="Start Date cannot be after End Date.")
        
        start_dt = datetime(s_date.year, s_date.month, s_date.day, 0, 0, 0)
        end_dt = datetime(e_date.year, e_date.month, e_date.day, 23, 59, 59, 999999)
        label = f"{s_date.strftime('%B %d, %Y')} - {e_date.strftime('%B %d, %Y')}"
        return start_dt, end_dt, label

    else:
        raise HTTPException(status_code=400, detail=f"Unsupported period type '{period_type}'.")


# ---------------------------------------------------------------------------
# 2. EXPENSE CLASSIFICATION (Authoritative)
# ---------------------------------------------------------------------------

INVENTORY_CATEGORIES = {
    "cleaning materials", "cleaning aids", "chemicals", "chemical", "inventory", "restock", "supplies", "supply", "tools", "tool", "equipment"
}

OPERATING_CATEGORIES = {
    "water", "internet", "staff salary", "salary", "payroll", "logistics", "food", "lunch", "rent", "electricity", "utilities"
}

def classify_expense_group(category_str: str) -> str:
    """
    Maps an expense category string to one of the canonical groups:
    - Inventory Expenses
    - Operating Expenses
    - Other Expenses
    """
    c = str(category_str or "").strip().lower()
    for inv in INVENTORY_CATEGORIES:
        if inv in c:
            return "Inventory Expenses"
    for op in OPERATING_CATEGORIES:
        if op in c:
            return "Operating Expenses"
    return "Other Expenses"


# ---------------------------------------------------------------------------
# 3. AUTHORITATIVE REPORT DATA CALCULATION
# ---------------------------------------------------------------------------

def calculate_report_data(
    db: Session,
    report_type: str,
    period_type: str,
    custom_start: Optional[str] = None,
    custom_end: Optional[str] = None
) -> Dict[str, Any]:
    """
    Authoritatively computes report summaries and itemized records directly
    from the database using the approved Order-Cohort accounting model.
    """
    start_dt, end_dt, period_label = resolve_period_range(period_type, custom_start, custom_end)
    r_norm = (report_type or "sales").strip().lower()

    # --- 1. COHORT ORDERS QUERY ---
    orders = db.query(Order).options(
        joinedload(Order.customer),
        joinedload(Order.status),
        joinedload(Order.priority),
        joinedload(Order.payments).joinedload(Payment.p_status),
        joinedload(Order.payments).joinedload(Payment.method),
        joinedload(Order.items).joinedload(Item.services),
    ).filter(
        Order.created_at >= start_dt,
        Order.created_at <= end_dt
    ).order_by(Order.created_at.desc()).all()

    # Cohort calculations
    def is_cancelled(o: Order) -> bool:
        st = (o.status.status_name if o.status else "").strip().lower()
        return st in ("cancelled", "canceled")

    def is_sales_eligible(o: Order) -> bool:
        if is_cancelled(o):
            return False
        if o.payments:
            for p in o.payments:
                p_st = (p.p_status.status_name if p.p_status else p.payment_status or "").strip().lower()
                if p_st in ("fully paid", "fully-paid", "downpayment"):
                    return True
        return False

    def collected_sales(o: Order) -> float:
        if is_cancelled(o):
            return 0.0
        billed = float(o.grand_total or 0.0)
        received = 0.0
        if o.payments:
            for p in o.payments:
                p_st = (p.p_status.status_name if p.p_status else p.payment_status or "").strip().lower()
                rec = float(p.amount_received or 0.0)
                if p_st == "downpayment" and p.deposit_amount is not None and float(p.deposit_amount) > 0:
                    rec = float(p.deposit_amount)
                received += rec
        return max(0.0, min(billed, received))

    sales_total = 0.0
    payments_received = 0.0
    balance_due = 0.0
    eligible_orders_count = 0
    total_orders_count = len(orders)

    sales_details = []

    for o in orders:
        c_status = (o.status.status_name if o.status else "").strip().title()
        gt = float(o.grand_total or 0.0)
        col = collected_sales(o)
        bal = max(0.0, gt - col) if not is_cancelled(o) else 0.0

        # Extract services string
        services_list = []
        if o.items:
            for itm in o.items:
                if itm.services:
                    for svc in itm.services:
                        services_list.append(svc.service_name)
        svc_str = ", ".join(dict.fromkeys(services_list)) if services_list else "Standard Care"

        # Extract payment method & status
        p_method = "Cash"
        p_status = "Unpaid"
        if o.payments:
            first_p = o.payments[0]
            if first_p.method and first_p.method.method_name:
                p_method = first_p.method.method_name
            if first_p.p_status and first_p.p_status.status_name:
                p_status = first_p.p_status.status_name

        # Extract shoe details
        shoe_items = []
        if o.items:
            for itm in o.items:
                parts = [p for p in [itm.brand, itm.shoe_model] if p]
                if parts:
                    shoe_items.append(" ".join(parts))
        shoe_str = ", ".join(dict.fromkeys(shoe_items)) if shoe_items else "Shoes"

        contact_str = o.customer.contact_number if o.customer else ""
        priority_str = o.priority.priority_name if o.priority else "Regular"

        order_record = {
            "order_id": o.order_id,
            "order_number": o.order_number,
            "order_date": o.created_at.strftime("%Y-%m-%d %H:%M") if o.created_at else "",
            "customer_name": o.customer.customer_name if o.customer else "Guest",
            "customer_contact": contact_str,
            "shoe_details": shoe_str,
            "services": svc_str,
            "priority": priority_str,
            "grand_total": gt,
            "amount_paid": col,
            "balance_due": bal,
            "payment_method": p_method,
            "payment_status": p_status,
            "status": c_status,
            "is_eligible": is_sales_eligible(o),
            "is_cancelled": is_cancelled(o),
        }
        sales_details.append(order_record)

        if is_sales_eligible(o):
            eligible_orders_count += 1
            sales_total += gt
            payments_received += col
            balance_due += bal

    # Cancellations adjustments
    total_refunds = 0.0
    total_retained = 0.0
    for o in orders:
        if is_cancelled(o):
            rf = float(o.refund_amount or 0.0)
            paid = 0.0
            if o.payments:
                for p in o.payments:
                    paid += float(p.amount_received or p.deposit_amount or 0.0)
            if rf > 0:
                total_refunds += rf
            elif (o.refund_status or "").lower() == "refunded":
                total_refunds += paid

            retained = max(0.0, paid - (rf if rf > 0 else (paid if (o.refund_status or "").lower() == "refunded" else 0.0)))
            total_retained += retained

    net_sales = max(0.0, sales_total - total_refunds + total_retained)
    net_payments = max(0.0, payments_received - total_refunds + total_retained)

    # --- 2. EXPENSES QUERY ---
    expenses = db.query(Expense).filter(
        Expense.expense_date >= start_dt,
        Expense.expense_date <= end_dt
    ).order_by(Expense.expense_date.desc()).all()

    total_expenses = 0.0
    inventory_expenses = 0.0
    operating_expenses = 0.0
    other_expenses = 0.0

    expenses_details = []
    for exp in expenses:
        amt = float(exp.amount or 0.0)
        total_expenses += amt

        # Description parsing: "Category || Notes"
        desc = str(exp.description or "")
        parts = desc.split(" || ")
        cat = parts[0].strip() if parts else "Misc Expense"
        notes = parts[1].strip() if len(parts) > 1 else ""

        grp = classify_expense_group(cat)
        if grp == "Inventory Expenses":
            inventory_expenses += amt
        elif grp == "Operating Expenses":
            operating_expenses += amt
        else:
            other_expenses += amt

        expenses_details.append({
            "expense_id": exp.expense_id,
            "expense_date": exp.expense_date.strftime("%Y-%m-%d %H:%M") if exp.expense_date else "",
            "category": cat,
            "group": grp,
            "description": notes or desc,
            "amount": amt,
        })

    # --- 3. PROFIT & ROI ---
    net_profit = net_sales - total_expenses
    if total_expenses > 0:
        roi_value = (net_profit / total_expenses) * 100.0
        roi_display = f"{roi_value:,.2f}%"
    else:
        roi_value = None
        roi_display = "N/A"

    return {
        "report_type": report_type,
        "period_type": period_type,
        "period_label": period_label,
        "generated_at": datetime.now().strftime("%Y-%m-%d %I:%M %p"),
        "summary": {
            "sales": sales_total,
            "orders_count": total_orders_count,
            "eligible_orders_count": eligible_orders_count,
            "payments_received": payments_received,
            "balance_due": balance_due,
            "refunds_issued": total_refunds,
            "retained_deposits": total_retained,
            "net_sales": net_sales,
            "net_payments": net_payments,
            "total_expenses": total_expenses,
            "inventory_expenses": inventory_expenses,
            "operating_expenses": operating_expenses,
            "other_expenses": other_expenses,
            "net_profit": net_profit,
            "roi_value": roi_value,
            "roi_display": roi_display,
        },
        "sales_details": sales_details,
        "expenses_details": expenses_details,
    }


# ---------------------------------------------------------------------------
# 4. STRUCTURED CSV GENERATION
# ---------------------------------------------------------------------------

def generate_report_csv(report_data: Dict[str, Any], report_type: str) -> str:
    """
    Generates cleanly formatted, RFC 4180 compliant structured CSV output for Sales, Expenses, or ROI.
    Implements active, executable spreadsheet formulas (=SUM, =COUNTA, =SUMIF, =IF, math operations)
    so that opening the CSV in Excel or any spreadsheet tool calculates live values dynamically.
    """
    output = io.StringIO()
    writer = csv.writer(output, quoting=csv.QUOTE_MINIMAL)
    r_norm = (report_type or "sales").strip().lower()

    if "sales" in r_norm:
        writer.writerow(["SHOELOTSKEY VILLAMOR-PASAY - SALES REPORT"])
        writer.writerow(["Villamor, Pasay City | Shoe Care & Restoration Services"])
        writer.writerow(["Report Period", report_data["period_label"]])
        writer.writerow(["Generated At", report_data["generated_at"]])
        writer.writerow([])
        
        s = report_data["summary"]
        sales_items = report_data.get("sales_details", [])
        has_items = len(sales_items) > 0
        first_row = 19
        last_row = first_row + len(sales_items) - 1

        writer.writerow(["SUMMARY METRICS", "AMOUNT / COUNT"])
        # Formulas reference item rows if items exist, else authoritative values
        writer.writerow(["Total Sales", f"=SUM(H{first_row}:H{last_row})" if has_items else f"{s['sales']:.2f}"])
        writer.writerow(["Total Orders", f"=COUNTA(A{first_row}:A{last_row})" if has_items else s["orders_count"]])
        writer.writerow(["Payments Received", f"=SUM(I{first_row}:I{last_row})" if has_items else f"{s['payments_received']:.2f}"])
        writer.writerow(["Balance Due", f"=SUM(J{first_row}:J{last_row})" if has_items else f"{s['balance_due']:.2f}"])
        writer.writerow(["Refunds Issued", f"{s['refunds_issued']:.2f}"])
        writer.writerow(["Retained Deposits", f"{s.get('retained_deposits', 0):.2f}"])
        writer.writerow(["Net Sales", "=B7-B11"])
        writer.writerow(["Total Expenses", f"{s['total_expenses']:.2f}"])
        writer.writerow(["Net Profit", "=B13-B14"])
        writer.writerow(["ROI (%)", '=IF(B14>0,(B15/B14)*100,0)'])
        writer.writerow([])
        
        # Row 18: Table Headers (12 columns: Payment Method excluded)
        writer.writerow([
            "Order Number", "Order Date", "Customer Name", "Contact Number", 
            "Shoe Details", "Services", "Priority", "Total Sales", 
            "Amount Paid", "Balance Due", "Payment Status", "Order Status"
        ])
        for idx, item in enumerate(sales_items):
            r = first_row + idx
            writer.writerow([
                item.get("order_number", ""),
                item.get("order_date", ""),
                item.get("customer_name", ""),
                item.get("customer_contact", ""),
                item.get("shoe_details", ""),
                item.get("services", ""),
                item.get("priority", "Regular"),
                f"{item.get('grand_total', 0):.2f}",
                f"{item.get('amount_paid', 0):.2f}",
                f'=IF(ISNUMBER(SEARCH("cancel",L{r})),0,MAX(0,H{r}-I{r}))',
                item.get("payment_status", "Unpaid"),
                item.get("status", "")
            ])

    elif "expenses" in r_norm:
        writer.writerow(["SHOELOTSKEY VILLAMOR-PASAY - EXPENSES REPORT"])
        writer.writerow(["Villamor, Pasay City | Shoe Care & Restoration Services"])
        writer.writerow(["Report Period", report_data["period_label"]])
        writer.writerow(["Generated At", report_data["generated_at"]])
        writer.writerow([])
        
        s = report_data["summary"]
        expenses_items = report_data.get("expenses_details", [])
        has_expenses = len(expenses_items) > 0
        first_row = 14
        last_row = first_row + len(expenses_items) - 1

        writer.writerow(["SUMMARY METRICS", "AMOUNT"])
        writer.writerow(["Total Expenses", f"=SUM(E{first_row}:E{last_row})" if has_expenses else f"{s['total_expenses']:.2f}"])
        writer.writerow(["Inventory Expenses", f'=SUMIF(C{first_row}:C{last_row},"Inventory Expenses",E{first_row}:E{last_row})' if has_expenses else f"{s['inventory_expenses']:.2f}"])
        writer.writerow(["Operating Expenses", f'=SUMIF(C{first_row}:C{last_row},"Operating Expenses",E{first_row}:E{last_row})' if has_expenses else f"{s['operating_expenses']:.2f}"])
        writer.writerow(["Other Expenses", f'=SUMIF(C{first_row}:C{last_row},"Other Expenses",E{first_row}:E{last_row})' if has_expenses else f"{s['other_expenses']:.2f}"])
        writer.writerow([])
        
        writer.writerow(["ITEMIZED EXPENSES"])
        writer.writerow(["Expense Date", "Category", "Group", "Description / Notes", "Amount"])
        for exp in expenses_items:
            writer.writerow([
                exp.get("expense_date", ""),
                exp.get("category", ""),
                exp.get("group", ""),
                exp.get("description", ""),
                f"{exp.get('amount', 0):.2f}"
            ])

    else:
        writer.writerow(["SHOELOTSKEY VILLAMOR-PASAY - ROI REPORT"])
        writer.writerow(["Villamor, Pasay City | Shoe Care & Restoration Services"])
        writer.writerow(["Report Period", report_data["period_label"]])
        writer.writerow(["Generated At", report_data["generated_at"]])
        writer.writerow([])
        
        s = report_data["summary"]
        writer.writerow(["SUMMARY METRICS", "AMOUNT / VALUE"])
        writer.writerow(["Total Sales", f"{s['sales']:.2f}"])
        writer.writerow(["Refunds Issued", f"{s['refunds_issued']:.2f}"])
        writer.writerow(["Retained Deposits", f"{s.get('retained_deposits', 0):.2f}"])
        writer.writerow(["Net Sales", "=B7-B8"])
        writer.writerow(["Payments Received", f"{s['payments_received']:.2f}"])
        writer.writerow(["Balance Due", f"{s['balance_due']:.2f}"])
        writer.writerow(["Total Expenses", f"{s['total_expenses']:.2f}"])
        writer.writerow(["Net Profit", "=B10-B13"])
        writer.writerow(["ROI (%)", '=IF(B13>0,(B14/B13)*100,0)'])
        writer.writerow([])
        
        writer.writerow(["ACCOUNTING FORMULAS", "EXCEL FORMULA"])
        writer.writerow(["Net Sales", "=B7-B8"])
        writer.writerow(["Net Profit", "=B10-B13"])
        writer.writerow(["ROI (%)", '=IF(B13>0,(B14/B13)*100,0)'])

    return output.getvalue()


# ---------------------------------------------------------------------------
# 4.1 NATIVE EXCEL (.XLSX) GENERATION WITH FORMULAS & PROFESSIONAL STYLING
# ---------------------------------------------------------------------------

def generate_report_xlsx(report_data: Dict[str, Any], report_type: str) -> bytes:
    """
    Generates an executive Microsoft Excel (.xlsx) workbook using openpyxl.
    Features:
    - Genuine, active Excel formulas (=SUM, =COUNTA, =SUMIF, =IF, cell math)
    - Automatic formula recalculation on open (fullCalcOnLoad=True)
    - Native Philippine Peso currency formatting (₱#,##0.00) and percentage formatting (0.00%)
    - Auto-fitted column widths for perfect presentation without truncated text
    - Branded corporate red and slate color styling with clean borders
    """
    wb = openpyxl.Workbook()
    wb.calculation.fullCalcOnLoad = True
    ws = wb.active
    ws.views.sheetView[0].showGridLines = True
    r_norm = (report_type or "sales").strip().lower()

    # Styling definitions
    font_family = "Calibri"
    fill_brand_red = PatternFill(start_color="DC2626", end_color="DC2626", fill_type="solid")
    fill_slate_dark = PatternFill(start_color="1E293B", end_color="1E293B", fill_type="solid")
    fill_slate_light = PatternFill(start_color="F1F5F9", end_color="F1F5F9", fill_type="solid")
    
    font_title = Font(name=font_family, size=13, bold=True, color="FFFFFF")
    font_subtitle = Font(name=font_family, size=9.5, italic=True, color="64748B")
    font_meta_lbl = Font(name=font_family, size=9, bold=True, color="475569")
    font_meta_val = Font(name=font_family, size=9, color="0F172A")
    font_card_hdr = Font(name=font_family, size=9.5, bold=True, color="FFFFFF")
    font_tbl_hdr = Font(name=font_family, size=9.5, bold=True, color="FFFFFF")
    font_regular = Font(name=font_family, size=9, color="0F172A")
    font_bold_item = Font(name=font_family, size=9, bold=True, color="0F172A")

    thin_border_side = Side(border_style="thin", color="CBD5E1")
    cell_border = Border(left=thin_border_side, right=thin_border_side, top=thin_border_side, bottom=thin_border_side)

    FMT_CURRENCY = '"₱"#,##0.00;("₱"#,##0.00);"N/A"'
    FMT_INT = '#,##0'
    FMT_PERCENT = '0.00%'

    s = report_data["summary"]

    if "sales" in r_norm:
        ws.title = "Sales Report"
        
        # 1. Title Banner (A1:L1 across the 12 columns)
        ws.merge_cells("A1:L1")
        ws["A1"] = "SHOELOTSKEY VILLAMOR-PASAY - SALES REPORT"
        ws["A1"].font = font_title
        ws["A1"].fill = fill_brand_red
        ws["A1"].alignment = Alignment(horizontal="center", vertical="center")
        ws.row_dimensions[1].height = 32

        # 2. Subtitle (A2:L2 across the 12 columns)
        ws.merge_cells("A2:L2")
        ws["A2"] = "Villamor, Pasay City | Shoe Care & Restoration Services"
        ws["A2"].font = font_subtitle
        ws["A2"].alignment = Alignment(horizontal="center", vertical="center")
        ws.row_dimensions[2].height = 18

        # 3. Meta
        ws["A3"] = "Report Period"
        ws["B3"] = report_data["period_label"]
        ws["A4"] = "Generated At"
        ws["B4"] = report_data["generated_at"]
        for r in range(3, 5):
            ws[f"A{r}"].font = font_meta_lbl
            ws[f"B{r}"].font = font_meta_val

        # 4. Summary Card (A6:B16)
        ws["A6"] = "SUMMARY METRICS"
        ws["B6"] = "AMOUNT / COUNT"
        ws["A6"].font = font_card_hdr
        ws["B6"].font = font_card_hdr
        ws["A6"].fill = fill_slate_dark
        ws["B6"].fill = fill_slate_dark
        ws["A6"].alignment = Alignment(horizontal="left", vertical="center")
        ws["B6"].alignment = Alignment(horizontal="right", vertical="center")
        ws.row_dimensions[6].height = 22

        sales_items = report_data.get("sales_details", [])
        has_items = len(sales_items) > 0
        first_row = 19
        last_row = first_row + len(sales_items) - 1

        summary_rows = [
            ("Total Sales", f"=SUM(H{first_row}:H{last_row})" if has_items else float(s["sales"]), FMT_CURRENCY, True),
            ("Total Orders", f"=COUNTA(A{first_row}:A{last_row})" if has_items else int(s["orders_count"]), FMT_INT, False),
            ("Payments Received", f"=SUM(I{first_row}:I{last_row})" if has_items else float(s["payments_received"]), FMT_CURRENCY, False),
            ("Balance Due", f"=SUM(J{first_row}:J{last_row})" if has_items else float(s["balance_due"]), FMT_CURRENCY, False),
            ("Refunds Issued", float(s["refunds_issued"]), FMT_CURRENCY, False),
            ("Retained Deposits", float(s.get("retained_deposits", 0.0)), FMT_CURRENCY, False),
            ("Net Sales", "=B7-B11+B12", FMT_CURRENCY, True),
            ("Total Expenses", float(s["total_expenses"]), FMT_CURRENCY, False),
            ("Net Profit", "=B13-B14", FMT_CURRENCY, True),
            ("ROI", '=IF(B14>0,B15/B14,0)', FMT_PERCENT, True),
        ]

        for idx, (label, val, fmt, is_bold) in enumerate(summary_rows, start=7):
            ws[f"A{idx}"] = label
            ws[f"B{idx}"] = val
            ws[f"A{idx}"].font = font_bold_item if is_bold else font_regular
            ws[f"B{idx}"].font = font_bold_item if is_bold else font_regular
            ws[f"A{idx}"].border = cell_border
            ws[f"B{idx}"].border = cell_border
            ws[f"B{idx}"].number_format = fmt
            ws[f"B{idx}"].alignment = Alignment(horizontal="right", vertical="center")
            ws.row_dimensions[idx].height = 20

        # 5. Table Headers (Row 18 - 12 columns)
        headers = [
            "Order Number", "Order Date", "Customer Name", "Contact Number", 
            "Shoe Details", "Services", "Priority", "Total Sales", 
            "Amount Paid", "Balance Due", "Payment Status", "Order Status"
        ]
        ws.row_dimensions[18].height = 26
        for col_idx, h in enumerate(headers, start=1):
            cell = ws.cell(row=18, column=col_idx, value=h)
            cell.font = font_tbl_hdr
            cell.fill = fill_brand_red
            cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
            cell.border = cell_border

        # 6. Table Rows (Row 19+)
        for idx, item in enumerate(sales_items):
            r = first_row + idx
            ws.row_dimensions[r].height = 20

            row_values = [
                (item.get("order_number", ""), "center", None),
                (item.get("order_date", ""), "center", None),
                (item.get("customer_name", ""), "center", None),
                (item.get("customer_contact", ""), "center", None),
                (item.get("shoe_details", ""), "left", None),
                (item.get("services", ""), "left", None),
                (item.get("priority", "Regular"), "center", None),
                (float(item.get("grand_total", 0)), "right", FMT_CURRENCY),
                (float(item.get("amount_paid", 0)), "right", FMT_CURRENCY),
                (f'=IF(ISNUMBER(SEARCH("cancel",L{r})),0,MAX(0,H{r}-I{r}))', "right", FMT_CURRENCY),
                (item.get("payment_status", "Unpaid"), "center", None),
                (item.get("status", ""), "center", None),
            ]

            for c_idx, (val, align_h, num_fmt) in enumerate(row_values, start=1):
                c = ws.cell(row=r, column=c_idx, value=val)
                c.font = font_regular
                c.border = cell_border
                c.alignment = Alignment(horizontal=align_h, vertical="center")
                if num_fmt:
                    c.number_format = num_fmt

    elif "expenses" in r_norm:
        ws.title = "Expenses Report"
        
        # 1. Title Banner
        ws.merge_cells("A1:E1")
        ws["A1"] = "SHOELOTSKEY VILLAMOR-PASAY - EXPENSES REPORT"
        ws["A1"].font = font_title
        ws["A1"].fill = fill_brand_red
        ws["A1"].alignment = Alignment(horizontal="center", vertical="center")
        ws.row_dimensions[1].height = 32

        # 2. Subtitle
        ws.merge_cells("A2:E2")
        ws["A2"] = "Villamor, Pasay City | Shoe Care & Restoration Services"
        ws["A2"].font = font_subtitle
        ws["A2"].alignment = Alignment(horizontal="center", vertical="center")
        ws.row_dimensions[2].height = 18

        # 3. Meta
        ws["A3"] = "Report Period"
        ws["B3"] = report_data["period_label"]
        ws["A4"] = "Generated At"
        ws["B4"] = report_data["generated_at"]
        for r in range(3, 5):
            ws[f"A{r}"].font = font_meta_lbl
            ws[f"B{r}"].font = font_meta_val

        # 4. Summary Card
        ws["A6"] = "SUMMARY METRICS"
        ws["B6"] = "AMOUNT"
        ws["A6"].font = font_card_hdr
        ws["B6"].font = font_card_hdr
        ws["A6"].fill = fill_slate_dark
        ws["B6"].fill = fill_slate_dark
        ws["A6"].alignment = Alignment(horizontal="left", vertical="center")
        ws["B6"].alignment = Alignment(horizontal="right", vertical="center")
        ws.row_dimensions[6].height = 22

        expenses_items = report_data.get("expenses_details", [])
        has_expenses = len(expenses_items) > 0
        first_row = 14
        last_row = first_row + len(expenses_items) - 1

        summary_rows = [
            ("Total Expenses", f"=SUM(E{first_row}:E{last_row})" if has_expenses else float(s["total_expenses"]), FMT_CURRENCY, True),
            ("Inventory Expenses", f'=SUMIF(C{first_row}:C{last_row},"Inventory Expenses",E{first_row}:E{last_row})' if has_expenses else float(s["inventory_expenses"]), FMT_CURRENCY, False),
            ("Operating Expenses", f'=SUMIF(C{first_row}:C{last_row},"Operating Expenses",E{first_row}:E{last_row})' if has_expenses else float(s["operating_expenses"]), FMT_CURRENCY, False),
            ("Other Expenses", f'=SUMIF(C{first_row}:C{last_row},"Other Expenses",E{first_row}:E{last_row})' if has_expenses else float(s["other_expenses"]), FMT_CURRENCY, False),
        ]

        for idx, (label, val, fmt, is_bold) in enumerate(summary_rows, start=7):
            ws[f"A{idx}"] = label
            ws[f"B{idx}"] = val
            ws[f"A{idx}"].font = font_bold_item if is_bold else font_regular
            ws[f"B{idx}"].font = font_bold_item if is_bold else font_regular
            ws[f"A{idx}"].border = cell_border
            ws[f"B{idx}"].border = cell_border
            ws[f"B{idx}"].number_format = fmt
            ws[f"B{idx}"].alignment = Alignment(horizontal="right", vertical="center")
            ws.row_dimensions[idx].height = 20

        # 5. Table Section Header (Row 12)
        ws["A12"] = "ITEMIZED EXPENSES"
        ws["A12"].font = Font(name=font_family, size=10, bold=True, color="1E293B")
        ws.row_dimensions[12].height = 22

        # 6. Table Headers (Row 13)
        headers = ["Expense Date", "Category", "Group", "Description / Notes", "Amount"]
        ws.row_dimensions[13].height = 26
        for col_idx, h in enumerate(headers, start=1):
            cell = ws.cell(row=13, column=col_idx, value=h)
            cell.font = font_tbl_hdr
            cell.fill = fill_brand_red
            cell.alignment = Alignment(horizontal="center", vertical="center")
            cell.border = cell_border

        # 7. Table Rows (Row 14+)
        for idx, exp in enumerate(expenses_items):
            r = first_row + idx
            row_fill = fill_zebra if (idx % 2 == 1) else None
            ws.row_dimensions[r].height = 20

            row_values = [
                (exp.get("expense_date", ""), "center", None),
                (exp.get("category", ""), "center", None),
                (exp.get("group", ""), "center", None),
                (exp.get("description", ""), "left", None),
                (float(exp.get("amount", 0)), "right", FMT_CURRENCY),
            ]

            for c_idx, (val, align_h, num_fmt) in enumerate(row_values, start=1):
                c = ws.cell(row=r, column=c_idx, value=val)
                c.font = font_regular
                c.border = cell_border
                c.alignment = Alignment(horizontal=align_h, vertical="center")
                if row_fill:
                    c.fill = row_fill
                if num_fmt:
                    c.number_format = num_fmt

    else:
        # ROI Report
        ws.title = "ROI Report"
        
        # 1. Title Banner
        ws.merge_cells("A1:B1")
        ws["A1"] = "SHOELOTSKEY VILLAMOR-PASAY - ROI REPORT"
        ws["A1"].font = font_title
        ws["A1"].fill = fill_brand_red
        ws["A1"].alignment = Alignment(horizontal="center", vertical="center")
        ws.row_dimensions[1].height = 32

        # 2. Subtitle
        ws.merge_cells("A2:B2")
        ws["A2"] = "Villamor, Pasay City | Shoe Care & Restoration Services"
        ws["A2"].font = font_subtitle
        ws["A2"].alignment = Alignment(horizontal="center", vertical="center")
        ws.row_dimensions[2].height = 18

        # 3. Meta
        ws["A3"] = "Report Period"
        ws["B3"] = report_data["period_label"]
        ws["A4"] = "Generated At"
        ws["B4"] = report_data["generated_at"]
        for r in range(3, 5):
            ws[f"A{r}"].font = font_meta_lbl
            ws[f"B{r}"].font = font_meta_val

        # 4. Financial Metrics Card
        ws["A6"] = "FINANCIAL METRICS"
        ws["B6"] = "AMOUNT / VALUE"
        ws["A6"].font = font_card_hdr
        ws["B6"].font = font_card_hdr
        ws["A6"].fill = fill_slate_dark
        ws["B6"].fill = fill_slate_dark
        ws["A6"].alignment = Alignment(horizontal="left", vertical="center")
        ws["B6"].alignment = Alignment(horizontal="right", vertical="center")
        ws.row_dimensions[6].height = 22

        metrics = [
            ("Total Sales", float(s["sales"]), FMT_CURRENCY, True),
            ("Refunds Issued", float(s["refunds_issued"]), FMT_CURRENCY, False),
            ("Retained Deposits", float(s.get("retained_deposits", 0.0)), FMT_CURRENCY, False),
            ("Net Sales", "=B7-B8+B9", FMT_CURRENCY, True),
            ("Payments Received", float(s["payments_received"]), FMT_CURRENCY, False),
            ("Balance Due", float(s["balance_due"]), FMT_CURRENCY, False),
            ("Total Expenses", float(s["total_expenses"]), FMT_CURRENCY, True),
            ("Net Profit", "=B10-B13", FMT_CURRENCY, True),
            ("ROI", '=IF(B13>0,B14/B13,0)', FMT_PERCENT, True),
        ]

        for idx, (label, val, fmt, is_bold) in enumerate(metrics, start=7):
            ws[f"A{idx}"] = label
            ws[f"B{idx}"] = val
            ws[f"A{idx}"].font = font_bold_item if is_bold else font_regular
            ws[f"B{idx}"].font = font_bold_item if is_bold else font_regular
            ws[f"A{idx}"].border = cell_border
            ws[f"B{idx}"].border = cell_border
            ws[f"B{idx}"].number_format = fmt
            ws[f"B{idx}"].alignment = Alignment(horizontal="right", vertical="center")
            ws.row_dimensions[idx].height = 20

        # 5. Formula Explanation Card
        ws["A17"] = "ACCOUNTING FORMULAS"
        ws["B17"] = "EXCEL FORMULA"
        ws["A17"].font = font_card_hdr
        ws["B17"].font = font_card_hdr
        ws["A17"].fill = fill_slate_dark
        ws["B17"].fill = fill_slate_dark
        ws.row_dimensions[17].height = 22

        formula_rows = [
            ("Net Sales", "=B7-B8+B9"),
            ("Net Profit", "=B10-B13"),
            ("ROI", "=IF(B13>0,B14/B13,0)"),
        ]

        for idx, (label, form) in enumerate(formula_rows, start=18):
            ws[f"A{idx}"] = label
            ws[f"B{idx}"] = form
            ws[f"A{idx}"].font = font_bold_item
            ws[f"B{idx}"].font = font_regular
            ws[f"A{idx}"].border = cell_border
            ws[f"B{idx}"].border = cell_border
            ws[f"B{idx}"].alignment = Alignment(horizontal="right", vertical="center")
            ws.row_dimensions[idx].height = 20

    # Auto-adjust column widths
    for col in ws.columns:
        col_letter = get_column_letter(col[0].column)
        max_len = 0
        for cell in col:
            # Skip title banner in row 1 & 2 for width calculation
            if cell.row in [1, 2]:
                continue
            val_str = str(cell.value or "")
            if val_str.startswith("="):
                val_str = "₱999,999.00"
            max_len = max(max_len, len(val_str))
        ws.column_dimensions[col_letter].width = max(max_len + 5, 13)

    out = io.BytesIO()
    wb.save(out)
    return out.getvalue()


# ---------------------------------------------------------------------------
# 5. PROFESSIONAL REAL PDF GENERATION (PyMuPDF)
# ---------------------------------------------------------------------------

def generate_report_pdf(report_data: Dict[str, Any], report_type: str) -> bytes:
    """
    Generates an executive paginated PDF using PyMuPDF (fitz) with
    official Shoelotskey logo branding, running headers, bounded non-overlapping
    table cells, established financial terminologies, complete itemized fields, and page numbers.
    """
    doc = pymupdf.open()
    r_norm = (report_type or "sales").strip().lower()
    s = report_data["summary"]
    period_label = report_data["period_label"]
    generated_at = report_data["generated_at"]

    # Colors
    RED = pymupdf.utils.getColor("firebrick")
    DARK_GRAY = pymupdf.utils.getColor("gray20")
    LIGHT_GRAY = pymupdf.utils.getColor("gray94")
    LINE_GRAY = pymupdf.utils.getColor("gray80")
    WHITE = pymupdf.utils.getColor("white")
    GREEN = pymupdf.utils.getColor("darkgreen")
    MUTED_GRAY = pymupdf.utils.getColor("gray45")

    margin_x = 40
    margin_y = 36
    page_width = 595.32   # A4 portrait width
    page_height = 841.92  # A4 portrait height
    # Font handling: Prefer Arial on Windows for native Philippine peso symbol (\u20b1)
    ARIAL_PATH = "C:/Windows/Fonts/arial.ttf"
    ARIAL_BOLD_PATH = "C:/Windows/Fonts/arialbd.ttf"
    USE_ARIAL = os.path.exists(ARIAL_PATH)

    if USE_ARIAL:
        font_reg = pymupdf.Font(fontfile=ARIAL_PATH)
        font_bold = pymupdf.Font(fontfile=ARIAL_BOLD_PATH) if os.path.exists(ARIAL_BOLD_PATH) else font_reg
        def text_len(t: str, size: float, bold: bool = False) -> float:
            return (font_bold if bold else font_reg).text_length(t, fontsize=size)
    else:
        def text_len(t: str, size: float, bold: bool = False) -> float:
            return pymupdf.get_text_length(t, fontname="helv", fontsize=size)

    body_font = "arial" if USE_ARIAL else "helv"
    body_file = ARIAL_PATH if USE_ARIAL else None
    bold_font = "arialbd" if USE_ARIAL and os.path.exists(ARIAL_BOLD_PATH) else body_font
    bold_file = ARIAL_BOLD_PATH if USE_ARIAL and os.path.exists(ARIAL_BOLD_PATH) else body_file

    def draw_cell(p, r: pymupdf.Rect, text_val: str, font_size=6.8, font_color=DARK_GRAY, align=0, is_bold=False):
        """
        Draws text within a bounded rectangle.
        Truncates safely with ellipsis if text exceeds rect width.
        align: 0=left, 1=center, 2=right
        """
        t = str(text_val if text_val is not None else "").strip()
        max_w = max(5.0, r.width - 4.0)
        while len(t) > 3 and text_len(t, font_size, is_bold) > max_w:
            t = t[:-4] + "..."

        t_l = text_len(t, font_size, is_bold)
        if align == 2:    # right
            px = r.x1 - t_l - 3
        elif align == 1:  # center
            px = r.x0 + (r.width - t_l) / 2
        else:             # left
            px = r.x0 + 3
        py = r.y0 + (r.height + font_size * 0.75) / 2

        if USE_ARIAL:
            ffile = ARIAL_BOLD_PATH if is_bold and os.path.exists(ARIAL_BOLD_PATH) else ARIAL_PATH
            fname = "arialbd" if is_bold and os.path.exists(ARIAL_BOLD_PATH) else "arial"
            p.insert_text(pymupdf.Point(px, py), t, fontsize=font_size, fontname=fname, fontfile=ffile, color=font_color)
        else:
            p.insert_text(pymupdf.Point(px, py), t, fontsize=font_size, fontname="helv", color=font_color)

    def draw_kv_line(p, x_left, x_right, y_baseline, label, val_str, lbl_bold=False, val_bold=True, lbl_color=DARK_GRAY, val_color=DARK_GRAY, font_sz=8.5):
        """Draws key-value summary row matching CSS flex justify-between."""
        lf = bold_font if lbl_bold else body_font
        lfile = bold_file if lbl_bold else body_file
        vf = bold_font if val_bold else body_font
        vfile = bold_file if val_bold else body_file
        if USE_ARIAL:
            p.insert_text(pymupdf.Point(x_left, y_baseline), label, fontsize=font_sz, fontname=lf, fontfile=lfile, color=lbl_color)
            v_len = text_len(val_str, font_sz, bold=val_bold)
            p.insert_text(pymupdf.Point(x_right - v_len, y_baseline), val_str, fontsize=font_sz, fontname=vf, fontfile=vfile, color=val_color)
        else:
            p.insert_text(pymupdf.Point(x_left, y_baseline), label, fontsize=font_sz, fontname="helv", color=lbl_color)
            v_len = text_len(val_str, font_sz, bold=val_bold)
            p.insert_text(pymupdf.Point(x_right - v_len, y_baseline), val_str, fontsize=font_sz, fontname="helv", color=val_color)

    def add_page_header(page, title_text: str):
        # Bottom red divider line (Exact visual mirror of border-b-2 border-red-600)
        header_line_y = margin_y + 48
        page.draw_line(pymupdf.Point(margin_x, header_line_y), pymupdf.Point(page_width - margin_x, header_line_y), color=RED, width=1.8)

        # Logo
        logo_x = margin_x
        logo_y = margin_y + 3
        logo_w = 40
        logo_h = 40
        if os.path.exists(LOGO_PATH):
            try:
                page.insert_image(pymupdf.Rect(logo_x, logo_y, logo_x + logo_w, logo_y + logo_h), filename=LOGO_PATH)
            except Exception:
                pass

        # Header titles
        text_x = margin_x + 48
        if USE_ARIAL:
            page.insert_text(pymupdf.Point(text_x, margin_y + 15), "SHOELOTSKEY", fontsize=12.5, fontname="arialbd", fontfile=ARIAL_BOLD_PATH, color=RED)
            page.insert_text(pymupdf.Point(text_x, margin_y + 27), "SHOE CARE & RESTORATION SERVICES • VILLAMOR-PASAY", fontsize=6.8, fontname="arial", fontfile=ARIAL_PATH, color=DARK_GRAY)
            page.insert_text(pymupdf.Point(text_x, margin_y + 41), title_text.upper(), fontsize=10, fontname="arialbd", fontfile=ARIAL_BOLD_PATH, color=DARK_GRAY)

            right_margin = page_width - margin_x
            p_text = f"PERIOD: {period_label.upper()}"
            g_text = f"GENERATED: {generated_at}"
            s_text = "SYSTEM: Shoelotskey SMS v2.0"

            p_len = text_len(p_text, 7.8, bold=True)
            g_len = text_len(g_text, 6.8)
            s_len = text_len(s_text, 6.8)

            if USE_ARIAL:
                page.insert_text(pymupdf.Point(right_margin - p_len, margin_y + 15), p_text, fontsize=7.8, fontname="arialbd", fontfile=ARIAL_BOLD_PATH, color=RED)
                page.insert_text(pymupdf.Point(right_margin - g_len, margin_y + 27), g_text, fontsize=6.8, fontname="arial", fontfile=ARIAL_PATH, color=DARK_GRAY)
                page.insert_text(pymupdf.Point(right_margin - s_len, margin_y + 39), s_text, fontsize=6.8, fontname="arial", fontfile=ARIAL_PATH, color=pymupdf.utils.getColor("gray50"))
            else:
                page.insert_text(pymupdf.Point(right_margin - p_len, margin_y + 15), p_text, fontsize=7.8, fontname="helv", color=RED)
                page.insert_text(pymupdf.Point(right_margin - g_len, margin_y + 27), g_text, fontsize=6.8, fontname="helv", color=DARK_GRAY)
                page.insert_text(pymupdf.Point(right_margin - s_len, margin_y + 39), s_text, fontsize=6.8, fontname="helv", color=pymupdf.utils.getColor("gray50"))

    def add_page_footer(page, page_num: int, total_pages: int):
        footer_y = page_height - 24
        page.draw_line(pymupdf.Point(margin_x, footer_y - 8), pymupdf.Point(page_width - margin_x, footer_y - 8), color=LINE_GRAY, width=0.5)
        tagline = "Make it easy with Shoelotskey!"
        gen_date = generated_at.split(" ")[0] if " " in generated_at else generated_at
        page_str = f"Page {page_num} of {total_pages} • System Generated • {gen_date}"
        tw = text_len(tagline, 7.5, bold=True)
        pw = text_len(page_str, 7.5)

        if USE_ARIAL:
            page.insert_text(pymupdf.Point(margin_x, footer_y), "Shoelotskey SMS • Villamor, Pasay", fontsize=7.5, fontname="arial", fontfile=ARIAL_PATH, color=DARK_GRAY)
            page.insert_text(pymupdf.Point((page_width - tw) / 2, footer_y), tagline, fontsize=7.5, fontname="arialbd", fontfile=ARIAL_BOLD_PATH, color=RED)
            page.insert_text(pymupdf.Point(page_width - margin_x - pw, footer_y), page_str, fontsize=7.5, fontname="arial", fontfile=ARIAL_PATH, color=DARK_GRAY)
        else:
            page.insert_text(pymupdf.Point(margin_x, footer_y), "Shoelotskey SMS • Villamor, Pasay", fontsize=7.5, fontname="helv", color=DARK_GRAY)
            page.insert_text(pymupdf.Point((page_width - tw) / 2, footer_y), tagline, fontsize=7.5, fontname="helv", color=RED)
            page.insert_text(pymupdf.Point(page_width - margin_x - pw, footer_y), page_str, fontsize=7.5, fontname="helv", color=DARK_GRAY)

    if "sales" in r_norm:
        title = "Sales Report"
        page = doc.new_page(width=page_width, height=page_height)
        add_page_header(page, title)

        y = margin_y + 58
        # Financial Summary Card (Exact 2-column key-value layout of Print View)
        card_h = 108 if s.get("retained_deposits", 0) > 0 else 94
        page.draw_rect(pymupdf.Rect(margin_x, y, page_width - margin_x, y + card_h), fill=WHITE, color=RED, width=1)
        page.draw_rect(pymupdf.Rect(margin_x, y, page_width - margin_x, y + 17), fill=LIGHT_GRAY, color=RED, width=0.5)
        
        page.insert_text(pymupdf.Point(margin_x + 10, y + 12), "FINANCIAL SUMMARY", fontsize=9, fontname=bold_font, fontfile=bold_file, color=RED)

        col1_x = margin_x + 12
        col1_r = margin_x + 242
        col2_x = margin_x + 265
        col2_r = page_width - margin_x - 12
        step_y = 13.5
        c1_y = y + 31
        c2_y = y + 31

        # Col 1: Total Sales, Refunds Issued, Net Sales, (Retained Deposits), Total Orders
        draw_kv_line(page, col1_x, col1_r, c1_y, "Total Sales:", f"\u20b1{s['sales']:,.2f}", lbl_bold=False, val_bold=True)
        draw_kv_line(page, col1_x, col1_r, c1_y + step_y, "Refunds Issued:", f"\u20b1{s['refunds_issued']:,.2f}", lbl_bold=False, val_bold=True)
        draw_kv_line(page, col1_x, col1_r, c1_y + 2 * step_y, "Net Sales:", f"\u20b1{s['net_sales']:,.2f}", lbl_bold=True, val_bold=True)
        
        c1_idx = 3
        if s.get("retained_deposits", 0) > 0:
            draw_kv_line(page, col1_x, col1_r, c1_y + c1_idx * step_y, "Retained Deposits:", f"\u20b1{s['retained_deposits']:,.2f}", lbl_bold=False, val_bold=True)
            c1_idx += 1
        draw_kv_line(page, col1_x, col1_r, c1_y + c1_idx * step_y, "Total Orders:", str(s['orders_count']), lbl_bold=False, val_bold=True)

        # Col 2: Payments Received, Balance Due, Total Expenses, Net Profit, ROI
        draw_kv_line(page, col2_x, col2_r, c2_y, "Payments Received:", f"\u20b1{s['payments_received']:,.2f}", lbl_bold=False, val_bold=True)
        draw_kv_line(page, col2_x, col2_r, c2_y + step_y, "Balance Due:", f"\u20b1{s['balance_due']:,.2f}", lbl_bold=False, val_bold=True)
        draw_kv_line(page, col2_x, col2_r, c2_y + 2 * step_y, "Total Expenses:", f"\u20b1{s['total_expenses']:,.2f}", lbl_bold=False, val_bold=True, val_color=DARK_GRAY)
        draw_kv_line(page, col2_x, col2_r, c2_y + 3 * step_y, "Net Profit:", f"\u20b1{s['net_profit']:,.2f}", lbl_bold=True, val_bold=True)
        draw_kv_line(page, col2_x, col2_r, c2_y + 4 * step_y, "Return on Investment (ROI):", str(s['roi_display']), lbl_bold=True, val_bold=True)

        y += card_h + 12
        page.insert_text(pymupdf.Point(margin_x, y), "SALES RECORDS", fontsize=9.5, fontname=bold_font, fontfile=bold_file, color=RED)
        y += 6

        # Itemized Table Columns
        # Total Width: 80 + 55 + 95 + 95 + 45 + 48 + 48 + 49 = 515 pt
        cols = [
            ("Order #", 80, 0),
            ("Date", 55, 1),
            ("Customer", 95, 0),
            ("Shoe Details", 95, 0),
            ("Priority", 45, 1),
            ("Total", 48, 2),
            ("Paid", 48, 2),
            ("Balance", 49, 2),
        ]

        def draw_table_header(p, top_y):
            p.draw_rect(pymupdf.Rect(margin_x, top_y, page_width - margin_x, top_y + 17), fill=RED, color=RED)
            cx = margin_x
            for title_h, w, align in cols:
                r = pymupdf.Rect(cx, top_y, cx + w, top_y + 17)
                draw_cell(p, r, title_h, font_size=7.0, font_color=WHITE, align=align)
                cx += w
            return top_y + 17

        y = draw_table_header(page, y)

        records = report_data["sales_details"]
        if not records:
            page.insert_text(pymupdf.Point(margin_x + 20, y + 25), "No sales records found for the selected period.", fontsize=9, fontname="helv", color=DARK_GRAY)
        else:
            row_idx = 0
            for item in records:
                row_h = 27.0  # 15pt primary line + 12pt detail sub-line
                if y + row_h > page_height - margin_y - 28:
                    page = doc.new_page(width=page_width, height=page_height)
                    add_page_header(page, title)
                    y = margin_y + 64
                    y = draw_table_header(page, y)

                bg_color = LIGHT_GRAY if row_idx % 2 == 1 else WHITE
                page.draw_rect(pymupdf.Rect(margin_x, y, page_width - margin_x, y + row_h), fill=bg_color, color=LINE_GRAY, width=0.4)

                date_display = str(item.get("order_date", ""))
                if len(date_display) >= 16:
                    try:
                        dt_obj = datetime.strptime(date_display[:16], "%Y-%m-%d %H:%M")
                        date_display = dt_obj.strftime("%m/%d/%y %H:%M")
                    except Exception:
                        date_display = date_display[:10]

                # Line 1: Primary Order & Financial Data
                line1_y = y
                line1_h = 14.5
                row_data_l1 = [
                    (str(item.get("order_number", "")), cols[0][1], cols[0][2]),
                    (date_display, cols[1][1], cols[1][2]),
                    (str(item.get("customer_name", "Guest")), cols[2][1], cols[2][2]),
                    (str(item.get("shoe_details", "Shoes")), cols[3][1], cols[3][2]),
                    (str(item.get("priority", "Regular")).title(), cols[4][1], cols[4][2]),
                    (f"\u20b1{item.get('grand_total', 0):,.2f}", cols[5][1], cols[5][2]),
                    (f"\u20b1{item.get('amount_paid', 0):,.2f}", cols[6][1], cols[6][2]),
                    (f"\u20b1{item.get('balance_due', 0):,.2f}", cols[7][1], cols[7][2]),
                ]

                cx = margin_x
                for val, w, align in row_data_l1:
                    cell_r = pymupdf.Rect(cx, line1_y, cx + w, line1_y + line1_h)
                    draw_cell(page, cell_r, val, font_size=6.6, font_color=DARK_GRAY, align=align)
                    cx += w

                # Line 2: Context Sub-line (Status, Contact, Services, Payment)
                line2_y = y + line1_h
                line2_h = 12.5

                # Divider above subline
                page.draw_line(pymupdf.Point(margin_x, line2_y), pymupdf.Point(page_width - margin_x, line2_y), color=pymupdf.utils.getColor("gray90"), width=0.3)

                status_str = f"Status: {item.get('status', 'New Order')}"
                contact_str = str(item.get('customer_contact', '') or 'N/A')
                svc_str = f"Services: {item.get('services', 'Standard Care')}"
                pay_method = str(item.get('payment_method', 'Cash')).title()
                pay_status = str(item.get('payment_status', 'Unpaid')).title()
                pay_str = f"{pay_method} \u2022 {pay_status}"

                # Subline segments (Total 515 pt matching Print view - no 'Contact:' or 'Payment:' labels):
                # 1. Status: 110 pt
                # 2. Contact: 95 pt
                # 3. Services: 180 pt
                # 4. Payment: 130 pt
                sub_segments = [
                    (status_str, 110, 0),
                    (contact_str, 95, 0),
                    (svc_str, 180, 0),
                    (pay_str, 130, 2),
                ]

                cx = margin_x
                for sub_val, sw, salign in sub_segments:
                    scell_r = pymupdf.Rect(cx, line2_y, cx + sw, line2_y + line2_h)
                    draw_cell(page, scell_r, sub_val, font_size=5.9, font_color=MUTED_GRAY, align=salign)
                    cx += sw

                y += row_h
                row_idx += 1

    elif "expenses" in r_norm:
        title = "Expenses Report"
        page = doc.new_page(width=page_width, height=page_height)
        add_page_header(page, title)

        y = margin_y + 58
        # Financial Summary Box (Exact 2-column key-value layout of Print View)
        card_h = 62
        page.draw_rect(pymupdf.Rect(margin_x, y, page_width - margin_x, y + card_h), fill=WHITE, color=RED, width=1)
        page.draw_rect(pymupdf.Rect(margin_x, y, page_width - margin_x, y + 17), fill=LIGHT_GRAY, color=RED, width=0.5)
        page.insert_text(pymupdf.Point(margin_x + 10, y + 12), "EXPENSES BREAKDOWN SUMMARY", fontsize=9, fontname=bold_font, fontfile=bold_file, color=RED)

        col1_x = margin_x + 12
        col1_r = margin_x + 242
        col2_x = margin_x + 265
        col2_r = page_width - margin_x - 12
        c1_y = y + 31
        step_y = 15

        draw_kv_line(page, col1_x, col1_r, c1_y, "Total Expenses:", f"\u20b1{s['total_expenses']:,.2f}", lbl_bold=True, val_bold=True, val_color=DARK_GRAY)
        draw_kv_line(page, col1_x, col1_r, c1_y + step_y, "Inventory Expenses:", f"\u20b1{s['inventory_expenses']:,.2f}", lbl_bold=False, val_bold=True)

        draw_kv_line(page, col2_x, col2_r, c1_y, "Operating Expenses:", f"\u20b1{s['operating_expenses']:,.2f}", lbl_bold=False, val_bold=True)
        draw_kv_line(page, col2_x, col2_r, c1_y + step_y, "Other Expenses:", f"\u20b1{s['other_expenses']:,.2f}", lbl_bold=False, val_bold=True)

        y += card_h + 12
        page.insert_text(pymupdf.Point(margin_x, y), "EXPENSE ENTRIES", fontsize=9.5, fontname=bold_font, fontfile=bold_file, color=RED)
        y += 6

        # Columns: (Title, Width, Alignment)
        # Total: 75 + 85 + 90 + 185 + 80 = 515 pt
        cols = [
            ("Date & Time", 75, 0),
            ("Category", 85, 0),
            ("Group", 90, 0),
            ("Description / Notes", 185, 0),
            ("Amount", 80, 2),
        ]

        def draw_exp_header(p, top_y):
            p.draw_rect(pymupdf.Rect(margin_x, top_y, page_width - margin_x, top_y + 17), fill=RED, color=RED)
            cx = margin_x
            for title_h, w, align in cols:
                r = pymupdf.Rect(cx, top_y, cx + w, top_y + 17)
                draw_cell(p, r, title_h, font_size=7.0, font_color=WHITE, align=align)
                cx += w
            return top_y + 17

        y = draw_exp_header(page, y)

        records = report_data["expenses_details"]
        if not records:
            page.insert_text(pymupdf.Point(margin_x + 20, y + 25), "No expense records found for the selected period.", fontsize=9, fontname="helv", color=DARK_GRAY)
        else:
            row_idx = 0
            for exp in records:
                row_h = 16.5
                if y + row_h > page_height - margin_y - 28:
                    page = doc.new_page(width=page_width, height=page_height)
                    add_page_header(page, title)
                    y = margin_y + 58
                    y = draw_exp_header(page, y)

                bg_color = LIGHT_GRAY if row_idx % 2 == 1 else WHITE
                page.draw_rect(pymupdf.Rect(margin_x, y, page_width - margin_x, y + row_h), fill=bg_color, color=LINE_GRAY, width=0.4)

                row_data = [
                    (str(exp.get("expense_date", ""))[:16], cols[0][1], cols[0][2]),
                    (str(exp.get("category", "")), cols[1][1], cols[1][2]),
                    (str(exp.get("group", "")), cols[2][1], cols[2][2]),
                    (str(exp.get("description", "")), cols[3][1], cols[3][2]),
                    (f"\u20b1{exp.get('amount', 0):,.2f}", cols[4][1], cols[4][2]),
                ]

                cx = margin_x
                for val, w, align in row_data:
                    cell_rect = pymupdf.Rect(cx, y, cx + w, y + row_h)
                    draw_cell(page, cell_rect, val, font_size=6.7, font_color=DARK_GRAY, align=align)
                    cx += w

                y += row_h
                row_idx += 1

    else:
        title = "ROI & Financial Performance Report"
        page = doc.new_page(width=page_width, height=page_height)
        add_page_header(page, title)

        y = margin_y + 58
        # Financial Performance Card (Exact 2-column key-value layout of Print View)
        perf_h = 108 if s.get("retained_deposits", 0) > 0 else 94
        page.draw_rect(pymupdf.Rect(margin_x, y, page_width - margin_x, y + perf_h), fill=WHITE, color=RED, width=1)
        page.draw_rect(pymupdf.Rect(margin_x, y, page_width - margin_x, y + 17), fill=LIGHT_GRAY, color=RED, width=0.5)
        page.insert_text(pymupdf.Point(margin_x + 10, y + 12), "EXECUTIVE FINANCIAL PERFORMANCE SUMMARY", fontsize=9, fontname=bold_font, fontfile=bold_file, color=RED)

        col1_x = margin_x + 12
        col1_r = margin_x + 242
        col2_x = margin_x + 265
        col2_r = page_width - margin_x - 12
        step_y = 13.5
        c1_y = y + 31
        c2_y = y + 31

        # Col 1
        draw_kv_line(page, col1_x, col1_r, c1_y, "Total Sales:", f"\u20b1{s['sales']:,.2f}", lbl_bold=False, val_bold=True)
        draw_kv_line(page, col1_x, col1_r, c1_y + step_y, "Refunds Issued:", f"\u20b1{s['refunds_issued']:,.2f}", lbl_bold=False, val_bold=True)
        draw_kv_line(page, col1_x, col1_r, c1_y + 2 * step_y, "Net Sales:", f"\u20b1{s['net_sales']:,.2f}", lbl_bold=True, val_bold=True)
        
        c1_idx = 3
        if s.get("retained_deposits", 0) > 0:
            draw_kv_line(page, col1_x, col1_r, c1_y + c1_idx * step_y, "Retained Deposits:", f"\u20b1{s['retained_deposits']:,.2f}", lbl_bold=False, val_bold=True)
            c1_idx += 1
        draw_kv_line(page, col1_x, col1_r, c1_y + c1_idx * step_y, "Total Orders:", str(s['orders_count']), lbl_bold=False, val_bold=True)

        # Col 2
        draw_kv_line(page, col2_x, col2_r, c2_y, "Payments Received:", f"\u20b1{s['payments_received']:,.2f}", lbl_bold=False, val_bold=True)
        draw_kv_line(page, col2_x, col2_r, c2_y + step_y, "Balance Due:", f"\u20b1{s['balance_due']:,.2f}", lbl_bold=False, val_bold=True)
        draw_kv_line(page, col2_x, col2_r, c2_y + 2 * step_y, "Total Expenses:", f"\u20b1{s['total_expenses']:,.2f}", lbl_bold=False, val_bold=True, val_color=DARK_GRAY)
        draw_kv_line(page, col2_x, col2_r, c2_y + 3 * step_y, "Net Profit:", f"\u20b1{s['net_profit']:,.2f}", lbl_bold=True, val_bold=True)
        draw_kv_line(page, col2_x, col2_r, c2_y + 4 * step_y, "Return on Investment (ROI):", str(s['roi_display']), lbl_bold=True, val_bold=True)

        y += perf_h + 10
        # Accounting Formulas Explanation Card
        form_h = 60
        page.draw_rect(pymupdf.Rect(margin_x, y, page_width - margin_x, y + form_h), fill=LIGHT_GRAY, color=LINE_GRAY, width=0.8)
        page.insert_text(pymupdf.Point(margin_x + 12, y + 14), "ACCOUNTING FORMULAS & DEFINITIONS", fontsize=8.5, fontname=bold_font, fontfile=bold_file, color=DARK_GRAY)
        page.insert_text(pymupdf.Point(margin_x + 12, y + 28), "• Net Profit = Net Sales - Total Expenses", fontsize=8, fontname=body_font, fontfile=body_file, color=DARK_GRAY)
        page.insert_text(pymupdf.Point(margin_x + 12, y + 42), "• ROI = (Net Profit / Total Expenses) \u00d7 100", fontsize=8, fontname=body_font, fontfile=body_file, color=DARK_GRAY)
        if s["total_expenses"] == 0:
            page.insert_text(pymupdf.Point(margin_x + 12, y + 54), "• Note: No ROI can be calculated because business expenses for the selected period are zero (ROI = N/A).", fontsize=7.5, fontname=body_font, fontfile=body_file, color=RED)
        else:
            page.insert_text(pymupdf.Point(margin_x + 12, y + 54), f"• Calculation: (\u20b1{s['net_profit']:,.2f} \u00f7 \u20b1{s['total_expenses']:,.2f}) \u00d7 100 = {s['roi_display']}", fontsize=8, fontname=body_font, fontfile=body_file, color=DARK_GRAY)

        y += form_h + 12
        # 1. Service Revenue & Performance Analytics Table
        page.insert_text(pymupdf.Point(margin_x, y), "SERVICE REVENUE & PERFORMANCE ANALYTICS", fontsize=9.5, fontname=bold_font, fontfile=bold_file, color=RED)
        y += 6

        # Calculate canonical service aggregates from sales_details
        svc_counts = {"Basic Cleaning": 0, "Minor Reglue": 0, "Full Reglue": 0, "Color Renewal": 0}
        svc_rev = {"Basic Cleaning": 0.0, "Minor Reglue": 0.0, "Full Reglue": 0.0, "Color Renewal": 0.0}

        for item in report_data.get("sales_details", []):
            if not item.get("is_eligible", False):
                continue
            s_name = str(item.get("services", "")).lower()
            amt = float(item.get("amount_paid", 0.0) or item.get("grand_total", 0.0))
            
            matched = []
            if "basic" in s_name or "cleaning" in s_name:
                matched.append("Basic Cleaning")
            if "minor reglue" in s_name:
                matched.append("Minor Reglue")
            if "full reglue" in s_name:
                matched.append("Full Reglue")
            if "color" in s_name or "renewal" in s_name or "paint" in s_name:
                matched.append("Color Renewal")
            if not matched:
                matched.append("Basic Cleaning")
            
            share = amt / len(matched)
            for m in matched:
                svc_counts[m] += 1
                svc_rev[m] += share

        svc_cols = [
            ("Service Category", 185, 0),
            ("Volume (Pairs)", 100, 1),
            ("Revenue Generated", 120, 2),
            ("% Share of Sales", 110, 2),
        ]
        
        page.draw_rect(pymupdf.Rect(margin_x, y, page_width - margin_x, y + 16), fill=RED, color=RED)
        cx = margin_x
        for title_h, w, align in svc_cols:
            draw_cell(page, pymupdf.Rect(cx, y, cx + w, y + 16), title_h, font_size=7.0, font_color=WHITE, align=align)
            cx += w
        y += 16

        total_net = s.get("net_sales", 0.0) or 1.0
        tot_svc_rev = sum(svc_rev.values())
        tot_svc_cnt = sum(svc_counts.values())

        for s_key in ["Basic Cleaning", "Minor Reglue", "Full Reglue", "Color Renewal"]:
            cnt = svc_counts[s_key]
            rev = svc_rev[s_key]
            pct = (rev / total_net) * 100.0 if total_net > 0 else 0.0
            
            page.draw_rect(pymupdf.Rect(margin_x, y, page_width - margin_x, y + 14), fill=WHITE, color=LINE_GRAY, width=0.5)
            draw_cell(page, pymupdf.Rect(margin_x, y, margin_x + 185, y + 14), s_key, font_size=7.0, font_color=DARK_GRAY, align=0, is_bold=True)
            draw_cell(page, pymupdf.Rect(margin_x + 185, y, margin_x + 285, y + 14), f"{cnt} pairs", font_size=7.0, font_color=DARK_GRAY, align=1)
            draw_cell(page, pymupdf.Rect(margin_x + 285, y, margin_x + 405, y + 14), f"\u20b1{rev:,.2f}", font_size=7.0, font_color=DARK_GRAY, align=2)
            draw_cell(page, pymupdf.Rect(margin_x + 405, y, page_width - margin_x, y + 14), f"{pct:.1f}%", font_size=7.0, font_color=DARK_GRAY, align=2)
            y += 14

        # Total canonical row
        page.draw_rect(pymupdf.Rect(margin_x, y, page_width - margin_x, y + 15), fill=LIGHT_GRAY, color=LINE_GRAY, width=0.8)
        draw_cell(page, pymupdf.Rect(margin_x, y, margin_x + 185, y + 15), "Total Canonical Services", font_size=7.0, font_color=DARK_GRAY, align=0, is_bold=True)
        draw_cell(page, pymupdf.Rect(margin_x + 185, y, margin_x + 285, y + 15), f"{tot_svc_cnt} pairs", font_size=7.0, font_color=DARK_GRAY, align=1, is_bold=True)
        draw_cell(page, pymupdf.Rect(margin_x + 285, y, margin_x + 405, y + 15), f"\u20b1{tot_svc_rev:,.2f}", font_size=7.0, font_color=DARK_GRAY, align=2, is_bold=True)
        draw_cell(page, pymupdf.Rect(margin_x + 405, y, page_width - margin_x, y + 15), "100.0%", font_size=7.0, font_color=DARK_GRAY, align=2, is_bold=True)
        y += 24

        # 2. Side-by-Side: Cost Distribution & Payment Channels
        box_w = 250
        gap_w = 15
        box1_x = margin_x
        box2_x = margin_x + box_w + gap_w

        # Cost Distribution Header
        page.insert_text(pymupdf.Point(box1_x, y), "COST & EXPENSE DISTRIBUTION", fontsize=9, fontname=bold_font, fontfile=bold_file, color=RED)
        # Payment Collection Header
        page.insert_text(pymupdf.Point(box2_x, y), "PAYMENT COLLECTION ANALYTICS", fontsize=9, fontname=bold_font, fontfile=bold_file, color=RED)
        y += 8

        # Left Header
        page.draw_rect(pymupdf.Rect(box1_x, y, box1_x + box_w, y + 15), fill=RED, color=RED)
        draw_cell(page, pymupdf.Rect(box1_x, y, box1_x + 120, y + 15), "Expense Group", font_size=6.8, font_color=WHITE, align=0)
        draw_cell(page, pymupdf.Rect(box1_x + 120, y, box1_x + 190, y + 15), "Amount", font_size=6.8, font_color=WHITE, align=2)
        draw_cell(page, pymupdf.Rect(box1_x + 190, y, box1_x + box_w, y + 15), "% Share", font_size=6.8, font_color=WHITE, align=2)

        # Right Header
        page.draw_rect(pymupdf.Rect(box2_x, y, box2_x + box_w, y + 15), fill=RED, color=RED)
        draw_cell(page, pymupdf.Rect(box2_x, y, box2_x + 110, y + 15), "Payment Channel", font_size=6.8, font_color=WHITE, align=0)
        draw_cell(page, pymupdf.Rect(box2_x + 110, y, box2_x + 165, y + 15), "Orders", font_size=6.8, font_color=WHITE, align=1)
        draw_cell(page, pymupdf.Rect(box2_x + 165, y, box2_x + box_w, y + 15), "Collected", font_size=6.8, font_color=WHITE, align=2)
        y += 15

        # Compute Payment counts & amounts
        pay_methods = {"Cash": {"count": 0, "amount": 0.0}, "GCash": {"count": 0, "amount": 0.0}, "Maya": {"count": 0, "amount": 0.0}}
        for item in report_data.get("sales_details", []):
            if not item.get("is_eligible", False):
                continue
            pm = str(item.get("payment_method", "Cash")).strip()
            pm_key = "GCash" if "gcash" in pm.lower() else ("Maya" if "maya" in pm.lower() else "Cash")
            pay_methods[pm_key]["count"] += 1
            pay_methods[pm_key]["amount"] += float(item.get("amount_paid", 0.0))

        tot_exp = s.get("total_expenses", 0.0) or 1.0
        cost_rows = [
            ("Inventory Expenses", s.get("inventory_expenses", 0.0)),
            ("Operating Expenses", s.get("operating_expenses", 0.0)),
            ("Other Expenses", s.get("other_expenses", 0.0)),
        ]
        pay_rows = [("Cash", pay_methods["Cash"]), ("GCash", pay_methods["GCash"]), ("Maya", pay_methods["Maya"])]

        for idx in range(3):
            c_name, c_amt = cost_rows[idx]
            c_pct = (c_amt / tot_exp) * 100.0 if tot_exp > 0 else 0.0
            p_name, p_data = pay_rows[idx]

            # Left Row
            page.draw_rect(pymupdf.Rect(box1_x, y, box1_x + box_w, y + 13), fill=WHITE, color=LINE_GRAY, width=0.5)
            draw_cell(page, pymupdf.Rect(box1_x, y, box1_x + 120, y + 13), c_name, font_size=6.5, font_color=DARK_GRAY, align=0)
            draw_cell(page, pymupdf.Rect(box1_x + 120, y, box1_x + 190, y + 13), f"\u20b1{c_amt:,.2f}", font_size=6.5, font_color=DARK_GRAY, align=2)
            draw_cell(page, pymupdf.Rect(box1_x + 190, y, box1_x + box_w, y + 13), f"{c_pct:.1f}%", font_size=6.5, font_color=DARK_GRAY, align=2)

            # Right Row
            page.draw_rect(pymupdf.Rect(box2_x, y, box2_x + box_w, y + 13), fill=WHITE, color=LINE_GRAY, width=0.5)
            draw_cell(page, pymupdf.Rect(box2_x, y, box2_x + 110, y + 13), p_name, font_size=6.5, font_color=DARK_GRAY, align=0)
            draw_cell(page, pymupdf.Rect(box2_x + 110, y, box2_x + 165, y + 13), str(p_data["count"]), font_size=6.5, font_color=DARK_GRAY, align=1)
            draw_cell(page, pymupdf.Rect(box2_x + 165, y, box2_x + box_w, y + 13), f"\u20b1{p_data['amount']:,.2f}", font_size=6.5, font_color=DARK_GRAY, align=2)
            y += 13

        # Left Total
        page.draw_rect(pymupdf.Rect(box1_x, y, box1_x + box_w, y + 14), fill=LIGHT_GRAY, color=LINE_GRAY, width=0.8)
        draw_cell(page, pymupdf.Rect(box1_x, y, box1_x + 120, y + 14), "Total Expenses", font_size=6.5, font_color=DARK_GRAY, align=0, is_bold=True)
        draw_cell(page, pymupdf.Rect(box1_x + 120, y, box1_x + 190, y + 14), f"\u20b1{s['total_expenses']:,.2f}", font_size=6.5, font_color=DARK_GRAY, align=2, is_bold=True)
        draw_cell(page, pymupdf.Rect(box1_x + 190, y, box1_x + box_w, y + 14), "100.0%", font_size=6.5, font_color=DARK_GRAY, align=2, is_bold=True)

        # Right Total
        page.draw_rect(pymupdf.Rect(box2_x, y, box2_x + box_w, y + 14), fill=LIGHT_GRAY, color=LINE_GRAY, width=0.8)
        draw_cell(page, pymupdf.Rect(box2_x, y, box2_x + 110, y + 14), "Total Collections", font_size=6.5, font_color=DARK_GRAY, align=0, is_bold=True)
        draw_cell(page, pymupdf.Rect(box2_x + 110, y, box2_x + 165, y + 14), str(sum(m["count"] for m in pay_methods.values())), font_size=6.5, font_color=DARK_GRAY, align=1, is_bold=True)
        draw_cell(page, pymupdf.Rect(box2_x + 165, y, box2_x + box_w, y + 14), f"\u20b1{s['payments_received']:,.2f}", font_size=6.5, font_color=DARK_GRAY, align=2, is_bold=True)
        y += 24

        # 3. Key Performance Indicators Banner
        kpi_h = 34
        page.draw_rect(pymupdf.Rect(margin_x, y, page_width - margin_x, y + kpi_h), fill=LIGHT_GRAY, color=LINE_GRAY, width=1)
        kpi_col_w = (page_width - 2 * margin_x) / 3.0

        coll_rate = (s["payments_received"] / s["net_sales"] * 100.0) if s.get("net_sales", 0) > 0 else 0.0
        profit_margin = (s["net_profit"] / s["net_sales"] * 100.0) if s.get("net_sales", 0) > 0 else 0.0

        draw_cell(page, pymupdf.Rect(margin_x, y + 2, margin_x + kpi_col_w, y + 16), "COLLECTION RATE", font_size=6.5, font_color=MUTED_GRAY, align=1, is_bold=True)
        draw_cell(page, pymupdf.Rect(margin_x, y + 16, margin_x + kpi_col_w, y + 32), f"{coll_rate:.1f}%", font_size=9.5, font_color=DARK_GRAY, align=1, is_bold=True)

        draw_cell(page, pymupdf.Rect(margin_x + kpi_col_w, y + 2, margin_x + 2 * kpi_col_w, y + 16), "OPERATING PROFIT MARGIN", font_size=6.5, font_color=MUTED_GRAY, align=1, is_bold=True)
        draw_cell(page, pymupdf.Rect(margin_x + kpi_col_w, y + 16, margin_x + 2 * kpi_col_w, y + 32), f"{profit_margin:.1f}%", font_size=9.5, font_color=DARK_GRAY, align=1, is_bold=True)

        draw_cell(page, pymupdf.Rect(margin_x + 2 * kpi_col_w, y + 2, page_width - margin_x, y + 16), "OUTSTANDING RECEIVABLES", font_size=6.5, font_color=MUTED_GRAY, align=1, is_bold=True)
        draw_cell(page, pymupdf.Rect(margin_x + 2 * kpi_col_w, y + 16, page_width - margin_x, y + 32), f"\u20b1{s['balance_due']:,.2f}", font_size=9.5, font_color=DARK_GRAY, align=1, is_bold=True)

    # Footers on all pages
    total_pages = len(doc)
    for p_idx in range(total_pages):
        add_page_footer(doc[p_idx], p_idx + 1, total_pages)

    pdf_bytes = doc.tobytes()
    doc.close()
    return pdf_bytes
