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
        const { result } = renderHook(() => useCountdown({ targetDate }));

        expect(result.current.timeLeft.minutes).toBe(1);
        expect(result.current.timeLeft.seconds).toBe(0);
        expect(result.current.isExpired).toBe(false);
    });

    it('should tick down every second', () => {
        const targetDate = new Date(Date.now() + 60000);
        const { result } = renderHook(() => useCountdown({ targetDate }));

        act(() => {
            vi.advanceTimersByTime(1000);
        });

        expect(result.current.timeLeft.seconds).toBe(59);
    });

    it('should expire when time is up', () => {
        const targetDate = new Date(Date.now() + 1000);
        const onExpire = vi.fn();
        const { result } = renderHook(() => useCountdown({ targetDate, onExpire }));

        act(() => {
            vi.advanceTimersByTime(1000);
        });

        expect(result.current.isExpired).toBe(true);
        expect(result.current.status).toBe('expired');
        expect(onExpire).toHaveBeenCalled();
    });

    it('should format time correctly', () => {
        const targetDate = new Date(Date.now() + 65000); // 1 min 5 sec
        const { result } = renderHook(() => useCountdown({ targetDate }));

        expect(result.current.formattedTime).toBe('01:05');
    });
});
