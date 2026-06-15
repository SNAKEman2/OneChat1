import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { IgnitionResult } from "@/hooks/use-websocket";

interface IgnitionProps {
  partner: { displayName: string; avatarUrl?: string | null; icebreaker?: string | null } | null;
  userId: string;
  ignitionResult: IgnitionResult | null;
  onTap: () => void;
  onDone: (mode: "first" | "second" | "shared") => void;
}

type Phase = "forming" | "pulse" | "resolved";

const SHARED_PROMPTS = [
  "Say something that doesn't need explanation.",
  "Begin anywhere.",
  "Whatever comes first.",
];

export default function Ignition({ partner, userId, ignitionResult, onTap, onDone }: IgnitionProps) {
  const [phase, setPhase] = useState<Phase>("forming");
  const [hasTapped, setHasTapped] = useState(false);
  const [resolvedMode, setResolvedMode] = useState<"first" | "second" | "shared" | null>(null);
  const [prompt] = useState(() => SHARED_PROMPTS[Math.floor(Math.random() * SHARED_PROMPTS.length)]);

  // Forming → pulse after 2.4s
  useEffect(() => {
    const t = setTimeout(() => setPhase("pulse"), 2400);
    return () => clearTimeout(t);
  }, []);

  // When ignition resolves from server
  useEffect(() => {
    if (!ignitionResult) return;
    const mode =
      ignitionResult.firstSpeakerId === null
        ? "shared"
        : ignitionResult.firstSpeakerId === userId
        ? "first"
        : "second";

    setResolvedMode(mode);
    setPhase("resolved");

    const t = setTimeout(() => onDone(mode), 2800);
    return () => clearTimeout(t);
  }, [ignitionResult, userId, onDone]);

  const handleTap = () => {
    if (phase !== "pulse" || hasTapped) return;
    setHasTapped(true);
    onTap();
  };

  // SVG arc dimensions
  const r = 38;
  const circumference = 2 * Math.PI * r;
  const gapSize = 40;
  const dashArray = `${circumference - gapSize} ${gapSize}`;
  const closedDashArray = `${circumference} 0`;

  return (
    <motion.div
      className="flex-1 flex flex-col items-center justify-center relative cursor-pointer select-none"
      onClick={handleTap}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8 }}
    >
      {/* Subtle blur-then-focus atmosphere layer */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        initial={{ backdropFilter: "blur(12px)" }}
        animate={{ backdropFilter: phase === "forming" ? "blur(8px)" : "blur(0px)" }}
        transition={{ duration: 2.4, ease: "easeOut" }}
      />

      {/* Partner + self glimmers (forming phase) */}
      <AnimatePresence>
        {phase === "forming" && (
          <motion.div
            className="absolute inset-0 flex items-end justify-center pb-24 gap-[40vw] pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1 }}
          >
            <motion.div
              animate={{ opacity: [0.2, 0.5, 0.2] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              className="w-1 h-1 rounded-full bg-foreground/40"
            />
            <motion.div
              animate={{ opacity: [0.2, 0.5, 0.2] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
              className="w-1 h-1 rounded-full bg-foreground/40"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Central area */}
      <div className="flex flex-col items-center gap-10 relative z-10">

        {/* Forming text */}
        <AnimatePresence mode="wait">
          {phase === "forming" && (
            <motion.p
              key="forming-text"
              className="font-mono text-xs uppercase tracking-[0.3em] text-foreground/40"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
            >
              A room is forming…
            </motion.p>
          )}
        </AnimatePresence>

        {/* The Latch Pulse — broken circle */}
        <AnimatePresence>
          {(phase === "pulse" || phase === "resolved") && (
            <motion.div
              key="latch-pulse"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1.2, ease: "easeOut" }}
              className="relative flex items-center justify-center"
            >
              <motion.svg
                width="100"
                height="100"
                viewBox="0 0 100 100"
                className="overflow-visible"
                animate={
                  phase === "pulse"
                    ? { scale: [1, 1.055, 1], opacity: [0.45, 0.75, 0.45] }
                    : { scale: 1, opacity: 1 }
                }
                transition={
                  phase === "pulse"
                    ? { duration: 3.6, repeat: Infinity, ease: "easeInOut" }
                    : { duration: 0.6 }
                }
              >
                <motion.circle
                  cx="50"
                  cy="50"
                  r={r}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1"
                  className="text-foreground/50"
                  strokeLinecap="round"
                  strokeDashoffset={-gapSize / 2}
                  animate={{
                    strokeDasharray: phase === "resolved" ? closedDashArray : dashArray,
                    opacity: phase === "resolved" ? 0.9 : 0.5,
                  }}
                  transition={{ duration: 0.9, ease: "easeInOut" }}
                />
              </motion.svg>

              {/* Lock snap indicator on resolve */}
              <AnimatePresence>
                {phase === "resolved" && (
                  <motion.div
                    className="absolute inset-0 flex items-center justify-center"
                    initial={{ opacity: 0, scale: 0.7 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5, ease: "easeOut", delay: 0.3 }}
                  >
                    <div className="w-1 h-1 bg-foreground/60 rounded-full" />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Partner icebreaker — visible during pulse phase */}
        <AnimatePresence>
          {phase === "pulse" && partner?.icebreaker && (
            <motion.p
              key="icebreaker"
              className="font-serif italic text-foreground/30 text-center max-w-xs text-base"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.2, delay: 1.5 }}
            >
              "{partner.icebreaker}"
            </motion.p>
          )}
        </AnimatePresence>

        {/* Resolved state messages */}
        <AnimatePresence>
          {phase === "resolved" && resolvedMode === "first" && (
            <motion.p
              key="first-text"
              className="font-mono text-xs uppercase tracking-[0.3em] text-foreground/60"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.5 }}
            >
              You are first in this room.
            </motion.p>
          )}

          {phase === "resolved" && resolvedMode === "shared" && (
            <motion.p
              key="shared-text"
              className="font-serif italic text-foreground/50 text-center max-w-sm text-lg"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1, delay: 0.6 }}
            >
              {prompt}
            </motion.p>
          )}
        </AnimatePresence>

        {/* Tap hint — appears after 4s in pulse phase, disappears if tapped */}
        <AnimatePresence>
          {phase === "pulse" && !hasTapped && (
            <motion.p
              key="tap-hint"
              className="font-mono text-[10px] uppercase tracking-[0.25em] text-foreground/20 absolute -bottom-16"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1, delay: 4 }}
            >
              tap to signal presence
            </motion.p>
          )}
          {phase === "pulse" && hasTapped && (
            <motion.p
              key="tapped-hint"
              className="font-mono text-[10px] uppercase tracking-[0.25em] text-foreground/30 absolute -bottom-16"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6 }}
            >
              present
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
