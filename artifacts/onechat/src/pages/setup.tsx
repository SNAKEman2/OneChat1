import { useRef, useState } from "react";
import { useLocation } from "wouter";
import { useSetupProfile } from "@workspace/api-client-react";
import { motion } from "framer-motion";
import { useAuth } from "@workspace/replit-auth-web";
import { compressImage } from "@/lib/compress-image";

export default function Setup() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const [displayName, setDisplayName] = useState("");
  const [icebreaker, setIcebreaker] = useState("");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarData, setAvatarData] = useState<string | null>(null);
  const [compressing, setCompressing] = useState(false);
  const [avatarError, setAvatarError] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const setupProfile = useSetupProfile();

  if (!authLoading && !isAuthenticated) {
    setLocation("/");
    return null;
  }

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCompressing(true);
    setAvatarError(false);
    try {
      const data = await compressImage(file);
      setAvatarPreview(data);
      setAvatarData(data);
    } catch {
      /* ignore compression errors */
    } finally {
      setCompressing(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim() || !icebreaker.trim()) return;
    setupProfile.mutate(
      { data: { displayName, icebreaker, avatarUrl: avatarData ?? undefined } },
      { onSuccess: () => setLocation("/room") }
    );
  };

  const isReady = displayName.trim().length > 0 && icebreaker.trim().length > 0;

  return (
    <div className="flex-1 flex flex-col min-h-0" style={{ background: "var(--surface-2)" }}>
      {/* Header */}
      <div
        className="px-5 pt-14 pb-5"
        style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}
      >
        <h1 className="text-xl font-mono font-medium" style={{ color: "var(--foreground)" }}>
          Create your profile
        </h1>
        <p className="text-sm mt-1 font-mono" style={{ color: "var(--muted)" }}>
          Your match sees this before the room opens.
        </p>
      </div>

      <motion.form
        onSubmit={handleSubmit}
        className="flex-1 flex flex-col px-5 py-6 gap-6 max-w-md mx-auto w-full"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        {/* Avatar picker */}
        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="relative group"
            disabled={compressing}
          >
            {avatarPreview ? (
              <img
                src={avatarPreview}
                alt="Avatar"
                className="w-24 h-24 rounded-full object-cover"
                style={{ border: "3px solid var(--accent)" }}
              />
            ) : (
              <div
                className="w-24 h-24 rounded-full flex flex-col items-center justify-center gap-1 transition-colors"
                style={{ background: "var(--input-bg)", border: "2px dashed var(--border)" }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 5v14M5 12h14"
                    stroke="var(--muted)"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
                <span className="text-[10px] font-mono" style={{ color: "var(--muted)" }}>
                  Photo / GIF
                </span>
              </div>
            )}
            {compressing && (
              <div
                className="absolute inset-0 rounded-full flex items-center justify-center"
                style={{ background: "rgba(0,0,0,0.6)" }}
              >
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            <div
              className="absolute bottom-0 right-0 w-7 h-7 rounded-full flex items-center justify-center"
              style={{ background: "var(--accent)" }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path
                  d="M8.5 1.5a1.5 1.5 0 012.12 2.12L4 10.25l-2.75.5.5-2.75L8.5 1.5z"
                  stroke="white"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </button>

          <p className="text-xs font-mono" style={{ color: "var(--muted)" }}>
            {avatarPreview ? "Tap to change" : "Upload a photo or GIF"}
          </p>

          {/* Upload error message (Item 1) */}
          {(setupProfile.isError && avatarData) || avatarError ? (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xs font-mono text-center px-2"
              style={{ color: "#f38ba8" }}
            >
              That file is too large or couldn't be uploaded — try a smaller image or GIF.
            </motion.p>
          ) : null}

          {setupProfile.isError && !avatarData && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xs font-mono text-center px-2"
              style={{ color: "#f38ba8" }}
            >
              Something went wrong — please try again.
            </motion.p>
          )}

          <input
            ref={fileRef}
            type="file"
            accept="image/*,image/gif"
            className="hidden"
            onChange={handleFile}
          />
        </div>

        {/* Display name */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-mono uppercase tracking-widest" style={{ color: "var(--muted)" }}>
            Display name
          </label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your name"
            maxLength={50}
            autoFocus
            className="w-full px-4 py-3 text-base font-mono rounded-lg outline-none transition-all"
            style={{
              background: "var(--input-bg)",
              color: "var(--foreground)",
              border: "1px solid var(--border)",
            }}
            onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
            onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
          />
        </div>

        {/* Icebreaker */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-mono uppercase tracking-widest" style={{ color: "var(--muted)" }}>
            Icebreaker
          </label>
          <input
            type="text"
            value={icebreaker}
            onChange={(e) => setIcebreaker(e.target.value)}
            placeholder="Something about you or a question…"
            maxLength={280}
            className="w-full px-4 py-3 text-base font-mono rounded-lg outline-none transition-all"
            style={{
              background: "var(--input-bg)",
              color: "var(--foreground)",
              border: "1px solid var(--border)",
            }}
            onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
            onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
          />
          <p className="text-xs font-mono" style={{ color: "var(--muted)" }}>
            Pinned at the top of your chat as a status.
          </p>
        </div>

        <div className="flex-1" />

        <motion.button
          type="submit"
          disabled={!isReady || setupProfile.isPending || compressing}
          animate={{ opacity: isReady ? 1 : 0.3 }}
          className="w-full py-3.5 rounded-lg font-mono text-sm font-medium text-white disabled:cursor-not-allowed transition-opacity"
          style={{ background: "var(--accent)" }}
          whileTap={{ scale: 0.98 }}
        >
          {setupProfile.isPending ? "Creating…" : "Enter OneChat →"}
        </motion.button>
      </motion.form>
    </div>
  );
}
