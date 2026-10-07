# ML Evaluator Requirement Evidence Package
**Generated**: 2026-10-06 00:54:05
**Repository**: Shoelotskey Service Management System
**Evaluator Requirement**: Document complete Random Forest hyperparameter search space, selected parameters, and exact cross-validation results.

## Evidence Artifacts Inventory

| Artifact Name | Format | Purpose | SHA-256 Hash |
| :--- | :--- | :--- | :--- |
| `ml_evaluator_hyperparameter_cv_evidence_report.html` | HTML | Standalone comprehensive academic evidence report | `05108784f65b891806c45de62a13469a963617c8a48c4cb2ea90b359c7622300` |
| `rf_hyperparameter_search_evidence.json` | JSON | Machine-readable hyperparameter search space & parameter choices | `4d459fa3919d5d3d5dca4ca71650cd23000b7e030dfbd43ad682d1b9833af6a9` |
| `dataset_a_expanding_window_cv_results.csv` | CSV | 5-Fold expanding-window CV results table for manuscript | `e5a3bc9520345d43b42d48f366431bbb77dde9905fce9d8b375e43d6dedfb7b4` |
| `dataset_a_expanding_window_cv_results.json` | JSON | Detailed machine-readable fold breakdown & full precision stats | `afafc9b8894a701b27cfc3b0371dc5b00a6c11f5446806db41434f933399fe6b` |
| `ml_evaluator_requirement_audit.json` | JSON | Formal audit verdict & provenance tracing | `34728155dbbea466bec6b805b47450ae27347cbba3ed77d5f857b631d66f4684` |

## Summary of Findings
1. **Hyperparameter Grid Search**: Traced to `run_phase3a_modeling.py` (lines 221-236) evaluated on Dataset B (7,000 train / 1,500 validation). Total combinations = 324. Selected: `n_estimators=300, max_depth=12, min_samples_split=10, min_samples_leaf=4, max_features=1.0`.
2. **Dataset A Configuration**: Pre-fixed empirical baseline (`n_estimators=200, max_features='sqrt', random_state=42`). No grid search was run on Dataset A.
3. **5-Fold Expanding Window CV**: Conducted on Dataset A's 93 development records. Persisted in `02_development_cv_summary.csv` (Fold MAEs: 7.97, 5.52, 8.34, 11.41, 7.54; Mean MAE: 8.1541, Mean RMSE: 10.3225, Mean R²: 0.2679). Deterministically verified.
4. **Data Isolation**: 26 holdout records remained 100% sealed. Dataset B operational metrics are strictly segregated from Dataset A historical metrics.
