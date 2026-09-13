import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/app/components/ui/dialog';
import { Badge } from '@/app/components/ui/badge';
import { useActivities } from '@/app/context/ActivityContext';
import { 
    AlertCircle, Terminal, FileCode, CheckCircle2, 
    ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
    Search
} from 'lucide-react';
import { useState, useMemo } from 'react';
import { Button } from '@/app/components/ui/button';

export default function ActivityLogModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    const { activities } = useActivities();
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState<'all' | 'critical' | 'system' | 'general'>('all');

    // Filter activities by search & type
    const filteredActivities = useMemo(() => {
        return activities.filter((act) => {
            const matchesType = 
                filterType === 'all' ? true :
                filterType === 'critical' ? act.type === 'critical' :
                filterType === 'system' ? act.type === 'system' :
                act.type !== 'critical' && act.type !== 'system';

            if (!matchesType) return false;

            if (!searchQuery.trim()) return true;
            const q = searchQuery.toLowerCase();
            return (
                (act.action && act.action.toLowerCase().includes(q)) ||
                (act.details && act.details.toLowerCase().includes(q)) ||
                (act.user && act.user.toLowerCase().includes(q)) ||
                (act.timestamp && act.timestamp.toLowerCase().includes(q))
            );
        });
    }, [activities, searchQuery, filterType]);

    const totalPages = Math.max(1, Math.ceil(filteredActivities.length / itemsPerPage));

    // Reset to page 1 if search/filter changes total pages
    useMemo(() => {
        if (currentPage > totalPages) {
            setCurrentPage(1);
        }
    }, [totalPages, currentPage]);

    const paginatedActivities = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filteredActivities.slice(start, start + itemsPerPage);
    }, [filteredActivities, currentPage, itemsPerPage]);

    const startRecord = filteredActivities.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
    const endRecord = Math.min(currentPage * itemsPerPage, filteredActivities.length);

    // Compute visible page numbers for pagination bar
    const visiblePageNumbers = useMemo(() => {
        const pages: (number | string)[] = [];
        if (totalPages <= 7) {
            for (let i = 1; i <= totalPages; i++) pages.push(i);
        } else {
            pages.push(1);
            if (currentPage > 3) pages.push('...');
            const start = Math.max(2, currentPage - 1);
            const end = Math.min(totalPages - 1, currentPage + 1);
            for (let i = start; i <= end; i++) pages.push(i);
            if (currentPage < totalPages - 2) pages.push('...');
            pages.push(totalPages);
        }
        return pages;
    }, [totalPages, currentPage]);

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent 
                className="w-[calc(100vw-1.5rem)] sm:w-[96vw] sm:max-w-5xl md:max-w-5xl lg:max-w-6xl xl:max-w-7xl h-[88vh] max-h-[88vh] p-0 flex flex-col overflow-hidden border-2 border-primary/25 bg-slate-50 shadow-2xl rounded-2xl"
                closeClassName="top-4 right-4 bg-slate-100 hover:bg-red-50 text-slate-500 hover:text-red-600 border border-slate-200 hover:border-red-200 h-9 w-9 shadow-xs"
            >
                {/* 1. STICKY MODAL HEADER */}
                <div className="sticky top-0 z-30 shrink-0 bg-white/95 backdrop-blur-md border-b border-slate-200/90 px-6 pt-5 pb-4 shadow-xs">
                    <DialogHeader className="pr-12">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-primary/10 rounded-xl border border-primary/20 shadow-xs">
                                    <Terminal className="h-6 w-6 text-primary" />
                                </div>
                                <div>
                                    <DialogTitle className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                                        Defense Debugger & System Logs
                                    </DialogTitle>
                                    <DialogDescription className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
                                        Real-time audit trail for code changes, technical errors, and data integrity verification.
                                    </DialogDescription>
                                </div>
                            </div>

                            {/* Live Backend Status Badges */}
                            <div className="flex flex-wrap items-center gap-2 sm:gap-3 shrink-0">
                                <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100/90 rounded-full border border-slate-200 shadow-xs">
                                    <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse ring-2 ring-emerald-500/20" />
                                    <span className="text-xs font-bold text-slate-700">Live Backend Mirroring</span>
                                </div>
                                <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 rounded-full border border-emerald-200 shadow-xs">
                                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                    <span className="text-xs font-bold text-emerald-800">Data Integrity: Verified</span>
                                </div>
                            </div>
                        </div>
                    </DialogHeader>

                    {/* Filter & Search Toolbar */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mt-4 pt-3 border-t border-slate-100">
                        {/* Search Input */}
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                            <input
                                type="text"
                                placeholder="Search logs by action, details, user..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-100/80 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:bg-white text-slate-800 placeholder-slate-400 transition-all font-medium"
                            />
                        </div>

                        {/* Filter Tabs */}
                        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                            <button
                                type="button"
                                onClick={() => setFilterType('all')}
                                className={`px-2.5 py-1 text-xs font-bold rounded-md transition-colors ${
                                    filterType === 'all' 
                                        ? 'bg-slate-800 text-white shadow-xs' 
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                            >
                                All ({activities.length})
                            </button>
                            <button
                                type="button"
                                onClick={() => setFilterType('critical')}
                                className={`px-2.5 py-1 text-xs font-bold rounded-md transition-colors ${
                                    filterType === 'critical' 
                                        ? 'bg-red-600 text-white shadow-xs' 
                                        : 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200/60'
                                }`}
                            >
                                Critical
                            </button>
                            <button
                                type="button"
                                onClick={() => setFilterType('system')}
                                className={`px-2.5 py-1 text-xs font-bold rounded-md transition-colors ${
                                    filterType === 'system' 
                                        ? 'bg-amber-600 text-white shadow-xs' 
                                        : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200/60'
                                }`}
                            >
                                System
                            </button>
                            <button
                                type="button"
                                onClick={() => setFilterType('general')}
                                className={`px-2.5 py-1 text-xs font-bold rounded-md transition-colors ${
                                    filterType === 'general' 
                                        ? 'bg-blue-600 text-white shadow-xs' 
                                        : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200/60'
                                }`}
                            >
                                Operations
                            </button>
                        </div>
                    </div>
                </div>

                {/* 2. SCROLLABLE LOGS TABLE */}
                <div className="flex-1 overflow-y-auto overflow-x-auto min-h-0 px-4 sm:px-6 py-4">
                    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs">
                        <table className="w-full border-collapse min-w-[720px]">
                            <thead className="bg-slate-100/95 backdrop-blur-xs border-b border-slate-200 sticky top-0 z-10">
                                <tr>
                                    <th className="w-48 px-5 py-3.5 text-left text-xs font-black text-slate-700 uppercase tracking-wider">
                                        Timestamp & User
                                    </th>
                                    <th className="w-44 px-4 py-3.5 text-left text-xs font-black text-slate-700 uppercase tracking-wider">
                                        Source / Entity
                                    </th>
                                    <th className="px-5 py-3.5 text-left text-xs font-black text-slate-700 uppercase tracking-wider">
                                        Technical Details / Code Diffs
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-slate-800">
                                {paginatedActivities.length === 0 ? (
                                    <tr>
                                        <td colSpan={3} className="px-6 py-16 text-center text-slate-400 font-medium">
                                            <Terminal className="h-8 w-8 mx-auto mb-2 text-slate-300 stroke-1" />
                                            {searchQuery || filterType !== 'all' 
                                                ? 'No logs matched your current search or filter criteria.' 
                                                : 'No recent activities or system errors recorded.'}
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedActivities.map((activity) => {
                                        const isCritical = activity.type === 'critical';
                                        return (
                                            <tr 
                                                key={activity.id} 
                                                className={`transition-colors ${
                                                    isCritical 
                                                        ? 'bg-red-50/70 hover:bg-red-100/70' 
                                                        : 'hover:bg-slate-50/80'
                                                }`}
                                            >
                                                <td className="px-5 py-3.5 align-top">
                                                    <div className="text-xs font-mono font-bold text-slate-700 uppercase tracking-tight">
                                                        {activity.timestamp}
                                                    </div>
                                                    <div className="inline-flex items-center gap-1.5 mt-1 px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-[10px] font-semibold text-slate-600">
                                                        <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                                                        {activity.user || 'system'}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3.5 align-top">
                                                    <Badge 
                                                        variant="outline" 
                                                        className={`font-bold flex items-center w-fit gap-1.5 px-2.5 py-1 text-xs rounded-md shadow-2xs ${
                                                            isCritical 
                                                                ? 'border-red-500 text-red-700 bg-red-50 ring-2 ring-red-500/20' 
                                                                : activity.type === 'system' 
                                                                ? 'border-amber-500 text-amber-800 bg-amber-50' 
                                                                : 'border-blue-500 text-blue-800 bg-blue-50'
                                                        }`}
                                                    >
                                                        {isCritical ? (
                                                            <AlertCircle className="h-3.5 w-3.5 text-red-600" />
                                                        ) : activity.type === 'system' ? (
                                                            <Terminal className="h-3.5 w-3.5 text-amber-600" />
                                                        ) : (
                                                            <CheckCircle2 className="h-3.5 w-3.5 text-blue-600" />
                                                        )}
                                                        {activity.action}
                                                    </Badge>
                                                </td>
                                                <td className="px-5 py-3.5 align-top">
                                                    <div className="space-y-2">
                                                        <div className={`text-xs sm:text-sm leading-relaxed ${
                                                            isCritical ? 'text-red-950 font-bold' : 'text-slate-800 font-medium'
                                                        }`}>
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

                                                        {/* JSON Data Diff Display */}
                                                        {activity.action === 'UPDATE' && activity.details.includes('{') && (
                                                            <div className="mt-2 p-2.5 bg-slate-100/90 rounded-lg border border-slate-200">
                                                                <div className="text-[10px] text-slate-500 uppercase font-bold mb-1 tracking-wider">
                                                                    Normalized Data Sync (JSON)
                                                                </div>
                                                                <code className="text-[11px] text-slate-700 leading-tight block break-all font-mono">
                                                                    {activity.details.split(': ')[1] || activity.details}
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
                </div>

                {/* 3. STICKY MODAL FOOTER & ENHANCED PAGINATION */}
                <div className="sticky bottom-0 z-30 shrink-0 bg-white/95 backdrop-blur-md border-t border-slate-200/90 px-6 py-3.5 shadow-xs">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                        {/* Range & Per-page Selector */}
                        <div className="flex items-center gap-4 text-xs font-bold text-slate-500">
                            <span>
                                Showing <span className="text-slate-900 font-extrabold">{startRecord}</span> to <span className="text-slate-900 font-extrabold">{endRecord}</span> of <span className="text-slate-900 font-extrabold">{filteredActivities.length}</span> logs
                            </span>

                            <div className="flex items-center gap-1.5 pl-3 border-l border-slate-200">
                                <span className="text-slate-400 font-medium">Rows:</span>
                                <select
                                    value={itemsPerPage}
                                    onChange={(e) => {
                                        setItemsPerPage(Number(e.target.value));
                                        setCurrentPage(1);
                                    }}
                                    className="bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold rounded-md px-2 py-1 focus:outline-hidden focus:ring-1 focus:ring-primary cursor-pointer"
                                >
                                    <option value={10}>10</option>
                                    <option value={25}>25</option>
                                    <option value={50}>50</option>
                                </select>
                            </div>
                        </div>

                        {/* Numeric & Arrow Pagination Navigation */}
                        <div className="flex items-center gap-1">
                            {/* First Page */}
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(1)}
                                disabled={currentPage === 1}
                                className="h-8 w-8 p-0 rounded-lg border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-35"
                                title="First Page"
                            >
                                <ChevronsLeft className="h-4 w-4" />
                            </Button>

                            {/* Previous Page */}
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                disabled={currentPage === 1}
                                className="h-8 w-8 p-0 rounded-lg border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-35"
                                title="Previous Page"
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>

                            {/* Page Numbers */}
                            <div className="hidden sm:flex items-center gap-1 mx-1">
                                {visiblePageNumbers.map((page, idx) => {
                                    if (page === '...') {
                                        return (
                                            <span key={`ellipsis-${idx}`} className="px-2 text-xs text-slate-400 font-bold select-none">
                                                …
                                            </span>
                                        );
                                    }
                                    const pageNum = page as number;
                                    const isActive = pageNum === currentPage;
                                    return (
                                        <button
                                            key={pageNum}
                                            type="button"
                                            onClick={() => setCurrentPage(pageNum)}
                                            className={`h-8 min-w-[2rem] px-2 text-xs font-bold rounded-lg transition-all ${
                                                isActive
                                                    ? 'bg-primary text-white shadow-xs font-black ring-2 ring-primary/30'
                                                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-transparent'
                                            }`}
                                        >
                                            {pageNum}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Mobile Simple Page Indicator */}
                            <div className="sm:hidden text-xs font-bold text-slate-600 px-2">
                                {currentPage} / {totalPages}
                            </div>

                            {/* Next Page */}
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                disabled={currentPage === totalPages || totalPages === 0}
                                className="h-8 w-8 p-0 rounded-lg border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-35"
                                title="Next Page"
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Button>

                            {/* Last Page */}
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(totalPages)}
                                disabled={currentPage === totalPages || totalPages === 0}
                                className="h-8 w-8 p-0 rounded-lg border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-35"
                                title="Last Page"
                            >
                                <ChevronsRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
