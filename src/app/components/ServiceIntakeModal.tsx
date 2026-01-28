import { Dialog, DialogContent, DialogTrigger } from "@/app/components/ui/dialog";
import ServiceIntakeForm from "./ServiceIntakeForm";
import { CopyPlus } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { useState } from "react";

interface ServiceIntakeModalProps {

}

export default function ServiceIntakeModal({ }: ServiceIntakeModalProps) {
    const [open, setOpen] = useState(false);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="bg-red-600 hover:bg-red-700 text-white gap-2 font-bold shadow-sm">
                    <CopyPlus size={18} />
                    New Job Order
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-[#F8F9FA] p-0 gap-0">
                <div className="p-6">
                    <ServiceIntakeForm onSuccess={() => setOpen(false)} onCancel={() => setOpen(false)} />
                </div>
            </DialogContent>
        </Dialog>
    );
}
