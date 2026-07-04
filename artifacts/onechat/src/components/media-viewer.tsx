import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface MediaViewerProps {
  src: string;
  alt?: string;
  onClose: () => void;
}

export function MediaViewer({ src, alt = "Image", onClose }: MediaViewerProps) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [loading, setLoading] = useState(true);
  const lastTapRef = useRef(0);
  const pinchStartDistRef = useRef<number | null>(null);
  const pinchStartScaleRef = useRef(1);

  // Dismiss on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const handleDoubleTap = (e: React.MouseEvent) => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      setScale((s) => (s > 1 ? 1 : 2.5));
      setOffset({ x: 0, y: 0 });
    }
    lastTapRef.current = now;
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchStartDistRef.current = Math.sqrt(dx * dx + dy * dy);
      pinchStartScaleRef.current = scale;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchStartDistRef.current !== null) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const newScale = Math.max(1, Math.min(5, pinchStartScaleRef.current * (dist / pinchStartDistRef.current)));
      setScale(newScale);
      if (newScale <= 1) setOffset({ x: 0, y: 0 });
    }
  };

  const handleTouchEnd = () => { pinchStartDistRef.current = null; };

  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = src;
    a.download = alt || "image";
    a.target = "_blank";
    a.click();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center"
        style={{ background: "rgba(0,0,0,0.95)" }}
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 pt-12 pb-3 z-10"
          style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.6), transparent)" }}>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center transition-opacity active:opacity-60"
            style={{ background: "rgba(255,255,255,0.15)" }}
            aria-label="Close viewer"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 2l12 12M14 2L2 14" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
          <button
            onClick={handleDownload}
            className="w-9 h-9 rounded-full flex items-center justify-center transition-opacity active:opacity-60"
            style={{ background: "rgba(255,255,255,0.15)" }}
            aria-label="Download image"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 2v9M5 8l3 3 3-3M2 13h12" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        {/* Loading indicator */}
        <AnimatePresence>
          {loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <div className="flex gap-1.5">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="w-2 h-2 rounded-full bg-white"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Image */}
        <motion.img
          src={src}
          alt={alt}
          onLoad={() => setLoading(false)}
          onClick={handleDoubleTap}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{
            maxWidth: "100vw",
            maxHeight: "100vh",
            objectFit: "contain",
            transform: `scale(${scale}) translate(${offset.x}px, ${offset.y}px)`,
            transformOrigin: "center",
            transition: pinchStartDistRef.current ? "none" : "transform 0.2s ease",
            cursor: scale > 1 ? "grab" : "zoom-in",
            opacity: loading ? 0 : 1,
          }}
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: loading ? 0 : 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          drag={scale > 1}
          dragConstraints={{ left: -200, right: 200, top: -300, bottom: 300 }}
          onDrag={(_, info) => setOffset({ x: info.offset.x, y: info.offset.y })}
        />

        {/* Hint */}
        {!loading && scale === 1 && (
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 0.5, y: 0 }}
            transition={{ delay: 0.5 }}
            className="absolute bottom-8 text-xs font-mono text-white"
          >
            Double-tap to zoom
          </motion.p>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
