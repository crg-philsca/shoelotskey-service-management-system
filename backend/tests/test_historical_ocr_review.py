"""Historical OCR review: canonical Order IDs and row-level payment extraction."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import date

from historical.local_ocr_parser import (
    parse_raw_ocr_text,
    payment_discrepancy,
    resolve_original_and_discounted_totals,
)
from order_numbering import (
    format_order_id,
    is_canonical_order_id,
    is_placeholder_order_id,
    next_canonical_order_id,
    source_document_ref,
)


def test_canonical_format_matches_live_job_order_rule():
    assert format_order_id(date(2026, 8, 31), 5) == "ORD-2026-08-31-005"
    assert format_order_id(date(2024, 8, 16), 1) == "ORD-2024-08-16-001"
    assert is_canonical_order_id("ORD-2026-08-31-005")
    assert not is_canonical_order_id("UNKNOWN-7fa35a20")
    assert not is_canonical_order_id("OCR-abcdef123456")
    assert is_placeholder_order_id("UNKNOWN-7fa35a20")
    assert is_placeholder_order_id("OCR-7fa35a20abcd")
    assert not is_placeholder_order_id("ORD-2024-08-16-002")


def test_sequence_continues_from_highest_existing():
    existing = [
        "ORD-2024-08-16-001",
        "ORD-2024-08-16-003",
        "ORD-2024-08-15-009",
        "UNKNOWN-7fa35a20",
    ]
    nxt = next_canonical_order_id(date(2024, 8, 16), existing)
    assert nxt == "ORD-2024-08-16-004"
    first = next_canonical_order_id(date(2024, 8, 17), existing)
    assert first == "ORD-2024-08-17-001"


def test_reserved_ids_are_not_reused():
    existing = ["ORD-2024-08-16-001"]
    first = next_canonical_order_id(date(2024, 8, 16), existing, reserved=["ORD-2024-08-16-002"])
    assert first == "ORD-2024-08-16-003"


def test_source_document_ref_preserved_separately():
    assert source_document_ref("UNKNOWN-7fa35a20") == "UNKNOWN-7fa35a20"
    assert source_document_ref("UNKNOWN") is None
    assert source_document_ref("JO-12345") == "JO-12345"


def test_control_no_override_can_be_blank():
    from types import SimpleNamespace
    from api.historical_processing import stored_control_no, stored_source_document_ref

    order = SimpleNamespace(
        order_id="ORD-2025-08-15-004",
        audit_trail=[
            {"action": "ocr_import", "source_document_ref": "OCR-557fc8a5cb4c"},
            {"action": "control_no", "control_no": ""},
        ],
    )
    found, value = stored_control_no(order)
    assert found is True
    assert value == ""
    assert stored_source_document_ref(order) == "OCR-557fc8a5cb4c"

    order.audit_trail.append({"action": "control_no", "control_no": "JO-99"})
    found, value = stored_control_no(order)
    assert found is True
    assert value == "JO-99"
    assert stored_source_document_ref(order) == "OCR-557fc8a5cb4c"


SAMPLE_FORM = """
CONTROL NO: 8841
CLIENT NAME: Juan Dela Cruz
CONTACT NO: 09171234567
DATE RECEIVED: 2024-08-16
BRANCH: Villamor

Nike AF1 White 10 BC 450
Adidas Samba Black 9 BC 325
Puma Suede Red 8 BC 325

