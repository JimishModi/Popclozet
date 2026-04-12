import { useEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

/**
 * ScrollToTop — with scroll position restoration for back navigation.
 *
 * On forward navigation (PUSH): scrolls to top.
 * On back navigation (POP):     restores previous scroll position.
 */

const scrollPositions = new Map<string, number>();

export const ScrollToTop = () => {
    const { pathname, key } = useLocation();
    const navType = useNavigationType();
    const prevKey = useRef(key);

    useEffect(() => {
        // Save scroll position of the page we're leaving
        scrollPositions.set(prevKey.current, window.scrollY);
        prevKey.current = key;

        if (navType === "POP") {
            // Back/forward navigation — restore saved position
            const saved = scrollPositions.get(key);
            if (saved !== undefined) {
                // Delay to allow React to render the cached content first
                requestAnimationFrame(() => {
                    window.scrollTo(0, saved);
                });
                return;
            }
        }

        // Forward navigation or no saved position — scroll to top
        window.scrollTo(0, 0);
    }, [pathname, key, navType]);

    return null;
};

export default ScrollToTop;
