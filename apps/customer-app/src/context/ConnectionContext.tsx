/**
 * Connection Context
 *
 * Tracks online/offline status and exposes it to the entire app.
 * Wraps the app in main.tsx so every component can read connection state.
 */

import React, { createContext, useContext, useState, useEffect } from 'react';

interface ConnectionState {
    isOnline: boolean;
}

const ConnectionContext = createContext<ConnectionState>({ isOnline: true });

export function ConnectionProvider({ children }: { children: React.ReactNode }) {
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    useEffect(() => {
        const goOnline = () => setIsOnline(true);
        const goOffline = () => setIsOnline(false);

        window.addEventListener('online', goOnline);
        window.addEventListener('offline', goOffline);

        return () => {
            window.removeEventListener('online', goOnline);
            window.removeEventListener('offline', goOffline);
        };
    }, []);

    return (
        <ConnectionContext.Provider value={{ isOnline }}>
            {children}
        </ConnectionContext.Provider>
    );
}

export function useConnection() {
    return useContext(ConnectionContext);
}

export default ConnectionContext;
