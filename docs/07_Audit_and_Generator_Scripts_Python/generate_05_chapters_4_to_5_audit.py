import os
import sys

def generate_report():
    html_content = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Checkpoint 5: Chapters 4 to 5 Manuscript Audit & Alignment</title>
  <style>
    :root {
      --bg: #0f172a;
      --card-bg: #1e293b;
      --card-border: #334155;
      --text-main: #f8fafc;
      --text-muted: #94a3b8;
      --primary: #3b82f6;
      --success: #10b981;
      --warning: #f59e0b;
      --danger: #ef4444;
      --purple: #8b5cf6;
      --font-mono: 'Consolas', 'Courier New', monospace;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--bg);
      color: var(--text-main);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.6;
      padding: 30px;
    }

    .container {
      max-width: 1280px;
      margin: 0 auto;
    }

    header {
      border-bottom: 2px solid var(--card-border);
      padding-bottom: 25px;
      margin-bottom: 35px;
    }

    .badge-checkpoint {
      display: inline-block;
      padding: 6px 14px;
      background: rgba(239, 68, 68, 0.15);
      border: 1px solid var(--danger);
      color: #f87171;
      border-radius: 9999px;
      font-size: 0.85rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 12px;
    }

    h1 {
      font-size: 2.2rem;
      font-weight: 800;
      color: #ffffff;
      margin-bottom: 10px;
    }

    .subtitle {
      color: var(--text-muted);
      font-size: 1.1rem;
    }

    .card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 28px;
    }

    .card-title {
      font-size: 1.4rem;
      font-weight: 700;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 10px;
      color: #e2e8f0;
      border-bottom: 1px solid var(--card-border);
      padding-bottom: 12px;
    }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 18px;
      margin-bottom: 28px;
    }

    .stat-card {
      background: rgba(15, 23, 42, 0.6);
      border: 1px solid var(--card-border);
      border-radius: 8px;
      padding: 18px;
    }

    .stat-val {
      font-size: 1.8rem;
      font-weight: 800;
      margin-bottom: 4px;
    }

    .stat-label {
      color: var(--text-muted);
      font-size: 0.85rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin: 16px 0;
      font-size: 0.95rem;
    }

    th, td {
      padding: 12px 14px;
      border: 1px solid var(--card-border);
      text-align: left;
      vertical-align: top;
    }

    th {
      background: #0f172a;
      color: #93c5fd;
      font-weight: 700;
      font-size: 0.85rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    tr:nth-child(even) {
      background: rgba(255, 255, 255, 0.02);
    }

    .tag {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
    }

    .tag-danger { background: rgba(239, 68, 68, 0.2); color: #fca5a5; border: 1px solid #ef4444; }
    .tag-warning { background: rgba(245, 158, 11, 0.2); color: #fcd34d; border: 1px solid #f59e0b; }
    .tag-success { background: rgba(16, 185, 129, 0.2); color: #6ee7b7; border: 1px solid #10b981; }

    .diff-container {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin: 16px 0;
    }

    @media (max-width: 860px) {
      .diff-container { grid-template-columns: 1fr; }
    }

    .diff-box {
      border-radius: 8px;
      padding: 16px;
      font-size: 0.9rem;
      line-height: 1.6;
    }

    .diff-before {
      background: rgba(239, 68, 68, 0.08);
      border: 1px solid rgba(239, 68, 68, 0.4);
    }

    .diff-after {
      background: rgba(16, 185, 129, 0.08);
      border: 1px solid rgba(16, 185, 129, 0.4);
    }

    .diff-label {
      font-weight: 700;
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .diff-before .diff-label { color: #f87171; }
    .diff-after .diff-label { color: #34d399; }

    code {
      font-family: var(--font-mono);
      background: rgba(0, 0, 0, 0.3);
      padding: 2px 6px;
      border-radius: 4px;
      color: #f43f5e;
      font-size: 0.9em;
    }

    .replacement-card {
      background: rgba(15, 23, 42, 0.8);
      border: 1px solid #3b82f6;
      border-radius: 8px;
      padding: 20px;
      margin-top: 15px;
      margin-bottom: 25px;
    }

    .card-header-flex {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
      border-bottom: 1px solid var(--card-border);
      padding-bottom: 8px;
    }

    .page-ref {
      font-family: var(--font-mono);
      font-size: 0.85rem;
      color: #fbbf24;
      background: rgba(251, 191, 36, 0.1);
      padding: 3px 8px;
      border-radius: 4px;
    }

    .callout {
      padding: 16px 20px;
      border-radius: 8px;
      margin: 16px 0;
      border-left: 4px solid;
    }

    .callout-danger {
      background: rgba(239, 68, 68, 0.1);
      border-color: var(--danger);
      color: #fecaca;
    }

    .defense-qa {
      background: rgba(30, 41, 59, 0.7);
      border-left: 4px solid var(--purple);
      padding: 16px 20px;
      margin: 14px 0;
      border-radius: 0 8px 8px 0;
    }

    .qa-q {
      font-weight: 700;
      color: #c084fc;
      margin-bottom: 8px;
      font-size: 1rem;
    }

    .qa-a {
      color: #e2e8f0;
      font-size: 0.92rem;
    }
  </style>
</head>
<body>

  <div class="container">
    <header>
      <div class="badge-checkpoint">Checkpoint 5 / 10 &bull; Results & Conclusions Quality Assurance</div>
      <h1>Chapters 4 to 5 Manuscript Audit & Reconciliation</h1>
      <p class="subtitle">Resolution of Numerical Contradictions, Date Anachronisms, Table Sequence Gaps, Syntactical Errors, and Final Harmonization of Conclusions & Recommendations with Specific Objectives 1–6.</p>
    </header>

    <!-- KPI SUMMARY -->
    <div class="summary-grid">
      <div class="stat-card">
        <div class="stat-val" style="color: #ef4444;">1 Year</div>
        <div class="stat-label">Date Gap Fixed (2025 &rarr; 2026)</div>
      </div>
      <div class="stat-card">
        <div class="stat-val" style="color: #3b82f6;">3.72 vs 3.76</div>
        <div class="stat-label">Reliability Reconciled</div>
      </div>
      <div class="stat-card">
        <div class="stat-val" style="color: #fbbf24;">Tables 14 & 15</div>
        <div class="stat-label">Numbering Sequence Fixed</div>
      </div>
      <div class="stat-card">
        <div class="stat-val" style="color: #10b981;">6 to 6</div>
        <div class="stat-label">Obj &rarr; Conclusion &rarr; Reco Sync</div>
      </div>
    </div>

    <!-- AUDIT SUMMARY TABLE -->
    <div class="card">
      <div class="card-title">📌 Executive Audit Matrix: Chapters 4 and 5</div>
      <table>
        <thead>
          <tr>
            <th>Location</th>
            <th>Type of Defect</th>
            <th>Original Manuscript Content</th>
            <th>Corrected State & Action</th>
            <th>Severity</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Page 101, Para 5</strong></td>
            <td>Date Anachronism</td>
            <td>Claims survey questionnaires distributed from <code>September 9 to September 19, 2025</code>.</td>
            <td>Correct to <code>September 9 to September 19, 2026</code>. (Pilot testing was Sept 2026; 2025 is an uncorrected proposal copy-paste).</td>
            <td><span class="tag tag-danger">Critical</span></td>
          </tr>
          <tr>
            <td><strong>Pages 127, 141, 149</strong></td>
            <td>Numerical Contradiction</td>
            <td>Narrative states Reliability obtained GWM of <code>3.76 (SD = 0.31)</code>, tying with Compatibility.</td>
            <td>Correct Reliability to <code>3.72 (SD = 0.49)</code>. Compatibility is 3.76; Table 13 and Table 24 already record 3.72.</td>
            <td><span class="tag tag-danger">Critical</span></td>
          </tr>
          <tr>
            <td><strong>Pages 126–128</strong></td>
            <td>Table Sequence Gap</td>
            <td>Table 13 (Reliability, p. 126) is followed directly by Table 16 (Security, p. 128). Tables 14 & 15 are missing.</td>
            <td>Renumber sequential tables (Table 16 &rarr; Table 14, Table 17 &rarr; Table 15, etc.) and update all in-text references.</td>
            <td><span class="tag tag-warning">Major</span></td>
          </tr>
          <tr>
            <td><strong>Page 144, Section 6</strong></td>
            <td>Cross-Reference Typo</td>
            <td>Refers to <code>"suggestions and comments presented in Table 24"</code>.</td>
            <td>Change to <code>Table 25</code>. (Table 24 is the TAM/ISO Grand Summary; suggestions are in Table 25).</td>
            <td><span class="tag tag-warning">Major</span></td>
          </tr>
          <tr>
            <td><strong>Page 120</strong></td>
            <td>Grammar Defect</td>
            <td><code>"the two indicator was"</code> and double verb <code>"is was"</code>.</td>
            <td>Replace with <code>"two indicators were"</code> and <code>"was"</code>.</td>
            <td><span class="tag tag-warning">Major</span></td>
          </tr>
          <tr>
            <td><strong>Pages 137, 138</strong></td>
            <td>Punctuation Defect</td>
            <td>Floating dot typography: <code>"3.83 . 0.41"</code> and <code>"3.67 . 0.52"</code>.</td>
            <td>Replace with standard academic format: <code>"3.83 (SD = 0.41)"</code> and <code>"3.67 (SD = 0.52)"</code>.</td>
            <td><span class="tag tag-warning">Major</span></td>
          </tr>
          <tr>
            <td><strong>Chapter 5 (pp. 145–155)</strong></td>
            <td>Construct Alignment</td>
            <td>Conclusions and recommendations lack 1:1 mapping with Specific Objectives 1–6.</td>
            <td>Structure Chapter 5 Conclusions and Recommendations into 6 discrete, numbered items corresponding to Specific Objectives 1–6.</td>
            <td><span class="tag tag-success">Aligned</span></td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- DETAILED REPLACEMENT CARDS -->
    <div class="card">
      <div class="card-title">📖 Chapter 4: Exact Copy-Paste Replacement Cards</div>

      <!-- ITEM 1: DATE ANACHRONISM -->
      <div class="replacement-card">
        <div class="card-header-flex">
          <span class="page-ref">Page 101 &bull; Paragraph 5 &bull; Timeline Discrepancy</span>
          <span class="tag tag-danger">Critical Timeline Anachronism</span>
        </div>
        <div class="diff-container">
          <div class="diff-box diff-before">
            <div class="diff-label">❌ Flawed Original Text (Page 101)</div>
            "Finally, separate evaluation questionnaires were distributed to the intended evaluator groups from September 9 to September 19, 2025. The Shoelotskey owner, co-owner, and staff, consisting of six (6) respondents, evaluated the user acceptance..."
          </div>
          <div class="diff-box diff-after">
            <div class="diff-label">✔ Exact Approved Replacement Text</div>
            "Finally, separate evaluation questionnaires were distributed to the intended evaluator groups from September 9 to September 19, 2026. The Shoelotskey owner, co-owner, and staff, consisting of six (6) respondents, evaluated the user acceptance..."
          </div>
        </div>
        <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 8px;">
          <em>Rationale: Pilot testing occurred September 2–16, 2026, and historical receipt ingestion ran to January 2026. A 2025 date would trigger instant panel cross-examination.</em>
        </p>
      </div>

      <!-- ITEM 2: RELIABILITY NUMERICAL CONTRADICTION -->
      <div class="replacement-card">
        <div class="card-header-flex">
          <span class="page-ref">Pages 127, 141, 149 &bull; Reliability Mean Reconciled</span>
          <span class="tag tag-danger">Numerical Contradiction</span>
        </div>
        <div class="diff-container">
          <div class="diff-box diff-before">
            <div class="diff-label">❌ Flawed Narrative Text (Pages 127, 141, 149)</div>
            <strong>Page 127:</strong> "As shown in Table 13, the Reliability of the Web-Based Service Management System achieved a general weighted mean of 3.76 with a standard deviation of 0.31..."<br><br>
            <strong>Pages 141 & 149:</strong> "...followed by Reliability and Compatibility with a mean of 3.76. Interaction Capability and Maintainability both obtained a mean of 3.72..."
          </div>
          <div class="diff-box diff-after">
            <div class="diff-label">✔ Exact Approved Replacement Text</div>
            <strong>Page 127:</strong> "As shown in Table 13, the Reliability of the Web-Based Service Management System achieved a general weighted mean of 3.72 with a standard deviation of 0.49, interpreted as Highly Acceptable..."<br><br>
            <strong>Pages 141 & 149:</strong> "...followed by Compatibility with a mean of 3.76 (SD = 0.31), and Reliability, Interaction Capability, and Maintainability, each obtaining a mean of 3.72..."
          </div>
        </div>
        <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 8px;">
          <em>Rationale: Table 13 (Page 126) and Table 24 (Page 140) calculate 3.72 (SD = 0.49). Compatibility alone is 3.76 (SD = 0.31). The narrative must match the tables.</em>
        </p>
      </div>

      <!-- ITEM 3: CROSS-REFERENCE TYPO -->
      <div class="replacement-card">
        <div class="card-header-flex">
          <span class="page-ref">Page 144 &bull; Section 6 &bull; Table Reference</span>
          <span class="tag tag-warning">Cross-Reference Error</span>
        </div>
        <div class="diff-container">
          <div class="diff-box diff-before">
            <div class="diff-label">❌ Flawed Original Text (Page 144)</div>
            "Based on the suggestions and comments presented in Table 24, several key enhancements were identified by the IT experts to further improve the system's security, scalability, and integration capabilities..."
          </div>
          <div class="diff-box diff-after">
            <div class="diff-label">✔ Exact Approved Replacement Text</div>
            "Based on the suggestions and comments presented in Table 25, several key enhancements were identified by the IT experts to further improve the system's security, scalability, and integration capabilities..."
          </div>
        </div>
      </div>

      <!-- ITEM 4: GRAMMATICAL DEFECTS -->
      <div class="replacement-card">
        <div class="card-header-flex">
          <span class="page-ref">Pages 120, 123, 137, 143 &bull; Syntactical Polishing</span>
          <span class="tag tag-warning">Academic Grammar Fixes</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>Page</th>
              <th>Original Flawed Text</th>
              <th>Corrected Replacement Text</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>p. 120</strong></td>
              <td>"The three indicators were rated Highly Acceptable while the two indicator was rated Acceptable..."</td>
              <td>"Three indicators were rated Highly Acceptable, while two indicators were rated Acceptable..."</td>
            </tr>
            <tr>
              <td><strong>p. 120</strong></td>
              <td>"This suggests that the system is was positively evaluated in terms of functional suitability..."</td>
              <td>"This demonstrates that the system was positively evaluated in terms of functional suitability..."</td>
            </tr>
            <tr>
              <td><strong>p. 123</strong></td>
              <td>"...demonstrated successful integration among the evaluated modules with its various modules and platforms."</td>
              <td>"...demonstrated successful integration across all functional modules and supported client platforms."</td>
            </tr>
            <tr>
              <td><strong>pp. 137–138</strong></td>
              <td><code>3.83 . 0.41</code> and <code>3.67 . 0.52</code></td>
              <td><code>3.83 (SD = 0.41)</code> and <code>3.67 (SD = 0.52)</code></td>
            </tr>
            <tr>
              <td><strong>p. 143</strong></td>
              <td>"...the users' summary and ranking of suggestions and comments revealed that the most frequently cited suggestion among IT experts..."</td>
              <td>"...the summary and ranking of suggestions and comments revealed that the most frequently cited suggestion among IT experts..."</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- CHAPTER 5 HARMONIZATION -->
    <div class="card">
      <div class="card-title">🎯 Chapter 5: Complete 1-to-1 Harmonization Architecture</div>
      <p style="color: var(--text-muted); margin-bottom: 16px;">
        To achieve maximum defense defense integrity, Chapter 5 (Conclusions and Recommendations) must follow strict 1-to-1 correspondence with the six (6) Specific Objectives established in Chapter 1:
      </p>

      <table>
        <thead>
          <tr>
            <th>Specific Objective</th>
            <th>Aligned Chapter 5 Conclusion</th>
            <th>Aligned Chapter 5 Recommendation</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Obj 1: Centralized Job Order Management</strong></td>
            <td>The web-based order entry system successfully digitized shop intake, reducing record retrieval times from 15–30 minutes to 1.8 seconds (99.8% reduction) with 100% record integrity.</td>
            <td>Deploy dedicated counter tablets with Bluetooth receipt printing to further streamline front-desk multi-pair customer intake.</td>
          </tr>
          <tr>
            <td><strong>Obj 2: Customer Self-Service Tracking</strong></td>
            <td>The public tracking portal and digital PIN verification eliminate manual phone inquiries and provide transparent, real-time repair progress tracking.</td>
            <td>Integrate an automated SMS notification gateway (GSM modem or Telco API) to automatically notify customers upon status transition to 'Ready for Pickup'.</td>
          </tr>
          <tr>
            <td><strong>Obj 3: Random Forest Duration Forecasting</strong></td>
            <td>The 13-feature Random Forest model provides realistic advisory turnaround predictions (MAE = 8.56 days on unseen test data), reducing prediction error by 0.78 days over simple mean heuristics while operating safely under the Option B advisory UI.</td>
            <td>Incorporate continuous administrative batch retraining as transaction density increases to capture seasonal demand fluctuations and technician specialization patterns.</td>
          </tr>
          <tr>
            <td><strong>Obj 4: Business Analytics & Reporting</strong></td>
            <td>The integrated analytics dashboard generates daily, weekly, monthly, and quarterly financial summaries in under 12 seconds, reducing reporting overhead from 4–6 hours to seconds.</td>
            <td>Expand reporting capabilities to include automated inventory reorder alerts linked to repair supply depletion thresholds.</td>
          </tr>
          <tr>
            <td><strong>Obj 5: ISO/IEC 25010:2023 Software Quality</strong></td>
            <td>The system achieved a Grand Weighted Mean of 3.71 / 4.00 (Highly Acceptable) across all nine product quality characteristics, validated by five credentialed IT experts.</td>
            <td>Implement automated CI/CD security scanning, multi-region database replication, and automated disaster recovery failover procedures as user traffic scales.</td>
          </tr>
          <tr>
            <td><strong>Obj 6: User Acceptance (TAM Adoption)</strong></td>
            <td>The system achieved an exceptional TAM acceptance score of 3.88 / 4.00 among a 100% census of shop personnel, with Perceived Usefulness and Actual System Use achieving perfect 4.00 ratings.</td>
            <td>Formulate a structured on-boarding manual and periodic refresher training for future shop apprentices and technicians.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- DEFENSE PREPARATION -->
    <div class="card">
      <div class="card-title">🛡 Chapters 4 to 5 Oral Defense Playbook</div>

      <div class="defense-qa">
        <div class="qa-q">Panel Question: "Why does the narrative in Chapter 4 say Reliability is 3.76, while Table 13 says 3.72?"</div>
        <div class="qa-a">
          <strong>Candidate Defense:</strong> "Thank you for the meticulous observation, esteemed panel. In Table 13 and Table 24, our raw computed weighted mean for Reliability is mathematically 3.72 with a standard deviation of 0.49. The narrative on page 127 contained an erratum where the Compatibility score of 3.76 was inadvertently repeated. We have formally reconciled this in our post-audit errata: Compatibility is 3.76, while Reliability, Interaction Capability, and Maintainability are each 3.72—all firmly within the Highly Acceptable rating bracket."
        </div>
      </div>

      <div class="defense-qa">
        <div class="qa-q">Panel Question: "Why does page 101 mention September 2025 when your pilot test took place in September 2026?"</div>
        <div class="qa-a">
          <strong>Candidate Defense:</strong> "The September 2025 timestamp on page 101 was an editorial copy-paste remnant from our initial proposal draft timeline. As correctly documented throughout the rest of Chapter 4, our pilot testing took place from September 2 to September 16, 2026, and our survey questionnaires were administered from September 9 to September 19, 2026, following complete historical receipt review up to January 2026."
        </div>
      </div>
    </div>

  </div>

</body>
</html>
"""

    out_dirs = [
        "docs/Official Documentation/Documentation Reports",
        "docs/01_Defense_and_Audit_Reports_HTML",
        "docs/Defense"
    ]

    for d in out_dirs:
        os.makedirs(d, exist_ok=True)
        out_path = os.path.join(d, "05_CHAPTERS_4_TO_5_AUDIT.html")
        with open(out_path, "w", encoding="utf-8") as f:
            f.write(html_content)
        print(f"Saved Checkpoint 5 report to: {out_path}")

if __name__ == "__main__":
    generate_report()
