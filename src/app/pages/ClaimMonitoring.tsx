import { useNavigate } from 'react-router-dom';
import { useOrders } from '@/app/context/OrderContext';
import { Check, ChevronLeft } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardHeader } from '@/app/components/ui/card';

export default function ClaimMonitoring() {
    const navigate = useNavigate();
    const { orders } = useOrders();

    // Filter for claimed orders. 
    const claimedOrders = orders
        .filter(order => order.status === 'claimed')
        .sort((a, b) => {
            const dateA = a.actualCompletionDate ? new Date(a.actualCompletionDate).getTime() : 0;
            const dateB = b.actualCompletionDate ? new Date(b.actualCompletionDate).getTime() : 0;
            return dateB - dateA; // Newest first
        });

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate('/calendar')}
                    className="hover:bg-red-50 text-red-600 border-red-200 font-bold"
                >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Back to Calendar
                </Button>
            </div>

            <Card className="shadow-lg border-gray-200">
                <CardHeader className="border-b pb-4 bg-white rounded-t-xl">
                    <div className="flex flex-col items-center">
                        <h1 className="text-xl font-black text-red-600 uppercase tracking-widest">Shoelotskey</h1>
                        <h2 className="text-sm font-bold text-gray-500 uppercase tracking-[0.2em] mt-1">Claim Monitoring Record</h2>
                    </div>
                </CardHeader>

                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse min-w-[800px]">
                            <thead className="bg-gray-100">
                                <tr>
                                    <th className="border-b border-gray-200 px-3 py-3 text-xs font-bold text-gray-700 uppercase tracking-wider w-[120px]">Date</th>
                                    <th className="border-b border-gray-200 px-3 py-3 text-xs font-bold text-gray-700 uppercase tracking-wider">Customer's Name</th>
                                    <th className="border-b border-gray-200 px-3 py-3 text-xs font-bold text-gray-700 uppercase tracking-wider w-[100px]">Receipt NR</th>
                                    <th className="border-b border-gray-200 px-3 py-3 text-xs font-bold text-gray-700 uppercase tracking-wider w-[80px]">NR of Pairs</th>
                                    <th className="border-b border-gray-200 px-3 py-3 text-xs font-bold text-gray-700 uppercase tracking-wider w-[120px]">Remaining Balance</th>
                                    <th className="border-b border-gray-200 px-3 py-3 text-xs font-bold text-gray-700 uppercase tracking-wider w-[80px]">Fully Paid</th>
                                    <th className="border-b border-gray-200 px-3 py-3 text-xs font-bold text-gray-700 uppercase tracking-wider w-[150px]">Customer's Signature</th>
                                    <th className="border-b border-gray-200 px-3 py-3 text-xs font-bold text-gray-700 uppercase tracking-wider w-[120px]">Attending Staff</th>
                                </tr>
                            </thead>
                            <tbody>
                                {claimedOrders.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="px-4 py-8 text-center text-gray-400 text-sm italic">
                                            No claimed records found.
                                        </td>
                                    </tr>
                                ) : (
                                    claimedOrders.map((order) => {
                                        const balance = order.grandTotal - (order.amountReceived || 0);
                                        const isFullyPaid = balance <= 0 && order.paymentStatus === 'paid';
                                        const releaseDate = order.actualCompletionDate ? new Date(order.actualCompletionDate).toLocaleDateString() : '-';

                                        return (
                                            <tr key={order.id} className="hover:bg-red-50/30 transition-colors border-b border-gray-100 last:border-0">
                                                <td className="px-3 py-3 text-sm text-center font-medium text-gray-700 border-r border-gray-100">
                                                    {releaseDate}
                                                </td>
                                                <td className="px-3 py-3 text-sm font-semibold text-gray-800 text-left border-r border-gray-100">
                                                    {order.customerName}
                                                </td>
                                                <td className="px-3 py-3 text-sm text-center font-mono text-gray-600 border-r border-gray-100">
                                                    {order.orderNumber}
                                                </td>
                                                <td className="px-3 py-3 text-sm text-center font-medium border-r border-gray-100">
                                                    {Array.isArray(order.baseService) ? order.baseService.length : 1}
                                                </td>
                                                <td className="px-3 py-3 text-sm text-center font-bold text-gray-700 border-r border-gray-100">
                                                    {balance > 0 ? (
                                                        <span className="text-red-600">{'\u20B1'}{balance.toLocaleString()}</span>
                                                    ) : (
                                                        <span className="text-green-600">-</span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-3 text-center border-r border-gray-100">
                                                    <div className="flex justify-center">
                                                        {isFullyPaid ? (
                                                            <div className="h-5 w-5 rounded bg-green-100 flex items-center justify-center text-green-600 border border-green-200">
                                                                <Check size={14} strokeWidth={3} />
                                                            </div>
                                                        ) : (
                                                            <div className="h-5 w-5 rounded border border-gray-300 bg-gray-50"></div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-3 py-3 text-center border-r border-gray-100">
                                                    <div className="h-8 border-b border-gray-200 w-full"></div>
                                                </td>
                                                <td className="px-3 py-3 text-sm text-center text-gray-600">
                                                    {order.processedBy || '-'}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="p-4 flex justify-end bg-gray-50 rounded-b-xl border-t border-gray-200">
                        <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Villamor - Pasay Branch</p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
