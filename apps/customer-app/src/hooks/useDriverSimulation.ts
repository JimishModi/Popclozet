
import { useState, useEffect, useRef } from 'react';
import { calculateRoute, RouteResult } from '@/services/mapService';

interface UseDriverSimulationProps {
    origin: { lat: number; lng: number } | null;
    destination: { lat: number; lng: number } | null;
    isActive: boolean;
    speedMultiplier?: number; // 1 = real time, 10 = 10x speed for demo
}

export function useDriverSimulation({
    origin,
    destination,
    isActive,
    speedMultiplier = 20 // Default to 20x speed for visible demo movement
}: UseDriverSimulationProps) {
    const [vehicleLocation, setVehicleLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [routePath, setRoutePath] = useState<[number, number][] | null>(null);
    const [isCalculating, setIsCalculating] = useState(false);

    // Animation state
    const progressRef = useRef(0);
    const animationFrameRef = useRef<number>();

    // Calculate route when endpoints change
    useEffect(() => {
        if (!origin || !destination || !isActive) {
            setRoutePath(null);
            setVehicleLocation(null);
            return;
        }

        const fetchRoute = async () => {
            setIsCalculating(true);
            try {
                const result = await calculateRoute(origin, destination);
                if (result && result.coordinates.length > 0) {
                    setRoutePath(result.coordinates);
                    setVehicleLocation({
                        lat: result.coordinates[0][0],
                        lng: result.coordinates[0][1]
                    });
                    progressRef.current = 0; // Reset progress
                }
            } catch (error) {
                console.error("Failed to calculate simulation route:", error);
            } finally {
                setIsCalculating(false);
            }
        };

        fetchRoute();

        // Cleanup simulation on unmount/change
        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [origin?.lat, origin?.lng, destination?.lat, destination?.lng, isActive]);

    // Run simulation loop
    useEffect(() => {
        if (!routePath || routePath.length < 2 || !isActive) return;

        let lastTimestamp = performance.now();
        const totalDistance = routePath.length; // Simplified distance metric (number of points)

        // Speed: points per second
        // OSRM returns detailed points, so 5 points/sec is smooth animation
        const pointsPerSecond = 2 * speedMultiplier;

        const animate = (timestamp: number) => {
            const deltaTime = (timestamp - lastTimestamp) / 1000; // seconds
            lastTimestamp = timestamp;

            // Increment progress
            progressRef.current += deltaTime * pointsPerSecond;

            // Loop or clamp
            if (progressRef.current >= totalDistance - 1) {
                progressRef.current = 0; // Loop for demo
            }

            // Interpolate position
            const currentIndex = Math.floor(progressRef.current);
            const nextIndex = currentIndex + 1;
            const subProgress = progressRef.current - currentIndex;

            if (nextIndex < routePath.length) {
                const [lat1, lng1] = routePath[currentIndex];
                const [lat2, lng2] = routePath[nextIndex];

                const currentLat = lat1 + (lat2 - lat1) * subProgress;
                const currentLng = lng1 + (lng2 - lng1) * subProgress;

                setVehicleLocation({ lat: currentLat, lng: currentLng });
                animationFrameRef.current = requestAnimationFrame(animate);
            }
        };

        animationFrameRef.current = requestAnimationFrame(animate);

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [routePath, isActive, speedMultiplier]);

    return {
        vehicleLocation,
        routePath,
        isCalculating
    };
}
