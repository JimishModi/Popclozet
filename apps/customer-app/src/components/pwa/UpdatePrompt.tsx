import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { toast } from 'sonner';
import { RefreshCw } from 'lucide-react';

/**
 * UpdatePrompt handles PWA update detection and prompts the user to refresh.
 * It uses the virtual:pwa-register/react hook provided by vite-plugin-pwa.
 */
export function UpdatePrompt() {
    const {
        needRefresh: [needRefresh, setNeedRefresh],
        updateServiceWorker,
    } = useRegisterSW({
        onRegisteredSW(swUrl, r) {
            console.log(`[PWA] Service Worker registered at: ${swUrl}`);
            
            // Check for updates every hour
            if (r) {
                setInterval(() => {
                    console.log('[PWA] Checking for updates...');
                    r.update();
                }, 60 * 60 * 1000);
            }
        },
        onRegisterError(error) {
            console.error('[PWA] Service Worker registration failed:', error);
        },
    });

    useEffect(() => {
        if (needRefresh) {
            console.log('[PWA] New content available, showing update prompt');
            
            toast('Update Available', {
                description: 'A new version of Popclozet is ready with latest styles and performance fixes.',
                duration: Infinity, // Keep it visible until action taken
                action: {
                    label: 'Update Now',
                    onClick: () => {
                        console.log('[PWA] User opted to update. Refreshing...');
                        updateServiceWorker(true);
                    },
                },
                cancel: {
                    label: 'Later',
                    onClick: () => {
                        console.log('[PWA] User dismissed update prompt.');
                        setNeedRefresh(false);
                    },
                },
                icon: <RefreshCw className="w-5 h-5 text-indigo-500" />,
            });
        }
    }, [needRefresh, updateServiceWorker, setNeedRefresh]);

    return null;
}
