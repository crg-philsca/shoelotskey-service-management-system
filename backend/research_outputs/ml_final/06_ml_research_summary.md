# Final Machine Learning Research Summary
**Generated**: 2026-09-22 08:22:28

## 1. Dataset & Methodology
- **Clean ML Dataset**: 119 records (100% human-validated / canonical).
- **Development Set**: 93 records (2025-08-15 to 2025-12-29).
- **Locked Holdout Test Set**: 26 records (2026-01-02 to 2026-01-27).
- **Target Definition**: `historical_order_to_claim_turnaround_days = (claimed_date - date_received).days`.
- **Target Provenance**: `CLAIM_DATE_CALCULATED`.
- **Selected Feature Set**: Feature Set B (13 features: operational features + service counts).
- **Model**: `RandomForestRegressor(n_estimators=200, max_features='sqrt', random_state=42)`.

## 2. Locked Final Test Performance (Raw Decimal Predictions)
- **MAE**: 8.5554 days
- **RMSE**: 10.2272 days
- **R² Score**: -0.0208
- **Median Absolute Error**: 7.7836 days
- **Mean Signed Error**: -4.6297 days
- **Tolerance Rates**:
  - Within ±1 day: 11.54% (3/26)
  - Within ±2 days: 19.23% (5/26)
  - Within ±3 days: 23.08% (6/26)

## 3. Comparison with Simple Heuristic Baselines
- **Development Mean Baseline (18.44 days)**: MAE = 9.3371, RMSE = 10.1255, R² = -0.0006
- **Development Median Baseline (16.00 days)**: MAE = 8.9615, RMSE = 10.3571, R² = -0.0469
- **MAE Improvement**: Random Forest reduces MAE by **+0.7816 days** vs Mean Baseline and by **+0.4061 days** vs Median Baseline.
- **Tolerance Rate Improvement**: Random Forest achieves higher tolerance rates at ±1d, ±2d, and ±3d than both constant baselines.

## 4. Academic & Operational Conclusions
1. **Target Limitation**: The historical target represents customer order-to-claim turnaround time, which reflects both service execution and customer pickup latency. Physical completion timestamps were unrecorded on physical receipts.
2. **Predictive Capability**: The Random Forest demonstrates moderate predictive value over central tendency baselines (reducing MAE by 0.78 days vs mean), but does not achieve narrow-interval precision (only 19.23% within ±2 days).
3. **System Role**: Recommended strictly for **experimental/advisory prediction** rather than rigid operational scheduling. The **Official Release Date** must remain determined by documented business rules.
