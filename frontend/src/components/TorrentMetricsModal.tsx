import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BarChart3, Loader2, ArrowDown, ArrowUp, Gauge, Database, Globe, Users, UserPlus, UserMinus, Activity, Network, TrendingUp, HardDrive, Users2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";
import { statisticsService } from "@/services/statistics";
import { torrentService } from "@/services/torrents";
import type { Task } from "@/types/torrent";
import DateRangePicker from "@/components/DateRangePicker";
import { formatBytes, formatBytesPerSecond } from "@/utils/bytes";
import { TorrentContributionWidget } from "@/components/widgets/TorrentContributionWidget";

interface TorrentMetricsModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskId: string;
  agentId?: string;
  selectedCount?: number;
  taskName?: string;
  taskIds?: string[]; // Multiple task IDs for multi-series charts
}

interface SpeedPoint {
  time: string;
  download: number;
  upload: number;
  seeders: number;
  leechers: number;
  avgRatio: number;
  totalDownloadBytes: number;
  totalUploadBytes: number;
  // For multi-series support: dynamic task properties
  [key: string]: string | number; // e.g., download_taskHash, upload_taskHash
}

interface WindowTaskData {
  snaps?: number;
  dl_kb?: number;
  ul_kb?: number;
  seeders?: number;
  leechers?: number;
  total_dl_bytes?: number;
  total_ul_bytes?: number;
  sum_r1e4?: number;
  avg_ratio?: number;
}

// Chart configuration
const speedChartConfig = {
  download: {
    label: "Download Speed",
    theme: {
      light: "hsl(142.1 76.2% 36.3%)",
      dark: "hsl(142.1 70.6% 45.3%)",
    },
  },
  upload: {
    label: "Upload Speed",
    theme: {
      light: "hsl(262.1 83.3% 57.8%)",
      dark: "hsl(263.4 70% 50.4%)",
    },
  },
};

const peersChartConfig = {
  seeders: {
    label: "Seeders",
    theme: {
      light: "hsl(142.1 76.2% 36.3%)",
      dark: "hsl(142.1 70.6% 45.3%)",
    },
  },
  leechers: {
    label: "Leechers",
    theme: {
      light: "hsl(0 84.2% 60.2%)",
      dark: "hsl(0 72.2% 50.6%)",
    },
  },
};

const ratioChartConfig = {
  avgRatio: {
    label: "Ratio Médio",
    theme: {
      light: "hsl(217.2 91.2% 59.8%)",
      dark: "hsl(217.2 91.2% 59.8%)",
    },
  },
};

const totalBytesChartConfig = {
  totalDownloadBytes: {
    label: "Total Download",
    theme: {
      light: "hsl(142.1 76.2% 36.3%)",
      dark: "hsl(142.1 70.6% 45.3%)",
    },
  },
  totalUploadBytes: {
    label: "Total Upload",
    theme: {
      light: "hsl(262.1 83.3% 57.8%)",
      dark: "hsl(263.4 70% 50.4%)",
    },
  },
};

// Helper function to format time range
function formatTimeRange(fromDate: Date | undefined, toDate: Date | undefined): string {
  if (!fromDate || !toDate) return "";
  
  const diffMs = toDate.getTime() - fromDate.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays > 0) {
    return `${diffDays}d`;
  } else if (diffHours > 0) {
    return `${diffHours}h`;
  } else if (diffMinutes > 0) {
    return `${diffMinutes}m`;
  } else {
    return "0m";
  }
}

// Reusable components
interface MetricItemProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  iconClassName?: string;
}

function MetricItem({ icon: Icon, label, value, iconClassName }: MetricItemProps) {
  return (
    <div className="flex items-center gap-2">
      <Tooltip>
        <TooltipTrigger asChild>
          <Icon className={`h-3.5 w-3.5 text-muted-foreground cursor-help ${iconClassName || ""}`} />
        </TooltipTrigger>
        <TooltipContent>
          <span>{label}</span>
        </TooltipContent>
      </Tooltip>
      <span className="text-sm text-muted-foreground">{value}</span>
    </div>
  );
}

