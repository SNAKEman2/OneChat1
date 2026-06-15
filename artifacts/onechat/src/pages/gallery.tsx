import { useLocation } from "wouter";
import { useGetMatchArchive } from "@workspace/api-client-react";
import { getGetMatchArchiveQueryKey } from "@/lib/query-keys";
import { motion } from "framer-motion";
import { format } from "date-fns";

export default function Gallery() {
  const [, setLocation] = useLocation();
  
  const { data: archive, isLoading } = useGetMatchArchive({
    query: { queryKey: getGetMatchArchiveQueryKey() }
  });

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-1 h-1 bg-foreground/20 rounded-full animate-pulse" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col max-w-3xl mx-auto w-full p-8 py-24">
      <h1 className="font-mono text-xs uppercase tracking-widest text-foreground/40 mb-16 text-center">
        Memories
      </h1>

      <div className="flex flex-col gap-0 w-full">
        {archive?.length === 0 ? (
          <p className="text-center font-serif italic text-foreground/30 mt-24">
            No memories yet.
          </p>
        ) : (
          archive?.map((match, index) => (
            <motion.div
              key={match.matchId}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1, duration: 0.5 }}
            >
              <div 
                onClick={() => setLocation(`/gallery/${match.matchId}`)}
                className="w-full flex items-center justify-between py-6 border-b border-foreground/5 cursor-pointer hover:bg-foreground/[0.02] transition-colors px-4 group"
              >
                <div className="flex items-center gap-6">
                  <span className="font-mono text-xs text-foreground/30 w-24">
                    {format(new Date(match.matchDate), "MMM dd, yyyy")}
                  </span>
                  <span className="font-serif text-lg text-foreground/70 group-hover:text-foreground transition-colors">
                    {match.partnerName}
                  </span>
                </div>
                <span className="font-mono text-[10px] text-foreground/20">
                  {match.messageCount} msg
                </span>
              </div>
            </motion.div>
          ))
        )}
      </div>

      <button 
        onClick={() => setLocation("/room")}
        className="mt-24 font-mono text-xs text-foreground/30 hover:text-foreground/60 transition-colors self-center uppercase tracking-widest"
      >
        Return to today
      </button>
    </div>
  );
}
