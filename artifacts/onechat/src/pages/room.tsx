import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation } from "wouter";
import {
  useGetTodayMatch,
  useGetMatchMessages,
  useSendMessage,
  useEndMatch,
  useUpdateMyProfile,
  useGetMyProfile,
  type Message,
} from "@workspace/api-client-react";
import {
  getGetTodayMatchQueryKey,
  getGetMatchMessagesQueryKey,
  getGetMyProfileQueryKey,
} from "@/lib/query-keys";
import { useWebsocket } from "@/hooks/use-websocket";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useAuth } from "@workspace/replit-auth-web";
import Ignition from "@/components/ignition";
import { format } from "date-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { AuraRing } from "@/components/aura-ring";
import { ThemePickerInline } from "@/components/aura-ring";
import { useTheme, THEMES, type ThemeId } from "@/hooks/use-theme";
import { ReportDialog } from "@/components/report-dialog";
import { MediaViewer } from "@/components/media-viewer";
import { useQueryClient } from "@tanstack/react-query";
import { useUpload } from "@workspace/object-storage-web";

/* ─── Avatar ─────────────────────────────────────────────────── */
function Avatar({
  name,
  avatarUrl,
  size = 40,
  colorVar = "var(--accent)",
}: {
  name: string;
  avatarUrl?: string | null;
  size?: number;
  colorVar?: string;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  if (avatarUrl && !imgFailed) {
    return (
      <img src={avatarUrl} alt={name} className="rounded-full object-cover flex-shrink-0"
        style={{ width: size, height: size }} onError={() => setImgFailed(true)} />
    );
  }
  const initials = name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div className="rounded-full flex items-center justify-center flex-shrink-0 font-mono font-semibold text-white select-none"
      style={{ width: size, height: size, fontSize: size * 0.32, background: colorVar }}>
      {initials}
    </div>
  );
}

/* ─── Message skeleton (H) ───────────────────────────────────── */
function MessageSkeleton({ isMe }: { isMe: boolean }) {
  return (
    <div className={`flex gap-3 mb-4 ${isMe ? "flex-row-reverse" : "flex-row"}`}>
      <div className="rounded-full flex-shrink-0 animate-pulse" style={{ width: 40, height: 40, background: "var(--surface)" }} />
      <div className="flex flex-col gap-1.5">
        <div className="rounded animate-pulse" style={{ height: 12, width: 80, background: "var(--surface)" }} />
        <div className="rounded animate-pulse" style={{ height: 18, width: isMe ? 140 : 200, background: "var(--surface)" }} />
        <div className="rounded animate-pulse" style={{ height: 14, width: isMe ? 100 : 160, background: "var(--surface)" }} />
      </div>
    </div>
  );
}

/* ─── Root ───────────────────────────────────────────────────── */
export default function Room() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  const { data: profile } = useGetMyProfile({
    query: { queryKey: getGetMyProfileQueryKey() },
  });

  const { data: matchState, isLoading: matchLoading } = useGetTodayMatch({
    query: {
      enabled: true,
      queryKey: getGetTodayMatchQueryKey(),
      refetchInterval: (q) => (q.state.data?.status === "waiting" ? 8000 : false),
    },
  });

  useEffect(() => {
    if (matchState?.status === "no_profile") setLocation("/setup");
  }, [matchState, setLocation]);

  if (matchLoading) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ background: "var(--background)" }}>
        <div className="flex gap-1.5" role="status" aria-label="Loading">
          {[0, 1, 2].map((i) => (
            <motion.div key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--muted)" }}
              animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }} />
          ))}
        </div>
      </div>
    );
  }

  if (matchState?.status === "waiting") return <Lounge profile={profile} />;
  if (matchState?.status === "ended" || matchState?.status === "blocked")
    return <EndedRoom matchState={matchState} />;
  if (matchState?.status === "active" && matchState.matchId) {
    return <ActiveRoom matchState={matchState} userId={user?.id ?? ""} myProfile={profile} />;
  }
  return null;
}

