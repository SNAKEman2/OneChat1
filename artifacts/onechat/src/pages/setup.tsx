import { useState } from "react";
import { useLocation } from "wouter";
import { useSetupProfile } from "@workspace/api-client-react";
import { motion } from "framer-motion";
import { useAuth } from "@workspace/replit-auth-web";

export default function Setup() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  
  const [displayName, setDisplayName] = useState("");
  const [icebreaker, setIcebreaker] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  
  const setupProfile = useSetupProfile();

  if (!authLoading && !isAuthenticated) {
    setLocation("/");
    return null;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName || !icebreaker) return;
    
    setupProfile.mutate(
      { data: { displayName, icebreaker, avatarUrl: avatarUrl || undefined } },
      {
        onSuccess: () => {
          setLocation("/room");
        },
      }
    );
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 max-w-lg mx-auto w-full">
      <motion.form 
        onSubmit={handleSubmit}
        className="w-full flex flex-col gap-12"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5, duration: 1 }}
      >
        <div className="flex flex-col gap-2">
          <label className="text-foreground/40 text-xs font-mono tracking-widest uppercase">Name</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full bg-transparent border-none outline-none text-3xl font-serif placeholder:text-foreground/10 text-foreground"
            placeholder="Who are you?"
            autoFocus
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-foreground/40 text-xs font-mono tracking-widest uppercase">Icebreaker</label>
          <input
            type="text"
            value={icebreaker}
            onChange={(e) => setIcebreaker(e.target.value)}
            className="w-full bg-transparent border-none outline-none text-2xl font-serif placeholder:text-foreground/10 text-foreground"
            placeholder="A thought to share..."
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-foreground/40 text-xs font-mono tracking-widest uppercase">Avatar URL (Optional)</label>
          <input
            type="url"
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            className="w-full bg-transparent border-none outline-none text-sm font-mono placeholder:text-foreground/10 text-foreground/70"
            placeholder="https://..."
          />
          {avatarUrl && (
            <motion.img 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              src={avatarUrl} 
              alt="Avatar preview" 
              className="w-16 h-16 object-cover opacity-80 mt-4 filter grayscale contrast-125"
              onError={(e) => (e.currentTarget.style.display = 'none')}
              onLoad={(e) => (e.currentTarget.style.display = 'block')}
            />
          )}
        </div>

        <motion.div 
          className="mt-12 flex justify-end"
          animate={{ opacity: displayName && icebreaker ? 1 : 0.2 }}
        >
          <button
            type="submit"
            disabled={!displayName || !icebreaker || setupProfile.isPending}
            className="text-foreground/60 hover:text-foreground transition-colors tracking-widest text-sm font-mono uppercase cursor-pointer bg-transparent border-none outline-none disabled:cursor-default"
          >
            {setupProfile.isPending ? "Opening..." : "Begin"}
          </button>
        </motion.div>
      </motion.form>
    </div>
  );
}
