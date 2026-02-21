import { useEffect, useMemo, useState } from "react";

export interface CountdownState {
  timeLeftMs: number;
  formatted: string;
  done: boolean;
}

export const useCountdown = (targetTime: Date | string | number): CountdownState => {
  const target = useMemo(() => new Date(targetTime).getTime(), [targetTime]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => window.clearInterval(interval);
  }, []);

  const timeLeftMs = Math.max(target - now, 0);
  const done = timeLeftMs <= 0;

  const hours = Math.floor(timeLeftMs / (1000 * 60 * 60));
  const minutes = Math.floor((timeLeftMs / (1000 * 60)) % 60);
  const seconds = Math.floor((timeLeftMs / 1000) % 60);

  const formatted = done
    ? "00:00:00"
    : `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds
        .toString()
        .padStart(2, "0")}`;

  return { timeLeftMs, formatted, done };
};

export default useCountdown;
