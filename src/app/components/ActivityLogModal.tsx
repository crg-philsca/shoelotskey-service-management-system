import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/app/components/ui/dialog';
import { Badge } from '@/app/components/ui/badge';

interface ActivityLog {
    id: string;
    timestamp: string;
    user: string;
    action: string;
    details: string;
    type: 'service' | 'order' | 'system';
}

const mockActivities: ActivityLog[] = [
    { id: '1', timestamp: '2024-01-28 08:30 AM', user: 'Owner', action: 'Update Service', details: 'Changed price of "Deep Clean" from 500 to 550', type: 'service' },
    { id: '2', timestamp: '2024-01-28 09:15 AM', user: 'Staff1', action: 'Status Change', details: 'Order #JO-1025 moved to "On-Going"', type: 'order' },
    { id: '3', timestamp: '2024-01-27 04:45 PM', user: 'Technician', action: 'Service Added', details: 'Added "Unyellowing" to Order #JO-1024', type: 'order' },
    { id: '4', timestamp: '2024-01-27 02:20 PM', user: 'Owner', action: 'User Created', details: 'Created new account for "Staff2"', type: 'system' },
    { id: '5', timestamp: '2024-01-26 11:00 AM', user: 'Staff1', action: 'Delete Service', details: 'Removed "Old Promo" from Add-ons', type: 'service' },
];

export default function ActivityLogModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-5xl max-h-[80vh] overflow-y-auto w-full">
                <DialogHeader>
                    <DialogTitle>Activity History Log</DialogTitle>
                </DialogHeader>

                <div className="mt-4">
                    <table className="w-full">
                        <thead className="bg-gray-50 sticky top-0">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Date/Time</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">User</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Action</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Details</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {mockActivities.map((activity) => (
                                <tr key={activity.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3 text-sm text-gray-500 font-medium whitespace-nowrap">{activity.timestamp}</td>
                                    <td className="px-4 py-3 text-sm font-medium">{activity.user}</td>
                                    <td className="px-4 py-3 text-sm">
                                        <Badge variant="outline" className={
                                            activity.type === 'service' ? 'border-blue-500 text-blue-700 bg-blue-50' :
                                                activity.type === 'order' ? 'border-green-500 text-green-700 bg-green-50' :
                                                    'border-gray-500 text-gray-700 bg-gray-50'
                                        }>
                                            {activity.action}
                                        </Badge>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-700 whitespace-normal break-words max-w-md">{activity.details}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    <div className="mt-6 text-xs text-gray-400 text-center">
                        End of log. Showing last 5 activities.
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
