import { useState, useEffect, useRef, useCallback } from 'react';

interface UseHoverVideoProps {
    videoRef: React.RefObject<HTMLVideoElement>;
    hoverDelay?: number; // Delay in ms before playing on hover (desktop)
    longPressDelay?: number; // Delay in ms before playing on long press (mobile)
}

export const useHoverVideo = ({
    videoRef,
    hoverDelay = 200,
    longPressDelay = 500,
}: UseHoverVideoProps) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const isTouchRef = useRef(false);

    // Check for reduced motion preference
    const prefersReducedMotion = typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const playVideo = useCallback(() => {
        if (prefersReducedMotion || !videoRef.current) return;

        const playPromise = videoRef.current.play();
        if (playPromise !== undefined) {
            playPromise
                .then(() => setIsPlaying(true))
                .catch((error) => {
                    console.warn("Video play failed:", error);
                    setIsPlaying(false);
                });
        }
    }, [prefersReducedMotion, videoRef]);

    const pauseVideo = useCallback(() => {
        if (!videoRef.current) return;

        videoRef.current.pause();
        videoRef.current.currentTime = 0;
        setIsPlaying(false);
    }, [videoRef]);

    const handleMouseEnter = () => {
        if (isTouchRef.current) return; // Ignore mouse events if touch was detected

        if (timeoutRef.current) clearTimeout(timeoutRef.current);

        timeoutRef.current = setTimeout(() => {
            playVideo();
        }, hoverDelay);
    };

    const handleMouseLeave = () => {
        if (isTouchRef.current) return;

        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        pauseVideo();
    };

    const handleTouchStart = () => {
        isTouchRef.current = true;
        if (timeoutRef.current) clearTimeout(timeoutRef.current);

        timeoutRef.current = setTimeout(() => {
            playVideo();
        }, longPressDelay);
    };

    const handleTouchEnd = () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        pauseVideo();
        // Reset touch flag after a short delay to allow for mixed input devices
        setTimeout(() => {
            isTouchRef.current = false;
        }, 500);
    };

    useEffect(() => {
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, []);

    return {
        isPlaying,
        eventHandlers: {
            onMouseEnter: handleMouseEnter,
            onMouseLeave: handleMouseLeave,
            onTouchStart: handleTouchStart,
            onTouchEnd: handleTouchEnd,
            onTouchCancel: handleTouchEnd, // Handle cancel same as end
        },
    };
};