GRAND TOTAL: 1100
DP: 500
BALANCE: 600
PAYMENT: Cash
"""


GROUPED_SERVICE_FORM = """
CLIENT NAME: Maria Santos
DATE RECEIVED: 2024-08-16
BC
Nike Cortez 8 450
Adidas Gazelle 7 325
Puma Palermo 9 325
GRAND TOTAL: 1100
DOWNPAYMENT: 400
BALANCE: 700
CASH
"""


def test_row_level_prices_and_payment_section():
    extracted, _conf = parse_raw_ocr_text(SAMPLE_FORM, "test")
    assert extracted["date_received"] == "2025-08-16"
    assert extracted["customer_name"]
    assert extracted["downpayment"] == 500
    assert extracted["balance"] == 600
    assert extracted["grand_total"] == 1100
    assert extracted["payment_method"] == "Cash"
    prices = [i.get("item_price") for i in extracted["items"] if i.get("item_price") is not None]
    assert prices == [450.0, 325.0, 325.0]
    assert not any(
        str(s).lower() == "free"
        for item in extracted["items"]
        for s in (item.get("base_services") or [])
    )


def test_grouped_service_applies_only_to_following_item_rows():
    extracted, _conf = parse_raw_ocr_text(GROUPED_SERVICE_FORM, "test")
    items = extracted["items"]
    assert len(items) >= 2
    assert all(item.get("item_price") in (450.0, 325.0) for item in items)
    assert any("Basic Cleaning" in (item.get("base_services") or []) for item in items)
    assert extracted["downpayment"] == 400
    assert extracted["balance"] == 700


def test_discrepancy_warns_without_replacing_values():
    extracted = {
        "items": [{"item_price": 450}, {"item_price": 325}],
        "grand_total": 1100,
        "downpayment": 500,
        "balance": 600,
    }
    result = payment_discrepancy(extracted)
    assert result["has_discrepancy"] is True
    assert extracted["grand_total"] == 1100
    assert extracted["downpayment"] == 500
    assert extracted["balance"] == 600
    assert any("Payment discrepancy detected" in w for w in result["warnings"])


PROBLEM_DOCUMENT = """
CLIENT NAME: MORRIS ALTON GUZMAN
CONTACT NO: 0950 2371 626
DATE & TIME: 8/16
BRANCH: Villamor
1 PUMA SUEDE 9 BC + MRET 450
BC
2 PUMA WHITE/BLUE 9 325
3 PUMA WHITE 9 325
4 CONVERE WHITE 8 325
5 CONVERE BLACK 8.5 FREE
GRAND TOTAL: 1425.00
DP - 700.00 cash
Bal - 725.00
"""


def test_problem_document_row_prices_and_payments():
    extracted, _conf = parse_raw_ocr_text(PROBLEM_DOCUMENT, "test")
    assert extracted["date_received"] == "2025-08-16"
    assert extracted["downpayment"] == 700
    assert extracted["balance"] == 725
    assert extracted["grand_total"] == 1425
    assert extracted["payment_method"] == "Cash"
    prices = [i.get("item_price") for i in extracted["items"] if i.get("item_price") is not None]
    assert 450.0 in prices
    assert prices.count(325.0) >= 2
    assert 450.0 not in [p for p in prices if p != 450.0] or prices.count(450.0) == 1
    free_priced = [
        i for i in extracted["items"]
        if any(str(s).lower() == "free" for s in (i.get("base_services") or []))
        and i.get("item_price") in (450, 325, 450.0, 325.0)
    ]
    assert free_priced == []


def test_missing_payment_stays_null_not_zero():
    extracted, _conf = parse_raw_ocr_text("CLIENT NAME: Test\nDATE RECEIVED: 2024-01-01\n", "test")
    assert extracted["downpayment"] is None
    assert extracted["balance"] is None
    assert extracted["grand_total"] is None
    assert extracted["payment_method"] == "Cash"


def test_catalog_pair_price_bc_plus_mret():
    from historical.local_ocr_parser import compute_row_price

    catalog = {
        "basic cleaning": 325.0,
        "minor retouch": 125.0,
        "bc": 325.0,
        "mret": 125.0,
    }
    price, is_free = compute_row_price(["BC", "MRET"], catalog)
    assert price == 450.0
    assert is_free is False
    price, is_free = compute_row_price(["BC"], catalog)
    assert price == 325.0
    price, is_free = compute_row_price(["FREE"], catalog)
    assert price == 0.0
    assert is_free is True
    price, is_free = compute_row_price(["BC", "MRET"], catalog, extracted_price=450)
    assert price == 450.0


def test_suede_is_material_and_white_blue_is_color():
    from historical.local_ocr_parser import classify_shoe_fields, format_price_breakdown

    model, color, material = classify_shoe_fields("Suede", None, "Suede")
    assert model is None
    assert material == "Suede"
    assert color is None

    model, color, material = classify_shoe_fields("White/Blue", "White/Blue", None)
    assert model is None
    assert color == "White/Blue"
    assert material is None

    model, color, material = classify_shoe_fields("White", "White", None)
    assert model is None
    assert color == "White"

    catalog = {"basic cleaning": 325.0, "minor retouch": 125.0, "bc": 325.0, "mret": 125.0}
    assert format_price_breakdown(["BC", "MRET"], catalog) == "BC(325)+MRET(125)"
    assert format_price_breakdown(["BC"], catalog) == "BC(325)"


def test_addon_row_shows_written_uny_and_catalog_mr():
    from historical.local_ocr_parser import format_price_breakdown

    catalog = {"minor reglue": 125.0, "unyellowing": 125.0, "mr": 125.0, "uny": 125.0}
    assert format_price_breakdown(
        ["MR", "UNY"],
        catalog,
        row_total=529.25,
        addends=[401.25, 128],
    ) == "MR(125)+UNY(401.25)"
    assert format_price_breakdown(
        ["BC"],
        {"basic cleaning": 325.0, "bc": 325.0},
        row_total=276.25,
        stored_prices=[325],
    ) == "BC(276.25)"


def test_extract_item_claimed_date_from_remarks():
    from historical.local_ocr_parser import extract_item_claimed_date

    iso, cleaned = extract_item_claimed_date("claimed Gucci 8/19")
    assert iso == "2025-08-19"
    assert cleaned is None or "claimed" not in cleaned.lower()

    iso2, cleaned2 = extract_item_claimed_date("claimed 8/25")
    assert iso2 == "2025-08-25"

    iso3, cleaned3 = extract_item_claimed_date("yellowing on toe")
    assert iso3 is None
    assert cleaned3 == "yellowing on toe"


def test_row_price_sums_service_plus_addon_on_paper():
    from historical.local_ocr_parser import _line_item_price

    assert _line_item_price("AF 1 UNY / MR 401.25 + 128 =") == 529.25
    assert _line_item_price("Jordan Red/White BC 276.25") == 276.25


def test_historical_archive_year_aug_2025_jan_2026():
    from historical.local_ocr_parser import coerce_historical_archive_date

    assert str(coerce_historical_archive_date("2024-08-16")) == "2025-08-16"
    assert str(coerce_historical_archive_date("2025-08-16")) == "2025-08-16"
    assert str(coerce_historical_archive_date("2024-01-10")) == "2026-01-10"
    assert str(coerce_historical_archive_date("2025-12-01")) == "2025-12-01"
    extracted, _conf = parse_raw_ocr_text("DATE RECEIVED: 8/16\nCLIENT NAME: Test\n", "test")
    assert extracted["date_received"] == "2025-08-16"
    extracted, _conf = parse_raw_ocr_text("DATE RECEIVED: 1/10\nCLIENT NAME: Test\n", "test")
    assert extracted["date_received"] == "2026-01-10"
    extracted, _conf = parse_raw_ocr_text("DATE RECEIVED: 2024-08-16\nCLIENT NAME: Test\n", "test")
    assert extracted["date_received"] == "2025-08-16"


def test_claimed_and_expected_release_notes_are_extracted():
    extracted, _conf = parse_raw_ocr_text(
        "DATE & TIME: 8/17/2025\nCLIENT NAME: Kurt Solinan\n"
        "CONTACT NO: 09452774094\nBRANCH: Villamor\n"
        "BC 325\nGRAND TOTAL: 325\nClaimed 8/20\n",
        "test",
    )
    assert extracted["date_received"] == "2025-08-17"
    assert extracted["claimed_date"] == "2025-08-20"
    assert extracted["original_estimated_release_date"] is None

    extracted, _conf = parse_raw_ocr_text(
        "DATE RECEIVED: 8/17\nEST. RELEASE: 8/22\nCLIENT NAME: Test\nCLAIMED: 8/20\n",
        "test",
    )
    assert extracted["date_received"] == "2025-08-17"
    assert extracted["original_estimated_release_date"] == "2025-08-22"
    assert extracted["claimed_date"] == "2025-08-20"

    extracted, _conf = parse_raw_ocr_text(
        "DATE RECEIVED: 8/17\nEXPECTED RELEASE\n8/25\nCLIENT NAME: Test\n",
        "test",
    )
    assert extracted["original_estimated_release_date"] == "2025-08-25"


def test_expected_release_cannot_precede_received_and_claimed_is_set():
    from datetime import datetime
    from types import SimpleNamespace
    from api.historical_processing import normalize_historical_timeline

    item = SimpleNamespace(services=[
        SimpleNamespace(service_name="BC", service_type="base"),
        SimpleNamespace(service_name="MRET", service_type="base"),
    ])
    order = SimpleNamespace(
        date_received=datetime(2024, 8, 16),
        original_estimated_release_date=datetime(2024, 8, 3),
        claimed_date=None,
        completion_days=717,
        priority="regular",
        items=[item],
    )
    timeline = normalize_historical_timeline(order)
    assert str(timeline["date_received"]) == "2025-08-16"
    assert timeline["expected_release"] >= timeline["date_received"]
    assert timeline["claimed_date"] >= timeline["date_received"]
    assert 1 <= timeline["completion_days"] <= 60
    assert timeline["completion_days"] != 717


def test_empty_shoe_tokens_are_dropped():
    from historical.local_ocr_parser import classify_shoe_fields, clean_shoe_token

    assert clean_shoe_token(".") is None
    assert clean_shoe_token("n/a") is None
    model, color, material = classify_shoe_fields(".", ".", "")
    assert model is None
    assert color is None
    assert material is None
    model, color, material = classify_shoe_fields(None, "White/Blue", None)
    assert color == "White/Blue"
    assert material is None


def test_save_corrections_keeps_pending_queue_status():
    from types import SimpleNamespace
    from api.historical_processing import apply_queue_review_action
    from historical.ocr_status import PENDING_REVIEW, REJECTED

    img = SimpleNamespace(ocr_status=PENDING_REVIEW, processed_at=None)
    order = SimpleNamespace(
        ocr_status=PENDING_REVIEW,
        sync_status="pending",
        items=[],
        customer=None,
        audit_trail=[],
        date_received=None,
        claimed_date=None,
        original_estimated_release_date=None,
        completion_days=None,
        priority="regular",
        branch="Villamor",
    )
    result = apply_queue_review_action("save", img, order, {"branch": "Villamor"}, SimpleNamespace())
    assert result == "saved"
    assert img.ocr_status == PENDING_REVIEW
    assert order.ocr_status == PENDING_REVIEW

    still_pending = apply_queue_review_action("correct", img, order, {"priority": "regular"}, SimpleNamespace())
    assert still_pending == "saved"
    assert img.ocr_status == PENDING_REVIEW
    assert order.ocr_status == PENDING_REVIEW

    rejected = apply_queue_review_action("reject", img, order, {}, SimpleNamespace())
    assert rejected == REJECTED
    assert img.ocr_status == REJECTED
    assert order.ocr_status == REJECTED


def test_fr_plus_mres_uses_business_rule_not_summed_days():
    from datetime import datetime
    from types import SimpleNamespace
    from ml.business_rules import calculate_official_release_days
    from api.historical_processing import normalize_historical_timeline

    combo_days = calculate_official_release_days({
        "items": [{
            "baseService": ["Full Restoration"],
            "addOns": [{"name": "Minor Restoration", "quantity": 1}],
        }],
        "priorityLevel": "regular",
    })
    assert combo_days == 25
    coded = calculate_official_release_days({
        "items": [{"baseService": ["FR"], "addOns": ["MRES"]}],
        "priorityLevel": "regular",
    })
    assert coded == 25

    item = SimpleNamespace(services=[
        SimpleNamespace(service_name="FR", service_type="base"),
        SimpleNamespace(service_name="MRES", service_type="addon"),
    ])
    order = SimpleNamespace(
        date_received=datetime(2025, 8, 17),
        original_estimated_release_date=datetime(2025, 10, 6),
        claimed_date=datetime(2025, 10, 6),
        completion_days=50,
        priority="regular",
        items=[item],
    )
    timeline = normalize_historical_timeline(order)
    assert timeline["completion_days"] == 25
    assert str(timeline["date_received"]) == "2025-08-17"
    assert timeline["expected_release"] >= timeline["date_received"]
    assert (timeline["expected_release"] - timeline["date_received"]).days == 25
    assert timeline["claimed_date"] == timeline["expected_release"]


def test_explicit_completion_days_kept_after_timeline():
    from datetime import datetime
    from types import SimpleNamespace
    from api.historical_processing import apply_explicit_completion_days, apply_normalized_timeline

    item = SimpleNamespace(services=[
        SimpleNamespace(service_name="FR", service_type="base"),
        SimpleNamespace(service_name="MRES", service_type="addon"),
    ])
    order = SimpleNamespace(
        date_received=datetime(2025, 8, 17),
        original_estimated_release_date=datetime(2025, 9, 11),
        claimed_date=datetime(2025, 9, 11),
        completion_days=25,
        priority="regular",
        items=[item],
    )
    apply_normalized_timeline(order)
    apply_explicit_completion_days(
        order,
        30,
        claimed_date=datetime(2025, 9, 16),
        expected_release=datetime(2025, 9, 16),
    )
    assert order.completion_days == 30
    assert order.claimed_date.date().isoformat() == "2025-09-16"
    assert order.original_estimated_release_date.date().isoformat() == "2025-09-16"


def test_review_queue_starts_at_earliest_paper_date():
    from api.historical_processing import sort_review_queue

    items = [
        {"image_filename": "later.jpeg", "order": {"date_received": "2025-08-17", "order_id": "ORD-2025-08-17-002"}},
        {"image_filename": "CamScanner batch.pdf", "order": {"date_received": "2025-08-15", "order_id": "ORD-2025-08-15-009"}},
        {"image_filename": "aug15-b.jpeg", "order": {"date_received": "2025-08-15", "order_id": "ORD-2025-08-15-002"}},
        {"image_filename": "aug15-a.jpeg", "order": {"date_received": "2025-08-15", "order_id": "ORD-2025-08-15-001"}},
    ]
    sort_review_queue(items)
    assert items[0]["order"]["date_received"] == "2025-08-15"
    assert items[0]["image_filename"] == "aug15-a.jpeg"
    assert items[2]["image_filename"] == "CamScanner batch.pdf"
    assert items[-1]["order"]["date_received"] == "2025-08-17"


def test_service_codes_roll_up_to_full_names():
    from collections import Counter
    from historical.local_ocr_parser import (
        canonical_service_display_name,
        expand_service_names_for_analytics,
    )

    assert canonical_service_display_name("BC") == "Basic Cleaning"
    assert canonical_service_display_name("Basic Cleaning") == "Basic Cleaning"
    assert canonical_service_display_name("FR") == "Full Reglue"
    assert canonical_service_display_name("MR") == "Minor Reglue"
    assert canonical_service_display_name("MRET") == "Minor Retouch"
    assert canonical_service_display_name("MRes") == "Minor Restoration"
    assert canonical_service_display_name("UNY") == "Unyellowing"
    assert canonical_service_display_name("BC - Rush") == "Basic Cleaning"
    assert canonical_service_display_name("MR 6") == "Minor Reglue"
    assert expand_service_names_for_analytics("UNY - BC") == ["Unyellowing", "Basic Cleaning"]

    freq = Counter()
    for raw in ["Basic Cleaning", "BC", "BC", "Full Reglue", "FR", "FR", "Minor Restoration", "MR", "MRET"]:
        for name in expand_service_names_for_analytics(raw):
            freq[name] += 1
    assert freq["Basic Cleaning"] == 3
    assert freq["Full Reglue"] == 3
    assert freq["Minor Reglue"] == 1
    assert freq["Minor Restoration"] == 1
    assert freq["Minor Retouch"] == 1
    assert "BC" not in freq
    assert "FR" not in freq
    assert "MR" not in freq
    assert "MRET" not in freq


def test_serialize_historical_order_includes_image_and_contact():
    from datetime import datetime
    from types import SimpleNamespace

    from api.historical_processing import serialize_historical_order

    order = SimpleNamespace(
        historical_order_id=1,
        order_id="ORD-2025-08-17-001",
        customer=SimpleNamespace(customer_name="Kathleen B. Pedrosa", contact_number="09171234567"),
        image=SimpleNamespace(image_filename="form.jpeg", image_path="source/form.jpeg", ocr_status="Validated"),
        branch="Villamor",
        date_received=datetime(2025, 8, 17),
        original_estimated_release_date=datetime(2025, 9, 11),
        claimed_date=datetime(2025, 9, 11),
        completion_days=25,
        total_pairs=1,
        grand_total=800,
        downpayment=0,
        balance=0,
        priority="regular",
        payment_method="Cash",
        sync_status="synced",
        ocr_status="Validated",
        items=[],
    )
    out = serialize_historical_order(order, {})
    assert out["contact_number"] == "09171234567"
    assert out["image"]["image_filename"] == "form.jpeg"
    assert serialize_historical_order(SimpleNamespace(**{**order.__dict__, "image": None}), {})["image"] is None


def test_brand_aliases_nb_and_mk():
    from historical.local_ocr_parser import canonical_brand_name, match_brand_in_text, parse_raw_ocr_text

    assert canonical_brand_name("NB") == "New Balance"
    assert canonical_brand_name("nb") == "New Balance"
    assert canonical_brand_name("MK") == "Michael Kors"
    assert match_brand_in_text("NB 927 size 12 Black FR 575") == "New Balance"

    text = """
