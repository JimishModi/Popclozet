import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

export const META_PIXEL_ID = "1642282800226036";

type FbqParams = Record<string, unknown>;

function fbqSafe(...args: unknown[]) {
  if (typeof window === "undefined") return;
  const fbq = window.fbq;
  if (typeof fbq !== "function") return;
  try {
    fbq(...args);
  } catch (e) {
    console.warn("[MetaPixel] fbq call failed", e);
  }
}

export function trackPageView() {
  fbqSafe("track", "PageView");
}

export function trackViewContent(params: FbqParams = {}) {
  fbqSafe("track", "ViewContent", params);
}

export function trackAddToCart(params: FbqParams = {}) {
  fbqSafe("track", "AddToCart", params);
}

export function trackPurchase(value: number, currency: string = "INR", params: FbqParams = {}) {
  fbqSafe("track", "Purchase", { value, currency, ...params });
}

export function trackEvent(eventName: string, params: FbqParams = {}) {
  fbqSafe("track", eventName, params);
}

/**
 * Fires PageView on every SPA route change.
 * The initial PageView is fired by the inline script in index.html,
 * so this hook skips the first invocation to avoid duplicates.
 */
export function useMetaPixel() {
  const location = useLocation();
  const isFirst = useRef(true);
  const lastPath = useRef<string>("");

  useEffect(() => {
    const path = location.pathname + location.search;
    if (isFirst.current) {
      isFirst.current = false;
      lastPath.current = path;
      return;
    }
    if (path === lastPath.current) return;
    lastPath.current = path;
    trackPageView();
  }, [location.pathname, location.search]);
}
