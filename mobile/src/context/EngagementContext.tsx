import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

type EngagementEvent = {
  topicId: number;
  delta: number;
  timestamp: number;
};

type EngagementContextValue = {
  xpToday: number;
  streakDays: number;
  lastEarnedXp: number | null;
  xpEventId: number | null;
  streakEventId: number | null;
  masteryEvent: EngagementEvent | null;
  triggerXpPopup: (amount: number) => void;
  triggerStreakAnimation: (nextStreak?: number) => void;
  triggerMasteryUpdate: (topicId: number, delta: number) => void;
  resetDailyCounters: () => void;
  clearXpPopup: () => void;
  clearMasteryEvent: () => void;
  clearStreakEvent: () => void;
};

export const EngagementContext = createContext<EngagementContextValue | undefined>(undefined);

const XP_KEY = "engagement_xpToday";
const STREAK_KEY = "engagement_streakDays";

export const EngagementContextProvider = ({ children }: { children: React.ReactNode }) => {
  const [xpToday, setXpToday] = useState(0);
  const [streakDays, setStreakDays] = useState(0);
  const [lastEarnedXp, setLastEarnedXp] = useState<number | null>(null);
  const [xpEventId, setXpEventId] = useState<number | null>(null);
  const [streakEventId, setStreakEventId] = useState<number | null>(null);
  const [masteryEvent, setMasteryEvent] = useState<EngagementEvent | null>(null);

  useEffect(() => {
    const hydrate = async () => {
      const [storedXp, storedStreak] = await Promise.all([AsyncStorage.getItem(XP_KEY), AsyncStorage.getItem(STREAK_KEY)]);
      if (storedXp) {
        const parsed = Number(storedXp);
        if (!Number.isNaN(parsed)) {
          setXpToday(parsed);
        }
      }
      if (storedStreak) {
        const parsed = Number(storedStreak);
        if (!Number.isNaN(parsed)) {
          setStreakDays(parsed);
        }
      }
    };
    hydrate();
  }, []);

  const triggerXpPopup = useCallback(async (amount: number) => {
    if (!amount || Number.isNaN(amount)) {
      return;
    }
    setLastEarnedXp(amount);
    setXpEventId(Date.now());
    setXpToday((prev) => {
      const next = prev + amount;
      AsyncStorage.setItem(XP_KEY, String(next)).catch(() => {});
      return next;
    });
  }, []);

  const triggerStreakAnimation = useCallback((nextStreak?: number) => {
    setStreakDays((prev) => {
      const value = typeof nextStreak === "number" ? nextStreak : prev + 1;
      AsyncStorage.setItem(STREAK_KEY, String(value)).catch(() => {});
      return value;
    });
    setStreakEventId(Date.now());
  }, []);

  const triggerMasteryUpdate = useCallback((topicId: number, delta: number) => {
    if (!delta) {
      return;
    }
    setMasteryEvent({
      topicId,
      delta,
      timestamp: Date.now(),
    });
  }, []);

  const resetDailyCounters = useCallback(() => {
    setXpToday(0);
    AsyncStorage.removeItem(XP_KEY).catch(() => {});
  }, []);

  const clearXpPopup = useCallback(() => {
    setLastEarnedXp(null);
    setXpEventId(null);
  }, []);

  const clearMasteryEvent = useCallback(() => {
    setMasteryEvent(null);
  }, []);

  const clearStreakEvent = useCallback(() => {
    setStreakEventId(null);
  }, []);

  const value = useMemo<EngagementContextValue>(
    () => ({
      xpToday,
      streakDays,
      lastEarnedXp,
      xpEventId,
      streakEventId,
      masteryEvent,
      triggerXpPopup,
      triggerStreakAnimation,
      triggerMasteryUpdate,
      resetDailyCounters,
      clearXpPopup,
      clearMasteryEvent,
      clearStreakEvent,
    }),
    [
      xpToday,
      streakDays,
      lastEarnedXp,
      xpEventId,
      streakEventId,
      masteryEvent,
      triggerXpPopup,
      triggerStreakAnimation,
      triggerMasteryUpdate,
      resetDailyCounters,
      clearXpPopup,
      clearMasteryEvent,
    ],
  );

  return <EngagementContext.Provider value={value}>{children}</EngagementContext.Provider>;
};
