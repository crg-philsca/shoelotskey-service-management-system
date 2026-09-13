import os
import sys
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from report_service import generate_report_pdf

def test_generate_pdf_reports():
    mock_data = {
        "summary": {
            "total_sales": 12500.0,
            "sales": 12500.0,
            "refunds_issued": 0.0,
            "net_sales": 12500.0,
            "retained_deposits": 0.0,
            "orders_count": 15,
            "payments_received": 11000.0,
            "balance_due": 1500.0,
            "total_expenses": 4200.0,
            "inventory_expenses": 2000.0,
            "operating_expenses": 1800.0,
            "other_expenses": 400.0,
            "net_profit": 8300.0,
            "roi_percentage": 197.6,
            "roi_display": "197.6%"
        },
        "period_label": "Month to Date",
        "generated_at": "2026-09-12 15:00:00",
        "sales_details": [
            {
                "order_number": "ORD-2026-001",
                "transaction_date": "2026-09-10 14:00",
                "customer_name": "Juan Dela Cruz",
                "customer_contact": "09123456789",
                "shoe_details": "Nike Air Jordan 1",
                "priority": "Regular",
                "services": "Basic Cleaning, Minor Reglue",
                "grand_total": 1500.0,
                "amount_paid": 1500.0,
                "balance_due": 0.0,
                "status": "Completed",
                "payment_method": "Cash",
                "payment_status": "Paid",
                "is_eligible": True
            }
        ],
        "expenses_details": [
            {
                "expense_date": "2026-09-10 10:00",
                "category": "Supplies",
                "group": "Inventory Expenses",
                "description": "Shoe cleaner bottles",
                "amount": 2000.0
            }
        ]
    }

    for r_type in ["Sales", "Expenses", "ROI"]:
        pdf_bytes = generate_report_pdf(mock_data, r_type)
        assert len(pdf_bytes) > 1000
        assert pdf_bytes.startswith(b"%PDF")
        print(f"Generated {r_type} PDF: {len(pdf_bytes)} bytes")

if __name__ == "__main__":
    test_generate_pdf_reports()
    print("ALL PDF TESTS PASSED")
