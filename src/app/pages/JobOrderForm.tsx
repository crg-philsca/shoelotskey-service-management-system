import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import JobOrderFormComponent from '../components/JobOrderForm';
import { Button } from '@/app/components/ui/button';
import { ClipboardList } from 'lucide-react';

interface JobOrderFormProps {
    user: { username: string; role: 'owner' | 'staff'; token: string };
    onSetHeaderActionRight: (node: React.ReactNode) => void;
}

/**
 * PAGE: JobOrderForm
 * PURPOSE: Wrapper for the JobOrderFormComponent.
 * FUNCTION: Manages header actions and layout for the intake form.
 */
export default function JobOrderForm({ user, onSetHeaderActionRight }: JobOrderFormProps) {
    const navigate = useNavigate();

    useEffect(() => {
        if (onSetHeaderActionRight) {
            onSetHeaderActionRight(
                <Button 
                    className="w-10 h-10 sm:w-40 flex items-center justify-center rounded-md border border-red-600 bg-red-600 px-2 sm:px-3 py-2 text-[11px] font-black uppercase text-white shadow-md transition hover:border-red-500 hover:bg-red-500 focus:outline-none focus:ring-2 focus:ring-red-500 tracking-widest"
                    onClick={() => navigate('/dashboard', { state: { status: 'new-order' } })}
                >
                    <ClipboardList className="h-4 w-4 sm:mr-2 shrink-0" />
                    <span className="hidden sm:inline">Status Table</span>
                </Button>
            );
        }
        return () => onSetHeaderActionRight?.(null);
    }, [onSetHeaderActionRight, navigate]);

    return (
        <div className="min-h-screen bg-[#F8F9FA] pb-20">
            <div className="max-w-5xl mx-auto px-6 py-1">
                <JobOrderFormComponent
                    user={user}
                    onSuccess={() => navigate('/dashboard')}
                    onCancel={() => navigate('/dashboard')}
                />
            </div>
        </div>
    );
}
