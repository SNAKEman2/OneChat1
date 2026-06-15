import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import {
  useGetTodayMatch,
  useGetMatchMessages,
  useSendMessage,
  useEndMatch,
  useUpdateMyProfile,
  useGetMyProfile,
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

/* ─── Shared Avatar ─────────────────────────────────────────── */
function Avatar({
  name,
  avatarUrl,
  size = 36,
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
        background: "hsl(211 60% 38%)",
      }}
    >
      {initials}
    </div>
  );
}

/* ─── Root Page ──────────────────────────────────────────────── */
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
      refetchInterval: (query) => {
        const status = query.state.data?.status;
        return status === "waiting" ? 8000 : false;
      },
    },
  });

  useEffect(() => {
    if (matchState?.status === "no_profile") setLocation("/setup");
  }, [matchState, setLocation]);

  if (matchLoading) {
    return (
      <div
        className="flex-1 flex items-center justify-center"
        style={{ background: "hsl(220 13% 11%)" }}
      >
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
    );
  }

  if (matchState?.status === "waiting") {
    return <Lounge profile={profile} />;
  }

  if (matchState?.status === "ended" || matchState?.status === "blocked") {
    return <EndedRoom matchState={matchState} />;
  }

  if (matchState?.status === "active" && matchState.matchId) {
    return <ActiveRoom matchState={matchState} userId={user?.id || ""} />;
  }

  return null;
}

