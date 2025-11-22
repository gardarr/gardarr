import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/StatusBadge";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { normalizeTaskStatus } from "@/utils/statusUtils";
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
  Clock, 
  Activity, 
  AlertCircle,
  CheckCircle,
  XCircle,
  PlusCircle,
  ArrowRightLeft,
  RefreshCw,
  Filter
} from "lucide-react";
import { api } from "@/lib/api";
import { setupService } from "@/services/setup";
import StatisticsDisabledAlert from "@/components/StatisticsDisabledAlert";

interface Event {
  uuid: string;
  agent_id: string;
  type: string;
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

interface EventsResponse {
  events: Event[];
  total: number;
}

export default function HistoryPage() {
  const { t, i18n } = useTranslation();
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [limit] = useState(50);
  const [filterType, setFilterType] = useState<string>("all");
  const [statisticsEnabled, setStatisticsEnabled] = useState<boolean>(true);

  const loadEvents = useCallback(async () => {
    setIsLoading(true);
    try {
      const offset = page * limit;
      let url = `/events?limit=${limit}&offset=${offset}`;
      
      // Add type filter if selected and not "all"
      if (filterType && filterType !== "all") {
        url += `&type=${encodeURIComponent(filterType)}`;
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
  }, [page, limit, filterType]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  // Check setup status to determine if statistics are enabled
  useEffect(() => {
    const checkStatisticsStatus = async () => {
      try {
        const result = await setupService.checkSetup();
        setStatisticsEnabled(result.data?.statistics_enabled ?? true);
      } catch (error) {
        // On error, assume statistics are enabled to avoid blocking the UI
        console.error('Failed to check statistics status:', error);
        setStatisticsEnabled(true);
      }
    };
    checkStatisticsStatus();
  }, []);

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
    // Always show relative time, even for events older than 7 days
    return t("history.time.daysAgo", { count: diffDays });
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case "torrent.state_change":
        return <ArrowRightLeft className="h-5 w-5" />;
      case "torrent.added":
        return <PlusCircle className="h-5 w-5" />;
      case "torrent.removed":
        return <XCircle className="h-5 w-5" />;
      case "torrent.completed":
        return <CheckCircle className="h-5 w-5" />;
      default:
        return <Activity className="h-5 w-5" />;
    }
  };

  const getEventColor = (type: string) => {
    switch (type) {
      case "torrent.state_change":
        return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20";
      case "torrent.added":
        return "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20";
      case "torrent.removed":
        return "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20";
      case "torrent.completed":
        return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
      default:
        return "bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20";
    }
  };

  const getEventDescription = (event: Event) => {
    switch (event.type) {
      case "torrent.state_change":
        // Return null for state_change - we'll render badges separately
        return null;
      case "torrent.added":
        // Don't show description for added torrents
        return null;
      case "torrent.removed":
        // Don't show description for removed torrents
        return null;
      case "torrent.completed":
        // Don't show description for completed torrents
        return null;
      default:
        return "";
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

  const getEventBadge = (type: string) => {
    const typeMap: Record<string, string> = {
      "torrent.state_change": t("history.badge.stateChange"),
      "torrent.added": t("history.badge.added"),
      "torrent.removed": t("history.badge.removed"),
      "torrent.completed": t("history.badge.completed"),
    };
    
    return typeMap[type] || type;
  };

  const totalPages = Math.ceil(total / limit);

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 7; // Maximum number of page buttons to show
    
    if (totalPages <= maxVisible) {
      // Show all pages if total is small
      for (let i = 0; i < totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(0);
      
      // Calculate range around current page
      let start = Math.max(1, page - 1);
      let end = Math.min(totalPages - 2, page + 1);
      
      // Adjust if we're near the beginning
      if (page < 3) {
        end = 4;
      }
      
      // Adjust if we're near the end
      if (page > totalPages - 4) {
        start = totalPages - 5;
      }
      
      // Add ellipsis if needed at the start
      if (start > 1) {
        pages.push('...');
      }
      
      // Add middle pages
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      
      // Add ellipsis if needed at the end
      if (end < totalPages - 2) {
        pages.push('...');
      }
      
      // Always show last page
      pages.push(totalPages - 1);
    }
    
    return pages;
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 md:h-12 md:w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Clock className="h-5 w-5 md:h-6 md:w-6 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{t("history.title")}</h1>
            <p className="text-sm text-muted-foreground hidden sm:block">{t("history.subtitle")}</p>
          </div>
        </div>
        
        <div className="flex gap-2 flex-wrap">
          <Select value={filterType} onValueChange={(value) => {
            setFilterType(value);
            setPage(0); // Reset to first page when filter changes
          }}>
            <SelectTrigger className="w-[160px] sm:w-[200px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder={t("history.filter.all")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("history.filter.all")}</SelectItem>
              <SelectItem value="torrent.state_change">{t("history.badge.stateChange")}</SelectItem>
              <SelectItem value="torrent.added">{t("history.badge.added")}</SelectItem>
              <SelectItem value="torrent.removed">{t("history.badge.removed")}</SelectItem>
              <SelectItem value="torrent.completed">{t("history.badge.completed")}</SelectItem>
            </SelectContent>
          </Select>
          
          <Button variant="outline" size="sm" onClick={loadEvents}>
            <RefreshCw className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">{t("history.refresh")}</span>
          </Button>
        </div>
      </div>

      {/* Statistics Warning */}
      <StatisticsDisabledAlert statisticsEnabled={statisticsEnabled} />

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
              <p className="text-muted-foreground">{t("history.events.noEvents")}</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-3">
            {events.map((event) => (
              <Card key={event.uuid}>
                <CardContent className="px-4 sm:px-6 py-2">
                  <div className="flex items-start gap-3">
                    {/* Icon and Timestamp */}
                    <div className="flex flex-col items-center gap-1 shrink-0">
                      <div className={`h-9 w-9 sm:h-10 sm:w-10 rounded-full flex items-center justify-center border ${getEventColor(event.type)}`}>
                        {getEventIcon(event.type)}
                      </div>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <p className="text-xs text-muted-foreground cursor-help leading-tight text-center">
                            {formatRelativeTime(event.created_at)}
                          </p>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{formatDate(event.created_at)}</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>

                    {/* Vertical Separator */}
                    <Separator orientation="vertical" className="self-stretch min-h-[50px]" />

                    {/* Content */}
                    <div className="flex-1 min-w-0 space-y-1">
                      {/* Badge */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-xs shrink-0">
                          {getEventBadge(event.type)}
                        </Badge>
                      </div>
                      
                      {/* Torrent Name - Subtitle */}
                      {event.metadata?.name && (
                        <p className="text-sm text-foreground truncate leading-snug" title={event.metadata.name}>
                          {event.metadata.name}
                        </p>
                      )}
                      
                      {/* Description */}
                      {event.type === "torrent.state_change" ? (
                        <div className={event.metadata?.name ? "mt-2" : ""}>
                          {renderStateChange(event.old_value, event.new_value)}
                        </div>
                      ) : (
                        getEventDescription(event) && (
                          <p className="text-xs text-muted-foreground font-mono leading-tight">
                            {getEventDescription(event)}
                          </p>
                        )
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex flex-col items-center gap-3 mt-4 sm:mt-6">
              <div className="text-xs sm:text-sm text-muted-foreground">
                {t("history.pagination.showing", {
                  from: page * limit + 1,
                  to: Math.min((page + 1) * limit, total),
                  total,
                })}
              </div>
              <Pagination className="mx-0">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious 
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                      className={page === 0 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>
                  
                  {getPageNumbers().map((pageNum, index) => (
                    <PaginationItem key={pageNum === '...' ? `ellipsis-${index}` : pageNum}>
                      {pageNum === '...' ? (
                        <PaginationEllipsis />
                      ) : (
                        <PaginationLink
                          onClick={() => setPage(pageNum as number)}
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
                      onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
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
