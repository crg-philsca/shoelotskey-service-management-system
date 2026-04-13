import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/app/components/ui/dialog';
import { Badge } from '@/app/components/ui/badge';
import { useActivities } from '@/app/context/ActivityContext';
import { AlertCircle, Terminal, FileCode, CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState, useMemo } from 'react';
import { Button } from '@/app/components/ui/button';

export default function ActivityLogModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    const { activities } = useActivities();
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const totalPages = Math.ceil(activities.length / itemsPerPage);
    const paginatedActivities = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return activities.slice(start, start + itemsPerPage);
    }, [activities, currentPage]);

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto w-full border-2 border-primary/20 bg-slate-50/95 backdrop-blur-md">
                <DialogHeader className="border-b pb-4 mb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                            <Terminal className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                            <DialogTitle className="text-2xl font-bold text-slate-800">Defense Debugger & System Logs</DialogTitle>
                            <p className="text-sm text-slate-500 font-medium mt-1">
                                Real-time audit trail for code changes, technical errors, and data integrity verification.
                            </p>
                        </div>
                    </div>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Visual Summary Badges */}
                    <div className="flex gap-4 p-4 bg-white/50 rounded-xl border border-primary/10">
                        <div className="flex items-center gap-2">
                            <div className="h-3 w-3 rounded-full bg-red-500 animate-pulse" />
                            <span className="text-sm font-semibold text-slate-700">Live Backend Mirroring</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="h-3 w-3 rounded-full bg-green-500" />
                            <span className="text-sm font-semibold text-slate-700">Data Integrity: Verified</span>
                        </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                        <table className="w-full border-collapse">
                            <thead className="bg-slate-100 border-b border-slate-200 sticky top-0 z-10">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Timestamp</th>
                                    <th className="px-4 py-4 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Source/Entity</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Technical Details / Code Diffs</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {paginatedActivities.length === 0 ? (
                                    <tr>
                                        <td colSpan={3} className="px-6 py-12 text-center text-slate-400 font-medium">
                                            No recent activities or system errors recorded.
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedActivities.map((activity) => {
                                        const isCritical = activity.type === 'critical';
                                        return (
                                            <tr key={activity.id} className={`transition-colors ${isCritical ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-slate-50'}`}>
                                                <td className="px-6 py-4">
                                                    <div className="text-xs font-mono font-bold text-slate-500 uppercase tracking-tight">{activity.timestamp}</div>
                                                    <div className="text-[10px] text-slate-400 mt-1 font-medium">{activity.user}</div>
                                                </td>
                                                <td className="px-4 py-4">
                                                    <Badge variant="outline" className={`font-bold flex items-center w-fit gap-1.5 px-3 py-1 ${
                                                        isCritical ? 'border-red-500 text-red-700 bg-red-50 ring-2 ring-red-500/20' :
                                                        activity.type === 'system' ? 'border-amber-500 text-amber-700 bg-amber-50' :
                                                        'border-blue-500 text-blue-700 bg-blue-50'
                                                    }`}>
                                                        {isCritical ? <AlertCircle className="h-3.5 w-3.5" /> : (activity.type === 'system' ? <Terminal className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />)}
                                                        {activity.action}
                                                    </Badge>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="space-y-2">
                                                        <div className={`text-sm leading-relaxed ${isCritical ? 'text-red-900 font-bold' : 'text-slate-700 font-medium'}`}>
                                                            {activity.details}
                                                        </div>
                                                        {/* Specialized Traceback Logic */}
                                                        {isCritical && activity.details.includes('| File:') && (
                                                            <div className="mt-2 p-3 bg-slate-900 rounded-lg border-l-4 border-red-500 shadow-inner">
                                                                <div className="flex items-center gap-2 mb-2 text-red-400 font-mono text-xs font-bold uppercase tracking-widest">
                                                                    <FileCode className="h-4 w-4" /> Traceback Mirror
                                                                </div>
                                                                <div className="font-mono text-xs text-slate-300 space-y-1">
                                                                    <div className="flex border-b border-slate-800 pb-1 mb-1">
                                                                        <span className="text-slate-500 w-16">Source:</span>
                                                                        <span className="text-cyan-400">{activity.details.split('| File:')[1].split('| Line:')[0].trim()}</span>
                                                                    </div>
                                                                    <div className="flex">
                                                                        <span className="text-slate-500 w-16">Line:</span>
                                                                        <span className="text-yellow-400">{activity.details.split('| Line:')[1].trim()}</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}
                                                        {activity.action === 'UPDATE' && activity.details.includes('{') && (
                                                            <div className="mt-2 p-2 bg-slate-100 rounded border border-slate-200">
                                                                <div className="text-[10px] text-slate-400 uppercase font-bold mb-1">Normalized Data Sync (JSON)</div>
                                                                <code className="text-[11px] text-slate-600 leading-tight block break-all font-mono">
                                                                    {activity.details.split(': ')[1]}
                                                                </code>
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex items-center justify-between px-4 mt-4">
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                            Page {currentPage} of {totalPages || 1}
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                disabled={currentPage === 1}
                                className="h-8 w-8 p-0 rounded-lg border-slate-200 text-slate-600"
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                disabled={currentPage === totalPages || totalPages === 0}
                                className="h-8 w-8 p-0 rounded-lg border-slate-200 text-slate-600"
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>

                    <div className="flex items-center justify-between px-4 text-[10px] font-bold">
                        <div className="text-slate-400 uppercase">
                            Total Records: {activities.length}
                        </div>
                        <div className="text-primary/60 italic">
                            * Technical corrections and code mirrors are updated automatically.
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
