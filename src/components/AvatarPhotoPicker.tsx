import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface AvatarPhotoPickerProps {
  avatarUrl: string | null;
  fallback?: string;
  uploading: boolean;
  onUpload: (blob: Blob, ext: string) => Promise<void>;
  /** Style of the outer trigger. "inline" = small text link + camera icon (partner card). "avatar" = large square avatar tile. */
  variant?: "inline" | "avatar";
  triggerLabel?: string;
}

export default function AvatarPhotoPicker({
  avatarUrl,
  fallback = "?",
  uploading,
  onUpload,
  variant = "inline",
  triggerLabel = "Update photo",
}: AvatarPhotoPickerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [capturing, setCapturing] = useState(false);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  };
  useEffect(() => () => stopCamera(), []);

  const openCamera = () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      cameraInputRef.current?.click();
      setMenuOpen(false);
      return;
    }
    setMenuOpen(false);
    setCameraOpen(true);
    setCameraStarting(true);
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 1280 } }, audio: false })
      .then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      })
      .catch((err) => {
        const name = err?.name || "";
        if (name === "NotAllowedError") toast.error("Camera permission denied. Enable it in your browser settings.");
        else if (name === "NotFoundError") toast.error("No camera found on this device.");
        else if (name === "NotReadableError") toast.error("Camera is in use by another app.");
        else toast.error("Couldn't open camera. Try uploading from gallery instead.");
        setCameraOpen(false);
      })
      .finally(() => setCameraStarting(false));
  };

  const closeCamera = () => {
    stopCamera();
    setCameraOpen(false);
  };

  const capturePhoto = async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    setCapturing(true);
    try {
      const size = Math.min(video.videoWidth, video.videoHeight);
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas unavailable");
      const sx = (video.videoWidth - size) / 2;
      const sy = (video.videoHeight - size) / 2;
      ctx.translate(size, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, sx, sy, size, size, 0, 0, size, size);
      const blob: Blob = await new Promise((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Capture failed"))), "image/jpeg", 0.92),
      );
      closeCamera();
      await onUpload(blob, "jpg");
    } catch {
      toast.error("Couldn't capture photo");
    } finally {
      setCapturing(false);
    }
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    await onUpload(file, ext);
    e.target.value = "";
  };

  return (
    <>
      {variant === "avatar" ? (
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          disabled={uploading}
          className="relative w-20 h-20 rounded-full overflow-hidden bg-primary/15 flex items-center justify-center shrink-0 disabled:opacity-60"
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
          ) : (
            <span className="text-primary font-black text-2xl">{fallback}</span>
          )}
          <span className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md">
            {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Camera className="w-3 h-3" />}
          </span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          disabled={uploading}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:opacity-80 disabled:opacity-50"
        >
          <Camera className="w-3.5 h-3.5" /> {uploading ? "Uploading…" : triggerLabel}
        </button>
      )}

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      <input ref={cameraInputRef} type="file" accept="image/*" capture="user" className="hidden" onChange={handleFile} />

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-foreground/40 backdrop-blur-sm p-0 sm:p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            onClick={() => setMenuOpen(false)}
          >
            <motion.div
              className="w-full max-w-sm bg-background rounded-t-3xl sm:rounded-3xl p-6 pb-7 shadow-2xl ring-1 ring-border/60"
              initial={{ y: 24, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 24, opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-10 h-1 rounded-full bg-border mx-auto mb-5 sm:hidden" />
              <div className="text-center mb-5">
                <h3 className="text-foreground font-black text-lg tracking-tight">Profile photo</h3>
                <p className="text-muted-foreground text-xs mt-1">Choose how you'd like to upload</p>
              </div>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={openCamera}
                  className="group w-full flex items-center gap-3 px-3 py-3 rounded-2xl bg-card ring-1 ring-border hover:ring-primary/40 hover:bg-primary/[0.03] transition-all"
                >
                  <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Camera className="w-5 h-5 text-primary" strokeWidth={2.2} />
                  </div>
                  <div className="text-left flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground">Take photo</p>
                    <p className="text-[11px] text-muted-foreground">Use your camera</p>
                  </div>
                  <span className="text-muted-foreground/60 text-lg leading-none">›</span>
                </button>
                <button
                  type="button"
                  onClick={() => { fileInputRef.current?.click(); setMenuOpen(false); }}
                  className="group w-full flex items-center gap-3 px-3 py-3 rounded-2xl bg-card ring-1 ring-border hover:ring-primary/40 hover:bg-primary/[0.03] transition-all"
                >
                  <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Upload className="w-5 h-5 text-primary" strokeWidth={2.2} />
                  </div>
                  <div className="text-left flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground">Choose from gallery</p>
                    <p className="text-[11px] text-muted-foreground">Select an existing photo</p>
                  </div>
                  <span className="text-muted-foreground/60 text-lg leading-none">›</span>
                </button>
              </div>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="w-full mt-4 py-3 rounded-2xl text-foreground/70 text-sm font-bold hover:bg-muted/60 transition-colors"
              >
                Cancel
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {cameraOpen && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/80 backdrop-blur-sm p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
          >
            <motion.div
              className="w-full max-w-sm bg-background rounded-3xl p-5 shadow-2xl ring-1 ring-border/60"
              initial={{ y: 16, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 16, opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-foreground font-black text-base tracking-tight">Take a photo</h3>
                <button
                  type="button"
                  onClick={closeCamera}
                  className="text-muted-foreground hover:text-foreground text-sm font-bold px-2 py-1 rounded-lg hover:bg-muted/60"
                >
                  Close
                </button>
              </div>
              <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-foreground/90 ring-1 ring-border">
                <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover scale-x-[-1]" />
                {cameraStarting && (
                  <div className="absolute inset-0 flex items-center justify-center text-background/90 text-xs">
                    <Loader2 className="w-5 h-5 animate-spin mr-2" /> Starting camera…
                  </div>
                )}
              </div>
              <div className="mt-4 flex items-center gap-2">
                <button
                  type="button"
                  onClick={closeCamera}
                  className="flex-1 py-3 rounded-2xl text-foreground/70 text-sm font-bold hover:bg-muted/60 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={capturePhoto}
                  disabled={cameraStarting || capturing}
                  className="flex-1 py-3 rounded-2xl bg-[var(--bbdo-red)] text-white text-sm font-black inline-flex items-center justify-center gap-1.5 disabled:opacity-60"
                >
                  {capturing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                  {capturing ? "Saving…" : "Capture"}
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground text-center mt-2">
                If the camera doesn't open, allow camera access in your browser's site settings.
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
