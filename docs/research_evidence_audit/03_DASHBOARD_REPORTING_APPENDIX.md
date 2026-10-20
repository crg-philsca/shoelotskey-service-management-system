# APPENDIX B: MANUAL VERSUS DIGITAL DASHBOARD REPORTING PERFORMANCE & MATHEMATICAL EQUIVALENCE
**Supporting Chapters:** Chapter 4 (Table 23 & Reporting Discussion)  
**Auditor:** Capstone Research Evidence Auditor & Database Auditor  
**Evidence Standard:** Read-Only Benchmark & Parity Verification  

---

## 1. Reporting Benchmark Methodology & Evidence Ground Truth

This appendix evaluates financial reporting performance by comparing traditional manual bookkeeping against the automated central reporting engine across 7 core operational business reports.

### 1.1 Multi-Tiered Performance Distinctions
To prevent misleading claims during academic defense, the audit enforces strict methodological boundaries:
1. **Directly Observed Manual Preparation Time:** Recorded by researchers during operational baseline audits of paper bookkeeping (manual receipt tallying, handheld calculator arithmetic, reconciling material expense slips). Ranges from 10.0 to 120.0 minutes (cumulative mean: 43.71 minutes).
2. **Automated API Query Execution Time:** Monotonic nanosecond-precision benchmarking using Python `time.perf_counter()`. Measures database query execution, aggregation, and JSON payload serialization across 10 trials per report (following 3 unmeasured warmup cycles). Cumulative mean: 0.0838 seconds (83.8 ms). Total measured trials: 70 executions.
3. **Stage Scope Disclosure:** The observed 99.9968% reduction applies exclusively to the query computation stage after transaction data has been digitized in PostgreSQL/SQLite. It excludes human login, browser rendering, printer spooling, and user reading time.
4. **Independent Relational Parity:** 54 independent SQL aggregate checks were executed against the active database to ensure the dashboard API does not round, drop, or hallucinate financial sums.

---

## 2. Empirical Reporting Efficiency Benchmark Table

### Table B1. Repeated Technical Execution Times and Stage Efficiency across 7 Core Business Reports ($N = 70$ Trials)

| Report Name | Evaluated Reporting Period | Repeated Trials ($n$) | Manual Baseline Duration (min)* | Dashboard Mean Latency (sec) | Dashboard Latency SD (sec) | Minimum Latency (sec) | Maximum Latency (sec) | Content Equivalence Check | Observed Stage Time Reduction (%) |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Daily Sales** | Single Day: July 30, 2026 | 10 | 10.0 min | 0.0657 s | 0.0066 s | 0.0569 s | 0.0785 s | **PASS (9/9 metrics)** | 99.9891% |
| **Weekly Sales** | Mon–Sun: July 06–12, 2026 | 10 | 18.0 min | 0.0808 s | 0.0416 s | 0.0596 s | 0.1976 s | **PASS (9/9 metrics)** | 99.9925% |
| **Monthly Sales** | Full Month: Sept 01–30, 2026 | 10 | 30.0 min | 0.0694 s | 0.0059 s | 0.0615 s | 0.0823 s | **PASS (9/9 metrics)** | 99.9961% |
| **Quarterly Sales** | Q3: July 01 – Sept 30, 2026 | 10 | 90.0 min | 0.0972 s | 0.0376 s | 0.0704 s | 0.1998 s | **PASS (9/9 metrics)** | 99.9982% |
| **Annual Sales** | Fiscal Year: Jan 01 – Dec 31, 2026 | 10 | 120.0 min | 0.0835 s | 0.0055 s | 0.0774 s | 0.0909 s | **PASS (9/9 metrics)** | 99.9988% |
| **Expenses Report** | Fiscal Year: Jan 01 – Dec 31, 2026 | 10 | 15.0 min | 0.0996 s | 0.0350 s | 0.0756 s | 0.1807 s | **PASS (5/5 metrics)** | 99.9889% |
| **ROI Analytics** | Fiscal Year: Jan 01 – Dec 31, 2026 | 10 | 23.0 min | 0.0907 s | 0.0086 s | 0.0789 s | 0.1065 s | **PASS (4/4 metrics)** | 99.9934% |
| **SUMMARY** | **Cumulative Operational Performance** | **70** | **43.71 min** | **0.0838 s** | — | **0.0569 s** | **0.1998 s** | **100% (54/54 PASS)** | **99.9968%** |

*Note.* Automated dashboard execution times exclude human login, client-side browser painting, and user reading time. Asterisk (*) denotes researcher-observed human timings from operational paper baseline audits.

---

## 3. Mathematical Equivalence Audit Breakdown (54/54 Checks)

The mathematical equivalence audit verified exact parity between the reporting endpoint output and raw database SQL queries (`analytics_dashboard_equivalence_results.csv`).

### Table B2. Summary of Financial Parity Verification

| Report Category | Verified Financial Metrics | Discrepancy Observed | Audit Status | Evidence File Reference |
| :--- | :--- | :---: | :---: | :--- |
| **Daily Sales (July 30, 2026)** | Gross Sales (₱5,125.00), Net Sales (₱5,125.00), Orders (12), Payments (₱4,637.50), Balance (₱487.50), Discounts (₱0.00), Refunds (₱0.00), Retained (₱0.00) | 0.0000 | **PASS (9/9)** | `analytics_dashboard_equivalence_results.csv`, lines 2–10 |
| **Weekly Sales (July 06–12, 2026)** | Gross Sales (₱7,075.00), Net Sales (₱7,075.00), Orders (12), Payments (₱5,687.50), Balance (₱1,387.50), Discounts (₱0.00), Refunds (₱0.00), Retained (₱0.00) | 0.0000 | **PASS (9/9)** | `analytics_dashboard_equivalence_results.csv`, lines 11–19 |
| **Monthly Sales (Sept 01–30, 2026)** | Gross Sales (₱31,458.75), Net Sales (₱31,683.75), Orders (40), Payments (₱20,538.13), Balance (₱10,920.62), Discounts (₱0.00), Refunds (₱825.00), Retained (₱225.00) | 0.0000 | **PASS (9/9)** | `analytics_dashboard_equivalence_results.csv`, lines 20–28 |
| **Quarterly Sales (Q3 2026)** | Gross Sales (₱53,933.75), Net Sales (₱54,158.75), Orders (72), Payments (₱39,088.13), Balance (₱14,845.62), Discounts (₱0.00), Refunds (₱825.00), Retained (₱225.00) | 0.0000 | **PASS (9/9)** | `analytics_dashboard_equivalence_results.csv`, lines 29–37 |
| **Annual Sales (FY 2026)** | Gross Sales (₱71,105.75), Net Sales (₱71,330.75), Orders (84), Payments (₱56,260.13), Balance (₱14,845.62), Discounts (₱0.00), Refunds (₱825.00), Retained (₱225.00) | 0.0000 | **PASS (9/9)** | `analytics_dashboard_equivalence_results.csv`, lines 38–46 |
| **Expenses (FY 2026)** | Material Restock, Utilities, Rent, Wage Overheads, Total Operational Expenses | 0.0000 | **PASS (5/5)** | `analytics_dashboard_equivalence_results.csv`, lines 47–51 |
| **ROI Analytics (FY 2026)** | Total Capital Investment, Net Profit, Operating Margin %, Return on Investment % | 0.0000 | **PASS (4/4)** | `analytics_dashboard_equivalence_results.csv`, lines 52–55 |
| **TOTAL METRIC CHECKS** | **54 Independent Financial Aggregations** | **0.0000** | **100% PASS** | **Fully Verified Equivalence** |
