import { useCallback, useEffect, useRef, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw } from 'lucide-react';

const UPDATE_CHECK_INTERVAL_MS = 15 * 60 * 1000;
const INITIAL_UPDATE_CHECK_DELAY_MS = 8000;

export function UpdatePrompt() {
    const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
    const [isUpdating, setIsUpdating] = useState(false);
    const {
        needRefresh: [needRefresh, setNeedRefresh],
        updateServiceWorker,
    } = useRegisterSW({
        onRegisteredSW(swUrl, registration) {
            console.log(`[PWA] Service Worker registered at: ${swUrl}`);
            registrationRef.current = registration ?? null;
        },
        onRegisterError(error) {
            console.error('[PWA] Service Worker registration failed:', error);
        },
    });

    const checkForUpdates = useCallback(async () => {
        const registration = registrationRef.current;
        if (!registration) return;

        try {
            console.log('[PWA] Checking for updates...');
            await registration.update();
        } catch (error) {
            console.warn('[PWA] Update check failed:', error);
        }
    }, []);

    useEffect(() => {
        const initialTimer = window.setTimeout(() => {
            void checkForUpdates();
        }, INITIAL_UPDATE_CHECK_DELAY_MS);

        const intervalId = window.setInterval(() => {
            void checkForUpdates();
        }, UPDATE_CHECK_INTERVAL_MS);

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                void checkForUpdates();
            }
        };

        const handleWindowFocus = () => {
            void checkForUpdates();
        };

        const handleOnline = () => {
            void checkForUpdates();
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('focus', handleWindowFocus);
        window.addEventListener('online', handleOnline);

        return () => {
            window.clearTimeout(initialTimer);
            window.clearInterval(intervalId);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('focus', handleWindowFocus);
            window.removeEventListener('online', handleOnline);
        };
    }, [checkForUpdates]);

    useEffect(() => {
        if (!needRefresh) {
            setIsUpdating(false);
        }
    }, [needRefresh]);

    if (!needRefresh) {
        return null;
    }

    return (
        <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[130] flex justify-center px-4">
            <div className="pointer-events-auto w-full max-w-md rounded-3xl border border-violet-400/20 bg-[#121217]/95 p-4 text-white shadow-[0_24px_80px_rgba(0,0,0,0.5)] backdrop-blur-xl">
                <div className="flex items-start gap-3">
                    <div className="mt-0.5 rounded-2xl bg-violet-500/15 p-2 text-violet-300">
                        <RefreshCw className={`h-5 w-5 ${isUpdating ? 'animate-spin' : ''}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold tracking-wide text-violet-100">Update ready</p>
                        <p className="mt-1 text-sm leading-5 text-zinc-300">
                            Rider app ka naya version aa gaya hai. Update karke latest delivery flow aur fixes use karo.
                        </p>
                    </div>
                </div>
                <div className="mt-4 flex items-center justify-end gap-2">
                    <button
                        type="button"
                        onClick={() => setNeedRefresh(false)}
                        className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:border-white/20 hover:bg-white/5 hover:text-white"
                    >
                        Later
                    </button>
                    <button
                        type="button"
                        onClick={async () => {
                            setIsUpdating(true);
                            try {
                                await updateServiceWorker(true);
                            } catch (error) {
                                console.error('[PWA] Failed to apply update:', error);
                                setIsUpdating(false);
                            }
                        }}
                        disabled={isUpdating}
                        className="rounded-2xl bg-violet-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                        {isUpdating ? 'Updating...' : 'Update now'}
                    </button>
                </div>
            </div>
        </div>
    );
}
