import { useState, useEffect, useCallback, useSyncExternalStore } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// ── Global singleton so every component shares the same deferred prompt ──
let _deferredPrompt: BeforeInstallPromptEvent | null = null;
const _listeners = new Set<() => void>();

function _notify() {
  _listeners.forEach((fn) => fn());
}

// Capture the event as early as possible (runs once at module load)
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    _deferredPrompt = e as BeforeInstallPromptEvent;
    _notify();
  });
}

function _subscribe(cb: () => void) {
  _listeners.add(cb);
  return () => { _listeners.delete(cb); };
}

function _getSnapshot() {
  return _deferredPrompt;
}

export function usePWAInstall() {
  const deferredPrompt = useSyncExternalStore(_subscribe, _getSnapshot);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const isStandaloneMedia = window.matchMedia('(display-mode: standalone)').matches;
    // @ts-ignore
    const isIOSStandalone = window.navigator.standalone === true;
    setIsStandalone(isStandaloneMedia || isIOSStandalone);

    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    setIsIOS(isIOSDevice);
  }, []);

  const triggerInstallPrompt = useCallback(async () => {
    if (!_deferredPrompt) return false;

    await _deferredPrompt.prompt();
    const { outcome } = await _deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
      _deferredPrompt = null;
      _notify();
      return true;
    } else {
      console.log('User dismissed the install prompt');
      return false;
    }
  }, []);

  return {
    isInstallableNatively: !!deferredPrompt,
    isIOS,
    isStandalone,
    triggerInstallPrompt,
  };
}
