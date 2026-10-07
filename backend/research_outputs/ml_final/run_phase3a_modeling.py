import os
import sys
import json
import hashlib
import pickle
import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression
from sklearn.tree import DecisionTreeRegressor
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
CONFIG_PATH = os.path.join(BASE_DIR, 'dataset_b_generator_config.json')

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
    print("SHOELOTSKEY SERVICE MANAGEMENT SYSTEM — DATASET B PHASE 3A")
    print("MODEL DEVELOPMENT, VALIDATION & PRE-TEST FREEZE")
    print("=" * 80)

    # 1. Programmatic Leakage Guard Check
    print("\n--- 1. Programmatic Leakage Guard Check ---")
    leakage_forbidden = [
        "rule_base_days",
        "dominant_duration",
        "max_service_duration",
        "raw_target_date",
        "ready_for_release_date",
        "intake_date",
        "intake_day_of_month",
        "day_of_month",
        "closure_flag",
        "sunday_rollover_days",
        "special_closure_rollover_days",
        "total_rollover_days",
        "one_day_rush_eligible",
        "simulated_turnaround_days",
        "turnaround_days",
        "target",
    ]

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

    feature_set_b = [
        "total_pairs",
        "distinct_service_types",
        "total_service_applications",
        "rush_indicator",
        "day_of_week_received",
        "month_received",
        "basic_cleaning_qty",
        "full_reglue_qty",
        "minor_reglue_qty",
        "full_restoration_qty",
        "minor_restoration_qty",
        "color_renewal_qty",
        "unyellowing_qty"
    ]

    for f in feature_set_c:
        if f in leakage_forbidden:
            raise ValueError(f"LEAKAGE DETECTED in Feature Set C: {f}")
    for f in feature_set_b:
        if f in leakage_forbidden:
            raise ValueError(f"LEAKAGE DETECTED in Feature Set B: {f}")

    print("Leakage Check PASSED: Zero forbidden or leakage columns in Feature Set B or C.")
    print(f"Feature Set C dimension: {len(feature_set_c)} features.")
    print(f"Feature Set B dimension: {len(feature_set_b)} features.")

    # 2. Load Train and Validation sets (TEST REMAINS STRICTLY UNTOUCHED)
    print("\n--- 2. Loading Train and Validation Datasets ---")
    df_train = pd.read_csv(TRAIN_PATH)
    df_val = pd.read_csv(VAL_PATH)

    print(f"Train rows loaded: {len(df_train)} (from {os.path.basename(TRAIN_PATH)})")
    print(f"Validation rows loaded: {len(df_val)} (from {os.path.basename(VAL_PATH)})")
    print(f"Test Set Sealed Verification: {os.path.basename(TEST_PATH)} is NOT loaded for evaluation.")

    target_col = "simulated_turnaround_days"
    y_train = df_train[target_col].values
    y_val = df_val[target_col].values

    X_train_c = df_train[feature_set_c].values
    X_val_c = df_val[feature_set_c].values

    X_train_b = df_train[feature_set_b].values
    X_val_b = df_val[feature_set_b].values

    # 3. Statistical Baselines
    print("\n--- 3. Evaluating Statistical Baselines ---")
    mean_val = float(np.mean(y_train))
    y_pred_mean = np.full_like(y_val, mean_val)
    metrics_mean = evaluate_predictions(y_val, y_pred_mean)
    print(f"Mean Predictor (Train Mean = {mean_val:.4f}): MAE={metrics_mean['mae']}, RMSE={metrics_mean['rmse']}, R2={metrics_mean['r2']}")

    med_val = float(np.median(y_train))
    y_pred_med = np.full_like(y_val, med_val)
    metrics_med = evaluate_predictions(y_val, y_pred_med)
    print(f"Median Predictor (Train Median = {med_val:.1f}): MAE={metrics_med['mae']}, RMSE={metrics_med['rmse']}, R2={metrics_med['r2']}")

    # 4. Business Rule Baseline (Structurally Privileged Reference)
    print("\n--- 4. Evaluating Business Rule Baseline (Privileged Reference) ---")
    # Base business rule days from order (ignoring calendar rollover)
    y_pred_biz_base = df_val['rule_base_days'].values
    metrics_biz_base = evaluate_predictions(y_val, y_pred_biz_base)
    print(f"Business Rule Base Tier (No Rollover): MAE={metrics_biz_base['mae']}, RMSE={metrics_biz_base['rmse']}, R2={metrics_biz_base['r2']}, +-1day={metrics_biz_base['tol_1_day_pct']}%")

    # 5. Linear Regression (Feature Set B and C)
    print("\n--- 5. Linear Regression ---")
    lr_c = LinearRegression()
    lr_c.fit(X_train_c, y_train)
    y_pred_lr_c = lr_c.predict(X_val_c)
    metrics_lr_c = evaluate_predictions(y_val, y_pred_lr_c)
    print(f"Linear Regression (Feature Set C): MAE={metrics_lr_c['mae']}, RMSE={metrics_lr_c['rmse']}, R2={metrics_lr_c['r2']}")

    lr_b = LinearRegression()
    lr_b.fit(X_train_b, y_train)
    y_pred_lr_b = lr_b.predict(X_val_b)
    metrics_lr_b = evaluate_predictions(y_val, y_pred_lr_b)
    print(f"Linear Regression (Feature Set B): MAE={metrics_lr_b['mae']}, RMSE={metrics_lr_b['rmse']}, R2={metrics_lr_b['r2']}")

    # 6. Decision Tree Pre-declared Grid Search
    print("\n--- 6. Decision Tree Search ---")
    dt_grid = []
    for md in [None, 5, 8, 12, 16]:
        for mss in [2, 5, 10]:
            for msl in [1, 2, 4]:
                dt_grid.append({
                    "max_depth": md,
                    "min_samples_split": mss,
                    "min_samples_leaf": msl,
                    "random_state": 20261002
                })

    def run_dt_search(X_tr, X_v, feat_name):
        best_dt = None
        best_dt_metrics = None
        best_dt_params = None
        best_mae = float('inf')
        
        for params in dt_grid:
            dt = DecisionTreeRegressor(**params)
            dt.fit(X_tr, y_train)
            pred = dt.predict(X_v)
            m = evaluate_predictions(y_val, pred)
            if m['mae'] < best_mae:
                best_mae = m['mae']
                best_dt = dt
                best_dt_metrics = m
                best_dt_params = params
        return best_dt, best_dt_params, best_dt_metrics

    best_dt_c, dt_params_c, dt_metrics_c = run_dt_search(X_train_c, X_val_c, "Feature Set C")
    print(f"Best Decision Tree (Feature Set C): Params={dt_params_c} -> MAE={dt_metrics_c['mae']}, RMSE={dt_metrics_c['rmse']}, R2={dt_metrics_c['r2']}")

    best_dt_b, dt_params_b, dt_metrics_b = run_dt_search(X_train_b, X_val_b, "Feature Set B")
    print(f"Best Decision Tree (Feature Set B): Params={dt_params_b} -> MAE={dt_metrics_b['mae']}, RMSE={dt_metrics_b['rmse']}, R2={dt_metrics_b['r2']}")

    # 7. Random Forest Pre-declared Grid Search
    print("\n--- 7. Random Forest Search ---")
    rf_grid = []
    for n_est in [100, 200, 300]:
        for md in [None, 8, 12, 16]:
            for mss in [2, 5, 10]:
                for msl in [1, 2, 4]:
                    for mf in ['sqrt', 0.7, 1.0]:
                        rf_grid.append({
                            "n_estimators": n_est,
                            "max_depth": md,
                            "min_samples_split": mss,
                            "min_samples_leaf": msl,
                            "max_features": mf,
                            "random_state": 20261002,
                            "n_jobs": -1
                        })
    print(f"Total Random Forest candidates in pre-declared grid: {len(rf_grid)}")

    def run_rf_search(X_tr, X_v, feat_name):
        best_rf = None
        best_rf_metrics = None
        best_rf_params = None
        best_mae = float('inf')
        all_results = []
        
        for idx, params in enumerate(rf_grid):
            rf = RandomForestRegressor(**params)
            rf.fit(X_tr, y_train)
            pred = rf.predict(X_v)
            m = evaluate_predictions(y_val, pred)
            all_results.append((m['mae'], m['rmse'], abs(m['bias']), params, m))
            
            # Selection rule: lowest MAE, tie-breakers: lower RMSE, lower abs(bias)
            if (m['mae'] < best_mae) or (abs(m['mae'] - best_mae) <= 0.02 and m['rmse'] < best_rf_metrics['rmse']):
                best_mae = m['mae']
                best_rf = rf
                best_rf_metrics = m
                best_rf_params = params
        
        all_results.sort(key=lambda x: (x[0], x[1], x[2]))
        return best_rf, best_rf_params, best_rf_metrics, all_results

    print("Running Random Forest search on Feature Set C...")
    best_rf_c, rf_params_c, rf_metrics_c, rf_results_c = run_rf_search(X_train_c, X_val_c, "Feature Set C")
    print(f"Best RF (Feature Set C): Params={rf_params_c} -> MAE={rf_metrics_c['mae']}, RMSE={rf_metrics_c['rmse']}, R2={rf_metrics_c['r2']}")

    print("Running Random Forest search on Feature Set B...")
    best_rf_b, rf_params_b, rf_metrics_b, rf_results_b = run_rf_search(X_train_b, X_val_b, "Feature Set B")
    print(f"Best RF (Feature Set B): Params={rf_params_b} -> MAE={rf_metrics_b['mae']}, RMSE={rf_metrics_b['rmse']}, R2={rf_metrics_b['r2']}")

    # 8. Model Selection Decision
    print("\n--- 8. Model and Feature Set Selection ---")
    candidates = [
        ("Random Forest", "Feature Set C", rf_metrics_c['mae'], rf_metrics_c['rmse'], rf_metrics_c, rf_params_c, best_rf_c),
        ("Random Forest", "Feature Set B", rf_metrics_b['mae'], rf_metrics_b['rmse'], rf_metrics_b, rf_params_b, best_rf_b),
        ("Decision Tree", "Feature Set C", dt_metrics_c['mae'], dt_metrics_c['rmse'], dt_metrics_c, dt_params_c, best_dt_c),
        ("Decision Tree", "Feature Set B", dt_metrics_b['mae'], dt_metrics_b['rmse'], dt_metrics_b, dt_params_b, best_dt_b),
        ("Linear Regression", "Feature Set C", metrics_lr_c['mae'], metrics_lr_c['rmse'], metrics_lr_c, {}, lr_c),
        ("Linear Regression", "Feature Set B", metrics_lr_b['mae'], metrics_lr_b['rmse'], metrics_lr_b, {}, lr_b),
    ]

    candidates.sort(key=lambda x: (x[2], x[3], abs(x[4]['bias'])))
    selected = candidates[0]
    sel_model_name, sel_feat_name, sel_mae, sel_rmse, sel_metrics, sel_params, sel_model_obj = selected

    print(f"SELECTED CANDIDATE: {sel_model_name} with {sel_feat_name}")
    print(f"Validation MAE: {sel_mae:.4f} | RMSE: {sel_rmse:.4f} | R2: {sel_metrics['r2']:.4f}")
    print(f"Selected Hyperparameters: {sel_params}")

    # 9. Subgroup Diagnostics on Validation for Selected Model
    print("\n--- 9. Subgroup Diagnostics on Validation ---")
    val_preds = sel_model_obj.predict(X_val_c if sel_feat_name == "Feature Set C" else X_val_b)
    df_val_diag = df_val.copy()
    df_val_diag['predicted_turnaround'] = val_preds
    df_val_diag['abs_error'] = np.abs(df_val_diag['predicted_turnaround'] - df_val_diag[target_col])
    df_val_diag['error'] = df_val_diag['predicted_turnaround'] - df_val_diag[target_col]

    # By Rule Base Tier
    tier_diag = df_val_diag.groupby('rule_base_days').agg(
        n=('abs_error', 'count'),
        mae=('abs_error', 'mean'),
        rmse=('error', lambda x: np.sqrt(np.mean(x**2))),
        bias=('error', 'mean'),
        tol_1=('abs_error', lambda x: np.mean(x <= 1.0) * 100)
    ).reset_index()

    # By Rush
    rush_diag = df_val_diag.groupby('rush_indicator').agg(
        n=('abs_error', 'count'),
        mae=('abs_error', 'mean'),
        rmse=('error', lambda x: np.sqrt(np.mean(x**2))),
        bias=('error', 'mean'),
        tol_1=('abs_error', lambda x: np.mean(x <= 1.0) * 100)
    ).reset_index()

    # By Total Pairs
    pairs_diag = df_val_diag.groupby('total_pairs').agg(
        n=('abs_error', 'count'),
        mae=('abs_error', 'mean'),
        rmse=('error', lambda x: np.sqrt(np.mean(x**2))),
        bias=('error', 'mean'),
        tol_1=('abs_error', lambda x: np.mean(x <= 1.0) * 100)
    ).reset_index()

    # By Rollover
    df_val_diag['has_rollover'] = df_val_diag['total_rollover_days'] > 0
    rollover_diag = df_val_diag.groupby('has_rollover').agg(
        n=('abs_error', 'count'),
        mae=('abs_error', 'mean'),
        rmse=('error', lambda x: np.sqrt(np.mean(x**2))),
        bias=('error', 'mean'),
        tol_1=('abs_error', lambda x: np.mean(x <= 1.0) * 100)
    ).reset_index()

    # 10. Feature Importance for Selected Model
    print("\n--- 10. Feature Importance Analysis ---")
    feat_names = feature_set_c if sel_feat_name == "Feature Set C" else feature_set_b
    importances_impurity = sel_model_obj.feature_importances_
    
    perm_result = permutation_importance(
        sel_model_obj,
        X_val_c if sel_feat_name == "Feature Set C" else X_val_b,
        y_val,
        n_repeats=10,
        random_state=20261002,
        scoring='neg_mean_absolute_error',
        n_jobs=-1
    )
    importances_perm_mean = perm_result.importances_mean

    feat_imp_df = pd.DataFrame({
        "feature": feat_names,
        "impurity_importance": importances_impurity,
        "perm_importance_mae_drop": importances_perm_mean
    }).sort_values(by="impurity_importance", ascending=False)

    print(feat_imp_df.to_string(index=False))

    # 11. Save and Freeze Model Artifact & Configuration
    print("\n--- 11. Freezing Model Artifact & Development Configuration ---")
    model_artifact_path = os.path.join(BASE_DIR, 'dataset_b_selected_model.pkl')
    with open(model_artifact_path, 'wb') as f:
        pickle.dump(sel_model_obj, f)

    phase3a_report = {
        "phase": "3A",
        "description": "Model Development, Validation & Pre-Test Freeze",
        "random_seed": 20261002,
        "target_variable": target_col,
        "target_description": "Received-to-Ready-for-Release Turnaround Days (Simulated Operational Target)",
        "train_rows": len(df_train),
        "validation_rows": len(df_val),
        "test_rows_sealed": 1500,
        "leakage_guard_status": "PASSED (Zero forbidden features in B or C)",
        "feature_set_c_definition": feature_set_c,
        "feature_set_b_definition": feature_set_b,
        "statistical_baselines_validation": {
            "mean_predictor": {
                "train_mean": round(mean_val, 4),
                "metrics": metrics_mean
            },
            "median_predictor": {
                "train_median": round(med_val, 1),
                "metrics": metrics_med
            },
            "business_rule_base_tier": {
                "description": "Shop rule base tier before calendar rollover (Structurally privileged reference)",
                "metrics": metrics_biz_base
            }
        },
        "models_evaluated_validation": {
            "linear_regression_feature_c": metrics_lr_c,
            "linear_regression_feature_b": metrics_lr_b,
            "decision_tree_feature_c": {
                "best_params": dt_params_c,
                "metrics": dt_metrics_c
            },
            "decision_tree_feature_b": {
                "best_params": dt_params_b,
                "metrics": dt_metrics_b
            },
            "random_forest_feature_c": {
                "best_params": rf_params_c,
                "metrics": rf_metrics_c,
                "top_5_grid_configs": [
                    {"params": p, "metrics": m} for _, _, _, p, m in rf_results_c[:5]
                ]
            },
            "random_forest_feature_b": {
                "best_params": rf_params_b,
                "metrics": rf_metrics_b,
                "top_5_grid_configs": [
                    {"params": p, "metrics": m} for _, _, _, p, m in rf_results_b[:5]
                ]
            }
        },
        "selected_configuration": {
            "model_type": sel_model_name,
            "feature_set": sel_feat_name,
            "selection_criterion": "Lowest Validation MAE (Primary), lower RMSE / absolute bias (Tie-breaker)",
            "validation_metrics": sel_metrics,
            "hyperparameters": sel_params,
            "feature_importances": feat_imp_df.to_dict(orient='records')
        },
        "subgroup_diagnostics_validation": {
            "by_rule_base_tier": tier_diag.to_dict(orient='records'),
            "by_rush_indicator": rush_diag.to_dict(orient='records'),
            "by_total_pairs": pairs_diag.to_dict(orient='records'),
            "by_rollover_status": rollover_diag.to_dict(orient='records')
        },
        "calendar_variance_disclosure": (
            "Feature Set C intentionally excludes exact calendar-date, day-of-month, and closure-derived features. "
            "Consequently, an otherwise identical operational feature vector can produce different simulated targets "
            "when a calculated release date intersects an owner-confirmed special closure. "
            "This reflects intentional real-world operational calendar variance and is not a modeling deficiency."
        ),
        "test_set_sealed_confirmation": "dataset_b_test_1500.csv was NOT evaluated, predicted, or inspected during Phase 3A."
    }

    report_path = os.path.join(BASE_DIR, 'dataset_b_phase3a_validation_report.json')
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(phase3a_report, f, indent=2)

    hashes = {
        "dataset_b_selected_model.pkl": compute_sha256(model_artifact_path),
        "dataset_b_phase3a_validation_report.json": compute_sha256(report_path),
        "dataset_b_train_7000.csv": compute_sha256(TRAIN_PATH),
        "dataset_b_validation_1500.csv": compute_sha256(VAL_PATH),
        "dataset_b_test_1500.csv": compute_sha256(TEST_PATH),
    }

    print("\nPhase 3A Complete! Frozen Hashes:")
    for k, v in hashes.items():
        print(f"  {k}: {v}")

    return phase3a_report, hashes

if __name__ == '__main__':
    main()