interface MetricSectionProps {
  title: string;
  icon: LucideIcon;
  iconColor?: string;
  items: Array<{
    icon: LucideIcon;
    label: string;
    value: string | number;
    iconClassName?: string;
  }>;
}

function MetricSection({ title, icon: Icon, iconColor, items }: MetricSectionProps) {
  return (
    <div className="flex-1">
      <div className="flex items-center gap-2 mb-3">
        <Icon className={`h-4 w-4 ${iconColor || "text-muted-foreground"}`} />
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</h4>
      </div>
      <TooltipProvider>
        <div className="space-y-2">
          {items.map((item, index) => (
            <MetricItem key={index} {...item} />
          ))}
        </div>
      </TooltipProvider>
    </div>
  );
}

// Speed Chart Component (Line Chart style like TaskMetrics)
interface SpeedChartProps {
  title: string;
  icon: LucideIcon;
  config: Record<string, { label: string; theme: { light: string; dark: string } }>;
  data: SpeedPoint[];
  lines: Array<{
    dataKey: string;
    tooltipFormatter?: (value: number, name: string) => [string, string];
  }>;
  yAxisFormatter?: (value: number) => string;
  yAxisLabel?: string;
}

function SpeedChart({ title, icon: Icon, config, data, lines, yAxisFormatter, yAxisLabel }: SpeedChartProps) {
  return (
    <div className="rounded-xl border p-2 sm:p-4 overflow-x-hidden">
      <div className="flex items-center gap-2 mb-4">
        <Icon className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <ChartContainer config={config} className="h-[300px] w-full">
        <LineChart data={data} width={undefined} height={300}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="time" 
            tick={{ fontSize: 12 }}
            tickLine={{ stroke: 'hsl(var(--muted-foreground))' }}
          />
          <YAxis 
            tick={{ fontSize: 12 }}
            tickLine={{ stroke: 'hsl(var(--muted-foreground))' }}
            tickFormatter={yAxisFormatter}
            label={yAxisLabel ? { value: yAxisLabel, angle: -90, position: 'insideLeft' } : undefined}
          />
          <ChartTooltip 
            content={
              <ChartTooltipContent 
                formatter={(value, name) => {
                  const line = lines.find(l => l.dataKey === name);
                  if (line?.tooltipFormatter) {
                    return line.tooltipFormatter(value as number, name as string);
                  }
                  return [`${value}`, config[name as string]?.label || name as string];
                }}
              />
            } 
          />
          {lines.map((line) => (
            <Line 
              key={line.dataKey}
              type="monotone" 
              dataKey={line.dataKey}
              stroke={`var(--color-${line.dataKey})`}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 6, stroke: `var(--color-${line.dataKey})`, strokeWidth: 2 }}
            />
          ))}
        </LineChart>
      </ChartContainer>
    </div>
  );
}

