import React from 'react';
interface Toast {
    id: string;
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
}
interface ToastContextType {
    toasts: Toast[];
    showToast: (message: string, type?: Toast['type']) => void;
    removeToast: (id: string) => void;
}
export declare const useToast: () => ToastContextType;
export declare const ToastProvider: React.FC<{
    children: React.ReactNode;
}>;
export {};
