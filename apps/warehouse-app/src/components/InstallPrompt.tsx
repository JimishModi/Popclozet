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
        const dismissed = localStorage.getItem('pwa-install-warehouse-v2');
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
        localStorage.setItem('pwa-install-warehouse-v2', 'true');
    };

    if (!showPrompt) return null;

    return (
        <div className="fixed bottom-6 left-4 right-4 md:left-auto md:right-6 md:max-w-sm z-[100] bg-gradient-to-br from-indigo-700 to-violet-700 text-white rounded-[2rem] shadow-[0_20px_50px_rgba(79,70,229,0.3)] p-6 animate-in slide-in-from-bottom-8 duration-500 backdrop-blur-sm border border-white/10">
            <button
                onClick={handleDismiss}
                className="absolute top-4 right-4 p-1 hover:bg-white/20 rounded-full transition-colors group"
                aria-label="Dismiss install prompt"
            >
                <X className="w-5 h-5 opacity-70 group-hover:opacity-100" />
            </button>

            <div className="flex flex-col gap-6">
                <div className="flex items-start gap-4 pr-6">
                    <div className="bg-white/20 p-3 rounded-2xl shrink-0">
                        <Download className="w-6 h-6" />
                    </div>
                    
                    <div className="min-w-0">
                        <h3 className="font-bold text-xl leading-tight mb-1 truncate">
                            Install Warehouse App
                        </h3>
                        <p className="text-sm text-white/80 leading-relaxed">
                            Add to your home screen for a faster, app-like experience.
                        </p>
                    </div>
                </div>

                {isInstallableNatively ? (
                    <button
                        onClick={handleInstallClick}
                        className="bg-white text-indigo-700 py-4 rounded-2xl font-bold text-lg hover:bg-white/90 transition-all shadow-xl active:scale-95 duration-200"
                    >
                        Install App
                    </button>
                ) : isIOS ? (
                    <div className="bg-white/10 rounded-2xl p-4 backdrop-blur-sm border border-white/20">
                        <ol className="text-sm space-y-3 text-white/90 font-medium">
                            <li className="flex items-center gap-3">
                                <span className="bg-white/20 w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs">1</span>
                                Tap the <Share className="w-4 h-4 mx-0.5" /> Share icon below
                            </li>
                            <li className="flex items-center gap-3">
                                <span className="bg-white/20 w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs">2</span>
                                Select "Add to Home Screen" <PlusSquare className="w-4 h-4 mx-0.5 shrink-0" />
                            </li>
                        </ol>
                    </div>
                ) : null}
            </div>
        </div>
    );
}
