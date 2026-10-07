import os
import sys
import json
import hashlib
from datetime import date, timedelta
import numpy as np
import pandas as pd

# Path setup
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.dirname(os.path.dirname(BASE_DIR))
CONFIG_PATH = os.path.join(BASE_DIR, 'dataset_b_generator_config.json')
DATASET_A_PATH = os.path.join(BASE_DIR, 'dataset_manifest_119.csv')

def compute_sha256(filepath: str) -> str:
    h = hashlib.sha256()
    with open(filepath, 'rb') as f:
        while chunk := f.read(8192):
            h.update(chunk)
    return h.hexdigest()

def run_generation(seed: int = 20261002, n_samples: int = 10000):
    print("=" * 70)
    print("SHOELOTSKEY SERVICE MANAGEMENT SYSTEM")
    print("DATASET B GENERATOR: 10,000 SIMULATED OPERATIONAL RECORDS")
    print(f"Random Seed: {seed} | Target N: {n_samples}")
    print("=" * 70)

    # 1. Load frozen configuration
    with open(CONFIG_PATH, 'r', encoding='utf-8') as f:
        config = json.load(f)

    # 2. Frozen special closures and calendar rules
    special_closures = {
        date(2025, 4, 16),
        date(2025, 4, 17),
        date(2025, 4, 18),
        date(2025, 4, 19),
        date(2025, 12, 24),
        date(2025, 12, 25),
        date(2025, 12, 31),
        date(2026, 1, 1),
    }

    def is_closed(d: date) -> bool:
        return d.weekday() == 6 or d in special_closures

    def next_open_release_date(raw_target: date) -> date:
        cur = raw_target
        while is_closed(cur):
            cur += timedelta(days=1)
        return cur

    # 3. Available intake dates in reference year 2025 (Mon-Sat, non-holiday)
    candidate_intake_dates = []
    cur_date = date(2025, 1, 1)
    end_date = date(2025, 12, 31)
    while cur_date <= end_date:
        if not is_closed(cur_date):
            candidate_intake_dates.append(cur_date)
        cur_date += timedelta(days=1)

    print(f"Total open operational intake dates in 2025 calendar: {len(candidate_intake_dates)}")

    # 4. Load Dataset A to construct the canonical 119-record bootstrap pool
    df_a = pd.read_csv(DATASET_A_PATH)
    assert len(df_a) == 119, f"Dataset A has {len(df_a)} rows, expected 119"

    canonical_pool = []
    for idx, row in df_a.iterrows():
        raw_services = [s.strip() for s in str(row['services']).split(',')]
        total_pairs = int(row['total_pairs'])
        rush = int(row['rush_indicator'])
        
        has_mret = any('retouch' in s.lower() for s in raw_services)
        
        bc_q = int(row['basic_cleaning_qty'])
        fr_q = int(row['full_reglue_qty'])
        mr_q = int(row['minor_reglue_qty'])
        f_res_q = 0 # Full restoration is 0 throughout
        m_res_q = int(row['minor_restoration_qty'])
        cor_q = int(row['color_renewal_qty'])
        uny_q = int(row['unyellowing_qty'])
        
        # FR canonicalization: correct substring inflation in 7 rows
        if row['order_id'] in ['ORD-2025-11-13-001', 'ORD-2025-11-20-004', 'ORD-2025-11-21-008', 'ORD-2025-12-04-001', 'ORD-2025-12-12-001', 'ORD-2025-12-15-001']:
            fr_q = 1
        elif row['order_id'] == 'ORD-2026-01-04-003':
            fr_q = 2
            
        # MRET feature-category mapping
        audit_service = "MRET" if has_mret else row['services']
        if has_mret:
            m_res_q += 1
            
        # Distinct services & total applications
        active = []
        if bc_q > 0: active.append(('BC', bc_q))
        if fr_q > 0: active.append(('FR', fr_q))
        if mr_q > 0: active.append(('MR', mr_q))
        if m_res_q > 0: active.append(('MRES', m_res_q))
        if cor_q > 0: active.append(('COR', cor_q))
        if uny_q > 0: active.append(('UNY', uny_q))
        
        distinct_types = len(active)
        total_apps = sum(q for _, q in active)
        
        # Standard base tier
        if fr_q > 0 or cor_q > 0:
            base_tier = 25
        elif m_res_q > 0 or uny_q > 0:
            base_tier = 20
        elif mr_q > 0 or bc_q > 0:
            base_tier = 10
        else:
            base_tier = 10
            
        # 1-day Rush eligibility
        is_one_day_rush = (rush == 1 and total_pairs <= 3 and fr_q == 0 and mr_q == 0 and m_res_q == 0 and cor_q == 0 and uny_q == 0 and bc_q > 0)
        
        canonical_pool.append({
            'source_order_id': row['order_id'],
            'total_pairs': total_pairs,
            'basic_cleaning_qty': bc_q,
            'full_reglue_qty': fr_q,
            'minor_reglue_qty': mr_q,
            'full_restoration_qty': f_res_q,
            'minor_restoration_qty': m_res_q,
            'color_renewal_qty': cor_q,
            'unyellowing_qty': uny_q,
            'rush_indicator': rush,
            'distinct_service_types': distinct_types,
            'total_service_applications': total_apps,
            'standard_base_tier': base_tier,
            'one_day_rush_eligible': 1 if is_one_day_rush else 0,
            'audit_original_service': audit_service,
            'audit_notes': "CONTAINS_MRET" if has_mret else "STANDARD"
        })

    print(f"Constructed canonical bootstrap pool from {len(canonical_pool)} historical records.")

    # Assign canonical template IDs (CT01 to CT35) based on unique feature tuples
    template_map = {}
    for t_info in config['canonical_empirical_templates']:
        t_key = (
            t_info['total_pairs'],
            t_info['basic_cleaning_qty'],
            t_info['full_reglue_qty'],
            t_info['minor_reglue_qty'],
            t_info['full_restoration_qty'],
            t_info['minor_restoration_qty'],
            t_info['color_renewal_qty'],
            t_info['unyellowing_qty']
        )
        template_map[t_key] = t_info['template_id']

    # 5. Initialize deterministic RNG
    rng = np.random.default_rng(seed)

    # 6. Sample 10,000 records from the canonical bootstrap pool
    sampled_indices = rng.choice(len(canonical_pool), size=n_samples, replace=True)
    sampled_intake_indices = rng.choice(len(candidate_intake_dates), size=n_samples, replace=True)

    # 7. Generate partitions: 7,000 train, 1,500 validation, 1,500 test
    partition_assignments = np.array(['train'] * 7000 + ['validation'] * 1500 + ['test'] * 1500)
    rng.shuffle(partition_assignments)

    records = []
    for i in range(n_samples):
        row_id = f"SIM-{i+1:05d}"
        proto = canonical_pool[sampled_indices[i]]
        intake_dt = candidate_intake_dates[sampled_intake_indices[i]]
        
        t_key = (
            proto['total_pairs'],
            proto['basic_cleaning_qty'],
            proto['full_reglue_qty'],
            proto['minor_reglue_qty'],
            proto['full_restoration_qty'],
            proto['minor_restoration_qty'],
            proto['color_renewal_qty'],
            proto['unyellowing_qty']
        )
        template_id = template_map.get(t_key, "CT_UNKNOWN")

        # Business rule target calculation
        if proto['one_day_rush_eligible'] == 1:
            rule_base_days = 1
        else:
            rule_base_days = proto['standard_base_tier']

        raw_target_dt = intake_dt + timedelta(days=rule_base_days)
        ready_release_dt = next_open_release_date(raw_target_dt)
        simulated_turnaround_days = (ready_release_dt - intake_dt).days
        total_rollover = simulated_turnaround_days - rule_base_days
        
        sunday_rollover = 0
        closure_rollover = 0
        if total_rollover > 0:
            if raw_target_dt.weekday() == 6:
                sunday_rollover = 1
                closure_rollover = total_rollover - 1
            else:
                closure_rollover = total_rollover

        intake_dow = intake_dt.weekday() # 0 = Monday ... 5 = Saturday
        intake_m = intake_dt.month       # 1 to 12

        records.append({
            # Identifiers & Partitions
            "row_id": row_id,
            "partition": partition_assignments[i],
            "canonical_template_id": template_id,
            "audit_source_order_id": proto['source_order_id'],
            "audit_original_service": proto['audit_original_service'],
            "audit_notes": proto['audit_notes'],
            
            # Feature Set C (12 predictors)
            "total_pairs": proto['total_pairs'],
            "basic_cleaning_qty": proto['basic_cleaning_qty'],
            "full_reglue_qty": proto['full_reglue_qty'],
            "minor_reglue_qty": proto['minor_reglue_qty'],
            "unyellowing_qty": proto['unyellowing_qty'],
            "minor_restoration_qty": proto['minor_restoration_qty'],
            "color_renewal_qty": proto['color_renewal_qty'],
            "rush_indicator": proto['rush_indicator'],
            "distinct_service_types": proto['distinct_service_types'],
            "total_service_applications": proto['total_service_applications'],
            "intake_day_of_week": intake_dow,
            "intake_month": intake_m,

            # Feature Set B specific aliases / columns (13 predictors)
            "day_of_week_received": intake_dow,
            "month_received": intake_m,
            "full_restoration_qty": proto['full_restoration_qty'],

            # Audit Dates & Intermediate Duration Steps
            "intake_date": intake_dt.isoformat(),
            "rule_base_days": rule_base_days,
            "raw_target_date": raw_target_dt.isoformat(),
            "ready_for_release_date": ready_release_dt.isoformat(),
            "sunday_rollover_days": sunday_rollover,
            "special_closure_rollover_days": closure_rollover,
            "total_rollover_days": total_rollover,
            "one_day_rush_eligible": proto['one_day_rush_eligible'],

            # Target Variable
            "simulated_turnaround_days": simulated_turnaround_days
        })

    df_gen = pd.DataFrame(records)
    print(f"Generated DataFrame shape: {df_gen.shape}")

    # 8. Structural validation
    assert len(df_gen) == n_samples, f"Expected {n_samples}, got {len(df_gen)}"
    assert df_gen['row_id'].nunique() == n_samples, "Duplicate synthetic row IDs found!"
    assert df_gen['partition'].value_counts()['train'] == 7000
    assert df_gen['partition'].value_counts()['validation'] == 1500
    assert df_gen['partition'].value_counts()['test'] == 1500

    # Target formula independent check: (ready_for_release_date - intake_date).days == simulated_turnaround_days
    recomputed = (pd.to_datetime(df_gen['ready_for_release_date']) - pd.to_datetime(df_gen['intake_date'])).dt.days
    mismatches = (recomputed != df_gen['simulated_turnaround_days']).sum()
    assert mismatches == 0, f"Found {mismatches} target recomputation mismatches!"

    # Release date closure check: no release date on Sunday or closed date
    closed_releases = df_gen['ready_for_release_date'].apply(lambda s: is_closed(date.fromisoformat(s))).sum()
    assert closed_releases == 0, f"Found {closed_releases} release dates falling on closed days!"

    # 9. Save files
    dataset_b_path = os.path.join(BASE_DIR, 'dataset_b_10000.csv')
    train_path = os.path.join(BASE_DIR, 'dataset_b_train_7000.csv')
    val_path = os.path.join(BASE_DIR, 'dataset_b_validation_1500.csv')
    test_path = os.path.join(BASE_DIR, 'dataset_b_test_1500.csv')

    df_gen.to_csv(dataset_b_path, index=False)
    df_gen[df_gen['partition'] == 'train'].to_csv(train_path, index=False)
    df_gen[df_gen['partition'] == 'validation'].to_csv(val_path, index=False)
    df_gen[df_gen['partition'] == 'test'].to_csv(test_path, index=False)

    hashes = {
        "dataset_b_10000.csv": compute_sha256(dataset_b_path),
        "dataset_b_train_7000.csv": compute_sha256(train_path),
        "dataset_b_validation_1500.csv": compute_sha256(val_path),
        "dataset_b_test_1500.csv": compute_sha256(test_path),
        "dataset_b_generator_config.json": compute_sha256(CONFIG_PATH),
    }

    # Save validation report
    manifest_path = os.path.join(BASE_DIR, 'dataset_b_manifest.json')
    manifest = {
        "dataset_name": "Simulated Operational Dataset",
        "sample_size": n_samples,
        "seed": seed,
        "target_variable": "simulated_turnaround_days",
        "file_hashes_sha256": hashes,
        "partition_counts": {
            "train": 7000,
            "validation": 1500,
            "test": 1500
        },
        "target_distribution": {
            "min": int(df_gen['simulated_turnaround_days'].min()),
            "max": int(df_gen['simulated_turnaround_days'].max()),
            "mean": float(df_gen['simulated_turnaround_days'].mean()),
            "median": float(df_gen['simulated_turnaround_days'].median()),
            "value_counts": {str(k): int(v) for k, v in df_gen['simulated_turnaround_days'].value_counts().items()}
        },
        "base_tier_distribution": {str(k): int(v) for k, v in df_gen['rule_base_days'].value_counts().items()},
        "rush_distribution": {
            "rush_total": int((df_gen['rush_indicator'] == 1).sum()),
            "regular_total": int((df_gen['rush_indicator'] == 0).sum()),
            "one_day_rush_eligible": int((df_gen['one_day_rush_eligible'] == 1).sum()),
            "rush_retaining_standard_tier": int(((df_gen['rush_indicator'] == 1) & (df_gen['one_day_rush_eligible'] == 0)).sum())
        },
        "pair_distribution": {str(k): int(v) for k, v in df_gen['total_pairs'].value_counts().items()},
        "template_counts": {str(k): int(v) for k, v in df_gen['canonical_template_id'].value_counts().items()},
        "mret_provenance_count": int((df_gen['audit_notes'] == 'CONTAINS_MRET').sum())
    }

    with open(manifest_path, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, indent=2)

    hashes["dataset_b_manifest.json"] = compute_sha256(manifest_path)

    print("\nGeneration and Freeze Complete!")
    for k, v in hashes.items():
        print(f"  {k}: {v}")

    return df_gen, hashes

if __name__ == '__main__':
    run_generation()
