import os
import sys
import json
import pickle
import hashlib
from datetime import datetime, timezone
import numpy as np
import pandas as pd
import sklearn
from sklearn.metrics import (
    mean_absolute_error,
    root_mean_squared_error,
    r2_score,
    median_absolute_error,
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TEST_PATH = os.path.join(BASE_DIR, 'dataset_b_test_1500.csv')
MODEL_PATH = os.path.join(BASE_DIR, 'dataset_b_selected_model.pkl')
TRAIN_PATH = os.path.join(BASE_DIR, 'dataset_b_train_7000.csv')
VAL_PATH = os.path.join(BASE_DIR, 'dataset_b_validation_1500.csv')
CONFIG_PATH = os.path.join(BASE_DIR, 'dataset_b_generator_config.json')
PHASE3A_REPORT_PATH = os.path.join(BASE_DIR, 'dataset_b_phase3a_validation_report.json')

PRED_OUT_PATH = os.path.join(BASE_DIR, 'dataset_b_final_test_predictions.csv')
METRICS_OUT_PATH = os.path.join(BASE_DIR, 'dataset_b_final_test_metrics.json')

def compute_sha256(filepath: str) -> str:
    h = hashlib.sha256()
    with open(filepath, 'rb') as f:
        while chunk := f.read(8192):
            h.update(chunk)
    return h.hexdigest()

def evaluate_metrics(y_true, y_pred):
    y_true = np.asarray(y_true, dtype=float)
    y_pred = np.asarray(y_pred, dtype=float)
    errors = y_pred - y_true
    abs_errors = np.abs(errors)
    n = len(y_true)
    
    mae = float(mean_absolute_error(y_true, y_pred))
    rmse = float(root_mean_squared_error(y_true, y_pred))
    r2 = float(r2_score(y_true, y_pred))
    med_ae = float(median_absolute_error(y_true, y_pred))
    bias = float(np.mean(errors))
    
    t1_num = int(np.sum(abs_errors <= 1.0))
    t2_num = int(np.sum(abs_errors <= 2.0))
    t3_num = int(np.sum(abs_errors <= 3.0))
    t5_num = int(np.sum(abs_errors <= 5.0))
    
    return {
        "mae": round(mae, 4),
        "rmse": round(rmse, 4),
        "r2": round(r2, 4),
        "med_ae": round(med_ae, 4),
        "bias": round(bias, 4),
        "tolerance_1_day": {
            "numerator": t1_num,
            "denominator": n,
            "percentage": round(t1_num / n * 100, 2)
        },
        "tolerance_2_day": {
            "numerator": t2_num,
            "denominator": n,
            "percentage": round(t2_num / n * 100, 2)
        },
        "tolerance_3_day": {
            "numerator": t3_num,
            "denominator": n,
            "percentage": round(t3_num / n * 100, 2)
        },
        "tolerance_5_day": {
            "numerator": t5_num,
            "denominator": n,
            "percentage": round(t5_num / n * 100, 2)
        }
    }

def main():
    print("=" * 80)
    print("SHOELOTSKEY SERVICE MANAGEMENT SYSTEM — DATASET B PHASE 3B")
    print("ONE-TIME FINAL FROZEN TEST EVALUATION")
    print("=" * 80)

    # 1. Pre-Test Hash Verification
    print("\n--- 1. Pre-Test Hash Verification ---")
    expected_model_hash = "9ce390ca5f0197fe0eef86086ccfd78b79b18b37c19eae76fca7d518bbfeac3b"
    expected_test_hash = "caaa2774868ce0657020cb1cfb2f153bc2fe56dee99af9cb2c6e38342e906a5f"

    actual_model_hash = compute_sha256(MODEL_PATH)
    actual_test_hash = compute_sha256(TEST_PATH)

    print(f"Selected Model Hash: {actual_model_hash}")
    print(f"  Expected:          {expected_model_hash}")
    assert actual_model_hash == expected_model_hash, f"MODEL HASH MISMATCH! Expected {expected_model_hash}, got {actual_model_hash}"

    print(f"Test Set Hash:       {actual_test_hash}")
    print(f"  Expected:          {expected_test_hash}")
    assert actual_test_hash == expected_test_hash, f"TEST SET HASH MISMATCH! Expected {expected_test_hash}, got {actual_test_hash}"

    print("Pre-Test Hash Verification: PASSED (100% Exact Match)")

    # 2. Load Model Artifact
    print("\n--- 2. Loading Frozen Model Artifact ---")
    with open(MODEL_PATH, 'rb') as f:
        rf_model = pickle.load(f)

    print(f"Loaded Model: {rf_model}")
    print(f"  n_estimators:      {rf_model.n_estimators}")
    print(f"  max_depth:         {rf_model.max_depth}")
    print(f"  min_samples_split: {rf_model.min_samples_split}")
    print(f"  min_samples_leaf:  {rf_model.min_samples_leaf}")
    print(f"  max_features:      {rf_model.max_features}")
    print(f"  random_state:      {rf_model.random_state}")

    # 3. Feature Set C Order Verification
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
    print(f"\nFeature Set C (12 features in exact order): {feature_set_c}")

    # 4. Load Test Set
    df_test = pd.read_csv(TEST_PATH)
    n_test = len(df_test)
    print(f"\nTest set loaded: {n_test} records (from {os.path.basename(TEST_PATH)})")
    assert n_test == 1500, f"Expected 1,500 test records, got {n_test}"

    # Verify column presence
    for col in feature_set_c:
        assert col in df_test.columns, f"Missing feature {col} in test set!"
    target_col = "simulated_turnaround_days"
    assert target_col in df_test.columns, f"Missing target {target_col} in test set!"

    X_test = df_test[feature_set_c].values
    y_test = df_test[target_col].values.astype(float)

    # 5. Generate Final Predictions Once
    print("\n--- 5. Generating One-Time Final Test Predictions ---")
    y_pred_rf = rf_model.predict(X_test)
    rf_test_metrics = evaluate_metrics(y_test, y_pred_rf)

    print("Final Random Forest Test Performance:")
    print(f"  MAE:               {rf_test_metrics['mae']:.4f} days")
    print(f"  RMSE:              {rf_test_metrics['rmse']:.4f} days")
    print(f"  R²:                {rf_test_metrics['r2']:.4f}")
    print(f"  Median AE:         {rf_test_metrics['med_ae']:.4f} days")
    print(f"  Bias (Mean Error): {rf_test_metrics['bias']:.4f} days")
    print(f"  ±1-Day Tolerance:  {rf_test_metrics['tolerance_1_day']['numerator']}/{rf_test_metrics['tolerance_1_day']['denominator']} ({rf_test_metrics['tolerance_1_day']['percentage']}%)")
    print(f"  ±2-Day Tolerance:  {rf_test_metrics['tolerance_2_day']['numerator']}/{rf_test_metrics['tolerance_2_day']['denominator']} ({rf_test_metrics['tolerance_2_day']['percentage']}%)")
    print(f"  ±3-Day Tolerance:  {rf_test_metrics['tolerance_3_day']['numerator']}/{rf_test_metrics['tolerance_3_day']['denominator']} ({rf_test_metrics['tolerance_3_day']['percentage']}%)")
    print(f"  ±5-Day Tolerance:  {rf_test_metrics['tolerance_5_day']['numerator']}/{rf_test_metrics['tolerance_5_day']['denominator']} ({rf_test_metrics['tolerance_5_day']['percentage']}%)")

    # 6. Evaluate Baseline Context on Test Set
    print("\n--- 6. Evaluating Baseline Context on Same 1,500 Test Records ---")
    # Training mean & median from Phase 3A
    train_mean = 16.8356
    train_median = 20.0

    y_pred_mean = np.full_like(y_test, train_mean)
    mean_metrics = evaluate_metrics(y_test, y_pred_mean)
    print(f"Mean Predictor (Train Mean = {train_mean}): MAE={mean_metrics['mae']}, RMSE={mean_metrics['rmse']}, R2={mean_metrics['r2']}")

    y_pred_med = np.full_like(y_test, train_median)
    med_metrics = evaluate_metrics(y_test, y_pred_med)
    print(f"Median Predictor (Train Median = {train_median}): MAE={med_metrics['mae']}, RMSE={med_metrics['rmse']}, R2={med_metrics['r2']}")

    # Structurally Privileged Shop Rule Reference
    y_pred_rule_base = df_test['rule_base_days'].values.astype(float)
    rule_base_metrics = evaluate_metrics(y_test, y_pred_rule_base)
    print(f"Shop Rule Base Tier Reference (Structurally Privileged): MAE={rule_base_metrics['mae']}, RMSE={rule_base_metrics['rmse']}, R2={rule_base_metrics['r2']}, +-1day={rule_base_metrics['tolerance_1_day']['percentage']}%")

    # 7. Save Final Test Prediction Artifact
    print("\n--- 7. Saving Final Prediction Artifact ---")
    df_pred_out = pd.DataFrame({
        "row_id": df_test['row_id'],
        "canonical_template_id": df_test['canonical_template_id'],
        "total_pairs": df_test['total_pairs'],
        "rush_indicator": df_test['rush_indicator'],
        "rule_base_days": df_test['rule_base_days'],
        "has_rollover": df_test['total_rollover_days'] > 0,
        "total_rollover_days": df_test['total_rollover_days'],
        "actual_turnaround_days": y_test,
        "predicted_turnaround_days": y_pred_rf,
        "signed_error": y_pred_rf - y_test,
        "absolute_error": np.abs(y_pred_rf - y_test)
    })
    df_pred_out.to_csv(PRED_OUT_PATH, index=False)
    pred_hash = compute_sha256(PRED_OUT_PATH)
    print(f"Saved predictions to: {os.path.basename(PRED_OUT_PATH)}")
    print(f"  SHA-256: {pred_hash}")

    # 8. Error Distribution
    errors = df_pred_out['signed_error'].values
    abs_errors = df_pred_out['absolute_error'].values

    error_dist = {
        "min_signed_error": round(float(np.min(errors)), 4),
        "max_signed_error": round(float(np.max(errors)), 4),
        "min_absolute_error": round(float(np.min(abs_errors)), 4),
        "max_absolute_error": round(float(np.max(abs_errors)), 4),
        "mean_absolute_error": round(float(np.mean(abs_errors)), 4),
        "median_absolute_error": round(float(np.median(abs_errors)), 4),
        "p95_absolute_error": round(float(np.percentile(abs_errors, 95)), 4),
        "p99_absolute_error": round(float(np.percentile(abs_errors, 99)), 4)
    }
    print(f"\nError Distribution: {error_dist}")

    # Identify largest-error test cases
    largest_error_cases = df_pred_out.sort_values(by="absolute_error", ascending=False).head(10).to_dict(orient='records')
    print("\nTop 5 Largest Error Test Cases:")
    for c in largest_error_cases[:5]:
        print(f"  Row: {c['row_id']} | Actual: {c['actual_turnaround_days']} | Pred: {c['predicted_turnaround_days']:.2f} | AbsErr: {c['absolute_error']:.2f} | BaseDays: {c['rule_base_days']} | RolloverDays: {c['total_rollover_days']}")

    # 9. Final Subgroup Diagnostics on Test
    print("\n--- 9. Subgroup Diagnostics on Test ---")
    tier_diag = df_pred_out.groupby('rule_base_days').agg(
        n=('absolute_error', 'count'),
        mae=('absolute_error', 'mean'),
        rmse=('signed_error', lambda x: np.sqrt(np.mean(x**2))),
        bias=('signed_error', 'mean'),
        tol_1=('absolute_error', lambda x: np.mean(x <= 1.0) * 100)
    ).reset_index().to_dict(orient='records')

    rush_diag = df_pred_out.groupby('rush_indicator').agg(
        n=('absolute_error', 'count'),
        mae=('absolute_error', 'mean'),
        rmse=('signed_error', lambda x: np.sqrt(np.mean(x**2))),
        bias=('signed_error', 'mean'),
        tol_1=('absolute_error', lambda x: np.mean(x <= 1.0) * 100)
    ).reset_index().to_dict(orient='records')

    pairs_diag = df_pred_out.groupby('total_pairs').agg(
        n=('absolute_error', 'count'),
        mae=('absolute_error', 'mean'),
        rmse=('signed_error', lambda x: np.sqrt(np.mean(x**2))),
        bias=('signed_error', 'mean'),
        tol_1=('absolute_error', lambda x: np.mean(x <= 1.0) * 100)
    ).reset_index().to_dict(orient='records')

    rollover_diag = df_pred_out.groupby('has_rollover').agg(
        n=('absolute_error', 'count'),
        mae=('absolute_error', 'mean'),
        rmse=('signed_error', lambda x: np.sqrt(np.mean(x**2))),
        bias=('signed_error', 'mean'),
        tol_1=('absolute_error', lambda x: np.mean(x <= 1.0) * 100)
    ).reset_index().to_dict(orient='records')

    # 10. Validation vs Final Test Comparison
    with open(PHASE3A_REPORT_PATH, 'r', encoding='utf-8') as f:
        val_rep = json.load(f)

    frozen_val_metrics = val_rep["selected_configuration"]["validation_metrics"]
    comp = {
        "mae": {
            "validation": frozen_val_metrics["mae"],
            "test": rf_test_metrics["mae"],
            "diff_test_minus_val": round(rf_test_metrics["mae"] - frozen_val_metrics["mae"], 4)
        },
        "rmse": {
            "validation": frozen_val_metrics["rmse"],
            "test": rf_test_metrics["rmse"],
            "diff_test_minus_val": round(rf_test_metrics["rmse"] - frozen_val_metrics["rmse"], 4)
        },
        "r2": {
            "validation": frozen_val_metrics["r2"],
            "test": rf_test_metrics["r2"],
            "diff_test_minus_val": round(rf_test_metrics["r2"] - frozen_val_metrics["r2"], 4)
        },
        "tolerance_1_day": {
            "validation": frozen_val_metrics["tol_1_day_pct"],
            "test": rf_test_metrics["tolerance_1_day"]["percentage"],
            "diff_test_minus_val": round(rf_test_metrics["tolerance_1_day"]["percentage"] - frozen_val_metrics["tol_1_day_pct"], 2)
        },
        "tolerance_2_day": {
            "validation": frozen_val_metrics["tol_2_day_pct"],
            "test": rf_test_metrics["tolerance_2_day"]["percentage"],
            "diff_test_minus_val": round(rf_test_metrics["tolerance_2_day"]["percentage"] - frozen_val_metrics["tol_2_day_pct"], 2)
        },
        "tolerance_3_day": {
            "validation": frozen_val_metrics["tol_3_day_pct"],
            "test": rf_test_metrics["tolerance_3_day"]["percentage"],
            "diff_test_minus_val": round(rf_test_metrics["tolerance_3_day"]["percentage"] - frozen_val_metrics["tol_3_day_pct"], 2)
        },
        "tolerance_5_day": {
            "validation": frozen_val_metrics["tol_5_day_pct"],
            "test": rf_test_metrics["tolerance_5_day"]["percentage"],
            "diff_test_minus_val": round(rf_test_metrics["tolerance_5_day"]["percentage"] - frozen_val_metrics["tol_5_day_pct"], 2)
        }
    }
    print(f"\nValidation vs Test Comparison: {comp}")

    # 11. Compile Final Test Metrics JSON
    final_output = {
        "phase": "3B",
        "description": "One-Time Final Frozen Test Evaluation",
        "evaluation_timestamp_utc": datetime.now(timezone.utc).isoformat(),
        "python_version": sys.version,
        "sklearn_version": sklearn.__version__,
        "dataset_name": "Simulated Operational Dataset",
        "target_variable": "simulated_turnaround_days",
        "target_description": "Received-to-Ready-for-Release Turnaround Days (Simulated Operational Target)",
        "test_sample_size": n_test,
        "model_specification": {
            "algorithm": "RandomForestRegressor",
            "hyperparameters": {
                "n_estimators": rf_model.n_estimators,
                "max_depth": rf_model.max_depth,
                "min_samples_split": rf_model.min_samples_split,
                "min_samples_leaf": rf_model.min_samples_leaf,
                "max_features": rf_model.max_features,
                "random_state": rf_model.random_state
            },
            "feature_set": "Feature Set C",
            "feature_names_order": feature_set_c
        },
        "hashes": {
            "model_pkl": actual_model_hash,
            "test_csv": actual_test_hash,
            "predictions_csv": pred_hash,
        },
        "final_test_metrics_random_forest": rf_test_metrics,
        "baseline_context_on_test": {
            "mean_predictor": mean_metrics,
            "median_predictor": med_metrics,
            "structurally_privileged_shop_rules": rule_base_metrics
        },
        "validation_vs_test_comparison": comp,
        "subgroup_diagnostics_test": {
            "by_rule_base_tier": tier_diag,
            "by_rush_indicator": rush_diag,
            "by_total_pairs": pairs_diag,
            "by_rollover_status": rollover_diag
        },
        "error_distribution": error_dist,
        "largest_error_cases": largest_error_cases[:10],
        "interpretation_boundary_statement": (
            "The final test results represent predictive performance under the chairperson-approved "
            "simulated operational workflow. Because Dataset B was generated using validated shop business "
            "rules and simulated release-date conditions, these results do not independently establish "
            "equivalent predictive accuracy on future real-world service orders. Dataset A remains the "
            "historical real-order evaluation and is preserved separately."
        ),
        "no_post_test_tuning_statement": (
            "Zero post-test modifications, hyperparameter adjustments, feature engineering, "
            "or model refitting were conducted. The first test evaluation is the final evaluation."
        )
    }

    with open(METRICS_OUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(final_output, f, indent=2)

    final_metrics_hash = compute_sha256(METRICS_OUT_PATH)
    print(f"\nSaved final metrics to: {os.path.basename(METRICS_OUT_PATH)}")
    print(f"  SHA-256: {final_metrics_hash}")

    print("\nPhase 3B Evaluation Successfully Completed!")

if __name__ == '__main__':
    main()
