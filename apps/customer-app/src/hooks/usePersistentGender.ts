import { useState, useEffect } from 'react';

type Gender = 'womens' | 'mens';

export const usePersistentGender = (defaultGender: Gender = 'womens') => {
    const [gender, setGender] = useState<Gender>(() => {
        const saved = localStorage.getItem('activeGender');
        if (saved === 'womens' || saved === 'mens') {
            return saved as Gender;
        }
        // Handle cases where 'women' or 'men' might be stored from previous versions
        if (saved === 'women') return 'womens';
        if (saved === 'men') return 'mens';

        return defaultGender;
    });

    useEffect(() => {
        localStorage.setItem('activeGender', gender);
    }, [gender]);

    return [gender, setGender] as const;
};
