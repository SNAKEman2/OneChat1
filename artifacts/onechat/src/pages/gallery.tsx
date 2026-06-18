import { useLocation } from "wouter";
import { useGetMatchArchive, useGetMyProfile } from "@workspace/api-client-react";
import { getGetMatchArchiveQueryKey, getGetMyProfileQueryKey } from "@/lib/query-keys";
import { motion } from "framer-motion";
import { format, isToday, isYesterday, parseISO } from "date-fns";
import { AuraRing } from "@/components/aura-ring";

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
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className="rounded-full object-cover flex-shrink-0"
        style={{ width: size, height: size }}
        onError={(e) => (e.currentTarget.style.display = "none")}
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

  const { data: archive, isLoading } = useGetMatchArchive({
    query: { queryKey: getGetMatchArchiveQueryKey() },
  });

  const { data: myProfile } = useGetMyProfile({
    query: { queryKey: getGetMyProfileQueryKey() },
  });

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
          {myProfile && (
            <button
              onClick={() => setLocation("/settings")}
              className="flex-shrink-0 transition-opacity active:opacity-70"
              aria-label="Open settings"
            >
              <AuraRing aura={myProfile.aura} size={32} ringWidth={2}>
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
                <AuraRing aura={match.partnerAura} size={56} ringWidth={3}>
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
    </div>
  );
}
