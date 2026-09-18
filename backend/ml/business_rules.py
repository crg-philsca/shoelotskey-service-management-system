"""Official Job Order release durations from the authoritative Shoelotskey Business Rules.

Source: Approved Business Combination Dominance Logic.
Decoupled from editable service codes and strictly non-additive.
"""
from typing import Dict, Iterable, List, Optional, Set, Tuple

# Baseline catalog durations
OFFICIAL_DURATION_DAYS = {
    "Basic Cleaning": 10,
    "Minor Reglue": 10,
    "Full Reglue": 25,
    "Color Renewal": 25,
    "Unyellowing": 20,
    "Sole Unyellowing": 20,
    "Minor Retouch": 20,
    "Minor Restoration": 20,
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
    "Add Glue Layer": 2,
}

NORMAL_MAX_DAYS = 25
SAFETY_CEILING_DAYS = 30
DEFAULT_RUSH_REDUCTION_DAYS = 9
MIN_DURATION_DAYS = 1

# Canonical service identities
CANONICAL_BC = "BC"
CANONICAL_MR = "MR"
CANONICAL_FR = "FR"
CANONICAL_COR = "COR"
CANONICAL_UNY = "UNY"
CANONICAL_MRES = "MRES"
CANONICAL_MRET = "MRET"

# Stable service_id to canonical identity mapping
STABLE_ID_TO_CANONICAL = {
    1: CANONICAL_BC,    # Basic Cleaning
    3: CANONICAL_FR,    # Full Reglue
    4: CANONICAL_MR,    # Minor Reglue
    6: CANONICAL_UNY,   # Unyellowing
    10: CANONICAL_MRET, # Minor Retouch
    41: CANONICAL_MRES, # Minor Restoration
    67: CANONICAL_COR,  # Color Renewal
    166: CANONICAL_FR,  # Full Reglue Midsole
    167: CANONICAL_FR,  # Full Reglue Undersole
    39: CANONICAL_FR,   # Undersole Full Reglue
    40: CANONICAL_FR,   # Midsole Full Reglue
}


def resolve_canonical_service(service_ref) -> Optional[str]:
    """
    Resolve a service reference (ID, dict, code, or name) to a stable canonical identity.
    Never relies solely on mutable display codes like 'CR' vs 'COR'.
    """
    if service_ref is None:
        return None

    # Handle dict (e.g. {"service_id": 67, "name": "Color Renewal"})
    if isinstance(service_ref, dict):
        sid = service_ref.get("service_id") or service_ref.get("id")
        if sid is not None:
            try:
                sid_int = int(sid)
                if sid_int in STABLE_ID_TO_CANONICAL:
                    return STABLE_ID_TO_CANONICAL[sid_int]
            except (ValueError, TypeError):
                pass
        name = service_ref.get("name") or service_ref.get("service_name") or service_ref.get("service_code")
        if name:
            return resolve_canonical_service(str(name))
        return None

    # Handle integer service_id directly
    if isinstance(service_ref, int):
        return STABLE_ID_TO_CANONICAL.get(service_ref)

    text = str(service_ref).strip()
    if not text:
        return None

    # If it's a numeric string ID
    if text.isdigit():
        sid_int = int(text)
        if sid_int in STABLE_ID_TO_CANONICAL:
            return STABLE_ID_TO_CANONICAL[sid_int]

    lowered = text.lower()

    # Exact or keyword mapping (ordered by specificity)
    if "full reglue" in lowered or ("reglue" in lowered and ("midsole" in lowered or "undersole" in lowered)) or "full restoration" in lowered:
        return CANONICAL_FR
    if "minor reglue" in lowered or lowered == "mr":
        return CANONICAL_MR
    if "color renewal" in lowered or "color restoration" in lowered or lowered in ("cor", "cr"):
        return CANONICAL_COR
    if "unyellowing" in lowered or lowered == "uny":
        return CANONICAL_UNY
    if "minor restoration" in lowered or lowered == "mres":
        return CANONICAL_MRES
    if "minor retouch" in lowered or lowered == "mret":
        return CANONICAL_MRET
    if "basic cleaning" in lowered or lowered == "bc":
        return CANONICAL_BC
    if lowered == "fr":
        return CANONICAL_FR

    return None


