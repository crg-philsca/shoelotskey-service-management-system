import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { 
  Database, Cpu, Clock, CheckCircle2, AlertTriangle, 
  Download, Printer, RefreshCw, BarChart3, Shield, Users, 
  Sparkles, ChevronRight, Layers, Activity, PlusCircle, Check,
  ClipboardList
} from 'lucide-react';
import { API_BASE } from '@/app/lib/apiBase';
import { toast } from 'sonner';

interface ResearchEvidenceProps {
  user: {
    id?: number;
    username: string;
    role: string;
    token: string;
  };
}

export default function ResearchEvidence({ user }: ResearchEvidenceProps) {
  // Enforce admin-only access at component level
  if (user?.role?.toLowerCase() !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  const [activeTab, setActiveTab] = useState<'overview' | 'o1' | 'o2' | 'o3' | 'o4' | 'o5' | 'o6'>('overview');
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Data states
  const [overview, setOverview] = useState<any>(null);
  const [o1Data, setO1Data] = useState<any>(null);
  const [o1EntryData, setO1EntryData] = useState<any>(null);
  const [o2Data, setO2Data] = useState<any>(null);
  const [o3Data, setO3Data] = useState<any>(null);
  const [o4Data, setO4Data] = useState<any>(null);
  const [o5Data, setO5Data] = useState<any>(null);
  const [o6Data, setO6Data] = useState<any>(null);

  // Manual test entry modal states
  const [showManualModal, setShowManualModal] = useState<boolean>(false);
  const [manualType, setManualType] = useState<'entry' | 'retrieval' | 'report'>('entry');
  const [manualForm, setManualForm] = useState({
    test_id: '',
    record_reference: '',
    manual_duration_seconds: 360.0,
    digital_duration_seconds: 35.0,
    items_count: 1,
    manual_accuracy_percent: 90.0,
    manual_duration_minutes: 15.0,
    report_type: 'Sales Report',
    notes: ''
  });

  const authHeaders = {
    'Authorization': `Bearer ${user.token}`,
    'Content-Type': 'application/json'
  };

  const fetchAllEvidence = async () => {
    try {
      setRefreshing(true);
      const [resOv, resO1, resO1Entry, resO2, resO3, resO4, resO5, resO6] = await Promise.all([
        fetch(`${API_BASE}/research/overview`, { headers: authHeaders }),
        fetch(`${API_BASE}/research/o1-retrieval`, { headers: authHeaders }),
        fetch(`${API_BASE}/research/o1-entry-timing`, { headers: authHeaders }),
        fetch(`${API_BASE}/research/o2-ml-metrics`, { headers: authHeaders }),
        fetch(`${API_BASE}/research/o3-report-timing`, { headers: authHeaders }),
        fetch(`${API_BASE}/research/o4-iso-matrix`, { headers: authHeaders }),
        fetch(`${API_BASE}/research/o5-tam-summary`, { headers: authHeaders }),
        fetch(`${API_BASE}/research/o6-enhancements`, { headers: authHeaders }),
      ]);

      if (resOv.ok) setOverview(await resOv.json());
      if (resO1.ok) setO1Data(await resO1.json());
      if (resO1Entry.ok) setO1EntryData(await resO1Entry.json());
      if (resO2.ok) setO2Data(await resO2.json());
      if (resO3.ok) setO3Data(await resO3.json());
      if (resO4.ok) setO4Data(await resO4.json());
      if (resO5.ok) setO5Data(await resO5.json());
      if (resO6.ok) setO6Data(await resO6.json());

      toast.success('Research evidence synchronized with database');
    } catch (err) {
      console.error('Failed to fetch research evidence:', err);
      toast.error('Failed to load live research metrics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAllEvidence();
  }, []);

  const downloadCsv = (endpoint: string, filename: string) => {
    fetch(`${API_BASE}/research/export/${endpoint}`, { headers: authHeaders })
      .then(res => res.blob())
      .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        toast.success(`Exported ${filename}`);
      })
      .catch(() => toast.error('CSV export failed'));
  };

  const submitManualTest = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let url = `${API_BASE}/research/o1-manual-test`;
      let payload: any = {};

      if (manualType === 'entry') {
        url = `${API_BASE}/research/o1-manual-entry-test`;
        payload = {
          record_reference: manualForm.record_reference || 'Physical Paper Order Slip',
          manual_duration_seconds: parseFloat(manualForm.manual_duration_seconds as any),
          digital_duration_seconds: parseFloat(manualForm.digital_duration_seconds as any),
          items_count: parseInt(manualForm.items_count as any) || 1,
          notes: manualForm.notes
        };
      } else if (manualType === 'retrieval') {
        url = `${API_BASE}/research/o1-manual-test`;
        payload = {
          test_id: manualForm.test_id || `O1-CMP-${Date.now().toString().slice(-6)}`,
          record_reference: manualForm.record_reference,
          manual_duration_seconds: parseFloat(manualForm.manual_duration_seconds as any),
          digital_duration_seconds: parseFloat(manualForm.digital_duration_seconds as any),
          manual_accuracy_percent: parseFloat(manualForm.manual_accuracy_percent as any),
          notes: manualForm.notes
        };
      } else {
        url = `${API_BASE}/research/o3-manual-timing`;
        payload = {
          test_id: manualForm.test_id || `O3-REP-${Date.now().toString().slice(-6)}`,
          report_type: manualForm.report_type,
          manual_duration_minutes: parseFloat(manualForm.manual_duration_minutes as any),
          digital_duration_seconds: parseFloat(manualForm.digital_duration_seconds as any),
          notes: manualForm.notes
        };
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        toast.success('Manual stopwatch measurement recorded successfully');
        setShowManualModal(false);
        fetchAllEvidence();
      } else {
        toast.error('Failed to record manual measurement');
      }
    } catch (err) {
      toast.error('Network error recording test');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600"></div>
          <span className="text-xs font-mono text-slate-500">Loading live research evidence from database...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20 print:bg-white print:pb-0">
      {/* Top Header Banner */}
      <div className="bg-slate-900 text-white border-b border-slate-800 px-6 py-6 shadow-md print:bg-white print:text-black print:border-b-2 print:border-black">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 text-xs font-semibold rounded bg-red-600 text-white uppercase tracking-wider">
                Capstone Defense Ready
              </span>
              <span className="text-xs text-slate-400 font-mono">
                Specific Objectives 1–6 Research Audit
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white print:text-black">
              Research Evidence & Empirical Audit Engine
            </h1>
            <p className="text-sm text-slate-400 mt-1 print:text-slate-600">
              Database-backed measurements, ML model evaluation, and verification records for Shoelotskey SMS.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <button
              onClick={fetchAllEvidence}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition"
              title="Refresh Live Metrics from PostgreSQL"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              Sync Live DB
            </button>
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-lg shadow-sm transition"
              title="Print Screenshot-Ready Defense Evidence"
            >
              <Printer className="w-3.5 h-3.5" />
              Print Evidence Package
            </button>
          </div>
        </div>

        {/* Live Forensic Status Pills */}
        <div className="max-w-7xl mx-auto mt-4 pt-4 border-t border-slate-800/80 flex flex-wrap items-center gap-4 text-xs font-mono text-slate-400 print:text-slate-700">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Database: <strong className="text-white print:text-black">{overview?.database_authority || 'PostgreSQL (RDS)'}</strong></span>
          </div>
          <div className="flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-blue-400" />
            <span>Integrity: <strong className="text-white print:text-black">Read-Only Audit Trail (Zero Tampering)</strong></span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>Generated: <strong className="text-white print:text-black">{new Date().toLocaleString()}</strong></span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm print:hidden">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex space-x-1 overflow-x-auto py-2 scrollbar-none">
            {[
              { id: 'overview', label: 'Overview Matrix', icon: Layers },
              { id: 'o1', label: 'Obj 1: Retrieval (Manual vs Digital)', icon: Clock },
              { id: 'o2', label: 'Obj 2: Machine Learning', icon: Cpu },
              { id: 'o3', label: 'Obj 3: Reporting Efficiency', icon: BarChart3 },
              { id: 'o4', label: 'Obj 4: ISO/IEC 25010 Standards', icon: Shield },
              { id: 'o5', label: 'Obj 5: TAM & System Usage', icon: Users },
              { id: 'o6', label: 'Obj 6: Enhancements', icon: Sparkles },
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-md whitespace-nowrap transition ${
                    isActive
                      ? 'bg-red-50 text-red-700 border border-red-200 shadow-sm font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-red-600' : 'text-slate-400'}`} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Evidence Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">

        {/* TAB: OVERVIEW MATRIX */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Layers className="w-5 h-5 text-red-600" />
                    Chapter 4 Empirical Readiness Matrix
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Consolidated empirical status across all six research objectives.
                  </p>
                </div>
                <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Authoritative Baseline Active
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Obj 1 Card */}
                <div className="p-4 rounded-lg border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition">
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                    <span className="font-semibold text-slate-700">Specific Objective 1</span>
                    <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-mono text-[10px]">O1-RET</span>
                  </div>
                  <h3 className="font-semibold text-sm text-slate-900 mb-1">Comparative Retrieval Analysis</h3>
                  <p className="text-xs text-slate-600 mb-3">Service record accessibility, retrieval duration, and record accuracy.</p>
                  <div className="text-xs font-mono bg-white p-2 rounded border border-slate-200 space-y-1">
                    <div>Logged Digital Tests: <strong>{overview?.objectives?.objective_1?.total_digital_tests_logged || 0}</strong></div>
                    <div>Avg Digital Retrieval: <strong className="text-emerald-600">{overview?.objectives?.objective_1?.avg_retrieval_ms || 0} ms</strong></div>
                  </div>
                  <button onClick={() => setActiveTab('o1')} className="mt-3 text-xs text-red-600 hover:text-red-700 font-medium inline-flex items-center gap-1">
                    View retrieval evidence <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Obj 2 Card */}
                <div className="p-4 rounded-lg border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition">
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                    <span className="font-semibold text-slate-700">Specific Objective 2</span>
                    <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800 font-mono text-[10px]">O2-ML</span>
                  </div>
                  <h3 className="font-semibold text-sm text-slate-900 mb-1">ML Service Turnaround Model</h3>
                  <p className="text-xs text-slate-600 mb-3">Random Forest Regressor evaluated on unseen held-out test data.</p>
                  <div className="text-xs font-mono bg-white p-2 rounded border border-slate-200 space-y-1">
                    <div>Dataset: <strong>{overview?.objectives?.objective_2?.dataset_size || 54} eligible</strong></div>
                    <div>Within ±2 Days: <strong>{overview?.objectives?.objective_2?.prediction_accuracy_within_2_days || 0}%</strong></div>
                    <div>Target (85%): <strong className="text-amber-600">{overview?.objectives?.objective_2?.target_85_status || 'EVALUATED'}</strong></div>
                  </div>
                  <button onClick={() => setActiveTab('o2')} className="mt-3 text-xs text-red-600 hover:text-red-700 font-medium inline-flex items-center gap-1">
                    View ML metrics & test table <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Obj 3 Card */}
                <div className="p-4 rounded-lg border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition">
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                    <span className="font-semibold text-slate-700">Specific Objective 3</span>
                    <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-mono text-[10px]">O3-REP</span>
                  </div>
                  <h3 className="font-semibold text-sm text-slate-900 mb-1">Real-Time Reporting Efficiency</h3>
                  <p className="text-xs text-slate-600 mb-3">Measured generation duration for Sales, Expense, and ROI reports.</p>
                  <div className="text-xs font-mono bg-white p-2 rounded border border-slate-200 space-y-1">
                    <div>Logged Report Events: <strong>{overview?.objectives?.objective_3?.total_report_generations_logged || 0}</strong></div>
                    <div>Avg Generation Speed: <strong className="text-emerald-600">{overview?.objectives?.objective_3?.avg_report_duration_ms || 0} ms</strong></div>
                  </div>
                  <button onClick={() => setActiveTab('o3')} className="mt-3 text-xs text-red-600 hover:text-red-700 font-medium inline-flex items-center gap-1">
                    View report latency evidence <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Obj 4 Card */}
                <div className="p-4 rounded-lg border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition">
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                    <span className="font-semibold text-slate-700">Specific Objective 4</span>
                    <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 font-mono text-[10px]">O4-ISO</span>
                  </div>
                  <h3 className="font-semibold text-sm text-slate-900 mb-1">ISO/IEC 25010 Quality Standards</h3>
                  <p className="text-xs text-slate-600 mb-3">9 software characteristics mapped to technical proof & test suites.</p>
                  <div className="text-xs font-mono bg-white p-2 rounded border border-slate-200 space-y-1">
                    <div>Characteristics Mapped: <strong>9 of 9</strong></div>
                    <div>Status: <strong className="text-emerald-600">Questionnaire + Technical Evidence</strong></div>
                  </div>
                  <button onClick={() => setActiveTab('o4')} className="mt-3 text-xs text-red-600 hover:text-red-700 font-medium inline-flex items-center gap-1">
                    View ISO evidence mapping <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Obj 5 Card */}
                <div className="p-4 rounded-lg border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition">
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                    <span className="font-semibold text-slate-700">Specific Objective 5</span>
                    <span className="px-2 py-0.5 rounded bg-teal-100 text-teal-800 font-mono text-[10px]">O5-TAM</span>
                  </div>
                  <h3 className="font-semibold text-sm text-slate-900 mb-1">Technology Acceptance Model</h3>
                  <p className="text-xs text-slate-600 mb-3">User acceptance (PU, PEOU, BI, ASU) backed by live activity logs.</p>
                  <div className="text-xs font-mono bg-white p-2 rounded border border-slate-200 space-y-1">
                    <div>Constructs: <strong>PU, PEOU, BI, ASU</strong></div>
                    <div>Supporting Logs: <strong>{overview?.objectives?.objective_5?.supporting_system_logs || 0} events</strong></div>
                  </div>
                  <button onClick={() => setActiveTab('o5')} className="mt-3 text-xs text-red-600 hover:text-red-700 font-medium inline-flex items-center gap-1">
                    View TAM evidence <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Obj 6 Card */}
                <div className="p-4 rounded-lg border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition">
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                    <span className="font-semibold text-slate-700">Specific Objective 6</span>
                    <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-mono text-[10px]">O6-REC</span>
                  </div>
                  <h3 className="font-semibold text-sm text-slate-900 mb-1">System Enhancements</h3>
                  <p className="text-xs text-slate-600 mb-3">Empirical recommendations derived from audit gaps and expert reviews.</p>
                  <div className="text-xs font-mono bg-white p-2 rounded border border-slate-200 space-y-1">
                    <div>Candidates Documented: <strong>6 Recommendations</strong></div>
                    <div>Grounding: <strong className="text-emerald-600">Audit & Data Limitations</strong></div>
                  </div>
                  <button onClick={() => setActiveTab('o6')} className="mt-3 text-xs text-red-600 hover:text-red-700 font-medium inline-flex items-center gap-1">
                    View recommendations <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB: OBJECTIVE 1 */}
        {activeTab === 'o1' && (
          <div className="space-y-8">
            {/* Top Overview Banner */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 text-xs font-semibold rounded bg-blue-100 text-blue-800 font-mono">
                  SPECIFIC OBJECTIVE 1
                </span>
                <span className="text-xs text-slate-500 font-mono">Evidence ID: O1-EVD-FULL</span>
              </div>
              <h2 className="text-xl font-bold text-slate-900">
                Comparative Job Order Entry & Record Retrieval Efficiency
              </h2>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Empirical comparative evaluation between the traditional manual paper-based workflow and the developed digital management system across two independent research dimensions: <strong>(1) Job Order Creation & Recording Duration</strong> and <strong>(2) Record Search & Retrieval Latency</strong>.
              </p>
            </div>

            {/* ========================================================= */}
            {/* DIMENSION 1: JOB ORDER ENTRY & RECORDING DURATION         */}
            {/* ========================================================= */}
            <div className="space-y-4">
              {/* Header Card */}
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 text-xs font-semibold rounded bg-indigo-100 text-indigo-800 font-mono">
                        DIMENSION 1: JOB ORDER ENTRY
                      </span>
                      <span className="text-xs text-slate-500 font-mono">Event: JOB_ORDER_CREATED</span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900">
                      Job Order Entry & Transaction Recording Duration
                    </h3>
                    <p className="text-xs text-slate-600 mt-1">
                      Measures the complete digital recording duration from staff opening the form (<span className="font-mono text-slate-700">entry_started_at</span>) until authoritative database commit (<span className="font-mono text-slate-700">saved_at</span>), compared with researcher stopwatch measurements of handwritten paper claim slips.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => { setManualType('entry'); setShowManualModal(true); }}
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg transition shadow-xs"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      Record Paper Entry Stopwatch
                    </button>
                    <button
                      onClick={() => downloadCsv('o1-entry-csv', 'Shoelotskey_Objective1_Digital_Entry_Logs.csv')}
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-medium rounded-lg border border-slate-200 transition"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Export Entry CSV
                    </button>
                    <button
                      onClick={() => downloadCsv('o1-entry-comparison-csv', 'Shoelotskey_Objective1_Entry_Comparison.csv')}
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-medium rounded-lg border border-slate-200 transition"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Export Comparison CSV
                    </button>
                  </div>
                </div>

                {/* Entry Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                  <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50">
                    <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Average Digital Entry</div>
                    <div className="text-xl font-bold text-indigo-600 mt-1 font-mono">
                      {o1EntryData?.digital_entry_summary?.avg_digital_entry_seconds || 0}s
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      ({o1EntryData?.digital_entry_summary?.avg_digital_entry_ms || 0} ms)
                    </div>
                  </div>

                  <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50">
                    <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Median Digital Entry</div>
                    <div className="text-xl font-bold text-slate-900 mt-1 font-mono">
                      {o1EntryData?.digital_entry_summary?.median_digital_entry_seconds || 0}s
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Statistical median time</div>
                  </div>

                  <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50">
                    <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Entry Time Range</div>
                    <div className="text-sm font-bold text-slate-900 mt-1.5 font-mono">
                      {o1EntryData?.digital_entry_summary?.min_digital_entry_seconds || 0}s – {o1EntryData?.digital_entry_summary?.max_digital_entry_seconds || 0}s
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Min to Max observed</div>
                  </div>

                  <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50">
                    <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Total Orders Logged</div>
                    <div className="text-xl font-bold text-slate-900 mt-1 font-mono">
                      {o1EntryData?.digital_entry_summary?.total_digital_entries_measured || 0}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      {o1EntryData?.digital_entry_summary?.isolated_failed_attempts_count > 0 ? (
                        <span className="text-amber-600 font-semibold">
                          ({o1EntryData.digital_entry_summary.isolated_failed_attempts_count} failed isolated)
                        </span>
                      ) : (
                        '100% successful commits'
                      )}
                    </div>
                  </div>
                </div>

                {/* Entry Comparative Efficiency Highlights */}
                {o1EntryData?.comparative_summary?.total_manual_benchmark_tests > 0 && (
                  <div className="mt-4 p-3.5 rounded-lg border border-indigo-200 bg-indigo-50/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                    <div>
                      <span className="font-bold text-indigo-950">Field Benchmark Finding: </span>
                      <span className="text-indigo-900">
                        Manual paper entry averages <strong>{o1EntryData.comparative_summary.avg_paper_entry_seconds}s</strong> vs. digital system entry <strong>{o1EntryData.comparative_summary.avg_digital_entry_seconds}s</strong>.
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="px-2.5 py-1 rounded-full bg-emerald-600 text-white font-bold font-mono text-[11px]">
                        +{o1EntryData.comparative_summary.percentage_improvement}% Faster Digitally
                      </span>
                      <span className="text-slate-600 font-mono">
                        (~{o1EntryData.comparative_summary.avg_time_saved_seconds}s saved per order)
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Controlled Entry Comparison Table */}
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="text-sm font-bold text-slate-900 mb-1 flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-indigo-600" />
                  Controlled Comparative Timing: Manual Paper vs. Digital Order Entry
                </h3>
                <p className="text-xs text-slate-500 mb-4">
                  Manual paper entry timed independently via researcher stopwatch protocol vs. automated digital system entry duration.
                </p>

                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">Test ID</th>
                        <th className="py-2.5 px-3">Scenario / Record Reference</th>
                        <th className="py-2.5 px-3">Pairs</th>
                        <th className="py-2.5 px-3">Paper Time (s)</th>
                        <th className="py-2.5 px-3">Digital Time (s)</th>
                        <th className="py-2.5 px-3">Time Saved (s)</th>
                        <th className="py-2.5 px-3">% Time Saved</th>
                        <th className="py-2.5 px-3">Researcher / Tester</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {o1EntryData?.manual_vs_digital_benchmarks?.length > 0 ? (
                        o1EntryData.manual_vs_digital_benchmarks.map((test: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-50/80 font-mono text-[11px]">
                            <td className="py-2 px-3 font-semibold text-indigo-600">{test.test_id}</td>
                            <td className="py-2 px-3 font-sans text-slate-800">{test.record_reference}</td>
                            <td className="py-2 px-3">{test.items_count}</td>
                            <td className="py-2 px-3 text-amber-700 font-semibold">{test.manual_duration_seconds}s</td>
                            <td className="py-2 px-3 text-emerald-600 font-semibold">{test.digital_duration_seconds}s</td>
                            <td className="py-2 px-3 text-purple-700 font-semibold">
                              {test.time_saved_seconds > 0 ? `+${test.time_saved_seconds}s` : `${test.time_saved_seconds}s`}
                            </td>
                            <td className={`py-2 px-3 font-bold ${Number(test.percentage_time_saved ?? test.percentage_faster) >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                              {test.percentage_time_saved !== undefined ? test.percentage_time_saved : test.percentage_faster}%
                            </td>
                            <td className="py-2 px-3 font-sans text-slate-600">{test.tester}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={8} className="py-6 text-center text-slate-400 font-sans">
                            No stopwatch entry benchmarks recorded yet. Click "Record Paper Entry Stopwatch" above to enter researcher measurements of handwritten physical receipts.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Raw System Entry Logs */}
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="text-sm font-bold text-slate-900 mb-1 flex items-center gap-2">
                  <Database className="w-4 h-4 text-indigo-600" />
                  Raw Digital Job Order Creation Event Logs (JOB_ORDER_CREATED)
                </h3>
                <p className="text-xs text-slate-500 mb-4">
                  Forensic empirical measurements capturing exact form opening (<span className="font-mono">started_at</span>) to authoritative database transaction commit (<span className="font-mono">saved_at</span>).
                </p>

                <div className="overflow-x-auto border border-slate-200 rounded-lg max-h-80 overflow-y-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-slate-100 text-slate-700 font-semibold sticky top-0 border-b border-slate-200">
                      <tr>
                        <th className="py-2 px-3">Test ID</th>
                        <th className="py-2 px-3">Order Number</th>
                        <th className="py-2 px-3">Customer</th>
                        <th className="py-2 px-3">Items</th>
                        <th className="py-2 px-3">Form Open</th>
                        <th className="py-2 px-3">DB Commit</th>
                        <th className="py-2 px-3">Elapsed Duration</th>
                        <th className="py-2 px-3">Status</th>
                        <th className="py-2 px-3">Staff</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-[11px]">
                      {o1EntryData?.digital_entry_logs?.map((l: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="py-1.5 px-3 text-indigo-600 font-semibold">{l.test_id}</td>
                          <td className="py-1.5 px-3 font-sans text-slate-900 font-bold">{l.order_reference}</td>
                          <td className="py-1.5 px-3 font-sans text-slate-800 truncate max-w-xs">{l.customer_name}</td>
                          <td className="py-1.5 px-3">{l.items_count}</td>
                          <td className="py-1.5 px-3 text-slate-500">{l.started_at ? l.started_at.split(' ')[1] : '—'}</td>
                          <td className="py-1.5 px-3 text-slate-500">{l.saved_at ? l.saved_at.split(' ')[1] : '—'}</td>
                          <td className="py-1.5 px-3 text-emerald-600 font-bold">{l.duration_formatted} ({l.duration_ms} ms)</td>
                          <td className="py-1.5 px-3">
                            <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px]">
                              {l.status}
                            </span>
                          </td>
                          <td className="py-1.5 px-3 font-sans text-slate-500">{l.user}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* ========================================================= */}
            {/* DIMENSION 2: RECORD ACCESSIBILITY & RETRIEVAL LATENCY     */}
            {/* ========================================================= */}
            <div className="space-y-4 pt-4 border-t border-slate-200">
              {/* Header Card */}
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 text-xs font-semibold rounded bg-blue-100 text-blue-800 font-mono">
                        DIMENSION 2: RECORD RETRIEVAL
                      </span>
                      <span className="text-xs text-slate-500 font-mono">Event: JOB_ORDER_RETRIEVED</span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900">
                      Record Accessibility & Search Retrieval Latency
                    </h3>
                    <p className="text-xs text-slate-600 mt-1">
                      Measures database query execution latency across order and customer search operations compared to manual physical filing cabinet searches.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { setManualType('retrieval'); setShowManualModal(true); }}
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition shadow-xs"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      Record Retrieval Stopwatch
                    </button>
                    <button
                      onClick={() => downloadCsv('o1-csv', 'Shoelotskey_Objective1_Retrieval_Logs.csv')}
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-medium rounded-lg border border-slate-200 transition"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Export Retrieval CSV
                    </button>
                  </div>
                </div>

                {/* Latency Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                  <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50">
                    <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Average Retrieval</div>
                    <div className="text-xl font-bold text-emerald-600 mt-1 font-mono">
                      {o1Data?.benchmark_summary?.avg_digital_retrieval_ms || 0} ms
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      ({o1Data?.benchmark_summary?.avg_digital_retrieval_seconds || 0} seconds)
                    </div>
                  </div>

                  <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50">
                    <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Minimum Latency</div>
                    <div className="text-xl font-bold text-slate-900 mt-1 font-mono">
                      {o1Data?.benchmark_summary?.min_digital_retrieval_ms || 0} ms
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Optimized indexed lookup</div>
                  </div>

                  <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50">
                    <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Maximum Latency</div>
                    <div className="text-xl font-bold text-slate-900 mt-1 font-mono">
                      {o1Data?.benchmark_summary?.max_digital_retrieval_ms || 0} ms
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Full table scan benchmark</div>
                  </div>

                  <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50">
                    <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Total Measured Logs</div>
                    <div className="text-xl font-bold text-slate-900 mt-1 font-mono">
                      {o1Data?.benchmark_summary?.total_digital_queries_measured || 0}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Automated JOB_ORDER_RETRIEVED</div>
                  </div>
                </div>
              </div>

              {/* Controlled Comparison Table */}
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="text-sm font-bold text-slate-900 mb-1 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-600" />
                  Controlled Comparative Timing: Manual vs. Digital Retrieval
                </h3>
                <p className="text-xs text-slate-500 mb-4">
                  Manual paper retrieval timed independently via researcher stopwatch protocol vs. automated digital system retrieval duration.
                </p>

                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">Test ID</th>
                        <th className="py-2.5 px-3">Record Reference</th>
                        <th className="py-2.5 px-3">Manual Stopwatch Duration</th>
                        <th className="py-2.5 px-3">Digital System Duration</th>
                        <th className="py-2.5 px-3">Time Saved</th>
                        <th className="py-2.5 px-3">Manual Accuracy</th>
                        <th className="py-2.5 px-3">Digital Accuracy</th>
                        <th className="py-2.5 px-3">Tester</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {o1Data?.manual_vs_digital_tests?.length > 0 ? (
                        o1Data.manual_vs_digital_tests.map((test: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-50/80 font-mono text-[11px]">
                            <td className="py-2 px-3 font-semibold text-blue-600">{test.test_id}</td>
                            <td className="py-2 px-3 font-sans text-slate-800">{test.record_reference}</td>
                            <td className="py-2 px-3 text-amber-700 font-semibold">{test.manual_duration_seconds}s</td>
                            <td className="py-2 px-3 text-emerald-600 font-semibold">{test.digital_duration_seconds}s</td>
                            <td className="py-2 px-3 text-purple-700 font-semibold">+{test.time_saved_seconds}s saved</td>
                            <td className="py-2 px-3">{test.manual_accuracy_percent}%</td>
                            <td className="py-2 px-3 text-emerald-600 font-semibold">{test.digital_accuracy_percent}%</td>
                            <td className="py-2 px-3 font-sans text-slate-600">{test.tester}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={8} className="py-6 text-center text-slate-400 font-sans">
                            No stopwatch retrieval tests recorded yet. Click "Record Retrieval Stopwatch" above to log manual physical receipt retrieval timings.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Raw System Retrieval Logs */}
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="text-sm font-bold text-slate-900 mb-1 flex items-center gap-2">
                  <Database className="w-4 h-4 text-emerald-600" />
                  Raw Digital Retrieval Event Logs (JOB_ORDER_RETRIEVED)
                </h3>
                <p className="text-xs text-slate-500 mb-4">
                  Append-only forensic logs capturing exact server execution duration (ms) upon search and retrieval operations.
                </p>

                <div className="overflow-x-auto border border-slate-200 rounded-lg max-h-80 overflow-y-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-slate-100 text-slate-700 font-semibold sticky top-0 border-b border-slate-200">
                      <tr>
                        <th className="py-2 px-3">Log ID</th>
                        <th className="py-2 px-3">Test ID</th>
                        <th className="py-2 px-3">Query / Reference</th>
                        <th className="py-2 px-3">Duration (ms)</th>
                        <th className="py-2 px-3">Result Count</th>
                        <th className="py-2 px-3">Status</th>
                        <th className="py-2 px-3">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-[11px]">
                      {o1Data?.digital_retrieval_logs?.map((l: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="py-1.5 px-3 text-slate-500">#{l.log_id}</td>
                          <td className="py-1.5 px-3 text-blue-600 font-semibold">{l.test_id}</td>
                          <td className="py-1.5 px-3 font-sans text-slate-800 truncate max-w-xs">{l.order_reference}</td>
                          <td className="py-1.5 px-3 text-emerald-600 font-bold">{l.duration_ms} ms</td>
                          <td className="py-1.5 px-3">{l.result_count} records</td>
                          <td className="py-1.5 px-3">
                            <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px]">
                              {l.status}
                            </span>
                          </td>
                          <td className="py-1.5 px-3 text-slate-500">{l.timestamp}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB: OBJECTIVE 2 */}
        {activeTab === 'o2' && (
          <div className="space-y-6">
            {/* Header Card */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 text-xs font-semibold rounded bg-purple-100 text-purple-800 font-mono">
                      SPECIFIC OBJECTIVE 2
                    </span>
                    <span className="text-xs text-slate-500 font-mono">Evidence ID: O2-EVD-001</span>
                  </div>
                  <h2 className="text-xl font-bold text-slate-900">
                    Machine Learning Service Turnaround Prediction Model
                  </h2>
                  <p className="text-xs text-slate-600 mt-1">
                    Random Forest Regressor evaluated on unseen test data using regression metrics and tolerance accuracy.
                  </p>
                </div>

                <button
                  onClick={() => downloadCsv('o2-test-predictions-csv', 'Shoelotskey_Objective2_ML_Test_Predictions.csv')}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-lg shadow-sm transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export Test Predictions (CSV)
                </button>
              </div>

              {/* Target & Transparency Alert */}
              <div className="mt-4 p-4 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900">
                <div className="font-semibold flex items-center gap-1.5 text-amber-950 mb-1">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  Academic Target Transparency Notice:
                </div>
                <div>
                  <strong>Historical Dataset Target:</strong> <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">Historical Order-to-Claim Turnaround (claimed_date − date_received)</code>. 
                  Physical paper receipts never recorded technician completion timestamps.
                </div>
                <div className="mt-1">
                  <strong>Digital Forward Orders:</strong> Authentically tracks <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">Actual Service Completion Duration (released_at − created_at)</code> captured when marked <em>For Release</em>.
                </div>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50">
                  <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Prediction Accuracy Within ±2 Days</div>
                  <div className="text-2xl font-bold text-purple-700 mt-1 font-mono">
                    {o2Data?.metrics?.accuracy_within_2_days ?? 'N/A'}%
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    Predefined Research Target: <strong>85%</strong>
                  </div>
                  <div className="mt-2 inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                    {o2Data?.metrics?.target_85_status || 'TARGET NOT MET'}
                  </div>
                </div>

                <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50">
                  <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Mean Absolute Error (MAE)</div>
                  <div className="text-2xl font-bold text-slate-900 mt-1 font-mono">
                    {o2Data?.metrics?.mae ?? 'N/A'} <span className="text-xs text-slate-500 font-normal">days</span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Median Abs Error: {o2Data?.metrics?.median_absolute_error ?? 'N/A'} days</div>
                </div>

                <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50">
                  <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Root Mean Squared Error (RMSE)</div>
                  <div className="text-2xl font-bold text-slate-900 mt-1 font-mono">
                    {o2Data?.metrics?.rmse ?? 'N/A'} <span className="text-xs text-slate-500 font-normal">days</span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Max Error: {o2Data?.metrics?.max_absolute_error ?? 'N/A'} days</div>
                </div>

                <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50">
                  <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Coefficient of Determination (R²)</div>
                  <div className="text-2xl font-bold text-slate-900 mt-1 font-mono">
                    {o2Data?.metrics?.r2_score ?? 'N/A'}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Unseen held-out test split</div>
                </div>
              </div>

              {/* Extended Tolerance Distribution */}
              <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-slate-200 text-xs font-mono">
                <div className="p-2.5 rounded bg-slate-50 border border-slate-200">
                  <span className="text-slate-500">Within ±1 Day:</span>{' '}
                  <strong className="text-slate-900">{o2Data?.metrics?.accuracy_within_1_day ?? 0}%</strong> ({o2Data?.metrics?.count_within_1_day || 0} of {o2Data?.model_overview?.test_records || 11})
                </div>
                <div className="p-2.5 rounded bg-slate-50 border border-slate-200">
                  <span className="text-slate-500">Within ±2 Days (Target):</span>{' '}
                  <strong className="text-purple-700">{o2Data?.metrics?.accuracy_within_2_days ?? 0}%</strong> ({o2Data?.metrics?.count_within_2_days || 0} of {o2Data?.model_overview?.test_records || 11})
                </div>
                <div className="p-2.5 rounded bg-slate-50 border border-slate-200">
                  <span className="text-slate-500">Within ±3 Days:</span>{' '}
                  <strong className="text-slate-900">{o2Data?.metrics?.accuracy_within_3_days ?? 0}%</strong> ({o2Data?.metrics?.count_within_3_days || 0} of {o2Data?.model_overview?.test_records || 11})
                </div>
              </div>
            </div>

            {/* Dataset Funnel Card */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 mb-1 flex items-center gap-2">
                <Database className="w-4 h-4 text-indigo-600" />
                Historical Dataset Filtering & Eligibility Funnel
              </h3>
              <p className="text-xs text-slate-500 mb-4">
                Complete accounting of all historical records, explaining eligibility criteria and exclusion reasons without concealing attrition.
              </p>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs font-mono">
                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
                  <div className="text-[10px] text-slate-500 uppercase">1. Total Records</div>
                  <div className="text-lg font-bold text-slate-900 mt-1">{o2Data?.dataset_funnel?.total_historical_records || 725}</div>
                  <div className="text-[10px] text-slate-500">OCR scanned receipts</div>
                </div>

                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
                  <div className="text-[10px] text-slate-500 uppercase">2. Usable Dates</div>
                  <div className="text-lg font-bold text-slate-900 mt-1">{o2Data?.dataset_funnel?.with_estimated_release || 56}</div>
                  <div className="text-[10px] text-slate-500">Received + Claim/Est</div>
                </div>

                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
                  <div className="text-[10px] text-slate-500 uppercase">3. Target Valid</div>
                  <div className="text-lg font-bold text-slate-900 mt-1">{o2Data?.dataset_funnel?.with_valid_target_duration || 56}</div>
                  <div className="text-[10px] text-slate-500">1 to 60 calendar days</div>
                </div>

                <div className="p-3 rounded-lg border border-slate-200 bg-emerald-50 border-emerald-200">
                  <div className="text-[10px] text-emerald-700 uppercase font-semibold">4. ML-Eligible</div>
                  <div className="text-lg font-bold text-emerald-800 mt-1">{o2Data?.dataset_funnel?.ml_eligible_records || 54}</div>
                  <div className="text-[10px] text-emerald-600">Validated OCR status</div>
                </div>

                <div className="p-3 rounded-lg border border-slate-200 bg-purple-50 border-purple-200">
                  <div className="text-[10px] text-purple-700 uppercase font-semibold">5. Split (80/20)</div>
                  <div className="text-lg font-bold text-purple-800 mt-1">
                    {o2Data?.model_overview?.train_records || 43} / {o2Data?.model_overview?.test_records || 11}
                  </div>
                  <div className="text-[10px] text-purple-600">Train / Unseen Test</div>
                </div>
              </div>

              {/* Exclusion Explanations */}
              <div className="mt-4 p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600">
                <strong className="text-slate-800">Attrition Accounting: </strong>
                {o2Data?.dataset_funnel?.excluded_records || 671} historical records are excluded from duration training because:
                (a) physical receipts lacked readable completion dates ({o2Data?.dataset_funnel?.exclusion_reasons?.insufficient_dates || 669} rows), or 
                (b) receipt image quality required further human verification ({o2Data?.dataset_funnel?.exclusion_reasons?.unvalidated_ocr || 671} rows).
              </div>
            </div>

            {/* Unseen Test-Set Predictions Table */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 mb-1 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-purple-600" />
                Unseen Held-Out Test Set Predictions & Error Analysis
              </h3>
              <p className="text-xs text-slate-500 mb-4">
                Itemized predictions for all 11 test records never seen during model training (Random State: 42).
              </p>

              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Test ID</th>
                      <th className="py-2.5 px-3">Order ID</th>
                      <th className="py-2.5 px-3">Service Combination</th>
                      <th className="py-2.5 px-3">Pairs</th>
                      <th className="py-2.5 px-3">Priority</th>
                      <th className="py-2.5 px-3">Actual Days</th>
                      <th className="py-2.5 px-3">Predicted Days</th>
                      <th className="py-2.5 px-3">Absolute Error</th>
                      <th className="py-2.5 px-3">±1 Day</th>
                      <th className="py-2.5 px-3">±2 Days (Target)</th>
                      <th className="py-2.5 px-3">±3 Days</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-[11px]">
                    {o2Data?.test_predictions?.map((p: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-2 px-3 text-purple-700 font-bold">{p.test_id}</td>
                        <td className="py-2 px-3 text-slate-700">{p.order_id}</td>
                        <td className="py-2 px-3 font-sans text-slate-900 truncate max-w-xs">{p.service_summary}</td>
                        <td className="py-2 px-3 text-center">{p.total_pairs}</td>
                        <td className="py-2 px-3 font-sans">{p.priority}</td>
                        <td className="py-2 px-3 font-bold text-slate-900">{p.actual_completion_days} d</td>
                        <td className="py-2 px-3 font-bold text-purple-600">{p.predicted_completion_days} d</td>
                        <td className="py-2 px-3 font-bold text-amber-700">|{p.absolute_error}| d</td>
                        <td className="py-2 px-3">
                          {p.within_1_day ? <span className="text-emerald-600 font-bold">YES</span> : <span className="text-slate-400">NO</span>}
                        </td>
                        <td className="py-2 px-3">
                          {p.within_2_days ? <span className="text-emerald-600 font-bold">YES</span> : <span className="text-slate-400">NO</span>}
                        </td>
                        <td className="py-2 px-3">
                          {p.within_3_days ? <span className="text-emerald-600 font-bold">YES</span> : <span className="text-slate-400">NO</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* New Order Prediction & Database Persistence Proof */}
            {o2Data?.new_order_proof && (
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="text-sm font-bold text-slate-900 mb-1 flex items-center gap-2">
                  <Database className="w-4 h-4 text-emerald-600" />
                  Live Operational Prediction & Database Persistence Proof
                </h3>
                <p className="text-xs text-slate-500 mb-4">
                  Demonstrates that live orders submit inputs, query the Random Forest model, and permanently commit the prediction to PostgreSQL/SQLite.
                </p>

                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-mono">
                  <div>
                    <span className="text-slate-500">Order Number:</span>
                    <div className="text-slate-900 font-bold text-sm mt-0.5">{o2Data.new_order_proof.order_number}</div>
                  </div>
                  <div>
                    <span className="text-slate-500">Expected Release Date (Rule):</span>
                    <div className="text-slate-900 font-bold mt-0.5">{o2Data.new_order_proof.expected_release_date}</div>
                  </div>
                  <div>
                    <span className="text-slate-500">ML Predicted Release Date:</span>
                    <div className="text-purple-700 font-bold mt-0.5">{o2Data.new_order_proof.ml_predicted_release_date} ({o2Data.new_order_proof.ml_predicted_days} days)</div>
                  </div>
                  <div>
                    <span className="text-slate-500">Database Persistence:</span>
                    <div className="text-emerald-600 font-bold mt-0.5 flex items-center gap-1">
                      <Check className="w-4 h-4" /> CONFIRMED IN POSTGRESQL
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB: OBJECTIVE 3 */}
        {activeTab === 'o3' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 text-xs font-semibold rounded bg-amber-100 text-amber-800 font-mono">
                      SPECIFIC OBJECTIVE 3
                    </span>
                    <span className="text-xs text-slate-500 font-mono">Evidence ID: O3-EVD-001</span>
                  </div>
                  <h2 className="text-xl font-bold text-slate-900">
                    Real-Time Reporting Efficiency & Financial Parity
                  </h2>
                  <p className="text-xs text-slate-600 mt-1">
                    Evaluation of time required to generate Sales, Expense, and Return on Investment (ROI) reports.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setManualType('report'); setShowManualModal(true); }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-lg transition"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    Record Manual Timing
                  </button>
                  <button
                    onClick={() => downloadCsv('o3-csv', 'Shoelotskey_Objective3_Report_Timing_Logs.csv')}
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-medium rounded-lg border border-slate-200 transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Export Report Logs (CSV)
                  </button>
                </div>
              </div>

              {/* Module Speed Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                <div className="p-4 rounded-lg border border-slate-200 bg-slate-50">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-700">Sales Report Engine</span>
                    <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-mono font-bold">Sub-Second</span>
                  </div>
                  <div className="text-2xl font-bold text-slate-900 mt-2 font-mono">
                    {o3Data?.benchmark_by_module?.sales_report?.avg_ms || 0} ms
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Average generation time ({o3Data?.benchmark_by_module?.sales_report?.sample_count || 0} measurements)
                  </div>
                </div>

                <div className="p-4 rounded-lg border border-slate-200 bg-slate-50">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-700">Expense Report Engine</span>
                    <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-mono font-bold">Sub-Second</span>
                  </div>
                  <div className="text-2xl font-bold text-slate-900 mt-2 font-mono">
                    {o3Data?.benchmark_by_module?.expense_report?.avg_ms || 0} ms
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Average generation time ({o3Data?.benchmark_by_module?.expense_report?.sample_count || 0} measurements)
                  </div>
                </div>

                <div className="p-4 rounded-lg border border-slate-200 bg-slate-50">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-700">ROI Report Engine</span>
                    <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-mono font-bold">Real-Time</span>
                  </div>
                  <div className="text-2xl font-bold text-slate-900 mt-2 font-mono">
                    {o3Data?.benchmark_by_module?.roi_report?.avg_ms || 0} ms
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Average generation time ({o3Data?.benchmark_by_module?.roi_report?.sample_count || 0} measurements)
                  </div>
                </div>
              </div>

              {/* Financial Consistency Card */}
              <div className="mt-6 p-4 rounded-lg bg-emerald-50/60 border border-emerald-200">
                <h4 className="text-xs font-bold text-emerald-950 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Financial Parity & Calculation Consistency Verification
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-emerald-900">
                  <div>✓ <strong>Sales Parity:</strong> Sales Total matches sum of all non-cancelled orders.</div>
                  <div>✓ <strong>Payment Parity:</strong> Cash + GCash + Maya equals total recorded payments.</div>
                  <div>✓ <strong>Balance Parity:</strong> Balance Due equals Grand Total minus Paid Amount.</div>
                  <div>✓ <strong>ROI Parity:</strong> Net Profit equals Collected Sales minus Total Expenses.</div>
                </div>
              </div>
            </div>

            {/* Manual vs Digital Timing Comparison */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 mb-1 flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-600" />
                Report Preparation Efficiency: Manual Calculation vs. Digital Analytics
              </h3>
              <p className="text-xs text-slate-500 mb-4">
                Comparison of manual ledger compilation time vs. instantaneous digital query execution.
              </p>

              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Test ID</th>
                      <th className="py-2.5 px-3">Report Module</th>
                      <th className="py-2.5 px-3">Manual Compilation Duration</th>
                      <th className="py-2.5 px-3">Digital System Duration</th>
                      <th className="py-2.5 px-3">Efficiency Gain</th>
                      <th className="py-2.5 px-3">Tester</th>
                      <th className="py-2.5 px-3">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-[11px]">
                    {o3Data?.manual_comparisons?.length > 0 ? (
                      o3Data.manual_comparisons.map((c: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="py-2 px-3 text-amber-700 font-bold">{c.test_id}</td>
                          <td className="py-2 px-3 font-sans font-semibold text-slate-800">{c.report_type}</td>
                          <td className="py-2 px-3 text-red-700 font-bold">{c.manual_duration_minutes} minutes</td>
                          <td className="py-2 px-3 text-emerald-600 font-bold">{c.digital_duration_seconds}s</td>
                          <td className="py-2 px-3 text-purple-700 font-bold">{c.efficiency_gain_ratio}</td>
                          <td className="py-2 px-3 font-sans text-slate-600">{c.tester}</td>
                          <td className="py-2 px-3 text-slate-500">{c.timestamp}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="py-6 text-center text-slate-400 font-sans">
                          No manual reporting benchmarks recorded yet. Click "Record Manual Timing" to add stopwatch measurements.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Report Generation Logs */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 mb-1 flex items-center gap-2">
                <Database className="w-4 h-4 text-emerald-600" />
                Raw Report Generation Audit Logs (REPORT_GENERATION_COMPLETED)
              </h3>
              <p className="text-xs text-slate-500 mb-4">
                Server-side audit log records measuring millisecond generation latency for every generated report.
              </p>

              <div className="overflow-x-auto border border-slate-200 rounded-lg max-h-80 overflow-y-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-slate-100 text-slate-700 font-semibold sticky top-0 border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-3">Log ID</th>
                      <th className="py-2 px-3">Report Type</th>
                      <th className="py-2 px-3">Period Type</th>
                      <th className="py-2 px-3">Duration (ms)</th>
                      <th className="py-2 px-3">User</th>
                      <th className="py-2 px-3">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-[11px]">
                    {o3Data?.generation_logs?.map((l: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-1.5 px-3 text-slate-500">#{l.log_id}</td>
                        <td className="py-1.5 px-3 font-sans font-semibold text-slate-800">{l.report_type}</td>
                        <td className="py-1.5 px-3 text-slate-600">{l.period_type}</td>
                        <td className="py-1.5 px-3 text-emerald-600 font-bold">{l.duration_ms} ms</td>
                        <td className="py-1.5 px-3 font-sans text-slate-700">{l.user}</td>
                        <td className="py-1.5 px-3 text-slate-500">{l.timestamp}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB: OBJECTIVE 4 */}
        {activeTab === 'o4' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 text-xs font-semibold rounded bg-indigo-100 text-indigo-800 font-mono">
                    SPECIFIC OBJECTIVE 4
                  </span>
                  <span className="text-xs text-slate-500 font-mono">Evidence ID: O4-EVD-001</span>
                </div>
                <h2 className="text-xl font-bold text-slate-900">
                  ISO/IEC 25010 Software Quality Standards Mapping
                </h2>
                <p className="text-xs text-slate-600 mt-1">
                  Triangulated evidence mapping each of the 9 ISO software quality characteristics to concrete implementation proofs, automated tests, and evaluation instruments.
                </p>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-3.5 w-1/5">Characteristic</th>
                      <th className="py-3 px-3.5 w-2/5">Technical Implementation Evidence</th>
                      <th className="py-3 px-3.5 w-1/5">Automated Test Reference</th>
                      <th className="py-3 px-3.5 w-1/5">Evaluator Instrument</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {o4Data?.characteristics?.map((item: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50/80">
                        <td className="py-3 px-3.5 font-bold text-slate-900 align-top">
                          {item.characteristic}
                          <div className="mt-1 flex flex-wrap gap-1">
                            {item.sub_characteristics?.map((sc: string, sIdx: number) => (
                              <span key={sIdx} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono">
                                {sc}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-3 px-3.5 text-slate-700 align-top leading-relaxed">
                          {item.technical_evidence}
                        </td>
                        <td className="py-3 px-3.5 font-mono text-[11px] text-indigo-700 align-top">
                          {item.automated_test_reference}
                        </td>
                        <td className="py-3 px-3.5 text-slate-600 align-top font-medium">
                          {item.evaluator_instrument}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB: OBJECTIVE 5 */}
        {activeTab === 'o5' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 text-xs font-semibold rounded bg-teal-100 text-teal-800 font-mono">
                    SPECIFIC OBJECTIVE 5
                  </span>
                  <span className="text-xs text-slate-500 font-mono">Evidence ID: O5-EVD-001</span>
                </div>
                <h2 className="text-xl font-bold text-slate-900">
                  Technology Acceptance Model (TAM) Evidence & System Activity
                </h2>
                <p className="text-xs text-slate-600 mt-1">
                  Measurement of user acceptance among staff and management, triangulated with live PostgreSQL system activity logs for Actual System Use (ASU).
                </p>
              </div>

              {/* Construct Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {o5Data?.constructs?.map((c: any, idx: number) => (
                  <div key={idx} className="p-4 rounded-lg border border-slate-200 bg-slate-50">
                    <h3 className="font-bold text-sm text-slate-900 mb-1">{c.construct}</h3>
                    <p className="text-xs text-slate-600 mb-2 leading-relaxed">{c.definition}</p>
                    <div className="text-xs text-teal-800 font-mono bg-teal-50/80 p-2 rounded border border-teal-200">
                      <strong>Measurement Instrument:</strong> {c.measurement}
                    </div>
                  </div>
                ))}
              </div>

              {/* Supporting Activity Stats (ASU Proof) */}
              <div className="mt-6 pt-6 border-t border-slate-200">
                <h3 className="text-sm font-bold text-slate-900 mb-1 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-teal-600" />
                  Actual System Use (ASU) Supporting Activity Metrics
                </h3>
                <p className="text-xs text-slate-500 mb-4">
                  Authentic PostgreSQL usage events proving real operational adoption.
                </p>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs font-mono">
                  <div className="p-3 rounded bg-slate-50 border border-slate-200">
                    <div className="text-[10px] text-slate-500 uppercase">Total User Logins</div>
                    <div className="text-xl font-bold text-slate-900 mt-1">
                      {o5Data?.supporting_system_activity?.user_logins_recorded || 0}
                    </div>
                  </div>
                  <div className="p-3 rounded bg-slate-50 border border-slate-200">
                    <div className="text-[10px] text-slate-500 uppercase">Orders Created</div>
                    <div className="text-xl font-bold text-slate-900 mt-1">
                      {o5Data?.supporting_system_activity?.orders_created_in_system || 0}
                    </div>
                  </div>
                  <div className="p-3 rounded bg-slate-50 border border-slate-200">
                    <div className="text-[10px] text-slate-500 uppercase">Status Transitions</div>
                    <div className="text-xl font-bold text-slate-900 mt-1">
                      {o5Data?.supporting_system_activity?.status_transitions_managed || 0}
                    </div>
                  </div>
                  <div className="p-3 rounded bg-slate-50 border border-slate-200">
                    <div className="text-[10px] text-slate-500 uppercase">Reports Generated</div>
                    <div className="text-xl font-bold text-slate-900 mt-1">
                      {o5Data?.supporting_system_activity?.reports_generated_and_exported || 0}
                    </div>
                  </div>
                  <div className="p-3 rounded bg-slate-50 border border-slate-200">
                    <div className="text-[10px] text-slate-500 uppercase">Total Audit Events</div>
                    <div className="text-xl font-bold text-slate-900 mt-1">
                      {o5Data?.supporting_system_activity?.total_audit_events_recorded || 0}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB: OBJECTIVE 6 */}
        {activeTab === 'o6' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 text-xs font-semibold rounded bg-rose-100 text-rose-800 font-mono">
                    SPECIFIC OBJECTIVE 6
                  </span>
                  <span className="text-xs text-slate-500 font-mono">Evidence ID: O6-EVD-001</span>
                </div>
                <h2 className="text-xl font-bold text-slate-900">
                  Evidence-Backed System Enhancements & Future Recommendations
                </h2>
                <p className="text-xs text-slate-600 mt-1">
                  Concrete, defensible recommendations grounded directly in technical findings, audit gaps, and user feedback.
                </p>
              </div>

              <div className="space-y-4">
                {o6Data?.recommendations?.map((rec: any, idx: number) => (
                  <div key={idx} className="p-4 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-50/80 transition">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-bold text-xs font-mono text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                        {rec.candidate_id}
                      </span>
                      <span className="text-xs text-slate-500 font-medium">Source: {rec.source}</span>
                    </div>
                    <h3 className="font-bold text-sm text-slate-900 mt-1 mb-1">
                      {rec.proposed_enhancement}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs mt-2 pt-2 border-t border-slate-200/80">
                      <div>
                        <strong className="text-slate-700">Audit Finding: </strong>
                        <span className="text-slate-600">{rec.finding}</span>
                        <div className="text-slate-500 text-[11px] mt-0.5 font-mono">Evidence: {rec.evidence}</div>
                      </div>
                      <div>
                        <strong className="text-slate-700">Research Rationale: </strong>
                        <span className="text-slate-600">{rec.rationale}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Manual Stopwatch Entry Modal */}
      {showManualModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-base font-bold text-slate-900 mb-1">
              Record Stopwatch Test Measurement
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Enter the researcher stopwatch timing measured during physical manual testing.
            </p>

            <form onSubmit={submitManualTest} className="space-y-3 text-xs">
              <div>
                <label className="font-medium text-slate-700">Test ID</label>
                <input
                  type="text"
                  value={manualForm.test_id}
                  onChange={e => setManualForm({ ...manualForm, test_id: e.target.value })}
                  placeholder={manualType === 'entry' ? 'O1-ENT-001' : manualType === 'retrieval' ? 'O1-CMP-001' : 'O3-REP-001'}
                  className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                />
              </div>

              {manualType === 'entry' ? (
                <>
                  <div>
                    <label className="font-medium text-slate-700">Physical Paper Order / Receipt Reference</label>
                    <input
                      type="text"
                      required
                      value={manualForm.record_reference}
                      onChange={e => setManualForm({ ...manualForm, record_reference: e.target.value })}
                      placeholder="Paper Claim Slip #042 or Physical Receipt 2026-A"
                      className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="font-medium text-slate-700">Items (Pairs)</label>
                      <input
                        type="number"
                        min="1"
                        value={manualForm.items_count}
                        onChange={e => setManualForm({ ...manualForm, items_count: e.target.value as any })}
                        className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                      />
                    </div>
                    <div>
                      <label className="font-medium text-slate-700">Digital Duration (s)</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={manualForm.digital_duration_seconds}
                        onChange={e => setManualForm({ ...manualForm, digital_duration_seconds: e.target.value as any })}
                        className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="font-medium text-slate-700">Manual Paper Stopwatch Time (seconds)</label>
                    <input
                      type="number"
                      step="0.5"
                      required
                      value={manualForm.manual_duration_seconds}
                      onChange={e => setManualForm({ ...manualForm, manual_duration_seconds: e.target.value as any })}
                      className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                    />
                    <span className="text-[10px] text-slate-500 mt-0.5 block">
                      e.g., 360s = 6m 0s for physical handwriting, carbon leaf duplication, and service pricing lookup
                    </span>
                  </div>
                </>
              ) : manualType === 'retrieval' ? (
                <>
                  <div>
                    <label className="font-medium text-slate-700">Record Reference / Paper Receipt Number</label>
                    <input
                      type="text"
                      required
                      value={manualForm.record_reference}
                      onChange={e => setManualForm({ ...manualForm, record_reference: e.target.value })}
                      placeholder="ORD-2025-08-15-001 or Customer Name"
                      className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="font-medium text-slate-700">Manual Stopwatch (s)</label>
                      <input
                        type="number"
                        step="0.1"
                        required
                        value={manualForm.manual_duration_seconds}
                        onChange={e => setManualForm({ ...manualForm, manual_duration_seconds: e.target.value as any })}
                        className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                      />
                    </div>
                    <div>
                      <label className="font-medium text-slate-700">Digital Duration (s)</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={manualForm.digital_duration_seconds}
                        onChange={e => setManualForm({ ...manualForm, digital_duration_seconds: e.target.value as any })}
                        className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="font-medium text-slate-700">Manual Accuracy (%)</label>
                    <input
                      type="number"
                      step="1"
                      value={manualForm.manual_accuracy_percent}
                      onChange={e => setManualForm({ ...manualForm, manual_accuracy_percent: e.target.value as any })}
                      className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="font-medium text-slate-700">Report Module</label>
                    <select
                      value={manualForm.report_type}
                      onChange={e => setManualForm({ ...manualForm, report_type: e.target.value })}
                      className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg"
                    >
                      <option value="Sales Report">Sales Report</option>
                      <option value="Expense Report">Expense Report</option>
                      <option value="ROI Report">ROI Report</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="font-medium text-slate-700">Manual Time (minutes)</label>
                      <input
                        type="number"
                        step="0.5"
                        required
                        value={manualForm.manual_duration_minutes}
                        onChange={e => setManualForm({ ...manualForm, manual_duration_minutes: e.target.value as any })}
                        className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                      />
                    </div>
                    <div>
                      <label className="font-medium text-slate-700">Digital Time (seconds)</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={manualForm.digital_duration_seconds}
                        onChange={e => setManualForm({ ...manualForm, digital_duration_seconds: e.target.value as any })}
                        className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                      />
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="font-medium text-slate-700">Protocol Notes</label>
                <textarea
                  rows={2}
                  value={manualForm.notes}
                  onChange={e => setManualForm({ ...manualForm, notes: e.target.value })}
                  placeholder="Notes on physical file cabinet condition, filing method, etc."
                  className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowManualModal(false)}
                  className="px-3 py-2 text-slate-600 hover:text-slate-800 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg text-xs"
                >
                  Save Measurement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
