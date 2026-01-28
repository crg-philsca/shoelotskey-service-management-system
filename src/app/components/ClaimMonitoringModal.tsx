import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/app/components/ui/dialog';
import { useOrders } from '@/app/context/OrderContext';
import { Check } from 'lucide-react';

interface ClaimMonitoringModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function ClaimMonitoringModal({ isOpen, onClose }: ClaimMonitoringModalProps) {
    const { orders } = useOrders();

    // Filter for claimed orders. 
    // In a real scenario, this might need pagination or date filtering if the list grows large.
    const claimedOrders = orders
        .filter(order => order.status === 'claimed')
        .sort((a, b) => {
            const dateA = a.actualCompletionDate ? new Date(a.actualCompletionDate).getTime() : 0;
            const dateB = b.actualCompletionDate ? new Date(b.actualCompletionDate).getTime() : 0;
            return dateB - dateA; // Newest first
        });

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto w-full">
                <DialogHeader className="border-b pb-4">
                    <div className="flex flex-col items-center">
                        <h1 className="text-xl font-black text-red-600 uppercase tracking-widest">Shoelotskey</h1>
                        <DialogTitle className="text-sm font-bold text-gray-500 uppercase tracking-[0.2em] mt-1">Claim Monitoring Record</DialogTitle>
                    </div>
                </DialogHeader>

                <div className="mt-2 overflow-x-auto">
                    <table className="w-full border-collapse border border-gray-300 min-w-[800px]">
                        <thead className="bg-gray-100">
                            <tr>
                                <th className="border border-gray-300 px-3 py-2 text-xs font-bold text-gray-700 uppercase tracking-wider w-[120px]">Date</th>
                                <th className="border border-gray-300 px-3 py-2 text-xs font-bold text-gray-700 uppercase tracking-wider">Customer's Name</th>
                                <th className="border border-gray-300 px-3 py-2 text-xs font-bold text-gray-700 uppercase tracking-wider w-[100px]">Receipt NR</th>
                                <th className="border border-gray-300 px-3 py-2 text-xs font-bold text-gray-700 uppercase tracking-wider w-[80px]">NR of Pairs</th>
                                <th className="border border-gray-300 px-3 py-2 text-xs font-bold text-gray-700 uppercase tracking-wider w-[120px]">Remaining Balance</th>
                                <th className="border border-gray-300 px-3 py-2 text-xs font-bold text-gray-700 uppercase tracking-wider w-[80px]">Fully Paid</th>
                                <th className="border border-gray-300 px-3 py-2 text-xs font-bold text-gray-700 uppercase tracking-wider w-[150px]">Customer's Signature</th>
                                <th className="border border-gray-300 px-3 py-2 text-xs font-bold text-gray-700 uppercase tracking-wider w-[120px]">Attending Staff</th>
                            </tr>
                        </thead>
                        <tbody>
                            {claimedOrders.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="border border-gray-300 px-4 py-8 text-center text-gray-400 text-sm italic">
                                        No claimed records found.
                                    </td>
                                </tr>
                            ) : (
                                claimedOrders.map((order) => {
                                    const balance = order.grandTotal - (order.amountReceived || 0);
                                    const isFullyPaid = balance <= 0 && order.paymentStatus === 'paid';
                                    const releaseDate = order.actualCompletionDate ? new Date(order.actualCompletionDate).toLocaleDateString() : '-';

                                    return (
                                        <tr key={order.id} className="hover:bg-red-50/30 transition-colors">
                                            <td className="border border-gray-300 px-3 py-2 text-sm text-center font-medium text-gray-700">
                                                {releaseDate}
                                            </td>
                                            <td className="border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-800 text-left">
                                                {order.customerName}
                                            </td>
                                            <td className="border border-gray-300 px-3 py-2 text-sm text-center font-mono text-gray-600">
                                                {order.orderNumber}
                                            </td>
                                            <td className="border border-gray-300 px-3 py-2 text-sm text-center font-medium">
                                                {Array.isArray(order.baseService) ? order.baseService.length : 1}
                                            </td>
                                            <td className="border border-gray-300 px-3 py-2 text-sm text-center font-bold text-gray-700">
                                                {balance > 0 ? (
                                                    <span className="text-red-600">{'\u20B1'}{balance.toLocaleString()}</span>
                                                ) : (
                                                    <span className="text-green-600">-</span>
                                                )}
                                            </td>
                                            <td className="border border-gray-300 px-3 py-2 text-center">
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
                                            <td className="border border-gray-300 px-3 py-2 text-center">
                                                {/* Signature placeholder for digital view */}
                                                <div className="h-8 border-b border-gray-200 w-full"></div>
                                            </td>
                                            <td className="border border-gray-300 px-3 py-2 text-sm text-center text-gray-600">
                                                {order.processedBy || '-'}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                            {/* Fill with empty rows to look like the paper form if list is short? Optional. */}
                            {Array.from({ length: Math.max(0, 10 - claimedOrders.length) }).map((_, i) => (
                                <tr key={`empty-${i}`} className="opacity-50">
                                    <td className="border border-gray-300 px-3 py-4"></td>
                                    <td className="border border-gray-300 px-3 py-4"></td>
                                    <td className="border border-gray-300 px-3 py-4"></td>
                                    <td className="border border-gray-300 px-3 py-4"></td>
                                    <td className="border border-gray-300 px-3 py-4"></td>
                                    <td className="border border-gray-300 px-3 py-4"></td>
                                    <td className="border border-gray-300 px-3 py-4"></td>
                                    <td className="border border-gray-300 px-3 py-4"></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="mt-4 flex justify-end">
                    <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Villamor - Pasay Branch</p>
                </div>
            </DialogContent>
        </Dialog>
    );
}
