import os
import sys

def generate_report():
    html_content = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Checkpoint 3: Chapters 1 to 3 Manuscript Audit & Defense Alignment</title>
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
      background: rgba(59, 130, 246, 0.15);
      border: 1px solid var(--primary);
      color: #60a5fa;
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
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
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
    .tag-info { background: rgba(59, 130, 246, 0.2); color: #93c5fd; border: 1px solid #3b82f6; }

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
      <div class="badge-checkpoint">Checkpoint 3 / 10 &bull; Manuscript Quality Assurance</div>
      <h1>Chapters 1 to 3 Manuscript Audit & Defense Alignment</h1>
      <p class="subtitle">Complete Section-by-Section Forensic Verification: Research Questions, Specific Objectives, Conceptual Framework, Literature Review, Waterfall SDLC, Cost Calculations, and Likert Evaluation Formats.</p>
    </header>

    <!-- SCORECARD -->
    <div class="summary-grid">
      <div class="stat-card">
        <div class="stat-val" style="color: #ef4444;">4</div>
        <div class="stat-label">Critical Defects In Ch 1–3</div>
      </div>
      <div class="stat-card">
        <div class="stat-val" style="color: #10b981;">100%</div>
        <div class="stat-label">Copy-Paste Fix Coverage</div>
      </div>
      <div class="stat-card">
        <div class="stat-val" style="color: #60a5fa;">ISO:2023</div>
        <div class="stat-label">9-Quality Alignment Standard</div>
      </div>
      <div class="stat-card">
        <div class="stat-val" style="color: #fbbf24;">4-Point</div>
        <div class="stat-label">Likert Scale Calibration</div>
      </div>
    </div>

    <!-- AUDIT SUMMARY MATRIX -->
    <div class="card">
      <div class="card-title">📌 Executive Audit Matrix: Chapters 1 to 3</div>
      <table>
        <thead>
          <tr>
            <th>Manuscript Section</th>
            <th>Original State in Manuscript</th>
            <th>Ground Truth / Audit Finding</th>
            <th>Severity</th>
            <th>Required Revision</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Ch 1: Figure 1 (Conceptual Framework, p. 9)</strong></td>
            <td>Typo <code>"6. Transaction reocords"</code>; lists 2011 ISO (7 traits); claims real-time online ML feedback loop.</td>
            <td>Obvious spelling typo; ISO 25010:2023 has 9 characteristics; ML is administrative batch retrain, not real-time backprop.</td>
            <td><span class="tag tag-danger">Critical</span></td>
            <td>Fix typo, update to 9 ISO 25010:2023 characteristics, and rewrite feedback narrative to describe administrative batch retraining.</td>
          </tr>
          <tr>
            <td><strong>Ch 1: Research Question 4 (p. 5)</strong></td>
            <td>Lists only 7 characteristics (Usability, Portability); completely omits Compatibility and Safety. Ends with missing 2023 terms.</td>
            <td>ISO/IEC 25010:2023 defines 9 product qualities: Functional Suitability, Performance Efficiency, Compatibility, Interaction Capability, Reliability, Security, Maintainability, Flexibility, Safety.</td>
            <td><span class="tag tag-danger">Critical</span></td>
            <td>Update RQ4 list to exact 9 ISO 25010:2023 characteristics.</td>
          </tr>
          <tr>
            <td><strong>Ch 1: Specific Objectives (pp. 10–11)</strong></td>
            <td>Lists only 4 specific objectives in some sections; misses explicit TAM adoption and expert enhancement objectives.</td>
            <td>Research Questions 1–6 must map 1:1 with Specific Objectives 1–6 to avoid panel construct drift critique.</td>
            <td><span class="tag tag-warning">Major</span></td>
            <td>Align Specific Objectives 1 to 6 to exactly match Research Questions 1 to 6.</td>
          </tr>
          <tr>
            <td><strong>Ch 2: Machine Learning Review (pp. 19–21)</strong></td>
            <td>Cites Random Forest literature (Breiman 2001, Caturkusuma et al. 2022) but lacks formal data leakage defense.</td>
            <td>Actual codebase excludes post-intake variables (`grand_total`, `expected_release_date`, `completion_days`) from training.</td>
            <td><span class="tag tag-info">Defense Enhancement</span></td>
            <td>Add formal paragraph in Ch 2 explaining data leakage prevention in supervised service duration modeling.</td>
          </tr>
          <tr>
            <td><strong>Ch 3: Table 1 & Phase 1 Cost (pp. 52, 58)</strong></td>
            <td>Typo in sum: <code>1,500 + 2,200 + 1,000 +7 20 = ₱5,420</code>. Header reads <code>Quantity/Assum ption</code>.</td>
            <td>Broken digit spacing in 720 and broken syllable in word "Assumption".</td>
            <td><span class="tag tag-danger">Critical</span></td>
            <td>Replace with <code>₱1,500 + ₱2,200 + ₱1,000 + ₱720 = ₱5,420</code> and fix header to <code>Quantity / Assumption</code>.</td>
          </tr>
          <tr>
            <td><strong>Ch 3: Architectural Diagrams (Figures 5, 7, 8, 9)</strong></td>
            <td>Miniature low-resolution raster images where foreign keys and table fields in ERD are unreadable.</td>
            <td>Panel defense standard requires legible database schema to evaluate 3NF normalization and foreign keys.</td>
            <td><span class="tag tag-warning">Major</span></td>
            <td>Replace with vector diagrams or insert full-page landscape schematics in Appendix A/B.</td>
          </tr>
          <tr>
            <td><strong>Ch 3: Likert Scale Treatment (p. 64)</strong></td>
            <td>Mentions Likert scale but must strictly enforce the 4-point forced-choice interpretation table.</td>
            <td>Questionnaires use 4-point scale (1.00–4.00) without neutral midpoint to prevent central tendency bias.</td>
            <td><span class="tag tag-success">Verified</span></td>
            <td>Confirm 4-point interpretation intervals (3.26–4.00: Strongly Agree / Highly Acceptable, etc.).</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- CHAPTER 1 DETAILED REVISION CARDS -->
    <div class="card">
      <div class="card-title">📖 Chapter 1: Exact Copy-Paste Replacement Cards</div>

      <!-- ITEM 1 -->
      <div class="replacement-card">
        <div class="card-header-flex">
          <span class="page-ref">Page 9 &bull; Figure 1 Conceptual Framework</span>
          <span class="tag tag-danger">Critical Defect</span>
        </div>
        <div class="diff-container">
          <div class="diff-box diff-before">
            <div class="diff-label">❌ Flawed Original Content (Figure 1 & Narrative)</div>
            <strong>INPUT:</strong><br>
            6. Transaction reocords [TYPO]<br><br>
            <strong>PROCESS:</strong><br>
            7. ISO/IEC 25010: Functional suitability, usability, reliability, performance, security, maintainability, portability. [OBSOLETE 2011 MODEL - 7 TRAITS]<br><br>
            <strong>FEEDBACK LOOP:</strong><br>
            "The feedback loop allows the system to learn from its mistakes in real-time. If an ML prediction was wrong, the actual completion time is fed back in real-time to improve future accuracy." [MISLEADING ONLINE BACKPROP CLAIM]
          </div>
          <div class="diff-box diff-after">
            <div class="diff-label">✔ Exact Approved Replacement Text</div>
            <strong>INPUT:</strong><br>
            6. Transaction records [CORRECTED]<br><br>
            <strong>PROCESS:</strong><br>
            7. ISO/IEC 25010:2023: Functional Suitability, Performance Efficiency, Compatibility, Interaction Capability, Reliability, Security, Maintainability, Flexibility, Safety. TAM: Perceived Usefulness, Perceived Ease of Use, Behavioral Intention to Use, Actual System Use.<br><br>
            <strong>FEEDBACK LOOP:</strong><br>
            "The conceptual framework incorporates a closed-loop historical data ingestion pipeline. As job orders are completed and claimed, their validated operational attributes are archived. The business owner can periodically trigger an administrative batch model retraining routine via <code>/api/historical/train</code>, enabling the Random Forest model to ingest newly validated empirical records and adjust to long-term shop trends over time."
          </div>
        </div>
      </div>

      <!-- ITEM 2 -->
      <div class="replacement-card">
        <div class="card-header-flex">
          <span class="page-ref">Page 5 &bull; Research Question 4 (RQ4)</span>
          <span class="tag tag-danger">Critical Defect</span>
        </div>
        <div class="diff-container">
          <div class="diff-box diff-before">
            <div class="diff-label">❌ Flawed Original Content (Page 5)</div>
            "4. To what extent does the developed system meet ISO/IEC 25010 software quality standards in terms of: 4.1 Functional suitability, 4.2 Performance efficiency, 4.3 Usability, 4.4 Reliability, 4.5 Security, 4.6 Maintainability, and 4.7 Portability?"
          </div>
          <div class="diff-box diff-after">
            <div class="diff-label">✔ Exact Approved Replacement Text</div>
            "4. To what extent does the developed system comply with ISO/IEC 25010:2023 software product quality standards across the following characteristics: 4.1 Functional Suitability, 4.2 Performance Efficiency, 4.3 Compatibility, 4.4 Interaction Capability, 4.5 Reliability, 4.6 Security, 4.7 Maintainability, 4.8 Flexibility, and 4.9 Safety?"
          </div>
        </div>
      </div>

      <!-- ITEM 3 -->
      <div class="replacement-card">
        <div class="card-header-flex">
          <span class="page-ref">Pages 10–11 &bull; Specific Objectives 1 to 6 Alignment</span>
          <span class="tag tag-warning">Major Alignment Fix</span>
        </div>
        <div class="diff-container">
          <div class="diff-box diff-before">
            <div class="diff-label">❌ Flawed Original Content (Incomplete 4 Objectives)</div>
            1. Develop centralized digital job order entry (< 5 min retrieval).<br>
            2. Implement ML model for predicting completion (target 85% accuracy).<br>
            3. Generate real-time analytics dashboard (< 1 hr monthly report).<br>
            4. Evaluate effectiveness based on ISO/IEC 25010.<br>
            <em>[TAM adoption and future recommendation objectives missing from numbered list]</em>
          </div>
          <div class="diff-box diff-after">
            <div class="diff-label">✔ Exact Approved 6-Objective Full Alignment</div>
            1. Design and develop a centralized digital job order entry and tracking system that reduces record retrieval time from 15–30 minutes to under 5 minutes.<br>
            2. Implement a public tracking and customer verification portal enabling self-service order lookup.<br>
            3. Train, evaluate, and integrate an advisory Random Forest machine learning turnaround estimation model using historical intake records.<br>
            4. Construct a real-time business analytics dashboard generating financial and service reports, reducing preparation overhead from 4–6 hours to under 1 hour.<br>
            5. Evaluate the technical software product quality using ISO/IEC 25010:2023 with external IT expert evaluators.<br>
            6. Assess operational end-user acceptance among management and staff using the Technology Acceptance Model (TAM).
          </div>
        </div>
      </div>
    </div>

    <!-- CHAPTER 2 AUDIT -->
    <div class="card">
      <div class="card-title">📚 Chapter 2: Literature Review & Theoretical Defenses</div>
      <p style="margin-bottom: 16px; color: var(--text-muted);">Chapter 2 provides the academic grounding for the technology choices and research methodology. Ensure the manuscript includes the following bulletproof theoretical justifications:</p>
      
      <div class="defense-qa">
        <div class="qa-q">1. Random Forest Regressor vs Deep Learning (Breiman, 2001)</div>
        <div class="qa-a">
          <strong>Literature Defense:</strong> For small, structured tabular datasets ($N=128$), deep neural networks or complex gradient boosting models risk severe overfitting, extreme sensitivity to hyperparameters, and uninterpretable predictions. Breiman's Random Forest algorithm aggregates an ensemble of decorrelated decision trees via bootstrap aggregating (bagging), providing high variance reduction, robust feature importance metrics, and resilience against multi-collinear tabular features.
        </div>
      </div>

      <div class="defense-qa">
        <div class="qa-q">2. Data Leakage Prevention in Service Duration Modeling</div>
        <div class="qa-a">
          <strong>Methodological Defense:</strong> In predictive service management, variables that only become known <em>after</em> service intake—such as <code>completion_days</code>, <code>actual_release_date</code>, or final <code>grand_total</code> adjustments—must be strictly excluded from the feature matrix during training. Shoelotskey SMS uses exactly 13 intake-available features (`Feature Set B`), ensuring zero forward-looking data leakage.
        </div>
      </div>

      <div class="defense-qa">
        <div class="qa-q">3. Advisory ML Duration (Option B UI) vs Automated Committal</div>
        <div class="qa-a">
          <strong>Operational Defense:</strong> Machine learning predictions in service craft environments carry empirical variance. Under the Option B dual-date paradigm, the system displays the ML estimated turnaround as an <em>advisory recommendation</em> alongside the authoritative business-rule commitment date. This prevents model hallucinations from creating legal or customer-relation liabilities for the shop.
        </div>
      </div>
    </div>

    <!-- CHAPTER 3 AUDIT -->
    <div class="card">
      <div class="card-title">⚙ Chapter 3: Methodology, Calculations, & SDLC Revisions</div>

      <!-- ITEM 4 -->
      <div class="replacement-card">
        <div class="card-header-flex">
          <span class="page-ref">Pages 52 & 58 &bull; Table 1 & Phase 1 Cost Computation</span>
          <span class="tag tag-danger">Critical Typo</span>
        </div>
        <div class="diff-container">
          <div class="diff-box diff-before">
            <div class="diff-label">❌ Flawed Original Computation</div>
            "Total Phase 1 Cost:<br>
            1,500 + 2,200 + 1,000 +7 20 = ₱5,420"<br><br>
            Table 1 Column Header: <code>"Quantity/Assum ption"</code>
          </div>
          <div class="diff-box diff-after">
            <div class="diff-label">✔ Corrected Computation Line</div>
            "Total Phase 1 Cost:<br>
            ₱1,500 + ₱2,200 + ₱1,000 + ₱720 = ₱5,420"<br><br>
            Table 1 Column Header: <code>"Quantity / Assumption"</code>
          </div>
        </div>
      </div>

      <!-- LIKERT SCALE VERIFICATION -->
      <h3 style="margin-top: 20px; margin-bottom: 12px; color: #93c5fd;">Statistical Calibration: 4-Point Likert Scale Interpretation</h3>
      <p style="color: var(--text-muted); font-size: 0.95rem; margin-bottom: 15px;">Both the Technology Acceptance Model (TAM) and ISO/IEC 25010:2023 evaluation instruments utilize a 4-point Likert scale to eliminate the neutral midpoint ("fence-sitting"), compelling evaluators to make a definitive assessment. Chapter 3 must present this exact range calibration:</p>

      <table>
        <thead>
          <tr>
            <th>Scale Value</th>
            <th>Weighted Mean Range</th>
            <th>TAM Verbal Interpretation</th>
            <th>ISO/IEC 25010 Verbal Interpretation</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>4</strong></td>
            <td><code>3.26 – 4.00</code></td>
            <td>Strongly Agree (SA)</td>
            <td>Highly Acceptable / Excellent</td>
          </tr>
          <tr>
            <td><strong>3</strong></td>
            <td><code>2.51 – 3.25</code></td>
            <td>Agree (A)</td>
            <td>Acceptable / Good</td>
          </tr>
          <tr>
            <td><strong>2</strong></td>
            <td><code>1.76 – 2.50</code></td>
            <td>Disagree (D)</td>
            <td>Moderately Acceptable / Fair</td>
          </tr>
          <tr>
            <td><strong>1</strong></td>
            <td><code>1.00 – 1.75</code></td>
            <td>Strongly Disagree (SD)</td>
            <td>Unacceptable / Poor</td>
          </tr>
        </tbody>
      </table>

      <!-- ML FORMULAS -->
      <h3 style="margin-top: 25px; margin-bottom: 12px; color: #93c5fd;">Machine Learning Evaluation Formulas</h3>
      <div style="background: rgba(15, 23, 42, 0.6); padding: 16px; border-radius: 8px; border: 1px solid var(--card-border); font-family: var(--font-mono); font-size: 0.9rem;">
        <div>&bull; Mean Absolute Error (MAE): MAE = (1 / n) * &sum; | y_i - y&#770;_i |</div>
        <div style="margin-top: 6px;">&bull; Root Mean Squared Error (RMSE): RMSE = &radic; [ (1 / n) * &sum; (y_i - y&#770;_i)&sup2; ]</div>
        <div style="margin-top: 6px;">&bull; Coefficient of Determination (R&sup2;): R&sup2; = 1 - [ &sum; (y_i - y&#770;_i)&sup2; / &sum; (y_i - y&#772;)&sup2; ]</div>
      </div>
    </div>

    <!-- ORAL DEFENSE Q&A PLAYBOOK -->
    <div class="card">
      <div class="card-title">🛡 Chapters 1 to 3 Defense Preparation Q&A</div>

      <div class="defense-qa">
        <div class="qa-q">Panel Question: "Why did you use the Waterfall model instead of Agile / Scrum?"</div>
        <div class="qa-a">
          <strong>Candidate Defense:</strong> "The Waterfall SDLC was selected because this capstone project had strictly defined academic milestones, fixed institutional deliverables, and a finalized scope approved by the business owner during initial requirements engineering. Waterfall provided disciplined phase-gate control, ensuring that database normalization (3NF), security architecture (OWASP), and historical data cleansing were mathematically verified and documented before proceeding to production implementation and final evaluation."
        </div>
      </div>

      <div class="defense-qa">
        <div class="qa-q">Panel Question: "In Figure 1, how does the machine learning model actually learn if it's not continuous streaming?"</div>
        <div class="qa-a">
          <strong>Candidate Defense:</strong> "In a small micro-enterprise environment, automated continuous streaming updates pose significant model drift and data contamination risks—such as accidental or outlier job intakes corrupting the decision trees. Instead, our architecture implements an <em>administrative batch retraining pipeline</em>. Validated operational records are archived upon customer claim. When sufficient new sample density is accumulated, the administrator triggers retraining via the secure dashboard endpoint, regenerating the serialized Joblib model only after passing automated validation tests."
        </div>
      </div>

      <div class="defense-qa">
        <div class="qa-q">Panel Question: "Why did you transition from ISO/IEC 25010:2011 to ISO/IEC 25010:2023?"</div>
        <div class="qa-a">
          <strong>Candidate Defense:</strong> "ISO/IEC 25010:2023 is the active international standard for software product quality, officially superseding the 2011 edition. The 2023 revision expanded the quality model from 8 to 9 characteristics by adding <em>Safety</em> (critical for system operational integrity and fail-closed security) and replacing outdated terms like Usability with <em>Interaction Capability</em> and Portability with <em>Flexibility</em>. Aligning our evaluation with the current 2023 edition demonstrates adherence to modern software engineering best practices."
        </div>
      </div>
    </div>

  </div>

</body>
</html>
"""

    out_dirs = [
        "docs/Official Documentation/Documentation Reports",
        "docs"
    ]

    for d in out_dirs:
        os.makedirs(d, exist_ok=True)
        out_path = os.path.join(d, "03_CHAPTERS_1_TO_3_AUDIT.html")
        with open(out_path, "w", encoding="utf-8") as f:
            f.write(html_content)
        print(f"Saved Checkpoint 3 report to: {out_path}")

if __name__ == "__main__":
    generate_report()
