import { useParams, useLocation } from "wouter";
import { useGetMatchMessages } from "@workspace/api-client-react";
import { getGetMatchMessagesQueryKey } from "@/lib/query-keys";
import { useAuth } from "@workspace/replit-auth-web";
import { motion } from "framer-motion";
import { format } from "date-fns";

export default function FrozenRoom() {
  const { matchId } = useParams();
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  const { data: messages, isLoading } = useGetMatchMessages(matchId || "", {
    query: {
      enabled: !!matchId,
      queryKey: getGetMatchMessagesQueryKey(matchId || ""),
    },
  });

  return (
    <div
      className="flex-1 flex flex-col h-full"
      style={{ background: "hsl(220 13% 11%)" }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 pt-14 pb-4"
        style={{ borderBottom: "1px solid hsl(240 4% 22%)" }}
      >
        <button
          onClick={() => setLocation("/gallery")}
          className="flex items-center gap-1 font-mono text-sm transition-opacity active:opacity-60"
          style={{ color: "hsl(211 100% 62%)" }}
        >
          <svg width="8" height="14" viewBox="0 0 8 14" fill="none">
            <path
              d="M7 1L1 7l6 6"
              stroke="hsl(211 100% 62%)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Back
        </button>
        <div className="flex-1 text-center">
          <p className="text-sm font-mono" style={{ color: "hsl(240 4% 55%)" }}>
            Memory
          </p>
        </div>
        <div className="w-16" />
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto hide-scrollbar px-4 py-4 flex flex-col gap-2">
        {isLoading && (
          <div className="flex items-center justify-center py-12">
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

        {!isLoading && messages?.length === 0 && (
          <div className="flex items-center justify-center flex-1">
            <p className="font-serif italic" style={{ color: "hsl(240 4% 38%)" }}>
              Silence.
            </p>
          </div>
        )}

        {messages?.map((msg, i) => {
          const isMe = msg.senderId === user?.id;
          return (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.7 }}
              transition={{ delay: i * 0.02, duration: 0.4 }}
              className={`flex ${isMe ? "justify-end" : "justify-start"}`}
            >
              <div
                className={isMe ? "bubble-mine" : "bubble-theirs"}
                style={{
                  padding: "10px 14px",
                  maxWidth: "75%",
                  filter: "grayscale(30%)",
                }}
              >
                <p className="font-serif text-base leading-relaxed">
                  {msg.content}
                </p>
                <p
                  className="text-[10px] font-mono mt-1 text-right"
                  style={{ opacity: 0.6 }}
                >
                  {format(new Date(msg.createdAt), "HH:mm")}
                </p>
              </div>
            </motion.div>
          );
        })}

        <div className="h-6" />
      </div>
    </div>
  );
}
