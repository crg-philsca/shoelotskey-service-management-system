import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, ArrowLeft, ChevronLeft, ChevronRight, ClipboardCheck } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Input } from '@/app/components/ui/input';
import { Dialog, DialogContent } from '@/app/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';

import { useActivities } from '@/app/context/ActivityContext';

/**
 * COMPONENT: ActivityHistory
 * PURPOSE: Displays a list of system-wide activities (Audit Trail).
 * DATA SOURCE: ActivityContext (Synced with AuditLog backend table).
 */
export default function ActivityHistory({ user }: { user: { token: string } }) {
    useEffect(() => {
        // [OWASP A09] Security Audit: Logging view access with token context
        if (user.token) {
            console.log('[SECURITY] Activity History accessed by authenticated session');
        }
    }, [user.token]);

    const navigate = useNavigate();
    const { activities } = useActivities();
    const [searchTerm, setSearchTerm] = useState('');
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedUser, setSelectedUser] = useState<string>('all');
    const [selectedType, setSelectedType] = useState<string>('all');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 15;

    // Derive unique filter options
    const uniqueUsers = Array.from(new Set(activities.map(a => a.user))).sort();
    const uniqueTypes = Array.from(new Set(activities.map(a => a.type))).sort();

    // Filtering logic
    const filteredActivities = activities.filter(activity => {
        // Search Filter
        const searchStr = searchTerm.toLowerCase();
        const matchesSearch = !searchTerm || (
            activity.user.toLowerCase().includes(searchStr) ||
            activity.action.toLowerCase().includes(searchStr) ||
            activity.details.toLowerCase().includes(searchStr)
        );

        // User Filter
        const matchesUser = selectedUser === 'all' || activity.user === selectedUser;

        // Type/Action Filter
        const matchesType = selectedType === 'all' || activity.type === selectedType;

        // Date Range Filter
        let matchesDate = true;
        if (startDate || endDate) {
            const datePart = activity.timestamp.includes(',') ? activity.timestamp.split(',')[0] : activity.timestamp.split(' ')[0];
            const activityDate = new Date(datePart);
            
            if (startDate) {
                const start = new Date(startDate);
                if (activityDate < start) matchesDate = false;
            }
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                if (activityDate > end) matchesDate = false;
            }
        }

        return matchesSearch && matchesUser && matchesType && matchesDate;
    });

    const totalPages = Math.ceil(filteredActivities.length / itemsPerPage) || 1;
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedActivities = filteredActivities.slice(startIndex, startIndex + itemsPerPage);

    const handlePageChange = (page: number) => {
        setCurrentPage(page);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <div className="py-2">
            <Card className="border-2 shadow-lg mt-2 gap-2 overflow-hidden">
                <CardHeader className="pt-5 pb-0 px-4">
                    <div className="flex items-center justify-center">
                        <CardTitle className="text-center text-[15px] font-black text-gray-900 uppercase tracking-[0.1em] leading-tight p-0 m-0">
                            Activity History Log
                        </CardTitle>
                    </div>
                </CardHeader>
                
                <CardContent className="pt-5">
                    {/* Search and Filter Section - DASHBOARD STYLE */}
                    <div className="flex flex-wrap md:flex-nowrap gap-2 md:gap-4 mb-4 items-center">
                        <Button 
                            onClick={() => navigate('/user-management')}
                            className="bg-red-600 text-white hover:bg-red-700 h-9 px-3 md:px-4 flex-shrink-0 uppercase text-[11px] font-bold flex items-center gap-1.5"
                            size="sm"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            <span className="hidden md:inline">Back</span>
                        </Button>

                        <div className="flex-1 min-w-[200px] relative group">
                            <Button
                                type="button"
                                variant="ghost"
                                className="absolute left-0 top-1/2 -translate-y-1/2 h-8 w-9 text-gray-500 group-focus-within:text-red-600 transition-colors"
                                onClick={() => (document.getElementById('activitySearch') as HTMLInputElement)?.focus()}
                                title="Focus search"
                            >
                                <Search className="h-4 w-4" />
                            </Button>
                            <Input 
                                id="activitySearch"
                                placeholder="Search user, action, or details..."
                                className="pl-9 h-9 text-[11px] border-gray-100 bg-gray-50/50 focus-visible:ring-1 focus-visible:ring-red-600 focus-visible:border-red-600 rounded-xl w-full transition-all"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        <Button 
                            variant="outline" 
                            className={`h-9 w-9 p-0 rounded-xl transition-colors flex-shrink-0 
                                ${selectedUser !== 'all' || selectedType !== 'all' || startDate || endDate 
                                    ? 'border-red-600 text-red-600 bg-red-50 hover:bg-red-100' 
                                    : 'border-gray-200 text-gray-500 hover:border-red-600 hover:text-red-600 hover:bg-red-50'}`}
                            onClick={() => setIsFilterOpen(true)}
                            title="Open filters"
                        >
                            <Filter className="h-4 w-4" />
                        </Button>
                    </div>

                    <div className="overflow-x-auto -mx-4 px-4 overflow-y-hidden no-scrollbar">
                        <table className="w-full min-w-[700px]">
                            <thead className="bg-red-50">
                                <tr>
                                    <th className="px-3 py-3 text-center text-[10px] md:text-xs font-bold text-gray-600 uppercase">Date/Time</th>
                                    <th className="px-3 py-3 text-center text-[10px] md:text-xs font-bold text-gray-600 uppercase">User</th>
                                    <th className="px-3 py-3 text-center text-[10px] md:text-xs font-bold text-gray-600 uppercase">Action</th>
                                    <th className="px-3 py-3 text-center text-[10px] md:text-xs font-bold text-gray-600 uppercase">Details</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 bg-white">
                                {filteredActivities.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-20 text-center">
                                            <div className="flex flex-col items-center justify-center space-y-3 opacity-40">
                                                <ClipboardCheck size={48} className="text-gray-300" />
                                                <p className="text-sm font-black text-gray-400 uppercase tracking-[0.2em]">
                                                    {searchTerm || selectedUser !== 'all' || selectedType !== 'all' || startDate || endDate
                                                        ? 'No matching activities found'
                                                        : 'No history logs found'}
                                                </p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedActivities.map((activity) => {
                                        // Helper to normalize legacy date formats (e.g. "Mar 8, 2026, 12:50 AM") to "MM/DD/YYYY, HH:mm"
                                        const normalizeDate = (ts: string) => {
                                            if (!ts) return "";
                                            // Handle "Mar 8, 2026, 12:50 AM" or similar longer strings
                                            if (ts.length > 20 || isNaN(parseInt(ts.substring(0, 2)))) {
                                                try {
                                                    const d = new Date(ts);
                                                    if (!isNaN(d.getTime())) {
                                                        const mm = String(d.getMonth() + 1).padStart(2, '0');
                                                        const dd = String(d.getDate()).padStart(2, '0');
                                                        const yyyy = d.getFullYear();
                                                        const hh = String(d.getHours()).padStart(2, '0');
                                                        const mins = String(d.getMinutes()).padStart(2, '0');
                                                        return `${mm}/${dd}/${yyyy}, ${hh}:${mins}`;
                                                    }
                                                } catch (e) { return ts; }
                                            }
                                            return ts;
                                        };

                                        return (
                                            <tr key={activity.id} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-3 py-3 text-center text-xs text-gray-700 font-medium">
                                                    {normalizeDate(activity.timestamp)}
                                                </td>
                                                <td className="px-3 py-3 text-center text-xs font-bold text-gray-800 uppercase tracking-tight">{activity.user}</td>
                                                <td className="px-3 py-3 text-center">
                                                    <Badge variant="outline" className={
                                                        `font-black uppercase text-[10px] tracking-widest px-2.5 py-0.5 rounded-full border-2 
                                                        ${activity.type === 'service' ? 'border-blue-200 text-blue-700 bg-blue-50' :
                                                            activity.type === 'order' ? 'border-green-200 text-green-700 bg-green-50' :
                                                                activity.type === 'expense' ? 'border-orange-200 text-orange-700 bg-orange-50' :
                                                                    'border-gray-200 text-gray-600 bg-gray-50'}`
                                                    }>
                                                        {activity.action}
                                                    </Badge>
                                                </td>
                                                <td className="px-3 py-3 text-center text-xs text-gray-700 whitespace-normal break-words max-w-lg leading-relaxed font-medium">{activity.details}</td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination - EXACT DASHBOARD STYLE */}
                    <div className="mt-2 flex items-center justify-between pt-1.5 pb-2 border-t border-gray-50 px-3">
                        <div className="text-[11px] text-gray-500 font-bold uppercase tracking-wider">
                            PAGE {currentPage} OF {totalPages}
                        </div>
                        <div className="flex items-center gap-3">
                            <Button
                                variant="outline"
                                onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                                disabled={currentPage === 1}
                                className={`h-8 w-8 p-0 rounded-lg transition-all border border-gray-200 shadow-sm ${currentPage === 1
                                    ? 'bg-slate-100 text-slate-400'
                                    : 'bg-white text-gray-600 hover:bg-gray-50'
                                    }`}
                            >
                                <ChevronLeft className="h-4 w-4 stroke-[3]" />
                            </Button>

                            <div className="flex items-center gap-1.5">
                                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                    const pageNum = i + 1;
                                    const isActive = currentPage === pageNum;
                                    return (
                                        <Button
                                            key={pageNum}
                                            variant={isActive ? 'default' : 'outline'}
                                            size="sm"
                                            onClick={() => handlePageChange(pageNum)}
                                            className={`h-8 w-8 min-w-[32px] p-0 text-[11px] font-black rounded-lg transition-all ${isActive
                                                ? 'bg-red-600 hover:bg-red-700 text-white border-red-600'
                                                : 'bg-white border-gray-200 text-gray-600 hover:bg-red-50 hover:text-red-600 hover:border-red-600'
                                                }`}
                                        >
                                            {pageNum}
                                        </Button>
                                    );
                                })}
                                {totalPages > 5 && <span className="text-gray-300 px-1 font-black">...</span>}
                            </div>

                            <Button
                                variant="outline"
                                onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                                disabled={currentPage === totalPages}
                                className={`h-8 w-8 p-0 rounded-lg transition-all border border-gray-200 shadow-sm ${currentPage === totalPages
                                    ? 'bg-slate-100 text-slate-400'
                                    : 'bg-white text-gray-600 hover:bg-gray-50'
                                    }`}
                            >
                                <ChevronRight className="h-4 w-4 stroke-[3]" />
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Filter Dialog */}
            <Dialog open={isFilterOpen} onOpenChange={setIsFilterOpen}>
                <DialogContent className="max-w-[400px] bg-white rounded-[2rem] border-none shadow-2xl p-0 overflow-hidden">
                    <div className="bg-[#D92D20] px-8 py-6">
                        <h2 className="text-white text-lg font-black uppercase tracking-[0.2em] flex items-center gap-3">
                            <Filter size={20} className="stroke-[3]" />
                            Filter Logs
                        </h2>
                    </div>

                    <div className="p-8 space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">User</label>
                                <Select value={selectedUser} onValueChange={setSelectedUser}>
                                    <SelectTrigger className="h-11 rounded-xl border-gray-100 bg-gray-50/50 font-bold text-gray-700 focus:ring-red-100">
                                        <SelectValue placeholder="All Users" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all" className="font-bold">ALL USERS</SelectItem>
                                        {uniqueUsers.map(user => (
                                            <SelectItem key={user} value={user} className="font-bold uppercase text-xs">{user}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Type</label>
                                <Select value={selectedType} onValueChange={setSelectedType}>
                                    <SelectTrigger className="h-11 rounded-xl border-gray-100 bg-gray-50/50 font-bold text-gray-700 focus:ring-red-100">
                                        <SelectValue placeholder="All Types" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all" className="font-bold">ALL TYPES</SelectItem>
                                        {uniqueTypes.map(type => (
                                            <SelectItem key={type} value={type} className="font-bold uppercase text-xs">{type}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Date Range</label>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="relative">
                                    <Input 
                                        type="date" 
                                        value={startDate} 
                                        onChange={e => setStartDate(e.target.value)}
                                        className="h-11 rounded-xl border-gray-100 bg-gray-50/50 font-bold text-gray-700 focus:ring-red-100 text-[12px]"
                                    />
                                    <span className="absolute -top-2 left-3 px-1 bg-white text-[8px] font-black text-gray-300 uppercase">Start</span>
                                </div>
                                <div className="relative">
                                    <Input 
                                        type="date" 
                                        value={endDate} 
                                        onChange={e => setEndDate(e.target.value)}
                                        className="h-11 rounded-xl border-gray-100 bg-gray-50/50 font-bold text-gray-700 focus:ring-red-100 text-[12px]"
                                    />
                                    <span className="absolute -top-2 left-3 px-1 bg-white text-[8px] font-black text-gray-300 uppercase">End</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3 pt-2">
                            <Button 
                                variant="outline" 
                                onClick={() => {
                                    setSelectedUser('all');
                                    setSelectedType('all');
                                    setStartDate('');
                                    setEndDate('');
                                    setIsFilterOpen(false);
                                }}
                                className="flex-1 h-12 rounded-xl border-gray-200 font-black text-gray-400 uppercase tracking-widest hover:bg-gray-50 active:scale-95 transition-all"
                            >
                                Reset
                            </Button>
                            <Button 
                                onClick={() => setIsFilterOpen(false)}
                                className="flex-1 h-12 rounded-xl bg-[#D92D20] hover:bg-[#B42318] text-white font-black uppercase tracking-widest shadow-lg shadow-red-100 active:scale-95 transition-all"
                            >
                                Apply
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
