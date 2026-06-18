import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useGetMyProfile, useUpdateMyProfile } from "@workspace/api-client-react";
import { getGetMyProfileQueryKey } from "@/lib/query-keys";
import { useAuth } from "@workspace/replit-auth-web";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { compressImage } from "@/lib/compress-image";
import { AuraPicker, ThemePickerInline, type AuraType } from "@/components/aura-ring";
import { useTheme, THEMES, type ThemeId } from "@/hooks/use-theme";

function Avatar({
  name,
  avatarUrl,
  size = 80,
}: {
  name: string;
  avatarUrl?: string | null;
  size?: number;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  if (avatarUrl && !imgFailed) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
        onError={() => setImgFailed(true)}
      />
    );
  }
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div
      className="rounded-full flex items-center justify-center font-mono font-semibold text-white select-none"
      style={{ width: size, height: size, fontSize: size * 0.32, background: "var(--accent)" }}
    >
      {initials}
    </div>
  );
}

export default function Settings() {
  const [, setLocation] = useLocation();
  const { logout } = useAuth();
  const queryClient = useQueryClient();
  const { theme, setTheme } = useTheme();

  const { data: profile } = useGetMyProfile({
    query: { queryKey: getGetMyProfileQueryKey() },
  });

  const [displayName, setDisplayName] = useState("");
  const [icebreaker, setIcebreaker] = useState("");
  const [aura, setAura] = useState<AuraType | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarData, setAvatarData] = useState<string | null>(null);
  const [compressing, setCompressing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [initialized, setInitialized] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const updateProfile = useUpdateMyProfile();

  useEffect(() => {
    if (profile && !initialized) {
      setDisplayName(profile.displayName ?? "");
      setIcebreaker(profile.icebreaker ?? "");
      setAvatarPreview(profile.avatarUrl ?? null);
      setAura((profile.aura as AuraType | null) ?? null);
      setInitialized(true);
    }
  }, [profile, initialized]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCompressing(true);
    try {
      const data = await compressImage(file);
      setAvatarPreview(data);
      setAvatarData(data);
    } catch {
      /* ignore */
    } finally {
      setCompressing(false);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const patch: {
      displayName?: string;
      icebreaker?: string;
      avatarUrl?: string;
      aura?: string | null;
    } = {};
    if (displayName.trim()) patch.displayName = displayName.trim();
    if (icebreaker.trim()) patch.icebreaker = icebreaker.trim();
    if (avatarData) patch.avatarUrl = avatarData;
    patch.aura = aura;

    updateProfile.mutate(
      { data: patch },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetMyProfileQueryKey() });
          setAvatarData(null);
          setSaved(true);
          setTimeout(() => setSaved(false), 2500);
        },
      }
    );
  };

  return (
    <div className="flex-1 flex flex-col min-h-0" style={{ background: "var(--surface-2)" }}>
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 pt-14 pb-3"
        style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}
      >
        <button
          onClick={() => setLocation("/room")}
          className="transition-opacity active:opacity-60 mr-1"
          aria-label="Back"
        >
          <svg width="9" height="15" viewBox="0 0 9 15" fill="none">
            <path
              d="M8 1L2 7.5 8 14"
              stroke="var(--accent)"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <h1 className="text-base font-mono font-semibold" style={{ color: "var(--foreground)" }}>
          Settings
        </h1>
      </div>

      <motion.form
        onSubmit={handleSave}
        className="flex-1 flex flex-col px-5 py-6 gap-6 max-w-md mx-auto w-full overflow-y-auto"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* Avatar */}
        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="relative group"
            disabled={compressing}
          >
            <Avatar
              name={displayName || profile?.displayName || "Me"}
              avatarUrl={avatarPreview}
              size={80}
            />
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
            Tap to change photo or GIF
          </p>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,image/gif"
            className="hidden"
            onChange={handleFile}
          />
        </div>

        {/* Theme picker */}
        <div className="flex flex-col gap-2">
          <label
            className="text-xs font-mono uppercase tracking-widest"
            style={{ color: "var(--muted)" }}
          >
            Theme
          </label>
          <ThemePickerInline
            themes={THEMES}
            value={theme}
            onChange={(t) => setTheme(t as ThemeId)}
          />
        </div>

        {/* Display name */}
        <div className="flex flex-col gap-1.5">
          <label
            className="text-xs font-mono uppercase tracking-widest"
            style={{ color: "var(--muted)" }}
          >
            Display name
          </label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your name"
            maxLength={50}
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
          <label
            className="text-xs font-mono uppercase tracking-widest"
            style={{ color: "var(--muted)" }}
          >
            Icebreaker / status
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
            Shown to your match at the top of the chat.
          </p>
        </div>

        {/* Aura picker */}
        <div className="flex flex-col gap-2">
          <label
            className="text-xs font-mono uppercase tracking-widest"
            style={{ color: "var(--muted)" }}
          >
            Aura <span style={{ color: "var(--border)" }}>— optional</span>
          </label>
          <AuraPicker value={aura} onChange={setAura} />
          <p className="text-xs font-mono" style={{ color: "var(--muted)" }}>
            Displayed as a ring around your avatar everywhere in the app.
          </p>
        </div>

        {/* Save error */}
        {updateProfile.isError && (
          <p className="text-xs font-mono" style={{ color: "#f38ba8" }}>
            Couldn't save changes — please try again.
          </p>
        )}

        {/* Save button */}
        <motion.button
          type="submit"
          disabled={updateProfile.isPending || compressing}
          animate={{ opacity: updateProfile.isPending || compressing ? 0.6 : 1 }}
          className="w-full py-3.5 rounded-lg font-mono text-sm font-medium text-white transition-colors"
          style={{ background: saved ? "#56d364" : "var(--accent)" }}
          whileTap={{ scale: 0.98 }}
        >
          {saved ? "Saved ✓" : updateProfile.isPending ? "Saving…" : "Save changes"}
        </motion.button>

        <div className="flex-1" />

        {/* Log out */}
        <button
          type="button"
          onClick={logout}
          className="w-full py-3 rounded-lg font-mono text-sm transition-opacity active:opacity-60"
          style={{
            color: "var(--muted)",
            border: "1px solid var(--border)",
            background: "transparent",
          }}
        >
          Log out
        </button>
      </motion.form>
    </div>
  );
}
