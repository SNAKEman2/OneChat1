import { useParams, useLocation } from "wouter";
import { useGetMatchMessages } from "@workspace/api-client-react";
import { getGetMatchMessagesQueryKey } from "@/lib/query-keys";
import { useAuth } from "@workspace/replit-auth-web";

export default function FrozenRoom() {
  const { matchId } = useParams();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  
  const { data: messages, isLoading } = useGetMatchMessages(matchId || "", {
    query: {
      enabled: !!matchId,
      queryKey: getGetMatchMessagesQueryKey(matchId || ""),
    }
  });

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-1 h-1 bg-foreground/20 rounded-full animate-pulse" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col relative w-full h-[100dvh] bg-background filter grayscale contrast-75">
      <div className="absolute top-6 left-6 z-10">
        <button
          onClick={() => setLocation("/gallery")}
          className="text-xs font-mono uppercase tracking-widest text-foreground/40 hover:text-foreground transition-colors"
        >
          Back
        </button>
      </div>

      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03] z-0">
        <p className="font-serif text-[10rem] select-none">MEMORY</p>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-24 flex flex-col gap-12 w-full max-w-3xl mx-auto hide-scrollbar z-10">
        <div className="flex flex-col gap-16">
          {messages?.map((msg) => {
            const isMe = msg.senderId === user?.id;
            return (
              <div
                key={msg.id}
                className={`w-full flex ${isMe ? "justify-end" : "justify-start"}`}
              >
                <p className={`font-serif text-xl sm:text-2xl max-w-[80%] leading-relaxed
                  ${isMe ? "text-right opacity-60" : "text-left opacity-40"}
                `}>
                  {msg.content}
                </p>
              </div>
            );
          })}
          {messages?.length === 0 && (
            <p className="text-center font-serif italic text-foreground/30 mt-24">
              Silence.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
