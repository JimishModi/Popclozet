import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { useCountdown } from './useCountdown';

describe('useCountdown', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should initialize with correct time left', () => {
        const targetDate = new Date(Date.now() + 60000); // 1 minute from now
        const { result } = renderHook(() => useCountdown(targetDate));

        expect(result.current.timeLeftMs).toBeGreaterThan(0);
        expect(result.current.done).toBe(false);
    });

    it('should tick down every second', () => {
        const targetDate = new Date(Date.now() + 60000);
        const { result } = renderHook(() => useCountdown(targetDate));

        const initialTimeLeft = result.current.timeLeftMs;

        act(() => {
            vi.advanceTimersByTime(1000);
        });

        expect(result.current.timeLeftMs).toBeLessThan(initialTimeLeft);
    });

    it('should expire when time is up', () => {
        const targetDate = new Date(Date.now() + 1000);
        const { result } = renderHook(() => useCountdown(targetDate));

        act(() => {
            vi.advanceTimersByTime(2000);
        });

        expect(result.current.done).toBe(true);
    });

    it('should format time correctly', () => {
        const targetDate = new Date(Date.now() + 65000); // 1 min 5 sec
        const { result } = renderHook(() => useCountdown(targetDate));

        expect(result.current.formatted).toMatch(/\d{2}:\d{2}:\d{2}/);
    });
});