CONTROL NO: 082002
CLIENT NAME: BONNE DADIS
DATE & TIME: 8/15 1134
BRANCH: Villamor
1 Tiger Onitsuka White Blue size 12 BC Free
2 Onitsuka Mexico 66 11 BC 325
3 Onitsuka Gray size 12 FR 575
4 NB 927 size 12 Black FR 575
GRAND TOTAL: 1475.00
Fully paid cash
"""
    extracted, _ = parse_raw_ocr_text(text, "bonne")
    assert extracted.get("order_id") in (None, "082002") or str(extracted.get("order_id", "")).endswith("082002")
    # date + time from paper
    assert "2025-08-15" in str(extracted.get("date_received") or "")
    brands = [i.get("brand") for i in extracted["items"]]
    assert any(b == "New Balance" for b in brands)
    free_rows = [i for i in extracted["items"] if i.get("is_free") or i.get("item_price") == 0]
    assert free_rows, "BC Free row should be marked FREE at ₱0"
    assert free_rows[0].get("item_price") == 0.0
    # Service stays on complimentary BC rows
    assert any(
        "Basic Cleaning" in (i.get("base_services") or []) or "BC" in (i.get("base_services") or [])
        for i in free_rows
    )


def test_bc_free_keeps_service_price_zero():
    from historical.local_ocr_parser import compute_row_price

    catalog = {"basic cleaning": 325.0, "bc": 325.0}
    price, is_free = compute_row_price(["BC"], catalog, extracted_price="Free")
    assert price == 0.0 and is_free is True
    price, is_free = compute_row_price(["BC"], catalog, extracted_price=0)
    assert price == 0.0 and is_free is True
    # Without FREE signal, catalog price applies
    price, is_free = compute_row_price(["BC"], catalog)
    assert price == 325.0 and is_free is False


def test_multi_fr_pairs_use_longest_not_sum():
    from ml.business_rules import calculate_official_release_days

    days = calculate_official_release_days({
        "priorityLevel": "regular",
        "items": [
            {"baseService": ["Full Reglue"], "addOns": []},
            {"baseService": ["Full Reglue"], "addOns": []},
            {"baseService": ["Basic Cleaning"], "addOns": []},
        ],
    })
    assert days == 25, f"two FR pairs should be 25 days (longest), got {days}"


def test_original_vs_discounted_grand_total():
    """Paper: item sum 650, discount -97.50, final 552.50 — not balance = 650."""
    text = """
SHOE INVENTORY FORM
TOTAL 650
-97.50
552.50
Cash
"""
    items = [{"item_price": 325.0}, {"item_price": 325.0}]
    payments = {"grand_total": 650.0, "discount": 97.50, "discounted_grand_total": 552.50, "balance": 650.0}
    resolved = resolve_original_and_discounted_totals(text, payments, items)
    assert resolved["original_grand_total"] == 650.0
    assert resolved["grand_total"] == 552.50
    assert resolved["discount"] == 97.50

    extracted, _ = parse_raw_ocr_text(text, "bonne")
    assert extracted.get("original_grand_total") == 650.0
    assert extracted.get("grand_total") == 552.50
    # Balance must not keep the pre-discount subtotal when it was a false OCR read
    bal = extracted.get("balance")
    if bal is not None:
        assert abs(float(bal) - 650.0) > 0.009
