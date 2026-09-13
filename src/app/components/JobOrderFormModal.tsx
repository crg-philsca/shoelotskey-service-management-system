import { Dialog, DialogContent, DialogTrigger } from "@/app/components/ui/dialog";
import JobOrderFormComponent from "./JobOrderForm";
import { CopyPlus } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { useState } from "react";

interface JobOrderFormModalProps {
    user?: { username: string; role: 'owner' | 'staff' | 'admin' };
}

export default function JobOrderFormModal({ user }: JobOrderFormModalProps) {
    const [open, setOpen] = useState(false);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="w-10 h-10 sm:w-auto sm:min-w-40 flex items-center justify-center rounded-md border border-red-600 bg-red-600 px-2 sm:px-3 py-2 text-sm font-bold uppercase text-white shadow-md transition hover:border-red-500 hover:bg-red-500 gap-2">
                    <CopyPlus size={16} />
                    <span className="hidden sm:inline font-bold">New Job Order Form</span>
                </Button>
            </DialogTrigger>
            <DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-4xl max-h-[92vh] overflow-y-auto bg-[#F8F9FA] p-0 gap-0 rounded-2xl border-none shadow-2xl">
                <div className="p-2 sm:p-6">
                    <JobOrderFormComponent user={user} onSuccess={() => setOpen(false)} onCancel={() => setOpen(false)} />
                </div>
            </DialogContent>
        </Dialog>
    );
}
