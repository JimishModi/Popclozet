/**
 * UI Package - Shared Presentational Components
 * * @popclozet/ui v1.0.0
 */
import React from 'react';
import { AnimatePresence } from 'framer-motion';
interface LoaderProps {
    size?: 'sm' | 'md' | 'lg';
    fullScreen?: boolean;
    text?: string;
}
export declare const Loader: React.FC<LoaderProps>;
interface WrongRoleScreenProps {
    expectedRole: string;
    currentRole?: string;
}
export declare const WrongRoleScreen: React.FC<WrongRoleScreenProps>;
export { AnimatePresence };
