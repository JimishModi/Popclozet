import React from 'react';
import { motion } from 'framer-motion';

interface PageTransitionProps {
    children: React.ReactNode;
    className?: string;
}

const pageVariants = {
    initial: {
        opacity: 0,
        y: 12,
    },
    enter: {
        opacity: 1,
        y: 0,
        transition: {
            duration: 0.3,
            ease: [0.25, 0.1, 0.25, 1],
            when: 'beforeChildren',
            staggerChildren: 0.06,
        },
    },
    exit: {
        opacity: 0,
        y: -8,
        transition: {
            duration: 0.2,
            ease: [0.25, 0.1, 0.25, 1],
        },
    },
};

/**
 * Wraps page content with smooth enter/exit animations.
 * Use inside each route for consistent page transitions.
 */
export const PageTransition: React.FC<PageTransitionProps> = ({ children, className }) => {
    return (
        <motion.div
            variants={pageVariants}
            initial="initial"
            animate="enter"
            exit="exit"
            className={className}
            style={{ willChange: 'opacity, transform' }}
        >
            {children}
        </motion.div>
    );
};

/**
 * Stagger children variant — use on direct children of PageTransition
 * for cascading entrance effects.
 */
export const staggerChildVariants = {
    initial: { opacity: 0, y: 16 },
    enter: {
        opacity: 1,
        y: 0,
        transition: {
            duration: 0.35,
            ease: [0.25, 0.1, 0.25, 1],
        },
    },
};

export default PageTransition;
