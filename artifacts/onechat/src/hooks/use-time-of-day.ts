import { useEffect, useState } from "react";

export type TimeOfDay = "morning" | "day" | "evening" | "midnight";

export function useTimeOfDay() {
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>("day");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      // UTC time for the global room expiration
      const hour = now.getUTCHours();
      
      let newTimeOfDay: TimeOfDay = "day";
      if (hour >= 6 && hour < 10) newTimeOfDay = "morning";
      else if (hour >= 10 && hour < 18) newTimeOfDay = "day";
      else if (hour >= 18 && hour < 22) newTimeOfDay = "evening";
      else newTimeOfDay = "midnight";

      setTimeOfDay(newTimeOfDay);
      document.documentElement.setAttribute("data-time", newTimeOfDay);
    };

    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  return timeOfDay;
}
