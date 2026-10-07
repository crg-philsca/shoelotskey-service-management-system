import os
import hashlib
import pandas as pd

base = os.path.dirname(os.path.abspath(__file__))
test_path = os.path.join(base, 'dataset_b_test_1500.csv')
pred_path = os.path.join(base, 'dataset_b_final_test_predictions.csv')

test_df = pd.read_csv(test_path)
pred_df = pd.read_csv(pred_path)

test_ids = set(test_df['row_id'])
pred_ids = set(pred_df['row_id'])

print("--- ROW MEMBERSHIP VERIFICATION ---")
print(f"Test rows: {len(test_df)}")
print(f"Prediction rows: {len(pred_df)}")
print(f"Min synthetic test ID: {test_df['row_id'].min()}")
print(f"Max synthetic test ID: {test_df['row_id'].max()}")
print(f"Min synthetic pred ID: {pred_df['row_id'].min()}")
print(f"Max synthetic pred ID: {pred_df['row_id'].max()}")
print(f"Test IDs == Pred IDs: {test_ids == pred_ids}")
print(f"Duplicate prediction IDs: {len(pred_df) - len(pred_ids)}")
print(f"Missing test IDs in predictions: {len(test_ids - pred_ids)}")
print(f"Extra prediction IDs: {len(pred_ids - test_ids)}")

exact_row_order_match = list(test_df['row_id']) == list(pred_df['row_id'])
print(f"Exact row-by-row ID order match: {exact_row_order_match}")

top10_ids = [
    'SIM-02864', 'SIM-05979', 'SIM-09842', 'SIM-02379', 'SIM-01800',
    'SIM-00886', 'SIM-04014', 'SIM-00941', 'SIM-08787', 'SIM-09389'
]

top10_in_test = [tid in test_ids for tid in top10_ids]
print(f"Top 10 IDs all in frozen test: {all(top10_in_test)}")
for tid, present in zip(top10_ids, top10_in_test):
    print(f"  {tid} present: {present}")

print("\n--- REPORT ARTIFACT HASHES ---")
for fname in ['dataset_b_phase3b_final_report.md', 'dataset_b_phase3b_final_report_corrected.md']:
    fpath = os.path.join(base, fname)
    if os.path.exists(fpath):
        with open(fpath, 'rb') as f:
            h = hashlib.sha256(f.read()).hexdigest()
        print(f"{fname}: {h}")
