import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BarChart3, Loader2, ArrowDown, ArrowUp, Gauge, Database, Globe, Users, UserPlus, UserMinus, Activity, Network, TrendingUp, HardDrive, Users2 } from "lucide-react";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid } from "recharts";
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


export function TorrentMetricsModal({
  isOpen,
  onClose,
  taskId,
  agentId
}: TorrentMetricsModalProps) {
  const [chartData, setChartData] = useState<SpeedPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [taskHash, setTaskHash] = useState<string>(taskId);
  const [taskData, setTaskData] = useState<Task | null>(null);
  const fetchingRef = useRef(false);
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
      fetchingRef.current = false;
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
  }, [isOpen, agentId, taskId]);

  // Fetch metrics data
  useEffect(() => {
    if (!isOpen || !agentId || !taskHash || !fromDate || !toDate) return;
    
    // Create a unique key for this fetch (include date range)
    const fetchKey = `${agentId}-${taskHash}-${fromDate.toISOString()}-${toDate.toISOString()}`;
    
    // Skip if already fetched this exact combination
    if (fetchingRef.current || metricsFetchedRef.current === fetchKey) {
      return;
    }

    const fetchMetrics = async () => {
      fetchingRef.current = true;
      metricsFetchedRef.current = fetchKey;
      setLoading(true);
      setError(null);

      try {
        const response = await statisticsService.getWindowedByTask({
          agentId,
          taskHash,
          from: fromDate.toISOString(),
          to: toDate.toISOString(),
          step: "1m",
        });

        // Verify we're still supposed to be fetching this
        const currentFetchKey = `${agentId}-${taskHash}-${fromDate.toISOString()}-${toDate.toISOString()}`;
        if (metricsFetchedRef.current !== currentFetchKey) {
          // Another fetch started, ignore this one
          fetchingRef.current = false;
          setLoading(false);
          return;
        }

        if (response.error) {
          setError(response.error);
          fetchingRef.current = false;
          metricsFetchedRef.current = "";
          setLoading(false);
          return;
        }

        if (!response.data?.windows) {
          setError("No data available");
          fetchingRef.current = false;
          metricsFetchedRef.current = "";
          setLoading(false);
          return;
        }

        // Structure: windows is an object where keys are timestamps
        // Each timestamp contains an object where keys are task hashes
        // { "2025-11-01T15:05:00Z": { "taskHash": { ...data... } } }
        const windowsData = response.data.windows;
        
        if (typeof windowsData !== 'object' || windowsData === null || Array.isArray(windowsData)) {
          setError("Invalid data format");
          fetchingRef.current = false;
          metricsFetchedRef.current = "";
          setLoading(false);
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

        // Generate complete interval: every 1 minute from 'fromDate' to 'toDate'
        const transformed: SpeedPoint[] = [];
        const stepMinutes = 1;
        const stepMs = stepMinutes * 60 * 1000;
        
        // Round 'fromDate' to the nearest 1-minute interval (downward)
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

          // Format time for display
          const timeStr = current.toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
          });

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

        if (transformed.length === 0) {
          setError("No data available for this task");
        } else {
          setChartData(transformed);
        }
      } catch (err) {
        console.error("Failed to fetch metrics:", err);
        setError(err instanceof Error ? err.message : "Failed to fetch metrics");
        metricsFetchedRef.current = "";
      } finally {
        fetchingRef.current = false;
        setLoading(false);
      }
    };

    fetchMetrics();

    // Cleanup: reset fetching flag when modal closes or dependencies change
    return () => {
      if (!isOpen) {
        fetchingRef.current = false;
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
            <DialogTitle>Métricas</DialogTitle>
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
          {taskData && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground">Rede e Pares</h3>
              
              {/* Barra de Progresso de Seeding */}
              <TorrentContributionWidget taskData={taskData} />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                {/* Card Download e Upload */}
                <div className="col-span-2 p-3 container-content-background/50 rounded-lg border">
                  <div className="flex gap-4 items-stretch">
                    {/* Seção Download */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-3">
                        <ArrowDown className="h-4 w-4 text-blue-500" />
                        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Download</h4>
                      </div>
                      <TooltipProvider>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Gauge className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <span>Velocidade</span>
                              </TooltipContent>
                            </Tooltip>
                            <span className="text-sm text-muted-foreground">{formatBytes(taskData.network.download.speed)}/s</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Database className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <span>Total</span>
                              </TooltipContent>
                            </Tooltip>
                            <span className="text-sm text-muted-foreground">{formatBytes(taskData.network.download.amount)}</span>
                          </div>
                        </div>
                      </TooltipProvider>
                    </div>

                    {/* Divisória Vertical */}
                    <div className="w-px bg-border self-stretch mx-2" />

                    {/* Seção Upload */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-3">
                        <ArrowUp className="h-4 w-4 text-green-500" />
                        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Upload</h4>
                      </div>
                      <TooltipProvider>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Gauge className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <span>Velocidade</span>
                              </TooltipContent>
                            </Tooltip>
                            <span className="text-sm text-muted-foreground">{formatBytes(taskData.network.upload.speed)}/s</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Database className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <span>Total</span>
                              </TooltipContent>
                            </Tooltip>
                            <span className="text-sm text-muted-foreground">{formatBytes(taskData.network.upload.amount)}</span>
                          </div>
                        </div>
                      </TooltipProvider>
                    </div>
                  </div>
                </div>

                {/* Card Conectados e Swarm */}
                <div className="col-span-2 p-3 container-content-background/50 rounded-lg border">
                  <div className="flex gap-4 items-stretch">
                    {/* Seção Conectados */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-3">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Conectados</h4>
                      </div>
                      <TooltipProvider>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <UserPlus className="h-3.5 w-3.5 text-green-600 cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <span>Seeders</span>
                              </TooltipContent>
                            </Tooltip>
                            <span className="text-sm text-muted-foreground">{taskData.pairs.seeders}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <UserMinus className="h-3.5 w-3.5 text-orange-600 cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <span>Leechers</span>
                              </TooltipContent>
                            </Tooltip>
                            <span className="text-sm text-muted-foreground">{taskData.pairs.leechers}</span>
                          </div>
                        </div>
                      </TooltipProvider>
                    </div>

                    {/* Divisória Vertical */}
                    <div className="w-px bg-border self-stretch mx-2" />

                    {/* Seção Swarm */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-3">
                        <Globe className="h-4 w-4 text-muted-foreground" />
                        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Swarm</h4>
                      </div>
                      <TooltipProvider>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Users2 className="h-3.5 w-3.5 text-green-600 cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <span>Swarm Seeders</span>
                              </TooltipContent>
                            </Tooltip>
                            <span className="text-sm text-muted-foreground">{taskData.pairs.swarm_seeders}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Users2 className="h-3.5 w-3.5 text-orange-600 cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <span>Swarm Leechers</span>
                              </TooltipContent>
                            </Tooltip>
                            <span className="text-sm text-muted-foreground">{taskData.pairs.swarm_leechers}</span>
                          </div>
                        </div>
                      </TooltipProvider>
                    </div>
                  </div>
                </div>
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
              <div className="rounded-lg border p-2 sm:p-4 overflow-x-hidden">
                <div className="flex items-center gap-2 mb-4">
                  <Activity className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold">Velocidades de Download e Upload</h3>
                </div>
                <ChartContainer config={speedChartConfig} className="h-[250px] sm:h-[400px] w-full min-w-0">
                  <AreaChart 
                    data={chartData} 
                    width={undefined} 
                    height={undefined}
                    margin={{ left: 0, right: 0, top: 5, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="time" 
                      tick={{ fontSize: 10 }}
                      tickLine={{ stroke: 'hsl(var(--muted-foreground))' }}
                      className="text-xs"
                    />
                    <YAxis 
                      tick={{ fontSize: 10 }}
                      tickLine={{ stroke: 'hsl(var(--muted-foreground))' }}
                      tickFormatter={(value) => formatBytes(value)}
                      className="text-xs"
                      width={60}
                    />
                    <ChartTooltip 
                      content={
                        <ChartTooltipContent 
                          formatter={(value, name) => [
                            formatBytesPerSecond(value as number),
                            name === "download" ? "Download" : "Upload"
                          ]}
                        />
                      } 
                    />
                    <Area 
                      type="monotone" 
                      dataKey="download" 
                      stroke="var(--color-download)" 
                      fill="var(--color-download)"
                      fillOpacity={0.2}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="upload" 
                      stroke="var(--color-upload)" 
                      fill="var(--color-upload)"
                      fillOpacity={0.2}
                    />
                  </AreaChart>
                </ChartContainer>
              </div>

              <div className="rounded-lg border p-2 sm:p-4 overflow-x-hidden">
                <div className="flex items-center gap-2 mb-4">
                  <Network className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold">Seeders e Leechers</h3>
                </div>
                <ChartContainer config={peersChartConfig} className="h-[250px] sm:h-[400px] w-full min-w-0">
                  <AreaChart 
                    data={chartData} 
                    width={undefined} 
                    height={undefined}
                    margin={{ left: 0, right: 0, top: 5, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="time" 
                      tick={{ fontSize: 10 }}
                      tickLine={{ stroke: 'hsl(var(--muted-foreground))' }}
                      className="text-xs"
                    />
                    <YAxis 
                      tick={{ fontSize: 10 }}
                      tickLine={{ stroke: 'hsl(var(--muted-foreground))' }}
                      className="text-xs"
                      width={60}
                    />
                    <ChartTooltip 
                      content={
                        <ChartTooltipContent 
                          formatter={(value, name) => [
                            `${value} peer${Number(value) !== 1 ? 's' : ''}`,
                            name === "seeders" ? "Seeders" : "Leechers"
                          ]}
                        />
                      } 
                    />
                    <Area 
                      type="monotone" 
                      dataKey="seeders" 
                      stroke="var(--color-seeders)" 
                      fill="var(--color-seeders)"
                      fillOpacity={0.2}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="leechers" 
                      stroke="var(--color-leechers)" 
                      fill="var(--color-leechers)"
                      fillOpacity={0.2}
                    />
                  </AreaChart>
                </ChartContainer>
              </div>

              <div className="rounded-lg border p-2 sm:p-4 overflow-x-hidden">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold">Ratio Médio</h3>
                </div>
                <ChartContainer config={ratioChartConfig} className="h-[250px] sm:h-[400px] w-full min-w-0">
                  <AreaChart 
                    data={chartData} 
                    width={undefined} 
                    height={undefined}
                    margin={{ left: 0, right: 0, top: 5, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="time" 
                      tick={{ fontSize: 10 }}
                      tickLine={{ stroke: 'hsl(var(--muted-foreground))' }}
                      className="text-xs"
                    />
                    <YAxis 
                      tick={{ fontSize: 10 }}
                      tickLine={{ stroke: 'hsl(var(--muted-foreground))' }}
                      className="text-xs"
                      width={60}
                      tickFormatter={(value) => value.toFixed(2)}
                    />
                    <ChartTooltip 
                      content={
                        <ChartTooltipContent 
                          formatter={(value) => [
                            `${Number(value).toFixed(2)}`,
                            "Ratio Médio"
                          ]}
                        />
                      } 
                    />
                    <Area 
                      type="monotone" 
                      dataKey="avgRatio" 
                      stroke="var(--color-avgRatio)" 
                      fill="var(--color-avgRatio)"
                      fillOpacity={0.2}
                    />
                  </AreaChart>
                </ChartContainer>
              </div>

              <div className="rounded-lg border p-2 sm:p-4 overflow-x-hidden">
                <div className="flex items-center gap-2 mb-4">
                  <HardDrive className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold">Total Acumulado de Bytes</h3>
                </div>
                <ChartContainer config={totalBytesChartConfig} className="h-[250px] sm:h-[400px] w-full min-w-0">
                  <AreaChart 
                    data={chartData} 
                    width={undefined} 
                    height={undefined}
                    margin={{ left: 0, right: 0, top: 5, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="time" 
                      tick={{ fontSize: 10 }}
                      tickLine={{ stroke: 'hsl(var(--muted-foreground))' }}
                      className="text-xs"
                    />
                    <YAxis 
                      tick={{ fontSize: 10 }}
                      tickLine={{ stroke: 'hsl(var(--muted-foreground))' }}
                      tickFormatter={(value) => formatBytes(value)}
                      className="text-xs"
                      width={60}
                    />
                    <ChartTooltip 
                      content={
                        <ChartTooltipContent 
                          formatter={(value, name) => [
                            formatBytes(value as number),
                            name === "totalDownloadBytes" ? "Total Download" : "Total Upload"
                          ]}
                        />
                      } 
                    />
                    <Area 
                      type="monotone" 
                      dataKey="totalDownloadBytes" 
                      stroke="var(--color-totalDownloadBytes)" 
                      fill="var(--color-totalDownloadBytes)"
                      fillOpacity={0.2}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="totalUploadBytes" 
                      stroke="var(--color-totalUploadBytes)" 
                      fill="var(--color-totalUploadBytes)"
                      fillOpacity={0.2}
                    />
                  </AreaChart>
                </ChartContainer>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

