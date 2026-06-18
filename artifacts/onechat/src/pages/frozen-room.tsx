import { useParams, useLocation } from "wouter";
import { useGetMatchMessages } from "@workspace/api-client-react";
import { getGetMatchMessagesQueryKey } from "@/lib/query-keys";
import { useAuth } from "@workspace/replit-auth-web";
import { motion } from "framer-motion";
import { format } from "date-fns";

function Avatar({ name, avatarUrl, size = 40 }: { name: string; avatarUrl?: string | null; size?: number }) {
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
  const initials = name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div
      className="rounded-full flex items-center justify-center flex-shrink-0 text-white font-mono font-medium"
      style={{ width: size, height: size, fontSize: size * 0.33, background: "#5865F2" }}
    >
      {initials}
    </div>
  );
}

export default function FrozenRoom() {
  const { matchId } = useParams();
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  const { data: messages, isLoading } = useGetMatchMessages(matchId || "", undefined, {
    query: {
      enabled: !!matchId,
      queryKey: getGetMatchMessagesQueryKey(matchId || ""),
    },
  });

  // Group consecutive messages by sender
  const grouped: Array<{
    senderId: string;
    messages: typeof messages;
    firstTime: string;
  }> = [];
  for (const msg of messages ?? []) {
    const last = grouped[grouped.length - 1];
    if (last && last.senderId === msg.senderId) {
      last.messages!.push(msg);
    } else {
      grouped.push({ senderId: msg.senderId, messages: [msg], firstTime: msg.createdAt });
    }
  }

  const myId = user?.id ?? "";

  return (
    <div className="flex-1 flex flex-col" style={{ background: "var(--background)", filter: "grayscale(25%) brightness(0.85)" }}>
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 pt-14 pb-3"
        style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}
      >
        <button
          onClick={() => setLocation("/gallery")}
          className="flex items-center gap-1.5 font-mono text-sm transition-opacity active:opacity-60"
          style={{ color: "var(--accent)" }}
        >
          <svg width="8" height="14" viewBox="0 0 8 14" fill="none">
            <path d="M7 1L1 7l6 6" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back
        </button>
        <p className="flex-1 text-center text-sm font-mono" style={{ color: "var(--muted)" }}>
          # memory
        </p>
        <div className="w-12" />
      </div>

      <div className="flex-1 overflow-y-auto hide-scrollbar px-4 py-4">
        {isLoading && (
          <div className="flex justify-center py-8">
            <div className="flex gap-1.5">
              {[0, 1, 2].map((i) => (
                <motion.div key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--muted)" }}
                  animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }} />
              ))}
            </div>
          </div>
        )}

        {!isLoading && messages?.length === 0 && (
          <p className="text-center font-mono text-sm py-12" style={{ color: "var(--muted)" }}>
            Silence.
          </p>
        )}

        {grouped.map((group, gi) => {
          const isMe = group.senderId === myId;
          return (
            <div key={gi} className={`flex gap-3 mb-4 ${isMe ? "flex-row-reverse" : "flex-row"}`}>
              {/* Avatar */}
              <div className="flex flex-col items-center pt-0.5">
                <Avatar name={isMe ? "You" : "Partner"} size={40} />
              </div>
              {/* Messages */}
              <div className={`flex flex-col gap-0.5 max-w-[75%] ${isMe ? "items-end" : "items-start"}`}>
                {/* Name + time */}
                <div className={`flex items-baseline gap-2 ${isMe ? "flex-row-reverse" : "flex-row"}`}>
                  <span className="text-sm font-mono font-medium" style={{ color: isMe ? "var(--my-name)" : "var(--their-name)" }}>
                    {isMe ? "You" : "Partner"}
                  </span>
                  <span className="text-xs font-mono" style={{ color: "var(--muted)" }}>
                    {format(new Date(group.firstTime), "hh:mm a")}
                  </span>
                </div>
                {/* Message texts */}
                {group.messages?.map((msg) => (
                  <p key={msg.id} className={`text-base font-serif leading-relaxed ${isMe ? "text-right" : "text-left"}`}
                    style={{ color: "var(--foreground)" }}>
                    {msg.content}
                  </p>
                ))}
              </div>
            </div>
          );
        })}
        <div className="h-6" />
      </div>
    </div>
  );
}
