import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
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

export default function ActivityHistory() {
    const navigate = useNavigate();

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate('/service-management')}
                    className="hover:bg-red-50 text-red-600 border-red-200 font-bold"
                >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Back to Service Management
                </Button>
            </div>

            <Card className="shadow-lg border-gray-200">
                <CardHeader className="bg-white rounded-t-xl border-b pb-4">
                    <div className="flex flex-col items-center">
                        <CardTitle className="text-xl font-black text-gray-900 uppercase tracking-tight">Activity History Log</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Date/Time</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">User</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Action</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Details</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 bg-white">
                                {mockActivities.map((activity) => (
                                    <tr key={activity.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 text-sm text-gray-500 font-medium">{activity.timestamp}</td>
                                        <td className="px-6 py-4 text-sm font-bold text-gray-800">{activity.user}</td>
                                        <td className="px-6 py-4 text-sm">
                                            <Badge variant="outline" className={
                                                activity.type === 'service' ? 'border-blue-500 text-blue-700 bg-blue-50' :
                                                    activity.type === 'order' ? 'border-green-500 text-green-700 bg-green-50' :
                                                        'border-gray-500 text-gray-700 bg-gray-50'
                                            }>
                                                {activity.action}
                                            </Badge>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-700 whitespace-normal break-words max-w-lg leading-relaxed">{activity.details}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="p-4 bg-gray-50 border-t border-gray-200 rounded-b-xl text-center">
                        <span className="text-xs text-gray-400 font-medium">End of log. Showing last 5 activities.</span>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
