import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AnimatePresence, motion } from "framer-motion";
import { useTheme } from "@/hooks/use-theme";

import NotFound from "@/pages/not-found";
import Splash from "@/pages/splash";
import Setup from "@/pages/setup";
import Room from "@/pages/room";
import Gallery from "@/pages/gallery";
import FrozenRoom from "@/pages/frozen-room";
import Settings from "@/pages/settings";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function AnimatedRouter() {
  const [location] = useLocation();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location}
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -5 }}
        transition={{ duration: 0.6, ease: "easeInOut" }}
        className="min-h-[100dvh] w-full flex flex-col items-stretch"
      >
        <Switch location={location}>
          <Route path="/" component={Splash} />
          <Route path="/setup" component={Setup} />
          <Route path="/room" component={Room} />
          <Route path="/gallery" component={Gallery} />
          <Route path="/gallery/:matchId" component={FrozenRoom} />
          <Route path="/settings" component={Settings} />
          <Route component={NotFound} />
        </Switch>
      </motion.div>
    </AnimatePresence>
  );
}

function App() {
  useTheme();

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AnimatedRouter />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
