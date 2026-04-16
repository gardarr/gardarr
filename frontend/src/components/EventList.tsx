import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/StatusBadge";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { normalizeTaskStatus } from "@/utils/statusUtils";
import { type EventType, EVENT_TYPES } from "@/constants/eventTypes";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  AlertCircle,
  CheckCircle,
  XCircle,
  PlusCircle,
  ArrowRightLeft,
  RefreshCw,
  Filter,
  Search,
  HelpCircle
} from "lucide-react";

export type FilterType = EventType | "all";

export interface Event {
  uuid: string;
  agent_id: string;
  type: EventType;
  task_hash: string;
  old_value?: string;
  new_value?: string;
  metadata?: {
    name?: string;
    progress?: number;
    old_progress?: number;
    new_progress?: number;
    last_progress?: number;
  };
  created_at: string;
}

interface EventListProps {
  events: Event[];
  isLoading: boolean;
  total: number;
  page: number;
  limit: number;
  filterType: FilterType;
  searchQuery?: string;
  onFilterChange: (value: FilterType) => void;
  onPageChange: (page: number) => void;
  onRefresh: () => void;
  onSearchChange?: (query: string) => void;
}

export function EventList({
  events,
  isLoading,
  total,
  page,
  limit,
  filterType,
  searchQuery = "",
  onFilterChange,
  onPageChange,
  onRefresh,
  onSearchChange,
}: EventListProps) {
  const { t, i18n } = useTranslation();

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString(i18n.language, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return t("history.time.justNow");
    if (diffMins < 60) return t("history.time.minutesAgo", { count: diffMins });
    if (diffHours < 24) return t("history.time.hoursAgo", { count: diffHours });
    return t("history.time.daysAgo", { count: diffDays });
  };

  const getEventIcon = (type: EventType) => {
    switch (type) {
      case "torrent.state_change":
        return <ArrowRightLeft className="h-5 w-5" />;
      case "torrent.added":
        return <PlusCircle className="h-5 w-5" />;
      case "torrent.removed":
        return <XCircle className="h-5 w-5" />;
      case "torrent.completed":
        return <CheckCircle className="h-5 w-5" />;
    }
  };

  const getEventColor = (type: EventType) => {
    switch (type) {
      case "torrent.state_change":
        return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20";
      case "torrent.added":
        return "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20";
      case "torrent.removed":
        return "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20";
      case "torrent.completed":
        return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
    }
  };

  const getEventDescription = (event: Event) => {
    switch (event.type) {
      case "torrent.state_change":
      case "torrent.added":
      case "torrent.removed":
      case "torrent.completed":
        return null;
    }
  };

  const renderStateChange = (oldValue?: string, newValue?: string) => {
    if (!oldValue || !newValue) return null;

    const oldStatus = normalizeTaskStatus(oldValue);
    const newStatus = normalizeTaskStatus(newValue);

    return (
      <div className="flex items-center gap-2 flex-wrap">
        <StatusBadge status={oldStatus} size="sm" showTooltip={false} showLabel={true} />
        <span className="text-xs text-muted-foreground">→</span>
        <StatusBadge status={newStatus} size="sm" showTooltip={false} showLabel={true} />
      </div>
    );
  };

  const getEventBadge = (type: EventType) => {
    const typeMap: Record<EventType, string> = {
      "torrent.state_change": t("history.badge.stateChange"),
      "torrent.added": t("history.badge.added"),
      "torrent.removed": t("history.badge.removed"),
      "torrent.completed": t("history.badge.completed"),
    };

    return typeMap[type];
  };

  // Use server-provided pagination and total (search filtering is handled by backend)
  const totalPages = Math.ceil(total / limit);

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 7;

    if (totalPages <= maxVisible) {
      for (let i = 0; i < totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(0);

      let start = Math.max(1, page - 1);
      let end = Math.min(totalPages - 2, page + 1);

      if (page < 3) {
        end = 4;
      }

      if (page > totalPages - 4) {
        start = totalPages - 5;
      }

      if (start > 1) {
        pages.push('...');
      }

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (end < totalPages - 2) {
        pages.push('...');
      }

      pages.push(totalPages - 1);
    }

    return pages;
  };

  return (
    <div className="space-y-4 px-4 sm:px-6">
      {/* Filters and Actions */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder={t("history.search.placeholder") || "Search events..."}
            value={searchQuery}
            onChange={(e) => {
              onSearchChange?.(e.target.value);
              onPageChange(0);
            }}
            className="pl-9 h-9"
          />
        </div>

        <Select value={filterType} onValueChange={(value) => {
          onFilterChange(value as FilterType);
          onPageChange(0);
        }}>
          <SelectTrigger className="w-[160px] sm:w-[200px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder={t("history.filter.all")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("history.filter.all")}</SelectItem>
            {EVENT_TYPES.map((eventType) => (
              <SelectItem key={eventType} value={eventType}>
                {getEventBadge(eventType)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button variant="outline" size="sm" onClick={onRefresh}>
          <RefreshCw className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">{t("history.refresh")}</span>
        </Button>
      </div>

      {/* Events List */}
      {isLoading ? (
        <Card>
          <CardContent className="px-4 sm:px-6 py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
              <p className="text-sm text-muted-foreground mt-4">{t("common.loading")}</p>
            </div>
          </CardContent>
        </Card>
      ) : events.length === 0 ? (
        <Card>
          <CardContent className="px-4 sm:px-6 py-12">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                {searchQuery
                  ? t("history.events.noResults") || "No events found matching your search"
                  : t("history.events.noEvents")
                }
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="divide-y divide-border border rounded-md shadow-sm bg-card overflow-hidden">
            {events.map((event) => (
              <div key={event.uuid} className="p-4 hover:bg-muted/30 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                  {/* Icon and Timestamp */}
                  <div className="flex items-center sm:flex-col gap-3 sm:gap-1 shrink-0 sm:w-24">
                    <div className={`h-8 w-8 sm:h-9 sm:w-9 rounded-full flex items-center justify-center border ${getEventColor(event.type)}`}>
                      {getEventIcon(event.type)}
                    </div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <p className="text-xs text-muted-foreground cursor-help whitespace-nowrap">
                          {formatRelativeTime(event.created_at)}
                        </p>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{formatDate(event.created_at)}</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>

                  {/* Vertical Separator (Only Desktop) */}
                  <div className="hidden sm:block h-10 w-px bg-border shrink-0" />

                  {/* Content */}
                  <div className="flex-1 min-w-0 flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
                    {/* Torrent Name */}
                    <div className="flex-1 min-w-0">
                      {event.metadata?.name ? (
                        <p className="text-sm font-medium text-foreground truncate" title={event.metadata.name}>
                          {event.metadata.name}
                        </p>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground cursor-help">
                                <HelpCircle className="h-4 w-4 text-muted-foreground/70" />
                                <span className="italic">{t("history.events.unknownTorrent")}</span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs">
                              <p className="text-xs">
                                <span className="font-semibold">Hash:</span>{" "}
                                <span className="font-mono break-all">{event.task_hash}</span>
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      )}
                    </div>

                    {/* Description / State Change */}
                    {(event.type === "torrent.state_change" || getEventDescription(event)) && (
                      <div className="shrink-0 flex items-center md:min-w-[160px]">
                        {event.type === "torrent.state_change" ? (
                          renderStateChange(event.old_value, event.new_value)
                        ) : (
                          getEventDescription(event) && (
                            <p className="text-xs text-muted-foreground font-mono truncate max-w-[200px]" title={getEventDescription(event) ?? undefined}>
                              {getEventDescription(event)}
                            </p>
                          )
                        )}
                      </div>
                    )}

                    {/* Badge */}
                    <div className="shrink-0 flex md:items-end md:justify-end md:min-w-[100px]">
                      <Badge variant="outline" className="text-[10px] uppercase font-semibold">
                        {getEventBadge(event.type)}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {(totalPages > 1 || searchQuery) && events.length > 0 && (
            <div className="flex flex-col items-center gap-3 mt-4 sm:mt-6">
              <div className="text-xs sm:text-sm text-muted-foreground">
                {t("history.pagination.showing", {
                  from: Math.min(page * limit + 1, total),
                  to: Math.min((page + 1) * limit, total),
                  total: total,
                })}
              </div>
              <Pagination className="mx-0">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() => onPageChange(Math.max(0, page - 1))}
                      className={page === 0 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>

                  {getPageNumbers().map((pageNum, index) => (
                    <PaginationItem key={pageNum === '...' ? `ellipsis-${index}` : pageNum}>
                      {pageNum === '...' ? (
                        <PaginationEllipsis />
                      ) : (
                        <PaginationLink
                          onClick={() => onPageChange(pageNum as number)}
                          isActive={page === pageNum}
                          className="cursor-pointer"
                        >
                          {(pageNum as number) + 1}
                        </PaginationLink>
                      )}
                    </PaginationItem>
                  ))}

                  <PaginationItem>
                    <PaginationNext
                      onClick={() => onPageChange(Math.min(totalPages - 1, page + 1))}
                      className={page >= totalPages - 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </>
      )}
    </div>
  );
}

