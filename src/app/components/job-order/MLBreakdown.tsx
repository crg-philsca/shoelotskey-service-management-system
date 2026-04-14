import React from 'react';

interface MLBreakdownProps {
    baseDays: number;
    addOnDays: number;
    priorityDays: number;
    totalDays: number;
}

export const MLBreakdown: React.FC<MLBreakdownProps> = ({ baseDays, addOnDays, priorityDays, totalDays }) => {
    return (
        <div className="col-span-2 md:col-span-12 bg-blue-50 border border-blue-100/50 rounded-lg p-2 flex items-center justify-between text-[10px] text-blue-800 shadow-sm mt-1">
            <div className="flex items-center gap-2">
                <span className="font-bold flex items-center gap-1"><span className="text-blue-600 animate-pulse">✨</span> ML Prediction:</span>
                <span>
                    {baseDays}d Base
                    {addOnDays > 0 ? ` + ${addOnDays}d Add-on` : ''}
                    {priorityDays < 0 ? ` - ${Math.abs(priorityDays)}d Rush` : (priorityDays > 0 ? ` + ${priorityDays}d Priority` : '')}
                </span>
            </div>
            <span className="font-black text-blue-900 bg-blue-100 px-2 py-0.5 rounded text-[10px] uppercase tracking-wider">
                Total: {totalDays} Days
            </span>
        </div>
    );
};
