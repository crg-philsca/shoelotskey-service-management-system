import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/app/components/ui/dialog';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { Switch } from '@/app/components/ui/switch';
import { User } from '@/app/types';
import { toast } from 'sonner';
import { Loader2, ShieldCheck, RotateCcw, AlertTriangle } from 'lucide-react';
import { API_BASE } from '@/app/lib/apiBase';
import { CANONICAL_PERMISSIONS, DEFAULT_STAFF_PERMISSIONS } from '@/app/lib/permissions';

interface ManagePermissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  currentUserToken: string;
  onPermissionsUpdated?: (userId: string, permissions: string[], summary: string) => void;
}

export default function ManagePermissionsModal({
  isOpen,
  onClose,
  user,
  currentUserToken,
  onPermissionsUpdated
}: ManagePermissionsModalProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [permissionsState, setPermissionsState] = useState<Record<string, boolean>>({});
  const [initialPermissions, setInitialPermissions] = useState<Record<string, boolean>>({});
  const [showConfirmSave, setShowConfirmSave] = useState(false);
  const [showConfirmRestore, setShowConfirmRestore] = useState(false);

  // Load authoritative permissions from backend whenever opened
  useEffect(() => {
    if (!isOpen || !user) return;

    const fetchPermissions = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/users/${user.id}/permissions`, {
          headers: {
            'Authorization': `Bearer ${currentUserToken}`,
            'Content-Type': 'application/json'
          }
        });

        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data) ? data : (data.permissions || []);
          const stateMap: Record<string, boolean> = {};
          CANONICAL_PERMISSIONS.forEach(p => {
            const serverItem = list.find((sp: any) => sp.code === p.code);
            stateMap[p.code] = serverItem ? Boolean(serverItem.enabled) : false;
          });
          setPermissionsState(stateMap);
          setInitialPermissions({ ...stateMap });
        } else {
          const err = await res.json().catch(() => ({}));
          toast.error(err.detail || 'Failed to load staff permissions from server.');
        }
      } catch (err) {
        toast.error('Network error loading staff permissions.');
      } finally {
        setLoading(false);
      }
    };

    fetchPermissions();
  }, [isOpen, user?.id, currentUserToken]);

  // Handle single toggle with strict dependency enforcement
  const handleToggle = (code: string, checked: boolean) => {
    setPermissionsState(prev => {
      const next = { ...prev, [code]: checked };

      // Job Orders dependency: If view is turned OFF, turn OFF update, cancel, authorize_cancel, release
      if (code === 'job_orders.view' && !checked) {
        next['job_orders.update'] = false;
        next['job_orders.cancel'] = false;
        next['job_orders.authorize_cancel'] = false;
        next['job_orders.release'] = false;
      }

      // If user turns on update, cancel, authorize_cancel, or release, ensure view is ON
      if (['job_orders.update', 'job_orders.cancel', 'job_orders.authorize_cancel', 'job_orders.release'].includes(code) && checked) {
        next['job_orders.view'] = true;
      }

      // Inventory dependency: If view is turned OFF, turn OFF add, edit, deactivate
      if (code === 'inventory.view' && !checked) {
        next['inventory.add'] = false;
        next['inventory.edit'] = false;
        next['inventory.deactivate'] = false;
      }

      // If user turns on add, edit, or deactivate, ensure view is ON
      if (['inventory.add', 'inventory.edit', 'inventory.deactivate'].includes(code) && checked) {
        next['inventory.view'] = true;
      }

      return next;
    });
  };

  // Diff calculation for Save Confirmation dialog
  const diffSummary = () => {
    const enabledDiff: string[] = [];
    const disabledDiff: string[] = [];

    CANONICAL_PERMISSIONS.forEach(p => {
      const initial = initialPermissions[p.code] ?? false;
      const current = permissionsState[p.code] ?? false;
      if (!initial && current) {
        enabledDiff.push(p.name);
      } else if (initial && !current) {
        disabledDiff.push(p.name);
      }
    });

    return { enabledDiff, disabledDiff, hasChanges: enabledDiff.length > 0 || disabledDiff.length > 0 };
  };

  const handleSaveConfirmed = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const payload = {
        permissions: CANONICAL_PERMISSIONS.map(p => ({
          code: p.code,
          enabled: Boolean(permissionsState[p.code])
        }))
      };

      const res = await fetch(`${API_BASE}/users/${user.id}/permissions`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${currentUserToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        toast.success(`Permissions updated successfully for ${user.username}.`);
        setInitialPermissions({ ...permissionsState });
        setShowConfirmSave(false);
        onPermissionsUpdated?.(
          user.id,
          CANONICAL_PERMISSIONS.filter(p => permissionsState[p.code]).map(p => p.code),
          data.summary || `${CANONICAL_PERMISSIONS.filter(p => permissionsState[p.code]).length} / 11 Enabled`
        );
        onClose();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.detail || 'Failed to save staff permissions.');
      }
    } catch {
      toast.error('Network error saving staff permissions.');
    } finally {
      setSaving(false);
    }
  };

  const handleRestoreDefaultsConfirmed = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/users/${user.id}/permissions/restore-defaults`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${currentUserToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (res.ok) {
        const data = await res.json();
        toast.success(`Default staff permissions restored for ${user.username}.`);
        const restoredMap: Record<string, boolean> = {};
        CANONICAL_PERMISSIONS.forEach(p => {
          restoredMap[p.code] = DEFAULT_STAFF_PERMISSIONS.includes(p.code);
        });
        setPermissionsState(restoredMap);
        setInitialPermissions(restoredMap);
        setShowConfirmRestore(false);
        onPermissionsUpdated?.(
          user.id,
          DEFAULT_STAFF_PERMISSIONS,
          data.summary || '9 / 11 Enabled'
        );
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.detail || 'Failed to restore default permissions.');
      }
    } catch {
      toast.error('Network error restoring default permissions.');
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  const isOwner = user.role?.toLowerCase() === 'owner';
  const isAdmin = user.role?.toLowerCase() === 'admin';
  const enabledCount = CANONICAL_PERMISSIONS.filter(p => permissionsState[p.code]).length;

  const jobOrderPermissions = CANONICAL_PERMISSIONS.filter(p => p.category === 'Job Orders');
  const paymentPermissions = CANONICAL_PERMISSIONS.filter(p => p.category === 'Payments & Discounts');
  const inventoryPermissions = CANONICAL_PERMISSIONS.filter(p => p.category === 'Inventory');

  const { enabledDiff, disabledDiff, hasChanges } = diffSummary();

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-5 pb-3 border-b border-gray-100 shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-lg sm:text-xl font-bold text-gray-900 flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-red-600" />
                  Manage Access
                </DialogTitle>
                <DialogDescription className="text-xs text-gray-500 mt-0.5">
                  Configure operational access and authorities for this staff account.
                </DialogDescription>
              </div>
              <Badge className="bg-red-50 text-red-700 border-red-200 text-xs font-bold px-2 py-0.5 shadow-none">
                {enabledCount} / {CANONICAL_PERMISSIONS.length} Enabled
              </Badge>
            </div>
            
            {/* User Meta Card */}
            <div className="mt-3 p-3 bg-gray-50/80 rounded-lg border border-gray-200/70 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div>
                <span className="text-gray-500 font-semibold">Staff Member: </span>
                <span className="font-bold text-gray-900">{user.username}</span>
                {user.email && <span className="text-gray-400 ml-1.5">({user.email})</span>}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-500 font-semibold">Role:</span>
                <span className="font-bold uppercase tracking-wider text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200 text-[10px]">
                  {user.role}
                </span>
                <span className="text-gray-500 font-semibold ml-2">Status:</span>
                <span className={`font-bold uppercase tracking-wider px-2 py-0.5 rounded text-[10px] border ${
                  user.active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-600 border-gray-300'
                }`}>
                  {user.active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          </DialogHeader>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 subtle-vertical-scroll">
          {loading ? (
            <div className="py-16 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-red-600 mx-auto" />
              <p className="text-xs text-gray-500 mt-2 font-semibold">Retrieving authoritative permissions...</p>
            </div>
          ) : isOwner ? (
            <div className="py-8 px-4 text-center bg-purple-50/50 rounded-xl border border-purple-200 my-4">
              <h4 className="text-sm font-bold text-purple-900 uppercase tracking-wider mb-1">
                Owner — Full Business Access
              </h4>
              <p className="text-xs text-purple-700 max-w-md mx-auto">
                Owner accounts retain full business and operational access. Individual Staff permission switches do not apply.
              </p>
            </div>
          ) : isAdmin ? (
            <div className="py-8 px-4 text-center bg-slate-50 rounded-xl border border-slate-200 my-4">
              <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-1">
                Protected System Account
              </h4>
              <p className="text-xs text-slate-600 max-w-md mx-auto">
                Technical administrative capabilities are protected and not configurable as ordinary staff permissions.
              </p>
            </div>
          ) : (
            <div className="space-y-6 my-4">
              {/* Category 1: Job Orders */}
              <div className="space-y-3">
                <div className="border-b border-gray-100 pb-1.5 flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase tracking-wider text-gray-700">
                    Job Orders
                  </h3>
                  <span className="text-[11px] text-gray-400 font-medium">
                    {jobOrderPermissions.filter(p => permissionsState[p.code]).length} of {jobOrderPermissions.length} enabled
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-2.5">
                  {jobOrderPermissions.map(p => {
                    const isDependent = ['job_orders.update', 'job_orders.cancel', 'job_orders.authorize_cancel', 'job_orders.release'].includes(p.code);
                    const parentDisabled = isDependent && !permissionsState['job_orders.view'];
                    const isChecked = Boolean(permissionsState[p.code]);

                    return (
                      <div
                        key={p.code}
                        className={`p-3 rounded-lg border transition-colors flex items-start justify-between gap-3 ${
                          isChecked ? 'bg-red-50/30 border-red-200/80' : 'bg-white border-gray-200'
                        } ${parentDisabled ? 'opacity-50 bg-gray-50' : ''}`}
                      >
                        <div className="space-y-0.5 flex-1 pr-2">
                          <div className="flex items-center gap-2">
                            <label htmlFor={`perm-${p.code}`} className="text-xs font-bold text-gray-900 cursor-pointer">
                              {p.name}
                            </label>
                            {isChecked && (
                              <span className="text-[9px] font-black uppercase text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded">
                                Enabled
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-gray-500 leading-snug">
                            {p.description}
                          </p>
                          {parentDisabled && (
                            <p className="text-[10px] text-amber-600 font-semibold italic mt-0.5">
                              Requires "View Job Orders" to be enabled.
                            </p>
                          )}
                        </div>
                        <div className="pt-0.5">
                          <Switch
                            id={`perm-${p.code}`}
                            checked={isChecked}
                            disabled={parentDisabled}
                            onCheckedChange={(checked) => handleToggle(p.code, checked)}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Category 2: Payments & Discounts */}
              <div className="space-y-3">
                <div className="border-b border-gray-100 pb-1.5 flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase tracking-wider text-gray-700">
                    Payments & Discounts
                  </h3>
                  <span className="text-[11px] text-gray-400 font-medium">
                    {paymentPermissions.filter(p => permissionsState[p.code]).length} of {paymentPermissions.length} enabled
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-2.5">
                  {paymentPermissions.map(p => {
                    const isChecked = Boolean(permissionsState[p.code]);
                    const isSensitive = p.code === 'discounts.authorize';

                    return (
                      <div
                        key={p.code}
                        className={`p-3 rounded-lg border transition-colors flex items-start justify-between gap-3 ${
                          isChecked ? 'bg-red-50/30 border-red-200/80' : 'bg-white border-gray-200'
                        } ${isSensitive && isChecked ? 'border-amber-300 bg-amber-50/20' : ''}`}
                      >
                        <div className="space-y-0.5 flex-1 pr-2">
                          <div className="flex items-center gap-2">
                            <label htmlFor={`perm-${p.code}`} className="text-xs font-bold text-gray-900 cursor-pointer">
                              {p.name}
                            </label>
                            {isChecked && (
                              <span className="text-[9px] font-black uppercase text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded">
                                Enabled
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-gray-500 leading-snug">
                            {p.description}
                          </p>
                          {isSensitive && (
                            <p className="text-[10px] text-gray-400 italic mt-0.5">
                              Does not allow changing discount rates, policies, or service pricing (Owner-only).
                            </p>
                          )}
                        </div>
                        <div className="pt-0.5">
                          <Switch
                            id={`perm-${p.code}`}
                            checked={isChecked}
                            onCheckedChange={(checked) => handleToggle(p.code, checked)}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Category 3: Inventory */}
              <div className="space-y-3">
                <div className="border-b border-gray-100 pb-1.5 flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase tracking-wider text-gray-700">
                    Inventory
                  </h3>
                  <span className="text-[11px] text-gray-400 font-medium">
                    {inventoryPermissions.filter(p => permissionsState[p.code]).length} of {inventoryPermissions.length} enabled
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-2.5">
                  {inventoryPermissions.map(p => {
                    const isDependent = ['inventory.add', 'inventory.edit', 'inventory.deactivate'].includes(p.code);
                    const parentDisabled = isDependent && !permissionsState['inventory.view'];
                    const isChecked = Boolean(permissionsState[p.code]);

                    return (
                      <div
                        key={p.code}
                        className={`p-3 rounded-lg border transition-colors flex items-start justify-between gap-3 ${
                          isChecked ? 'bg-red-50/30 border-red-200/80' : 'bg-white border-gray-200'
                        } ${parentDisabled ? 'opacity-50 bg-gray-50' : ''}`}
                      >
                        <div className="space-y-0.5 flex-1 pr-2">
                          <div className="flex items-center gap-2">
                            <label htmlFor={`perm-${p.code}`} className="text-xs font-bold text-gray-900 cursor-pointer">
                              {p.name}
                            </label>
                            {isChecked && (
                              <span className="text-[9px] font-black uppercase text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded">
                                Enabled
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-gray-500 leading-snug">
                            {p.description}
                          </p>
                          {parentDisabled && (
                            <p className="text-[10px] text-amber-600 font-semibold italic mt-0.5">
                              Requires "View Inventory" to be enabled.
                            </p>
                          )}
                        </div>
                        <div className="pt-0.5">
                          <Switch
                            id={`perm-${p.code}`}
                            checked={isChecked}
                            disabled={parentDisabled}
                            onCheckedChange={(checked) => handleToggle(p.code, checked)}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
          </div>

          {/* Footer */}
          <DialogFooter className="p-4 border-t border-gray-100 bg-gray-50/50 shrink-0 flex flex-col sm:flex-row items-center justify-between gap-2.5">
            <div>
              {!isOwner && !isAdmin && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowConfirmRestore(true)}
                  disabled={loading || saving}
                  className="text-xs font-bold text-gray-600 hover:text-gray-900 hover:bg-gray-100 border-gray-300"
                >
                  <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                  Restore Defaults
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={saving}
                className="flex-1 sm:flex-none text-xs font-bold border-gray-300"
              >
                Cancel
              </Button>
              {!isOwner && !isAdmin && (
                <Button
                  type="button"
                  onClick={() => {
                    if (hasChanges) {
                      setShowConfirmSave(true);
                    } else {
                      onClose();
                    }
                  }}
                  disabled={loading || saving}
                  className="flex-1 sm:flex-none text-xs font-bold bg-red-600 hover:bg-red-700 text-white shadow-sm"
                >
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                  Save Permissions
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog: Save Changes */}
      <Dialog open={showConfirmSave} onOpenChange={setShowConfirmSave}>
        <DialogContent className="max-w-md p-5">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-gray-900 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              Update Staff Permissions?
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              Confirm changes to <strong className="text-gray-800">{user.username}</strong>'s operational permissions.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-3 text-xs">
            {enabledDiff.length > 0 && (
              <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200">
                <span className="font-bold text-emerald-800 block mb-1">Granting Authorities:</span>
                <ul className="list-disc list-inside text-emerald-700 space-y-0.5">
                  {enabledDiff.map(item => (
                    <li key={item}>+ {item}</li>
                  ))}
                </ul>
              </div>
            )}

            {disabledDiff.length > 0 && (
              <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200">
                <span className="font-bold text-rose-800 block mb-1">Revoking Authorities:</span>
                <ul className="list-disc list-inside text-rose-700 space-y-0.5">
                  {disabledDiff.map(item => (
                    <li key={item}>- {item}</li>
                  ))}
                </ul>
              </div>
            )}
            
            <p className="text-[11px] text-gray-500 italic">
              Changes take effect immediately on both backend endpoints and active frontend sessions.
            </p>
          </div>

          <DialogFooter className="pt-2 flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowConfirmSave(false)}
              disabled={saving}
              className="flex-1 font-bold text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSaveConfirmed}
              disabled={saving}
              className="flex-1 font-bold text-xs bg-red-600 hover:bg-red-700 text-white"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
              Confirm Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog: Restore Defaults */}
      <Dialog open={showConfirmRestore} onOpenChange={setShowConfirmRestore}>
        <DialogContent className="max-w-md p-5">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-gray-900 flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-amber-600" />
              Restore Default Staff Permissions?
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              This will reset <strong>{user.username}</strong>'s configuration to the standard operational defaults (9 enabled, discounts and deactivation disabled).
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="pt-3 flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowConfirmRestore(false)}
              disabled={saving}
              className="flex-1 font-bold text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleRestoreDefaultsConfirmed}
              disabled={saving}
              className="flex-1 font-bold text-xs bg-amber-600 hover:bg-amber-700 text-white"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
              Restore Defaults
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