/* ─── Lounge ─────────────────────────────────────────────────── */
function Lounge({ profile }: { profile: any }) {
  const [, setLocation] = useLocation();
  const [icebreaker, setIcebreaker] = useState(profile?.icebreaker ?? "");
  const [editing, setEditing] = useState(false);
  const [ownSheetOpen, setOwnSheetOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const updateProfile = useUpdateMyProfile();
  const myName = profile?.displayName ?? "You";

  const save = () => {
    if (icebreaker.trim() && icebreaker !== profile?.icebreaker) {
      updateProfile.mutate({ data: { icebreaker: icebreaker.trim() } });
    }
    setEditing(false);
  };

  return (
    <div className="flex-1 flex flex-col" style={{ background: "var(--surface-2)" }}>
      <div className="flex items-center justify-between px-4 pt-14 pb-3"
        style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center gap-3">
          {profile && (
            <button onClick={() => setOwnSheetOpen(true)} className="flex-shrink-0 transition-opacity active:opacity-70"
              aria-label="View your profile">
              <AuraRing aura={profile.aura} size={36} ringWidth={4}>
                <Avatar name={myName} avatarUrl={profile.avatarUrl} size={36} colorVar="var(--accent)" />
              </AuraRing>
            </button>
          )}
          <div>
            <p className="text-sm font-mono font-medium" style={{ color: "var(--foreground)" }}>{myName}</p>
            <p className="text-xs font-mono" style={{ color: "var(--muted)" }}>OneChat</p>
          </div>
        </div>
        <button onClick={() => setLocation("/gallery")} className="text-xs font-mono transition-opacity active:opacity-60"
          style={{ color: "var(--accent)" }} aria-label="View memories">
          Memories
        </button>
      </div>

      <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border)", background: "var(--background)" }}>
        <p className="text-xs font-mono" style={{ color: "var(--muted)" }}># waiting-room</p>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6">
        <motion.div animate={{ scale: [1, 1.05, 1], opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          className="w-14 h-14 rounded-full flex items-center justify-center"
          style={{ background: "var(--surface)" }}
          role="status" aria-label="Finding your match">
          <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
            <path d="M13 2C6.925 2 2 6.925 2 13c0 2.044.563 3.956 1.538 5.59L2 23l4.6-1.5A10.95 10.95 0 0013 24c6.075 0 11-4.925 11-11S19.075 2 13 2z"
              stroke="var(--accent)" strokeWidth="1.5" fill="none" strokeLinejoin="round" />
          </svg>
        </motion.div>

        <div className="text-center">
          <p className="text-base font-mono font-medium" style={{ color: "var(--foreground)" }}>Finding your match…</p>
          <p className="text-sm font-mono mt-1" style={{ color: "var(--muted)" }}>One person, one conversation, every day.</p>
        </div>

        <div className="w-full max-w-sm rounded-lg p-4"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <p className="text-xs font-mono uppercase tracking-widest mb-2" style={{ color: "var(--muted)" }}>Your status</p>
          {editing ? (
            <input type="text" value={icebreaker} onChange={(e) => setIcebreaker(e.target.value)}
              onBlur={save} onKeyDown={(e) => e.key === "Enter" && save()}
              autoFocus maxLength={280}
              className="w-full bg-transparent text-sm font-mono outline-none"
              style={{ color: "var(--foreground)" }} aria-label="Edit your status" />
          ) : (
            <button onClick={() => setEditing(true)} className="w-full text-left text-sm font-mono"
              style={{ color: icebreaker ? "var(--foreground)" : "var(--muted)" }}
              aria-label={icebreaker ? "Edit status" : "Add a status"}>
              {icebreaker || "Add a status…"}
            </button>
          )}
        </div>
      </div>

      <OwnProfileSheet open={ownSheetOpen} onOpenChange={setOwnSheetOpen} profile={profile} />
    </div>
  );
}

/* ─── Ended Room ─────────────────────────────────────────────── */
function EndedRoom({ matchState }: { matchState: any }) {
  const [, setLocation] = useLocation();
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-5 px-6 text-center"
      style={{ background: "var(--surface-2)" }} role="main">
      <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: "var(--surface)" }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="9" stroke="var(--muted)" strokeWidth="1.5" />
          <path d="M9 9l6 6M15 9l-6 6" stroke="var(--muted)" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
      <div>
        <p className="font-mono font-medium text-base" style={{ color: "var(--foreground)" }}>
          {matchState.status === "blocked" ? "Room closed." : "This room has ended."}
        </p>
        <p className="text-sm font-mono mt-1" style={{ color: "var(--muted)" }}>Next match opens at midnight UTC.</p>
      </div>
      <button onClick={() => setLocation("/gallery")}
        className="px-5 py-2.5 rounded-lg font-mono text-sm transition-opacity active:opacity-70"
        style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
        View memories
      </button>
    </div>
  );
}

/* ─── Shared profile sheet ───────────────────────────────────── */
function OwnProfileSheet({ open, onOpenChange, profile }: { open: boolean; onOpenChange: (v: boolean) => void; profile: any }) {
  const [, setLocation] = useLocation();
  const { theme, setTheme } = useTheme();
  const myName = profile?.displayName ?? "You";

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/50" style={{ backdropFilter: "blur(2px)" }} />
        <DialogPrimitive.Content aria-describedby={undefined}
          style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50, background: "var(--surface)",
            borderTop: "1px solid var(--border)", borderRadius: "24px 24px 0 0",
            maxHeight: "70vh", overflowY: "auto", padding: "20px 24px 48px" }}>
          <DialogPrimitive.Title className="sr-only">Your profile</DialogPrimitive.Title>
          <div className="w-10 h-1 rounded-full mx-auto mb-6" style={{ background: "var(--border)" }} />
          <div className="flex flex-col items-center gap-4 mb-6">
            <AuraRing aura={profile?.aura} size={80} ringWidth={4}>
              <Avatar name={myName} avatarUrl={profile?.avatarUrl} size={80} colorVar="var(--accent)" />
            </AuraRing>
            <div className="text-center">
              <p className="font-mono font-semibold text-lg" style={{ color: "var(--accent)" }}>{myName}</p>
              {profile?.icebreaker && (
                <p className="text-sm font-serif italic mt-2 leading-relaxed px-2 max-w-xs" style={{ color: "var(--foreground)" }}>
                  "{profile.icebreaker}"
                </p>
              )}
            </div>
          </div>
          <div className="mb-5">
            <p className="text-xs font-mono uppercase tracking-widest mb-2" style={{ color: "var(--muted)" }}>Theme</p>
            <ThemePickerInline themes={THEMES} value={theme} onChange={(t) => setTheme(t as ThemeId)} />
          </div>
          <button onClick={() => { onOpenChange(false); setLocation("/settings?from=/room"); }}
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
  );
}

/* ─── Message group ──────────────────────────────────────────── */
interface MsgGroup { senderId: string; isMe: boolean; msgs: Message[]; }

function groupMessages(messages: Message[], myId: string): MsgGroup[] {
  const groups: MsgGroup[] = [];
  for (const m of messages) {
    const isMe = m.senderId === myId;
    const last = groups[groups.length - 1];
    if (last && last.senderId === m.senderId) { last.msgs.push(m); }
    else { groups.push({ senderId: m.senderId, isMe, msgs: [m] }); }
  }
  return groups;
}

