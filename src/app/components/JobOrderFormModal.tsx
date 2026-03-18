import { Dialog, DialogContent, DialogTrigger } from "@/app/components/ui/dialog";
import JobOrderFormComponent from "./JobOrderForm";
import { CopyPlus } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { useState } from "react";

interface JobOrderFormModalProps {
    user?: { username: string; role: 'owner' | 'staff' };
}

export default function JobOrderFormModal({ user }: JobOrderFormModalProps) {
    const [open, setOpen] = useState(false);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="bg-red-600 hover:bg-red-700 text-white gap-2 font-bold shadow-sm px-2 sm:px-4">
                    <CopyPlus size={18} />
                    <span className="hidden sm:inline">New Job Order Form</span>
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-[#F8F9FA] p-0 gap-0 rounded-2xl border-none shadow-2xl">
                <div className="p-6">
                    <JobOrderFormComponent user={user} onSuccess={() => setOpen(false)} onCancel={() => setOpen(false)} />
                </div>
            </DialogContent>
        </Dialog>
    );
}
