import { useState, useRef, useEffect, useCallback } from "react";

interface HoverVideoOptions {
  longPressMs?: number;
}

export const useHoverVideo = ({ longPressMs = 400 }: HoverVideoOptions = {}) => {
  const [shouldShow, setShouldShow] = useState(false);
  const [shouldLoad, setShouldLoad] = useState(false);
  const timeoutRef = useRef<number>();
  const prefersReducedMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const show = useCallback(() => {
    if (prefersReducedMotion) return;
    setShouldLoad(true);
    setShouldShow(true);
  }, [prefersReducedMotion]);

  const hide = useCallback(() => {
    setShouldShow(false);
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }
  }, []);

  const handlePointerDown = () => {
    if (prefersReducedMotion) return;
    timeoutRef.current = window.setTimeout(() => {
      setShouldLoad(true);
      setShouldShow(true);
    }, longPressMs);
  };

  const handlePointerUp = () => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    shouldShow,
    shouldLoad,
    bind: {
      onMouseEnter: show,
      onMouseLeave: hide,
      onPointerDown: handlePointerDown,
      onPointerUp: handlePointerUp,
      onPointerCancel: handlePointerUp,
      onTouchStart: handlePointerDown,
      onTouchEnd: handlePointerUp
    },
    reset: hide
  };
};

export default useHoverVideo;
