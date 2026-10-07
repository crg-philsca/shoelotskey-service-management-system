import os
import sys
import json
import pickle
import hashlib
import sklearn
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.inspection import permutation_importance
from sklearn.metrics import (
    mean_absolute_error,
    root_mean_squared_error,
    r2_score,
    median_absolute_error,
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TRAIN_PATH = os.path.join(BASE_DIR, 'dataset_b_train_7000.csv')
VAL_PATH = os.path.join(BASE_DIR, 'dataset_b_validation_1500.csv')
TEST_PATH = os.path.join(BASE_DIR, 'dataset_b_test_1500.csv')
REPORT_PATH = os.path.join(BASE_DIR, 'dataset_b_phase3a_validation_report.json')
MODEL_PATH = os.path.join(BASE_DIR, 'dataset_b_selected_model.pkl')
MODEL_ARCHIVE_PATH = os.path.join(BASE_DIR, 'dataset_b_selected_model_depth16_archive.pkl')

def compute_sha256(filepath: str) -> str:
    h = hashlib.sha256()
    with open(filepath, 'rb') as f:
        while chunk := f.read(8192):
            h.update(chunk)
    return h.hexdigest()

def evaluate_predictions(y_true, y_pred):
    y_true = np.asarray(y_true, dtype=float)
    y_pred = np.asarray(y_pred, dtype=float)
    errors = y_pred - y_true
    abs_errors = np.abs(errors)
    
    mae = float(mean_absolute_error(y_true, y_pred))
    rmse = float(root_mean_squared_error(y_true, y_pred))
    r2 = float(r2_score(y_true, y_pred))
    med_ae = float(median_absolute_error(y_true, y_pred))
    bias = float(np.mean(errors))
    
    tol_1 = float(np.mean(abs_errors <= 1.0) * 100)
    tol_2 = float(np.mean(abs_errors <= 2.0) * 100)
    tol_3 = float(np.mean(abs_errors <= 3.0) * 100)
    tol_5 = float(np.mean(abs_errors <= 5.0) * 100)
    
    return {
        "mae": round(mae, 4),
        "rmse": round(rmse, 4),
        "r2": round(r2, 4),
        "med_ae": round(med_ae, 4),
        "bias": round(bias, 4),
        "tol_1_day_pct": round(tol_1, 2),
        "tol_2_day_pct": round(tol_2, 2),
        "tol_3_day_pct": round(tol_3, 2),
        "tol_5_day_pct": round(tol_5, 2),
    }

def main():
    print("=" * 80)
    print("SHOELOTSKEY SERVICE MANAGEMENT SYSTEM — DATASET B PHASE 3A.1")
    print("PRE-TEST RANDOM FOREST FREEZE CORRECTION (MAX_DEPTH = 12)")
    print("=" * 80)

    # 1. Archive existing depth-16 model artifact for versioned traceability
    if os.path.exists(MODEL_PATH) and not os.path.exists(MODEL_ARCHIVE_PATH):
        import shutil
        shutil.copyfile(MODEL_PATH, MODEL_ARCHIVE_PATH)
        print(f"Archived previous depth-16 model to: {os.path.basename(MODEL_ARCHIVE_PATH)}")
        print(f"  Archive SHA-256: {compute_sha256(MODEL_ARCHIVE_PATH)}")

    # 2. Frozen Feature Set C
    feature_set_c = [
        "total_pairs",
        "basic_cleaning_qty",
        "full_reglue_qty",
        "minor_reglue_qty",
        "unyellowing_qty",
        "minor_restoration_qty",
        "color_renewal_qty",
        "rush_indicator",
        "distinct_service_types",
        "total_service_applications",
        "intake_day_of_week",
        "intake_month"
    ]

    target_col = "simulated_turnaround_days"

    # 3. Load Train and Validation sets only
    print("\nLoading Train (7,000) and Validation (1,500) datasets...")
    df_train = pd.read_csv(TRAIN_PATH)
    df_val = pd.read_csv(VAL_PATH)
    assert len(df_train) == 7000, f"Expected 7,000 train rows, got {len(df_train)}"
    assert len(df_val) == 1500, f"Expected 1,500 val rows, got {len(df_val)}"
    print(f"Test Set Sealed Verification: {os.path.basename(TEST_PATH)} is NOT touched.")

    X_train = df_train[feature_set_c].values
    y_train = df_train[target_col].values

    X_val = df_val[feature_set_c].values
    y_val = df_val[target_col].values

    # 4. Refit exact Rank-1 Hyperparameters
    rf_params_depth12 = {
        "n_estimators": 300,
        "max_depth": 12,
        "min_samples_split": 10,
        "min_samples_leaf": 4,
        "max_features": 1.0,
        "random_state": 20261002,
        "n_jobs": -1
    }

    print("\nRefitting RandomForestRegressor with Rank-1 Hyperparameters:")
    for k, v in rf_params_depth12.items():
        print(f"  {k}: {v}")

    rf_depth12 = RandomForestRegressor(**rf_params_depth12)
    rf_depth12.fit(X_train, y_train)

    # 5. Evaluate on Validation set
    val_preds = rf_depth12.predict(X_val)
    val_metrics = evaluate_predictions(y_val, val_preds)

    print("\nValidation Metrics for Refitted depth-12 Model:")
    print(f"  MAE:           {val_metrics['mae']:.4f} days (Expected: ~0.0641)")
    print(f"  RMSE:          {val_metrics['rmse']:.4f} days (Expected: ~0.2994)")
    print(f"  R²:            {val_metrics['r2']:.4f} (Expected: ~0.9987)")
    print(f"  Median AE:     {val_metrics['med_ae']:.4f} days")
    print(f"  Bias:          {val_metrics['bias']:.4f} days")
    print(f"  ±1-Day Tol:    {val_metrics['tol_1_day_pct']:.2f}%")
    print(f"  ±2-Day Tol:    {val_metrics['tol_2_day_pct']:.2f}%")
    print(f"  ±3-Day Tol:    {val_metrics['tol_3_day_pct']:.2f}%")
    print(f"  ±5-Day Tol:    {val_metrics['tol_5_day_pct']:.2f}%")

    # Assert exact match with Phase 3A reported grid result
    assert val_metrics['mae'] == 0.0641, f"MAE {val_metrics['mae']} does not match grid result 0.0641"
    assert val_metrics['rmse'] == 0.2994, f"RMSE {val_metrics['rmse']} does not match grid result 0.2994"
    assert val_metrics['r2'] == 0.9987, f"R2 {val_metrics['r2']} does not match grid result 0.9987"
    print("Exact metric reproduction confirmed!")

    # 6. Compute Feature Importances
    importances_impurity = rf_depth12.feature_importances_
    perm_result = permutation_importance(
        rf_depth12,
        X_val,
        y_val,
        n_repeats=10,
        random_state=20261002,
        scoring='neg_mean_absolute_error',
        n_jobs=-1
    )
    importances_perm_mean = perm_result.importances_mean

    feat_imp_df = pd.DataFrame({
        "feature": feature_set_c,
        "impurity_importance": importances_impurity,
        "perm_importance_mae_drop": importances_perm_mean
    }).sort_values(by="impurity_importance", ascending=False)

    print("\nFeature Importances (depth-12):")
    print(feat_imp_df.to_string(index=False))

    # 7. Subgroup Diagnostics on Validation
    df_val_diag = df_val.copy()
    df_val_diag['predicted_turnaround'] = val_preds
    df_val_diag['abs_error'] = np.abs(df_val_diag['predicted_turnaround'] - df_val_diag[target_col])
    df_val_diag['error'] = df_val_diag['predicted_turnaround'] - df_val_diag[target_col]

    tier_diag = df_val_diag.groupby('rule_base_days').agg(
        n=('abs_error', 'count'),
        mae=('abs_error', 'mean'),
        rmse=('error', lambda x: np.sqrt(np.mean(x**2))),
        bias=('error', 'mean'),
        tol_1=('abs_error', lambda x: np.mean(x <= 1.0) * 100)
    ).reset_index()

    rush_diag = df_val_diag.groupby('rush_indicator').agg(
        n=('abs_error', 'count'),
        mae=('abs_error', 'mean'),
        rmse=('error', lambda x: np.sqrt(np.mean(x**2))),
        bias=('error', 'mean'),
        tol_1=('abs_error', lambda x: np.mean(x <= 1.0) * 100)
    ).reset_index()

    pairs_diag = df_val_diag.groupby('total_pairs').agg(
        n=('abs_error', 'count'),
        mae=('abs_error', 'mean'),
        rmse=('error', lambda x: np.sqrt(np.mean(x**2))),
        bias=('error', 'mean'),
        tol_1=('abs_error', lambda x: np.mean(x <= 1.0) * 100)
    ).reset_index()

    df_val_diag['has_rollover'] = df_val_diag['total_rollover_days'] > 0
    rollover_diag = df_val_diag.groupby('has_rollover').agg(
        n=('abs_error', 'count'),
        mae=('abs_error', 'mean'),
        rmse=('error', lambda x: np.sqrt(np.mean(x**2))),
        bias=('error', 'mean'),
        tol_1=('abs_error', lambda x: np.mean(x <= 1.0) * 100)
    ).reset_index()

    # 8. Save updated model artifact
    with open(MODEL_PATH, 'wb') as f:
        pickle.dump(rf_depth12, f)
    new_model_hash = compute_sha256(MODEL_PATH)
    print(f"\nSaved updated model artifact to: {os.path.basename(MODEL_PATH)}")
    print(f"New Model SHA-256: {new_model_hash}")

    # 9. Update Phase 3A report JSON
    with open(REPORT_PATH, 'r', encoding='utf-8') as f:
        rep_json = json.load(f)

    rep_json["phase_3a1_correction"] = {
        "correction_date": "2026-10-03",
        "description": "Corrected pre-test freeze from depth=16 to Rank-1 depth=12 per predeclared RMSE tie-breaker rule.",
        "previous_depth_16_archive_hash": compute_sha256(MODEL_ARCHIVE_PATH),
        "new_depth_12_model_hash": new_model_hash,
        "sklearn_version": sklearn.__version__,
    }
    rep_json["selected_configuration"]["model_type"] = "Random Forest Regressor"
    rep_json["selected_configuration"]["feature_set"] = "Feature Set C"
    rep_json["selected_configuration"]["selection_criterion"] = "Lowest Validation MAE (Primary), lower RMSE tie-breaker (max_depth=12 beats max_depth=16 on RMSE 0.2994 vs 0.2995)"
    rep_json["selected_configuration"]["hyperparameters"] = rf_params_depth12
    rep_json["selected_configuration"]["validation_metrics"] = val_metrics
    rep_json["selected_configuration"]["feature_importances"] = feat_imp_df.to_dict(orient='records')
    rep_json["subgroup_diagnostics_validation"] = {
        "by_rule_base_tier": tier_diag.to_dict(orient='records'),
        "by_rush_indicator": rush_diag.to_dict(orient='records'),
        "by_total_pairs": pairs_diag.to_dict(orient='records'),
        "by_rollover_status": rollover_diag.to_dict(orient='records')
    }

    with open(REPORT_PATH, 'w', encoding='utf-8') as f:
        json.dump(rep_json, f, indent=2)

    new_report_hash = compute_sha256(REPORT_PATH)
    print(f"Updated Report JSON SHA-256: {new_report_hash}")

    print("\nPhase 3A.1 Model Freeze Summary:")
    print(f"  Model Type:        Random Forest Regressor")
    print(f"  Feature Set:       Feature Set C (12 features)")
    print(f"  max_depth:         12 (corrected from 16)")
    print(f"  n_estimators:      300")
    print(f"  min_samples_split: 10")
    print(f"  min_samples_leaf:  4")
    print(f"  max_features:      1.0")
    print(f"  random_state:      20261002")
    print(f"  sklearn_version:   {sklearn.__version__}")
    print(f"  Model SHA-256:     {new_model_hash}")
    print(f"  Report SHA-256:    {new_report_hash}")
    print(f"  Test Set Sealed:   YES (dataset_b_test_1500.csv uninspected)")

if __name__ == '__main__':
    main()
