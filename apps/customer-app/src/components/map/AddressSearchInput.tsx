// src/components/map/AddressSearchInput.tsx
// Address search with autocomplete and GPS locate button

import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, MapPin, Navigation, X, Clock } from 'lucide-react';
import { searchAddresses, ValidatedAddress, getLocalAddresses } from '@/services/addressService';
import { cn } from '@/lib/utils';

interface AddressSearchInputProps {
    className?: string;
    placeholder?: string;
    value?: string;
    onAddressSelect: (address: ValidatedAddress) => void;
    onLocateMe?: () => void;
    showRecentAddresses?: boolean;
    disabled?: boolean;
    isLoading?: boolean;
}

export function AddressSearchInput({
    className,
    placeholder = 'Search for a location...',
    value = '',
    onAddressSelect,
    onLocateMe,
    showRecentAddresses = true,
    disabled = false,
    isLoading: externalLoading = false,
}: AddressSearchInputProps) {
    const [query, setQuery] = useState(value);
    const [suggestions, setSuggestions] = useState<ValidatedAddress[]>([]);
    const [isLoadingInternal, setIsLoadingInternal] = useState(false);
    
    // Combine internal and external loading states
    const isLoading = isLoadingInternal || externalLoading;
    
    const [isFocused, setIsFocused] = useState(false);
    const [recentAddresses, setRecentAddresses] = useState<ValidatedAddress[]>([]);
    const inputRef = useRef<HTMLInputElement>(null);
    const debounceRef = useRef<NodeJS.Timeout | null>(null);

    // Load recent addresses
    useEffect(() => {
        if (showRecentAddresses) {
            const saved = getLocalAddresses();
            setRecentAddresses(
                saved.slice(0, 3).map((addr) => ({
                    lat: addr.lat,
                    lng: addr.lng,
                    formattedAddress: addr.formattedAddress,
                    city: addr.city || undefined,
                }))
            );
        }
    }, [showRecentAddresses]);

    // Clean incoming value to avoid "undefined" artifacts
    const cleanValue = (val: string | undefined): string => {
        if (!val) return '';
        return val.replace(/undefined/g, '').replace(/null/g, '').trim().replace(/^, /, '');
    };

    // Sync query only when value is a real address (not just coordinates) or when it specifically changed
    useEffect(() => {
        const cleaned = cleanValue(value);
        // Only overwrite if it looks like a real address and we are not focused
        const isCoordinates = /^-?\d+\.\d+,\s*-?\d+\.\d+$/.test(cleaned);
        if (cleaned && cleaned !== query && !isFocused && !isCoordinates) {
            setQuery(cleaned);
        }
    }, [value, isFocused, query]);

    // Debounced search
    const handleSearch = useCallback(async (searchQuery: string) => {
        if (!searchQuery || searchQuery.length < 3) {
            setSuggestions([]);
            return;
        }

        setIsLoadingInternal(true);
        console.log('[AddressSearch] Searching for:', searchQuery);
        try {
            const results = await searchAddresses(searchQuery);
            console.log('[AddressSearch] Got', results.length, 'results:', results.map(r => ({ addr: r.formattedAddress, lat: r.lat, lng: r.lng, eLoc: r.eLoc })));
            setSuggestions(results);
        } catch (error) {
            console.error('Search failed:', error);
            setSuggestions([]);
        } finally {
            setIsLoadingInternal(false);
        }
    }, []);

    // Handle input change with debounce
    useEffect(() => {
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }

        debounceRef.current = setTimeout(() => {
            handleSearch(query);
        }, 300);

        return () => {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }
        };
    }, [query, handleSearch]);

    const handleSelect = (address: ValidatedAddress) => {
        console.log('[AddressSearch] Selected:', { formattedAddress: address.formattedAddress, lat: address.lat, lng: address.lng, eLoc: address.eLoc });
        setQuery(address.formattedAddress);
        setSuggestions([]);
        setIsFocused(false);
        onAddressSelect(address);
        inputRef.current?.blur();
    };

    const handleClear = () => {
        setQuery('');
        setSuggestions([]);
        inputRef.current?.focus();
    };

    const showDropdown = isFocused && (suggestions.length > 0 || (recentAddresses.length > 0 && !query));

    return (
        <div className={cn('relative', className)} style={{ zIndex: 1100 }}>
            {/* Input container */}
            <div className="relative">
                {/* Search icon */}
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                    {isLoading ? (
                        <div className="w-5 h-5 border-2 border-[#f2546d] border-t-transparent rounded-full animate-spin" />
                    ) : (
                        <Search className="w-5 h-5 text-zinc-400" />
                    )}
                </div>

                {/* Input */}
                <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setTimeout(() => setIsFocused(false), 200)}
                    placeholder={placeholder}
                    disabled={disabled}
                    className={cn(
                        'w-full bg-zinc-900 border border-zinc-800 text-white text-sm rounded-2xl',
                        'py-3.5 pl-11 pr-24',
                        'placeholder:text-zinc-500',
                        'focus:outline-none focus:ring-2 focus:ring-[#f2546d]/50 focus:border-[#f2546d]/50',
                        'transition-all',
                        disabled && 'opacity-50 cursor-not-allowed'
                    )}
                />

                {/* Right actions */}
                <div className="absolute inset-y-0 right-2 flex items-center gap-1">
                    {/* Clear button */}
                    {query && (
                        <button
                            onClick={handleClear}
                            className="p-2 rounded-full hover:bg-zinc-800 transition-colors"
                        >
                            <X className="w-4 h-4 text-zinc-400" />
                        </button>
                    )}

                    {/* Locate me button */}
                    {onLocateMe && (
                        <button
                            onClick={onLocateMe}
                            className="p-2 rounded-full bg-[#f2546d]/20 hover:bg-[#f2546d]/30 transition-colors"
                            title="Use my location"
                        >
                            <Navigation className="w-4 h-4 text-[#f2546d]" />
                        </button>
                    )}
                </div>
            </div>

            {/* Dropdown - rendered with fixed-like positioning to escape parent overflow constraints */}
            {showDropdown && (
                <div
                    className="absolute top-full left-0 right-0 mt-2 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl"
                    style={{
                        zIndex: 9999,
                        position: 'absolute',
                        maxHeight: '400px',
                        overflowY: 'auto',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
                    }}
                >

                    {/* Recent addresses */}
                    {!query && recentAddresses.length > 0 && (
                        <div className="p-3 border-b border-zinc-800">
                            <div className="flex items-center gap-2 mb-2">
                                <Clock className="w-4 h-4 text-zinc-500" />
                                <span className="text-xs text-zinc-500 font-medium">Recent</span>
                            </div>
                            {recentAddresses.map((addr, idx) => (
                                <button
                                    key={idx}
                                    onMouseDown={() => handleSelect(addr)}
                                    className="w-full text-left p-2 rounded-xl hover:bg-zinc-800 transition-colors mb-1 last:mb-0"
                                >
                                    <p className="text-sm text-white truncate">{addr.formattedAddress}</p>
                                    {addr.city && (
                                        <p className="text-xs text-zinc-500 mt-0.5">{addr.city}</p>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Search suggestions */}
                    {suggestions.length > 0 && (
                        <div className="max-h-[300px] overflow-y-auto">
                            {suggestions.map((addr, idx) => (
                                <button
                                    key={idx}
                                    onMouseDown={() => handleSelect(addr)}
                                    className="w-full flex items-start gap-3 p-3 hover:bg-zinc-800 transition-colors border-b border-zinc-800/50 last:border-0"
                                >
                                    <MapPin className="w-5 h-5 text-[#f2546d] flex-shrink-0 mt-0.5" />
                                    <div className="text-left min-w-0">
                                        <p className="text-sm text-white">{addr.formattedAddress}</p>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            {addr.city && (
                                                <p className="text-xs text-zinc-500">{addr.city}</p>
                                            )}
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}

                    {/* No results */}
                    {query && query.length >= 3 && suggestions.length === 0 && !isLoading && (
                        <div className="p-4 text-center">
                            <p className="text-sm text-zinc-500">No locations found</p>
                            <p className="text-xs text-zinc-600 mt-1">Try a different search term</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default AddressSearchInput;
