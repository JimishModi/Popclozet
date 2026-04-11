import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * ScrollToTop
 * 
 * A utility component that ensures the window scrolls to the top whenever
 * the route (pathname) changes. This is standard practice in React Router
 * applications to mimic traditional browser navigation behavior where 
 * each new page starts at the top.
 */
export const ScrollToTop = () => {
    const { pathname } = useLocation();

    useEffect(() => {
        // We use a small delay or requestAnimationFrame if needed, 
        // but typically a direct call is sufficient in standard SPAs.
        window.scrollTo(0, 0);
    }, [pathname]);

    return null;
};

export default ScrollToTop;
