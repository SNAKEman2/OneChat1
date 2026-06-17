import { useLocation } from "wouter";
import { useGetMatchArchive, useGetMyProfile } from "@workspace/api-client-react";
import { getGetMatchArchiveQueryKey, getGetMyProfileQueryKey } from "@/lib/query-keys";
import { motion } from "framer-motion";
import { format, isToday, isYesterday, parseISO } from "date-fns";

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
  size = 48,
  colorVar = "hsl(211 60% 38%)",
}: {
  name: string;
  avatarUrl?: string | null;
  size?: number;
  colorVar?: string;
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
        fontSize: size * 0.35,
        background: colorVar,
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
      style={{ background: "hsl(220 13% 11%)" }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 pt-14 pb-4"
        style={{ borderBottom: "1px solid hsl(240 4% 22%)" }}
      >
        <div className="flex items-center gap-3">
          {/* Tappable own avatar → Settings (Item 7) */}
          {myProfile && (
            <button
              onClick={() => setLocation("/settings")}
              className="flex-shrink-0 transition-opacity active:opacity-70"
              aria-label="Open settings"
            >
              <Avatar
                name={myProfile.displayName}
                avatarUrl={myProfile.avatarUrl}
                size={32}
                colorVar="var(--accent)"
              />
            </button>
          )}
          <h1 className="text-2xl font-serif font-medium text-white">Memories</h1>
        </div>
        <button
          onClick={() => setLocation("/room")}
          className="text-sm font-mono"
          style={{ color: "hsl(211 100% 62%)" }}
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
                  style={{ background: "hsl(240 4% 40%)" }}
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
              style={{ background: "hsl(240 5% 17%)" }}
            >
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <path
                  d="M14 2C7.373 2 2 7.373 2 14s5.373 12 12 12 12-5.373 12-12S20.627 2 14 2z"
                  stroke="hsl(240 4% 55%)"
                  strokeWidth="1.5"
                  fill="none"
                />
                <path
                  d="M9 14h10M14 9v10"
                  stroke="hsl(240 4% 55%)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <p className="text-base font-serif" style={{ color: "hsl(240 4% 55%)" }}>
              No past conversations yet.
            </p>
            <p className="text-sm mt-1 font-mono" style={{ color: "hsl(240 4% 38%)" }}>
              Your memories will appear here.
            </p>
          </div>
        )}

        {!isLoading &&
          archive?.map((match, index) => (
            <motion.button
              key={match.matchId}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: index * 0.04, duration: 0.3 }}
              onClick={() => setLocation(`/gallery/${match.matchId}`)}
              className="w-full flex items-center gap-4 px-5 py-4 text-left transition-colors active:opacity-70"
              style={{ borderBottom: "1px solid hsl(240 4% 16%)" }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "hsl(240 5% 15%)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "transparent")
              }
            >
              <Avatar name={match.partnerName} avatarUrl={match.partnerAvatarUrl} />

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-serif text-base font-medium text-white truncate">
                    {match.partnerName}
                  </span>
                  <span
                    className="text-xs font-mono flex-shrink-0"
                    style={{ color: "hsl(240 4% 45%)" }}
                  >
                    {formatMatchDate(match.matchDate)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 mt-0.5">
                  <p
                    className="text-sm font-serif truncate italic"
                    style={{ color: "hsl(240 4% 55%)" }}
                  >
                    {match.firstMessage || "No messages"}
                  </p>
                  {match.messageCount > 0 && (
                    <span
                      className="text-[10px] font-mono flex-shrink-0"
                      style={{ color: "hsl(240 4% 38%)" }}
                    >
                      {match.messageCount} msg
                    </span>
                  )}
                </div>
              </div>
            </motion.button>
          ))}
      </div>
    </div>
  );
}
