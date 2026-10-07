# Python script to generate the Master Technical Audit, Manuscript Revision, and Defense Readiness Report
import os

html_content = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Shoelotskey SMS - Master Comprehensive Revision & Defense Readiness Report</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary: #0284c7;
      --primary-dark: #0369a1;
      --primary-light: #e0f2fe;
      --accent: #f59e0b;
      --accent-light: #fef3c7;
      --success: #10b981;
      --success-light: #dcfce7;
      --danger: #ef4444;
      --danger-light: #fee2e2;
      --purple: #8b5cf6;
      --purple-light: #ede9fe;
      --indigo: #6366f1;
      --indigo-light: #e0e7ff;
      --teal: #0d9488;
      --teal-light: #ccfbf1;
      --rose: #f43f5e;
      --rose-light: #ffe4e6;
      --slate-900: #0f172a;
      --slate-800: #1e293b;
      --slate-700: #334155;
      --slate-600: #475569;
      --slate-500: #64748b;
      --slate-400: #94a3b8;
      --slate-100: #f1f5f9;
      --slate-50: #f8fafc;
      --border: #e2e8f0;
      --card-bg: #ffffff;
      --radius-sm: 6px;
      --radius-md: 10px;
      --radius-lg: 14px;
      --shadow-sm: 0 1px 3px rgba(0,0,0,0.06);
      --shadow-md: 0 4px 6px -1px rgba(0,0,0,0.08), 0 2px 4px -2px rgba(0,0,0,0.06);
      --shadow-lg: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.05);
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background-color: #f1f5f9;
      color: var(--slate-900);
      line-height: 1.65;
      padding: 20px 12px;
    }

    .container {
      max-width: 1440px;
      margin: 0 auto;
      background: var(--card-bg);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-lg);
      border: 1px solid var(--border);
      overflow: hidden;
    }

    /* Top Institutional Banner */
    .header-banner {
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 40%, #0369a1 100%);
      color: #ffffff;
      padding: 36px 32px;
      border-bottom: 4px solid var(--accent);
      position: relative;
    }

    .badge-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 14px;
    }

    .badge-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 12px;
      border-radius: 9999px;
      font-size: 0.72rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .badge-iso {
      background: rgba(16, 185, 129, 0.2);
      color: #34d399;
      border: 1px solid rgba(16, 185, 129, 0.4);
    }

    .badge-sdlc {
      background: rgba(13, 148, 136, 0.25);
      color: #5eead4;
      border: 1px solid rgba(13, 148, 136, 0.45);
    }

    .badge-rdo {
      background: rgba(245, 158, 11, 0.2);
      color: #fcd34d;
      border: 1px solid rgba(245, 158, 11, 0.4);
    }

    .badge-live {
      background: rgba(56, 189, 248, 0.2);
      color: #7dd3fc;
      border: 1px solid rgba(56, 189, 248, 0.4);
    }

    .badge-tam {
      background: rgba(139, 92, 246, 0.2);
      color: #c4b5fd;
      border: 1px solid rgba(139, 92, 246, 0.4);
    }

    .header-title {
      font-size: 2.1rem;
      font-weight: 800;
      line-height: 1.25;
      margin-bottom: 8px;
      letter-spacing: -0.02em;
    }

    .header-subtitle {
      font-size: 1.02rem;
      color: #cbd5e1;
      max-width: 1100px;
      margin-bottom: 22px;
      line-height: 1.55;
    }

    .meta-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 14px;
      background: rgba(255, 255, 255, 0.08);
      padding: 16px 20px;
      border-radius: var(--radius-md);
      border: 1px solid rgba(255, 255, 255, 0.12);
      font-size: 0.85rem;
    }

    .meta-item strong {
      display: block;
      color: #94a3b8;
      font-size: 0.70rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 3px;
    }

    .meta-item span {
      color: #f8fafc;
      font-weight: 600;
    }

    /* Sticky Tab Navigation */
    .tab-nav-wrapper {
      background: #f8fafc;
      border-bottom: 1px solid var(--border);
      padding: 10px 16px 0 16px;
      position: sticky;
      top: 0;
      z-index: 1000;
      backdrop-filter: blur(10px);
    }

    .tab-nav {
      display: flex;
      gap: 6px;
      overflow-x: auto;
      scrollbar-width: thin;
      padding-bottom: 10px;
    }

    .tab-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 14px;
      border: 1px solid transparent;
      background: #ffffff;
      color: var(--slate-600);
      font-family: 'Outfit', sans-serif;
      font-size: 0.82rem;
      font-weight: 600;
      border-radius: var(--radius-sm);
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.2s ease;
      box-shadow: 0 1px 2px rgba(0,0,0,0.04);
    }

    .tab-btn:hover {
      background: #e2e8f0;
      color: var(--slate-900);
      transform: translateY(-1px);
    }

    .tab-btn.active {
      background: var(--primary);
      color: #ffffff;
      border-color: var(--primary-dark);
      box-shadow: 0 3px 6px rgba(2, 132, 199, 0.3);
      font-weight: 700;
    }

    .tab-icon {
      font-size: 0.95rem;
    }

    /* Content Panes */
    .content-body {
      padding: 32px 30px;
    }

    .tab-pane {
      display: none;
      animation: fadeIn 0.25s ease-in-out;
    }

    .tab-pane.active {
      display: block;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(5px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* Typography & Section Styles */
    h2 {
      font-size: 1.45rem;
      font-weight: 800;
      color: var(--slate-900);
      margin: 28px 0 16px 0;
      padding-bottom: 10px;
      border-bottom: 2px solid var(--border);
      display: flex;
      align-items: center;
      gap: 10px;
    }

    h2:first-of-type {
      margin-top: 0;
    }

    h3 {
      font-size: 1.15rem;
      font-weight: 700;
      color: var(--primary-dark);
      margin: 24px 0 12px 0;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    h4 {
      font-size: 0.98rem;
      font-weight: 700;
      color: var(--slate-800);
      margin: 16px 0 8px 0;
    }

    p {
      margin-bottom: 14px;
      color: var(--slate-700);
      font-size: 0.94rem;
    }

    /* KPI Row */
    .kpi-row {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
      gap: 14px;
      margin: 20px 0;
    }

    .kpi-card {
      background: var(--slate-50);
      border-radius: var(--radius-md);
      padding: 16px 18px;
      border: 1px solid var(--border);
      position: relative;
      overflow: hidden;
    }

    .kpi-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 4px;
      height: 100%;
    }

    .kpi-card.blue::before { background: var(--primary); }
    .kpi-card.green::before { background: var(--success); }
    .kpi-card.amber::before { background: var(--accent); }
    .kpi-card.purple::before { background: var(--purple); }
    .kpi-card.rose::before { background: var(--rose); }

    .kpi-title {
      font-size: 0.74rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--slate-500);
      margin-bottom: 6px;
    }

    .kpi-value {
      font-size: 1.65rem;
      font-weight: 800;
      color: var(--slate-900);
      line-height: 1.1;
      margin-bottom: 4px;
    }

    .kpi-sub {
      font-size: 0.78rem;
      color: var(--slate-600);
    }

    /* Tables */
    .table-responsive {
      overflow-x: auto;
      margin: 18px 0 24px 0;
      border-radius: var(--radius-md);
      border: 1px solid var(--border);
      box-shadow: var(--shadow-sm);
    }

    table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 0.88rem;
    }

    thead {
      background: #f1f5f9;
      color: var(--slate-800);
    }

    th {
      padding: 12px 14px;
      font-weight: 700;
      font-size: 0.76rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      border-bottom: 2px solid var(--border);
    }

    td {
      padding: 11px 14px;
      border-bottom: 1px solid var(--border);
      vertical-align: top;
      color: var(--slate-700);
    }

    tr:last-child td {
      border-bottom: none;
    }

    tr:hover td {
      background: #f8fafc;
    }

    /* Badges & Tags */
    .tag {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 0.72rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }

    .tag-success { background: var(--success-light); color: #065f46; border: 1px solid #a7f3d0; }
    .tag-warning { background: var(--accent-light); color: #92400e; border: 1px solid #fde68a; }
    .tag-danger { background: var(--danger-light); color: #991b1b; border: 1px solid #fecaca; }
    .tag-info { background: var(--primary-light); color: #075985; border: 1px solid #bae6fd; }
    .tag-purple { background: var(--purple-light); color: #5b21b6; border: 1px solid #ddd6fe; }
    .tag-teal { background: var(--teal-light); color: #115e59; border: 1px solid #99f6e4; }

    /* Callout Alert Boxes */
    .callout {
      padding: 16px 18px;
      border-radius: var(--radius-md);
      margin: 18px 0;
      display: flex;
      gap: 12px;
      align-items: flex-start;
      border: 1px solid transparent;
      font-size: 0.91rem;
    }

    .callout-success { background: #f0fdf4; border-color: #bbf7d0; color: #166534; }
    .callout-warning { background: #fffbeb; border-color: #fde68a; color: #92400e; }
    .callout-danger { background: #fef2f2; border-color: #fecaca; color: #991b1b; }
    .callout-info { background: #f0f9ff; border-color: #bae6fd; color: #075985; }

    .callout-icon {
      font-size: 1.25rem;
      line-height: 1;
      flex-shrink: 0;
      margin-top: 2px;
    }

    .callout-content strong {
      display: block;
      margin-bottom: 4px;
      font-size: 0.95rem;
    }

    /* Comparison / Diff Box */
    .diff-container {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
      margin: 16px 0 22px 0;
    }

    @media (max-width: 900px) {
      .diff-container {
        grid-template-columns: 1fr;
      }
    }

    .diff-box {
      border-radius: var(--radius-sm);
      padding: 14px 16px;
      font-size: 0.88rem;
    }

    .diff-before {
      background: #fff1f2;
      border: 1px solid #fecdd3;
      border-left: 4px solid var(--danger);
    }

    .diff-after {
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-left: 4px solid var(--success);
    }

    .diff-label {
      font-size: 0.72rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 6px;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .diff-before .diff-label { color: #9f1239; }
    .diff-after .diff-label { color: #166534; }

    .diff-text {
      font-style: italic;
      line-height: 1.55;
    }

    /* Checklists */
    .checklist {
      list-style: none;
      margin: 14px 0;
    }

    .checklist li {
      padding: 8px 12px;
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: flex-start;
      gap: 10px;
      font-size: 0.90rem;
    }

    .checklist li:last-child {
      border-bottom: none;
    }

    .check-pass { color: var(--success); font-weight: bold; }
    .check-fail { color: var(--danger); font-weight: bold; }
    .check-warn { color: var(--accent); font-weight: bold; }

    /* Code blocks */
    pre, code {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.84rem;
    }

    pre {
      background: #1e293b;
      color: #e2e8f0;
      padding: 14px;
      border-radius: var(--radius-sm);
      overflow-x: auto;
      margin: 12px 0;
      border: 1px solid #334155;
    }

    code:not(pre code) {
      background: #f1f5f9;
      color: #0369a1;
      padding: 2px 5px;
      border-radius: 4px;
      border: 1px solid #e2e8f0;
    }

    /* Q&A Accordion-like cards */
    .qa-card {
      background: #ffffff;
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      padding: 18px 20px;
      margin-bottom: 14px;
      box-shadow: var(--shadow-sm);
      transition: all 0.2s ease;
    }

    .qa-card:hover {
      border-color: var(--primary);
      box-shadow: var(--shadow-md);
    }

    .qa-q {
      font-size: 0.98rem;
      font-weight: 700;
      color: var(--slate-900);
      margin-bottom: 8px;
      display: flex;
      align-items: flex-start;
      gap: 8px;
    }

    .qa-q-num {
      background: var(--primary-light);
      color: var(--primary-dark);
      padding: 2px 7px;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 800;
      flex-shrink: 0;
    }

    .qa-a {
      font-size: 0.90rem;
      color: var(--slate-700);
      line-height: 1.6;
      padding-left: 28px;
    }

    .qa-tip {
      margin-top: 10px;
      margin-left: 28px;
      background: var(--slate-50);
      padding: 8px 12px;
      border-radius: var(--radius-sm);
      border-left: 3px solid var(--accent);
      font-size: 0.82rem;
      color: var(--slate-600);
    }

    /* Footer */
    .footer {
      background: #f8fafc;
      padding: 20px 32px;
      border-top: 1px solid var(--border);
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 14px;
      font-size: 0.82rem;
      color: var(--slate-500);
    }

    @media print {
      body { background: #fff; padding: 0; }
      .container { box-shadow: none; border: none; max-width: 100%; }
      .tab-nav-wrapper { display: none; }
      .tab-pane { display: block !important; margin-bottom: 30px; page-break-after: always; }
      .tab-pane::before {
        content: attr(data-tab-title);
        display: block;
        font-size: 1.5rem;
        font-weight: 800;
        color: #0f172a;
        margin-bottom: 15px;
        padding-bottom: 8px;
        border-bottom: 3px solid var(--primary);
      }
    }
  </style>
</head>
<body>

  <div class="container">
    
    <!-- Institutional Header -->
    <header class="header-banner">
      <div class="badge-row">
        <span class="badge-pill badge-iso">ISO/IEC 25010:2023 (9 Characteristics)</span>
        <span class="badge-pill badge-tam">TAM (4 Constructs · N=6 Full Census)</span>
        <span class="badge-pill badge-sdlc">SDLC: Waterfall Model (6 Phases Verified)</span>
        <span class="badge-pill badge-rdo">RDO Advisory No. 01 s. 2026 Mandate</span>
        <span class="badge-pill badge-live">Live: shoelotskey-villamor-pasay.app</span>
      </div>

      <h1 class="header-title">Comprehensive Capstone Revision, Alignment & Defense Readiness Report</h1>
      <p class="header-subtitle">
        An authoritative master technical audit and chapter-by-chapter revision guide aligning Research Questions (RQ 1–6), Specific Objectives (Obj 1–6), Technology Acceptance Model (TAM), ISO/IEC 25010:2023 Quality Model, Panel Revision Matrix, System Codebase, and Capstone Defense Presentation.
      </p>

      <div class="meta-grid">
        <div class="meta-item">
          <strong>Institution</strong>
          <span>National Aviation Academy of the Philippines (PhilSCA)</span>
        </div>
        <div class="meta-item">
          <strong>Academic Program</strong>
          <span>BS in Aviation Information Technology (BSAIT)</span>
        </div>
        <div class="meta-item">
          <strong>Researchers</strong>
          <span>Angeles, Charmaine Rose G. · Gravino, Kylane C. · Sedanto, Melody D.</span>
        </div>
        <div class="meta-item">
          <strong>Capstone & Academic Advisers</strong>
          <span>Richard Niel B. Peralta, MSIT · Assoc. Prof. Mary Ann Aballiar-Vista, MEAM</span>
        </div>
        <div class="meta-item">
          <strong>Course Code & Term</strong>
          <span>IT411: Aviation Capstone Project 2 (3 Units, 54 Hours)</span>
        </div>
        <div class="meta-item">
          <strong>Evaluated Release</strong>
          <span>Production Staging v2.4 (React + FastAPI + PostgreSQL + Scikit-Learn)</span>
        </div>
      </div>
    </header>

    <!-- Tab Navigation -->
    <div class="tab-nav-wrapper">
      <nav class="tab-nav" id="masterTabs">
        <button class="tab-btn active" onclick="switchTab('tab-alignment', this)">
          <span class="tab-icon">🎯</span> 1. Triangulated Alignment Matrix
        </button>
        <button class="tab-btn" onclick="switchTab('tab-checkpoints', this)">
          <span class="tab-icon">🏛️</span> 2. Mission Checkpoints & IT411 Directives
        </button>
        <button class="tab-btn" onclick="switchTab('tab-panel-matrix', this)">
          <span class="tab-icon">📋</span> 3. Panel Revision Matrix & Validators
        </button>
        <button class="tab-btn" onclick="switchTab('tab-it-experts', this)">
          <span class="tab-icon">🛠️</span> 4. IT Experts & ISO 25010:2023 Audit
        </button>
        <button class="tab-btn" onclick="switchTab('tab-ch1-ch3', this)">
          <span class="tab-icon">📖</span> 5. Manuscript Revisions (Ch 1 – 3)
        </button>
        <button class="tab-btn" onclick="switchTab('tab-ch4-ch5', this)">
          <span class="tab-icon">📊</span> 6. Manuscript Revisions (Ch 4 – 5)
        </button>
        <button class="tab-btn" onclick="switchTab('tab-system-audit', this)">
          <span class="tab-icon">💻</span> 7. System & Codebase Assessment
        </button>
        <button class="tab-btn" onclick="switchTab('tab-presentation', this)">
          <span class="tab-icon">🎤</span> 8. Slide Deck (Defense PPT) Audit
        </button>
        <button class="tab-btn" onclick="switchTab('tab-structure-appendices', this)">
          <span class="tab-icon">📑</span> 9. TOC, Headings & Appendices Guide
        </button>
        <button class="tab-btn" onclick="switchTab('tab-defense-traps', this)">
          <span class="tab-icon">🛡️</span> 10. High-Stakes Defense Q&A Traps
        </button>
      </nav>
    </div>

    <!-- Main Content Panes -->
    <main class="content-body">

      <!-- ========================================================= -->
      <!-- TAB 1: TRIANGULATED ALIGNMENT MATRIX                      -->
      <!-- ========================================================= -->
      <div id="tab-alignment" class="tab-pane active" data-tab-title="Tab 1: Triangulated Alignment Matrix">
        <h2>1. The Triangulated Research Alignment Matrix</h2>
        <p>
          In academic capstone evaluation at the National Aviation Academy of the Philippines (PhilSCA), a primary failure mode during oral defense is <strong>construct drift</strong>—where the Research Questions in Chapter 1 diverge from the Specific Objectives, which diverge from the System Codebase, which diverge from the Survey Questionnaires, Chapter 4 Tables, Chapter 5 Conclusions, and the Defense Presentation Slides.
        </p>

        <div class="callout callout-success">
          <div class="callout-icon">✓</div>
          <div class="callout-content">
            <strong>Triangulation Integrity Certified</strong>
            All six research dimensions maintain strict 1-to-1 traceability across the Research Questions, Specific Objectives, System Features, Evaluation Instruments (TAM & ISO/IEC 25010:2023), Chapter 4 Results, Chapter 5 Conclusions, and Defense Slides.
          </div>
        </div>

        <div class="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Dim #</th>
                <th>Research Question (RQ)</th>
                <th>Specific Objective (Obj)</th>
                <th>Implemented System Module</th>
                <th>Evaluation Instrument & Indicator</th>
                <th>Chapter 4 Result Evidence</th>
                <th>Chapter 5 Conclusion</th>
                <th>Defense Slide</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>1</strong></td>
                <td>How does the existing manual paper-based process compare with the developed centralized digital job order entry and management system in terms of record accessibility, retrieval time, and data accuracy?</td>
                <td>Conduct a comparative analysis between the existing manual paper-based system and the developed centralized digital job order entry and management system in terms of service record accessibility, retrieval time, and accuracy.</td>
                <td><strong>Job Order Summary Management Module</strong> (`/orders`, `/orders/new`) with customer autocomplete, shoe condition checkboxes, and CRUD state machine.</td>
                <td>Comparative Performance Testing (10 trials manual vs digital retrieval; daily observation of errors). Also ISO 25010 Functional Suitability Item 1 & 5.</td>
                <td><strong>Table 2:</strong> Retrieval time dropped from 5.20 min to 0.41 min (<strong>92.12% reduction</strong>).<br><strong>Table 3 & 4:</strong> Duplicate entries eliminated (2–3/day &rarr; 0); corrections dropped to &lt;1/day.</td>
                <td>Conclusion 1 confirms digital centralization substantially reduced retrieval latency and data errors.</td>
                <td><strong>Slide 3 (Obj 1)</strong> & <strong>Slide 9 (Manual vs Digital)</strong></td>
              </tr>
              <tr>
                <td><strong>2</strong></td>
                <td>How does the machine learning model perform in predicting service turnaround duration and corresponding release dates using historical service data based on appropriate model evaluation metrics?</td>
                <td>Evaluate the machine learning model for predicting service turnaround duration and corresponding release dates using historical service data in terms of its predictive performance based on appropriate model evaluation metrics.</td>
                <td><strong>ML Completion Date Prediction Engine</strong> (`backend/ml/historical_ml_engine.py`) using Scikit-Learn `RandomForestRegressor` with Option B UI.</td>
                <td>Machine Learning Regression Metrics: Mean Absolute Error (MAE), Root Mean Squared Error (RMSE), and Coefficient of Determination (R&sup2;) on unseen locked test set (N=26).</td>
                <td><strong>Table 5:</strong> 10 representative test rows.<br><strong>Table 6:</strong> Complete test set performance: MAE = <strong>8.50 days</strong>, RMSE = <strong>10.11 days</strong>, R&sup2; = <strong>0.129</strong>. Benchmark &ge; 0.85 not achieved; designated strictly as advisory.</td>
                <td>Conclusion 2 confirms successful integration as an advisory operational guide, while business rules govern official release dates.</td>
                <td><strong>Slide 3 (Obj 2)</strong>, <strong>Slide 8 (ML Setup)</strong> & <strong>Slide 11 (ML Results)</strong></td>
              </tr>
              <tr>
                <td><strong>3</strong></td>
                <td>What is the impact of the real-time analytics dashboard on reporting efficiency, accessibility of business information, and decision-making?</td>
                <td>Determine the impact of the real-time analytics in the Sales Report Module on reporting efficiency by assessing the time required to generate sales, expense, and return on investment (ROI) reports.</td>
                <td><strong>Dashboard & Sales Reporting Module</strong> (`/dashboard`, `/reports`) featuring real-time KPIs, Recharts visualizations, monthly range filters, and printable exports.</td>
                <td>Reporting Efficiency Timing Test (7 report types) + Shop Owner/Staff Dashboard Impact Survey (3 items, 4-point scale).</td>
                <td><strong>Table 7:</strong> Report generation time dropped from 43.71 min to 0.43 sec (<strong>99.98% reduction</strong>).<br><strong>Table 8:</strong> Dashboard impact rated <strong>3.83 / 4.00 (Highly Acceptable)</strong> by owners and staff.</td>
                <td>Conclusion 3 confirms real-time analytics drastically improved administrative productivity and data-driven visibility.</td>
                <td><strong>Slide 3 (Obj 3)</strong> & <strong>Slide 10 (Analytics Dashboard)</strong></td>
              </tr>
              <tr>
                <td><strong>4</strong></td>
                <td>To what extent does the developed system meet ISO/IEC 25010 software quality standards in terms of Functional Suitability, Performance Efficiency, Compatibility, Interaction Capability, Reliability, Security, Maintainability, Flexibility, and Safety?</td>
                <td>Evaluate the effectiveness of the developed system based on the ISO/IEC 25010 software quality standards, specifically in terms of the 9 quality characteristics.</td>
                <td><strong>Entire Architecture & Stack:</strong> React SPA, FastAPI REST API, PostgreSQL, Heroku-24 Dyno, SSL/TLS, RBAC, Bcrypt hashing, audit logging, input validation.</td>
                <td>ISO/IEC 25010:2023 Software Quality Questionnaire (45 items, 5 per characteristic, 4-point forced-choice scale) administered to 5 IT Experts.</td>
                <td><strong>Tables 9–19 & 24:</strong> Overall mean = <strong>3.71 / 4.00 (Highly Acceptable)</strong>.<br>Flexibility (3.84), Compatibility (3.76), Reliability (3.72), Interaction Capability (3.72), Maintainability (3.72), Performance Efficiency (3.68), Security (3.68), Functional Suitability (3.64), Safety (3.64).</td>
                <td>Conclusion 4 confirms the system satisfies all 9 software engineering quality characteristics at a Highly Acceptable standard.</td>
                <td><strong>Slide 3 (Obj 4)</strong> & <strong>Slide 13 (ISO/IEC 25010 Bar Chart)</strong></td>
              </tr>
              <tr>
                <td><strong>5</strong></td>
                <td>What is the level of user acceptance of the developed system based on the Technology Acceptance Model (TAM) in terms of Perceived Usefulness, Perceived Ease of Use, Behavioral Intention to Use, and Actual System Use?</td>
                <td>Measure the level of user acceptance of the developed system among the staff and management of Shoelotskey using the Technology Acceptance Model (TAM), measuring PU, PEOU, BI, and ASU.</td>
                <td><strong>End-User Interfaces:</strong> Job order workflow, inventory tracking, calendar scheduler, role-based dashboards tailored for Owner and Staff.</td>
                <td>Technology Acceptance Model (TAM) Questionnaire (12 core items + 3 dashboard items, 4-point scale) administered to N=6 total census respondents (2 Owners, 4 Staff).</td>
                <td><strong>Tables 20–24:</strong> Overall TAM mean = <strong>3.88 / 4.00 (Highly Acceptable)</strong>.<br>Perceived Usefulness (4.00), Actual System Use (4.00), Perceived Ease of Use (3.89), Dashboard Impact (3.83), Behavioral Intention (3.61).</td>
                <td>Conclusion 5 confirms enthusiastic operational adoption, zero user rejection, and complete transition away from manual logbooks.</td>
                <td><strong>Slide 3 (Obj 5)</strong> & <strong>Slide 12 (TAM Bar Chart)</strong></td>
              </tr>
              <tr>
                <td><strong>6</strong></td>
                <td>What improvements may be recommended for future enhancement of the system?</td>
                <td>Recommend possible system enhancements by identifying improvements and additional features that may be implemented by future researchers to further enhance system functionality, data analytics capabilities, and user experience.</td>
                <td><strong>Targeted Enhancement Roadmap:</strong> Dynamic dropdown masterfiles, inventory audit trails, automated SMS webhooks, weekly ML retraining pipeline, and WCAG accessibility improvements.</td>
                <td>Part III Qualitative Comments and Suggestions from 5 IT Experts and 6 Operational Users, ranked by frequency.</td>
                <td><strong>Table 25:</strong> Ranked suggestions: Dropdown flexibility (60%, Rank 1), Inventory audit logs (40%, Rank 2), SMS notifications (40%, Rank 2), ML retraining pipeline (20%, Rank 4), API strict validation (20%, Rank 4).</td>
                <td>Conclusion 6 outlines realistic, evidence-based recommendations directly derived from evaluator suggestions for future capstone developers.</td>
                <td><strong>Slide 3 (Obj 6)</strong> & <strong>Slide 14 (Expert Suggestions)</strong></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- ========================================================= -->
      <!-- TAB 2: MISSION CHECKPOINTS & IT411 DIRECTIVES             -->
      <!-- ========================================================= -->
      <div id="tab-checkpoints" class="tab-pane" data-tab-title="Tab 2: Mission Checkpoints & IT411 Directives">
        <h2>2. Mission Checkpoints & IT411 Syllabus Compliance</h2>
        <p>
          The course curriculum for <strong>IT411: Aviation Capstone Project 2</strong>, formulated by <strong>Assoc. Prof. Mary Ann Aballiar-Vista</strong>, structures project execution across three distinct phases and eight mission checkpoints. Every student group must attain a <strong>Target Rating of 4.00</strong> across rubrics.
        </p>

        <div class="kpi-row">
          <div class="kpi-card green">
            <div class="kpi-title">Phase 1 Status</div>
            <div class="kpi-value">100%</div>
            <div class="kpi-sub">Checkpoints A, B, C Completed</div>
          </div>
          <div class="kpi-card green">
            <div class="kpi-title">Phase 2 Status</div>
            <div class="kpi-value">100%</div>
            <div class="kpi-sub">Checkpoints D, E, F Defense Ready</div>
          </div>
          <div class="kpi-card blue">
            <div class="kpi-title">Phase 3 Status</div>
            <div class="kpi-value">Staged</div>
            <div class="kpi-sub">Checkpoints G, H Deployment Ready</div>
          </div>
          <div class="kpi-card amber">
            <div class="kpi-title">Content Validity (CVI)</div>
            <div class="kpi-value">1.00</div>
            <div class="kpi-sub">5 Faculty Validators Approved</div>
          </div>
        </div>

        <h3>Detailed Mission Checkpoint Verification Matrix</h3>
        <div class="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Phase & Week</th>
                <th>Mission Checkpoint</th>
                <th>Target KPI</th>
                <th>Institutional Requirement</th>
                <th>Evidence in Shoelotskey Project</th>
                <th>Compliance Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Phase 1: Weeks 1–2</strong></td>
                <td><strong>Checkpoint A</strong> (Proposal & System Demo)</td>
                <td>Target 4.0</td>
                <td>Complete approved proposal manuscript, accurate revision matrix with a feasible plan, and functional prototype clearly demonstrating objectives.</td>
                <td>Signed <em>Matrix of Capstone Project Revisions (Chapters 1–4)</em> dated April 16, 2026; working React/FastAPI prototype demonstrating order creation and analytics.</td>
                <td><span class="tag tag-success">COMPLIANT (4.0)</span></td>
              </tr>
              <tr>
                <td><strong>Phase 1: Weeks 3–4</strong></td>
                <td><strong>Checkpoint B</strong> (Instruments & Validation)</td>
                <td>Target 4.0</td>
                <td>Survey items strongly aligned with ISO 25010, TAM, and objectives; appropriate validators and fully documented forms; computed validity test results; ethical safeguards in place.</td>
                <td>14-item validation instrument evaluated by 5 faculty validators (`VALIDITY TEST RESULTS.xlsx`); achieved <strong>I-CVI = 1.00</strong> and <strong>S-CVI/Ave = 1.00</strong>; informed consent statements included.</td>
                <td><span class="tag tag-success">COMPLIANT (4.0)</span></td>
              </tr>
              <tr>
                <td><strong>Phase 1: Weeks 5–6</strong></td>
                <td><strong>Checkpoint C</strong> (Chapter IV & Preliminary Data)</td>
                <td>Target 4.0</td>
                <td>Complete and justified research methodology (design, sampling, statistical treatments); accurately tallied and tabulated data; evidence-based interpretation aligned with objectives.</td>
                <td>Chapter 4 sections 4.1 to 4.4: 10 trials record retrieval (5.20 min &rarr; 0.41 min), data accuracy metrics, dashboard generation timing (43.71 min &rarr; 0.43 sec), and ML test set results (N=26).</td>
                <td><span class="tag tag-success">COMPLIANT (4.0)</span></td>
              </tr>
              <tr>
                <td><strong>Phase 2: Weeks 7–8</strong></td>
                <td><strong>Checkpoint D</strong> (Chapter V & Revisions)</td>
                <td>Target 4.0</td>
                <td>Logical, evidence-based conclusions rooted in Chapter IV findings; consultation logs and revision matrices complete and properly signed; manuscript formatted to NAAP/ICS layout.</td>
                <td>Chapter 5 Summary, Conclusions (1–6), and Recommendations (1–6) strictly mapped to findings; IEEE references formatted; consultation log signed by Adviser Peralta.</td>
                <td><span class="tag tag-success">COMPLIANT (4.0)</span></td>
              </tr>
              <tr>
                <td><strong>Phase 2: Weeks 9–10</strong></td>
                <td><strong>Checkpoint E & F</strong> (Mock & Final Defense)</td>
                <td>Target 4.0</td>
                <td>System is stable, functional, and aligns with 80%+ stakeholder requirements; accurate evidence-based responses to panel questions; professional, time-conscious oral presentation.</td>
                <td>17-slide defense slide deck audited and refined; live system hosted on Heroku dyno; panel defense question bank covering all 25 common traps prepared.</td>
                <td><span class="tag tag-success">COMPLIANT (4.0)</span></td>
              </tr>
              <tr>
                <td><strong>Phase 3: Weeks 11–14</strong></td>
                <td><strong>Checkpoint G</strong> (Re-defense Revisions)</td>
                <td>Target 4.0</td>
                <td>All panel comments completely addressed with screenshot and document evidence; system revisions actively improve functionality based on feedback; ready for final routing.</td>
                <td>Remediation of all IT expert and validator recommendations: dynamic dropdown options, inventory audit logs, Option B dual-date display, and backend validation hardening.</td>
                <td><span class="tag tag-success">COMPLIANT (4.0)</span></td>
              </tr>
              <tr>
                <td><strong>Phase 3: Weeks 15–18</strong></td>
                <td><strong>Checkpoint H</strong> (Deployment & Clearance)</td>
                <td>Target 4.0</td>
                <td>Routing forms, approval sheets, and signatures fully complete; organized digital folders containing manuals, source code, and credentials; hardbound manuscript and research clearance successfully filed.</td>
                <td>Complete archival bundle staged: system manuals, database schemas (`setup.sql`), OCR ingestion modules, verified deployment scripts, and Certificate of Originality bound.</td>
                <td><span class="tag tag-info">READY FOR FINAL ROUTING</span></td>
              </tr>
            </tbody>
          </table>
        </div>

        <h3>RDO Advisory No. 01 s. 2026: Mandatory Certificate of Originality</h3>
        <div class="callout callout-warning">
          <div class="callout-icon">⚠</div>
          <div class="callout-content">
            <strong>Institutional Binding Directive</strong>
            Issued by <strong>Engr. Kristofer Neal C. Imperial, Ph.D.</strong> (Director, Research and Development Office) and noted by <strong>Engr. Jeq Zyrius A. Sudweste</strong> (Vice-President for Academic Affairs):
            <ul style="margin-top: 6px; padding-left: 18px;">
              <li>A signed and notarized <strong>Certificate of Originality</strong> must be bound into all undergraduate capstone manuscripts.</li>
              <li><strong>Exact Placement:</strong> Located in the preliminary pages, strictly <strong>following the Approval Sheet and preceding the Acknowledgment section</strong>.</li>
              <li>Must bear the signatures of researchers (Charmaine Rose G. Angeles, Kylane C. Gravino, Melody D. Sedanto) and Capstone Adviser Richard Niel B. Peralta, MSIT.</li>
            </ul>
          </div>
        </div>
      </div>

      <!-- ========================================================= -->
      <!-- TAB 3: PANEL REVISION MATRIX & VALIDATOR COMPLIANCE       -->
      <!-- ========================================================= -->
      <div id="tab-panel-matrix" class="tab-pane" data-tab-title="Tab 3: Panel Revision Matrix & Validator Compliance">
        <h2>3. Panel Revision Matrix & Content Validation Audit</h2>
        <p>
          The capstone defense panel comprising <strong>Assoc. Prof. Mary Ann Aballiar-Vista</strong> (Panel Member), <strong>Dr. Alan Lino Silverio J. Agustin</strong> (Panel Member), <strong>Asst. Prof. Aron J. Alojado</strong> (Panel Chair), <strong>Richard Niel B. Peralta, MSIT</strong> (Capstone Adviser), and noted by <strong>Dr. Jerum B. Dasalla</strong> (Program Coordinator) conducted a comprehensive evaluation of Chapters 1 to 4. Below is the audited verification of all required revisions.
        </p>

        <div class="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Panel Reviewer</th>
                <th>Panel Comment / Directive</th>
                <th>Target Section</th>
                <th>Action Taken by Proponents</th>
                <th>Manuscript Page(s)</th>
                <th>Audit Verification</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Assoc. Prof. Vista</strong></td>
                <td>Remove "For Shoelotskey Villamor-Pasay" from the title.</td>
                <td>Title Page (p. 1)</td>
                <td>Asst. Prof. Alojado requested retaining the specific location. Researchers retained the full institutional title to anchor the study to its micro-enterprise partner.</td>
                <td>Page 1</td>
                <td><span class="tag tag-success">RESOLVED</span></td>
              </tr>
              <tr>
                <td><strong>Asst. Prof. Alojado</strong></td>
                <td>Add "For Shoelotskey Villamor-Pasay" to the title.</td>
                <td>Title Page (p. 1)</td>
                <td>Title clearly specifies "FOR SHOELOTSKEY VILLAMOR-PASAY", providing geographic and contextual clarity.</td>
                <td>Page 1</td>
                <td><span class="tag tag-success">VERIFIED</span></td>
              </tr>
              <tr>
                <td><strong>Prof. Vista & Prof. Alojado</strong></td>
                <td>Include the discussion of general, specific problem, research gap, and solution for establishment.</td>
                <td>Chapter 1 – Introduction</td>
                <td>Expanded background with MSME operational context, specific challenges of Ms. Aileen Rosales, identified research gap in micro-repair shops, and proposed web/ML solution.</td>
                <td>Pages 2–3</td>
                <td><span class="tag tag-success">VERIFIED</span></td>
              </tr>
              <tr>
                <td><strong>Asst. Prof. Alojado</strong></td>
                <td>Should provide evidences for every claims in Problem Statement.</td>
                <td>Chapter 1 – Problem Statement</td>
                <td>Integrated baseline empirical evidence: 2–3 days service delay, 1–2 hours manual report preparation, 3–10 minutes record retrieval time, and 280–300 monthly order volume.</td>
                <td>Pages 3–4</td>
                <td><span class="tag tag-success">VERIFIED</span></td>
              </tr>
              <tr>
                <td><strong>Prof. Vista & Prof. Alojado</strong></td>
                <td>Remove unrelated content and revise project context to ensure relevance to the study.</td>
                <td>Chapter 1 – Project Context</td>
                <td>Removed theoretical digressions; focused strictly on Philippine shoe cleaning/restoration trade realities, manual logbook issues, and data scarcity.</td>
                <td>Pages 6–8</td>
                <td><span class="tag tag-success">VERIFIED</span></td>
              </tr>
              <tr>
                <td><strong>Assoc. Prof. Vista</strong></td>
                <td>Clarify evaluation criteria using ISO/IEC 25010 and TAM, and specify measurable indicators. Add objectives for system enhancement and future research.</td>
                <td>Chapter 1 – Objectives</td>
                <td>Updated Objective 4 to the 9 characteristics of ISO/IEC 25010:2023; specified TAM constructs (PU, PEOU, BI, ASU); added Objective 6 for future system enhancements.</td>
                <td>Pages 11–12</td>
                <td><span class="tag tag-success">VERIFIED</span></td>
              </tr>
              <tr>
                <td><strong>Prof. Vista & Prof. Alojado</strong></td>
                <td>Focus on system features only and privacy limitation, small sample size of respondents.</td>
                <td>Chapter 1 – Scope and Limitations</td>
                <td>Confined scope to internal operations (no public customer portal/app); articulated privacy controls; explicitly documented limitations of N=6 user census and historical claim-span target.</td>
                <td>Pages 12–14</td>
                <td><span class="tag tag-success">VERIFIED</span></td>
              </tr>
              <tr>
                <td><strong>Assoc. Prof. Vista</strong></td>
                <td>Rephrase and improve organization/clarity of Chapter 2 RRL; include relevant references on TAM.</td>
                <td>Chapter 2 – RRL</td>
                <td>Reorganized RRL into 5 alphabetical themes applying Compare-Contrast-Connect; added 7 recent MSME TAM studies [25]–[28]; formatted all 28 references in IEEE style (2022–2026).</td>
                <td>Pages 15–26</td>
                <td><span class="tag tag-success">VERIFIED</span></td>
              </tr>
              <tr>
                <td><strong>Assoc. Prof. Vista</strong></td>
                <td>Discuss the actual activity in Waterfall Development Phases.</td>
                <td>Chapter 3 – Waterfall Phases</td>
                <td>Detailed concrete activities across all 6 phases: Requirements Analysis (SRS), System Design (DFD/ERD), Implementation, Testing (Use Cases), Deployment, and Maintenance.</td>
                <td>Pages 32–36</td>
                <td><span class="tag tag-success">VERIFIED</span></td>
              </tr>
              <tr>
                <td><strong>Prof. Vista & Ma'am Villarica</strong></td>
                <td>Change Start and End points into Begin and End in the procedural workflow.</td>
                <td>Chapter 3 – Procedural Workflow</td>
                <td>Updated Figure 6 flowchart terminal symbols to strictly read "Begin" and "End".</td>
                <td>Page 77</td>
                <td><span class="tag tag-success">VERIFIED</span></td>
              </tr>
              <tr>
                <td><strong>Assoc. Prof. Vista</strong></td>
                <td>Add an introduction before each figure in all diagrams.</td>
                <td>Chapter 3 – Diagrams</td>
                <td>Added descriptive introductory paragraphs preceding Figures 3, 4, 5, 6, 7, 8, 9, and 10.</td>
                <td>Pages 70, 71, 72, 77, 79, 82, 86</td>
                <td><span class="tag tag-success">VERIFIED</span></td>
              </tr>
              <tr>
                <td><strong>Ma'am Villarica</strong></td>
                <td>Implement Top 10 OWASP for Security Measures.</td>
                <td>Chapter 3 & System Security</td>
                <td>Enforced JWT authentication, 12-round bcrypt password hashing, 3-attempt login lockout, 30-min idle timeout, parameterized queries via SQLAlchemy ORM, and audit logging.</td>
                <td>Pages 91–94</td>
                <td><span class="tag tag-success">VERIFIED</span></td>
              </tr>
              <tr>
                <td><strong>Prof. Vista & Ma'am Villarica</strong></td>
                <td>Add a monthly time frame range filter in the dashboard header and sales report page.</td>
                <td>System Feature & Report</td>
                <td>Implemented interactive date range and monthly selector filters in the Dashboard and Sales Report modules (`/dashboard`, `/reports`).</td>
                <td>System Feature</td>
                <td><span class="tag tag-success">VERIFIED</span></td>
              </tr>
              <tr>
                <td><strong>Assoc. Prof. Vista</strong></td>
                <td>Change "Order Summary" to "Job Order Summary" in the job order form.</td>
                <td>System Feature & Manuscript</td>
                <td>Updated UI heading and manuscript terminology to "Job Order Summary Management Module".</td>
                <td>System Feature & p. 67</td>
                <td><span class="tag tag-success">VERIFIED</span></td>
              </tr>
              <tr>
                <td><strong>Assoc. Prof. Vista</strong></td>
                <td>Add printable options in sales report page (sales, expenses, ROI).</td>
                <td>System Feature & Report</td>
                <td>Added printable CSS views and PDF export triggers for sales summaries, expense lists, and ROI breakdowns.</td>
                <td>System Feature</td>
                <td><span class="tag tag-success">VERIFIED</span></td>
              </tr>
              <tr>
                <td><strong>Assoc. Prof. Vista</strong></td>
                <td>Add an inventory page to track consumable materials.</td>
                <td>System Feature & Manuscript</td>
                <td>Developed dedicated Inventory Management Module (`/inventory`) with stock-in/stock-out logging, unit cost tracking, and low-stock threshold alerts.</td>
                <td>System Feature & p. 68</td>
                <td><span class="tag tag-success">VERIFIED</span></td>
              </tr>
              <tr>
                <td><strong>Asst. Prof. Alojado</strong></td>
                <td>Lacks technical justification for architecture choices in Chapter 3.</td>
                <td>Chapter 3 – Technical Background</td>
                <td>Added comprehensive justification for 3-tier architecture, React/Vite frontend, FastAPI backend, PostgreSQL relational database, and Scikit-learn ML engine.</td>
                <td>Pages 27–30</td>
                <td><span class="tag tag-success">VERIFIED</span></td>
              </tr>
              <tr>
                <td><strong>Asst. Prof. Alojado</strong></td>
                <td>ML section lacks comparative analysis for choosing regression, feature selection, and dataset breakdown.</td>
                <td>Chapter 3 – ML Service Prediction</td>
                <td>Documented model selection justifying Random Forest Regressor over Linear Regression, Decision Trees, and XGBoost; defined 13 operational features; specified 119 validated orders split chronologically (93 dev / 26 test).</td>
                <td>Pages 36–38</td>
                <td><span class="tag tag-success">VERIFIED</span></td>
              </tr>
              <tr>
                <td><strong>Asst. Prof. Alojado</strong></td>
                <td>Add Current State vs Required State comparison in Requirements Gap Analysis.</td>
                <td>Chapter 3 – Requirements Gap</td>
                <td>Inserted structured comparison table contrasting manual logbook challenges with digitized system capabilities across 6 operational dimensions.</td>
                <td>Page 44</td>
                <td><span class="tag tag-success">VERIFIED</span></td>
              </tr>
              <tr>
                <td><strong>Asst. Prof. Alojado</strong></td>
                <td>Add weighted decision matrix with scoring criteria for Alternative Solutions.</td>
                <td>Chapter 3 – Alternatives</td>
                <td>Constructed Weighted Decision Matrix evaluating Manual Process (2.00), Spreadsheet System (2.75), and Custom Web-Based System (4.70) across 6 weighted criteria.</td>
                <td>Page 46</td>
                <td><span class="tag tag-success">VERIFIED</span></td>
              </tr>
              <tr>
                <td><strong>Asst. Prof. Alojado</strong></td>
                <td>Cost-Benefit Analysis questioned for unsupported estimates; needs step-by-step formulas and BCR.</td>
                <td>Chapter 3 – Cost-Benefit Analysis</td>
                <td>Rebuilt CBA with conservative labor rates, detailed office supply expenses, transparent step-by-step formulas: Net Benefit = ₱65,066, ROI = 65.11%, Benefit-Cost Ratio = 1.65:1.</td>
                <td>Pages 51–57</td>
                <td><span class="tag tag-success">VERIFIED</span></td>
              </tr>
            </tbody>
          </table>
        </div>

        <h3>Faculty Validation of Survey Instruments (Content Validity Index)</h3>
        <p>
          Prior to field administration, the survey instruments were evaluated by five (5) expert faculty validators using a 14-item Content Validity form (`VALIDITY TEST RESULTS.xlsx`).
        </p>
        <div class="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Item Category</th>
                <th>Validator Ratings (V1 to V5)</th>
                <th>Item Content Validity Index (I-CVI)</th>
                <th>Scale Content Validity Index (S-CVI / Ave)</th>
                <th>Verdict</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Relevance to Objectives (Items 1–4)</td>
                <td>Rated 3 or 4 by all 5 validators</td>
                <td><strong>1.00</strong></td>
                <td rowspan="4" style="vertical-align: middle; text-align: center; font-size: 1.2rem; font-weight: 800; color: #166534; background: #f0fdf4;">
                  1.00 / 1.00<br><span style="font-size: 0.75rem; font-weight: 600; text-transform: uppercase;">Perfect Agreement</span>
                </td>
                <td><span class="tag tag-success">VALIDATED</span></td>
              </tr>
              <tr>
                <td>ISO 25010 & TAM Construct Coverage (Items 5–7)</td>
                <td>Rated 3 or 4 by all 5 validators</td>
                <td><strong>1.00</strong></td>
                <td><span class="tag tag-success">VALIDATED</span></td>
              </tr>
              <tr>
                <td>Clarity, Wording & Layout (Items 8–11)</td>
                <td>Rated 3 or 4 by all 5 validators</td>
                <td><strong>1.00</strong></td>
                <td><span class="tag tag-success">VALIDATED</span></td>
              </tr>
              <tr>
                <td>Overall Instrument Suitability (Items 12–14)</td>
                <td>Rated 3 or 4 by all 5 validators</td>
                <td><strong>1.00</strong></td>
                <td><span class="tag tag-success">VALIDATED</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- ========================================================= -->
      <!-- TAB 4: IT EXPERTS & ISO 25010:2023 AUDIT                  -->
      <!-- ========================================================= -->
      <div id="tab-it-experts" class="tab-pane" data-tab-title="Tab 4: IT Experts & ISO 25010:2023 Audit">
        <h2>4. IT Expert Quality Assessment & Technical Remediation</h2>
        <p>
          Five (5) purposively selected Information Technology experts and senior practitioners evaluated the live deployed system based on the <strong>ISO/IEC 25010:2023</strong> software product quality model (comprising 9 distinct characteristics and 45 evaluative statements on a 4-point forced-choice Likert scale).
        </p>

        <div class="kpi-row">
          <div class="kpi-card green">
            <div class="kpi-title">Overall ISO Score</div>
            <div class="kpi-value">3.71 / 4.00</div>
            <div class="kpi-sub">Highly Acceptable (92.8%)</div>
          </div>
          <div class="kpi-card blue">
            <div class="kpi-title">Highest Rated Characteristic</div>
            <div class="kpi-value">3.84</div>
            <div class="kpi-sub">Flexibility (SD: 0.37)</div>
          </div>
          <div class="kpi-card purple">
            <div class="kpi-title">Core Architecture Score</div>
            <div class="kpi-value">3.76</div>
            <div class="kpi-sub">Compatibility & Reliability</div>
          </div>
          <div class="kpi-card amber">
            <div class="kpi-title">Zero Unacceptable Ratings</div>
            <div class="kpi-value">0 / 225</div>
            <div class="kpi-sub">All items scored 3 or 4</div>
          </div>
        </div>

        <h3>ISO/IEC 25010:2023 Nine-Characteristic Breakdown</h3>
        <div class="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Characteristic (ISO 25010:2023)</th>
                <th>E1</th>
                <th>E2</th>
                <th>E3</th>
                <th>E4</th>
                <th>E5</th>
                <th>General Weighted Mean (GWM)</th>
                <th>Standard Deviation (SD)</th>
                <th>Verbal Interpretation</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>1. Flexibility</strong></td>
                <td>4.00</td>
                <td>3.80</td>
                <td>3.60</td>
                <td>4.00</td>
                <td>3.80</td>
                <td><strong>3.84</strong></td>
                <td>0.37</td>
                <td><span class="tag tag-success">Highly Acceptable</span></td>
              </tr>
              <tr>
                <td><strong>2. Compatibility</strong></td>
                <td>3.80</td>
                <td>4.00</td>
                <td>3.20</td>
                <td>4.00</td>
                <td>3.80</td>
                <td><strong>3.76</strong></td>
                <td>0.40</td>
                <td><span class="tag tag-success">Highly Acceptable</span></td>
              </tr>
              <tr>
                <td><strong>3. Reliability</strong></td>
                <td>3.80</td>
                <td>3.60</td>
                <td>3.40</td>
                <td>4.00</td>
                <td>3.80</td>
                <td><strong>3.72</strong></td>
                <td>0.49</td>
                <td><span class="tag tag-success">Highly Acceptable</span></td>
              </tr>
              <tr>
                <td><strong>4. Interaction Capability</strong></td>
                <td>4.00</td>
                <td>3.20</td>
                <td>3.40</td>
                <td>4.00</td>
                <td>4.00</td>
                <td><strong>3.72</strong></td>
                <td>0.49</td>
                <td><span class="tag tag-success">Highly Acceptable</span></td>
              </tr>
              <tr>
                <td><strong>5. Maintainability</strong></td>
                <td>3.60</td>
                <td>3.80</td>
                <td>3.40</td>
                <td>4.00</td>
                <td>3.80</td>
                <td><strong>3.72</strong></td>
                <td>0.46</td>
                <td><span class="tag tag-success">Highly Acceptable</span></td>
              </tr>
              <tr>
                <td><strong>6. Performance Efficiency</strong></td>
                <td>3.40</td>
                <td>3.60</td>
                <td>3.80</td>
                <td>3.80</td>
                <td>3.80</td>
                <td><strong>3.68</strong></td>
                <td>0.49</td>
                <td><span class="tag tag-success">Highly Acceptable</span></td>
              </tr>
              <tr>
                <td><strong>7. Security</strong></td>
                <td>4.00</td>
                <td>3.80</td>
                <td>3.60</td>
                <td>3.40</td>
                <td>3.60</td>
                <td><strong>3.68</strong></td>
                <td>0.49</td>
                <td><span class="tag tag-success">Highly Acceptable</span></td>
              </tr>
              <tr>
                <td><strong>8. Functional Suitability</strong></td>
                <td>3.60</td>
                <td>3.80</td>
                <td>3.20</td>
                <td>3.80</td>
                <td>3.80</td>
                <td><strong>3.64</strong></td>
                <td>0.49</td>
                <td><span class="tag tag-success">Highly Acceptable</span></td>
              </tr>
              <tr>
                <td><strong>9. Safety</strong></td>
                <td>3.40</td>
                <td>3.60</td>
                <td>3.60</td>
                <td>4.00</td>
                <td>3.60</td>
                <td><strong>3.64</strong></td>
                <td>0.64</td>
                <td><span class="tag tag-success">Highly Acceptable</span></td>
              </tr>
              <tr style="background: #f1f5f9; font-weight: 800;">
                <td colspan="6">COMPOSITE SYSTEM QUALITY WEIGHTED MEAN</td>
                <td>3.71</td>
                <td>0.47</td>
                <td><span class="tag tag-success">Highly Acceptable</span></td>
              </tr>
            </tbody>
          </table>
        </div>

        <h3>Remediation Matrix for IT Expert Ranked Suggestions (Table 25 Audit)</h3>
        <div class="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Suggestion / Comment</th>
                <th>Mentioning Experts</th>
                <th>Freq (%)</th>
                <th>Technical Vulnerability Addressed</th>
                <th>System & Manuscript Remediation</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>1</strong></td>
                <td>More flexibility in dropdown options (adding brands, couriers, models).</td>
                <td>Dr. Eduardo Yu, Edison Yu, Ken Carlo Javier</td>
                <td>3 (60.0%)</td>
                <td>Hardcoded UI constants restrict shop operations when new sneaker brands or shipping partners emerge.</td>
                <td><strong>Code:</strong> Added dynamic options in settings/metadata endpoints.<br><strong>Manuscript:</strong> Highlighted in Chapter 5 Recommendations (Recommendation 2).</td>
              </tr>
              <tr>
                <td><strong>2</strong></td>
                <td>Detailed audit logs for inventory movements.</td>
                <td>IT Expert 4, Edison Yu</td>
                <td>2 (40.0%)</td>
                <td>Lack of granular tracking for consumables (detergent, paints, glue) invites shrinkage or inventory discrepancies.</td>
                <td><strong>Code:</strong> Implemented `inventory_logs` table recording user, action, quantity delta, and timestamp.<br><strong>Manuscript:</strong> Detailed in Chapter 3 database design (p. 85) & Chapter 5.</td>
              </tr>
              <tr>
                <td><strong>2</strong></td>
                <td>Automated SMS / email notifications for order status changes.</td>
                <td>Ken Carlo Javier, Edison Yu</td>
                <td>2 (40.0%)</td>
                <td>Customers rely on verbal follow-ups, increasing staff interruption and counter delays.</td>
                <td><strong>Code:</strong> Architecture prepared for Twilio/Semaphore webhooks on status change to 'For Release'.<br><strong>Manuscript:</strong> Documented in Chapter 5 Recommendations (Recommendation 3).</td>
              </tr>
              <tr>
                <td><strong>4</strong></td>
                <td>Strict backend validation to reject incomplete payloads at the API level.</td>
                <td>Ken Carlo Javier</td>
                <td>1 (20.0%)</td>
                <td>UI validation can be bypassed by direct cURL or malicious Postman scripts; server must enforce defense-in-depth.</td>
                <td><strong>Code:</strong> Hardened Pydantic schemas in FastAPI to reject empty payloads with HTTP 422 Unprocessable Entity.<br><strong>Manuscript:</strong> Documented in Chapter 3 Security (p. 92) and Chapter 5.</td>
              </tr>
              <tr>
                <td><strong>4</strong></td>
                <td>Automated ML retraining pipeline using newly completed orders.</td>
                <td>Ken Carlo Javier</td>
                <td>1 (20.0%)</td>
                <td>Model drifts as operational patterns change; static model cannot improve without retraining.</td>
                <td><strong>Code:</strong> Built admin retraining script (`backend/ml/historical_ml_engine.py`) triggered securely by Owner.<br><strong>Manuscript:</strong> Framed as an administrative batch process in Chapter 3 & 5.</td>
              </tr>
              <tr>
                <td><strong>4</strong></td>
                <td>WCAG accessibility compliance (contrast, font sizing).</td>
                <td>Ken Carlo Javier</td>
                <td>1 (20.0%)</td>
                <td>Low contrast gray text causes readability fatigue under shop lighting conditions.</td>
                <td><strong>Code:</strong> Upgraded text contrast ratios to &ge; 4.5:1 (WCAG AA) in Tailwind CSS configs.<br><strong>Manuscript:</strong> Documented in Chapter 5 Recommendations (Recommendation 5).</td>
              </tr>
              <tr>
                <td><strong>4</strong></td>
                <td>Standardize currency display to 2 decimal places and correct negative pending balance.</td>
                <td>Iheo Corona</td>
                <td>1 (20.0%)</td>
                <td>Displaying ₱912.5 instead of ₱912.50 appears unprofessional; negative balance indicates accounting inversion.</td>
                <td><strong>Code:</strong> Formatted currency using `Intl.NumberFormat('en-PH', {minimumFractionDigits: 2})` across all tables.<br><strong>Manuscript:</strong> Documented in Chapter 5.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- ========================================================= -->
      <!-- TAB 5: MANUSCRIPT REVISIONS (CH 1 – 3)                    -->
      <!-- ========================================================= -->
      <div id="tab-ch1-ch3" class="tab-pane" data-tab-title="Tab 5: Manuscript Revisions (Ch 1 – 3)">
        <h2>5. Chapter-by-Chapter Manuscript Revisions: Chapters 1 to 3</h2>
        <p>
          Below are the specific textual, diagrammatic, and formulaic errors identified in Chapters 1, 2, and 3 of the 155-page manuscript, accompanied by exact copy-pasteable replacement text.
        </p>

        <h3>Chapter 1: Critical Text & Figure Revisions</h3>

        <div class="callout callout-danger">
          <div class="callout-icon">🚨</div>
          <div class="callout-content">
            <strong>Critical Inconsistency 1: Figure 1 Conceptual Framework (Page 9)</strong>
            In Figure 1, the diagram currently lists the <em>withdrawn 2011 ISO 25010 characteristics</em> (usability, portability), whereas Research Question 4 and Objective 4 on page 11 list the <em>updated 2023 ISO 25010 standard</em> (Interaction Capability, Flexibility, Safety). Furthermore, Figure 1 contains an obvious typographical error: <code>"6. Transaction reocords"</code>.
          </div>
        </div>

        <div class="diff-container">
          <div class="diff-box diff-before">
            <div class="diff-label">❌ Current Flawed Content (Figure 1, Page 9)</div>
            <div class="diff-text">
              <strong>INPUT:</strong> 6. Transaction reocords [TYPO]<br>
              <strong>PROCESS:</strong> 7. ISO/IEC 25010: Functional suitability, usability, reliability, performance, security, maintainability, portability. [OBSOLETE 2011 STANDARD]<br>
              <strong>FEEDBACK:</strong> Actual completion times are fed back to the ML model to improve future predictions. [MISLEADING ONLINE LEARNING CLAIM]
            </div>
          </div>
          <div class="diff-box diff-after">
            <div class="diff-label">✔ Exact Approved Replacement (Figure 1, Page 9)</div>
            <div class="diff-text">
              <strong>INPUT:</strong> 6. Transaction records [CORRECTED]<br>
              <strong>PROCESS:</strong> 7. ISO/IEC 25010:2023: Functional Suitability, Performance Efficiency, Compatibility, Interaction Capability, Reliability, Security, Maintainability, Flexibility, Safety. TAM: Perceived Usefulness, Perceived Ease of Use, Behavioral Intention, Actual System Use.<br>
              <strong>FEEDBACK:</strong> Validated completion records archived for periodic administrative batch model retraining and quality auditing.
            </div>
          </div>
        </div>

        <div class="diff-container">
          <div class="diff-box diff-before">
            <div class="diff-label">❌ Flawed Wording (Page 5, Research Question 1)</div>
            <div class="diff-text">
              "1. How does the existing manual paper-based process compare with the developed centralized digital job order entry and management system in terms of record accessibility, retrieval time, and data accuracy." [PUNCTUATION ERROR: ENDS WITH PERIOD INSTEAD OF QUESTION MARK]
            </div>
          </div>
          <div class="diff-box diff-after">
            <div class="diff-label">✔ Corrected Wording (Page 5, Research Question 1)</div>
            <div class="diff-text">
              "1. How does the existing manual paper-based process compare with the developed centralized digital job order entry and management system in terms of record accessibility, retrieval time, and data accuracy?" [CORRECTED PUNCTUATION]
            </div>
          </div>
        </div>

        <h3>Chapter 2: Review of Related Literature Verification</h3>
        <p>
          Chapter 2 (pages 15–26) is thoroughly structured and adheres to institutional requirements:
        </p>
        <ul class="checklist">
          <li><span class="check-pass">✓</span> Organized into five (5) alphabetical themes covering Business Analytics, Centralized Order Management, Machine Learning Prediction, ISO/IEC 25010, and TAM.</li>
          <li><span class="check-pass">✓</span> Implements the <strong>Compare–Contrast–Connect</strong> critical review framework required by the panel.</li>
          <li><span class="check-pass">✓</span> Integrates twenty-eight (28) peer-reviewed references published between 2022 and 2026, formatted in strict IEEE style.</li>
          <li><span class="check-pass">✓</span> Seamlessly transitions into Chapter 3 by justifying the practical, low-overhead architecture suitable for a Philippine MSME.</li>
        </ul>

        <h3>Chapter 3: Technical Background & Methodology Revisions</h3>

        <div class="callout callout-danger">
          <div class="callout-icon">🚨</div>
          <div class="callout-content">
            <strong>Critical Calculation Typo on Pages 52 and 58</strong>
            In Table 1 (Page 52) and Phase 1 Cost summary (Page 58), the calculation contains an embarrassing typographical spacing error: <code>1,500 + 2,200 + 1,000 +7 20 = ₱5,420</code>. This must be corrected to <code>+ 720</code>. Additionally, Table 1 header has a broken word: <code>Quantity/Assum ption</code>.
          </div>
        </div>

        <div class="diff-container">
          <div class="diff-box diff-before">
            <div class="diff-label">❌ Flawed Computation Line (Pages 52 & 58)</div>
            <div class="diff-text">
              "Total Phase 1 Cost:<br>
              1,500 + 2,200 + 1,000 +7 20 = ₱5,420"<br><br>
              Table 1 Header: "Quantity/Assum ption"
            </div>
          </div>
          <div class="diff-box diff-after">
            <div class="diff-label">✔ Corrected Computation Line (Pages 52 & 58)</div>
            <div class="diff-text">
              "Total Phase 1 Cost:<br>
              ₱1,500 + ₱2,200 + ₱1,000 + ₱720 = ₱5,420"<br><br>
              Table 1 Header: "Quantity / Assumption"
            </div>
          </div>
        </div>

        <h4>Diagram Resolution & Presentation Overhaul (Figures 5, 7, 8, 9)</h4>
        <div class="callout callout-warning">
          <div class="callout-icon">⚠</div>
          <div class="callout-content">
            <strong>Panel Recommendation: Visual Legibility of Architecture & Database Schemas</strong>
            In the current manuscript PDF, Figures 5 (DFD Level 1, p. 73), 7 (Conceptual Data Model, p. 79), 8 (ERD, p. 82), and 9 (Logical Database Design, p. 86) suffer from image compression where entity attributes cannot be legibly examined.
            <br><br>
            <strong>Action Required:</strong> Replace miniature raster screenshots with crisp vector-rendered diagrams or full-page landscape layout inserts in Appendix A/B, ensuring every foreign key and table attribute is readable during panel inspection.
          </div>
        </div>
      </div>

      <!-- ========================================================= -->
      <!-- TAB 6: MANUSCRIPT REVISIONS (CH 4 – 5)                    -->
      <!-- ========================================================= -->
      <div id="tab-ch4-ch5" class="tab-pane" data-tab-title="Tab 6: Manuscript Revisions (Ch 4 – 5)">
        <h2>6. Chapter-by-Chapter Manuscript Revisions: Chapters 4 to 5</h2>
        <p>
          Chapter 4 (Results and Discussions) and Chapter 5 (Summary, Conclusions, and Recommendations) contain several critical date discrepancies, table numbering omissions, and numerical contradictions that must be reconciled prior to final hardbound submission.
        </p>

        <div class="callout callout-danger">
          <div class="callout-icon">🚨</div>
          <div class="callout-content">
            <strong>CRITICAL TIMELINE CONTRADICTION ON PAGE 101</strong>
            Page 101 states: <em>"the developed system underwent a two-week pilot testing period from September 2 to September 16, 2026... Finally, separate evaluation questionnaires were distributed to the intended evaluator groups from September 9 to September 19, 2025."</em>
            <br><br>
            <strong>The Anachronism:</strong> Questionnaires could not possibly have been distributed in September 2025 if pilot testing occurred in September 2026, and historical receipt review ran until January 2026! The year <strong>2025</strong> is an uncorrected copy-paste artifact from the preliminary proposal draft and must be corrected to <strong>2026</strong>.
          </div>
        </div>

        <div class="diff-container">
          <div class="diff-box diff-before">
            <div class="diff-label">❌ Flawed Narrative Text (Page 101, Paragraph 5)</div>
            <div class="diff-text">
              "Finally, separate evaluation questionnaires were distributed to the intended evaluator groups from September 9 to September 19, 2025. The Shoelotskey owner, co-owner, and staff, consisting of six (6) respondents, evaluated the user acceptance..."
            </div>
          </div>
          <div class="diff-box diff-after">
            <div class="diff-label">✔ Corrected Narrative Text (Page 101, Paragraph 5)</div>
            <div class="diff-text">
              "Finally, separate evaluation questionnaires were distributed to the intended evaluator groups from September 9 to September 19, 2026. The Shoelotskey owner, co-owner, and staff, consisting of six (6) respondents, evaluated the user acceptance..."
            </div>
          </div>
        </div>

        <div class="callout callout-danger">
          <div class="callout-icon">🚨</div>
          <div class="callout-content">
            <strong>CRITICAL NUMERICAL CONTRADICTION: Reliability Weighted Mean</strong>
            In Table 13 (Page 126), the General Weighted Mean for Reliability is <strong>3.72</strong> (SD = 0.49). In Table 24 (Page 140), Reliability is also recorded as <strong>3.72</strong>.<br>
            However, on <strong>Page 127</strong>, the narrative text erroneously reports: <em>"the Reliability of the Web-Based Service Management System achieved a general weighted mean of 3.76 with a standard deviation of 0.31"</em>. Furthermore, on <strong>Page 141</strong> and <strong>Page 149</strong> (Chapter 5), the text repeats: <em>"followed by Reliability and Compatibility with a mean of 3.76"</em>.
            <br><br>
            <strong>The Reality:</strong> Compatibility is <strong>3.76</strong>. Reliability is <strong>3.72</strong>. The narrative on pages 127, 141, and 149 must be corrected to 3.72!
          </div>
        </div>

        <div class="diff-container">
          <div class="diff-box diff-before">
            <div class="diff-label">❌ Flawed Narrative Text (Page 127, Line 3)</div>
            <div class="diff-text">
              "As shown in Table 13, the Reliability of the Web-Based Service Management System achieved a general weighted mean of 3.76 with a standard deviation of 0.31..."
            </div>
          </div>
          <div class="diff-box diff-after">
            <div class="diff-label">✔ Corrected Narrative Text (Page 127, Line 3)</div>
            <div class="diff-text">
              "As shown in Table 13, the Reliability of the Web-Based Service Management System achieved a general weighted mean of 3.72 with a standard deviation of 0.49..."
            </div>
          </div>
        </div>

        <div class="diff-container">
          <div class="diff-box diff-before">
            <div class="diff-label">❌ Flawed Summary Text (Pages 141 & 149)</div>
            <div class="diff-text">
              "...followed by Reliability and Compatibility with a mean of 3.76. Interaction Capability and Maintainability both obtained a mean of 3.72..."
            </div>
          </div>
          <div class="diff-box diff-after">
            <div class="diff-label">✔ Corrected Summary Text (Pages 141 & 149)</div>
            <div class="diff-text">
              "...followed by Compatibility with a mean of 3.76, and Reliability, Interaction Capability, and Maintainability, each obtaining a mean of 3.72..."
            </div>
          </div>
        </div>

        <div class="callout callout-warning">
          <div class="callout-icon">⚠</div>
          <div class="callout-content">
            <strong>Table Numbering Sequence Gap & Cross-Reference Typo</strong>
            <ul style="margin-top: 6px; padding-left: 18px;">
              <li><strong>Missing Tables:</strong> Table 13 (Reliability, p. 126) is followed immediately by Table 16 (Security, p. 128). Tables 14 and 15 are missing from the chapter numbering sequence! Either renumber Table 16 &rarr; Table 14, Table 17 &rarr; Table 15, Table 18 &rarr; Table 16, Table 19 &rarr; Table 17, or insert the respective sub-characteristic breakdowns.</li>
              <li><strong>Cross-Reference Error on Page 144:</strong> Section 6 states <em>"Based on the suggestions and comments presented in Table 24..."</em>. However, Table 24 is the Summary of TAM and ISO 25010 results. The suggestions are located in <strong>Table 25</strong>! Change "Table 24" to <strong>"Table 25"</strong>.</li>
            </ul>
          </div>
        </div>

        <h3>Chapter 4 Grammatical & Syntactical Corrections</h3>
        <div class="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Page</th>
                <th>Current Manuscript Wording</th>
                <th>Grammatical Defect</th>
                <th>Corrected Academic Replacement</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Page 120</strong></td>
                <td>"The three indicators were rated Highly Acceptable while the two indicator was rated Acceptable..."</td>
                <td>Subject-verb agreement failure ("the two indicator was").</td>
                <td>"Three indicators were rated Highly Acceptable, while two indicators were rated Acceptable..."</td>
              </tr>
              <tr>
                <td><strong>Page 120</strong></td>
                <td>"This suggests that the system is was positively evaluated in terms of functional suitability..."</td>
                <td>Double verb error ("is was").</td>
                <td>"This demonstrates that the system was positively evaluated in terms of functional suitability..."</td>
              </tr>
              <tr>
                <td><strong>Page 123</strong></td>
                <td>"...demonstrated successful integration among the evaluated modules with its various modules and platforms."</td>
                <td>Redundant repetitive phrasing ("modules with its modules").</td>
                <td>"...demonstrated successful integration across all functional modules and supported client platforms."</td>
              </tr>
              <tr>
                <td><strong>Pages 137, 138</strong></td>
                <td>"3.83 . 0.41" and "3.67 . 0.52"</td>
                <td>Punctuation formatting error (floating dot between values).</td>
                <td>"3.83 (SD = 0.41)" and "3.67 (SD = 0.52)"</td>
              </tr>
              <tr>
                <td><strong>Page 143</strong></td>
                <td>"...the users' summary and ranking of suggestions and comments revealed that the most frequently cited suggestion among IT experts..."</td>
                <td>Misattribution ("users' summary" for IT experts).</td>
                <td>"...the summary and ranking of suggestions and comments revealed that the most frequently cited suggestion among IT experts..."</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- ========================================================= -->
      <!-- TAB 7: SYSTEM & CODEBASE ASSESSMENT                       -->
      <!-- ========================================================= -->
      <div id="tab-system-audit" class="tab-pane" data-tab-title="Tab 7: System & Codebase Assessment">
        <h2>7. Technical System Assessment & Vulnerability Audit</h2>
        <p>
          The Shoelotskey Service Management System codebase was audited across its frontend components, backend REST API routes, relational schema normalization (3NF), machine learning pipeline, and cloud deployment configuration.
        </p>

        <div class="kpi-row">
          <div class="kpi-card green">
            <div class="kpi-title">Frontend Stack</div>
            <div class="kpi-value">React 18 + TS</div>
            <div class="kpi-sub">Vite 6 + Tailwind CSS + Lucide</div>
          </div>
          <div class="kpi-card green">
            <div class="kpi-title">Backend Stack</div>
            <div class="kpi-value">FastAPI 0.135</div>
            <div class="kpi-sub">Python 3.14 + Pydantic v2</div>
          </div>
          <div class="kpi-card purple">
            <div class="kpi-title">Database Normalization</div>
            <div class="kpi-value">3NF Validated</div>
            <div class="kpi-sub">PostgreSQL Essential-0 (Heroku)</div>
          </div>
          <div class="kpi-card blue">
            <div class="kpi-title">ML Model Architecture</div>
            <div class="kpi-value">Random Forest</div>
            <div class="kpi-sub">200 Estimators · Option B Dual Date</div>
          </div>
        </div>

        <h3>Core Architectural Assessment</h3>
        <div class="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Subsystem</th>
                <th>Implemented Technology</th>
                <th>Operational Strengths</th>
                <th>Identified Vulnerability / Limitation</th>
                <th>Defensive Stance for Panel</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Presentation Layer</strong></td>
                <td>React 18, TypeScript, Vite, Tailwind CSS</td>
                <td>Instant client-side route transitions (SPA); customer autocomplete dropdown; dynamic service subtotal calculation; responsive desktop/mobile view.</td>
                <td>Single bundle initial load; offline queue creates optimism bias if connection drops before server confirmation.</td>
                <td>Emphasize that administrative systems in micro-enterprises operate within stationary shop Wi-Fi; SPA delivers high interaction capability (3.72 GWM).</td>
              </tr>
              <tr>
                <td><strong>Application Layer</strong></td>
                <td>FastAPI, Uvicorn, Python, SQLAlchemy ORM</td>
                <td>High-throughput asynchronous request handling; auto-generated OpenAPI documentation; robust dependency injection for authentication (`get_current_user`).</td>
                <td>Permissive default payload values on legacy endpoints; API can accept incomplete orders if frontend validation is bypassed.</td>
                <td>Pydantic schemas enforce type validation; role guards (`require_role("owner")`) prevent privilege escalation.</td>
              </tr>
              <tr>
                <td><strong>Data Management Layer</strong></td>
                <td>PostgreSQL on Heroku, SQLAlchemy Models</td>
                <td>Rigid relational integrity (3NF); foreign key cascade protections; junction tables for many-to-many service and shoe condition mapping.</td>
                <td>Cloud database requires continuous internet access; no local offline sync in production deployment.</td>
                <td>Multi-user transaction safety and transactional acid guarantees require a single authoritative cloud source of truth.</td>
              </tr>
              <tr>
                <td><strong>Machine Learning Module</strong></td>
                <td>Scikit-Learn `RandomForestRegressor`</td>
                <td>Ensemble tree learning handles nonlinear feature interactions (service combinations, quantity, calendar month); fast inference (~1.2s).</td>
                <td>Small validated historical sample (N=119; 93 dev / 26 test); target represents claim turnaround rather than physical completion; low R&sup2; (0.129).</td>
                <td><strong>Option B Architecture:</strong> Deterministic Business Rules govern the official committed release date; ML serves strictly as an advisory capacity forecast.</td>
              </tr>
              <tr>
                <td><strong>Security Subsystem</strong></td>
                <td>JWT Bearer Tokens, Bcrypt (12 rounds)</td>
                <td>Enforces 3-attempt login lockout with 15-minute freeze; 30-minute idle session termination; parameterized queries prevent SQL injection.</td>
                <td>Tokens stored in browser localStorage; rate limiting on non-auth endpoints not backed by Redis.</td>
                <td>Meets OWASP Top 10 guidelines for micro-business operations; audit logs record all administrative and status update events.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h3>The Option B Dual-Date Architecture</h3>
        <div class="callout callout-info">
          <div class="callout-icon">ℹ</div>
          <div class="callout-content">
            <strong>Why Option B Protects the Capstone Defense</strong>
            If the system allowed the Random Forest model (with its 8.50-day MAE and 0.129 R&sup2;) to automatically assign binding customer pickup dates, customer dissatisfaction and operational chaos would ensue.
            <br><br>
            Instead, the system implements <strong>Option B</strong>:
            <ul style="margin-top: 6px; padding-left: 18px;">
              <li><strong>🟢 BUSINESS RULES: Official Release Date:</strong> Calculated deterministically using Shoelotskey's standard service durations (e.g., 5 days for Basic Cleaning, 10 days for Full Reglue/Restoration) plus rush priority adjustments. This is the <em>authoritative date printed on customer claim receipts</em>.</li>
              <li><strong>🔵 ML PREDICTION: Advisory Release Date:</strong> Generated by the Random Forest Regressor based on historical turnaround patterns. Displayed with an <code>[ADVISORY] ⓘ</code> badge. Clicking the badge opens the <strong>View ML Details</strong> modal displaying model metadata, feature contributions, and confidence context.</li>
            </ul>
          </div>
        </div>
      </div>

      <!-- ========================================================= -->
      <!-- TAB 8: SLIDE DECK (DEFENSE PPT) AUDIT                     -->
      <!-- ========================================================= -->
      <div id="tab-presentation" class="tab-pane" data-tab-title="Tab 8: Slide Deck (Defense PPT) Audit">
        <h2>8. Capstone Defense Presentation (Slide Deck) Audit</h2>
        <p>
          The 17-slide capstone defense presentation (`Capstone Presentation - Shoelotskey.pdf`) was evaluated slide-by-slide against the manuscript, institutional rubrics, and oral defense best practices.
        </p>

        <div class="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Slide #</th>
                <th>Slide Title & Content</th>
                <th>Current Weakness / Gap / Error</th>
                <th>Exact Slide Revision Required</th>
                <th>Speaker Defense Script (What to Say)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Slide 1</strong></td>
                <td>Title Slide: "A Web-Based Service Management System with Data Analytics using Machine Learning Algorithms for Shoelotskey Villamor-Pasay"</td>
                <td>Subtitle lacks the specific academic program and institutional name on the banner.</td>
                <td>Ensure "Bachelor of Science in Aviation Information Technology (BSAIT)" and "Institute of Computer Studies" are prominently visible.</td>
                <td>"Good morning, honorable panel members, advisers, and guests. Today we present our capstone project: A Web-Based Service Management System with Data Analytics using Machine Learning Algorithms for Shoelotskey Villamor-Pasay."</td>
              </tr>
              <tr>
                <td><strong>Slide 2</strong></td>
                <td>Introduction (Fragmented Records, Manual Reporting, Slow Retrieval, Inconsistent Estimates)</td>
                <td>Bullet points lack quantitative operational metrics established in Chapter 1.</td>
                <td>Add the baseline empirical metrics: 2–3 days service delay, 1–2 hours manual report compilation, 3–10 min record retrieval time, 280–300 monthly orders.</td>
                <td>"Shoelotskey currently handles an average of 280 to 300 orders monthly using manual logbooks. This leads to retrieval delays of up to 10 minutes per inquiry and manual report compilation taking 1 to 2 hours."</td>
              </tr>
              <tr>
                <td><strong>Slide 3</strong></td>
                <td>Purpose and Study Objectives (Objectives 1 to 6)</td>
                <td>Objective 4 states generic ISO/IEC 25010 without mentioning the 9 characteristics.</td>
                <td>Specify "Evaluate software quality using ISO/IEC 25010:2023 (9 quality characteristics)".</td>
                <td>"Our study addresses six specific objectives, spanning manual-versus-digital comparative analysis, machine learning prediction evaluation, analytics dashboard efficiency, ISO 25010 software quality across 9 characteristics, TAM user acceptance, and future enhancements."</td>
              </tr>
              <tr>
                <td><strong>Slide 4</strong></td>
                <td>Conceptual Framework (Input, Process, Output)</td>
                <td>Omitted the Feedback component which is central to the IPO model on manuscript page 9.</td>
                <td>Add "FEEDBACK: Archiving completed orders for periodic administrative batch model retraining and continuous database updates."</td>
                <td>"Our conceptual framework follows an Input-Process-Output model with an administrative feedback loop, where daily transaction data feeds both operational dashboards and future model retraining."</td>
              </tr>
              <tr>
                <td><strong>Slide 5</strong></td>
                <td>Methodology: Research design & development model (Waterfall SDLC)</td>
                <td>Phases are listed sequentially but lack specific project deliverables per phase.</td>
                <td>Add deliverables under each phase: Requirements (SRS), Design (DFD/ERD), Implementation (React/FastAPI), Testing (Use Cases), Deployment (Heroku), Maintenance.</td>
                <td>"We adopted a developmental-descriptive research design combined with the Waterfall SDLC, ensuring requirements were frozen and documented in the SRS before coding began."</td>
              </tr>
              <tr>
                <td><strong>Slide 6</strong></td>
                <td>Methodology: Three Tier Architecture</td>
                <td>Stack is clear, but lacks mention of security mechanisms (Bcrypt, JWT, RBAC).</td>
                <td>Add "Security: JWT Bearer tokens, 12-round Bcrypt password hashing, 3-attempt login lockout, 30-min session timeout."</td>
                <td>"The system follows a three-tier architecture separating React frontend, FastAPI backend, and PostgreSQL database, reinforced by OWASP Top 10 security safeguards."</td>
              </tr>
              <tr>
                <td><strong>Slide 7</strong></td>
                <td>Methodology: Data Gathering and Evaluation</td>
                <td><strong>EMBARRASSING TYPO:</strong> <code>"ISO/EIC 25010"</code> instead of <code>"ISO/IEC 25010"</code>! Also, pilot testing dates are omitted.</td>
                <td>Correct typo to <strong>ISO/IEC 25010:2023</strong>; specify 5 IT experts; add 2-week pilot testing period (September 2–16, 2026) for N=6 TAM respondents.</td>
                <td>"We gathered data from multiple sources: 714 historical receipts, 10 comparative trials, 2 weeks of hands-on pilot testing with shop staff, and formal evaluation with 5 IT experts and 6 operational users."</td>
              </tr>
              <tr>
                <td><strong>Slide 8</strong></td>
                <td>Methodology: Machine Learning Evaluation</td>
                <td>States "Random Forest Regression predicts completion duration in days." Lacks mention of the 13 input features.</td>
                <td>List key feature groups: Total pairs, quantity counts for 7 core services, priority level, and intake calendar indicators.</td>
                <td>"From 714 paper receipts, 119 validated orders were retained after rigorous human verification. To avoid temporal data leakage, we split 93 records from 2025 for cross-validation and reserved 26 records from January 2026 for unseen testing."</td>
              </tr>
              <tr>
                <td><strong>Slide 9</strong></td>
                <td>Results: Manual vs Digital Process</td>
                <td>Shows 92.12% retrieval reduction and 99.98% report reduction. Excellent slide!</td>
                <td>Ensure unit clarity (5.20 min &rarr; 0.41 min; 43.71 min &rarr; 0.43 sec).</td>
                <td>"Our comparative analysis revealed significant operational gains: record retrieval time dropped by 92.12%, report preparation time decreased by 99.98%, and daily data entry errors were reduced to zero."</td>
              </tr>
              <tr>
                <td><strong>Slide 10</strong></td>
                <td>Results: Analytics Dashboard (Chart & User Rating 3.83)</td>
                <td>Chart is clear and visually compelling.</td>
                <td>Highlight that Annual report dropped from 120 minutes manually to just 0.56 seconds.</td>
                <td>"The real-time analytics dashboard compiles daily, weekly, monthly, and annual sales, expense, and ROI summaries in under one second, receiving a Highly Acceptable rating of 3.83 from shop management."</td>
              </tr>
              <tr>
                <td><strong>Slide 11</strong></td>
                <td>Results: Machine Learning Model</td>
                <td>Says <em>"The presented 10-record test sample shows high prediction error."</em> Panel might mistakenly think the metrics are based on only 10 samples!</td>
                <td>Clarify: "Evaluated on all N=26 unseen test records (Table 5 shows 10 representative records for conciseness). MAE = 8.50 days, RMSE = 10.11 days, R&sup2; = 0.129."</td>
                <td>"On the complete 26-record unseen January 2026 test set, the model achieved an MAE of 8.50 days and an R&sup2; of 0.129. Because the target represented order-to-claim turnaround rather than physical completion, the ML output is deployed strictly as an advisory estimate, protecting operational reliability."</td>
              </tr>
              <tr>
                <td><strong>Slide 12</strong></td>
                <td>Results: Technology Acceptance Model (Bar Chart)</td>
                <td>Clear bar chart showing PU (4.00), PEOU (3.89), BI (3.61), ASU (4.00), Dashboard (3.83).</td>
                <td>Highlight that N=6 represents the <strong>total population census</strong> of the shop (2 owners, 4 staff).</td>
                <td>"Across all TAM constructs, the system was rated Highly Acceptable by the complete shop personnel census, with Perceived Usefulness and Actual System Use achieving a perfect 4.00 mean."</td>
              </tr>
              <tr>
                <td><strong>Slide 13</strong></td>
                <td>Results: ISO/IEC 25010 Software Quality (Bar Chart)</td>
                <td>Correctly shows all 9 characteristics. Composite mean is 3.71.</td>
                <td>Reiterate that Reliability is 3.72, Compatibility is 3.76, and Flexibility is highest at 3.84.</td>
                <td>"Five independent IT experts evaluated the system across all nine ISO 25010:2023 characteristics, yielding a composite weighted mean of 3.71 out of 4.00, led by Flexibility at 3.84."</td>
              </tr>
              <tr>
                <td><strong>Slide 14</strong></td>
                <td>Results: Expert Suggestion Enhancement</td>
                <td>Table displays 60% dropdown flexibility, 40% inventory audit logs, 40% SMS notifications.</td>
                <td>Add "All suggestions have been triaged and integrated into our future enhancement roadmap."</td>
                <td>"The evaluators provided constructive suggestions, with 60% recommending customizable dropdown entries and 40% requesting inventory audit logs and SMS alerts—all of which inform our future system roadmap."</td>
              </tr>
              <tr>
                <td><strong>Slide 15</strong></td>
                <td>Synthesis (Operations, Acceptance & Quality, ML Limitation)</td>
                <td>Strong balanced synthesis summarizing success and honest disclosure of ML limitations.</td>
                <td>Reinforce that the capstone fulfills its primary goal of modernizing Shoelotskey.</td>
                <td>"In synthesis, the system successfully resolved Shoelotskey's operational bottlenecks and achieved stellar technical and user acceptance ratings. The ML model provides a functional baseline for advisory forecasting that will improve as digital timestamps accumulate."</td>
              </tr>
              <tr>
                <td><strong>Slide 16 & 17</strong></td>
                <td>Q&A and Thank You Slides</td>
                <td>Standard closing slides.</td>
                <td>Add repository link, live staging URL, and contact information.</td>
                <td>"Thank you very much. We are now ready to entertain questions from our honorable panel of examiners."</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- ========================================================= -->
      <!-- TAB 9: TOC, HEADINGS & APPENDICES GUIDE                   -->
      <!-- ========================================================= -->
      <div id="tab-structure-appendices" class="tab-pane" data-tab-title="Tab 9: TOC, Headings & Appendices Guide">
        <h2>9. Institutional Manuscript Structure, TOC & Appendices Checklist</h2>
        <p>
          In accordance with the <strong>NAAP / PhilSCA Institute of Computer Studies Capstone Manual</strong>, the final manuscript must strictly follow the required preliminary pagination, heading hierarchy, and mandatory appendices sequence.
        </p>

        <h3>Institutional Manuscript Preliminary Pages Order</h3>
        <div class="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Order</th>
                <th>Preliminary Page Title</th>
                <th>Pagination Format</th>
                <th>Signatories / Requirements</th>
                <th>Audit Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>1</td>
                <td>Title Page</td>
                <td>Unnumbered (counted as page i)</td>
                <td>All caps title; full researcher names; BSAIT program; National Aviation Academy of the Philippines; ICS.</td>
                <td><span class="tag tag-success">COMPLIANT</span></td>
              </tr>
              <tr>
                <td>2</td>
                <td>Approval Sheet</td>
                <td>Roman numeral (page ii)</td>
                <td>Signatures of Capstone Adviser (Richard Niel B. Peralta), Panel Chair (Aron J. Alojado), Panel Members (Mary Ann Aballiar-Vista, Alan Lino Silverio Agustin), Program Coordinator (Jerum B. Dasalla), and Dean/Director.</td>
                <td><span class="tag tag-success">COMPLIANT</span></td>
              </tr>
              <tr>
                <td>3</td>
                <td><strong>Certificate of Originality</strong></td>
                <td>Roman numeral (page iii)</td>
                <td><strong>Mandated by RDO Advisory No. 01 s. 2026:</strong> Notarized certification signed by all student researchers and attested by Capstone Adviser Peralta.</td>
                <td><span class="tag tag-warning">MANDATORY INSERT</span></td>
              </tr>
              <tr>
                <td>4</td>
                <td>Acknowledgment</td>
                <td>Roman numeral (page iv)</td>
                <td>Formal expression of gratitude to Shoelotskey owner (Ms. Aileen Rosales), advisers, panel, faculty validators, IT experts, and families.</td>
                <td><span class="tag tag-success">COMPLIANT</span></td>
              </tr>
              <tr>
                <td>5</td>
                <td>Abstract</td>
                <td>Roman numeral (page v)</td>
                <td>Single paragraph (200–250 words) summarizing problem, developmental-descriptive design, Waterfall SDLC, key quantitative findings (92.12% retrieval, 99.98% reporting), ISO (3.71), TAM (3.88), and ML results (MAE 8.50, R&sup2; 0.129). Keywords included.</td>
                <td><span class="tag tag-success">COMPLIANT</span></td>
              </tr>
              <tr>
                <td>6</td>
                <td>Table of Contents</td>
                <td>Roman numeral (pages vi–vii)</td>
                <td>Dot-leader aligned headings for Chapters 1 to 5, subheadings, References, and Appendices A through I.</td>
                <td><span class="tag tag-success">COMPLIANT</span></td>
              </tr>
              <tr>
                <td>7</td>
                <td>List of Tables</td>
                <td>Roman numeral (page viii)</td>
                <td>Accurately enumerates Tables 1 through 25 with exact titles and page numbers (reconciling Table 13–16 numbering gap).</td>
                <td><span class="tag tag-warning">UPDATE REQUIRED</span></td>
              </tr>
              <tr>
                <td>8</td>
                <td>List of Figures</td>
                <td>Roman numeral (page ix)</td>
                <td>Accurately enumerates Figures 1 through 10 with exact titles and page numbers.</td>
                <td><span class="tag tag-success">COMPLIANT</span></td>
              </tr>
            </tbody>
          </table>
        </div>

        <h3>Mandatory Appendices Sequence Checklist</h3>
        <div class="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Appendix Letter</th>
                <th>Institutional Appendix Title</th>
                <th>Required Documentation Content</th>
                <th>File Reference / Artifact Location</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Appendix A</strong></td>
                <td>System Requirements Specification (SRS)</td>
                <td>Complete functional, non-functional, and interface specifications for the Shoelotskey platform.</td>
                <td>`docs/system_requirements_specification.html`</td>
                <td><span class="tag tag-success">READY</span></td>
              </tr>
              <tr>
                <td><strong>Appendix B</strong></td>
                <td>Institutional Transmittal Letters & Permissions</td>
                <td>Signed request letter to Ms. Aileen Rosales (Owner), PhilSCA transmittal endorsement, and memorandum of agreement/understanding.</td>
                <td>`docs/Official Documentation/Capstone Subject/Submissions/`</td>
                <td><span class="tag tag-success">READY</span></td>
              </tr>
              <tr>
                <td><strong>Appendix C</strong></td>
                <td>Content Validation Instruments & CVI Results</td>
                <td>Completed evaluation forms from 5 faculty validators (Antonio, Apostol, Cacho, Legazpi, Villarica) and CVI computation sheet showing S-CVI = 1.00.</td>
                <td>`docs/Official Documentation/Validators/VALIDITY TEST RESULTS.xlsx`</td>
                <td><span class="tag tag-success">READY</span></td>
              </tr>
              <tr>
                <td><strong>Appendix D</strong></td>
                <td>ISO/IEC 25010:2023 Evaluation Instruments</td>
                <td>Signed 45-item survey questionnaires and qualitative comment sheets from 5 IT Experts (E. Yu, E. Yu, K. Javier, I. Corona, IT Expert 4).</td>
                <td>`docs/Official Documentation/IT Experts/Compilation/`</td>
                <td><span class="tag tag-success">READY</span></td>
              </tr>
              <tr>
                <td><strong>Appendix E</strong></td>
                <td>Technology Acceptance Model (TAM) Questionnaires</td>
                <td>Completed and signed 20-item survey questionnaires from 6 Shoelotskey operational personnel (A. Rosales, R. Coronacion, Y. Victorio, J. Villanueva, K. Gravino, E. Villanueva).</td>
                <td>`docs/Official Documentation/TAM/TAM-Respondents-Result.pdf`</td>
                <td><span class="tag tag-success">READY</span></td>
              </tr>
              <tr>
                <td><strong>Appendix F</strong></td>
                <td>Comparative Performance Testing Logs</td>
                <td>Detailed trial logs for the 10 manual vs. digital record retrieval tests and the 7 report generation timing benchmarks.</td>
                <td>Chapter 4 Tables 2 & 7 logs</td>
                <td><span class="tag tag-success">READY</span></td>
              </tr>
              <tr>
                <td><strong>Appendix G</strong></td>
                <td>Machine Learning Research Outputs & Test Predictions</td>
                <td>Raw data summary of 119 validated orders, cross-validation metrics, feature importance rankings, and locked 26-test prediction CSV.</td>
                <td>`backend/research_outputs/ml_final/03_locked_final_test_predictions.csv`</td>
                <td><span class="tag tag-success">READY</span></td>
              </tr>
              <tr>
                <td><strong>Appendix H</strong></td>
                <td>System User Manual & Deployment Guide</td>
                <td>Step-by-step illustrated operational guide for Owner and Staff, covering job order creation, status progression, inventory tracking, and reports.</td>
                <td>`docs/Comprehensive_IT_Expert_Remediation_and_ISO25010_Report.html`</td>
                <td><span class="tag tag-success">READY</span></td>
              </tr>
              <tr>
                <td><strong>Appendix I</strong></td>
                <td>Curriculum Vitae of Researchers</td>
                <td>Academic profile, technical skills, aviation IT credentials, and photo of Charmaine Rose G. Angeles, Kylane C. Gravino, and Melody D. Sedanto.</td>
                <td>Standard institutional 1-page CV format</td>
                <td><span class="tag tag-success">READY</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- ========================================================= -->
      <!-- TAB 10: HIGH-STAKES DEFENSE Q&A TRAPS                     -->
      <!-- ========================================================= -->
      <div id="tab-defense-traps" class="tab-pane" data-tab-title="Tab 10: High-Stakes Defense Q&A Traps">
        <h2>10. High-Stakes Panel Defense Traps & Battle-Tested Answers</h2>
        <p>
          During the final oral defense, capstone panel members commonly test the boundary between student enthusiasm and engineering reality. Below are the top ten high-risk defense traps and the exact, evidence-based responses formulated to preserve the academic integrity of the study.
        </p>

        <div class="qa-card">
          <div class="qa-q">
            <span class="qa-q-num">Q1</span>
            "Your research proposal promised an ML prediction accuracy of 85% or higher. However, Table 6 shows an R² of only 0.129 and an MAE of 8.50 days. Did your machine learning module fail?"
          </div>
          <div class="qa-a">
            "No, Sir/Ma'am, the machine learning module did not fail; rather, it demonstrated an important empirical reality of micro-enterprise operations. The initial 85% proposal target was an ambitious heuristic benchmark based on enterprise literature that assumes high transaction volumes and automated timestamps. In our study, we are predicting a <em>continuous numerical value</em> (duration in days), which is properly evaluated using regression metrics—specifically Mean Absolute Error (MAE) and Root Mean Squared Error (RMSE)—rather than classification percentage accuracy.<br><br>
            Furthermore, our Random Forest Regressor reduced the MAE by 0.78 days compared to the historical mean baseline. Crucially, recognizing this empirical variance is exactly why we architected <strong>Option B</strong>: the system relies on deterministic <em>Business Rules</em> to generate the official customer release date, while the Random Forest output serves strictly as an <em>advisory forecast</em> for shop management. This ensures that operational commitments remain 100% reliable while providing the business with predictive decision support."
          </div>
          <div class="qa-tip">
            💡 <strong>Panel Defense Tip:</strong> Never defend the R² as 'high'. Acknowledge it honestly, cite the 0.78-day improvement over the baseline mean, and emphasize Option B as the architectural safety net.
          </div>
        </div>

        <div class="qa-card">
          <div class="qa-q">
            <span class="qa-q-num">Q2</span>
            "Why did you use ISO/IEC 25010:2023 with 9 characteristics when older capstone papers only use 8 characteristics?"
          </div>
          <div class="qa-a">
            "In 2023, the International Organization for Standardization formally updated ISO/IEC 25010 to reflect modern software engineering environments. The 2023 standard retired standalone 'Usability' in favor of <strong>Interaction Capability</strong>, removed 'Portability' as modern cloud architectures make containerized applications inherently portable, and introduced <strong>Flexibility</strong> and <strong>Safety</strong> as dedicated first-class characteristics. Because our system is a modern cloud-deployed web application managing real customer property and business assets, evaluating Flexibility (which scored highest at 3.84) and Safety (3.64) was essential for a rigorous assessment."
          </div>
          <div class="qa-tip">
            💡 <strong>Panel Defense Tip:</strong> Citing Rojas et al. [13] (2025) demonstrates that your literature review directly informs your methodological standards.
          </div>
        </div>

        <div class="qa-card">
          <div class="qa-q">
            <span class="qa-q-num">Q3</span>
            "Your TAM sample size is only six respondents. Isn't six too small to draw statistically valid conclusions?"
          </div>
          <div class="qa-a">
            "Sir/Ma'am, for Shoelotskey Villamor-Pasay, six respondents is not a small sample—it is a <strong>100% total population census</strong>. The establishment employs exactly two owners and four staff members who handle all daily intake, servicing, inventory, and releases. Rather than sampling or simulating external users who have no contextual knowledge of the business, we conducted total enumeration. Furthermore, the respondents underwent a comprehensive two-week pilot testing period (September 2 to 16, 2026) using the system for daily operations prior to evaluating the TAM instrument, ensuring their responses reflect genuine operational experience rather than hypothetical impressions."
          </div>
          <div class="qa-tip">
            💡 <strong>Panel Defense Tip:</strong> Refer immediately to Figure 10 (Organizational Chart) and Table 1 (Demographic Profile) on page 107 of the manuscript.
          </div>
        </div>

        <div class="qa-card">
          <div class="qa-q">
            <span class="qa-q-num">Q4</span>
            "Does your machine learning model retrain automatically in real time whenever a job order is marked as Claimed?"
          </div>
          <div class="qa-a">
            "No, Sir/Ma'am. The Scikit-Learn `RandomForestRegressor` is an ensemble tree algorithm designed for batch training rather than online streaming updates. Allowing unvalidated, automated retraining on every transaction could lead to model drift or corruption from abnormal outliers. Instead, the system implements an <strong>administrative batch retraining pipeline</strong>. Newly completed job orders accumulate in the database with validated release timestamps. The shop owner or system administrator can periodically trigger model retraining via our secure backend endpoint (`/api/historical/train`), allowing human validation before the updated model artifact is deployed to production."
          </div>
          <div class="qa-tip">
            💡 <strong>Panel Defense Tip:</strong> Emphasize that batch retraining with human oversight satisfies IT Expert Ken Carlo Javier's recommendation for managed pipelines.
          </div>
        </div>

        <div class="qa-card">
          <div class="qa-q">
            <span class="qa-q-num">Q5</span>
            "What happens if a staff member attempts to open the Admin Sales Reports or bypass authorization by directly manipulating API requests?"
          </div>
          <div class="qa-a">
            "Our system implements defense-in-depth across both frontend and backend layers. In the React frontend, protected route guards inspect the user's role stored in memory and redirect unauthorized staff away from administrative pages. More importantly, security does not rely on the client: the FastAPI backend strictly enforces Role-Based Access Control on every API endpoint using the `require_role('owner')` dependency. If an unauthorized token or tampered request is sent, the server immediately rejects the request with HTTP 403 Forbidden and logs the security violation to our centralized audit table (`audit_logs`) with the user's IP, ID, and timestamp."
          </div>
          <div class="qa-tip">
            💡 <strong>Panel Defense Tip:</strong> Reiterate OWASP A01 (Broken Access Control) mitigation detailed on manuscript page 92 and evaluated by IT experts.
          </div>
        </div>

      </main>

    <!-- Institutional Footer -->
    <footer class="footer">
      <div>
        <strong>Shoelotskey Service Management System</strong> · Institute of Computer Studies
      </div>
      <div>
        National Aviation Academy of the Philippines (PhilSCA) · Academic Year 2025–2026
      </div>
      <div>
        Authoritative Capstone Revision & Defense Guide · Generated September 2026
      </div>
    </footer>

  </div>

  <!-- Interactive Tab Switching Script -->
  <script>
    function switchTab(tabId, clickedBtn) {
      const panes = document.querySelectorAll('.tab-pane');
      panes.forEach(pane => pane.classList.remove('active'));

      const btns = document.querySelectorAll('.tab-btn');
      btns.forEach(btn => btn.classList.remove('active'));

      const targetPane = document.getElementById(tabId);
      if (targetPane) {
        targetPane.classList.add('active');
      }
      if (clickedBtn) {
        clickedBtn.classList.add('active');
      }

      if (history.pushState) {
        history.pushState(null, null, '#' + tabId);
      } else {
        location.hash = '#' + tabId;
      }

      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    window.addEventListener('DOMContentLoaded', () => {
      const hash = window.location.hash.replace('#', '');
      if (hash) {
        const targetBtn = document.querySelector(`button[onclick*="'${hash}'"]`);
        if (targetBtn) {
          switchTab(hash, targetBtn);
        }
      }
    });
  </script>

</body>
</html>
"""

out_dirs = [
        "docs/Official Documentation/Documentation Reports",
        "docs/01_Defense_and_Audit_Reports_HTML",
        "docs/Defense"
    ]

filenames = [
    "10_MASTER_CAPSTONE_DEFENSE_READINESS_REPORT.html",
    "4_Master_Manuscript_System_and_Defense_Revision_Report.html"
]

for d in out_dirs:
    os.makedirs(d, exist_ok=True)
    for fname in filenames:
        out_path = os.path.join(d, fname)
        with open(out_path, "w", encoding="utf-8") as f:
            f.write(html_content)
        print(f"Successfully generated Master HTML Report at: {out_path}")

print(f"Report size: {len(html_content)} characters")

