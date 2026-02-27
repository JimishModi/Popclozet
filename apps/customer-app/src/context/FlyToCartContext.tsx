import React, { createContext, useContext, useRef, ReactNode } from 'react';

interface FlyToCartContextType {
    triggerFlyAnimation: (src: string, startRect: DOMRect) => void;
}

const FlyToCartContext = createContext<FlyToCartContextType | undefined>(undefined);

export const FlyToCartProvider = ({ children }: { children: ReactNode }) => {
    const containerRef = useRef<HTMLDivElement>(null);

    const triggerFlyAnimation = (src: string, startRect: DOMRect) => {
        // Check for reduced motion preference
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (prefersReducedMotion) return;

        const target = document.getElementById('cart-icon-target');
        if (!target || !containerRef.current) return;

        const targetRect = target.getBoundingClientRect();

        // Create the flying image element
        const img = document.createElement('img');
        img.src = src;
        img.style.position = 'fixed';
        img.style.left = `${startRect.left}px`;
        img.style.top = `${startRect.top}px`;
        img.style.width = `${startRect.width}px`;
        img.style.height = `${startRect.height}px`;
        img.style.objectFit = 'cover';
        img.style.borderRadius = '8px'; // Match card radius roughly
        img.style.zIndex = '9999';
        img.style.pointerEvents = 'none';
        img.style.opacity = '0.8';

        containerRef.current.appendChild(img);

        // Animate using WAAPI
        const animation = img.animate(
            [
                {
                    left: `${startRect.left}px`,
                    top: `${startRect.top}px`,
                    width: `${startRect.width}px`,
                    height: `${startRect.height}px`,
                    opacity: 0.8,
                    transform: 'scale(1)',
                },
                {
                    left: `${targetRect.left + targetRect.width / 2 - 10}px`, // Center on target
                    top: `${targetRect.top + targetRect.height / 2 - 10}px`,
                    width: '20px', // Shrink to icon size
                    height: '20px',
                    opacity: 0.5,
                    transform: 'scale(0.5)',
                },
            ],
            {
                duration: 600,
                easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)', // Ease-out-expoish
                fill: 'forwards',
            }
        );

        animation.onfinish = () => {
            if (img.parentNode) {
                img.parentNode.removeChild(img);
            }
        };
    };

    return (
        <FlyToCartContext.Provider value={{ triggerFlyAnimation }}>
            {children}
            {/* Container for flying elements, mounted at root level */}
            <div ref={containerRef} style={{ position: 'fixed', top: 0, left: 0, width: 0, height: 0, overflow: 'visible', zIndex: 9999 }} />
        </FlyToCartContext.Provider>
    );
};

export const useFlyToCart = () => {
    const context = useContext(FlyToCartContext);
    if (context === undefined) {
        throw new Error('useFlyToCart must be used within a FlyToCartProvider');
    }
    return context;
};
