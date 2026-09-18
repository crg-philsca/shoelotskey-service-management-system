import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/app/components/ui/dialog';
import { Button } from '@/app/components/ui/button';
import { ZoomIn, Download } from 'lucide-react';

export interface ImagePreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageUrl?: string;
  title?: string;
  subtitle?: string;
}

export function ImagePreviewModal({
  open,
  onOpenChange,
  imageUrl,
  title = 'Shoe Photo Preview',
  subtitle,
}: ImagePreviewModalProps) {
  if (!imageUrl) return null;

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = imageUrl;
    a.download = `${title.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-2xl bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-2xl flex flex-col gap-3">
        <DialogHeader className="border-b border-slate-100 pb-3 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-red-50 text-red-600 rounded-xl">
              <ZoomIn size={18} />
            </div>
            <div>
              <DialogTitle className="text-base font-black uppercase tracking-tight text-slate-900 m-0">
                {title}
              </DialogTitle>
              {subtitle && (
                <DialogDescription className="text-xs text-slate-500 font-medium mt-0.5">
                  {subtitle}
                </DialogDescription>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 mr-8">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDownload}
              className="h-8 px-2.5 text-xs text-slate-700 hover:text-slate-900 gap-1 rounded-lg border-slate-200"
              title="Download full-resolution image"
            >
              <Download size={13} />
              <span className="hidden sm:inline">Download</span>
            </Button>
          </div>
        </DialogHeader>

        <div className="relative w-full max-h-[70vh] bg-slate-950 rounded-xl overflow-hidden flex items-center justify-center p-2">
          <img
            src={imageUrl}
            alt={title}
            className="max-h-[65vh] w-auto max-w-full object-contain rounded-lg shadow-lg"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ImagePreviewModal;
