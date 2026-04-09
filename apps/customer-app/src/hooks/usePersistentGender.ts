import { useState, useEffect } from 'react';

type Gender = 'womens' | 'mens';

export const usePersistentGender = (defaultGender: Gender = 'womens') => {
    const [gender, setGender] = useState<Gender>(() => {
        try {
            const saved = localStorage.getItem('activeGender');
            if (saved === 'womens' || saved === 'mens') {
                return saved as Gender;
            }
            // Handle cases where 'women' or 'men' might be stored from previous versions
            if (saved === 'women') return 'womens';
            if (saved === 'men') return 'mens';
        } catch (e) {
            console.warn("localStorage not available", e);
        }
        return defaultGender;
    });

    useEffect(() => {
        try {
            localStorage.setItem('activeGender', gender);
        } catch (e) {
            console.warn("localStorage not available", e);
        }
    }, [gender]);

    return [gender, setGender] as const;
};
