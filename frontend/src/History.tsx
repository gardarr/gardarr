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

  const loadEvents = useCallback(async () => {
    setIsLoading(true);
    try {
      const offset = page * limit;
      let url = `/events?limit=${limit}&offset=${offset}`;
      
      if (filterType && filterType !== "all") {
        url += `&type=${encodeURIComponent(filterType)}`;
      }
      
      if (searchQuery) {
        url += `&search=${encodeURIComponent(searchQuery)}`;
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
  }, [page, limit, filterType, searchQuery]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  // IMPORTANT: These stats are calculated from the current page of events only (up to 50 events),
  // not from the total event history. They represent counts within the currently displayed page.
  // The 'total' variable contains the aggregate count across all pages.
  const completedCount = events.filter(e => e.type === 'torrent.completed').length;
  const addedCount = events.filter(e => e.type === 'torrent.added').length;
  const stateChangeCount = events.filter(e => e.type === 'torrent.state_change').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Activity className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
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

      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="text-2xl font-bold text-primary">{total}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {t('history.stats.totalEvents', 'Total Events')}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="text-2xl font-bold text-emerald-500">{completedCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {t('history.badge.completed')}
            </p>
            <p className="text-[10px] text-muted-foreground/70 mt-0.5">
              (Current Page)
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="text-2xl font-bold text-green-500">{addedCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {t('history.badge.added')}
            </p>
            <p className="text-[10px] text-muted-foreground/70 mt-0.5">
              (Current Page)
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="text-2xl font-bold text-blue-500">{stateChangeCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {t('history.badge.stateChange')}
            </p>
            <p className="text-[10px] text-muted-foreground/70 mt-0.5">
              (Current Page)
            </p>
          </CardContent>
        </Card>
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