def calculate_pair_duration(
    canonical_services: Set[str],
    raw_services: List[str],
    duration_map: Optional[Dict[str, int]] = None
) -> int:
    """
    Authoritative non-additive duration rules for a single shoe/pair:
    - Any combination containing FR: 25 days (FR dominant)
    - BC + COR without FR: 25 days (COR dominant)
    - BC + MRES without FR/COR: 20 days (MRES dominant)
    - BC + UNY without FR/COR/MRES: 20 days (UNY dominant)
    - BC + MR without FR/COR/MRES/UNY: 10 days
    - MR standalone (without BC): 25 days
    - BC standalone: 10 days
    - Normal maximum: 25 days
    - Safety ceiling: 30 days
    - Never sum service durations.
    """
    if not canonical_services and not raw_services:
        return 0

    # 1. FR Dominant (any combination containing Full Reglue)
    if CANONICAL_FR in canonical_services:
        return 25

    # 2. Color Renewal Dominant (without FR)
    if CANONICAL_COR in canonical_services:
        return 25

    # 3. Minor Restoration Dominant (without FR/COR)
    if CANONICAL_MRES in canonical_services:
        return 20

    # 4. Unyellowing Dominant (without FR/COR/MRES)
    if CANONICAL_UNY in canonical_services:
        return 20

    # 5. Minor Retouch Dominant (without FR/COR)
    if CANONICAL_MRET in canonical_services:
        return 20

    # 6. BC + MR Combination
    if CANONICAL_MR in canonical_services and CANONICAL_BC in canonical_services:
        return 10

    # 6. Minor Reglue Standalone (without BC)
    if CANONICAL_MR in canonical_services:
        return 10

    # 7. Basic Cleaning Standalone
    if CANONICAL_BC in canonical_services:
        return 10

    # 8. Unrecognized / custom standalone services: take max catalog duration
    max_d = 0
    for s in raw_services:
        d = official_service_days(s, duration_map)
        if d > max_d:
            max_d = d

    capped = min(max_d if max_d > 0 else 10, NORMAL_MAX_DAYS)
    return min(capped, SAFETY_CEILING_DAYS)


def _as_name_list(value) -> List[str]:
    if value is None:
        return []
    if isinstance(value, str):
        # Support comma-separated strings
        if "," in value:
            return [p.strip() for p in value.split(",") if p.strip()]
        return [value] if value else []
    if not isinstance(value, list):
        return []
    names = []
    for item in value:
        if isinstance(item, dict):
            name = item.get("name") or item.get("service_name")
        else:
            name = item
        if name:
            names.append(str(name))
    return names


def _addon_pairs(value) -> List[Tuple[str, int]]:
    if value is None:
        return []
    if isinstance(value, str):
        if "," in value:
            return [(p.strip(), 1) for p in value.split(",") if p.strip()]
        return [(value, 1)] if value else []
    if not isinstance(value, list):
        return []
    pairs = []
    for item in value:
        if isinstance(item, dict):
            name = item.get("name") or item.get("service_name")
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
        for n in names:
            c = resolve_canonical_service(n)
            if c:
                flags["has_services"] = True
                if c == CANONICAL_BC:
                    flags["has_basic_cleaning"] = True
                elif c == CANONICAL_MR:
                    flags["has_minor_reglue"] = True
                elif c == CANONICAL_FR:
                    flags["has_full_reglue"] = True
                    flags["has_full_restoration"] = True
                elif c == CANONICAL_COR:
                    flags["has_color_renewal"] = True
                elif c == CANONICAL_UNY:
                    flags["has_unyellowing"] = True
                elif c == CANONICAL_MRES:
                    flags["has_minor_restoration"] = True
                elif c == CANONICAL_MRET:
                    flags["has_minor_retouch"] = True
            elif n:
                flags["has_services"] = True
    return flags


def combo_override_days(flags: Dict[str, bool]) -> Optional[int]:
    """Compatibility wrapper that maps flags to the canonical non-additive duration."""
    canonical_set = set()
    if flags.get("has_full_reglue") or flags.get("has_full_restoration"):
        canonical_set.add(CANONICAL_FR)
    if flags.get("has_color_renewal"):
        canonical_set.add(CANONICAL_COR)
    if flags.get("has_minor_restoration"):
        canonical_set.add(CANONICAL_MRES)
    if flags.get("has_unyellowing"):
        canonical_set.add(CANONICAL_UNY)
    if flags.get("has_minor_reglue"):
        canonical_set.add(CANONICAL_MR)
    if flags.get("has_basic_cleaning"):
        canonical_set.add(CANONICAL_BC)
    if flags.get("has_minor_retouch"):
        canonical_set.add(CANONICAL_MRET)
    if not canonical_set:
        return None
    return calculate_pair_duration(canonical_set, [])


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
    c = resolve_canonical_service(cleaned)
    if c == CANONICAL_FR:
        return 25
    if c == CANONICAL_COR:
        return 25
    if c == CANONICAL_MR:
        return 10
    if c == CANONICAL_UNY:
        return 20
    if c == CANONICAL_MRES:
        return 20
    if c == CANONICAL_BC:
        return 10
    if c == CANONICAL_MRET:
        return 20

    if duration_map and cleaned in duration_map:
        return parse_duration_days(duration_map[cleaned])
    if cleaned in OFFICIAL_DURATION_DAYS:
        return OFFICIAL_DURATION_DAYS[cleaned]
    return 0


