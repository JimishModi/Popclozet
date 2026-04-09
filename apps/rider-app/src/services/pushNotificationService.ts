/**
 * Push Notification Service - Rider App
 * Handles Web Push API subscription, permission, and storage
 */

import { supabase } from "@popclozet/api-client";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || "";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function isPushSupported(): boolean {
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function getPermissionState(): NotificationPermission {
  if (!("Notification" in window)) return "denied";
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!("Notification" in window)) return "denied";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  return await Notification.requestPermission();
}

async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;

  try {
    const timeout = new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), 15000)
    );
    return await Promise.race([navigator.serviceWorker.ready, timeout]);
  } catch {
    return null;
  }
}

export async function getExistingSubscription(): Promise<PushSubscription | null> {
  const registration = await getServiceWorkerRegistration();
  if (!registration) return null;
  try {
    return await registration.pushManager.getSubscription();
  } catch {
    return null;
  }
}

export async function subscribeToPush(): Promise<{
  success: boolean;
  subscription?: PushSubscription;
  error?: string;
}> {
  if (!isPushSupported()) {
    return { success: false, error: "Push notifications not supported" };
  }
  if (!VAPID_PUBLIC_KEY) {
    return { success: false, error: "Push notifications not configured" };
  }

  const permission = await requestNotificationPermission();
  if (permission !== "granted") {
    return { success: false, error: `Notification permission ${permission}` };
  }

  const registration = await getServiceWorkerRegistration();
  if (!registration) {
    return { success: false, error: "Service worker not registered" };
  }

  try {
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY).buffer as ArrayBuffer,
      });
    }
    await saveSubscriptionToServer(subscription);
    return { success: true, subscription };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to subscribe",
    };
  }
}

export async function syncExistingPushSubscription(): Promise<{
  success: boolean;
  subscription?: PushSubscription;
  synced?: boolean;
  error?: string;
}> {
  if (!isPushSupported()) {
    return { success: false, error: "Push notifications not supported" };
  }

  if (!VAPID_PUBLIC_KEY) {
    return { success: false, error: "Push notifications not configured" };
  }

  if (getPermissionState() !== "granted") {
    return { success: false, error: `Notification permission ${getPermissionState()}` };
  }

  const registration = await getServiceWorkerRegistration();
  if (!registration) {
    return { success: false, error: "Service worker not registered" };
  }

  try {
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY).buffer as ArrayBuffer,
      });
    }

    await saveSubscriptionToServer(subscription);
    return { success: true, subscription, synced: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to sync subscription",
    };
  }
}

export async function ensurePushSubscription(
  options?: { promptIfDefault?: boolean },
): Promise<{
  success: boolean;
  subscription?: PushSubscription;
  synced?: boolean;
  error?: string;
}> {
  const permission = getPermissionState();

  if (permission === "granted") {
    return syncExistingPushSubscription();
  }

  if (permission === "default" && options?.promptIfDefault) {
    return subscribeToPush();
  }

  return { success: false, error: `Notification permission ${permission}` };
}

export async function unsubscribeFromPush(): Promise<boolean> {
  try {
    const subscription = await getExistingSubscription();
    if (!subscription) return true;
    await removeSubscriptionFromServer(subscription);
    await subscription.unsubscribe();
    return true;
  } catch {
    return false;
  }
}

async function saveSubscriptionToServer(subscription: PushSubscription): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const json = subscription.toJSON();
  const keys = json.keys as { p256dh: string; auth: string } | undefined;
  if (!json.endpoint || !keys?.p256dh || !keys?.auth) return;

  await supabase
    .from("push_subscriptions")
    .upsert(
      {
        user_id: user.id,
        endpoint: json.endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        user_agent: navigator.userAgent,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,endpoint" }
    );
}

async function removeSubscriptionFromServer(subscription: PushSubscription): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const json = subscription.toJSON();
  await supabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", user.id)
    .eq("endpoint", json.endpoint || "");
}