/* ─── Lounge (waiting for match) ────────────────────────────── */
function Lounge({ profile }: { profile: any }) {
  const [, setLocation] = useLocation();
  const [icebreaker, setIcebreaker] = useState(profile?.icebreaker || "");
  const [editing, setEditing] = useState(false);
  const updateProfile = useUpdateMyProfile();

  const handleUpdate = () => {
    if (icebreaker.trim() && icebreaker !== profile?.icebreaker) {
      updateProfile.mutate({ data: { icebreaker: icebreaker.trim() } });
    }
    setEditing(false);
  };

  return (
    <div
      className="flex-1 flex flex-col"
      style={{ background: "hsl(220 13% 11%)" }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 pt-14 pb-4"
        style={{ borderBottom: "1px solid hsl(240 4% 22%)" }}
      >
        <div className="flex items-center gap-3">
          {profile && (
            <Avatar
              name={profile.displayName}
              avatarUrl={profile.avatarUrl}
              size={36}
            />
          )}
          <div>
            <p className="text-base font-serif font-medium text-white">
              {profile?.displayName ?? "You"}
            </p>
            <p className="text-xs font-mono" style={{ color: "hsl(240 4% 55%)" }}>
              OneChat
            </p>
          </div>
        </div>
        <button
          onClick={() => setLocation("/gallery")}
          className="font-mono text-xs uppercase tracking-widest transition-opacity active:opacity-60"
          style={{ color: "hsl(240 4% 45%)" }}
        >
          Memories
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 gap-8">
        {/* Pulsing search indicator */}
        <div className="flex flex-col items-center gap-5">
          <motion.div
            className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{ background: "hsl(240 5% 17%)" }}
            animate={{ scale: [1, 1.06, 1], opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          >
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <path
                d="M14 3C8.477 3 4 7.477 4 13c0 2.2.713 4.24 1.92 5.9L4.5 23l4.36-1.66A9.944 9.944 0 0014 23c5.523 0 10-4.477 10-10S19.523 3 14 3z"
                stroke="hsl(211 100% 62%)"
                strokeWidth="1.5"
                fill="none"
                strokeLinejoin="round"
              />
            </svg>
          </motion.div>

          <div className="text-center">
            <p className="text-base font-serif text-white">Finding your match…</p>
            <p
              className="text-sm font-mono mt-1"
              style={{ color: "hsl(240 4% 45%)" }}
            >
              You'll be matched with one person today
            </p>
          </div>
        </div>

        {/* Icebreaker card */}
        <div
          className="w-full max-w-sm rounded-2xl p-5"
          style={{ background: "hsl(240 5% 17%)", border: "1px solid hsl(240 4% 22%)" }}
        >
          <p
            className="text-xs font-mono uppercase tracking-widest mb-3"
            style={{ color: "hsl(240 4% 45%)" }}
          >
            Your icebreaker
          </p>
          {editing ? (
            <input
              type="text"
              value={icebreaker}
              onChange={(e) => setIcebreaker(e.target.value)}
              onBlur={handleUpdate}
              onKeyDown={(e) => e.key === "Enter" && handleUpdate()}
              autoFocus
              maxLength={280}
              className="w-full bg-transparent text-white font-serif text-base outline-none"
            />
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="w-full text-left text-base font-serif text-white"
            >
              {icebreaker || (
                <span style={{ color: "hsl(240 4% 40%)" }}>
                  Tap to add an icebreaker…
                </span>
              )}
            </button>
          )}
          <p className="text-xs font-mono mt-3" style={{ color: "hsl(240 4% 35%)" }}>
            Tap to edit · shown to your match
          </p>
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
      className="flex-1 flex flex-col items-center justify-center gap-6 px-6 text-center"
      style={{ background: "hsl(220 13% 11%)" }}
    >
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center"
        style={{ background: "hsl(240 5% 17%)" }}
      >
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
          <circle cx="14" cy="14" r="11" stroke="hsl(240 4% 45%)" strokeWidth="1.5" />
          <path
            d="M10 10l8 8M18 10l-8 8"
            stroke="hsl(240 4% 45%)"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <div>
        <p className="text-lg font-serif text-white">
          {matchState.status === "blocked" ? "Room closed." : "This room has ended."}
        </p>
        <p className="text-sm font-mono mt-1.5" style={{ color: "hsl(240 4% 45%)" }}>
          A new match awaits tomorrow at midnight UTC.
        </p>
      </div>
      <button
        onClick={() => setLocation("/gallery")}
        className="px-6 py-3 rounded-xl font-mono text-sm text-white transition-opacity active:opacity-70"
        style={{ background: "hsl(240 5% 17%)", border: "1px solid hsl(240 4% 28%)" }}
      >
        View memories
      </button>
    </div>
  );
}

/* ─── Active Room ────────────────────────────────────────────── */
type IgnitionMode = "first" | "second" | "shared";

function ActiveRoom({
  matchState,
  userId,
}: {
  matchState: any;
  userId: string;
}) {
  const [, setLocation] = useLocation();
  const [input, setInput] = useState("");
  const [ignitionMode, setIgnitionMode] = useState<IgnitionMode | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const sendMessage = useSendMessage();
  const endMatch = useEndMatch();

  const { data: initialMessages } = useGetMatchMessages(matchState.matchId, {
    query: { queryKey: getGetMatchMessagesQueryKey(matchState.matchId) },
  });

  const { messages, partnerTyping, sendTyping, ignitionResult, tapIgnition } =
    useWebsocket(matchState.matchId, initialMessages || [], userId);

  const handleIgnitionDone = useCallback((mode: IgnitionMode) => {
    setIgnitionMode(mode);
    setTimeout(() => inputRef.current?.focus(), 300);
  }, []);

  // Time remaining for the room
  const [timeLeft, setTimeLeft] = useState("");
  const [isLocked, setIsLocked] = useState(false);

  useEffect(() => {
    const update = () => {
      if (!matchState.expiresAt) return;
      const now = Date.now();
      const end = new Date(matchState.expiresAt).getTime();
      const diff = end - now;
      if (diff <= 0) { setIsLocked(true); setTimeLeft("Expired"); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setTimeLeft(h > 0 ? `${h}h ${m}m left` : `${m}m left`);
    };
    update();
    const id = setInterval(update, 30000);
    return () => clearInterval(id);
  }, [matchState.expiresAt]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, partnerTyping]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || isLocked) return;
    sendMessage.mutate({ matchId: matchState.matchId, data: { content: text } });
    setInput("");
    sendTyping(false);
  };

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
    sendTyping(e.target.value.length > 0);
  };

  // Show ignition first
  if (!ignitionMode) {
    return (
      <AnimatePresence mode="wait">
        <Ignition
          key="ignition"
          partner={matchState.partner}
          userId={userId}
          ignitionResult={ignitionResult}
          onTap={tapIgnition}
          onDone={handleIgnitionDone}
        />
      </AnimatePresence>
    );
  }

  const partner = matchState.partner;

  return (
    <motion.div
      className="flex-1 flex flex-col h-full"
      style={{ background: "hsl(220 13% 11%)" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      {/* ── Header ── */}
      <div
        className="flex items-center gap-3 px-4 pt-14 pb-3"
        style={{ borderBottom: "1px solid hsl(240 4% 22%)", background: "hsl(240 5% 17%)" }}
      >
        <button
          onClick={() => setLocation("/gallery")}
          style={{ color: "hsl(211 100% 62%)" }}
          className="mr-1 flex-shrink-0 transition-opacity active:opacity-60"
        >
          <svg width="9" height="15" viewBox="0 0 9 15" fill="none">
            <path
              d="M8 1L2 7.5 8 14"
              stroke="hsl(211 100% 62%)"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        {partner && (
          <Avatar name={partner.displayName} avatarUrl={partner.avatarUrl} size={38} />
        )}

        <div className="flex-1 min-w-0">
          <p className="text-base font-serif font-medium text-white truncate">
            {partner?.displayName ?? "Your match"}
          </p>
          <p className="text-xs font-mono" style={{ color: "hsl(240 4% 50%)" }}>
            {isLocked ? "Room closed" : timeLeft}
          </p>
        </div>

        {/* End room */}
        {!isLocked && (
          <button
            onClick={() => {
              if (window.confirm("End this room early?")) {
                endMatch.mutate({ matchId: matchState.matchId, data: { block: false } });
              }
            }}
            className="text-[11px] font-mono uppercase tracking-widest flex-shrink-0 transition-opacity active:opacity-60"
            style={{ color: "hsl(240 4% 38%)" }}
          >
            End
          </button>
        )}
      </div>

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto hide-scrollbar px-4 py-4 flex flex-col gap-1.5">

        {/* Partner icebreaker as a system message */}
        {partner?.icebreaker && (
          <div className="flex justify-center py-3">
            <p
              className="text-xs font-serif italic text-center max-w-xs px-3 py-2 rounded-xl"
              style={{
                color: "hsl(240 4% 55%)",
                background: "hsl(240 5% 17%)",
              }}
            >
              {partner.icebreaker}
            </p>
          </div>
        )}

        {/* First-in-room notice */}
        {ignitionMode === "first" && messages.length === 0 && (
          <motion.div
            className="flex justify-center py-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8 }}
          >
            <p
              className="text-[11px] font-mono uppercase tracking-widest"
              style={{ color: "hsl(211 100% 62%)" }}
            >
              You are first in this room.
            </p>
          </motion.div>
        )}

        {/* Message bubbles */}
        <AnimatePresence initial={false}>
          {messages.map((msg, index) => {
            const isMe = msg.senderId === userId;
            const isFirst = index === 0;
            const showTime =
              index === messages.length - 1 ||
              new Date(messages[index + 1]?.createdAt).getTime() -
                new Date(msg.createdAt).getTime() >
                5 * 60 * 1000;

            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{
                  duration: isFirst ? 0.8 : 0.25,
                  ease: "easeOut",
                }}
                className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
              >
                <div
                  className={isMe ? "bubble-mine" : "bubble-theirs"}
                  style={{
                    padding: "10px 14px",
                    maxWidth: "78%",
                    fontSize: isFirst ? "1.2rem" : "1rem",
                    lineHeight: 1.45,
                    fontFamily: "var(--font-serif)",
                    letterSpacing: isFirst ? "0.01em" : "normal",
                  }}
                >
                  {msg.content}
                </div>
                {showTime && (
                  <p
                    className="text-[10px] font-mono mt-1 mx-1"
                    style={{ color: "hsl(240 4% 40%)" }}
                  >
                    {format(new Date(msg.createdAt), "HH:mm")}
                  </p>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* Typing indicator */}
        <AnimatePresence>
          {partnerTyping && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-start"
            >
              <div
                className="bubble-theirs flex items-center gap-1"
                style={{ padding: "12px 16px" }}
              >
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: "hsl(240 4% 65%)" }}
                    animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
                    transition={{ duration: 1, repeat: Infinity, delay: i * 0.18 }}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Lock state overlay */}
        <AnimatePresence>
          {isLocked && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex justify-center py-4"
            >
              <div
                className="px-4 py-2 rounded-xl text-center"
                style={{ background: "hsl(240 5% 17%)" }}
              >
                <p className="text-xs font-mono" style={{ color: "hsl(240 4% 55%)" }}>
                  This room closed at midnight UTC.
                </p>
                <button
                  onClick={() => setLocation("/gallery")}
                  className="text-xs font-mono mt-1 transition-opacity"
                  style={{ color: "hsl(211 100% 62%)" }}
                >
                  View in Memories →
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={messagesEndRef} className="h-2" />
      </div>

      {/* ── Input bar ── */}
      {!isLocked && (
        <div
          className="flex items-end gap-3 px-4 py-3"
          style={{
            borderTop: "1px solid hsl(240 4% 22%)",
            background: "hsl(240 5% 17%)",
          }}
        >
          <div
            className="flex-1 flex items-center rounded-full px-4 py-2.5"
            style={{
              background: "hsl(240 4% 23%)",
              border: "1px solid hsl(240 4% 28%)",
              minHeight: 44,
            }}
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={handleTyping}
              onKeyDown={(e) => e.key === "Enter" && handleSend(e)}
              placeholder="Message…"
              className="flex-1 bg-transparent text-white text-base font-serif outline-none placeholder-opacity-30"
              style={{
                fontFamily: "var(--font-serif)",
                caretColor: "hsl(211 100% 62%)",
              }}
              disabled={isLocked}
            />
          </div>

          <motion.button
            onClick={handleSend}
            disabled={!input.trim() || isLocked}
            className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 transition-opacity disabled:opacity-30"
            style={{ background: "hsl(211 100% 52%)" }}
            whileTap={{ scale: 0.9 }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path
                d="M16 9L2 2l3 7-3 7 14-7z"
                fill="white"
                strokeLinejoin="round"
              />
            </svg>
          </motion.button>
        </div>
      )}
    </motion.div>
  );
}
