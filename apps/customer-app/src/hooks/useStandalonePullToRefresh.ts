import { useEffect, useRef } from "react";

const IOS_PULL_REFRESH_THRESHOLD = 96;

function isStandaloneIosPwa(): boolean {
  if (typeof window === "undefined") return false;

  const nav = window.navigator as Navigator & { standalone?: boolean };
  const ua = window.navigator.userAgent;
  const isIosDevice =
    /iPad|iPhone|iPod/.test(ua) ||
    (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1);
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;

  return isIosDevice && isStandalone;
}

export function useStandalonePullToRefresh() {
  const startYRef = useRef<number | null>(null);
  const startXRef = useRef<number | null>(null);
  const pullDistanceRef = useRef(0);
  const isReloadingRef = useRef(false);

  useEffect(() => {
    if (!isStandaloneIosPwa()) return;

    const resetGesture = () => {
      startYRef.current = null;
      startXRef.current = null;
      pullDistanceRef.current = 0;
    };

    const handleTouchStart = (event: TouchEvent) => {
      if (window.scrollY > 0 || event.touches.length !== 1) {
        resetGesture();
        return;
      }

      const touch = event.touches[0];
      startYRef.current = touch.clientY;
      startXRef.current = touch.clientX;
      pullDistanceRef.current = 0;
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (startYRef.current === null || startXRef.current === null || window.scrollY > 0) {
        return;
      }

      const touch = event.touches[0];
      const deltaY = touch.clientY - startYRef.current;
      const deltaX = Math.abs(touch.clientX - startXRef.current);

      if (deltaY <= 0 || deltaY <= deltaX) {
        return;
      }

      pullDistanceRef.current = deltaY;
    };

    const handleTouchEnd = () => {
      if (
        pullDistanceRef.current >= IOS_PULL_REFRESH_THRESHOLD &&
        !isReloadingRef.current
      ) {
        isReloadingRef.current = true;
        window.location.reload();
      }

      resetGesture();
    };

    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });
    window.addEventListener("touchcancel", handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, []);
}

export default useStandalonePullToRefresh;
