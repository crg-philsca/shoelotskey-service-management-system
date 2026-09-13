"""Official Job Order release durations from the deployed Shoelotskey form.

Source: origin/main + live https://www.shoelotskey-villamor-pasay.app/job-order-form
(`mlBreakdown` in JobOrderForm). Random Forest is not used here.
"""
from typing import Dict, Iterable, List, Optional, Tuple

# Live production /api/services catalog used by the deployed form fallback.
OFFICIAL_DURATION_DAYS = {
    "Basic Cleaning": 10,
    "Minor Reglue": 25,
    "Full Reglue": 25,
    "Color Renewal": 25,
    "Unyellowing": 5,
    "Sole Unyellowing": 5,
    "Minor Retouch": 0,
    "Minor Restoration": 0,
    "Full Restoration": 25,
    "White Paint": 0,
    "2 Colors": 0,
    "3 Colors": 0,
    "Midsole Full Reglue": 25,
    "Undersole Full Reglue": 25,
    "Full Reglue Midsole": 25,
    "Full Reglue Undersole": 25,
    "Midsole": 25,
    "Undersole": 25,
    "Add Glue Layer": 0,
}

DEFAULT_RUSH_REDUCTION_DAYS = 9
MIN_DURATION_DAYS = 1


def _as_name_list(value) -> List[str]:
    if value is None:
        return []
    if isinstance(value, str):
        return [value] if value else []
    if not isinstance(value, list):
        return []
    names = []
    for item in value:
        if isinstance(item, dict):
            name = item.get("name")
        else:
            name = item
        if name:
            names.append(str(name))
    return names


def _addon_pairs(value) -> List[Tuple[str, int]]:
    if value is None:
        return []
    if isinstance(value, str):
        return [(value, 1)] if value else []
    if not isinstance(value, list):
        return []
    pairs = []
    for item in value:
        if isinstance(item, dict):
            name = item.get("name")
            qty = item.get("quantity") or 1
        else:
            name = item
            qty = 1
        if name:
            try:
                qty_int = int(qty)
            except (TypeError, ValueError):
                qty_int = 1
            pairs.append((str(name), qty_int))
    return pairs


def collect_service_flags(items: Iterable[dict]) -> Dict[str, bool]:
    flags = {
        "has_basic_cleaning": False,
        "has_minor_reglue": False,
        "has_full_reglue": False,
        "has_color_renewal": False,
        "has_unyellowing": False,
        "has_minor_restoration": False,
        "has_full_restoration": False,
        "has_minor_retouch": False,
        "has_services": False,
    }
    for item in items or []:
        names = _as_name_list(item.get("baseService")) + [n for n, _q in _addon_pairs(item.get("addOns"))]
        if names:
            flags["has_services"] = True
        if "Basic Cleaning" in names:
            flags["has_basic_cleaning"] = True
        if "Minor Reglue" in names:
            flags["has_minor_reglue"] = True
        if (
            "Full Reglue" in names
            or any(
                n in ("Full Reglue Midsole", "Full Reglue Undersole", "Midsole Full Reglue", "Undersole Full Reglue", "Midsole", "Undersole")
                or ("full reglue" in n.lower() and ("midsole" in n.lower() or "undersole" in n.lower()))
                for n in names
            )
        ):
            flags["has_full_reglue"] = True
        if "Color Renewal" in names:
            flags["has_color_renewal"] = True
        if "Unyellowing" in names:
            flags["has_unyellowing"] = True
        if "Minor Restoration" in names or "MRES" in names:
            flags["has_minor_restoration"] = True
        if "Full Restoration" in names or "FR" in names:
            flags["has_full_restoration"] = True
        if "Minor Retouch" in names:
            flags["has_minor_retouch"] = True
    return flags


def combo_override_days(flags: Dict[str, bool]) -> Optional[int]:
    """Exact deployed form combination table."""
    if flags.get("has_basic_cleaning"):
        if flags.get("has_color_renewal") or flags.get("has_full_reglue"):
            return 25
        if flags.get("has_minor_restoration") or flags.get("has_minor_retouch"):
            return 20
        if flags.get("has_unyellowing"):
            return 15
        if flags.get("has_minor_reglue"):
            return 25
    if (
        (flags.get("has_full_restoration") or flags.get("has_full_reglue"))
        and flags.get("has_minor_restoration")
    ):
        return 25
    elif (flags.get("has_full_reglue") or flags.get("has_color_renewal")) and flags.get("has_unyellowing"):
        return 25
    return None


