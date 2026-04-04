import { useState, useEffect, useRef, useCallback } from 'react';
import { MapplsSuggestion, MapplsPlaceDetails, fetchPlaceDetails } from '../services/mapplsService';
import { callLocationFn } from '@/utils/env';

export interface UseAddressSearchReturn {
  query: string;
  setQuery: (q: string) => void;
  suggestions: MapplsSuggestion[];
  isSearching: boolean;
  isResolvingCoords: boolean;
  resolveError: string | null;
  selectedAddress: MapplsPlaceDetails | null;
  onSuggestionSelect: (s: MapplsSuggestion) => void;
  clearSelection: () => void;
}

export function useAddressSearch(): UseAddressSearchReturn {
  const [query, setQueryState] = useState<string>('');
  const [suggestions, setSuggestions] = useState<MapplsSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [isResolvingCoords, setIsResolvingCoords] = useState<boolean>(false);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [selectedAddress, setSelectedAddress] = useState<MapplsPlaceDetails | null>(null);

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const setQuery = useCallback((q: string) => {
    setQueryState(q);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    const trimmedQuery = q.trim();
    if (trimmedQuery.length < 3) {
      setSuggestions([]);
      setIsSearching(false);
      return;
    }

    debounceTimerRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const data = await callLocationFn({ action: 'search', query: trimmedQuery });
        const results = Array.isArray(data) ? data : (data?.suggestedLocations ?? []);
        setSuggestions(results);
      } catch (err) {
        setSuggestions([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  }, []);

  const onSuggestionSelect = useCallback(async (suggestion: MapplsSuggestion) => {
    setIsResolvingCoords(true);
    setResolveError(null);
    setSuggestions([]);
    setQueryState(suggestion.placeName || '');

    try {
      const details = await fetchPlaceDetails(suggestion.eLoc);
      setSelectedAddress(details);
      setResolveError(null);
    } catch (err: unknown) {
      setSelectedAddress(null);
      if (err instanceof Error) {
        setResolveError(err.message);
      } else {
        setResolveError('Failed to resolve coordinates');
      }
    } finally {
      setIsResolvingCoords(false);
    }
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedAddress(null);
    setSuggestions([]);
    setQueryState('');
    setResolveError(null);
  }, []);

  return {
    query,
    setQuery,
    suggestions,
    isSearching,
    isResolvingCoords,
    resolveError,
    selectedAddress,
    onSuggestionSelect,
    clearSelection
  };
}
