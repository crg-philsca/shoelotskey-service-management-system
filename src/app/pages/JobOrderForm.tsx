import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import JobOrderFormComponent from '../components/JobOrderForm';
import { Button } from '@/app/components/ui/button';
import { ClipboardList } from 'lucide-react';

interface JobOrderFormProps {
    user: { username: string; role: 'owner' | 'staff' };
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
                    onClick={() => navigate('/dashboard', { state: { status: 'new-order' } })}
                    className="bg-red-600 hover:bg-red-700 text-white font-bold h-9 px-2 sm:px-4 shadow-sm transition-all"
                >
                    <ClipboardList className="h-4 w-4 mr-0 sm:mr-1" />
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
