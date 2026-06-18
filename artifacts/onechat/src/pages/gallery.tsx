import { useState } from "react";
import { useLocation } from "wouter";
import { useGetMatchArchive, useGetMyProfile } from "@workspace/api-client-react";
import { getGetMatchArchiveQueryKey, getGetMyProfileQueryKey } from "@/lib/query-keys";
import { motion } from "framer-motion";
import { format, isToday, isYesterday, parseISO } from "date-fns";
import { AuraRing } from "@/components/aura-ring";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useTheme, THEMES, type ThemeId } from "@/hooks/use-theme";
import { ThemePickerInline } from "@/components/aura-ring";

function formatMatchDate(dateStr: string) {
  try {
    const d = parseISO(dateStr);
    if (isToday(d)) return "Today";
    if (isYesterday(d)) return "Yesterday";
    return format(d, "MMM d");
  } catch {
    return dateStr;
  }
}

function Avatar({
  name,
  avatarUrl,
  size = 56,
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
        className="rounded-full object-cover flex-shrink-0"
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
      className="rounded-full flex items-center justify-center flex-shrink-0 text-white font-mono font-medium"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.33,
        background: "var(--accent)",
      }}
    >
      {initials}
    </div>
  );
}

export default function Gallery() {
  const [, setLocation] = useLocation();
  const [ownSheetOpen, setOwnSheetOpen] = useState(false);
  const { theme, setTheme } = useTheme();

  const { data: archive, isLoading } = useGetMatchArchive({
    query: { queryKey: getGetMatchArchiveQueryKey() },
  });

  const { data: myProfile } = useGetMyProfile({
    query: { queryKey: getGetMyProfileQueryKey() },
  });

  const myName = myProfile?.displayName ?? "You";

  return (
    <div
      className="flex-1 flex flex-col h-full"
      style={{ background: "var(--surface-2)" }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 pt-14 pb-4"
        style={{
          background: "var(--surface)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div className="flex items-center gap-3">
          {/* Section E — own avatar opens own profile sheet */}
          {myProfile && (
            <button
              onClick={() => setOwnSheetOpen(true)}
              className="flex-shrink-0 transition-opacity active:opacity-70"
              aria-label="View your profile"
            >
              <AuraRing aura={myProfile.aura} size={32} ringWidth={4}>
                <Avatar name={myProfile.displayName} avatarUrl={myProfile.avatarUrl} size={32} />
              </AuraRing>
            </button>
          )}
          <h1 className="text-2xl font-serif font-medium" style={{ color: "var(--foreground)" }}>
            Memories
          </h1>
        </div>
        <button
          onClick={() => setLocation("/room")}
          className="text-sm font-mono transition-opacity active:opacity-60"
          style={{ color: "var(--accent)" }}
        >
          Today
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto hide-scrollbar">
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <div className="flex gap-1.5">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: "var(--muted)" }}
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                />
              ))}
            </div>
          </div>
        )}

        {!isLoading && archive?.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 px-8 text-center">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
              style={{ background: "var(--surface)" }}
            >
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <path
                  d="M14 2C7.373 2 2 7.373 2 14s5.373 12 12 12 12-5.373 12-12S20.627 2 14 2z"
                  stroke="var(--muted)"
                  strokeWidth="1.5"
                  fill="none"
                />
                <path
                  d="M9 14h10M14 9v10"
                  stroke="var(--muted)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <p className="text-base font-serif" style={{ color: "var(--muted)" }}>
              No past conversations yet.
            </p>
            <p className="text-sm mt-1 font-mono" style={{ color: "var(--muted)", opacity: 0.6 }}>
              People you've met will appear here.
            </p>
          </div>
        )}

        {!isLoading &&
          archive?.map((match, index) => (
            <motion.button
              key={match.matchId}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04, duration: 0.3 }}
              onClick={() => setLocation(`/gallery/${match.matchId}`)}
              className="w-full flex items-center gap-4 px-5 py-4 text-left transition-colors active:opacity-70"
              style={{ borderBottom: "1px solid var(--border)" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              {/* Avatar with aura ring */}
              <div className="flex-shrink-0">
                <AuraRing aura={match.partnerAura} size={56} ringWidth={4}>
                  <Avatar
                    name={match.partnerName}
                    avatarUrl={match.partnerAvatarUrl}
                    size={56}
                  />
                </AuraRing>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2 mb-0.5">
                  <span
                    className="font-serif text-lg font-medium truncate"
                    style={{ color: "var(--foreground)" }}
                  >
                    {match.partnerName}
                  </span>
                  <span
                    className="text-xs font-mono flex-shrink-0"
                    style={{ color: "var(--muted)" }}
                  >
                    {formatMatchDate(match.matchDate)}
                  </span>
                </div>

                {/* Icebreaker (primary content) */}
                <p
                  className="text-sm font-serif italic truncate leading-snug"
                  style={{ color: match.partnerIcebreaker ? "var(--muted)" : "var(--border)" }}
                >
                  {match.partnerIcebreaker
                    ? `"${match.partnerIcebreaker}"`
                    : "No icebreaker"}
                </p>

                {/* Message count */}
                {match.messageCount > 0 && (
                  <span
                    className="text-[10px] font-mono mt-1 inline-block"
                    style={{ color: "var(--border)" }}
                  >
                    {match.messageCount} {match.messageCount === 1 ? "message" : "messages"}
                  </span>
                )}
              </div>
            </motion.button>
          ))}
      </div>

      {/* Section E — Own profile sheet */}
      <DialogPrimitive.Root open={ownSheetOpen} onOpenChange={setOwnSheetOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay
            className="fixed inset-0 z-40 bg-black/50"
            style={{ backdropFilter: "blur(2px)" }}
          />
          <DialogPrimitive.Content
            aria-describedby={undefined}
            style={{
              position: "fixed",
              bottom: 0,
              left: 0,
              right: 0,
              zIndex: 50,
              background: "var(--surface)",
              borderTop: "1px solid var(--border)",
              borderRadius: "24px 24px 0 0",
              maxHeight: "70vh",
              overflowY: "auto",
              padding: "20px 24px 48px",
            }}
          >
            <DialogPrimitive.Title className="sr-only">Your profile</DialogPrimitive.Title>
            <div
              className="w-10 h-1 rounded-full mx-auto mb-6"
              style={{ background: "var(--border)" }}
            />

            <div className="flex flex-col items-center gap-4 mb-6">
              <AuraRing aura={myProfile?.aura} size={80} ringWidth={4}>
                <Avatar name={myName} avatarUrl={myProfile?.avatarUrl} size={80} />
              </AuraRing>
              <div className="text-center">
                <p className="font-mono font-semibold text-lg" style={{ color: "var(--my-name, var(--accent))" }}>
                  {myName}
                </p>
                {myProfile?.icebreaker && (
                  <p
                    className="text-sm font-serif italic mt-2 leading-relaxed px-2 max-w-xs"
                    style={{ color: "var(--foreground)" }}
                  >
                    "{myProfile.icebreaker}"
                  </p>
                )}
              </div>
            </div>

            {/* Inline theme picker */}
            <div className="mb-5">
              <p className="text-xs font-mono uppercase tracking-widest mb-2" style={{ color: "var(--muted)" }}>
                Theme
              </p>
              <ThemePickerInline
                themes={THEMES}
                value={theme}
                onChange={(t) => setTheme(t as ThemeId)}
              />
            </div>

            {/* Settings shortcut */}
            <button
              onClick={() => {
                setOwnSheetOpen(false);
                setLocation("/settings?from=/gallery");
              }}
              className="w-full flex items-center justify-between py-3 font-mono text-sm transition-opacity active:opacity-60"
              style={{ color: "var(--accent)", borderTop: "1px solid var(--border)" }}
            >
              <span>Full settings</span>
              <svg width="8" height="13" viewBox="0 0 8 13" fill="none">
                <path d="M1 1l6 5.5L1 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

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
    </div>
  );
}
