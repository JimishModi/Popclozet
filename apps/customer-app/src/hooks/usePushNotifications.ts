/**
 * usePushNotifications — React hook for Web Push subscription management
 *
 * Exposes:
 *  - isSupported    — browser supports Web Push
 *  - permission     — current Notification.permission
 *  - isSubscribed   — user has an active push subscription
 *  - isLoading      — async operations in progress
 *  - error          — last error message
 *  - subscribe()    — request permission + subscribe + save
 *  - unsubscribe()  — unsubscribe + remove from server
 *  - sendTest()     — fire a test push notification
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  isPushSupported,
  getPermissionState,
  getExistingSubscription,
  subscribeToPush,
  unsubscribeFromPush,
  sendTestPush,
} from "@/services/pushNotificationService";

export interface UsePushNotificationsReturn {
  isSupported: boolean;
  permission: NotificationPermission;
  isSubscribed: boolean;
  isLoading: boolean;
  isInitializing: boolean; // New state
  error: string | null;
  subscribe: (options?: { skipWelcome?: boolean }) => Promise<boolean>;
  unsubscribe: () => Promise<boolean>;
  sendTest: () => Promise<boolean>;
  autoSubscribe: () => Promise<void>;
}

export function usePushNotifications(): UsePushNotificationsReturn {
  const [isSupported] = useState(() => isPushSupported());
  const [permission, setPermission] = useState<NotificationPermission>(() =>
    getPermissionState()
  );
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true); // Default to true
  const [error, setError] = useState<string | null>(null);
  const autoSubscribeInFlightRef = useRef(false);

  const [hasAttemptedAutoSub, setHasAttemptedAutoSub] = useState(false);

  // Check for existing subscription on mount
  useEffect(() => {
    if (!isSupported) {
      setIsInitializing(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const existing = await getExistingSubscription();
        if (!cancelled) {
          setIsSubscribed(!!existing);
          setPermission(getPermissionState());
        }
      } catch {
        // Silently fail — user might not be on HTTPS or SW not ready
      } finally {
        if (!cancelled) {
          setIsInitializing(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isSupported]);

  // Subscribe
  const subscribe = useCallback(async (options?: { skipWelcome?: boolean }): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await subscribeToPush();
      setPermission(getPermissionState());

      if (result.success) {
        setIsSubscribed(true);
        if (result.createdNewSubscription && !options?.skipWelcome) {
          // Send a welcome test push only for brand-new subscriptions.
          try {
            await sendTestPush();
          } catch {
            // Non-critical
          }
        }
        return true;
      } else {
        const errorMsg = result.error || "Failed to subscribe";
        setError(errorMsg);
        console.error("[Push] Subscribe failed:", errorMsg);
        return false;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to subscribe";
      setError(msg);
      console.error("[Push] Subscribe exception:", msg);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Unsubscribe
  const unsubscribe = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const success = await unsubscribeFromPush();
      if (success) {
        setIsSubscribed(false);
      } else {
        setError("Failed to unsubscribe");
      }
      return success;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to unsubscribe";
      setError(msg);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Send test
  const sendTest = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      return await sendTestPush();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to send test";
      setError(msg);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Auto-subscribe if permission is already granted but we are not subscribed
  const autoSubscribe = useCallback(async () => {
    if (
      permission !== "granted" ||
      isSubscribed ||
      isLoading ||
      isInitializing ||
      hasAttemptedAutoSub ||
      autoSubscribeInFlightRef.current
    ) {
      return;
    }

    autoSubscribeInFlightRef.current = true;
    setHasAttemptedAutoSub(true);

    try {
      const existing = await getExistingSubscription();

      if (existing) {
        setIsSubscribed(true);
        setPermission(getPermissionState());
        return;
      }

      console.log("[Push] Auto-subscribing since permission is already granted...");
      await subscribe({ skipWelcome: true });
    } finally {
      autoSubscribeInFlightRef.current = false;
    }
  }, [permission, isSubscribed, isLoading, isInitializing, hasAttemptedAutoSub, subscribe]);

  return {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    isInitializing,
    error,
    subscribe,
    unsubscribe,
    sendTest,
    autoSubscribe,
  };
}

export default usePushNotifications;
