import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Activity, RefreshCw } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { EventList, type Event, type FilterType } from '@/components/EventList';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';

interface EventsResponse {
  events: Event[];
  total: number;
}

export default function HistoryPage() {
  const { t } = useTranslation();
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [limit] = useState(50);
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState<string>("");

  // Debounce the search box so typing doesn't fire a request per keystroke.
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearchQuery(searchQuery), 350);
    return () => clearTimeout(handle);
  }, [searchQuery]);

  const loadEvents = useCallback(async () => {
    setIsLoading(true);
    try {
      const offset = page * limit;
      let url = `/events?limit=${limit}&offset=${offset}`;

      if (filterType && filterType !== "all") {
        url += `&type=${encodeURIComponent(filterType)}`;
      }

      if (debouncedSearchQuery) {
        url += `&search=${encodeURIComponent(debouncedSearchQuery)}`;
      }

      const response = await api.get<EventsResponse>(url);

      if (response.data) {
        setEvents(response.data.events || []);
        setTotal(response.data.total || 0);
      }
    } catch (error) {
      console.error("Failed to load events:", error);
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, filterType, debouncedSearchQuery]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Activity className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
              {t('history.title')}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {t('history.subtitle')}
            </p>
          </div>
        </div>
        <Button onClick={loadEvents} variant="outline" disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          {t('history.refresh')}
        </Button>
      </div>

      {/* Event List */}
      <Card>
        <CardContent className="p-4 sm:p-6">
          <EventList
            events={events}
            isLoading={isLoading}
            total={total}
            page={page}
            limit={limit}
            filterType={filterType}
            searchQuery={searchQuery}
            onFilterChange={setFilterType}
            onPageChange={setPage}
            onRefresh={loadEvents}
            onSearchChange={setSearchQuery}
          />
        </CardContent>
      </Card>
    </div>
  );
}