export function TorrentMetricsModal({
  isOpen,
  onClose,
  taskId,
  agentId,
  selectedCount = 1,
  taskName,
  taskIds = []
}: TorrentMetricsModalProps) {
  const [chartData, setChartData] = useState<SpeedPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [taskHash, setTaskHash] = useState<string>(taskId);
  const [taskHashes, setTaskHashes] = useState<string[]>([]); // Multiple hashes for multi-select
  const [taskData, setTaskData] = useState<Task | null>(null);
  const [aggregatedTaskData, setAggregatedTaskData] = useState<Task | null>(null); // Aggregated data for multiple tasks
  const fetchingKeyRef = useRef<string>(""); // Track the key currently being fetched
  const metricsFetchedRef = useRef<string>(""); // Track what was already fetched
  
  // Date range state - initialize with 1 hour
  const [fromDate, setFromDate] = useState<Date | undefined>(() => {
    const to = new Date();
    return new Date(to.getTime() - 60 * 60 * 1000); // 1 hour ago
  });
  const [toDate, setToDate] = useState<Date | undefined>(() => new Date());

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setChartData([]);
      setError(null);
      setTaskHash(taskId);
      setTaskData(null);
      fetchingKeyRef.current = "";
      metricsFetchedRef.current = "";
      // Reset dates to 1 hour
      const to = new Date();
      setFromDate(new Date(to.getTime() - 60 * 60 * 1000));
      setToDate(to);
      return;
    }
  }, [isOpen, taskId]);

  // Fetch task to get hash and task data
  useEffect(() => {
    if (!isOpen || !agentId) return;

    const fetchTask = async () => {
      try {
        const response = await torrentService.listAgentTasks(agentId);
        if (response.data) {
          // If multiple tasks selected, fetch hashes and aggregate data for all
          if (selectedCount > 1 && taskIds.length > 0) {
            const hashes: string[] = [];
            const tasks: Task[] = [];
            
            for (const id of taskIds) {
              const task = response.data.find((t: Task) => t.id === id);
              if (task) {
                tasks.push(task);
                if (task.hash) {
                  hashes.push(task.hash);
                } else {
                  // If no hash, use ID directly
                  hashes.push(id);
                }
              }
            }
            
            setTaskHashes(hashes);
            
            // Aggregate task data from all selected tasks
            if (tasks.length > 0) {
              const aggregated: Task = {
                ...tasks[0], // Use first task as base
                name: `${tasks.length} torrents selected`,
                network: {
                  download: {
                    speed: tasks.reduce((sum, t) => sum + (t.network?.download?.speed || 0), 0),
                    amount: tasks.reduce((sum, t) => sum + (t.network?.download?.amount || 0), 0),
                  },
                  upload: {
                    speed: tasks.reduce((sum, t) => sum + (t.network?.upload?.speed || 0), 0),
                    amount: tasks.reduce((sum, t) => sum + (t.network?.upload?.amount || 0), 0),
                  },
                },
                pairs: {
                  seeders: tasks.reduce((sum, t) => sum + (t.pairs?.seeders || 0), 0),
                  leechers: tasks.reduce((sum, t) => sum + (t.pairs?.leechers || 0), 0),
                  swarm_seeders: tasks.reduce((sum, t) => sum + (t.pairs?.swarm_seeders || 0), 0),
                  swarm_leechers: tasks.reduce((sum, t) => sum + (t.pairs?.swarm_leechers || 0), 0),
                },
              };
              setAggregatedTaskData(aggregated);
            }
          } else {
            // Single task - clear aggregated data
            setAggregatedTaskData(null);
          }
          
          // Also get primary task data for display
          const task = response.data.find((t: Task) => t.id === taskId);
          if (task) {
            setTaskData(task);
            if (task.hash && task.hash !== taskHash) {
              setTaskHash(task.hash);
            } else if (!task.hash && taskId !== taskHash) {
              // If task ID is already a hash, use it directly
              setTaskHash(taskId);
            }
          }
        }
      } catch (err) {
        console.error("Failed to fetch task:", err);
      }
    };

    fetchTask();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, agentId, taskId, taskIds, selectedCount]);

  // Fetch metrics data
  useEffect(() => {
    if (!isOpen || !agentId || !taskHash || !fromDate || !toDate) return;
    
    // Create a unique key for this fetch (include date range)
    const fetchKey = `${agentId}-${taskHash}-${fromDate.toISOString()}-${toDate.toISOString()}`;
    
    // Skip if already fetched this exact combination, or if already fetching this exact key
    if (fetchingKeyRef.current === fetchKey || metricsFetchedRef.current === fetchKey) {
      return;
    }

    const fetchMetrics = async () => {
      fetchingKeyRef.current = fetchKey;
      metricsFetchedRef.current = fetchKey;
      setLoading(true);
      setError(null);

      // Calculate time range and determine appropriate step
      const diffMs = toDate.getTime() - fromDate.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      
      // Determine step based on time range to avoid too many data points
      let step: string;
      let stepMinutes: number;
      if (diffDays >= 3) {
        step = "1h"; // 1 hour for 3+ days
        stepMinutes = 60;
      } else if (diffDays >= 1) {
        step = "15m"; // 15 minutes for 1-3 days
        stepMinutes = 15;
      } else if (diffHours >= 6) {
        step = "5m"; // 5 minutes for 6-24 hours
        stepMinutes = 5;
      } else {
        step = "1m"; // 1 minute for < 6 hours
        stepMinutes = 1;
      }

      try {
        const response = await statisticsService.getWindowedByTask({
          agentId,
          taskHash,
          from: fromDate.toISOString(),
          to: toDate.toISOString(),
          step,
        });

        // Verify we're still supposed to be fetching this (compare against original fetchKey)
        if (fetchingKeyRef.current !== fetchKey) {
          // Another fetch started, ignore this one
          return;
        }

        if (response.error) {
          // Only update state if this is still the current fetch
          if (fetchingKeyRef.current === fetchKey) {
            setError(response.error);
            fetchingKeyRef.current = "";
            metricsFetchedRef.current = "";
            setLoading(false);
          }
          return;
        }

        if (!response.data?.windows) {
          // Only update state if this is still the current fetch
          if (fetchingKeyRef.current === fetchKey) {
            setError("No data available");
            fetchingKeyRef.current = "";
            metricsFetchedRef.current = "";
            setLoading(false);
          }
          return;
        }

        // Structure: windows is an object where keys are timestamps
        // Each timestamp contains an object where keys are task hashes
        // { "2025-11-01T15:05:00Z": { "taskHash": { ...data... } } }
        const windowsData = response.data.windows;
        
        if (typeof windowsData !== 'object' || windowsData === null || Array.isArray(windowsData)) {
          // Only update state if this is still the current fetch
          if (fetchingKeyRef.current === fetchKey) {
            setError("Invalid data format");
            fetchingKeyRef.current = "";
            metricsFetchedRef.current = "";
            setLoading(false);
          }
          return;
        }

        // Transform data: create complete interval and fill with actual data or zeros
        const windowsObj = windowsData as Record<string, Record<string, WindowTaskData>>;
        
        // Create a map of available data by timestamp
        const dataMap = new Map<string, WindowTaskData>();
        for (const [timestamp, timestampData] of Object.entries(windowsObj)) {
          if (timestampData && typeof timestampData === 'object') {
            const taskData = timestampData[taskHash];
            if (taskData) {
              dataMap.set(timestamp, taskData);
            }
          }
        }

        // Generate complete interval with appropriate step based on time range
        const transformed: SpeedPoint[] = [];
        const stepMs = stepMinutes * 60 * 1000;
        const diffDaysForFormat = diffMs / (1000 * 60 * 60 * 24);
        
        // Round 'fromDate' to the nearest step interval (downward)
        const fromRounded = new Date(Math.floor(fromDate.getTime() / stepMs) * stepMs);
        
        // Generate points for the entire selected period
        for (let current = new Date(fromRounded); current <= toDate; current = new Date(current.getTime() + stepMs)) {
          // Format timestamp to match API format (round to nearest 1 minute)
          const timestamp = new Date(Math.floor(current.getTime() / stepMs) * stepMs);
          const timestampStr = timestamp.toISOString();
          
          // Try to find exact match, or closest available data
          let taskData: WindowTaskData | undefined = dataMap.get(timestampStr);
          
          // If no exact match, try to find closest (within 1 minute)
          if (!taskData) {
            for (const [key, value] of dataMap.entries()) {
              const keyTime = new Date(key).getTime();
              const timeDiff = Math.abs(keyTime - timestamp.getTime());
              if (timeDiff <= stepMs) {
                taskData = value;
                break;
              }
            }
          }

          // dl_kb and ul_kb are already maximum speeds in KB/s (not total data transferred)
          // Convert from KB/s to bytes/s by multiplying by 1024
          const dlBytesPerSecond = taskData?.dl_kb 
            ? taskData.dl_kb * 1024
            : 0;
          const ulBytesPerSecond = taskData?.ul_kb 
            ? taskData.ul_kb * 1024
            : 0;

          // Format time for display - adjust format based on step size
          let timeStr: string;
          if (stepMinutes >= 60) {
            // For hourly or larger steps, show date and time
            timeStr = current.toLocaleString("pt-BR", {
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            });
          } else if (stepMinutes >= 15) {
            // For 15+ minute steps, show time with date if it spans multiple days
            if (diffDaysForFormat >= 1) {
              timeStr = current.toLocaleString("pt-BR", {
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              });
            } else {
              timeStr = current.toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              });
            }
          } else {
            // For smaller steps, just show time
            timeStr = current.toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
            });
          }

          transformed.push({
            time: timeStr,
            download: dlBytesPerSecond,
            upload: ulBytesPerSecond,
            seeders: taskData?.seeders || 0,
            leechers: taskData?.leechers || 0,
            avgRatio: taskData?.avg_ratio || 0,
            totalDownloadBytes: taskData?.total_dl_bytes || 0,
            totalUploadBytes: taskData?.total_ul_bytes || 0,
          });
        }

        // Only update state if this is still the current fetch
        if (fetchingKeyRef.current === fetchKey) {
          if (transformed.length === 0) {
            setError("No data available for this task");
          } else {
            setChartData(transformed);
          }
        }
      } catch (err) {
        console.error("Failed to fetch metrics:", err);
        // Only update state if this is still the current fetch
        if (fetchingKeyRef.current === fetchKey) {
          setError(err instanceof Error ? err.message : "Failed to fetch metrics");
          metricsFetchedRef.current = "";
        }
      } finally {
        // Only clear the fetching key and loading state if this is still the current fetch
        if (fetchingKeyRef.current === fetchKey) {
          fetchingKeyRef.current = "";
          setLoading(false);
        }
      }
    };

    fetchMetrics();

    // Cleanup: reset fetching key when modal closes or dependencies change
    return () => {
      if (!isOpen) {
        fetchingKeyRef.current = "";
        metricsFetchedRef.current = "";
      }
    };
  }, [isOpen, agentId, taskHash, fromDate, toDate]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-[95vw] max-h-[85vh] overflow-y-auto overflow-x-hidden mx-0 p-2 sm:w-auto sm:max-w-4xl sm:max-h-[90vh] sm:p-6">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <BarChart3 className="h-4 w-4 text-primary" />
            </div>
            <div>
              <DialogTitle>
                {selectedCount > 1 ? `Métricas (${selectedCount} selected)` : "Métricas"}
              </DialogTitle>
              {taskName && selectedCount === 1 && (
                <p className="text-sm text-muted-foreground mt-1 truncate max-w-md">
                  {taskName}
                </p>
              )}
              {selectedCount > 1 && (
                <p className="text-sm text-muted-foreground mt-1">
                  Showing aggregated stats for all selected torrents
                </p>
              )}
            </div>
          </div>
        </DialogHeader>
        
        <div className="space-y-4 py-2 sm:py-4 overflow-x-hidden w-full">
          {/* Date Range Picker */}
          <div className="flex items-center justify-between px-1 sm:px-0">
            <DateRangePicker
              fromDate={fromDate}
              toDate={toDate}
              onFromDateChange={setFromDate}
              onToDateChange={setToDate}
            />
          </div>

          {/* Network & Peers Section */}
          {(aggregatedTaskData || taskData) && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground">
                {selectedCount > 1 ? `Rede e Pares (${selectedCount} torrents)` : "Rede e Pares"}
              </h3>
              
              {/* Barra de Progresso de Seeding - show aggregated or single data */}
              <TorrentContributionWidget taskData={aggregatedTaskData || taskData!} />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                {(() => {
                  // Use aggregated data if multiple torrents selected, otherwise use single task data
                  const displayData = aggregatedTaskData || taskData;
                  if (!displayData) return null;
                  
                  return (
                    <>
                      {/* Card Download e Upload */}
                      <div className="col-span-2 p-3 container-content-background/50 rounded-xl border">
                        <div className="flex gap-4 items-stretch">
                          <MetricSection
                            title="Download"
                            icon={ArrowDown}
                            iconColor="text-blue-500"
                            items={[
                              { icon: Gauge, label: "Velocidade", value: `${formatBytes(displayData.network.download.speed)}/s` },
                              { icon: Database, label: "Total", value: formatBytes(displayData.network.download.amount) },
                            ]}
                          />
                          <div className="w-px bg-border self-stretch mx-2" />
                          <MetricSection
                            title="Upload"
                            icon={ArrowUp}
                            iconColor="text-green-500"
                            items={[
                              { icon: Gauge, label: "Velocidade", value: `${formatBytes(displayData.network.upload.speed)}/s` },
                              { icon: Database, label: "Total", value: formatBytes(displayData.network.upload.amount) },
                            ]}
                          />
                        </div>
                      </div>

                      {/* Card Conectados e Swarm */}
                      <div className="col-span-2 p-3 container-content-background/50 rounded-xl border">
                        <div className="flex gap-4 items-stretch">
                          <MetricSection
                            title="Conectados"
                            icon={Users}
                            items={[
                              { icon: UserPlus, label: "Seeders", value: displayData.pairs.seeders, iconClassName: "text-green-600" },
                              { icon: UserMinus, label: "Leechers", value: displayData.pairs.leechers, iconClassName: "text-orange-600" },
                            ]}
                          />
                          <div className="w-px bg-border self-stretch mx-2" />
                          <MetricSection
                            title="Swarm"
                            icon={Globe}
                            items={[
                              { icon: Users2, label: "Swarm Seeders", value: displayData.pairs.swarm_seeders, iconClassName: "text-green-600" },
                              { icon: Users2, label: "Swarm Leechers", value: displayData.pairs.swarm_leechers, iconClassName: "text-orange-600" },
                            ]}
                          />
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          )}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Carregando métricas...</span>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <p className="text-sm text-destructive">{error}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  Verifique se o agente está ativo e possui dados de estatísticas
                </p>
              </div>
            </div>
          ) : chartData.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Nenhum dado disponível</p>
                <p className="text-xs text-muted-foreground mt-2">
                  Não há métricas disponíveis para o período selecionado
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4 w-full overflow-x-hidden">
              {(() => {
                const timeRange = formatTimeRange(fromDate, toDate);
                const timeSuffix = timeRange ? ` (${timeRange})` : "";
                
                return (
                  <>
                    <SpeedChart
                      title={`Velocidades de Download e Upload${timeSuffix}`}
                      icon={Activity}
                      config={speedChartConfig}
                      data={chartData}
                      yAxisFormatter={(value) => {
                        const mbPerSecond = value / (1024 * 1024);
                        return `${mbPerSecond.toFixed(1)}`;
                      }}
                      yAxisLabel="MB/s"
                      lines={[
                        {
                          dataKey: "download",
                          tooltipFormatter: (value) => [formatBytesPerSecond(value), "Download"],
                        },
                        {
                          dataKey: "upload",
                          tooltipFormatter: (value) => [formatBytesPerSecond(value), "Upload"],
                        },
                      ]}
                    />

                    <SpeedChart
                      title={`Seeders e Leechers${timeSuffix}`}
                      icon={Network}
                      config={peersChartConfig}
                      data={chartData}
                      lines={[
                        {
                          dataKey: "seeders",
                          tooltipFormatter: (value) => [`${value} peer${Number(value) !== 1 ? 's' : ''}`, "Seeders"],
                        },
                        {
                          dataKey: "leechers",
                          tooltipFormatter: (value) => [`${value} peer${Number(value) !== 1 ? 's' : ''}`, "Leechers"],
                        },
                      ]}
                    />

                    <SpeedChart
                      title={`Ratio Médio${timeSuffix}`}
                      icon={TrendingUp}
                      config={ratioChartConfig}
                      data={chartData}
                      yAxisFormatter={(value) => value.toFixed(2)}
                      lines={[
                        {
                          dataKey: "avgRatio",
                          tooltipFormatter: (value) => [`${Number(value).toFixed(2)}`, "Ratio Médio"],
                        },
                      ]}
                    />

                    <SpeedChart
                      title={`Total Acumulado de Bytes${timeSuffix}`}
                      icon={HardDrive}
                      config={totalBytesChartConfig}
                      data={chartData}
                      yAxisFormatter={(value) => formatBytes(value)}
                      lines={[
                        {
                          dataKey: "totalDownloadBytes",
                          tooltipFormatter: (value) => [formatBytes(value), "Total Download"],
                        },
                        {
                          dataKey: "totalUploadBytes",
                          tooltipFormatter: (value) => [formatBytes(value), "Total Upload"],
                        },
                      ]}
                    />
                  </>
                );
              })()}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

