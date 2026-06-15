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

function Avatar({ name, avatarUrl, size = 52 }: { name: string; avatarUrl?: string | null; size?: number }) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
        onError={(e) => (e.currentTarget.style.display = "none")}
      />
    );
  }
  const initials = name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div
      className="rounded-full flex items-center justify-center text-white font-mono font-medium"
      style={{ width: size, height: size, fontSize: size * 0.32, background: "hsl(211 60% 38%)" }}
    >
      {initials}
    </div>
  );
}

export default function Ignition({ partner, userId, ignitionResult, onTap, onDone }: IgnitionProps) {
  const [phase, setPhase] = useState<Phase>("forming");
  const [hasTapped, setHasTapped] = useState(false);
  const [resolvedMode, setResolvedMode] = useState<"first" | "second" | "shared" | null>(null);
  const [prompt] = useState(() => SHARED_PROMPTS[Math.floor(Math.random() * SHARED_PROMPTS.length)]);

  useEffect(() => {
    const t = setTimeout(() => setPhase("pulse"), 2400);
    return () => clearTimeout(t);
  }, []);

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
    const t = setTimeout(() => onDone(mode), 2600);
    return () => clearTimeout(t);
  }, [ignitionResult, userId, onDone]);

  const handleTap = () => {
    if (phase !== "pulse" || hasTapped) return;
    setHasTapped(true);
    onTap();
  };

  const r = 38;
  const circumference = 2 * Math.PI * r;
  const gapSize = 42;
  const dashArray = `${circumference - gapSize} ${gapSize}`;
  const closedDashArray = `${circumference} 0`;

  return (
    <motion.div
      className="flex-1 flex flex-col items-center justify-center gap-8 cursor-pointer select-none px-6"
      onClick={handleTap}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6 }}
      style={{ background: "hsl(220 13% 11%)" }}
    >
      {/* Partner info card */}
      <AnimatePresence>
        {partner && (phase === "forming" || phase === "pulse") && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-col items-center gap-3"
          >
            <Avatar name={partner.displayName} avatarUrl={partner.avatarUrl} size={56} />
            <div className="text-center">
              <p className="text-base font-serif text-white">{partner.displayName}</p>
              {partner.icebreaker && (
                <p
                  className="text-sm font-serif italic mt-1 max-w-xs"
                  style={{ color: "hsl(240 4% 60%)" }}
                >
                  "{partner.icebreaker}"
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Forming text */}
      <AnimatePresence mode="wait">
        {phase === "forming" && (
          <motion.p
            key="forming"
            className="font-mono text-xs uppercase tracking-widest"
            style={{ color: "hsl(240 4% 45%)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
          >
            A room is forming…
          </motion.p>
        )}
      </AnimatePresence>

      {/* Latch Pulse */}
      <AnimatePresence>
        {(phase === "pulse" || phase === "resolved") && (
          <motion.div
            key="pulse"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="relative flex items-center justify-center"
          >
            <motion.svg
              width="100"
              height="100"
              viewBox="0 0 100 100"
              className="overflow-visible"
              animate={
                phase === "pulse"
                  ? { scale: [1, 1.06, 1], opacity: [0.5, 0.85, 0.5] }
                  : { scale: 1, opacity: 1 }
              }
              transition={
                phase === "pulse"
                  ? { duration: 3.2, repeat: Infinity, ease: "easeInOut" }
                  : { duration: 0.5 }
              }
            >
              <motion.circle
                cx="50"
                cy="50"
                r={r}
                fill="none"
                stroke="hsl(211 100% 62%)"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeDashoffset={-gapSize / 2}
                animate={{
                  strokeDasharray: phase === "resolved" ? closedDashArray : dashArray,
                  opacity: phase === "resolved" ? 1 : 0.6,
                }}
                transition={{ duration: 0.7, ease: "easeInOut" }}
              />
            </motion.svg>

            <AnimatePresence>
              {phase === "resolved" && (
                <motion.div
                  className="absolute w-2 h-2 rounded-full"
                  style={{ background: "hsl(211 100% 62%)" }}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.4, delay: 0.3 }}
                />
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Resolved messages */}
      <AnimatePresence>
        {phase === "resolved" && (
          <motion.div
            className="text-center"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            {resolvedMode === "first" && (
              <p className="font-mono text-xs uppercase tracking-widest" style={{ color: "hsl(211 100% 72%)" }}>
                You are first in this room.
              </p>
            )}
            {resolvedMode === "shared" && (
              <p className="font-serif italic text-lg text-white text-center max-w-sm">
                {prompt}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tap hint */}
      <AnimatePresence>
        {phase === "pulse" && (
          <motion.p
            key={hasTapped ? "tapped" : "hint"}
            className="font-mono text-[11px] uppercase tracking-widest absolute bottom-16"
            style={{ color: hasTapped ? "hsl(211 100% 62%)" : "hsl(240 4% 32%)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, delay: hasTapped ? 0 : 4 }}
          >
            {hasTapped ? "present" : "tap to signal presence"}
          </motion.p>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
