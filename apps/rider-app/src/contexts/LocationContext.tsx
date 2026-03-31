import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Navigation, ShieldCheck, X } from 'lucide-react';

interface Location {
  latitude: number;
  longitude: number;
  heading: number | null;
  speed: number | null;
  timestamp: number;
}

type PermissionState = 'granted' | 'denied' | 'prompt' | 'unknown';

interface LocationContextType {
  location: Location | null;
  permissionStatus: PermissionState;
  error: GeolocationPositionError | null;
  startWatching: () => void;
  stopWatching: () => void;
  requestPermission: () => Promise<boolean>;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export const useLocation = () => {
  const context = useContext(LocationContext);
  if (!context) {
    throw new Error('useLocation must be used within a LocationProvider');
  }
  return context;
};

export const LocationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [location, setLocation] = useState<Location | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<PermissionState>('unknown');
  const [error, setError] = useState<GeolocationPositionError | null>(null);
  const [showPrePrompt, setShowPrePrompt] = useState(false);
  const [resolvePermission, setResolvePermission] = useState<((granted: boolean) => void) | null>(null);

  const watchIdRef = useRef<number | null>(null);

  // 1. Check permission status on mount
  useEffect(() => {
    if ('permissions' in navigator) {
      navigator.permissions.query({ name: 'geolocation' as any }).then((status) => {
        setPermissionStatus(status.state as PermissionState);
        status.onchange = () => {
          setPermissionStatus(status.state as PermissionState);
        };
      });
    } else {
      // Fallback if Permissions API is not supported
      setPermissionStatus('unknown');
    }
  }, []);

  const stopWatching = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  const startWatching = useCallback(() => {
    if (!navigator.geolocation) {
      console.error('Geolocation is not supported');
      return;
    }

    if (watchIdRef.current !== null) return; // Already watching

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const newLocation: Location = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          heading: pos.coords.heading,
          speed: pos.coords.speed,
          timestamp: pos.timestamp,
        };
        setLocation(newLocation);
        setError(null);
        setPermissionStatus('granted');
      },
      (err) => {
        setError(err);
        if (err.code === err.PERMISSION_DENIED) {
          setPermissionStatus('denied');
          stopWatching();
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 10000,
      }
    );
  }, [stopWatching]);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    // If already granted, just return true
    if (permissionStatus === 'granted') {
      startWatching();
      return true;
    }

    // Show custom pre-prompt UI to explain why we need location
    return new Promise((resolve) => {
      setResolvePermission(() => resolve);
      setShowPrePrompt(true);
    });
  }, [permissionStatus, startWatching]);

  const handleActualRequest = async () => {
    setShowPrePrompt(false);
    
    return new Promise<boolean>((resolve) => {
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setPermissionStatus('granted');
                startWatching();
                if (resolvePermission) resolvePermission(true);
                resolve(true);
            },
            (err) => {
                if (err.code === err.PERMISSION_DENIED) {
                    setPermissionStatus('denied');
                }
                if (resolvePermission) resolvePermission(false);
                resolve(false);
            },
            { enableHighAccuracy: true, timeout: 5000 }
        );
    });
  };

  return (
    <LocationContext.Provider
      value={{
        location,
        permissionStatus,
        error,
        startWatching,
        stopWatching,
        requestPermission,
      }}
    >
      {children}

      {/* Pre-prompt Modal */}
      <AnimatePresence>
        {showPrePrompt && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-zinc-900 w-full max-w-sm rounded-[2rem] border border-zinc-800 overflow-hidden shadow-2xl shadow-blue-500/10"
            >
              <div className="relative p-8 text-center space-y-6">
                <div className="absolute top-4 right-4">
                  <button 
                    onClick={() => { setShowPrePrompt(false); if (resolvePermission) resolvePermission(false); }}
                    className="p-2 text-zinc-500 hover:text-white rounded-full transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="w-20 h-20 mx-auto rounded-3xl bg-blue-500/10 flex items-center justify-center relative">
                    <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full animate-pulse" />
                    <Navigation size={40} className="text-blue-500 relative z-10" />
                </div>

                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-white">Enable Location Access</h3>
                  <p className="text-zinc-400 text-sm leading-relaxed px-2">
                    To deliver orders effectively, we need your live location. 
                    Please select <span className="text-white font-semibold">"Always Allow"</span> or <span className="text-white font-semibold">"While Using App"</span> in the next prompt.
                  </p>
                </div>

                <div className="pt-2 space-y-3">
                    <button
                        onClick={handleActualRequest}
                        className="w-full py-4 rounded-2xl bg-blue-500 text-white font-bold text-sm shadow-lg shadow-blue-500/20 active:scale-[0.98] transition-all"
                    >
                        Allow Access
                    </button>
                    <div className="flex items-center justify-center gap-2 text-[10px] text-zinc-500 font-medium uppercase tracking-wider">
                        <ShieldCheck size={12} />
                        Your privacy is our priority
                    </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </LocationContext.Provider>
  );
};
