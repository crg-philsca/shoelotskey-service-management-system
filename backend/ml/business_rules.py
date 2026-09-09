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
    "Minor Retouch": 5,
    "Minor Restoration": 25,
    "Full Restoration": 25,
    "White Paint": 0,
    "2 Colors": 0,
    "3 Colors": 0,
    "Midsole Full Reglue": 20,
    "Undersole Full Reglue": 20,
    "Midsole": 20,
    "Undersole": 20,
    "Add Glue Layer": 2,
}

DEFAULT_RUSH_REDUCTION_DAYS = 9
MIN_DURATION_DAYS = 3


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
            qty = item.get("quantity", 1)
        else:
            name = item
            qty = 1
        if name:
            try:
                qty_int = int(qty or 1)
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
        if "Full Reglue" in names:
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
            return 10
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
    if duration_map and name in duration_map:
        return parse_duration_days(duration_map[name])
    if name in OFFICIAL_DURATION_DAYS:
        return OFFICIAL_DURATION_DAYS[name]
    if name in ("Full Restoration", "FR"):
        return 25
    if name == "Basic Cleaning":
        return 10
    lowered = (name or "").lower()
    if "reglue" in lowered or "color renewal" in lowered:
        return 25
    return 0


def calculate_official_release_days(order_data: dict, duration_map: Optional[Dict[str, int]] = None) -> int:
    items = order_data.get("items") or []
    flags = collect_service_flags(items)
    if not flags["has_services"]:
        return 0

    overridden = combo_override_days(flags)
    if overridden is not None:
        return max(MIN_DURATION_DAYS, overridden)

    longest_pair = 0
    for item in items:
        services_arr = _as_name_list(item.get("baseService"))
        has_duration_inclusive = any(
            "reglue" in (s or "").lower() or "color renewal" in (s or "").lower()
            for s in services_arr
        )
        filtered = [s for s in services_arr if s != "Basic Cleaning"] if has_duration_inclusive else services_arr
        pair_days = 0
        for service_name in filtered:
            days = official_service_days(service_name, duration_map)
            pair_days += days if days else (10 if service_name == "Basic Cleaning" else 25)
        for addon_name, qty in _addon_pairs(item.get("addOns")):
            pair_days += official_service_days(addon_name, duration_map) * int(qty or 1)
        longest_pair = max(longest_pair, pair_days)

    priority_days = 0
    if str(order_data.get("priorityLevel") or "").lower() == "rush":
        rush_raw = order_data.get("rushReductionDays", DEFAULT_RUSH_REDUCTION_DAYS)
        try:
            priority_days = -(int(rush_raw) if rush_raw not in (None, "") else DEFAULT_RUSH_REDUCTION_DAYS)
        except (TypeError, ValueError):
            priority_days = -DEFAULT_RUSH_REDUCTION_DAYS

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
