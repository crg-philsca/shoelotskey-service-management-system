import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { Button } from '@/app/components/ui/button';
import { Camera, RefreshCw, Check, X, AlertCircle, Upload } from 'lucide-react';
import { toast } from 'sonner';

interface CameraCaptureModalProps {
  open: boolean;
  onClose: () => void;
  onCapture: (imageDataUrl: string) => void;
  title?: string;
}

export const CameraCaptureModal: React.FC<CameraCaptureModalProps> = ({
  open,
  onClose,
  onCapture,
  title = 'Take Shoe Condition Photo',
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileFallbackRef = useRef<HTMLInputElement | null>(null);

  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [hasMultipleCameras, setHasMultipleCameras] = useState<boolean>(false);
  const [isFlashing, setIsFlashing] = useState<boolean>(false);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  const startCamera = useCallback(async (mode: 'environment' | 'user') => {
    stopStream();
    setError(null);
    setLoading(true);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError('Camera API is not supported in this browser environment. Please use upload instead.');
      setLoading(false);
      return;
    }

    try {
      // Check devices count
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter((d) => d.kind === 'videoinput');
        setHasMultipleCameras(videoDevices.length > 1);
      } catch {
        // ignore enumeration errors
      }

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setLoading(false);
    } catch (err: any) {
      console.warn('Camera access failed with ideal constraints, trying fallback:', err);
      try {
        // Fallback with minimal video constraints
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setLoading(false);
      } catch (fallbackErr: any) {
        console.error('Camera fallback also failed:', fallbackErr);
        setError(
          fallbackErr.name === 'NotAllowedError' || fallbackErr.name === 'PermissionDeniedError'
            ? 'Camera access was denied. Please allow camera permissions in your browser or upload an image.'
            : 'Unable to connect to a camera device. You can upload an image from your device.'
        );
        setLoading(false);
      }
    }
  }, [stopStream]);

  useEffect(() => {
    if (open) {
      setCapturedImage(null);
      startCamera(facingMode);
    } else {
      stopStream();
      setCapturedImage(null);
    }

    return () => {
      stopStream();
    };
  }, [open, facingMode, startCamera, stopStream]);

  const toggleCamera = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current || document.createElement('canvas');
    canvasRef.current = canvas;

    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Flash animation
    setIsFlashing(true);
    setTimeout(() => setIsFlashing(false), 200);

    // If front-facing camera, mirror the canvas frame for natural selfie preview
    if (facingMode === 'user') {
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, 0, 0, width, height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
    setCapturedImage(dataUrl);
    stopStream();
  };

  const handleRetake = () => {
    setCapturedImage(null);
    startCamera(facingMode);
  };

  const handleConfirm = () => {
    if (capturedImage) {
      onCapture(capturedImage);
      toast.success('Condition photo captured & attached');
      onClose();
    }
  };

  const handleFallbackFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      onCapture(result);
      toast.success('Photo attached from file');
      onClose();
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[560px] p-0 overflow-hidden bg-slate-950 border-slate-800 text-white shadow-2xl rounded-2xl">
        {/* Header */}
        <DialogHeader className="px-5 py-3.5 border-b border-slate-800/80 flex flex-row items-center justify-between bg-slate-900/90">
          <DialogTitle className="text-sm font-black tracking-wide text-slate-100 flex items-center gap-2">
            <Camera size={16} className="text-red-500" />
            <span>{title}</span>
          </DialogTitle>
          <div className="flex items-center gap-1.5">
            {hasMultipleCameras && !capturedImage && !error && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={toggleCamera}
                className="h-8 px-2 text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800 gap-1.5"
                title="Switch Camera"
              >
                <RefreshCw size={13} />
                <span className="hidden sm:inline">Switch</span>
              </Button>
            )}
          </div>
        </DialogHeader>

        {/* Viewfinder / Capture Area */}
        <div className="relative w-full aspect-4/3 bg-black flex items-center justify-center overflow-hidden">
          {/* Flash overlay */}
          {isFlashing && (
            <div className="absolute inset-0 bg-white z-30 pointer-events-none animate-out fade-out duration-200" />
          )}

          {error ? (
            <div className="p-6 text-center max-w-md space-y-3 z-10">
              <div className="w-12 h-12 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center mx-auto border border-red-500/30">
                <AlertCircle size={24} />
              </div>
              <p className="text-xs font-medium text-slate-300 leading-relaxed">{error}</p>
              <Button
                type="button"
                onClick={() => fileFallbackRef.current?.click()}
                className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold gap-1.5 rounded-lg shadow-md"
              >
                <Upload size={14} /> Upload from Device
              </Button>
            </div>
          ) : capturedImage ? (
            <div className="relative w-full h-full flex items-center justify-center bg-black">
              <img
                src={capturedImage}
                alt="Captured shoe"
                className="w-full h-full object-contain"
              />
              <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                <Check size={11} strokeWidth={3} /> Photo Preview
              </div>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${facingMode === 'user' ? '-scale-x-100' : ''}`}
              />

              {loading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 gap-2 z-10">
                  <div className="w-7 h-7 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs font-bold text-slate-400">Starting camera...</span>
                </div>
              )}

              {/* Viewfinder crosshairs framing */}
              {!loading && (
                <div className="absolute inset-6 border border-white/25 rounded-xl pointer-events-none flex flex-col justify-between p-3">
                  <div className="flex justify-between">
                    <div className="w-4 h-4 border-t-2 border-l-2 border-red-500/80" />
                    <div className="w-4 h-4 border-t-2 border-r-2 border-red-500/80" />
                  </div>
                  <div className="text-center">
                    <span className="text-[10px] font-bold tracking-wider uppercase text-white/50 bg-black/40 px-2 py-0.5 rounded backdrop-blur-xs">
                      Frame Shoe Defect / Condition
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <div className="w-4 h-4 border-b-2 border-l-2 border-red-500/80" />
                    <div className="w-4 h-4 border-b-2 border-r-2 border-red-500/80" />
                  </div>
                </div>
              )}
            </>
          )}

          {/* Hidden file input fallback */}
          <input
            ref={fileFallbackRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFallbackFileChange}
          />
        </div>

        {/* Action Controls Footer */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between">
          {capturedImage ? (
            <div className="flex items-center justify-between w-full gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleRetake}
                className="flex-1 bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700 hover:text-white font-bold text-xs h-10 rounded-xl"
              >
                <RefreshCw size={14} className="mr-1.5" /> Retake
              </Button>
              <Button
                type="button"
                onClick={handleConfirm}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold text-xs h-10 rounded-xl shadow-lg shadow-red-900/30"
              >
                <Check size={14} className="mr-1.5 stroke-[3]" /> Attach Photo
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between w-full">
              <Button
                type="button"
                variant="ghost"
                onClick={() => fileFallbackRef.current?.click()}
                className="text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 h-9 px-3 gap-1.5 rounded-lg"
              >
                <Upload size={13} />
                <span>Upload File</span>
              </Button>

              {/* Shutter Button */}
              {!error && !loading && (
                <button
                  type="button"
                  onClick={capturePhoto}
                  className="w-14 h-14 rounded-full bg-white p-1 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform shadow-lg shadow-black/50 cursor-pointer"
                  title="Capture Photo"
                >
                  <div className="w-full h-full rounded-full border-2 border-slate-900 bg-red-600 hover:bg-red-500 transition-colors flex items-center justify-center">
                    <Camera size={20} className="text-white" />
                  </div>
                </button>
              )}

              <Button
                type="button"
                variant="ghost"
                onClick={onClose}
                className="text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 h-9 px-3 gap-1.5 rounded-lg"
              >
                <X size={13} />
                <span>Cancel</span>
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
