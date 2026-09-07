# Historical Data Folder

This directory manages the ingestion, processing, and output of historical service records for the Shoelotskey Service Management System.

### `source/`
Contains original OCR data and scanned job order forms.
- `Digital Job Order Forms/`: Original receipt images grouped by month.
- `Historical Data.txt` / `raw_historical.txt`: The raw text output extracted via OCR.

### `output/`
Contains generated reports, analytics, CSV datasets, and ETL logs.
- `historical_training_dataset.csv`: Cleaned ML-ready dataset (One Shoe = One Row).
- `historical_analytics_report.json`: Aggregated business metrics.
- `historical_duplicates_report.json`: Records skipped due to duplication.
- `historical_invalid_records_report.json`: Records rejected due to missing target variables (e.g., unclaimed shoes).
- `image_processing_report.json`: OCR and processing success metrics.
- `image_index.csv`: Tracking table mapping source images to processing status.

### `archive/`
Contains backups and retired datasets.
