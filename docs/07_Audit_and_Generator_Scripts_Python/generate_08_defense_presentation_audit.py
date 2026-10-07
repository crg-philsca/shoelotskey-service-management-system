import os
import sys

def generate_report():
    html_content = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Checkpoint 8: Capstone Defense Presentation (17-Slide Deck) Audit</title>
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
      max-width: 1380px;
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
      background: rgba(59, 130, 246, 0.15);
      border: 1px solid var(--primary);
      color: #93c5fd;
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
      font-size: 0.92rem;
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

    .tag-success { background: rgba(16, 185, 129, 0.2); color: #6ee7b7; border: 1px solid #10b981; }
    .tag-warning { background: rgba(245, 158, 11, 0.2); color: #fcd34d; border: 1px solid #f59e0b; }
    .tag-danger { background: rgba(239, 68, 68, 0.2); color: #fca5a5; border: 1px solid #ef4444; }

    .script-box {
      background: rgba(15, 23, 42, 0.8);
      border-left: 3px solid var(--primary);
      padding: 10px 14px;
      border-radius: 0 6px 6px 0;
      font-style: italic;
      color: #cbd5e1;
      margin-top: 8px;
      font-size: 0.88rem;
    }

    .proof-badge {
      display: block;
      margin-top: 6px;
      font-size: 0.8rem;
      color: #93c5fd;
      font-family: var(--font-mono);
      background: rgba(59, 130, 246, 0.1);
      padding: 4px 8px;
      border-radius: 4px;
      border-left: 2px solid var(--primary);
    }

    code {
      font-family: var(--font-mono);
      background: rgba(0, 0, 0, 0.3);
      padding: 2px 6px;
      border-radius: 4px;
      color: #f43f5e;
      font-size: 0.9em;
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
      <div class="badge-checkpoint">Checkpoint 8 / 10 &bull; Presentation Verification</div>
      <h1>Capstone Defense Presentation (17-Slide Deck) Audit</h1>
      <p class="subtitle">Slide-by-Slide Verification of the Authoritative Final Defense Presentation (September 22, 2026) Against System Code, Raw Research Data, and Manuscript Chapters 1–5.</p>
    </header>

    <!-- SCORECARD -->
    <div class="summary-grid">
      <div class="stat-card">
        <div class="stat-val" style="color: #3b82f6;">17 Slides</div>
        <div class="stat-label">Full Deck Audited</div>
      </div>
      <div class="stat-card">
        <div class="stat-val" style="color: #10b981;">N=26 Aligned</div>
        <div class="stat-label">Slide 11 Sample vs Holdout Clarified</div>
      </div>
      <div class="stat-card">
        <div class="stat-val" style="color: #fbbf24;">3.72 Reconciled</div>
        <div class="stat-label">Slide 13 Reliability Matched</div>
      </div>
      <div class="stat-card">
        <div class="stat-val" style="color: #c084fc;">100% Census</div>
        <div class="stat-label">Slide 12 TAM Population Stated</div>
      </div>
    </div>

    <!-- SECTION 1: SLIDE-BY-SLIDE AUDIT TABLE -->
    <div class="card">
      <div class="card-title">🖥 1. Comprehensive Slide-by-Slide Audit & Oral Defense Script</div>
      <table>
        <thead>
          <tr>
            <th style="width: 7%;">Slide</th>
            <th style="width: 20%;">Slide Topic & Core Content</th>
            <th style="width: 23%;">Discrepancy / Alignment Risk</th>
            <th style="width: 25%;">Required Slide Revision / Callout</th>
            <th style="width: 25%;">Oral Defense Talking Point</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Slide 1</strong></td>
            <td><strong>Title Slide</strong><br>Calibrated project title and research proponents.</td>
            <td>Subtitles may omit institutional affiliation or BS program designation.</td>
            <td>Prominently state: <em>Bachelor of Science in Aviation Information Technology (BSAIT), Institute of Computer Studies, PhilSCA</em>.</td>
            <td><div class="script-box">"Good morning, esteemed members of the panel. We present our capstone project: A Web-Based Service Management System with Data Analytics Using Machine Learning for Shoelotskey Shoe Repair and Care Services."</div></td>
          </tr>
          <tr>
            <td><strong>Slide 2</strong></td>
            <td><strong>Introduction & Problem</strong><br>Manual intake, fragmented records, paper slip loss, reporting delays.</td>
            <td>Omitting empirical baseline numbers weakens the operational justification.</td>
            <td>Explicitly present: 15–30 min manual lookup, 4–6 hrs report prep, 280–300 monthly transactions, paper slip vulnerability.</td>
            <td><div class="script-box">"Shoelotskey currently handles 280 to 300 repair transactions monthly using handwritten logbooks. Manual record lookup takes up to 30 minutes, and monthly accounting requires 4 to 6 hours of manual tallying."</div></td>
          </tr>
          <tr>
            <td><strong>Slide 3</strong></td>
            <td><strong>Purpose & Objectives</strong><br>Specific Objectives 1 through 6.</td>
            <td>Listing obsolete 2011 ISO characteristics or missing TAM census indicators.</td>
            <td>Align with exact 6 objectives: Intake digitization, QR self-tracking, Random Forest forecasting, Financial analytics, ISO/IEC 25010:2023 (9 traits), and TAM user acceptance.</td>
            <td><div class="script-box">"Our study addresses six specific objectives, establishing empirical manual-versus-digital comparisons, advisory duration forecasting, software quality evaluation across 9 characteristics, and staff acceptance."</div></td>
          </tr>
          <tr>
            <td><strong>Slide 4</strong></td>
            <td><strong>Conceptual Framework</strong><br>IPO Model with feedback mechanism.</td>
            <td>Claiming real-time continuous backprop learning creates an indefensible vulnerability.</td>
            <td>Depict closed-loop historical data ingestion feeding periodic administrative batch retraining (Option B).</td>
            <td><div class="script-box">"As shown in our conceptual framework, completed orders feed an archival repository that enables periodic administrative batch retraining, preventing model drift and ensuring operational stability."</div></td>
          </tr>
          <tr>
            <td><strong>Slide 5</strong></td>
            <td><strong>Methodology & SDLC</strong><br>Modified Waterfall Model phases.</td>
            <td>Generic waterfall stages without concrete milestone dates or activities.</td>
            <td>Specify activities: Requirements (March 2025), Architecture (April–July 2025), Coding (July 2025–August 2026), Pilot Testing (Sept 2–16, 2026), Expert Evaluation (Sept 9–19, 2026).</td>
            <td><div class="script-box">"We utilized a structured Waterfall SDLC with milestone deliverables at each phase, culminating in a rigorous two-week on-site pilot test in September 2026."</div></td>
          </tr>
          <tr>
            <td><strong>Slide 6</strong></td>
            <td><strong>System Architecture</strong><br>FastAPI backend, React Vite frontend, PostgreSQL database.</td>
            <td>Vague architecture diagrams without security layer or failover boundaries.</td>
            <td>Detail FastAPI REST API, SQLAlchemy ORM, PostgreSQL on AWS RDS, JWT 480m tokens, and native Bcrypt hashing.</td>
            <td><div class="script-box">"Our production architecture leverages FastAPI for asynchronous high-concurrency API handling and React Vite for reactive single-page client rendering, secured by JWT authentication and OWASP Top 10 controls."</div></td>
          </tr>
          <tr>
            <td><strong>Slide 7</strong></td>
            <td><strong>Data Gathering & Datasets</strong><br>Receipt archival ingestion and evaluation instruments.</td>
            <td>Unclear receipt sampling bounds or confusion over respondent sample sizes.</td>
            <td>Highlight: 714 raw receipts (Aug 2025–Jan 2026), 119 validated orders, N=5 faculty validators (S-CVI = 1.00), N=5 IT experts, N=6 shop census.</td>
            <td><div class="script-box">"Our empirical foundation is built upon 714 historical physical receipts across six monthly volumes, filtered into 119 clean service orders, and evaluated by 5 faculty validators, 5 external IT practitioners, and 6 shop personnel."</div></td>
          </tr>
          <tr>
            <td><strong>Slide 8</strong></td>
            <td><strong>ML Methodology</strong><br>Feature engineering and Random Forest Regressor.</td>
            <td>Calling the target 'technician completion time' instead of order-to-claim turnaround.</td>
            <td>Define target as empirical turnaround days (`claimed_date - date_received`). Detail 13 selected features and 5-fold expanding window cross-validation.</td>
            <td><div class="script-box">"The machine learning engine utilizes a 13-feature Random Forest Regressor to forecast customer turnaround duration, validated using expanding window time-series splits to prevent look-ahead bias."</div></td>
          </tr>
          <tr>
            <td><strong>Slide 9</strong></td>
            <td><strong>Operational Results: Intake</strong><br>Manual vs Digital record retrieval.</td>
            <td>Presenting synthetic or ungrounded retrieval benchmarks.</td>
            <td>Show empirical timing proofs: Manual retrieval average 5.20 minutes reduced to 0.41 minutes (92.12% reduction; 1.8s direct digital lookup).</td>
            <td><div class="script-box">"Digital intake reduced customer lookup time from an average of 5.20 minutes down to 0.41 minutes—a 92.12% efficiency gain, while eliminating lost physical paper receipts."</div></td>
          </tr>
          <tr>
            <td><strong>Slide 10</strong></td>
            <td><strong>Operational Results: Analytics</strong><br>Financial report compilation benchmarks.</td>
            <td>Failing to highlight the extreme time savings of automated reporting.</td>
            <td>Show empirical proofs: Manual financial reporting average 43.71 minutes reduced to 0.43 seconds (99.98% reduction), receiving 3.83 / 4.00 from management.</td>
            <td><div class="script-box">"The reporting module automates daily, weekly, monthly, and annual sales and ROI reports in under half a second, compressing a 43-minute manual chore into instantaneous business intelligence."</div></td>
          </tr>
          <tr>
            <td><strong>Slide 11</strong></td>
            <td><strong>Results: Machine Learning</strong><br>Prediction metrics and error distributions.</td>
            <td><span class="tag tag-danger">CRITICAL RISK</span> Slide caption stated '10-record sample'—panel may assume test set size was only N=10!</td>
            <td><strong>MANDATORY SLIDE REVISION:</strong> Clarify: <em>"Evaluated on complete N=26 locked test holdout (January 2026). Table 5 presents 10 illustrative sample records. MAE = 8.56 d, RMSE = 10.23 d, R² = -0.02. Deployed under Option B Advisory UI."</em></td>
            <td><div class="script-box">"On the full 26-record unseen January 2026 test set, the model achieved an MAE of 8.56 days—reducing error by 0.78 days over simple mean heuristics. Under our Option B architecture, this serves as an advisory guideline that staff can fine-tune based on shop conditions."</div></td>
          </tr>
          <tr>
            <td><strong>Slide 12</strong></td>
            <td><strong>Results: TAM User Acceptance</strong><br>Perceived Usefulness, Ease of Use, Intent, and Use.</td>
            <td>Panel asking why N=6 is considered valid without highlighting total population census.</td>
            <td>Emphasize: <strong>N=6 represents 100% total population census</strong> of Shoelotskey shop personnel (2 owners, 4 technicians). Grand Mean = 3.88 / 4.00; PU = 4.00, ASU = 4.00.</td>
            <td><div class="script-box">"Our Technology Acceptance evaluation encompassed a 100% census of all shop personnel. The system achieved a Grand Weighted Mean of 3.88 out of 4.00, with perfect 4.00 ratings in Perceived Usefulness and Actual System Use."</div></td>
          </tr>
          <tr>
            <td><strong>Slide 13</strong></td>
            <td><strong>Results: ISO/IEC 25010:2023</strong><br>Expert software product quality ratings.</td>
            <td>Narrative contradiction mentioning Reliability as 3.76 instead of 3.72.</td>
            <td>Display exact verified scores: Grand Weighted Mean = 3.71 / 4.00. Flexibility = 3.84, Compatibility = 3.76, Reliability = 3.72, Maintainability = 3.72, Interaction Capability = 3.72.</td>
            <td><div class="script-box">"Five external IT practitioners evaluated the system across all nine ISO 25010:2023 characteristics, conferring an overall mean of 3.71, interpreted as Highly Acceptable, with Compatibility at 3.76 and Reliability at 3.72."</div></td>
          </tr>
          <tr>
            <td><strong>Slide 14</strong></td>
            <td><strong>Results: Expert Suggestions</strong><br>Table 25 qualitative recommendations.</td>
            <td>Appearing defensive if asked why certain expert suggestions were not fully deployed.</td>
            <td>Present 100% resolution or Phase 2 roadmap classification: Creatable Combobox implemented, Inventory audit logs added, SMS triggers ready for webhook integration.</td>
            <td><div class="script-box">"All expert suggestions were triaged: customizable dropdowns and inventory audit logging were fully implemented, while automated SMS carrier integration is prepared in code and designated as Phase 2 to prevent per-message billing overhead."</div></td>
          </tr>
          <tr>
            <td><strong>Slide 15</strong></td>
            <td><strong>Synthesis & Triangulation</strong><br>Holistic research findings summary.</td>
            <td>Over-claiming AI capabilities without acknowledging operational realities.</td>
            <td>Present grounded triangulation: Digital operational transformation succeeded (92% & 99% gains), user adoption is unanimous (3.88), software quality is verified (3.71), ML operates safely under human-in-the-loop oversight.</td>
            <td><div class="script-box">"In synthesis, the project successfully digitizes Shoelotskey's operations, delivers proven time reductions, achieves top-tier software quality, and implements machine learning safely within a human-in-the-loop paradigm."</div></td>
          </tr>
          <tr>
            <td><strong>Slide 16</strong></td>
            <td><strong>Live System Demonstration</strong><br>Real-time software walkthrough.</td>
            <td>Fumbling live demo steps or getting locked out by security features.</td>
            <td>Pre-stage demo accounts: Admin (`admin`), Staff (`staff`), Customer QR code tracking link, and sample draft job orders.</td>
            <td><div class="script-box">"We will now demonstrate key operational workflows: role-based intake, dual-date advisory ML forecasting, customer QR status lookup, and instantaneous sales reporting."</div></td>
          </tr>
          <tr>
            <td><strong>Slide 17</strong></td>
            <td><strong>Conclusion & Defense Q&A</strong><br>Closing slide with acknowledgments.</td>
            <td>Missing live links, advisor credits, or institutional contact info.</td>
            <td>Include GitHub repository link, staging URL, adviser credits (Richard Niel B. Peralta, MSIT), and research panel gratitude.</td>
            <td><div class="script-box">"Thank you, honorable panel members and advisers. We now respectfully welcome your questions, comments, and guidance."</div></td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- SECTION 2: DEFENSE PANEL ORAL PLAYBOOK -->
    <div class="card">
      <div class="card-title">🛡 2. High-Stakes Presentation Defense Q&A</div>

      <div class="defense-qa">
        <div class="qa-q">Panel Question: "On Slide 11, you state that the 10-record test sample has high prediction error. Why did you only test on 10 records?"</div>
        <div class="qa-a">
          <strong>Candidate Defense:</strong> "Thank you for the question, esteemed panel. We want to clarify that our model was not evaluated on only 10 records. In Chapter 4, Table 5 presents a 10-record illustrative sample simply to display the individual feature values within the page margins. Our actual empirical evaluation in Table 6 was conducted on the complete, locked 26-record test set representing 100% of January 2026 transactions. Across all 26 unseen records, the model achieved an MAE of 8.56 days and an RMSE of 10.23 days."
        </div>
      </div>

      <div class="defense-qa">
        <div class="qa-q">Panel Question: "On Slide 12, how can a sample size of N=6 be statistically valid for your Technology Acceptance Model?"</div>
        <div class="qa-a">
          <strong>Candidate Defense:</strong> "Sir/Ma'am, in enterprise systems research, when evaluating a proprietary solution built for a specific enterprise, sampling the entire staff constitutes a 100% population census rather than a sample. Shoelotskey operates with a total workforce of exactly six personnel: two shop owners and four technicians. Evaluating all six individuals guarantees zero sampling error for the target deployment environment."
        </div>
      </div>

      <div class="defense-qa">
        <div class="qa-q">Panel Question: "On Slide 13, does your software quality evaluation strictly conform to the 2023 standard?"</div>
        <div class="qa-a">
          <strong>Candidate Defense:</strong> "Yes, Sir/Ma'am. In accordance with panel revisions, we upgraded our evaluation instrument to ISO/IEC 25010:2023, assessing all nine product quality characteristics: Functional Suitability, Performance Efficiency, Compatibility, Interaction Capability, Reliability, Security, Maintainability, Flexibility, and Safety. Five credentialed external IT practitioners evaluated the live deployed system, conferring a composite mean of 3.71 out of 4.00, which corresponds to the 'Highly Acceptable' rating."
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
        out_path = os.path.join(d, "08_DEFENSE_PRESENTATION_AUDIT.html")
        with open(out_path, "w", encoding="utf-8") as f:
            f.write(html_content)
        print(f"Saved Checkpoint 8 report to: {out_path}")

if __name__ == "__main__":
    generate_report()
