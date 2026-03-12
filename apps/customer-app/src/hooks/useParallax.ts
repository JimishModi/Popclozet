import { useRef } from 'react';
import { useScroll, useTransform } from 'framer-motion';

export const useParallax = (distance = 50) => {
    const ref = useRef<HTMLDivElement>(null);
    const { scrollYProgress } = useScroll({
        target: ref,
        offset: ["start end", "end start"]
    });

    const y = useTransform(scrollYProgress, [0, 1], [-distance, distance]);
    const opacity = useTransform(scrollYProgress, [0, 0.2, 0.8, 1], [0, 1, 1, 0]);

    return { ref, y, opacity };
};
