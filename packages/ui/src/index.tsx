/**
 * UI Package - Shared Presentational Components
 * * @popclozet/ui v1.0.0
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// --- Loader Component ---

interface LoaderProps {
  size?: 'sm' | 'md' | 'lg';
  fullScreen?: boolean;
  text?: string;
}

export const Loader: React.FC<LoaderProps> = ({
  size = 'md',
  fullScreen = false,
  text
}) => {
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
  };

  const spinner = (
    <div className="flex flex-col items-center gap-3">
      <motion.div
        className={`${sizeClasses[size]} border-4 border-primary-200 border-t-primary-600 rounded-full`}
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
      />
      {text && <p className="text-sm text-gray-600 font-medium">{text}</p>}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-50">
        {spinner}
      </div>
    );
  }

  return spinner;
};

// --- Wrong Role Screen Component ---

interface WrongRoleScreenProps {
  expectedRole: string;
  currentRole?: string;
}

export const WrongRoleScreen: React.FC<WrongRoleScreenProps> = ({
  expectedRole,
  currentRole
}) => {
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-[#1a1a1a] rounded-2xl p-8 text-center border border-red-500/20"
      >
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-500/10 flex items-center justify-center">
          <svg 
            className="w-8 h-8 text-red-500" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
            />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-white mb-2">Access Denied</h1>
        
        <p className="text-gray-400 mb-6">
          This app is for <span className="text-white font-medium">{expectedRole}</span> users only.{' '}
          {currentRole && (
            <span>
              You are logged in as a <span className="text-white font-medium">{currentRole}</span>.
            </span>
          )}
        </p>

        <p className="text-sm text-gray-500">
          Please log out and use the correct app for your role.
        </p>
      </motion.div>
    </div>
  );
};

export { AnimatePresence };