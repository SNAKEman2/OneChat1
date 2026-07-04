import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useGetMatchArchive, useGetMyProfile, type ArchivedMatch } from "@workspace/api-client-react";
import { getGetMatchArchiveQueryKey, getGetMyProfileQueryKey } from "@/lib/query-keys";
import { motion, AnimatePresence } from "framer-motion";
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

function formatDuration(minutes: number | null | undefined): string | null {
  if (minutes == null || minutes < 1) return null;
  if (minutes < 60) return `${minutes}m conversation`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m conversation` : `${h}h conversation`;
}

function Avatar({ name, avatarUrl, size = 56 }: { name: string; avatarUrl?: string | null; size?: number }) {
  const [imgFailed, setImgFailed] = useState(false);
  if (avatarUrl && !imgFailed) {
    return (
      <img src={avatarUrl} alt={name} className="rounded-full object-cover flex-shrink-0"
        style={{ width: size, height: size }} onError={() => setImgFailed(true)} />
    );
  }
  const initials = name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div className="rounded-full flex items-center justify-center flex-shrink-0 text-white font-mono font-medium"
      style={{ width: size, height: size, fontSize: size * 0.33, background: "var(--accent)" }}>
      {initials}
    </div>
  );
}

// Skeleton card for loading state (H — loading skeletons)
function SkeletonCard() {
  return (
    <div className="flex items-center gap-4 px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
      <div className="rounded-full flex-shrink-0 animate-pulse" style={{ width: 56, height: 56, background: "var(--surface)" }} />
      <div className="flex-1 flex flex-col gap-2">
        <div className="rounded animate-pulse" style={{ height: 14, width: "55%", background: "var(--surface)" }} />
        <div className="rounded animate-pulse" style={{ height: 11, width: "80%", background: "var(--surface)" }} />
        <div className="rounded animate-pulse" style={{ height: 10, width: "30%", background: "var(--surface)" }} />
      </div>
    </div>
  );
}

export default function Gallery() {
  const [, setLocation] = useLocation();
  const [ownSheetOpen, setOwnSheetOpen] = useState(false);
  const { theme, setTheme } = useTheme();

  // C2 — search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // C3 — pagination
  const [page, setPage] = useState(1);
  const [allItems, setAllItems] = useState<ArchivedMatch[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const LIMIT = 20;

  const { data: archive, isLoading, isFetching } = useGetMatchArchive(
    { q: searchQuery || undefined, page, limit: LIMIT },
    {
      query: {
        queryKey: [...getGetMatchArchiveQueryKey(), searchQuery, page],
      },
    }
  );

  const { data: myProfile } = useGetMyProfile({
    query: { queryKey: getGetMyProfileQueryKey() },
  });

  const myName = myProfile?.displayName ?? "You";

  // Accumulate pages for infinite scroll (reset on search change)
  useEffect(() => {
    if (page === 1) setAllItems([]);
  }, [searchQuery]);

  useEffect(() => {
    if (!archive) return;
    if (page === 1) {
      setAllItems(archive);
    } else {
      setAllItems((prev) => {
        const existingIds = new Set(prev.map((m) => m.matchId));
        const newItems = archive.filter((m) => !existingIds.has(m.matchId));
        return [...prev, ...newItems];
      });
    }
    setHasMore(archive.length === LIMIT);
  }, [archive, page]);

  // Reset to page 1 when search changes
  useEffect(() => {
    setPage(1);
  }, [searchQuery]);

  // C3 — Intersection observer for lazy loading
  useEffect(() => {
    if (!loadMoreRef.current || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isFetching && hasMore) {
          setPage((p) => p + 1);
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [hasMore, isFetching]);

  // E4 — keyboard shortcut: / to focus search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const displayItems = allItems;

  return (
    <div className="flex-1 flex flex-col h-full" style={{ background: "var(--surface-2)" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-14 pb-4"
        style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center gap-3">
          {myProfile && (
            <button onClick={() => setOwnSheetOpen(true)} className="flex-shrink-0 transition-opacity active:opacity-70"
              aria-label="View your profile">
              <AuraRing aura={myProfile.aura} size={32} ringWidth={4}>
                <Avatar name={myProfile.displayName} avatarUrl={myProfile.avatarUrl} size={32} />
              </AuraRing>
            </button>
          )}
          <h1 className="text-2xl font-serif font-medium" style={{ color: "var(--foreground)" }}>Memories</h1>
        </div>
        <button onClick={() => setLocation("/room")} className="text-sm font-mono transition-opacity active:opacity-60"
          style={{ color: "var(--accent)" }} aria-label="Go to today's room">
          Today
        </button>
      </div>

      {/* C2 — Search bar */}
      <div className="px-4 py-2.5" style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all ${searchFocused ? "outline outline-1 outline-[var(--accent)]" : ""}`}
          style={{ background: "var(--surface-2)" }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="flex-shrink-0">
            <circle cx="6" cy="6" r="4.5" stroke="var(--muted)" strokeWidth="1.2" />
            <path d="M9.5 9.5L13 13" stroke="var(--muted)" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          <input
            ref={searchRef}
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            placeholder="Search by name, icebreaker, keywords… (/)"
            className="flex-1 bg-transparent text-sm font-mono outline-none"
            style={{ color: "var(--foreground)" }}
            aria-label="Search memories"
          />
          <AnimatePresence>
            {searchQuery && (
              <motion.button initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
                onClick={() => setSearchQuery("")} className="flex-shrink-0 transition-opacity active:opacity-60"
                style={{ color: "var(--muted)" }} aria-label="Clear search">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto hide-scrollbar" role="list" aria-label="Past conversations">
        {/* H — Loading skeletons */}
        {isLoading && page === 1 && (
          <div>
            {[0, 1, 2, 3].map((i) => <SkeletonCard key={i} />)}
          </div>
        )}

        {/* H — Empty state */}
        {!isLoading && displayItems.length === 0 && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-24 px-8 text-center">
            {searchQuery ? (
              <>
                <div className="w-14 h-14 rounded-full flex items-center justify-center mb-4"
                  style={{ background: "var(--surface)" }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <circle cx="10" cy="10" r="7" stroke="var(--muted)" strokeWidth="1.5" />
                    <path d="M15.5 15.5L21 21" stroke="var(--muted)" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </div>
                <p className="text-base font-serif" style={{ color: "var(--muted)" }}>No results for "{searchQuery}"</p>
                <button onClick={() => setSearchQuery("")} className="text-sm font-mono mt-3 transition-opacity active:opacity-70"
                  style={{ color: "var(--accent)" }}>Clear search</button>
              </>
            ) : (
              <>
                <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
                  style={{ background: "var(--surface)" }}>
                  <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                    <path d="M14 2C7.373 2 2 7.373 2 14s5.373 12 12 12 12-5.373 12-12S20.627 2 14 2z"
                      stroke="var(--muted)" strokeWidth="1.5" fill="none" />
                    <path d="M9 14h10M14 9v10" stroke="var(--muted)" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </div>
                <p className="text-base font-serif" style={{ color: "var(--muted)" }}>No past conversations yet.</p>
                <p className="text-sm mt-1 font-mono" style={{ color: "var(--muted)", opacity: 0.6 }}>
                  People you've met will appear here.
                </p>
              </>
            )}
          </motion.div>
        )}

        {displayItems.map((match, index) => {
          const duration = formatDuration((match as any).conversationDuration);
          return (
            <motion.button
              key={match.matchId}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(index * 0.03, 0.2), duration: 0.25 }}
              onClick={() => setLocation(`/gallery/${match.matchId}`)}
              className="w-full flex items-center gap-4 px-5 py-4 text-left transition-colors active:opacity-70"
              style={{ borderBottom: "1px solid var(--border)" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              role="listitem"
              aria-label={`Conversation with ${match.partnerName} on ${formatMatchDate(match.matchDate)}`}
            >
              {/* C1 — Avatar with aura ring */}
              <div className="flex-shrink-0">
                <AuraRing aura={match.partnerAura} size={56} ringWidth={4}>
                  <Avatar name={match.partnerName} avatarUrl={match.partnerAvatarUrl} size={56} />
                </AuraRing>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2 mb-0.5">
                  <span className="font-serif text-lg font-medium truncate" style={{ color: "var(--foreground)" }}>
                    {match.partnerName}
                  </span>
                  <span className="text-xs font-mono flex-shrink-0" style={{ color: "var(--muted)" }}>
                    {formatMatchDate(match.matchDate)}
                  </span>
                </div>

                {/* C1 — Icebreaker */}
                {match.partnerIcebreaker && (
                  <p className="text-sm font-serif italic truncate leading-snug" style={{ color: "var(--muted)" }}>
                    "{match.partnerIcebreaker}"
                  </p>
                )}

                {/* C1 — Message count + conversation duration */}
                <div className="flex items-center gap-3 mt-1">
                  {match.messageCount > 0 && (
                    <span className="text-[10px] font-mono" style={{ color: "var(--border)" }}>
                      {match.messageCount} {match.messageCount === 1 ? "message" : "messages"}
                    </span>
                  )}
                  {duration && (
                    <span className="text-[10px] font-mono" style={{ color: "var(--border)" }}>
                      · {duration}
                    </span>
                  )}
                  {match.status === "blocked" && (
                    <span className="text-[10px] font-mono" style={{ color: "#DC2626", opacity: 0.7 }}>
                      · blocked
                    </span>
                  )}
                </div>
              </div>
            </motion.button>
          );
        })}

        {/* C3 — Infinite scroll sentinel */}
        <div ref={loadMoreRef} className="h-8 flex items-center justify-center">
          <AnimatePresence>
            {isFetching && page > 1 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex gap-1.5">
                {[0, 1, 2].map((i) => (
                  <motion.div key={i} className="w-1 h-1 rounded-full"
                    style={{ background: "var(--muted)" }}
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }} />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Own profile sheet */}
      <DialogPrimitive.Root open={ownSheetOpen} onOpenChange={setOwnSheetOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/50"
            style={{ backdropFilter: "blur(2px)" }} />
          <DialogPrimitive.Content aria-describedby={undefined}
            style={{
              position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50,
              background: "var(--surface)", borderTop: "1px solid var(--border)",
              borderRadius: "24px 24px 0 0", maxHeight: "70vh", overflowY: "auto",
              padding: "20px 24px 48px",
            }}>
            <DialogPrimitive.Title className="sr-only">Your profile</DialogPrimitive.Title>
            <div className="w-10 h-1 rounded-full mx-auto mb-6" style={{ background: "var(--border)" }} />
            <div className="flex flex-col items-center gap-4 mb-6">
              <AuraRing aura={myProfile?.aura} size={80} ringWidth={4}>
                <Avatar name={myName} avatarUrl={myProfile?.avatarUrl} size={80} />
              </AuraRing>
              <div className="text-center">
                <p className="font-mono font-semibold text-lg" style={{ color: "var(--my-name, var(--accent))" }}>
                  {myName}
                </p>
                {myProfile?.icebreaker && (
                  <p className="text-sm font-serif italic mt-2 leading-relaxed px-2 max-w-xs"
                    style={{ color: "var(--foreground)" }}>
                    "{myProfile.icebreaker}"
                  </p>
                )}
              </div>
            </div>
            <div className="mb-5">
              <p className="text-xs font-mono uppercase tracking-widest mb-2" style={{ color: "var(--muted)" }}>Theme</p>
              <ThemePickerInline themes={THEMES} value={theme} onChange={(t) => setTheme(t as ThemeId)} />
            </div>
            <button
              onClick={() => { setOwnSheetOpen(false); setLocation("/settings?from=/gallery"); }}
              className="w-full flex items-center justify-between py-3 font-mono text-sm transition-opacity active:opacity-60"
              style={{ color: "var(--accent)", borderTop: "1px solid var(--border)" }}>
              <span>Full settings</span>
              <svg width="8" height="13" viewBox="0 0 8 13" fill="none">
                <path d="M1 1l6 5.5L1 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <DialogPrimitive.Close className="absolute top-4 right-5 transition-opacity active:opacity-60"
              style={{ color: "var(--muted)" }} aria-label="Close">
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
