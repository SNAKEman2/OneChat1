import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { motion, AnimatePresence } from "framer-motion";
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
      <img
        src={avatarUrl}
        alt={name}
        className="rounded-full object-cover flex-shrink-0"
        style={{ width: size, height: size }}
        onError={() => setImgFailed(true)}
      />
    );
  }
  const initials = name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div
      className="rounded-full flex items-center justify-center flex-shrink-0 font-mono font-semibold text-white select-none"
      style={{ width: size, height: size, fontSize: size * 0.32, background: colorVar }}
    >
      {initials}
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
  const updateProfile = useUpdateMyProfile();

  const save = () => {
    if (icebreaker.trim() && icebreaker !== profile?.icebreaker) {
      updateProfile.mutate({ data: { icebreaker: icebreaker.trim() } });
    }
    setEditing(false);
  };

  return (
    <div className="flex-1 flex flex-col" style={{ background: "var(--surface-2)" }}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 pt-14 pb-3"
        style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-3">
          {/* Tappable own avatar → Settings (Item 7) */}
          {profile && (
            <button
              onClick={() => setLocation("/settings")}
              className="flex-shrink-0 transition-opacity active:opacity-70"
              aria-label="Open settings"
            >
              <Avatar
                name={profile.displayName}
                avatarUrl={profile.avatarUrl}
                size={36}
                colorVar="var(--accent)"
              />
            </button>
          )}
          <div>
            <p className="text-sm font-mono font-medium" style={{ color: "var(--foreground)" }}>
              {profile?.displayName ?? "You"}
            </p>
            <p className="text-xs font-mono" style={{ color: "var(--muted)" }}>
              OneChat
            </p>
          </div>
        </div>
        <button
          onClick={() => setLocation("/gallery")}
          className="text-xs font-mono transition-opacity active:opacity-60"
          style={{ color: "var(--accent)" }}
        >
          Memories
        </button>
      </div>

      {/* Channel header */}
      <div
        className="px-4 py-3"
        style={{ borderBottom: "1px solid var(--border)", background: "var(--background)" }}
      >
        <p className="text-xs font-mono" style={{ color: "var(--muted)" }}>
          # waiting-room
        </p>
      </div>

      {/* Body */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6">
        <motion.div
          animate={{ scale: [1, 1.05, 1], opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          className="w-14 h-14 rounded-full flex items-center justify-center"
          style={{ background: "var(--surface)" }}
        >
          <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
            <path
              d="M13 2C6.925 2 2 6.925 2 13c0 2.044.563 3.956 1.538 5.59L2 23l4.6-1.5A10.95 10.95 0 0013 24c6.075 0 11-4.925 11-11S19.075 2 13 2z"
              stroke="var(--accent)"
              strokeWidth="1.5"
              fill="none"
              strokeLinejoin="round"
            />
          </svg>
        </motion.div>

        <div className="text-center">
          <p className="text-base font-mono font-medium" style={{ color: "var(--foreground)" }}>
            Finding your match…
          </p>
          <p className="text-sm font-mono mt-1" style={{ color: "var(--muted)" }}>
            One person, one conversation, every day.
          </p>
        </div>

        {/* Icebreaker edit */}
        <div
          className="w-full max-w-sm rounded-lg p-4"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <p
            className="text-xs font-mono uppercase tracking-widest mb-2"
            style={{ color: "var(--muted)" }}
          >
            Your status
          </p>
          {editing ? (
            <input
              type="text"
              value={icebreaker}
              onChange={(e) => setIcebreaker(e.target.value)}
              onBlur={save}
              onKeyDown={(e) => e.key === "Enter" && save()}
              autoFocus
              maxLength={280}
              className="w-full bg-transparent text-sm font-mono outline-none"
              style={{ color: "var(--foreground)" }}
            />
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="w-full text-left text-sm font-mono"
              style={{ color: icebreaker ? "var(--foreground)" : "var(--muted)" }}
            >
              {icebreaker || "Add a status…"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Ended Room ─────────────────────────────────────────────── */
function EndedRoom({ matchState }: { matchState: any }) {
  const [, setLocation] = useLocation();
  return (
    <div
      className="flex-1 flex flex-col items-center justify-center gap-5 px-6 text-center"
      style={{ background: "var(--surface-2)" }}
    >
      <div
        className="w-14 h-14 rounded-full flex items-center justify-center"
        style={{ background: "var(--surface)" }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" stroke="var(--muted)" strokeWidth="1.5" />
          <path
            d="M9 9l6 6M15 9l-6 6"
            stroke="var(--muted)"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <div>
        <p className="font-mono font-medium text-base" style={{ color: "var(--foreground)" }}>
          {matchState.status === "blocked" ? "Room closed." : "This room has ended."}
        </p>
        <p className="text-sm font-mono mt-1" style={{ color: "var(--muted)" }}>
          Next match opens at midnight UTC.
        </p>
      </div>
      <button
        onClick={() => setLocation("/gallery")}
        className="px-5 py-2.5 rounded-lg font-mono text-sm transition-opacity active:opacity-70"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          color: "var(--foreground)",
        }}
      >
        View memories
      </button>
    </div>
  );
}

/* ─── Message group ──────────────────────────────────────────── */
interface MsgGroup {
  senderId: string;
  isMe: boolean;
  msgs: Message[];
}

function groupMessages(messages: Message[], myId: string): MsgGroup[] {
  const groups: MsgGroup[] = [];
  for (const m of messages) {
    const isMe = m.senderId === myId;
    const last = groups[groups.length - 1];
    if (last && last.senderId === m.senderId) {
      last.msgs.push(m);
    } else {
      groups.push({ senderId: m.senderId, isMe, msgs: [m] });
    }
  }
  return groups;
}

/* ─── Active Room ────────────────────────────────────────────── */
type IMode = "first" | "second" | "shared";

interface ReplyTarget {
  id: string;
  content: string;
  senderName: string;
}

function ActiveRoom({
  matchState,
  userId,
  myProfile,
}: {
  matchState: any;
  userId: string;
  myProfile: any;
}) {
  const [, setLocation] = useLocation();

  // Input state
  const [input, setInput] = useState("");
  const [inputOpen, setInputOpen] = useState(false);
  const [replyTo, setReplyTo] = useState<ReplyTarget | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Dialog / sheet state
  const [endDialogOpen, setEndDialogOpen] = useState(false);
  const [partnerSheetOpen, setPartnerSheetOpen] = useState(false);

  // Ignition
  const [ignitionMode, setIgnitionMode] = useState<IMode | null>(null);
  const handleIgnitionDone = useCallback((mode: IMode) => setIgnitionMode(mode), []);

  // Match expiry
  const [timeLeft, setTimeLeft] = useState("");
  const [isLocked, setIsLocked] = useState(false);

  // API
  const sendMessage = useSendMessage();
  const endMatch = useEndMatch();

  const { data: initialMessages } = useGetMatchMessages(matchState.matchId, {
    query: { queryKey: getGetMatchMessagesQueryKey(matchState.matchId) },
  });

  const { messages, partnerTyping, onlineStatus, sendTyping, ignitionResult, tapIgnition } =
    useWebsocket(matchState.matchId, initialMessages ?? [], userId);

  // Build a lookup map for quoted messages
  const msgMap = useMemo(() => {
    const m = new Map<string, Message>();
    for (const msg of messages) m.set(msg.id, msg);
    return m;
  }, [messages]);

  // Group messages
  const groups = useMemo(() => groupMessages(messages, userId), [messages, userId]);

  const partner = matchState.partner;
  const myName = myProfile?.displayName ?? "You";
  const partnerName = partner?.displayName ?? "Partner";
  const partnerUserId: string = partner?.userId ?? "";

  // Time remaining
  useEffect(() => {
    const update = () => {
      if (!matchState.expiresAt) return;
      const diff = new Date(matchState.expiresAt).getTime() - Date.now();
      if (diff <= 0) {
        setIsLocked(true);
        setTimeLeft("Expired");
        return;
      }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setTimeLeft(h > 0 ? `${h}h ${m}m` : `${m}m`);
    };
    update();
    const id = setInterval(update, 30000);
    return () => clearInterval(id);
  }, [matchState.expiresAt]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, partnerTyping]);

  // Open input
  const openInput = () => {
    setInputOpen(true);
    setTimeout(() => inputRef.current?.focus(), 80);
  };

  const closeInput = () => {
    if (!input.trim()) {
      setInputOpen(false);
      setReplyTo(null);
    }
  };

  const handleSend = (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text || isLocked) return;
    sendMessage.mutate({
      matchId: matchState.matchId,
      data: { content: text, replyToId: replyTo?.id ?? null },
    });
    setInput("");
    setReplyTo(null);
    sendTyping(false);
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }
  };

  // Auto-growing textarea handler (Item 3)
  const handleTyping = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    sendTyping(e.target.value.length > 0);
    const ta = e.target;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 96)}px`;
  };

  const startReply = (msg: Message, senderName: string) => {
    setReplyTo({ id: msg.id, content: msg.content, senderName });
    openInput();
  };

  // Partner inactivity: > 3 hours since lastActive and not currently online (Item 8)
  const showInactiveNotice =
    !!partner?.lastActive &&
    !onlineStatus[partnerUserId] &&
    (Date.now() - new Date(partner.lastActive).getTime()) / 3600000 > 3;

  // Show ignition ritual first
  if (!ignitionMode) {
    return (
      <AnimatePresence mode="wait">
        <Ignition
          key="ignition"
          partner={partner}
          userId={userId}
          ignitionResult={ignitionResult}
          onTap={tapIgnition}
          onDone={handleIgnitionDone}
        />
      </AnimatePresence>
    );
  }

  return (
    <motion.div
      className="flex-1 flex flex-col"
      style={{ background: "var(--background)" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      {/* ── Header ── */}
      <div
        className="flex items-center gap-3 px-4 pt-14 pb-3"
        style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}
      >
        <button
          onClick={() => setLocation("/gallery")}
          className="transition-opacity active:opacity-60 mr-1 flex-shrink-0"
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

        {/* Tappable partner block → profile sheet (Items 5, 6) */}
        <button
          onClick={() => setPartnerSheetOpen(true)}
          className="flex-1 min-w-0 flex items-center gap-2.5 text-left transition-opacity active:opacity-70"
          aria-label="View partner profile"
        >
          {/* Avatar with live presence dot (Item 6) */}
          <div className="relative flex-shrink-0">
            <Avatar
              name={partnerName}
              avatarUrl={partner?.avatarUrl}
              size={36}
              colorVar="var(--their-name)"
            />
            <div
              className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2"
              style={{
                background: onlineStatus[partnerUserId] ? "var(--their-name)" : "var(--muted)",
                borderColor: "var(--surface)",
              }}
            />
          </div>

          <div className="flex-1 min-w-0">
            <p
              className="text-sm font-mono font-semibold truncate"
              style={{ color: "var(--foreground)" }}
            >
              {partnerName}
            </p>
            <p
              className="text-xs font-mono"
              style={{ color: isLocked ? "var(--muted)" : "var(--accent)" }}
            >
              {isLocked ? "Room closed" : `${timeLeft} left`}
            </p>
          </div>
        </button>

        {/* End button — opens AlertDialog instead of window.confirm (Item 2) */}
        {!isLocked && (
          <button
            onClick={() => setEndDialogOpen(true)}
            className="text-xs font-mono uppercase tracking-widest transition-opacity active:opacity-60 flex-shrink-0"
            style={{ color: "var(--muted)" }}
          >
            End
          </button>
        )}
      </div>

      {/* ── Icebreaker status banner ── */}
      {partner?.icebreaker && (
        <div
          className="flex items-start gap-2 px-4 py-2.5"
          style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            className="mt-0.5 flex-shrink-0"
          >
            <circle cx="7" cy="7" r="6" stroke="var(--accent)" strokeWidth="1.2" />
            <path
              d="M7 4v4M7 9.5v.5"
              stroke="var(--accent)"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          </svg>
          <div className="min-w-0">
            <span className="text-xs font-mono" style={{ color: "var(--muted)" }}>
              {partnerName}'s status —{" "}
            </span>
            <span className="text-xs font-serif italic" style={{ color: "var(--foreground)" }}>
              {partner.icebreaker}
            </span>
          </div>
        </div>
      )}

      {/* ── Messages ── */}
      <div
        className="flex-1 overflow-y-auto hide-scrollbar px-4 py-4"
        onClick={() => {
          if (!inputOpen && !isLocked) openInput();
        }}
        style={{ cursor: isLocked ? "default" : "text" }}
      >
        {/* First-in-room notice */}
        {ignitionMode === "first" && messages.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-center py-4"
          >
            <p
              className="text-xs font-mono uppercase tracking-widest"
              style={{ color: "var(--accent)" }}
            >
              You are first in this room.
            </p>
          </motion.div>
        )}

        {/* Partner inactivity notice (Item 8) */}
        {showInactiveNotice && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-center py-3"
          >
            <p
              className="text-xs font-mono text-center max-w-xs leading-relaxed"
              style={{ color: "var(--muted)" }}
            >
              {partnerName} hasn't been active in a while — they'll likely reply when they're back.
            </p>
          </motion.div>
        )}

        {/* Message groups */}
        <AnimatePresence initial={false}>
          {groups.map((group, gi) => (
            <motion.div
              key={`${group.senderId}-${gi}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={`flex gap-3 mb-4 ${group.isMe ? "flex-row-reverse" : "flex-row"}`}
            >
              {/* Avatar column */}
              <div className="flex-shrink-0 pt-0.5">
                <Avatar
                  name={group.isMe ? myName : partnerName}
                  avatarUrl={group.isMe ? myProfile?.avatarUrl : partner?.avatarUrl}
                  size={40}
                  colorVar={group.isMe ? "var(--accent)" : "var(--their-name)"}
                />
              </div>

              {/* Content column */}
              <div
                className={`flex flex-col gap-0.5 min-w-0 flex-1 ${
                  group.isMe ? "items-end" : "items-start"
                }`}
              >
                {/* Name + timestamp */}
                <div
                  className={`flex items-baseline gap-2 ${
                    group.isMe ? "flex-row-reverse" : "flex-row"
                  }`}
                >
                  <span
                    className="text-sm font-mono font-semibold"
                    style={{
                      color: group.isMe ? "var(--my-name)" : "var(--their-name)",
                    }}
                  >
                    {group.isMe ? myName : partnerName}
                  </span>
                  <span className="text-xs font-mono" style={{ color: "var(--muted)" }}>
                    {format(new Date(group.msgs[0].createdAt), "hh:mm a")}
                  </span>
                </div>

                {/* Each message in the group */}
                {group.msgs.map((msg, mi) => {
                  const quotedMsg = msg.replyToId ? msgMap.get(msg.replyToId) : null;
                  const quotedSender =
                    quotedMsg?.senderId === userId ? myName : partnerName;
                  return (
                    <div
                      key={msg.id}
                      className={`group/msg w-full ${
                        group.isMe
                          ? "flex flex-col items-end"
                          : "flex flex-col items-start"
                      }`}
                    >
                      {/* Reply quote */}
                      {quotedMsg && (
                        <button
                          className="reply-quote mb-1 max-w-[90%] text-left"
                          onClick={(e) => {
                            e.stopPropagation();
                          }}
                          style={{ color: "var(--muted)" }}
                        >
                          <strong
                            style={{
                              color: group.isMe
                                ? "var(--their-name)"
                                : "var(--my-name)",
                            }}
                          >
                            {quotedSender}:{" "}
                          </strong>
                          {quotedMsg.content.slice(0, 80)}
                          {quotedMsg.content.length > 80 ? "…" : ""}
                        </button>
                      )}

                      {/* Message row */}
                      <div
                        className={`flex items-end gap-2 ${
                          group.isMe ? "flex-row-reverse" : "flex-row"
                        }`}
                      >
                        {/* Message body: font-sans for readability (Item 4) */}
                        <p
                          className={`text-base font-sans leading-snug ${
                            mi === 0 && gi === 0 ? "text-lg" : ""
                          }`}
                          style={{ color: "var(--foreground)", maxWidth: "80%" }}
                        >
                          {msg.content}
                        </p>

                        {/* Reply button */}
                        {!isLocked && (
                          <button
                            className="opacity-0 group-hover/msg:opacity-100 focus:opacity-100 active:opacity-100 flex-shrink-0 p-1 rounded transition-opacity"
                            style={{ color: "var(--muted)" }}
                            onClick={(e) => {
                              e.stopPropagation();
                              startReply(
                                msg,
                                group.isMe ? myName : partnerName
                              );
                            }}
                            title="Reply"
                          >
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 14 14"
                              fill="none"
                            >
                              <path
                                d="M5 3L1 7l4 4M1 7h8a4 4 0 014 4"
                                stroke="currentColor"
                                strokeWidth="1.3"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </button>
                        )}
                      </div>
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
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-3 mb-4"
            >
              <Avatar
                name={partnerName}
                avatarUrl={partner?.avatarUrl}
                size={40}
                colorVar="var(--their-name)"
              />
              <div
                className="flex items-center gap-1 px-3 py-2 rounded-lg"
                style={{ background: "var(--surface)" }}
              >
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: "var(--muted)" }}
                    animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
                    transition={{ duration: 1, repeat: Infinity, delay: i * 0.18 }}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Locked state notice */}
        <AnimatePresence>
          {isLocked && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex justify-center py-4"
            >
              <div
                className="px-4 py-3 rounded-lg text-center"
                style={{ background: "var(--surface)" }}
              >
                <p className="text-xs font-mono" style={{ color: "var(--muted)" }}>
                  This room closed at midnight UTC.
                </p>
                <button
                  onClick={() => setLocation("/gallery")}
                  className="text-xs font-mono mt-1 transition-opacity"
                  style={{ color: "var(--accent)" }}
                >
                  View in Memories →
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={messagesEndRef} className="h-1" />
      </div>

      {/* ── Input area ── */}
      {!isLocked && (
        <>
          {/* Tap hint (when input is closed) */}
          <AnimatePresence>
            {!inputOpen && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ duration: 0.2 }}
                className="px-4 py-3"
                style={{
                  background: "var(--surface)",
                  borderTop: "1px solid var(--border)",
                }}
              >
                <button
                  onClick={openInput}
                  className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-left"
                  style={{ background: "var(--input-bg)" }}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path
                      d="M13.5 1.5a1.5 1.5 0 00-2.12 0L2 10.88V14h3.12l9.38-9.38a1.5 1.5 0 000-2.12z"
                      stroke="var(--muted)"
                      strokeWidth="1.2"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span className="text-sm font-mono" style={{ color: "var(--muted)" }}>
                    Message {partnerName}…
                  </span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Full input (when open) */}
          <AnimatePresence>
            {inputOpen && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 12 }}
                transition={{ duration: 0.2 }}
                style={{
                  background: "var(--surface)",
                  borderTop: "1px solid var(--border)",
                }}
              >
                {/* Reply banner */}
                <AnimatePresence>
                  {replyTo && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="flex items-center gap-2 px-4 py-2 overflow-hidden"
                      style={{ borderBottom: "1px solid var(--border)" }}
                    >
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 12 12"
                        fill="none"
                        className="flex-shrink-0"
                      >
                        <path
                          d="M4 2L1 5l3 3M1 5h6.5A3.5 3.5 0 0111 8.5v.5"
                          stroke="var(--accent)"
                          strokeWidth="1.3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      <p
                        className="text-xs font-mono flex-1 min-w-0 truncate"
                        style={{ color: "var(--muted)" }}
                      >
                        Replying to{" "}
                        <strong style={{ color: "var(--foreground)" }}>
                          {replyTo.senderName}
                        </strong>{" "}
                        — {replyTo.content.slice(0, 60)}
                        {replyTo.content.length > 60 ? "…" : ""}
                      </p>
                      <button
                        onClick={() => setReplyTo(null)}
                        className="flex-shrink-0 p-0.5 transition-opacity active:opacity-60"
                        style={{ color: "var(--muted)" }}
                      >
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path
                            d="M1 1l10 10M11 1L1 11"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                          />
                        </svg>
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Input row — auto-growing textarea (Item 3) */}
                <form
                  onSubmit={handleSend}
                  className="flex items-end gap-2 px-3 py-3"
                >
                  {/* Close */}
                  <button
                    type="button"
                    onClick={closeInput}
                    className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors mb-0.5"
                    style={{ background: "var(--border)", color: "var(--muted)" }}
                  >
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path
                        d="M1 1l8 8M9 1L1 9"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>

                  {/* Textarea wrapper */}
                  <div
                    className="flex-1 flex items-end rounded-lg px-4 py-2.5"
                    style={{ background: "var(--input-bg)", minHeight: 44 }}
                  >
                    <textarea
                      ref={inputRef}
                      value={input}
                      onChange={handleTyping}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSend();
                        }
                        if (e.key === "Escape") {
                          closeInput();
                        }
                      }}
                      placeholder={`Message ${partnerName}…`}
                      rows={1}
                      className="flex-1 w-full bg-transparent text-sm font-sans outline-none resize-none leading-relaxed"
                      style={{
                        color: "var(--foreground)",
                        caretColor: "var(--accent)",
                        maxHeight: "96px",
                        overflowY: "auto",
                      }}
                      maxLength={2000}
                    />
                  </div>

                  {/* Send */}
                  <motion.button
                    type="submit"
                    disabled={!input.trim()}
                    className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center disabled:opacity-30 transition-opacity mb-0.5"
                    style={{ background: "var(--accent)" }}
                    whileTap={{ scale: 0.9 }}
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M14 8L2 2l2.5 6L2 14l12-6z" fill="white" />
                    </svg>
                  </motion.button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      {/* ── End Room AlertDialog (Item 2) ── */}
      <AlertDialog open={endDialogOpen} onOpenChange={setEndDialogOpen}>
        <AlertDialogContent
          style={{
            background: "var(--surface)",
            borderColor: "var(--border)",
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle
              className="font-mono"
              style={{ color: "var(--foreground)" }}
            >
              End this room?
            </AlertDialogTitle>
            <AlertDialogDescription
              className="font-mono text-sm"
              style={{ color: "var(--muted)" }}
            >
              The room will close early. You won't be re-matched today.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="font-mono"
              style={{
                background: "var(--input-bg)",
                borderColor: "var(--border)",
                color: "var(--foreground)",
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="font-mono"
              style={{
                background: "var(--accent)",
                color: "white",
                borderColor: "transparent",
              }}
              onClick={() =>
                endMatch.mutate({
                  matchId: matchState.matchId,
                  data: { block: false },
                })
              }
            >
              End room
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Partner Profile Sheet (Item 5) ── */}
      <DialogPrimitive.Root open={partnerSheetOpen} onOpenChange={setPartnerSheetOpen}>
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
              borderRadius: "12px 12px 0 0",
              maxHeight: "60vh",
              overflowY: "auto",
              padding: "20px 24px 48px",
            }}
          >
            <DialogPrimitive.Title className="sr-only">
              {partnerName}'s profile
            </DialogPrimitive.Title>
            {/* Drag handle */}
            <div
              className="w-10 h-1 rounded-full mx-auto mb-6"
              style={{ background: "var(--border)" }}
            />

            <div className="flex flex-col items-center gap-4">
              <Avatar
                name={partnerName}
                avatarUrl={partner?.avatarUrl}
                size={80}
                colorVar="var(--their-name)"
              />
              <div className="text-center">
                <p
                  className="font-mono font-semibold text-lg"
                  style={{ color: "var(--their-name)" }}
                >
                  {partnerName}
                </p>
                {partner?.icebreaker && (
                  <p
                    className="text-sm font-serif italic mt-3 leading-relaxed px-2 max-w-xs"
                    style={{ color: "var(--foreground)" }}
                  >
                    "{partner.icebreaker}"
                  </p>
                )}
              </div>
            </div>

            <DialogPrimitive.Close
              className="absolute top-4 right-5 transition-opacity active:opacity-60"
              style={{ color: "var(--muted)" }}
              aria-label="Close"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path
                  d="M2 2l12 12M14 2L2 14"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </DialogPrimitive.Close>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </motion.div>
  );
}
