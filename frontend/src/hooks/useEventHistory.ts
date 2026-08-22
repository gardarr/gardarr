import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import type { Event, FilterType } from '@/components/EventList';
import type { EventGroup } from '@/constants/eventTypes';

interface EventsResponse {
  events: Event[];
  total: number;
}

/**
 * Fetches one event group's page (torrent, worker, or all) independently,
 * so multiple tables/views can each have their own filter/search/pagination
 * instead of sharing one combined, mixed-type feed.
 *
 * `enabled: false` skips fetching (e.g. a sheet that only needs events once
 * opened) without unmounting the caller's state.
 */
export function useEventHistory(group: EventGroup, limit = 10, enabled = true) {
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearchQuery(searchQuery), 350);
    return () => clearTimeout(handle);
  }, [searchQuery]);

  // Guards against an in-flight request from a stale page/filter/search
  // combination resolving after a newer one and overwriting its results.
  const requestSeqRef = useRef(0);

  const loadEvents = useCallback(async () => {
    if (!enabled) return;
    const seq = ++requestSeqRef.current;
    setIsLoading(true);
    try {
      const offset = page * limit;
      let url = `/events?group=${group}&limit=${limit}&offset=${offset}`;

      if (filterType && filterType !== 'all') {
        url += `&type=${encodeURIComponent(filterType)}`;
      }

      if (debouncedSearchQuery) {
        url += `&search=${encodeURIComponent(debouncedSearchQuery)}`;
      }

      const response = await api.get<EventsResponse>(url);

      if (seq !== requestSeqRef.current) return;

      if (response.data) {
        setEvents(response.data.events || []);
        setTotal(response.data.total || 0);
      }
    } catch (error) {
      console.error(`Failed to load ${group} events:`, error);
    } finally {
      if (seq === requestSeqRef.current) {
        setIsLoading(false);
      }
    }
  }, [group, page, limit, filterType, debouncedSearchQuery, enabled]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  return {
    events,
    isLoading,
    total,
    page,
    limit,
    filterType,
    searchQuery,
    onFilterChange: (value: FilterType) => setFilterType(value),
    onPageChange: (value: number) => setPage(value),
    onSearchChange: (value: string) => setSearchQuery(value),
    refresh: loadEvents,
  };
}
