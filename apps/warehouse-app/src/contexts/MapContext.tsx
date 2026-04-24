import React, { createContext, useContext, useRef, useState, useEffect } from 'react';
import { useActiveRiders, type ActiveRider } from '../hooks/useActiveRiders';
import { mapboxgl, isMapboxAvailable } from '@popclozet/map-core';

interface MapContextType {
    riders: ActiveRider[];
    loading: boolean;
    mapInstance: any | null;
    mapContainer: HTMLDivElement | null;
    initializePersistentMap: (container: HTMLDivElement) => Promise<any>;
}

const MapContext = createContext<MapContextType | undefined>(undefined);

export const MapProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { riders, loading } = useActiveRiders();
    const mapInstanceRef = useRef<any>(null);
    const [mapContainer, setMapContainer] = useState<HTMLDivElement | null>(null);
    const mapReady = isMapboxAvailable();

    useEffect(() => {
        // Create a hidden persistent container for the map
        const container = document.createElement('div');
        container.style.width = '100%';
        container.style.height = '100%';
        container.id = 'persistent-map-container';
        setMapContainer(container);

        return () => {
            if (mapInstanceRef.current) {
                mapInstanceRef.current.remove();
                mapInstanceRef.current = null;
            }
        };
    }, []);

    const initializePersistentMap = async (targetContainer: HTMLDivElement) => {
        if (!mapContainer || !mapReady) return null;

        if (!mapInstanceRef.current) {
            // Lazy initialization
            console.log('[MapContext] Initializing new map instance');
            const { createMapInstance } = await import('@popclozet/map-core');
            
            // Append to our hidden container first
            mapInstanceRef.current = await createMapInstance(mapContainer, [72.9133, 19.1334], 12);
        }

        // Move the map container into the target container
        if (mapContainer.parentElement !== targetContainer) {
            targetContainer.appendChild(mapContainer);
            if (mapInstanceRef.current?.resize) {
                mapInstanceRef.current.resize();
            }
        }

        return mapInstanceRef.current;
    };

    return (
        <MapContext.Provider value={{ 
            riders, 
            loading, 
            mapInstance: mapInstanceRef.current, 
            mapContainer,
            initializePersistentMap 
        }}>
            {children}
        </MapContext.Provider>
    );
};

export const useMap = () => {
    const context = useContext(MapContext);
    if (context === undefined) {
        throw new Error('useMap must be used within a MapProvider');
    }
    return context;
};
