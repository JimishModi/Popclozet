import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/SupabaseAuthContext";
import { getMyActiveClosetItemCount } from "@/services/ordersService";

export function useClosetCount(refreshIntervalMs = 60000) {
  const { user } = useAuth();
  const [closetCount, setClosetCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const loadClosetCount = useCallback(async () => {
    if (!user) {
      setClosetCount(0);
      setIsLoading(false);
      return;
    }

    try {
      const count = await getMyActiveClosetItemCount();
      setClosetCount(count);
    } catch (error) {
      console.error("[ClosetCount] Failed to load closet count:", error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void loadClosetCount();
  }, [loadClosetCount]);

  useEffect(() => {
    if (!user) return;

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") {
        void loadClosetCount();
      }
    };

    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    const intervalId =
      refreshIntervalMs > 0
        ? window.setInterval(() => {
            if (document.visibilityState === "visible") {
              void loadClosetCount();
            }
          }, refreshIntervalMs)
        : null;

    return () => {
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);

      if (intervalId !== null) {
        window.clearInterval(intervalId);
      }
    };
  }, [loadClosetCount, refreshIntervalMs, user]);

  return {
    closetCount,
    isLoading,
    refreshClosetCount: loadClosetCount,
  };
}

export default useClosetCount;
