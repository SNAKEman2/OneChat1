import { useCallback, useEffect, useState, useRef } from "react";
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
        return status === "waiting" ? 10000 : false;
      },
    },
  });

  useEffect(() => {
    if (matchState?.status === "no_profile") {
      setLocation("/setup");
    }
  }, [matchState, setLocation]);

  if (matchLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-1 h-1 bg-foreground/20 rounded-full animate-pulse" />
      </div>
    );
  }

  if (matchState?.status === "waiting") {
    return <Lounge profile={profile} />;
  }

  if (matchState?.status === "ended" || matchState?.status === "blocked") {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center relative filter grayscale">
        <h1 className="text-4xl font-serif text-foreground/40 mb-12">
          This room has closed.
        </h1>
        <button
          onClick={() => setLocation("/gallery")}
          className="text-foreground/50 hover:text-foreground transition-colors font-mono uppercase tracking-widest text-sm"
        >
          View memories
        </button>
      </div>
    );
  }

  if (matchState?.status === "active" && matchState.matchId) {
    return <ActiveRoom matchState={matchState} userId={user?.id || ""} />;
  }

  return null;
}

function Lounge({ profile }: { profile: any }) {
  const [icebreaker, setIcebreaker] = useState(profile?.icebreaker || "");
  const [isEditing, setIsEditing] = useState(false);
  const updateProfile = useUpdateMyProfile();

  const handleUpdate = () => {
    if (icebreaker !== profile?.icebreaker) {
      updateProfile.mutate({ data: { icebreaker } });
    }
    setIsEditing(false);
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 max-w-lg mx-auto w-full relative">
      <motion.div
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
        animate={{ opacity: [0.1, 0.3, 0.1] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      >
        <div className="w-64 h-64 border border-foreground/10 rounded-full" />
      </motion.div>

      <p className="font-mono text-xs text-foreground/40 uppercase tracking-widest mb-16">
        The Lounge
      </p>

      <div className="text-center w-full relative z-10">
        <p className="text-sm font-mono text-foreground/40 mb-4">
          Your current icebreaker:
        </p>

        {isEditing ? (
          <input
            type="text"
            value={icebreaker}
            onChange={(e) => setIcebreaker(e.target.value)}
            onBlur={handleUpdate}
            onKeyDown={(e) => e.key === "Enter" && handleUpdate()}
            autoFocus
            className="w-full bg-transparent border-none outline-none text-2xl font-serif text-foreground text-center"
          />
        ) : (
          <p
            className="text-2xl font-serif text-foreground cursor-pointer opacity-80 hover:opacity-100 transition-opacity"
            onClick={() => setIsEditing(true)}
          >
            {icebreaker || "No icebreaker set"}
          </p>
        )}
      </div>

      <p className="absolute bottom-24 font-mono text-xs text-foreground/30">
        Waiting for a match...
      </p>
    </div>
  );
}

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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Ignition gate
  const [ignitionMode, setIgnitionMode] = useState<IgnitionMode | null>(null);

  const sendMessage = useSendMessage();
  const endMatch = useEndMatch();

  const { data: initialMessages } = useGetMatchMessages(matchState.matchId, {
    query: {
      queryKey: getGetMatchMessagesQueryKey(matchState.matchId),
    },
  });

  const {
    messages: liveMessages,
    partnerTyping,
    sendTyping,
    ignitionResult,
    tapIgnition,
  } = useWebsocket(matchState.matchId, initialMessages || [], userId);

  const handleIgnitionDone = useCallback((mode: IgnitionMode) => {
    setIgnitionMode(mode);
  }, []);

  // Time remaining spine
  const [timeRatio, setTimeRatio] = useState(1);
  const [isLocked, setIsLocked] = useState(false);

  useEffect(() => {
    const updateTime = () => {
      if (!matchState.expiresAt) return;
      const now = new Date().getTime();
      const end = new Date(matchState.expiresAt).getTime();
      const start = new Date(
        matchState.matchDate || Date.now() - 86400000
      ).getTime();

      if (now >= end) {
        setTimeRatio(0);
        setIsLocked(true);
      } else {
        setTimeRatio(Math.max(0, (end - now) / (end - start)));
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, [matchState.expiresAt, matchState.matchDate]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [liveMessages, partnerTyping]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLocked) return;
    sendMessage.mutate({ matchId: matchState.matchId, data: { content: input } });
    setInput("");
    sendTyping(false);
  };

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
    sendTyping(e.target.value.length > 0);
  };

  // If ignition not yet resolved, show the ritual
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

  if (isLocked) {
    return (
      <motion.div
        initial={{ filter: "grayscale(0%)" }}
        animate={{ filter: "grayscale(100%)" }}
        transition={{ duration: 1.5 }}
        className="flex-1 flex flex-col items-center justify-center relative bg-background"
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5, duration: 1 }}
          className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 z-50 backdrop-blur-sm"
        >
          <p className="font-serif text-2xl mb-8">This room has closed.</p>
          <button
            onClick={() => setLocation("/gallery")}
            className="font-mono text-sm tracking-widest uppercase text-foreground/60 hover:text-foreground"
          >
            View memory
          </button>
        </motion.div>

        <div className="absolute inset-0 opacity-10 overflow-hidden pointer-events-none">
          {liveMessages.slice(-5).map((m) => (
            <div key={m.id} className="my-8 text-center font-serif text-xl">
              {m.content}
            </div>
          ))}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="flex-1 flex flex-col relative w-full h-[100dvh]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8 }}
    >
      {/* Time spine */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-foreground/5" />
      <motion.div
        className="absolute top-0 left-0 h-[1px] bg-foreground/20"
        style={{ width: `${timeRatio * 100}%` }}
        layout
      />

      <div className="flex-1 overflow-y-auto px-6 py-24 flex flex-col gap-12 w-full max-w-3xl mx-auto hide-scrollbar">
        {/* Partner reveal */}
        <div className="flex flex-col items-center justify-center mb-8 opacity-40">
          {matchState.partner?.avatarUrl && (
            <img
              src={matchState.partner.avatarUrl}
              alt={matchState.partner.displayName}
              className="w-10 h-10 rounded-none filter grayscale opacity-60 mb-4 object-cover"
            />
          )}
          <p className="font-mono text-xs uppercase tracking-widest">
            {matchState.partner?.displayName}
          </p>
        </div>

        {/* First-in-room context line */}
        {ignitionMode === "first" && liveMessages.length === 0 && (
          <motion.p
            className="font-mono text-[10px] uppercase tracking-[0.25em] text-foreground/25 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.2, delay: 0.4 }}
          >
            You are first in this room.
          </motion.p>
        )}

        {/* Messages */}
        <div className="flex flex-col gap-16">
          <AnimatePresence initial={false}>
            {liveMessages.map((msg, index) => {
              const isMe = msg.senderId === userId;
              // First-line rule: first message in the conversation
              const isFirstLine = index === 0;
              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: isFirstLine ? 12 : 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: isFirstLine ? 1.2 : 0.4,
                    ease: "easeOut",
                  }}
                  className={`w-full flex ${isMe ? "justify-end" : "justify-start"}`}
                >
                  <p
                    className={`font-serif max-w-[80%] leading-relaxed
                      ${isFirstLine ? "text-2xl sm:text-3xl tracking-wide" : "text-xl sm:text-2xl"}
                      ${isMe ? "text-right opacity-90" : "text-left opacity-70"}
                    `}
                  >
                    {msg.content}
                  </p>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {/* Typing indicator */}
          <AnimatePresence>
            {partnerTyping && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="w-full flex justify-start h-8"
              >
                <motion.div
                  animate={{
                    scale: [1, 1.05, 1],
                    opacity: [0.1, 0.3, 0.1],
                  }}
                  transition={{ duration: 3, repeat: Infinity }}
                  className="w-32 h-full bg-gradient-to-r from-foreground/10 to-transparent blur-xl"
                />
              </motion.div>
            )}
          </AnimatePresence>

          <div ref={messagesEndRef} className="h-24" />
        </div>
      </div>

      {/* Input area */}
      <div className="p-6 w-full max-w-3xl mx-auto relative bg-gradient-to-t from-background via-background to-transparent pt-12">
        <form onSubmit={handleSend} className="w-full">
          <input
            type="text"
            value={input}
            onChange={handleTyping}
            placeholder={
              ignitionMode === "second" && liveMessages.length === 0
                ? ""
                : "Type…"
            }
            autoFocus={ignitionMode === "first"}
            className="w-full bg-transparent border-none outline-none font-serif text-xl placeholder:text-foreground/20 text-foreground transition-opacity focus:opacity-100 opacity-60"
            disabled={isLocked}
          />
        </form>
      </div>

      {/* End match */}
      <div className="absolute top-6 right-6">
        <button
          onClick={() => {
            if (window.confirm("End this room early?")) {
              endMatch.mutate({
                matchId: matchState.matchId,
                data: { block: false },
              });
            }
          }}
          className="text-[10px] font-mono uppercase tracking-widest text-foreground/20 hover:text-foreground/60 transition-colors"
        >
          End Room
        </button>
      </div>
    </motion.div>
  );
}