def parse_duration_days(val) -> int:
    if val is None or val == "":
        return 0
    if isinstance(val, (int, float)):
        return int(val)
    text = str(val).strip()
    if "-" in text:
        parts = [int(p.strip()) for p in text.split("-") if p.strip().lstrip("-").isdigit()]
        return max(parts) if parts else 0
    try:
        return int(float(text))
    except (TypeError, ValueError):
        return 0


def official_service_days(name: str, duration_map: Optional[Dict[str, int]] = None) -> int:
    cleaned = (name or "").strip()
    lowered = cleaned.lower()
    if (
        cleaned in ("Full Reglue Midsole", "Full Reglue Undersole", "Midsole Full Reglue", "Undersole Full Reglue", "Midsole", "Undersole")
        or ("full reglue" in lowered and ("midsole" in lowered or "undersole" in lowered))
    ):
        return 25
    if duration_map and cleaned in duration_map:
        return parse_duration_days(duration_map[cleaned])
    if cleaned in OFFICIAL_DURATION_DAYS:
        return OFFICIAL_DURATION_DAYS[cleaned]
    if cleaned in ("Full Restoration", "FR"):
        return 25
    if cleaned == "Basic Cleaning":
        return 10
    if "reglue" in lowered or "color renewal" in lowered:
        return 25
    return 0


def calculate_official_release_days(order_data: dict, duration_map: Optional[Dict[str, int]] = None) -> int:
    items = order_data.get("items") or []
    flags = collect_service_flags(items)
    if not flags["has_services"]:
        return 0

    priority_days = 0
    if str(order_data.get("priorityLevel") or "").lower() == "rush":
        rush_raw = order_data.get("rushReductionDays", DEFAULT_RUSH_REDUCTION_DAYS)
        try:
            priority_days = -(int(rush_raw) if rush_raw not in (None, "") else DEFAULT_RUSH_REDUCTION_DAYS)
        except (TypeError, ValueError):
            priority_days = -DEFAULT_RUSH_REDUCTION_DAYS

    longest_pair = 0
    for item in items:
        services_arr = _as_name_list(item.get("baseService"))
        has_duration_inclusive = any(
            "reglue" in (s or "").lower() or "color renewal" in (s or "").lower()
            for s in services_arr
        )
        filtered = [s for s in services_arr if (s or "").strip() != "Basic Cleaning"] if has_duration_inclusive else services_arr
        has_reglue_base = any(
            "reglue" in (s or "").lower()
            for s in services_arr
        )
        pair_base_days = 0
        for service_name in filtered:
            days = official_service_days(service_name, duration_map)
            d = days if days else (10 if (service_name or "").strip() == "Basic Cleaning" else 25)
            pair_base_days = max(pair_base_days, d)
        pair_days = pair_base_days

        reglue_addon_accounted = False
        for addon_name, qty in _addon_pairs(item.get("addOns")):
            cleaned_addon = (addon_name or "").strip()
            lowered_addon = cleaned_addon.lower()
            is_reglue_part = (
                cleaned_addon in ("Full Reglue Midsole", "Full Reglue Undersole", "Midsole Full Reglue", "Undersole Full Reglue", "Midsole", "Undersole")
                or ("full reglue" in lowered_addon and ("midsole" in lowered_addon or "undersole" in lowered_addon))
                or ("reglue" in lowered_addon and ("midsole" in lowered_addon or "undersole" in lowered_addon))
            )
            if is_reglue_part:
                if has_reglue_base:
                    continue
                if not reglue_addon_accounted:
                    pair_days = max(pair_days, official_service_days(cleaned_addon, duration_map))
                    reglue_addon_accounted = True
                continue
            pair_days += official_service_days(cleaned_addon, duration_map) * int(qty or 1)
        longest_pair = max(longest_pair, pair_days)

    return max(MIN_DURATION_DAYS, longest_pair + priority_days)


def color_count_conflict_message(items) -> Optional[str]:
    """Color Renewal add-ons 2 Colors and 3 Colors are mutually exclusive."""
    for item in items or []:
        names = []
        for addon in (item.get("addOns") or []):
            name = addon.get("name") if isinstance(addon, dict) else addon
            if name:
                names.append(name)
        if "2 Colors" in names and "3 Colors" in names:
            return "Color Renewal can use either 2 Colors or 3 Colors, not both."
    return None
