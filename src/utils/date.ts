import { format, formatDistanceToNow, parseISO, addMinutes, differenceInMinutes } from 'date-fns';

export const formatDate = (date: string | Date, formatStr: string = 'PPP'): string => {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    return format(dateObj, formatStr);
};

export const formatTime = (date: string | Date): string => {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    return format(dateObj, 'p');
};

export const formatDateTime = (date: string | Date): string => {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    return format(dateObj, 'PPp');
};

export const formatRelativeTime = (date: string | Date): string => {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    return formatDistanceToNow(dateObj, { addSuffix: true });
};

export const addMinutesToDate = (date: string | Date, minutes: number): Date => {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    return addMinutes(dateObj, minutes);
};

export const getMinutesRemaining = (expiryDate: string | Date): number => {
    const dateObj = typeof expiryDate === 'string' ? parseISO(expiryDate) : expiryDate;
    return differenceInMinutes(dateObj, new Date());
};

export const formatCountdown = (minutes: number): string => {
    if (minutes <= 0) return '00:00';
    const mins = Math.floor(minutes);
    const secs = Math.floor((minutes - mins) * 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};