/* ─── Edit/Delete context menu ───────────────────────────────── */
function MsgContextMenu({ onEdit, onDelete, canEdit, align, onClose }: {
  onEdit?: () => void;
  onDelete: () => void;
  canEdit: boolean;
  align: "start" | "end";
  onClose: () => void;
}) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.9, y: 4 }} animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: 4 }} transition={{ type: "spring", stiffness: 450, damping: 30 }}
      className={`flex flex-col gap-0.5 py-1 rounded-xl shadow-xl z-30 ${align === "end" ? "items-end" : "items-start"}`}
      style={{ background: "var(--surface)", border: "1px solid var(--border)", minWidth: 128 }}
      onClick={(e) => e.stopPropagation()}>
      {canEdit && (
        <button onClick={() => { onEdit?.(); onClose(); }}
          className="w-full px-4 py-2.5 text-left text-sm font-mono transition-colors hover:bg-[rgba(255,255,255,0.05)] active:opacity-70"
          style={{ color: "var(--foreground)" }}>
          Edit
        </button>
      )}
      <button onClick={() => { onDelete(); onClose(); }}
        className="w-full px-4 py-2.5 text-left text-sm font-mono transition-colors hover:bg-[rgba(255,255,255,0.05)] active:opacity-70"
        style={{ color: "#f38ba8" }}>
        Unsend
      </button>
    </motion.div>
  );
}

/* ─── Active Room ────────────────────────────────────────────── */
type IMode = "first" | "second" | "shared";

interface ReplyTarget { id: string; content: string; senderName: string; }

