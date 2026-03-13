import { useState, useEffect } from 'react';
import { X, Download, Share, PlusSquare } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export function InstallPrompt() {
    const { isInstallableNatively, isIOS, isStandalone, triggerInstallPrompt } = usePWAInstall();
    const [showPrompt, setShowPrompt] = useState(false);

    useEffect(() => {
        // If already installed, never show prompt
        if (isStandalone) {
            setShowPrompt(false);
            return;
        }

        // Show prompt if user hasn't dismissed it
        const dismissed = localStorage.getItem('pwa-install-dismissed');
        if (!dismissed) {
            // Show if it's natively installable (Android/Windows) or if it's iOS (manual install)
            if (isInstallableNatively || isIOS) {
                setShowPrompt(true);
            }
        }
    }, [isInstallableNatively, isIOS, isStandalone]);

    const handleInstallClick = async () => {
        if (isInstallableNatively) {
            await triggerInstallPrompt();
        }
    };

    const handleDismiss = () => {
        setShowPrompt(false);
        localStorage.setItem('pwa-install-dismissed', 'true');
    };

    if (!showPrompt) return null;

    return (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-sm z-[100] bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg shadow-2xl p-4 animate-in slide-in-from-bottom-5">
            <button
                onClick={handleDismiss}
                className="absolute top-2 right-2 p-1 hover:bg-white/20 rounded-full transition-colors"
                aria-label="Dismiss install prompt"
            >
                <X className="w-4 h-4" />
            </button>

            <div className="flex items-start gap-4 pr-4">
                <div className="bg-white/20 p-2.5 rounded-xl shrink-0">
                    <Download className="w-6 h-6" />
                </div>
                
                <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-lg leading-tight mb-1 truncate">
                        Install PopClozet
                    </h3>
                    <p className="text-sm text-white/90 mb-4 line-clamp-2">
                        Add to your home screen for a faster, app-like experience.
                    </p>
                    
                    {isInstallableNatively ? (
                        <button
                            onClick={handleInstallClick}
                            className="bg-white text-indigo-600 px-4 py-2 rounded-lg font-medium text-sm hover:bg-white/90 transition-colors w-full shadow-sm active:scale-95 duration-200"
                        >
                            Install App
                        </button>
                    ) : isIOS ? (
                        <div className="bg-white/10 rounded-lg p-3 backdrop-blur-sm border border-white/20">
                            <ol className="text-xs space-y-2 text-white/90 font-medium">
                                <li className="flex items-center gap-2">
                                    <span className="bg-white/20 w-5 h-5 rounded-full flex items-center justify-center shrink-0">1</span>
                                    Tap the <Share className="w-4 h-4 mx-0.5" /> Share icon below
                                </li>
                                <li className="flex items-center gap-2">
                                    <span className="bg-white/20 w-5 h-5 rounded-full flex items-center justify-center shrink-0">2</span>
                                    Select "Add to Home Screen" <PlusSquare className="w-4 h-4 mx-0.5 shrink-0" />
                                </li>
                            </ol>
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
