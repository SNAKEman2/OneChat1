import { useState } from "react";
import { useLocation } from "wouter";
import { useSetupProfile } from "@workspace/api-client-react";
import { motion } from "framer-motion";
import { useAuth } from "@workspace/replit-auth-web";

export default function Setup() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const [displayName, setDisplayName] = useState("");
  const [icebreaker, setIcebreaker] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  const setupProfile = useSetupProfile();

  if (!authLoading && !isAuthenticated) {
    setLocation("/");
    return null;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim() || !icebreaker.trim()) return;
    setupProfile.mutate(
      { data: { displayName, icebreaker, avatarUrl: avatarUrl || undefined } },
      { onSuccess: () => setLocation("/room") }
    );
  };

  const isReady = displayName.trim().length > 0 && icebreaker.trim().length > 0;

  return (
    <div className="flex-1 flex flex-col" style={{ background: "hsl(220 13% 11%)" }}>
      {/* Header */}
      <div
        className="px-5 pt-14 pb-6"
        style={{ borderBottom: "1px solid hsl(240 4% 22%)" }}
      >
        <h1 className="text-2xl font-serif font-medium text-white">
          Set up your profile
        </h1>
        <p className="text-sm mt-1" style={{ color: "hsl(240 4% 55%)" }}>
          This is how your match will see you today.
        </p>
      </div>

      <motion.form
        onSubmit={handleSubmit}
        className="flex-1 flex flex-col px-5 py-6 gap-5 max-w-lg w-full mx-auto"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        {/* Display name */}
        <div className="flex flex-col gap-1.5">
          <label
            className="text-xs font-mono uppercase tracking-widest"
            style={{ color: "hsl(240 4% 55%)" }}
          >
            Display name
          </label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your name"
            maxLength={50}
            autoFocus
            className="w-full px-4 py-3.5 rounded-xl text-white text-lg font-serif outline-none transition-all"
            style={{
              background: "hsl(240 5% 17%)",
              border: "1px solid hsl(240 4% 28%)",
            }}
            onFocus={(e) =>
              (e.target.style.borderColor = "hsl(211 100% 52%)")
            }
            onBlur={(e) =>
              (e.target.style.borderColor = "hsl(240 4% 28%)")
            }
          />
        </div>

        {/* Icebreaker */}
        <div className="flex flex-col gap-1.5">
          <label
            className="text-xs font-mono uppercase tracking-widest"
            style={{ color: "hsl(240 4% 55%)" }}
          >
            Icebreaker
          </label>
          <input
            type="text"
            value={icebreaker}
            onChange={(e) => setIcebreaker(e.target.value)}
            placeholder="Something about you…"
            maxLength={280}
            className="w-full px-4 py-3.5 rounded-xl text-white text-base font-serif outline-none transition-all"
            style={{
              background: "hsl(240 5% 17%)",
              border: "1px solid hsl(240 4% 28%)",
            }}
            onFocus={(e) =>
              (e.target.style.borderColor = "hsl(211 100% 52%)")
            }
            onBlur={(e) =>
              (e.target.style.borderColor = "hsl(240 4% 28%)")
            }
          />
          <p className="text-xs" style={{ color: "hsl(240 4% 40%)" }}>
            Your match sees this before the room opens.
          </p>
        </div>

        {/* Avatar URL */}
        <div className="flex flex-col gap-1.5">
          <label
            className="text-xs font-mono uppercase tracking-widest"
            style={{ color: "hsl(240 4% 55%)" }}
          >
            Avatar URL{" "}
            <span style={{ color: "hsl(240 4% 38%)" }}>(optional)</span>
          </label>
          <div className="flex gap-3 items-center">
            <input
              type="url"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://…"
              className="flex-1 px-4 py-3.5 rounded-xl text-white text-sm font-mono outline-none transition-all"
              style={{
                background: "hsl(240 5% 17%)",
                border: "1px solid hsl(240 4% 28%)",
              }}
              onFocus={(e) =>
                (e.target.style.borderColor = "hsl(211 100% 52%)")
              }
              onBlur={(e) =>
                (e.target.style.borderColor = "hsl(240 4% 28%)")
              }
            />
            {avatarUrl && (
              <motion.img
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                src={avatarUrl}
                alt="Preview"
                className="w-12 h-12 rounded-full object-cover flex-shrink-0"
                style={{ border: "2px solid hsl(240 4% 28%)" }}
                onError={(e) => (e.currentTarget.style.display = "none")}
              />
            )}
          </div>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Submit */}
        <motion.button
          type="submit"
          disabled={!isReady || setupProfile.isPending}
          animate={{ opacity: isReady ? 1 : 0.35 }}
          className="w-full py-4 rounded-xl text-white font-mono text-sm font-medium tracking-wide transition-opacity disabled:cursor-not-allowed"
          style={{ background: "hsl(211 100% 52%)" }}
        >
          {setupProfile.isPending ? "Creating profile…" : "Enter OneChat"}
        </motion.button>
      </motion.form>
    </div>
  );
}