function ActiveRoom({ matchState, userId, myProfile }: {
  matchState: any; userId: string; myProfile: any;
}) {
  const [, setLocation] = useLocation();
  const { theme, setTheme } = useTheme();
  const queryClient = useQueryClient();
  const prefersReducedMotion = useReducedMotion(); // E4

  // Input state
  const [input, setInput] = useState("");
  const [inputOpen, setInputOpen] = useState(false);
  const [replyTo, setReplyTo] = useState<ReplyTarget | null>(null);
  const [composerFocused, setComposerFocused] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // A1 — message jump refs (id → DOM element)
  const msgRefs = useRef<Map<string, HTMLElement>>(new Map());
  const [highlightedMsgId, setHighlightedMsgId] = useState<string | null>(null);

  // Edit / delete context menu (own messages)
  const [contextMenuMsgId, setContextMenuMsgId] = useState<string | null>(null);
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const editInputRef = useRef<HTMLTextAreaElement>(null);
  const longPressTimerRef = useRef<number | null>(null);

  // B1/B3 — image viewer
  const [viewerSrc, setViewerSrc] = useState<string | null>(null);

  // Dialog / sheet state
  const [endDialogOpen, setEndDialogOpen] = useState(false);
  const [partnerSheetOpen, setPartnerSheetOpen] = useState(false);
  const [ownSheetOpen, setOwnSheetOpen] = useState(false);
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  // Icebreaker anchor
  const [icebreakerVisible, setIcebreakerVisible] = useState(false);
  const icebreakerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // E1 — Infinite scroll: older messages
  const [oldestCursor, setOldestCursor] = useState<string | undefined>(undefined);
  const [isFetchingOlder, setIsFetchingOlder] = useState(false);
  const [hasOlderMessages, setHasOlderMessages] = useState(true);
  const topSentinelRef = useRef<HTMLDivElement>(null);

  // Ignition
  const ignitionKey = `ignition-${matchState.matchId}`;
  const [ignitionMode, setIgnitionMode] = useState<IMode | null>(() => {
    try { return sessionStorage.getItem(ignitionKey) as IMode | null; }
    catch { return null; }
  });

  const handleIgnitionDone = useCallback((mode: IMode) => {
    setIgnitionMode(mode);
    try { sessionStorage.setItem(ignitionKey, mode); } catch {}
  }, [ignitionKey]);

  // Match expiry (poll + WS)
  const [timeLeft, setTimeLeft] = useState("");
  const [isLocked, setIsLocked] = useState(false);

  // API
  const sendMessage = useSendMessage();
  const endMatch = useEndMatch();

  // B2 — image upload via object storage presigned URLs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const { uploadFile } = useUpload({
    onSuccess: (response) => {
      const imageUrl = `/api/storage${response.objectPath}`;
      sendMessage.mutate({
        matchId: matchState.matchId,
        data: { content: "", imageUrl },
      });
      setUploadingImage(false);
    },
    onError: () => setUploadingImage(false),
  });

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    uploadFile(file);
    e.target.value = "";
  };

  const { data: initialMessages, isLoading: msgsLoading } = useGetMatchMessages(matchState.matchId, undefined, {
    query: { queryKey: getGetMatchMessagesQueryKey(matchState.matchId) },
  });

  const {
    messages,
    partnerTyping,
    onlineStatus,
    sendTyping,
    ignitionResult,
    tapIgnition,
    roomExpired,
  } = useWebsocket(matchState.matchId, initialMessages ?? [], userId);

  // E3 — room_expired WS event locks the room immediately
  useEffect(() => {
    if (roomExpired) {
      setIsLocked(true);
      setTimeLeft("Expired");
      queryClient.invalidateQueries({ queryKey: getGetTodayMatchQueryKey() });
    }
  }, [roomExpired, queryClient]);

  const msgMap = useMemo(() => {
    const m = new Map<string, Message>();
    for (const msg of messages) m.set(msg.id, msg);
    return m;
  }, [messages]);

  const groups = useMemo(() => groupMessages(messages, userId), [messages, userId]);

  const partner = matchState.partner;
  const myName = myProfile?.displayName ?? "You";
  const partnerName = partner?.displayName ?? "Partner";
  const partnerUserId: string = partner?.userId ?? "";

  // Time remaining (poll fallback)
  useEffect(() => {
    const update = () => {
      if (!matchState.expiresAt) return;
      const diff = new Date(matchState.expiresAt).getTime() - Date.now();
      if (diff <= 0) { setIsLocked(true); setTimeLeft("Expired"); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setTimeLeft(h > 0 ? `${h}h ${m}m` : `${m}m`);
    };
    update();
    const id = setInterval(update, 30000);
    return () => clearInterval(id);
  }, [matchState.expiresAt]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (!scrollContainerRef.current) return;
    const el = scrollContainerRef.current;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (nearBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth" });
    }
  }, [messages, partnerTyping, prefersReducedMotion]);

  // Focus edit textarea when entering edit mode
  useEffect(() => {
    if (editingMsgId) setTimeout(() => editInputRef.current?.focus(), 60);
  }, [editingMsgId]);

  // E1 — intersection observer for top sentinel (load older messages)
  useEffect(() => {
    const sentinel = topSentinelRef.current;
    if (!sentinel || !hasOlderMessages) return;

    const observer = new IntersectionObserver(
      async (entries) => {
        if (!entries[0].isIntersecting || isFetchingOlder || !hasOlderMessages) return;
        const firstMsg = messages[0];
        if (!firstMsg) return;
        setIsFetchingOlder(true);
        try {
          const res = await fetch(
            `/api/matches/${matchState.matchId}/messages?before=${firstMsg.id}&limit=30`
          );
          if (!res.ok) return;
          const older: Message[] = await res.json();
          if (older.length < 30) setHasOlderMessages(false);
          if (older.length > 0) {
            // Prepend older messages without scrolling
            const container = scrollContainerRef.current;
            const prevScrollHeight = container?.scrollHeight ?? 0;
            // Messages will merge into the hook state on next WS event.
            // For now, manually merge into initial messages cache via queryClient.
            const existingKey = getGetMatchMessagesQueryKey(matchState.matchId);
            queryClient.setQueryData(existingKey, (prev: Message[] | undefined) => {
              const existing = prev ?? [];
              const existingIds = new Set(existing.map((m) => m.id));
              const newOnes = older.filter((m) => !existingIds.has(m.id));
              return [...newOnes, ...existing];
            });
            // Restore scroll position
            requestAnimationFrame(() => {
              if (container) {
                container.scrollTop = container.scrollHeight - prevScrollHeight;
              }
            });
          }
        } catch { /* silent */ }
        finally { setIsFetchingOlder(false); }
      },
      { threshold: 0.1 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [matchState.matchId, messages, isFetchingOlder, hasOlderMessages, queryClient]);

  const openInput = () => { setInputOpen(true); setTimeout(() => inputRef.current?.focus(), 80); };
  const closeInput = () => { if (!input.trim()) { setInputOpen(false); setReplyTo(null); } };

  const handleSend = (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text || isLocked) return;
    sendMessage.mutate({ matchId: matchState.matchId, data: { content: text, replyToId: replyTo?.id ?? null } });
    setInput("");
    setReplyTo(null);
    sendTyping(false);
    if (inputRef.current) inputRef.current.style.height = "auto";
  };

  const handleTyping = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    sendTyping(e.target.value.length > 0);
    const ta = e.target;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 96)}px`;
  };

  const showIcebreaker = useCallback(() => {
    if (!matchState.partner?.icebreaker) return;
    setIcebreakerVisible(true);
    if (icebreakerTimerRef.current) clearTimeout(icebreakerTimerRef.current);
    icebreakerTimerRef.current = setTimeout(() => setIcebreakerVisible(false), 3500);
  }, [matchState.partner?.icebreaker]);

  const handleScrollPause = useCallback(() => {
    if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    scrollTimerRef.current = setTimeout(showIcebreaker, 1500);
  }, [showIcebreaker]);

  useEffect(() => () => {
    if (icebreakerTimerRef.current) clearTimeout(icebreakerTimerRef.current);
    if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
  }, []);

  const startReply = (msg: Message, senderName: string) => {
    setReplyTo({ id: msg.id, content: msg.content, senderName });
    openInput();
  };

  // A1 — jump to quoted message + highlight
  const jumpToMessage = useCallback((msgId: string) => {
    const el = msgRefs.current.get(msgId);
    if (!el) return;
    el.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth", block: "center" });
    setHighlightedMsgId(msgId);
    setTimeout(() => setHighlightedMsgId(null), 1200);
  }, [prefersReducedMotion]);

  // Long press → open edit/delete menu for own messages only
  const handleLongPressStart = (msgId: string, isOwn: boolean) => {
    if (!isOwn || isLocked) return;
    longPressTimerRef.current = window.setTimeout(() => setContextMenuMsgId(msgId), 450);
  };
  const handleLongPressEnd = () => {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
  };

  // Edit handlers
  const startEdit = (msg: Message) => {
    setEditingMsgId(msg.id);
    setEditContent(msg.content);
    setContextMenuMsgId(null);
  };
  const cancelEdit = () => { setEditingMsgId(null); setEditContent(""); };
  const submitEdit = async (msgId: string) => {
    const text = editContent.trim();
    if (!text) return;
    cancelEdit();
    await fetch(`/api/matches/${matchState.matchId}/messages/${msgId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: text }),
    });
  };

  // Delete (unsend) handler
  const unsendMessage = async (msgId: string) => {
    await fetch(`/api/matches/${matchState.matchId}/messages/${msgId}`, { method: "DELETE" });
  };

  const showInactiveNotice =
    !!partner?.lastActive && !onlineStatus[partnerUserId] &&
    (Date.now() - new Date(partner.lastActive).getTime()) / 3600000 > 3;

  if (!ignitionMode) {
    return (
      <AnimatePresence mode="wait">
        <Ignition key="ignition" partner={partner} userId={userId}
          ignitionResult={ignitionResult} onTap={tapIgnition} onDone={handleIgnitionDone} />
      </AnimatePresence>
    );
  }

  return (
    <motion.div className="flex-1 flex flex-col" style={{ background: "var(--background)" }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      transition={{ duration: prefersReducedMotion ? 0 : 0.4 }}>

      {/* ── Header ── */}
      <header className="flex items-center gap-3 px-4 pt-14 pb-3"
        style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
        <button onClick={() => setLocation("/gallery")} className="transition-opacity active:opacity-60 mr-1 flex-shrink-0"
          aria-label="Back to gallery">
          <svg width="9" height="15" viewBox="0 0 9 15" fill="none" aria-hidden="true">
            <path d="M8 1L2 7.5 8 14" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <button onClick={() => setPartnerSheetOpen(true)}
          className="flex-1 min-w-0 flex items-center gap-2.5 text-left transition-opacity active:opacity-70"
          aria-label={`View ${partnerName}'s profile`}>
          <div className="relative flex-shrink-0">
            <AuraRing aura={partner?.aura} size={36} ringWidth={4}>
              <Avatar name={partnerName} avatarUrl={partner?.avatarUrl} size={36} colorVar="var(--their-name)" />
            </AuraRing>
            <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2"
              style={{ background: onlineStatus[partnerUserId] ? "var(--their-name)" : "var(--muted)", borderColor: "var(--surface)", zIndex: 1 }}
              role="img" aria-label={onlineStatus[partnerUserId] ? `${partnerName} is online` : `${partnerName} is offline`} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-mono font-semibold truncate" style={{ color: "var(--foreground)" }}>{partnerName}</p>
            <p className="text-xs font-mono" style={{ color: isLocked ? "var(--muted)" : "var(--accent)" }}>
              {isLocked ? "Room closed" : `${timeLeft} left`}
            </p>
          </div>
        </button>

        {!isLocked && (
          <button onClick={() => setEndDialogOpen(true)}
            className="text-xs font-mono uppercase tracking-widest transition-opacity active:opacity-60 flex-shrink-0"
            style={{ color: "var(--muted)" }} aria-label="End this room">
            End
          </button>
        )}
      </header>

      {/* ── Icebreaker banner ── */}
      {partner?.icebreaker && (
        <div className="flex items-start gap-2 px-4 py-2.5"
          style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="mt-0.5 flex-shrink-0" aria-hidden="true">
            <circle cx="7" cy="7" r="6" stroke="var(--accent)" strokeWidth="1.2" />
            <path d="M7 4v4M7 9.5v.5" stroke="var(--accent)" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          <div className="min-w-0">
            <span className="text-xs font-mono" style={{ color: "var(--muted)" }}>{partnerName}'s status — </span>
            <span className="text-xs font-serif italic" style={{ color: "var(--foreground)" }}>{partner.icebreaker}</span>
          </div>
        </div>
      )}

      {/* ── Messages ── */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto hide-scrollbar px-4 py-4"
        onScroll={handleScrollPause}
        onClick={() => { if (contextMenuMsgId) { setContextMenuMsgId(null); return; } if (inputOpen) showIcebreaker(); else if (!isLocked) openInput(); }}
        style={{ cursor: isLocked ? "default" : "text" }}
        role="log" aria-label="Messages" aria-live="polite">

        {/* E1 — top sentinel + load-older indicator */}
        <div ref={topSentinelRef} className="h-1" />
        <AnimatePresence>
          {isFetchingOlder && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex justify-center py-2">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <motion.div key={i} className="w-1 h-1 rounded-full" style={{ background: "var(--muted)" }}
                    animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }} />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* H — message skeletons */}
        {msgsLoading && (
          <>
            <MessageSkeleton isMe={false} />
            <MessageSkeleton isMe={true} />
            <MessageSkeleton isMe={false} />
          </>
        )}

        {ignitionMode === "first" && messages.length === 0 && !msgsLoading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-center py-4">
            <p className="text-xs font-mono uppercase tracking-widest" style={{ color: "var(--accent)" }}>
              You are first in this room.
            </p>
          </motion.div>
        )}

        {showInactiveNotice && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-center py-3" role="note">
            <p className="text-xs font-mono text-center max-w-xs leading-relaxed" style={{ color: "var(--muted)" }}>
              {partnerName} hasn't been active in a while — they'll likely reply when they're back.
            </p>
          </motion.div>
        )}

        {/* Message groups */}
        <AnimatePresence initial={false}>
          {groups.map((group, gi) => (
            <motion.div key={`${group.senderId}-${gi}`}
              initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={`flex gap-3 mb-4 ${group.isMe ? "flex-row-reverse" : "flex-row"}`}>

              <div className="flex-shrink-0 pt-0.5">
                <AuraRing aura={group.isMe ? myProfile?.aura : partner?.aura} size={40} ringWidth={4}>
                  <Avatar name={group.isMe ? myName : partnerName}
                    avatarUrl={group.isMe ? myProfile?.avatarUrl : partner?.avatarUrl}
                    size={40} colorVar={group.isMe ? "var(--accent)" : "var(--their-name)"} />
                </AuraRing>
              </div>

              <div className={`flex flex-col gap-0.5 min-w-0 flex-1 ${group.isMe ? "items-end" : "items-start"}`}>
                <div className={`flex items-baseline gap-2 ${group.isMe ? "flex-row-reverse" : "flex-row"}`}>
                  {!group.isMe && (
                    <span className="text-sm font-mono font-semibold" style={{ color: "var(--their-name)" }}>
                      {partnerName}
                    </span>
                  )}
                  <span className="text-xs font-mono" style={{ color: "var(--muted)" }}>
                    {format(new Date(group.msgs[0].createdAt), "hh:mm a")}
                  </span>
                </div>

                {group.msgs.map((msg, mi) => {
                  const quotedMsg = msg.replyToId ? msgMap.get(msg.replyToId) : null;
                  const quotedSender = quotedMsg?.senderId === userId ? myName : partnerName;
                  const isHighlighted = highlightedMsgId === msg.id;
                  const isEditing = editingMsgId === msg.id;
                  const isDeleted = (msg as any).isDeleted;
                  const isViewOnce = (msg as any).isViewOnce;
                  const viewedAt = (msg as any).viewedAt;
                  const editedAt = (msg as any).editedAt;
                  const imageUrl = (msg as any).imageUrl;
                  // View-once: recipient sees blurred until tapped; once viewed, image is gone
                  const isRecipient = msg.senderId !== userId;
                  const viewOnceViewed = isViewOnce && !!viewedAt;
                  const viewOnceReady = isViewOnce && !viewedAt && isRecipient && imageUrl;

                  return (
                    <div key={msg.id}
                      ref={(el) => { if (el) msgRefs.current.set(msg.id, el); else msgRefs.current.delete(msg.id); }}
                      className={`group/msg w-full ${group.isMe ? "flex flex-col items-end" : "flex flex-col items-start"}`}
                      style={{ transition: "background 0.3s ease", borderRadius: 8,
                        background: isHighlighted ? "rgba(88,101,242,0.15)" : "transparent" }}>

                      {/* Reply quote: clickable → jump to original */}
                      {quotedMsg && !isDeleted && (
                        <button className="reply-quote mb-1 max-w-[90%] text-left"
                          onClick={(e) => { e.stopPropagation(); jumpToMessage(quotedMsg.id); }}
                          style={{ color: "var(--muted)" }}
                          aria-label={`Jump to ${quotedSender}'s message`}>
                          <strong style={{ color: group.isMe ? "var(--their-name)" : "var(--my-name)" }}>
                            {quotedSender}:{" "}
                          </strong>
                          {quotedMsg.content.slice(0, 80)}{quotedMsg.content.length > 80 ? "…" : ""}
                        </button>
                      )}

                      {/* Message row */}
                      <div className={`flex items-end gap-2 ${group.isMe ? "flex-row-reverse" : "flex-row"}`}
                        onTouchStart={() => handleLongPressStart(msg.id, group.isMe)}
                        onTouchEnd={handleLongPressEnd}
                        onTouchCancel={handleLongPressEnd}
                        onContextMenu={(e) => { if (group.isMe && !isLocked && !isDeleted) { e.preventDefault(); setContextMenuMsgId(msg.id); } }}>

                        {isDeleted ? (
                          /* Tombstone */
                          <p className="text-sm font-mono italic" style={{ color: "var(--muted)" }}>
                            Message unsent
                          </p>
                        ) : isEditing ? (
                          /* Inline edit */
                          <div className="flex flex-col gap-1.5" style={{ maxWidth: "80%" }}>
                            <textarea
                              ref={editInputRef}
                              value={editContent}
                              onChange={(e) => setEditContent(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitEdit(msg.id); }
                                if (e.key === "Escape") cancelEdit();
                              }}
                              rows={2}
                              className="w-full px-3 py-2 rounded-lg text-sm font-sans outline-none resize-none"
                              style={{ background: "var(--input-bg)", color: "var(--foreground)",
                                border: "1px solid var(--accent)", caretColor: "var(--accent)" }}
                              maxLength={2000} />
                            <div className="flex gap-2 justify-end">
                              <button onClick={cancelEdit}
                                className="text-xs font-mono px-2 py-1 rounded" style={{ color: "var(--muted)" }}>
                                Cancel
                              </button>
                              <button onClick={() => submitEdit(msg.id)}
                                className="text-xs font-mono px-3 py-1 rounded"
                                style={{ background: "var(--accent)", color: "white" }}>
                                Save
                              </button>
                            </div>
                          </div>
                        ) : imageUrl ? (
                          /* Image message — with view-once handling */
                          viewOnceViewed ? (
                            <p className="text-sm font-mono italic" style={{ color: "var(--muted)" }}>
                              {isRecipient ? "Photo opened" : "Photo was opened"}
                            </p>
                          ) : viewOnceReady ? (
                            /* View-once: blurred tap-to-open */
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                await fetch(`/api/matches/${matchState.matchId}/messages/${msg.id}/viewed`, { method: "POST" });
                                setViewerSrc(imageUrl);
                              }}
                              className="relative focus:outline-none rounded-xl overflow-hidden"
                              aria-label="Tap to view photo (view once)">
                              <img src={imageUrl} alt="View-once photo"
                                className="max-w-[220px] max-h-[220px] rounded-xl object-cover"
                                style={{ filter: "blur(18px)", transform: "scale(1.05)" }} />
                              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
                                <span style={{ fontSize: 22 }}>👁</span>
                                <span className="text-xs font-mono text-white" style={{ textShadow: "0 1px 4px rgba(0,0,0,0.8)" }}>
                                  Tap to open
                                </span>
                              </div>
                            </button>
                          ) : isViewOnce && !isRecipient && !viewedAt ? (
                            /* Sender sees their view-once image normally until viewed */
                            <div className="relative">
                              <button onClick={(e) => { e.stopPropagation(); setViewerSrc(imageUrl); }}
                                className="focus:outline-none focus:ring-2 focus:ring-[var(--accent)] rounded-xl"
                                aria-label="Open image">
                                <img src={imageUrl} alt="Shared image"
                                  className="max-w-[220px] max-h-[220px] rounded-xl object-cover"
                                  style={{ border: "1px solid var(--border)" }} />
                              </button>
                              <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded text-[10px] font-mono"
                                style={{ background: "rgba(0,0,0,0.6)", color: "white" }}>
                                view once
                              </div>
                            </div>
                          ) : (
                            /* Regular image */
                            <button onClick={(e) => { e.stopPropagation(); setViewerSrc(imageUrl); }}
                              className="focus:outline-none focus:ring-2 focus:ring-[var(--accent)] rounded-xl"
                              aria-label="Open image">
                              <img src={imageUrl} alt="Shared image"
                                className="max-w-[220px] max-h-[220px] rounded-xl object-cover"
                                style={{ border: "1px solid var(--border)" }} />
                            </button>
                          )
                        ) : (
                          /* Text message */
                          <p className={`text-base font-sans leading-snug ${mi === 0 && gi === 0 ? "text-lg" : ""}`}
                            style={{ color: "var(--foreground)", maxWidth: "80%" }}>
                            {msg.content}
                          </p>
                        )}

                        {/* Reply button (partner messages or own non-deleted) */}
                        {!isLocked && !isDeleted && (
                          <button className="opacity-0 group-hover/msg:opacity-70 focus:opacity-70 active:opacity-100 flex-shrink-0 transition-opacity"
                            style={{ color: "var(--muted)", padding: "14px 8px", margin: "-14px -8px" }}
                            onClick={(e) => { e.stopPropagation(); startReply(msg, group.isMe ? myName : partnerName); }}
                            aria-label={`Reply to ${group.isMe ? myName : partnerName}`}
                            title="Reply">
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                              <path d="M5 3L1 7l4 4M1 7h8a4 4 0 014 4" stroke="currentColor" strokeWidth="1.3"
                                strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </button>
                        )}
                      </div>

                      {/* (edited) label */}
                      {editedAt && !isDeleted && (
                        <p className="text-[10px] font-mono mt-0.5" style={{ color: "var(--muted)" }}>
                          (edited)
                        </p>
                      )}

                      {/* Edit/Delete context menu */}
                      <AnimatePresence>
                        {contextMenuMsgId === msg.id && group.isMe && !isDeleted && (
                          <div className={`mt-1 ${group.isMe ? "self-end" : "self-start"}`}>
                            <MsgContextMenu
                              canEdit={!imageUrl && !isDeleted}
                              align="end"
                              onEdit={() => startEdit(msg)}
                              onDelete={() => unsendMessage(msg.id)}
                              onClose={() => setContextMenuMsgId(null)} />
                          </div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Typing indicator */}
        <AnimatePresence>
          {partnerTyping && (
            <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="flex items-center gap-3 mb-4" aria-live="polite" aria-label={`${partnerName} is typing`}>
              <AuraRing aura={partner?.aura} size={40} ringWidth={4}>
                <Avatar name={partnerName} avatarUrl={partner?.avatarUrl} size={40} colorVar="var(--their-name)" />
              </AuraRing>
              <div className="flex items-center gap-1 px-3 py-2 rounded-lg" style={{ background: "var(--surface)" }}>
                {[0, 1, 2].map((i) => (
                  <motion.div key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--muted)" }}
                    animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
                    transition={{ duration: 1, repeat: Infinity, delay: i * 0.18 }} />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Locked notice */}
        <AnimatePresence>
          {isLocked && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-center py-4">
              <div className="px-4 py-3 rounded-lg text-center" style={{ background: "var(--surface)" }}>
                <p className="text-xs font-mono" style={{ color: "var(--muted)" }}>This room closed at midnight UTC.</p>
                <button onClick={() => setLocation("/gallery")}
                  className="text-xs font-mono mt-1 transition-opacity" style={{ color: "var(--accent)" }}>
                  View in Memories →
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Icebreaker pill */}
        <AnimatePresence>
          {icebreakerVisible && partner?.icebreaker && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.22 }} className="sticky bottom-3 flex justify-center pointer-events-none">
              <button className="pointer-events-auto flex items-center gap-2 px-4 py-2 rounded-full font-serif text-sm italic transition-opacity active:opacity-70"
                style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--foreground)", boxShadow: "0 4px 16px rgba(0,0,0,0.2)" }}
                onClick={(e) => { e.stopPropagation(); setPartnerSheetOpen(true); setIcebreakerVisible(false); }}>
                <span style={{ fontSize: "0.9em" }}>💭</span>
                <span style={{ color: "var(--muted)" }}>
                  {partner.icebreaker.length > 52 ? partner.icebreaker.slice(0, 52) + "…" : partner.icebreaker}
                </span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={messagesEndRef} className="h-1" />
      </div>

      {/* ── Input area ── */}
      {!isLocked && (
        <>
          <AnimatePresence>
            {!inputOpen && (
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }}
                transition={{ duration: 0.2 }} className="px-4 py-3"
                style={{ background: "var(--surface)", borderTop: "1px solid var(--border)" }}>
                <button onClick={openInput} className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-left"
                  style={{ background: "var(--input-bg)" }} aria-label={`Message ${partnerName}`}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M13.5 1.5a1.5 1.5 0 00-2.12 0L2 10.88V14h3.12l9.38-9.38a1.5 1.5 0 000-2.12z"
                      stroke="var(--muted)" strokeWidth="1.2" strokeLinejoin="round" />
                  </svg>
                  <span className="text-sm font-mono" style={{ color: "var(--muted)" }}>Message {partnerName}…</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {inputOpen && (
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }}
                transition={{ type: "spring", stiffness: 400, damping: 32 }}
                style={{ background: "var(--surface)", borderTop: "1px solid var(--border)" }}>

                <AnimatePresence>
                  {replyTo && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="flex items-center gap-2 px-4 py-2 overflow-hidden"
                      style={{ borderBottom: "1px solid var(--border)" }}>
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="flex-shrink-0" aria-hidden="true">
                        <path d="M4 2L1 5l3 3M1 5h6.5A3.5 3.5 0 0111 8.5v.5" stroke="var(--accent)"
                          strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <p className="text-xs font-mono flex-1 min-w-0 truncate" style={{ color: "var(--muted)" }}>
                        Replying to <strong style={{ color: "var(--foreground)" }}>{replyTo.senderName}</strong>{" "}
                        — {replyTo.content.slice(0, 60)}{replyTo.content.length > 60 ? "…" : ""}
                      </p>
                      <button onClick={() => setReplyTo(null)} className="flex-shrink-0 p-0.5 transition-opacity active:opacity-60"
                        style={{ color: "var(--muted)" }} aria-label="Cancel reply">
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>

                <form onSubmit={handleSend} className="flex items-end gap-2 px-3 py-3">
                  {/* Close composer */}
                  <button type="button" onClick={closeInput}
                    className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors mb-0.5"
                    style={{ background: "var(--border)", color: "var(--muted)" }} aria-label="Close composer">
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                      <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </button>

                  {/* Image button — LEFT of input per spec */}
                  <button type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingImage}
                    className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center mb-0.5 transition-opacity"
                    style={{ background: "var(--border)", opacity: uploadingImage ? 0.4 : 0.7 }}
                    aria-label="Send image">
                    {uploadingImage ? (
                      <motion.div className="w-3 h-3 rounded-full border-2"
                        style={{ borderColor: "var(--muted)", borderTopColor: "var(--accent)" }}
                        animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }} />
                    ) : (
                      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                        <rect x="1.5" y="3" width="13" height="10" rx="2" stroke="var(--muted)" strokeWidth="1.2" />
                        <circle cx="5.5" cy="6.5" r="1" fill="var(--muted)" />
                        <path d="M1.5 10.5l3.5-3 3 3 2-2 3.5 3" stroke="var(--muted)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>

                  {/* Text input */}
                  <div className={`flex-1 flex items-end rounded-lg px-4 py-2.5 transition-all ${composerFocused ? "composer-focused" : ""}`}
                    style={{ background: "var(--input-bg)", minHeight: 44 }}>
                    <textarea ref={inputRef} value={input} onChange={handleTyping}
                      onFocus={() => setComposerFocused(true)} onBlur={() => setComposerFocused(false)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
                        if (e.key === "Escape") closeInput();
                      }}
                      placeholder={`Message ${partnerName}…`} rows={1}
                      className="flex-1 w-full bg-transparent text-sm font-sans outline-none resize-none leading-relaxed"
                      style={{ color: "var(--foreground)", caretColor: "var(--accent)", maxHeight: "96px", overflowY: "auto", transition: "height 0.12s ease" }}
                      maxLength={2000}
                      aria-label={`Message ${partnerName}`} />
                  </div>

                  {/* Send */}
                  <motion.button type="submit" disabled={!input.trim()}
                    className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center mb-0.5"
                    style={{ background: input.trim() ? "var(--accent)" : "var(--border)", transition: "background 0.15s ease, opacity 0.15s ease", opacity: input.trim() ? 1 : 0.45 }}
                    whileTap={{ scale: prefersReducedMotion ? 1 : 0.9 }}
                    aria-label="Send message">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path d="M8 13V3M4 7l4-4 4 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </motion.button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      {/* B2 — Hidden file input for image upload */}
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
        onChange={handleImageSelect} aria-hidden="true" tabIndex={-1} />

      {/* ── Dialogs ── */}
      <AlertDialog open={endDialogOpen} onOpenChange={setEndDialogOpen}>
        <AlertDialogContent style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-mono" style={{ color: "var(--foreground)" }}>End this room?</AlertDialogTitle>
            <AlertDialogDescription className="font-mono text-sm" style={{ color: "var(--muted)" }}>
              The room will close early. You won't be re-matched today.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-mono"
              style={{ background: "var(--input-bg)", borderColor: "var(--border)", color: "var(--foreground)" }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction className="font-mono"
              style={{ background: "var(--accent)", color: "white", borderColor: "transparent" }}
              onClick={() => endMatch.mutate({ matchId: matchState.matchId, data: { block: false } })}>
              End room
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={blockDialogOpen} onOpenChange={setBlockDialogOpen}>
        <AlertDialogContent style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-mono" style={{ color: "var(--foreground)" }}>Block {partnerName}?</AlertDialogTitle>
            <AlertDialogDescription className="font-mono text-sm" style={{ color: "var(--muted)" }}>
              This will close the room and block them from being your match again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-mono"
              style={{ background: "var(--input-bg)", borderColor: "var(--border)", color: "var(--foreground)" }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction className="font-mono"
              style={{ background: "#DC2626", color: "white", borderColor: "transparent" }}
              onClick={() => { endMatch.mutate({ matchId: matchState.matchId, data: { block: true } }); setPartnerSheetOpen(false); setBlockDialogOpen(false); }}>
              Block and close room
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Partner profile sheet */}
      <DialogPrimitive.Root open={partnerSheetOpen} onOpenChange={setPartnerSheetOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/50" style={{ backdropFilter: "blur(2px)" }} />
          <DialogPrimitive.Content aria-describedby={undefined}
            style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50, background: "var(--surface)",
              borderTop: "1px solid var(--border)", borderRadius: "24px 24px 0 0",
              maxHeight: "60vh", overflowY: "auto", padding: "20px 24px 48px" }}>
            <DialogPrimitive.Title className="sr-only">{partnerName}'s profile</DialogPrimitive.Title>
            <div className="w-10 h-1 rounded-full mx-auto mb-6" style={{ background: "var(--border)" }} />
            <div className="flex flex-col items-center gap-4">
              <AuraRing aura={partner?.aura} size={80} ringWidth={4}>
                <Avatar name={partnerName} avatarUrl={partner?.avatarUrl} size={80} colorVar="var(--their-name)" />
              </AuraRing>
              <div className="text-center">
                <p className="font-mono font-semibold text-lg" style={{ color: "var(--their-name)" }}>{partnerName}</p>
                {partner?.icebreaker && (
                  <p className="text-sm font-serif italic mt-3 leading-relaxed px-2 max-w-xs" style={{ color: "var(--foreground)" }}>
                    "{partner.icebreaker}"
                  </p>
                )}
              </div>
            </div>

            {/* F — Report + Block actions */}
            {!isLocked && (
              <div className="mt-6 pt-4 flex flex-col gap-2" style={{ borderTop: "1px solid var(--border)" }}>
                <button onClick={() => { setReportOpen(true); setPartnerSheetOpen(false); }}
                  className="w-full py-2.5 font-mono text-sm text-center rounded-lg transition-opacity active:opacity-70"
                  style={{ background: "var(--surface-2)", color: "var(--muted)", border: "1px solid var(--border)" }}>
                  Report {partnerName}
                </button>
                <button onClick={() => setBlockDialogOpen(true)}
                  className="w-full py-2.5 font-mono text-sm text-center rounded-lg transition-opacity active:opacity-70"
                  style={{ background: "var(--surface-2)", color: "#DC2626", border: "1px solid var(--border)" }}>
                  Block {partnerName}
                </button>
              </div>
            )}

            <DialogPrimitive.Close className="absolute top-4 right-5 transition-opacity active:opacity-60"
              style={{ color: "var(--muted)" }} aria-label="Close">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </DialogPrimitive.Close>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      <OwnProfileSheet open={ownSheetOpen} onOpenChange={setOwnSheetOpen} profile={myProfile} />

      {/* F — Report dialog */}
      <ReportDialog open={reportOpen} onOpenChange={setReportOpen}
        matchId={matchState.matchId} reportedUserId={partnerUserId} partnerName={partnerName} />

      {/* B3 — Media viewer */}
      {viewerSrc && <MediaViewer src={viewerSrc} onClose={() => setViewerSrc(null)} />}
    </motion.div>
  );
}
