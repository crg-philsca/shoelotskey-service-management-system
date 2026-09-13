import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/app/components/ui/dialog';
import {
  ShieldAlert,
  ShieldCheck,
  HardDriveDownload,
  Download,
  Lock,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  FileArchive,
  Database,
  RefreshCw,
  BookOpen,
  History,
  KeyRound,
  Eye,
  EyeOff,
  X,
  Globe,
} from 'lucide-react';
import { API_BASE } from '@/app/lib/apiBase';
import { toast } from 'sonner';

interface BackupRecoveryProps {
  user: { token: string; username: string; role?: string };
}

interface BackupItem {
  filename: string;
  size_bytes: number;
  created_at: string;
}

interface BackupResult {
  status: string;
  filename: string;
  file_size: number;
  total_records: number;
  checksum_sha256: string;
  created_at: string;
  message: string;
}

export default function BackupRecovery({ user }: BackupRecoveryProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastBackupResult, setLastBackupResult] = useState<BackupResult | null>(null);
  const [existingBackups, setExistingBackups] = useState<BackupItem[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(false);

  // Download Authentication State
  const [downloadModalOpen, setDownloadModalOpen] = useState(false);
  const [downloadFilename, setDownloadFilename] = useState<string>('');
  const [downloadPassword, setDownloadPassword] = useState('');
  const [downloadShowPassword, setDownloadShowPassword] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadErrorMessage, setDownloadErrorMessage] = useState<string | null>(null);

  const isMainOwnerOrAdmin = user.username?.toLowerCase() === 'owner' || user.username?.toLowerCase() === 'admin';

  // Fetch available backups
  const fetchBackups = async () => {
    setIsLoadingList(true);
    try {
      const res = await fetch(`${API_BASE}/admin/backup/list`, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setExistingBackups(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.warn('[BACKUP LIST FETCH ERROR]', e);
    } finally {
      setIsLoadingList(false);
    }
  };

  useEffect(() => {
    fetchBackups();
  }, [user.token]);

  const handleCloseModal = () => {
    if (isCreating) return;
    setIsModalOpen(false);
    setPassword('');
    setShowPassword(false);
    setErrorMessage(null);
  };

  const handleOpenDownloadModal = (filename: string) => {
    setDownloadFilename(filename);
    setDownloadPassword('');
    setDownloadShowPassword(false);
    setDownloadErrorMessage(null);
    setDownloadModalOpen(true);
  };

  const handleCloseDownloadModal = () => {
    if (isDownloading) return;
    setDownloadModalOpen(false);
    setDownloadFilename('');
    setDownloadPassword('');
    setDownloadShowPassword(false);
    setDownloadErrorMessage(null);
  };

  const executeDownload = async (filename: string, authPassword: string) => {
    const res = await fetch(`${API_BASE}/admin/backup/download/${encodeURIComponent(filename)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${user.token}`,
      },
      body: JSON.stringify({ password: authPassword }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.detail || 'Unable to download backup archive from server. Verification failed.');
    }

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
    toast.success(`Downloaded ${filename} to your device`);
  };

  const handleCreateBackup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setErrorMessage('Account password confirmation is required for verification.');
      return;
    }

    setIsCreating(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`${API_BASE}/admin/backup/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({ password: password.trim() }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        const detail = errData?.detail || (res.status === 502 || res.status === 504 
          ? 'Backend server is currently restarting or unreachable. Please try again in a moment.' 
          : 'Backup generation failed.');
        throw new Error(detail);
      }

      const result: BackupResult = await res.json();
      setLastBackupResult(result);
      setIsModalOpen(false);
      toast.success('Backup created and verified! Downloading archive to your device...');
      
      // Web-based automatic browser file download using verified password
      await executeDownload(result.filename, password.trim());
      setPassword('');
      setShowPassword(false);
      await fetchBackups();
    } catch (err: any) {
      console.error('[BACKUP CREATE ERROR]', err);
      const msg = err.message || 'Backup generation failed. No verified backup file was created.';
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDownloadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!downloadPassword.trim()) {
      setDownloadErrorMessage('Password re-authentication is required to download.');
      return;
    }

    setIsDownloading(true);
    setDownloadErrorMessage(null);

    try {
      await executeDownload(downloadFilename, downloadPassword.trim());
      handleCloseDownloadModal();
    } catch (err: any) {
      console.error('[BACKUP DOWNLOAD ERROR]', err);
      const msg = err.message || 'Download authorization rejected.';
      setDownloadErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="space-y-8 pb-10">
      {/* Header Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-red-600 via-red-700 to-rose-800 p-8 text-white shadow-xl border border-red-500/20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-red-200 text-xs font-black uppercase tracking-widest">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <span>Owner Administration • Security Hardened</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight">
              Secure System Backup & Disaster Recovery
            </h1>
            <p className="text-xs sm:text-sm text-red-100/90 max-w-2xl font-medium leading-relaxed">
              Create complete, read-only system snapshots of all 29 relational database tables for forensic preservation and full disaster recovery.
            </p>
            {!isMainOwnerOrAdmin && (
              <div className="mt-2 p-3 bg-red-950/70 border border-amber-400/40 rounded-xl text-xs text-amber-200 font-semibold flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 shrink-0 text-amber-400" />
                <span>Access Restricted: Only the primary Owner account ('owner') and Admin account ('admin') are authorized to create or download system backup snapshots.</span>
              </div>
            )}
          </div>

          <Button
            type="button"
            onClick={() => {
              setErrorMessage(null);
              setPassword('');
              setIsModalOpen(true);
            }}
            disabled={!isMainOwnerOrAdmin}
            className="h-12 px-6 bg-white text-red-700 hover:bg-red-50 font-black text-xs uppercase tracking-wider rounded-xl shadow-lg flex items-center gap-2 shrink-0 transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <HardDriveDownload className="h-5 w-5 text-red-700" />
            <span>Create System Backup</span>
          </Button>
        </div>
      </div>

      {/* Backup Success Notification Card */}
      {lastBackupResult && (
        <Card className="border-2 border-emerald-500 bg-emerald-50/60 shadow-lg animate-in fade-in slide-in-from-top-4 duration-500">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-emerald-500 text-white rounded-xl shadow-md shrink-0">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-emerald-900">
                    Backup Created & Verified Successfully
                  </h3>
                  <p className="text-xs text-emerald-700 font-semibold mt-0.5">
                    File: <span className="font-mono text-[11px] font-bold">{lastBackupResult.filename}</span> • Size: {(lastBackupResult.file_size / 1024).toFixed(1)} KB • Total Records: {lastBackupResult.total_records.toLocaleString()}
                  </p>
                  <p className="text-[10px] text-emerald-800 font-mono mt-1 break-all">
                    SHA-256: {lastBackupResult.checksum_sha256}
                  </p>
                </div>
              </div>

              <Button
                type="button"
                onClick={() => handleOpenDownloadModal(lastBackupResult.filename)}
                disabled={!isMainOwnerOrAdmin}
                className="h-10 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold uppercase rounded-xl flex items-center gap-2 shrink-0 disabled:opacity-50"
              >
                <Download className="h-4 w-4" />
                <span>Download Verified Archive</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Security Guarantees & Existing Backups */}
        <div className="lg:col-span-2 space-y-6">
          {/* Security Standards Overview */}
          <Card className="border border-gray-200 shadow-md">
            <CardHeader className="pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-red-600" />
                <CardTitle className="text-base font-black uppercase tracking-tight text-gray-900">
                  Full Recovery Specifications & Safeguards
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200/80 space-y-1">
                  <div className="flex items-center gap-2 text-gray-900 font-bold uppercase text-[11px]">
                    <Database className="h-4 w-4 text-red-600" />
                    <span>Complete 29-Table Scope</span>
                  </div>
                  <p className="text-gray-600 text-[11px] leading-relaxed">
                    Preserves live Orders, Items, Payments, Deliveries, Customers, Inventory, Expenses, Audit Logs, and Historical OCR records.
                  </p>
                </div>

                <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200/80 space-y-1">
                  <div className="flex items-center gap-2 text-gray-900 font-bold uppercase text-[11px]">
                    <Lock className="h-4 w-4 text-amber-600" />
                    <span>Zero Secrets Policy</span>
                  </div>
                  <p className="text-gray-600 text-[11px] leading-relaxed">
                    Environment variables, DATABASE_URL, JWT_SECRET, and external API keys are strictly excluded from backup archives.
                  </p>
                </div>

                <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200/80 space-y-1">
                  <div className="flex items-center gap-2 text-gray-900 font-bold uppercase text-[11px]">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                    <span>Read-Only Guarantee</span>
                  </div>
                  <p className="text-gray-600 text-[11px] leading-relaxed">
                    Executing a backup performs SELECT operations only. Zero business records are modified, deleted, or synchronized.
                  </p>
                </div>

                <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200/80 space-y-1">
                  <div className="flex items-center gap-2 text-gray-900 font-bold uppercase text-[11px]">
                    <KeyRound className="h-4 w-4 text-purple-600" />
                    <span>Password Re-Authentication</span>
                  </div>
                  <p className="text-gray-600 text-[11px] leading-relaxed">
                    Prevents unattended session abuse by demanding the Owner's current account password before data extraction.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Existing Verified Backups on Server */}
          <Card className="border border-gray-200 shadow-md">
            <CardHeader className="pb-3 border-b border-gray-100 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="h-5 w-5 text-red-600" />
                <CardTitle className="text-base font-black uppercase tracking-tight text-gray-900">
                  Verified Backups on Server
                </CardTitle>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={fetchBackups}
                disabled={isLoadingList}
                className="h-8 text-xs font-bold text-gray-500 uppercase flex items-center gap-1"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isLoadingList ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </Button>
            </CardHeader>
            <CardContent className="pt-4">
              {existingBackups.length === 0 ? (
                <div className="text-center py-8 text-xs text-gray-400 font-semibold uppercase">
                  {isLoadingList ? 'Checking archives...' : 'No system backup archives generated yet.'}
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {existingBackups.map((b) => (
                    <div key={b.filename} className="py-3 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <FileArchive className="h-5 w-5 text-red-600 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-gray-900 truncate font-mono">{b.filename}</p>
                          <p className="text-[10px] text-gray-400 font-semibold uppercase">
                            Created: {b.created_at} • Size: {(b.size_bytes / 1024).toFixed(1)} KB
                          </p>
                        </div>
                      </div>

                      <Button
                        type="button"
                        onClick={() => handleOpenDownloadModal(b.filename)}
                        disabled={!isMainOwnerOrAdmin}
                        size="sm"
                        variant="outline"
                        className="h-9 px-3 text-xs font-bold uppercase border-gray-300 hover:bg-gray-50 shrink-0 flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <Download className="h-3.5 w-3.5 text-gray-600" />
                        <span>Download</span>
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Col: Web Architecture & Recovery Procedure Guide */}
        <div className="space-y-6">
          {/* Web Architecture Notice Card */}
          <Card className="border border-blue-200 bg-blue-50/50 shadow-md">
            <CardHeader className="pb-3 border-b border-blue-100">
              <div className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-blue-700" />
                <CardTitle className="text-base font-black uppercase tracking-tight text-blue-900">
                  Web-Based Backup Architecture
                </CardTitle>
              </div>
              <CardDescription className="text-xs text-blue-800/90 font-medium">
                How database preservation works in our cloud deployment
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-3 text-xs text-blue-950">
              <div className="space-y-2">
                <p className="font-medium leading-relaxed">
                  <strong className="font-bold text-blue-900">1. Cloud PostgreSQL Source:</strong> All 29 database tables hosted on the remote cloud cluster (AWS RDS) are snapshot using read-only transactional queries.
                </p>
                <p className="font-medium leading-relaxed">
                  <strong className="font-bold text-blue-900">2. Automatic Web Download:</strong> Because this is a web-based application, saving files solely on the remote server's ephemeral filesystem is insufficient. Every backup generated <span className="underline font-bold">automatically streams directly to your web browser</span> as a verified <code className="bg-blue-100 px-1 py-0.5 rounded text-[10px] font-mono text-blue-900">.tar.gz</code> download to your device's Downloads folder!
                </p>
                <p className="font-medium leading-relaxed">
                  <strong className="font-bold text-blue-900">3. On-Demand Downloads:</strong> In addition to automatic download on creation, any past backup archive can be downloaded to your local device at any time using the <strong>Download</strong> button.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-gray-200 shadow-md">
            <CardHeader className="pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-red-600" />
                <CardTitle className="text-base font-black uppercase tracking-tight text-gray-900">
                  Recovery Procedure
                </CardTitle>
              </div>
              <CardDescription className="text-xs text-gray-500">
                Official step-by-step restoration workflow
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-3 text-xs text-gray-700">
              <ol className="list-decimal list-inside space-y-2.5 font-medium leading-relaxed">
                <li>
                  <strong className="font-bold text-gray-900">Identify Latest Archive:</strong> Locate the newest verified <code className="bg-gray-100 px-1 py-0.5 rounded text-[10px]">.tar.gz</code> snapshot downloaded to your computer.
                </li>
                <li>
                  <strong className="font-bold text-gray-900">Provision Database:</strong> Set up a replacement PostgreSQL instance.
                </li>
                <li>
                  <strong className="font-bold text-gray-900">Extract Manifest & Tables:</strong> Decompress archive to access <code className="bg-gray-100 px-1 py-0.5 rounded text-[10px]">data/*.json</code>.
                </li>
                <li>
                  <strong className="font-bold text-gray-900">Restore Relational Data:</strong> Ingest tables in topological dependency order (lookup roles/status first, users/customers, orders/items, mapping tables).
                </li>
                <li>
                  <strong className="font-bold text-gray-900">Verify Table Counts:</strong> Confirm row counts match the manifest counts.
                </li>
                <li>
                  <strong className="font-bold text-gray-900">Test Authentication:</strong> Verify Owner and Staff credentials.
                </li>
                <li>
                  <strong className="font-bold text-gray-900">Smoke Test Reports:</strong> Confirm Sales Report totals match pre-failure figures.
                </li>
              </ol>

              <div className="pt-2 border-t border-gray-100">
                <p className="text-[11px] text-gray-500 font-semibold italic">
                  Note: Never run automated restores against a healthy production cluster without prior backup verification.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Password Re-Authentication Modal */}
      <Dialog open={isModalOpen} onOpenChange={(open) => { if (!open) handleCloseModal(); }}>
        <DialogContent showCloseButton={false} className="sm:max-w-[460px] p-0 overflow-hidden bg-white border border-gray-200 shadow-2xl rounded-2xl">
          <div className="bg-gradient-to-r from-red-600 via-red-700 to-rose-800 px-6 py-5 text-white flex items-center justify-between border-b border-red-500/20">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-white/10 rounded-xl backdrop-blur-sm shadow-inner">
                <Lock className="h-6 w-6 text-white" />
              </div>
              <div>
                <DialogTitle className="text-lg font-black uppercase tracking-tight text-white m-0">
                  Authorize System Backup
                </DialogTitle>
                <DialogDescription className="text-xs text-red-100 font-medium mt-0.5">
                  Confirm Owner credentials to extract and download snapshot
                </DialogDescription>
              </div>
            </div>
            <button
              type="button"
              onClick={handleCloseModal}
              disabled={isCreating}
              className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleCreateBackup} className="p-6 space-y-4">
            {errorMessage && (
              <div className="flex items-start gap-2.5 p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-semibold animate-in fade-in duration-200">
                <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{errorMessage}</span>
              </div>
            )}

            <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-bold text-gray-500 uppercase text-[10px] tracking-wider">Account Role</span>
                <span className="font-black text-gray-900 bg-red-100 text-red-800 px-2 py-0.5 rounded text-[11px] uppercase">
                  {user.username} ({user.role ? user.role.toUpperCase() : 'USER'})
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-bold text-gray-500 uppercase text-[10px] tracking-wider">Extraction Scope</span>
                <span className="font-bold text-emerald-700 flex items-center gap-1">
                  <Database className="h-3.5 w-3.5" />
                  <span>Entire Database (29 Tables)</span>
                </span>
              </div>
              <div className="flex justify-between items-center pt-1 border-t border-slate-200/60">
                <span className="font-bold text-gray-500 uppercase text-[10px] tracking-wider">Delivery Mode</span>
                <span className="font-semibold text-slate-700 text-[11px] flex items-center gap-1">
                  <Download className="h-3.5 w-3.5 text-blue-600" />
                  <span>Automatic Web Browser Download (.tar.gz)</span>
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="owner-backup-password"
                  className="text-[11px] font-black uppercase tracking-widest text-gray-700"
                >
                  Confirm Account Password
                </label>
                <span className="text-[10px] text-red-600 font-bold uppercase tracking-wider">Required</span>
              </div>

              <div className="relative">
                <Input
                  id="owner-backup-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your account password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  disabled={isCreating}
                  required
                  className="h-11 rounded-xl pr-11 font-medium text-sm border-gray-300 focus:ring-2 focus:ring-red-500"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 focus:outline-none p-1 transition-colors cursor-pointer"
                  tabIndex={-1}
                  title={showPassword ? 'Hide password' : 'Show password'}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-gray-600" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-400" />
                  )}
                </button>
              </div>
            </div>

            <div className="pt-3 flex items-center gap-3 border-t border-gray-100">
              <Button
                type="button"
                variant="outline"
                onClick={handleCloseModal}
                disabled={isCreating}
                className="flex-1 h-11 px-5 rounded-xl border border-gray-300 hover:bg-gray-100 text-gray-700 font-bold text-xs uppercase tracking-wider transition-colors disabled:opacity-50"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isCreating || !password.trim()}
                className="flex-1 h-11 px-6 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black text-xs uppercase tracking-wider shadow-md transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Extracting...</span>
                  </>
                ) : (
                  <>
                    <HardDriveDownload className="h-4 w-4" />
                    <span>Authorize & Download</span>
                  </>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Password Re-Authentication Modal FOR DOWNLOAD */}
      <Dialog open={downloadModalOpen} onOpenChange={(open) => { if (!open) handleCloseDownloadModal(); }}>
        <DialogContent showCloseButton={false} className="w-[calc(100vw-1.5rem)] sm:max-w-[460px] p-0 overflow-hidden bg-white border border-gray-200 shadow-2xl rounded-2xl">
          <div className="bg-gradient-to-r from-red-600 via-red-700 to-rose-800 px-6 py-5 text-white flex items-center justify-between border-b border-red-500/20">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-white/10 rounded-xl backdrop-blur-sm shadow-inner">
                <Lock className="h-6 w-6 text-emerald-400" />
              </div>
              <div>
                <DialogTitle className="text-lg font-black uppercase tracking-tight text-white m-0">
                  Authorize Download
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-300 font-medium mt-0.5">
                  Confirm credentials to download verified archive
                </DialogDescription>
              </div>
            </div>
            <button
              type="button"
              onClick={handleCloseDownloadModal}
              disabled={isDownloading}
              className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50 cursor-pointer"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleDownloadSubmit} className="p-6 space-y-4">
            {downloadErrorMessage && (
              <div className="flex items-start gap-2.5 p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-semibold animate-in fade-in duration-200">
                <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{downloadErrorMessage}</span>
              </div>
            )}

            <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-bold text-gray-500 uppercase text-[10px] tracking-wider">Archive File</span>
                <span className="font-mono font-black text-gray-900 truncate max-w-[220px] text-[11px]" title={downloadFilename}>
                  {downloadFilename}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-bold text-gray-500 uppercase text-[10px] tracking-wider">Authorizing User</span>
                <span className="font-black text-slate-800 bg-slate-200 px-2 py-0.5 rounded text-[11px] uppercase">
                  {user.username} ({user.role ? user.role.toUpperCase() : 'USER'})
                </span>
              </div>
              {!isMainOwnerOrAdmin && (
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-[11px] font-medium leading-snug">
                  Only the primary <strong>owner</strong> account or <strong>admin</strong> account can authorize backup downloads.
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="download-backup-password"
                  className="text-[11px] font-black uppercase tracking-widest text-gray-700"
                >
                  Enter Password to Download
                </label>
                <span className="text-[10px] text-red-600 font-bold uppercase tracking-wider">Required</span>
              </div>

              <div className="relative">
                <Input
                  id="download-backup-password"
                  type={downloadShowPassword ? 'text' : 'password'}
                  placeholder="Enter your account password"
                  value={downloadPassword}
                  onChange={(e) => {
                    setDownloadPassword(e.target.value);
                    if (downloadErrorMessage) setDownloadErrorMessage(null);
                  }}
                  disabled={isDownloading || !isMainOwnerOrAdmin}
                  required
                  className="h-11 rounded-xl pr-11 font-medium text-sm border-gray-300 focus:ring-2 focus:ring-red-500"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setDownloadShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 focus:outline-none p-1 transition-colors cursor-pointer"
                  tabIndex={-1}
                  title={downloadShowPassword ? 'Hide password' : 'Show password'}
                  aria-label={downloadShowPassword ? 'Hide password' : 'Show password'}
                >
                  {downloadShowPassword ? (
                    <EyeOff className="h-4 w-4 text-gray-600" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-400" />
                  )}
                </button>
              </div>
            </div>

            <div className="pt-3 flex items-center gap-3 border-t border-gray-100">
              <Button
                type="button"
                variant="outline"
                onClick={handleCloseDownloadModal}
                disabled={isDownloading}
                className="flex-1 h-11 px-5 rounded-xl border border-gray-300 hover:bg-gray-100 text-gray-700 font-bold text-xs uppercase tracking-wider transition-colors disabled:opacity-50"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isDownloading || !downloadPassword.trim() || !isMainOwnerOrAdmin}
                className="flex-1 h-11 px-6 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black text-xs uppercase tracking-wider shadow-md transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
              >
                {isDownloading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    <span>Authorize & Download</span>
                  </>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
