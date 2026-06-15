import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@workspace/replit-auth-web";
import { useGetMyProfile } from "@workspace/api-client-react";
import { getGetMyProfileQueryKey } from "@/lib/query-keys";
import { motion } from "framer-motion";

export default function Splash() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading: authLoading, login } = useAuth();
  const { data: profile, isLoading: profileLoading } = useGetMyProfile({
    query: {
      enabled: isAuthenticated,
      queryKey: getGetMyProfileQueryKey(),
      retry: false,
    },
  });

  useEffect(() => {
    if (authLoading || (isAuthenticated && profileLoading)) return;

    if (!isAuthenticated) {
      // Stay on splash, show login
      return;
    }

    if (isAuthenticated && !profile) {
      const timer = setTimeout(() => setLocation("/setup"), 2000);
      return () => clearTimeout(timer);
    }

    if (isAuthenticated && profile) {
      const timer = setTimeout(() => setLocation("/room"), 2000);
      return () => clearTimeout(timer);
    }

    return undefined;
  }, [isAuthenticated, authLoading, profile, profileLoading, setLocation]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center relative overflow-hidden">
      <motion.div
        className="w-[1px] h-32 bg-foreground/40 origin-center"
        animate={{
          scaleY: [1, 1.5, 1],
          opacity: [0.3, 0.7, 0.3],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
      
      {!authLoading && !isAuthenticated && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2, duration: 1 }}
          className="absolute bottom-24"
        >
          <button
            onClick={() => login()}
            className="text-foreground/60 hover:text-foreground transition-colors tracking-widest text-sm font-mono uppercase cursor-pointer bg-transparent border-none outline-none"
          >
            Enter
          </button>
        </motion.div>
      )}
    </div>
  );
}
