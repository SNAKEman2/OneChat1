import { useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { motion, AnimatePresence } from "framer-motion";

interface ReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  matchId: string;
  reportedUserId: string;
  partnerName: string;
}

const REASONS = [
  { value: "harassment", label: "Harassment or bullying" },
  { value: "spam", label: "Spam or self-promotion" },
  { value: "inappropriate", label: "Inappropriate content" },
  { value: "other", label: "Other" },
] as const;

type Reason = typeof REASONS[number]["value"];

export function ReportDialog({ open, onOpenChange, matchId, reportedUserId, partnerName }: ReportDialogProps) {
  const [reason, setReason] = useState<Reason | null>(null);
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async () => {
    if (!reason) return;
    setSubmitting(true);
    try {
      await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportedUserId, matchId, reason, details: details.trim() || null }),
      });
      setDone(true);
    } catch {
      // silent — report is best-effort
      setDone(true);
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(() => { setReason(null); setDetails(""); setDone(false); }, 300);
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleClose}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className="fixed inset-0 z-50 bg-black/60"
          style={{ backdropFilter: "blur(3px)" }}
        />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 51,
            background: "var(--surface)",
            borderTop: "1px solid var(--border)",
            borderRadius: "24px 24px 0 0",
            maxHeight: "80vh",
            overflowY: "auto",
            padding: "20px 24px 48px",
          }}
        >
          <DialogPrimitive.Title className="sr-only">Report {partnerName}</DialogPrimitive.Title>
          <div className="w-10 h-1 rounded-full mx-auto mb-6" style={{ background: "var(--border)" }} />

          <AnimatePresence mode="wait">
            {done ? (
              <motion.div
                key="done"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center py-8"
              >
                <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
                  style={{ background: "var(--surface-2)" }}>
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M4 10l4 4 8-8" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <p className="font-mono text-base font-semibold" style={{ color: "var(--foreground)" }}>
                  Report submitted
                </p>
                <p className="font-mono text-sm mt-1" style={{ color: "var(--muted)" }}>
                  Thank you. We'll review it shortly.
                </p>
                <button
                  onClick={handleClose}
                  className="mt-6 px-6 py-2.5 rounded-lg font-mono text-sm transition-opacity active:opacity-70"
                  style={{ background: "var(--accent)", color: "white" }}
                >
                  Done
                </button>
              </motion.div>
            ) : (
              <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <p className="font-mono font-semibold text-base mb-1" style={{ color: "var(--foreground)" }}>
                  Report {partnerName}
                </p>
                <p className="font-mono text-sm mb-6" style={{ color: "var(--muted)" }}>
                  What's the issue?
                </p>

                <div className="flex flex-col gap-2 mb-5">
                  {REASONS.map((r) => (
                    <button
                      key={r.value}
                      onClick={() => setReason(r.value)}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all"
                      style={{
                        background: reason === r.value ? "var(--accent)" : "var(--surface-2)",
                        border: `1px solid ${reason === r.value ? "var(--accent)" : "var(--border)"}`,
                        color: reason === r.value ? "white" : "var(--foreground)",
                      }}
                    >
                      <span className="font-mono text-sm">{r.label}</span>
                    </button>
                  ))}
                </div>

                {reason && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    className="mb-5 overflow-hidden"
                  >
                    <p className="font-mono text-xs uppercase tracking-widest mb-2" style={{ color: "var(--muted)" }}>
                      Additional details (optional)
                    </p>
                    <textarea
                      value={details}
                      onChange={(e) => setDetails(e.target.value)}
                      maxLength={1000}
                      rows={3}
                      className="w-full rounded-xl px-4 py-3 font-mono text-sm outline-none resize-none"
                      style={{
                        background: "var(--surface-2)",
                        border: "1px solid var(--border)",
                        color: "var(--foreground)",
                      }}
                      placeholder="Describe what happened…"
                    />
                  </motion.div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={handleClose}
                    className="flex-1 py-3 rounded-xl font-mono text-sm transition-opacity active:opacity-70"
                    style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--muted)" }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={!reason || submitting}
                    className="flex-1 py-3 rounded-xl font-mono text-sm font-semibold transition-opacity active:opacity-70"
                    style={{
                      background: reason ? "#DC2626" : "var(--border)",
                      color: "white",
                      opacity: !reason || submitting ? 0.5 : 1,
                    }}
                  >
                    {submitting ? "Submitting…" : "Submit report"}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <DialogPrimitive.Close
            className="absolute top-4 right-5 transition-opacity active:opacity-60"
            style={{ color: "var(--muted)" }}
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
