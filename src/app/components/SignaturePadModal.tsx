import { useRef, useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/app/components/ui/dialog';
import { Button } from '@/app/components/ui/button';
import { PenTool, RotateCcw, Check } from 'lucide-react';

export interface SignaturePadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (signatureDataUrl: string) => void;
  title?: string;
  initialSignature?: string;
}

export function SignaturePadModal({
  open,
  onOpenChange,
  onSave,
  title = 'E-Signature',
  initialSignature,
}: SignaturePadModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  // Initialize and resize canvas with High DPI scaling
  useEffect(() => {
    if (!open) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Get display size
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#0f172a'; // slate-900

    // If initial signature exists, draw it
    if (initialSignature) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, rect.width, rect.height);
        setHasDrawn(true);
      };
      img.src = initialSignature;
    } else {
      setHasDrawn(false);
    }
  }, [open, initialSignature]);

  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();

    if ('touches' in e && e.touches.length > 0) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    } else if ('clientX' in e) {
      return {
        x: (e as React.MouseEvent).clientX - rect.left,
        y: (e as React.MouseEvent).clientY - rect.top,
      };
    }
    return { x: 0, y: 0 };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasDrawn(true);
  };

  const stopDrawing = (e?: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (e && isDrawing) e.preventDefault();
    setIsDrawing(false);
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    setHasDrawn(false);
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!hasDrawn) {
      handleClear();
      onSave('');
      onOpenChange(false);
      return;
    }

    const dataUrl = canvas.toDataURL('image/png');
    onSave(dataUrl);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-md bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-2xl flex flex-col gap-3">
        <DialogHeader className="border-b border-slate-100 pb-3 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-red-50 text-red-600 rounded-xl">
              <PenTool size={18} />
            </div>
            <div>
              <DialogTitle className="text-base font-black uppercase tracking-tight text-slate-900 m-0">
                {title}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 font-medium mt-0.5">
                Draw signature using your touchscreen or mouse
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Drawing Pad Area */}
        <div className="flex flex-col gap-2">
          <div className="relative w-full h-[180px] sm:h-[220px] bg-slate-50 rounded-xl border-2 border-dashed border-slate-300 overflow-hidden touch-none select-none">
            <canvas
              ref={canvasRef}
              className="w-full h-full cursor-crosshair touch-none"
              style={{ touchAction: 'none' }}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
              onTouchCancel={stopDrawing}
            />

            {/* Signature Guideline */}
            <div className="absolute left-6 right-6 bottom-8 border-b border-slate-300/80 pointer-events-none flex justify-between items-center text-[10px] text-slate-400 font-medium px-1">
              <span>Sign above the line</span>
              <span>✖</span>
            </div>

            {!hasDrawn && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-400 text-xs font-semibold select-none">
                Touch and draw here...
              </div>
            )}
          </div>

          <div className="flex justify-between items-center px-1">
            <span className="text-[11px] text-slate-400">
              {hasDrawn ? 'Signature captured' : 'Awaiting signature'}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="h-8 px-2.5 text-xs text-slate-600 hover:text-red-600 hover:bg-red-50 gap-1.5 font-bold"
            >
              <RotateCcw size={13} />
              Clear
            </Button>
          </div>
        </div>

        <DialogFooter className="pt-2.5 border-t border-slate-100 grid grid-cols-2 gap-3 sm:space-x-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="h-10 w-full text-xs font-bold text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-xl border-slate-300 cursor-pointer transition-all shadow-xs"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={!hasDrawn && !initialSignature}
            className="h-10 w-full text-xs font-black uppercase tracking-wider bg-red-600 hover:bg-red-700 text-white rounded-xl flex items-center justify-center gap-1.5 shadow-md hover:shadow-lg active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
          >
            <Check size={15} strokeWidth={2.5} />
            {!hasDrawn && initialSignature ? 'Save (Clear Signature)' : 'Save Signature'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default SignaturePadModal;