def calculate_official_release_days(order_data: dict, duration_map: Optional[Dict[str, int]] = None) -> int:
    """
    Authoritative duration engine implementing exact non-additive combination rules.
    Computes maximum duration across pairs, then applies rush reduction if applicable.
    """
    items = order_data.get("items") or []
    if not items:
        return 0

    has_item_level_priority = any(
        (item.get("priorityLevel") or item.get("priority_level")) is not None
        for item in items
    )
    priority_str = str(order_data.get("priorityLevel") or "").strip().lower()

    if has_item_level_priority:
        longest_pair = 0
        has_any_service = False
        for item in items:
            raw_services: List[str] = []
            canonical_set: Set[str] = set()

            b_services = item.get("baseService")
            for s in _as_name_list(b_services):
                clean_s = s.strip()
                if clean_s:
                    raw_services.append(clean_s)
                    c = resolve_canonical_service(clean_s)
                    if c:
                        canonical_set.add(c)

            a_addons = item.get("addOns")
            for name, _qty in _addon_pairs(a_addons):
                clean_name = name.strip()
                if clean_name:
                    raw_services.append(clean_name)
                    c = resolve_canonical_service(clean_name)
                    if c:
                        canonical_set.add(c)

            if raw_services or canonical_set:
                has_any_service = True
                pair_days = calculate_pair_duration(canonical_set, raw_services, duration_map)
                
                item_prio = str(item.get("priorityLevel") or item.get("priority_level") or "regular").strip().lower()
                # Rush order only allowed for plain Basic Cleaning with no add-ons
                if item_prio == "rush" and canonical_set == {CANONICAL_BC} and len(raw_services) == 1:
                    rush_raw = item.get("rushReductionDays") or order_data.get("rushReductionDays", DEFAULT_RUSH_REDUCTION_DAYS)
                    try:
                        r_days = int(rush_raw) if rush_raw not in (None, "") else DEFAULT_RUSH_REDUCTION_DAYS
                    except (TypeError, ValueError):
                        r_days = DEFAULT_RUSH_REDUCTION_DAYS
                    pair_days = max(MIN_DURATION_DAYS, pair_days - r_days)
                    
                longest_pair = max(longest_pair, pair_days)

        if not has_any_service or longest_pair <= 0:
            return 0
        return min(longest_pair, SAFETY_CEILING_DAYS)

    longest_pair = 0
    has_any_service = False

    for item in items:
        raw_services: List[str] = []
        canonical_set: Set[str] = set()

        # Extract baseService
        b_services = item.get("baseService")
        for s in _as_name_list(b_services):
            clean_s = s.strip()
            if clean_s:
                raw_services.append(clean_s)
                c = resolve_canonical_service(clean_s)
                if c:
                    canonical_set.add(c)

        # Extract addOns
        a_addons = item.get("addOns")
        for name, _qty in _addon_pairs(a_addons):
            clean_name = name.strip()
            if clean_name:
                raw_services.append(clean_name)
                c = resolve_canonical_service(clean_name)
                if c:
                    canonical_set.add(c)

        if raw_services or canonical_set:
            has_any_service = True
            pair_days = calculate_pair_duration(canonical_set, raw_services, duration_map)
            longest_pair = max(longest_pair, pair_days)

    if not has_any_service or longest_pair <= 0:
        return 0

    # Priority adjustment
    priority_days = 0
    if priority_str == "rush":
        rush_raw = order_data.get("rushReductionDays", DEFAULT_RUSH_REDUCTION_DAYS)
        try:
            priority_days = -(int(rush_raw) if rush_raw not in (None, "") else DEFAULT_RUSH_REDUCTION_DAYS)
        except (TypeError, ValueError):
            priority_days = -DEFAULT_RUSH_REDUCTION_DAYS

    total_days = max(MIN_DURATION_DAYS, longest_pair + priority_days)
    return min(total_days, SAFETY_CEILING_DAYS)


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
