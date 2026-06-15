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
    if (!isAuthenticated) return;
    if (isAuthenticated && !profile) {
      const t = setTimeout(() => setLocation("/setup"), 1200);
      return () => clearTimeout(t);
    }
    if (isAuthenticated && profile) {
      const t = setTimeout(() => setLocation("/room"), 1200);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [isAuthenticated, authLoading, profile, profileLoading, setLocation]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-8 px-6">
      {/* Logo mark */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="flex flex-col items-center gap-5"
      >
        <div
          className="w-20 h-20 flex items-center justify-center rounded-[22px]"
          style={{ background: "hsl(211 100% 52%)" }}
        >
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <path
              d="M20 4C11.163 4 4 10.716 4 19c0 3.48 1.23 6.688 3.276 9.22L5.5 33.5l5.64-2.16C13.4 32.4 16.6 33 20 33c8.837 0 16-6.716 16-14S28.837 4 20 4z"
              fill="white"
              fillOpacity="0.95"
            />
            <circle cx="13" cy="19" r="2" fill="hsl(211 100% 52%)" />
            <circle cx="20" cy="19" r="2" fill="hsl(211 100% 52%)" />
            <circle cx="27" cy="19" r="2" fill="hsl(211 100% 52%)" />
          </svg>
        </div>

        <div className="text-center">
          <h1 className="text-4xl font-serif font-medium text-white tracking-tight">
            OneChat
          </h1>
          <p className="text-sm mt-1.5" style={{ color: "hsl(240 4% 55%)" }}>
            One conversation. One person. Every day.
          </p>
        </div>
      </motion.div>

      {/* Auth button */}
      {!authLoading && !isAuthenticated && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="flex flex-col items-center gap-3 w-full max-w-xs"
        >
          <button
            onClick={login}
            className="w-full py-3.5 rounded-xl text-white font-mono text-sm font-medium tracking-wide transition-opacity active:opacity-80"
            style={{ background: "hsl(211 100% 52%)" }}
          >
            Sign in with Replit
          </button>
          <p className="text-xs text-center" style={{ color: "hsl(240 4% 45%)" }}>
            Free · No ads · One match per day
          </p>
        </motion.div>
      )}

      {/* Loading state */}
      {(authLoading || (isAuthenticated && profileLoading)) && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex gap-1.5"
        >
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: "hsl(240 4% 55%)" }}
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
            />
          ))}
        </motion.div>
      )}
    </div>
  );
}
