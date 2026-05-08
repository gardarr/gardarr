import { useEffect, useState, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { workerService } from "../services/workers";
import type { LogEntry } from "../types/worker";
import { Loader2, RefreshCw, AlertCircle, Check } from "lucide-react";
import { Button } from "./ui/button";
import { format } from "date-fns";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface WorkerLogsTabProps {
    workerId: string;
}

const LOG_LEVELS = {
    NORMAL: { value: 1, label: "NORMAL", color: "text-foreground" },
    INFO: { value: 2, label: "INFO", color: "text-blue-500 dark:text-blue-400" },
    WARNING: { value: 4, label: "WARNING", color: "text-yellow-600 dark:text-yellow-500" },
    CRITICAL: { value: 8, label: "CRITICAL", color: "text-red-600 dark:text-red-500" },
};

export function WorkerLogsTab({ workerId }: WorkerLogsTabProps) {
    const { t } = useTranslation();

    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [refreshSuccess, setRefreshSuccess] = useState(false);

    // Filters
    const [showNormal, setShowNormal] = useState(true);
    const [showInfo, setShowInfo] = useState(true);
    const [showWarning, setShowWarning] = useState(true);
    const [showCritical, setShowCritical] = useState(true);

    const lastKnownIdRef = useRef<number>(0);
    const bottomRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const fetchLogs = useCallback(async (isRefresh = false) => {
        if (!workerId) return;

        try {
            setLoading(true);
            setError(null);

            const options = {
                normal: showNormal,
                info: showInfo,
                warning: showWarning,
                critical: showCritical,
                lastKnownId: isRefresh ? lastKnownIdRef.current : 0
            };

            const response = await workerService.getWorkerLogs(workerId, options);

            if (response.error) {
                setError(response.error);
                return;
            }

            if (response.data && response.data.length > 0) {
                const newLogs = response.data;

                // Update last known ID based on the highest ID received
                const maxId = Math.max(...newLogs.map(l => l.id));
                if (maxId > lastKnownIdRef.current) {
                    lastKnownIdRef.current = maxId;
                }

                if (isRefresh) {
                    setLogs(prev => [...prev, ...newLogs]);
                } else {
                    setLogs(newLogs);
                }
            } else if (!isRefresh) {
                setLogs([]);
            }
        } catch (err) {
            console.error("Failed to fetch logs:", err);
            setError(err instanceof Error ? err.message : "Failed to load logs");
        } finally {
            setLoading(false);
            if (isRefresh && !error) {
                setRefreshSuccess(true);
                setTimeout(() => setRefreshSuccess(false), 2000);
            }
        }
    }, [workerId, showNormal, showInfo, showWarning, showCritical, error]);

    // Initial fetch and handle filter changes
    useEffect(() => {
        // Reset last known ID when filters change
        lastKnownIdRef.current = 0;
        fetchLogs(false);
    }, [fetchLogs]);

    // Auto scroll logic
    useEffect(() => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
        }
    }, [logs]);

    const getLogColor = (type: number) => {
        switch (type) {
            case LOG_LEVELS.NORMAL.value: return LOG_LEVELS.NORMAL.color;
            case LOG_LEVELS.INFO.value: return LOG_LEVELS.INFO.color;
            case LOG_LEVELS.WARNING.value: return LOG_LEVELS.WARNING.color;
            case LOG_LEVELS.CRITICAL.value: return LOG_LEVELS.CRITICAL.color;
            default: return LOG_LEVELS.NORMAL.color;
        }
    };

    const getLogLabel = (type: number) => {
        switch (type) {
            case LOG_LEVELS.NORMAL.value: return LOG_LEVELS.NORMAL.label;
            case LOG_LEVELS.INFO.value: return LOG_LEVELS.INFO.label;
            case LOG_LEVELS.WARNING.value: return LOG_LEVELS.WARNING.label;
            case LOG_LEVELS.CRITICAL.value: return LOG_LEVELS.CRITICAL.label;
            default: return "Unknown";
        }
    };

    return (
        <div className="flex flex-col h-full space-y-4">
            {/* Controls */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-lg bg-muted/40 border">
                <div className="flex flex-wrap gap-4">
                    <div className="flex items-center space-x-2">
                        <Checkbox id="filter-normal" checked={showNormal} onCheckedChange={(checked) => setShowNormal(!!checked)} />
                        <Label htmlFor="filter-normal" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                            {LOG_LEVELS.NORMAL.label}
                        </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Checkbox id="filter-info" checked={showInfo} onCheckedChange={(checked) => setShowInfo(!!checked)} />
                        <Label htmlFor="filter-info" className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${LOG_LEVELS.INFO.color}`}>
                            {LOG_LEVELS.INFO.label}
                        </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Checkbox id="filter-warning" checked={showWarning} onCheckedChange={(checked) => setShowWarning(!!checked)} />
                        <Label htmlFor="filter-warning" className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${LOG_LEVELS.WARNING.color}`}>
                            {LOG_LEVELS.WARNING.label}
                        </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Checkbox id="filter-critical" checked={showCritical} onCheckedChange={(checked) => setShowCritical(!!checked)} />
                        <Label htmlFor="filter-critical" className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${LOG_LEVELS.CRITICAL.color}`}>
                            {LOG_LEVELS.CRITICAL.label}
                        </Label>
                    </div>
                </div>

                <Button variant="outline" size="sm" onClick={() => fetchLogs(true)} disabled={loading} className="ml-auto">
                    {refreshSuccess && !loading ? (
                        <Check className="h-4 w-4 mr-2 text-green-500 dark:text-green-400" />
                    ) : (
                        <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    )}
                    {refreshSuccess && !loading ? t('common.updated', 'Updated') : t('common.refresh', 'Refresh')}
                </Button>
            </div>

            {/* Log Viewer */}
            <div className="flex-1 relative rounded-md border bg-black/5 dark:bg-black/40 overflow-hidden flex flex-col min-h-0">
                {error && (
                    <div className="absolute top-0 left-0 right-0 p-3 bg-destructive/10 text-destructive text-sm flex items-center justify-center z-10 border-b border-destructive/20">
                        <AlertCircle className="h-4 w-4 mr-2" />
                        {error}
                    </div>
                )}

                <div
                    ref={scrollContainerRef}
                    className="flex-1 overflow-y-auto p-4 font-mono text-xs"
                >
                    {loading && !logs.length ? (
                        <div className="h-full flex items-center justify-center">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mr-2" />
                            <span className="text-muted-foreground">{t('common.loading', 'Loading...')}</span>
                        </div>
                    ) : logs.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-muted-foreground">
                            {t('workers.logs.noLogs', 'No logs found for the selected filters')}
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {logs.map((log) => (
                                <div key={log.id} className="flex gap-4 break-words">
                                    <span className="text-muted-foreground whitespace-nowrap opacity-60 flex-shrink-0">
                                        {format(new Date(log.timestamp * 1000), 'yyyy-MM-dd HH:mm:ss')}
                                    </span>
                                    <span className={`w-20 font-semibold flex-shrink-0 ${getLogColor(log.type)}`}>
                                        [{getLogLabel(log.type)}]
                                    </span>
                                    <span className={`text-foreground flex-1 break-all ${log.type === LOG_LEVELS.CRITICAL.value ? 'font-medium text-red-600 dark:text-red-500' : ''}`}>
                                        {log.message}
                                    </span>
                                </div>
                            ))}
                            <div ref={bottomRef} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
