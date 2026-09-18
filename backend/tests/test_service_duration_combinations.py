import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from ml.business_rules import (
    calculate_official_release_days,
    resolve_canonical_service,
    CANONICAL_BC,
    CANONICAL_MR,
    CANONICAL_FR,
    CANONICAL_COR,
    CANONICAL_UNY,
    CANONICAL_MRES,
    CANONICAL_MRET,
)


class TestServiceDurationCombinations(unittest.TestCase):
    def test_canonical_service_resolver(self):
        """Test canonical resolution across IDs, display codes, and names."""
        # By ID
        self.assertEqual(resolve_canonical_service(1), CANONICAL_BC)
        self.assertEqual(resolve_canonical_service(3), CANONICAL_FR)
        self.assertEqual(resolve_canonical_service(4), CANONICAL_MR)
        self.assertEqual(resolve_canonical_service(6), CANONICAL_UNY)
        self.assertEqual(resolve_canonical_service(10), CANONICAL_MRET)
        self.assertEqual(resolve_canonical_service(41), CANONICAL_MRES)
        self.assertEqual(resolve_canonical_service(67), CANONICAL_COR)

        # By mutable/editable display code
        self.assertEqual(resolve_canonical_service("CR"), CANONICAL_COR)
        self.assertEqual(resolve_canonical_service("COR"), CANONICAL_COR)
        self.assertEqual(resolve_canonical_service("Cor"), CANONICAL_COR)
        self.assertEqual(resolve_canonical_service("BC"), CANONICAL_BC)
        self.assertEqual(resolve_canonical_service("MR"), CANONICAL_MR)
        self.assertEqual(resolve_canonical_service("FR"), CANONICAL_FR)
        self.assertEqual(resolve_canonical_service("UNY"), CANONICAL_UNY)
        self.assertEqual(resolve_canonical_service("MRES"), CANONICAL_MRES)
        self.assertEqual(resolve_canonical_service("MRET"), CANONICAL_MRET)

        # By service names
        self.assertEqual(resolve_canonical_service("Basic Cleaning"), CANONICAL_BC)
        self.assertEqual(resolve_canonical_service("Minor Reglue"), CANONICAL_MR)
        self.assertEqual(resolve_canonical_service("Full Reglue"), CANONICAL_FR)
        self.assertEqual(resolve_canonical_service("Color Renewal"), CANONICAL_COR)
        self.assertEqual(resolve_canonical_service("Color Restoration"), CANONICAL_COR)
        self.assertEqual(resolve_canonical_service("Unyellowing"), CANONICAL_UNY)
        self.assertEqual(resolve_canonical_service("Sole Unyellowing"), CANONICAL_UNY)
        self.assertEqual(resolve_canonical_service("Minor Restoration"), CANONICAL_MRES)
        self.assertEqual(resolve_canonical_service("Minor Retouch"), CANONICAL_MRET)
        self.assertEqual(resolve_canonical_service("Midsole Full Reglue"), CANONICAL_FR)

    def test_required_combination_durations(self):
        """Test all 12 required non-additive combinations."""
        # 1. BC alone -> 10 days
        self.assertEqual(
            calculate_official_release_days({"items": [{"baseService": ["Basic Cleaning"]}]}),
            10,
        )

        # 2. BC + MR -> 10 days
        self.assertEqual(
            calculate_official_release_days(
                {"items": [{"baseService": ["Basic Cleaning", "Minor Reglue"]}]}
            ),
            10,
        )

        # 3. BC + UNY -> 20 days
        self.assertEqual(
            calculate_official_release_days(
                {
                    "items": [
                        {
                            "baseService": ["Basic Cleaning"],
                            "addOns": [{"name": "Unyellowing", "quantity": 1}],
                        }
                    ]
                }
            ),
            20,
        )

        # 4. BC + MRES -> 20 days
        self.assertEqual(
            calculate_official_release_days(
                {
                    "items": [
                        {
                            "baseService": ["Basic Cleaning"],
                            "addOns": [{"name": "Minor Restoration", "quantity": 1}],
                        }
                    ]
                }
            ),
            20,
        )

        # 5. BC + FR -> 25 days
        self.assertEqual(
            calculate_official_release_days(
                {"items": [{"baseService": ["Basic Cleaning", "Full Reglue"]}]}
            ),
            25,
        )

        # 6. BC + Color Renewal -> 25 days
        self.assertEqual(
            calculate_official_release_days(
                {"items": [{"baseService": ["Basic Cleaning", "Color Renewal"]}]}
            ),
            25,
        )

        # 7. BC + FR + UNY -> 25 days
        self.assertEqual(
            calculate_official_release_days(
                {
                    "items": [
                        {
                            "baseService": ["Basic Cleaning", "Full Reglue"],
                            "addOns": [{"name": "Unyellowing", "quantity": 1}],
                        }
                    ]
                }
            ),
            25,
        )

        # 8. BC + FR + COR -> 25 days
        self.assertEqual(
            calculate_official_release_days(
                {
                    "items": [
                        {
                            "baseService": ["Basic Cleaning", "Full Reglue", "Color Renewal"],
                        }
                    ]
                }
            ),
            25,
        )

        # 9. BC + FR + MRES -> 25 days
        self.assertEqual(
            calculate_official_release_days(
                {
                    "items": [
                        {
                            "baseService": ["Basic Cleaning", "Full Reglue"],
                            "addOns": [{"name": "Minor Restoration", "quantity": 1}],
                        }
                    ]
                }
            ),
            25,
        )

        # 10. BC + FR + MRET -> 25 days
        self.assertEqual(
            calculate_official_release_days(
                {
                    "items": [
                        {
                            "baseService": ["Basic Cleaning", "Full Reglue"],
                            "addOns": [{"name": "Minor Retouch", "quantity": 1}],
                        }
                    ]
                }
            ),
            25,
        )

        # 11. BC + COR + MRES -> 25 days
        self.assertEqual(
            calculate_official_release_days(
                {
                    "items": [
                        {
                            "baseService": ["Basic Cleaning", "Color Renewal"],
                            "addOns": [{"name": "Minor Restoration", "quantity": 1}],
                        }
                    ]
                }
            ),
            25,
        )

        # 12. BC + COR + MRES + MRET -> 25 days
        self.assertEqual(
            calculate_official_release_days(
                {
                    "items": [
                        {
                            "baseService": ["Basic Cleaning", "Color Renewal"],
                            "addOns": [
                                {"name": "Minor Restoration", "quantity": 1},
                                {"name": "Minor Retouch", "quantity": 1},
                            ],
                        }
                    ]
                }
            ),
            25,
        )

    def test_negative_cases(self):
        """Explicitly assert against all disallowed additive results."""
        # BC + MR must NOT become 35
        bc_mr = calculate_official_release_days(
            {"items": [{"baseService": ["Basic Cleaning", "Minor Reglue"]}]}
        )
        self.assertNotEqual(bc_mr, 35)
        self.assertEqual(bc_mr, 10)

        # BC + UNY must NOT become 30 or 15
        bc_uny = calculate_official_release_days(
            {
                "items": [
                    {
                        "baseService": ["Basic Cleaning"],
                        "addOns": [{"name": "Unyellowing", "quantity": 1}],
                    }
                ]
            }
        )
        self.assertNotEqual(bc_uny, 30)
        self.assertNotEqual(bc_uny, 15)
        self.assertEqual(bc_uny, 20)

        # BC + FR + UNY must NOT become 55
        bc_fr_uny = calculate_official_release_days(
            {
                "items": [
                    {
                        "baseService": ["Basic Cleaning", "Full Reglue"],
                        "addOns": [{"name": "Unyellowing", "quantity": 1}],
                    }
                ]
            }
        )
        self.assertNotEqual(bc_fr_uny, 55)
        self.assertEqual(bc_fr_uny, 25)

        # BC + COR + MRES + MRET must NOT become 80
        bc_cor_mres_mret = calculate_official_release_days(
            {
                "items": [
                    {
                        "baseService": ["Basic Cleaning", "Color Renewal"],
                        "addOns": [
                            {"name": "Minor Restoration", "quantity": 1},
                            {"name": "Minor Retouch", "quantity": 1},
                        ],
                    }
                ]
            }
        )
        self.assertNotEqual(bc_cor_mres_mret, 80)
        self.assertEqual(bc_cor_mres_mret, 25)

        # BC + MR must NOT become 20
        self.assertNotEqual(bc_mr, 20)

        # MR standalone must NOT become 25
        mr_standalone = calculate_official_release_days(
            {"items": [{"baseService": ["Minor Reglue"]}]}
        )
        self.assertNotEqual(mr_standalone, 25)
        self.assertEqual(mr_standalone, 10)

    def test_standalone_services(self):
        """MR standalone = 10 days, BC standalone = 10 days."""
        self.assertEqual(
            calculate_official_release_days({"items": [{"baseService": ["Minor Reglue"]}]}),
            10,
        )
        self.assertEqual(
            calculate_official_release_days({"items": [{"baseService": ["Basic Cleaning"]}]}),
            10,
        )

    def test_multipair_max_duration(self):
        """Multi-pair orders take the maximum pair duration, never the sum."""
        # Pair 1: BC (10), Pair 2: FR (25), Pair 3: UNY (20) -> max is 25, not 55
        multi_order = {
            "items": [
                {"baseService": ["Basic Cleaning"]},
                {"baseService": ["Full Reglue"]},
                {"baseService": ["Unyellowing"]},
            ]
        }
        res = calculate_official_release_days(multi_order)
        self.assertEqual(res, 25)
        self.assertNotEqual(res, 55)

    def test_code_change_cr_to_cor_stability(self):
        """Changing code from CR to COR does not affect duration."""
        res_cr = calculate_official_release_days(
            {"items": [{"baseService": ["BC", "CR"]}]}
        )
        res_cor = calculate_official_release_days(
            {"items": [{"baseService": ["BC", "COR"]}]}
        )
        self.assertEqual(res_cr, 25)
        self.assertEqual(res_cor, 25)

    def test_rush_priority_reduction(self):
        """Rush priority reduces release days by rushReductionDays, minimum 1 day."""
        # BC (10 days) + Rush (reduction 9) -> 1 day
        res_rush_bc = calculate_official_release_days(
            {
                "priorityLevel": "rush",
                "rushReductionDays": 9,
                "items": [{"baseService": ["Basic Cleaning"]}],
            }
        )
        self.assertEqual(res_rush_bc, 1)

        # Full Reglue (25 days) + Rush (reduction 9) -> 16 days
        res_rush_fr = calculate_official_release_days(
            {
                "priorityLevel": "rush",
                "rushReductionDays": 9,
                "items": [{"baseService": ["Full Reglue"]}],
            }
        )
        self.assertEqual(res_rush_fr, 16)


if __name__ == "__main__":
    unittest.main()
