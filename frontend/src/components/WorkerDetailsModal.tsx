import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CustomScrollArea } from "@/components/ui/custom-scroll-area";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatBytes } from "../utils/bytes";
import {
  Server,
  Trash2,
  Loader2,
  HardDrive,
  Wifi,
  Activity,
  AlertTriangle,
  Edit,
  ExternalLink
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useCallback, useEffect, useState } from "react";
import type { Worker, Version, TaskStats } from "../types/worker";
import { WorkerIcon } from "./ui/WorkerIcon";
import { QBittorrentIcon } from "./ui/QBittorrentIcon";
import { workerService } from "../services/workers";
import { WorkerLimits } from "./WorkerLimits";
import { BandwidthSchedules } from "./BandwidthSchedules";
import { WorkerErrorDisplay } from "./WorkerErrorDisplay";
import { WorkerLogsTab } from "./WorkerLogsTab";

interface WorkerDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  workerId?: string | null;
  worker?: Worker | null;
  onEdit: (worker: Worker) => void;
  onDelete: (worker: Worker) => void;
}

export function WorkerDetailsModal({
  isOpen,
  onClose,
  workerId,
  worker: initialWorker,
  onEdit,
  onDelete
}: WorkerDetailsModalProps) {
  const { t } = useTranslation();

  // Internal state management
  const [worker, setWorker] = useState<Worker | null>(initialWorker || null);
  const [loading, setLoading] = useState(false);
  const [workerVersions, setWorkerVersions] = useState<Record<string, Version>>({});
  const [workerTaskStats, setWorkerTaskStats] = useState<Record<string, TaskStats>>({});

  // Load worker details
  const loadWorkerDetails = useCallback(async (id: string, workerToPreserve?: Worker | null) => {
    try {
      setLoading(true);
      const response = await workerService.getWorker(id);

      if (response.error) {
        console.error('Failed to load worker:', response.error);

        // Extract error message from errorDetails if available, otherwise use error string
        const errorMessage = response.errorDetails?.error || response.error || 'An unexpected error occurred';

        // If we have a worker to preserve (e.g., when initialWorker was provided), 
        // update only the status and error message while keeping all other data
        if (workerToPreserve && workerToPreserve.uuid === id) {
          setWorker({
            ...workerToPreserve,
            status: 'ERRORED' as const,
            error: errorMessage,
            instance: workerToPreserve.instance || {
              application: {
                version: '',
                api_version: ''
              },
              server: {
                free_space_on_disk: 0
              },
              transfer: {
                all_time_downloaded: 0,
                all_time_uploaded: 0,
                global_ratio: 0,
                last_external_address_v4: '',
                last_external_address_v6: ''
              }
            }
          });
        } else {
          // Fallback: try to preserve current worker from state
          setWorker(prevWorker => {
            if (prevWorker && prevWorker.uuid === id) {
              return {
                ...prevWorker,
                status: 'ERRORED' as const,
                error: errorMessage,
                instance: prevWorker.instance || {
                  application: {
                    version: '',
                    api_version: ''
                  },
                  server: {
                    free_space_on_disk: 0
                  },
                  transfer: {
                    all_time_downloaded: 0,
                    all_time_uploaded: 0,
                    global_ratio: 0,
                    last_external_address_v4: '',
                    last_external_address_v6: ''
                  }
                }
              };
            }
            // Create a minimal worker record with error status if nothing to preserve
            return {
              uuid: id,
              name: '',
              address: '',
              status: 'ERRORED' as const,
              error: errorMessage,
              instance: {
                application: {
                  version: '',
                  api_version: ''
                },
                server: {
                  free_space_on_disk: 0
                },
                transfer: {
                  all_time_downloaded: 0,
                  all_time_uploaded: 0,
                  global_ratio: 0,
                  last_external_address_v4: '',
                  last_external_address_v6: ''
                }
              }
            };
          });
        }
      } else if (response.data) {
        setWorker(response.data);
      }
    } catch (err) {
      console.error('Failed to load worker:', err);
      if (!workerToPreserve) {
        setWorker(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Load worker version
  const loadWorkerVersion = useCallback(async (id: string) => {
    try {
      const response = await workerService.getWorkerVersion(id);

      if (response.error) {
        console.warn(`Failed to load version for worker ${id}:`, response.error);
      } else if (response.data) {
        setWorkerVersions(prev => ({ ...prev, [id]: response.data! }));
      }
    } catch (err) {
      console.warn(`Failed to load version for worker ${id}:`, err);
    }
  }, []);

  // Load data when modal opens and workerId or initial worker snapshot changes
  useEffect(() => {
    if (isOpen) {
      // If initial worker is provided, use it immediately and refresh in background
      if (initialWorker) {
        setWorker(initialWorker);
        const id = initialWorker.uuid;
        loadWorkerVersion(id);
        // Refresh worker details in background to get latest status
        // Pass the initial worker to preserve its data if there's an error
        if (id) {
          loadWorkerDetails(id, initialWorker);
        }
      } else if (workerId) {
        // Fallback to loading by ID if no initial worker provided
        loadWorkerDetails(workerId);
        loadWorkerVersion(workerId);
      }
    }
  }, [isOpen, workerId, initialWorker, loadWorkerDetails, loadWorkerVersion]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setWorker(null);
      setWorkerVersions({});
      setWorkerTaskStats({});
    }
  }, [isOpen]);



  if (!isOpen) return null;

  let dialogTitleText = t('workers.workerDetails');
  if (worker?.name) {
    dialogTitleText = `${t('workers.workerDetails')} - ${worker.name}`;
  } else if (!worker && loading) {
    dialogTitleText = t('workers.loadingWorkerDetails');
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-2xl h-[90vh] max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {dialogTitleText}
            {/* Background live-status refresh indicator - data below is already
                visible from the DB, this just signals a recheck is in flight */}
            {worker && loading && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="detalhes" className="w-full flex-1 flex flex-col min-h-0 overflow-hidden">
          <TabsList className="grid w-full grid-cols-4 shrink-0">
            <TabsTrigger value="detalhes">{t('workers.details')}</TabsTrigger>
            <TabsTrigger value="logs" disabled={worker?.status === 'ERRORED' || worker?.status === 'INITIALIZING'}>{t('workers.logs.title', 'Logs')}</TabsTrigger>
            <TabsTrigger value="limites" disabled={worker?.status === 'ERRORED' || worker?.status === 'INITIALIZING'}>{t('workers.limits.title')}</TabsTrigger>
            <TabsTrigger value="schedules" disabled={worker?.status === 'ERRORED' || worker?.status === 'INITIALIZING'}>{t('workers.schedules.title')}</TabsTrigger>
          </TabsList>

          <CustomScrollArea className="w-full flex-1 min-h-0" variant="thin" mobileFallback>
            <TabsContent value="detalhes" className="mt-4">
              <div className="w-full">
                {!worker ? (
                  loading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                      <span className="ml-2 text-muted-foreground">{t('workers.loadingWorkerDetails')}</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12">
                      <Server className="h-12 w-12 text-muted-foreground mb-4" />
                      <h3 className="text-lg font-semibold mb-2">{t('workers.workerNotFound')}</h3>
                      <p className="text-muted-foreground text-center">
                        {t('workers.workerNotFoundDescription')}
                      </p>
                    </div>
                  )
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center p-3 container-content-background/50 rounded-lg">
                      {/* Worker icon and content */}
                      <div className="flex items-center gap-3 flex-1 p-4">
                        <WorkerIcon
                          iconName={worker?.icon}
                          color={worker?.color}
                          size="lg"
                          className="w-14 h-14 rounded-lg"
                        />

                        {/* Content */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            {worker?.status === 'ACTIVE' && (
                              <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] ml-0.5"></div>
                            )}
                            {worker?.status === 'ERRORED' && (
                              <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)] ml-0.5"></div>
                            )}
                            {worker?.status === 'INITIALIZING' && (
                              <div className="w-2 h-2 rounded-full bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.6)] ml-0.5 animate-pulse"></div>
                            )}
                            <h3 className="font-semibold text-base">{worker?.name}</h3>
                            {worker?.status === 'ERRORED' && (
                              <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />
                            )}
                            {worker?.status === 'INITIALIZING' && (
                              <Loader2 className="h-4 w-4 text-yellow-500 flex-shrink-0 animate-spin" />
                            )}

                          </div>
                          <p className="text-xs text-muted-foreground">{worker?.address}</p>
                        </div>

                        {/* Edit Button */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onEdit(worker!)}
                          title={t('workers.editWorker', 'Edit worker')}
                          className="flex-shrink-0"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>

                        {/* Delete Button */}
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => onDelete(worker!)}
                          title={t('workers.deleteWorker', 'Delete worker')}
                          className="flex-shrink-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {(worker?.status === 'ERRORED' || worker?.status === 'INITIALIZING') && (
                      <WorkerErrorDisplay worker={worker} />
                    )}

                    {(() => {
                      const currentVersion = worker ? workerVersions[worker.uuid] : null;
                      if (!worker || !currentVersion) return null;
                      return (
                        <div className="space-y-3">
                          <h4 className="font-semibold text-sm">{t('workers.workerInformation', 'Worker connection information')}</h4>
                          <div className="space-y-2 p-3 container-content-background/50 rounded-lg">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                              <QBittorrentIcon className="h-3 w-3" size="sm" />
                              <span>{t('workers.qbittorrent', 'qBittorrent')}</span>
                            </div>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between items-center">
                                <span className="text-muted-foreground">{t('workers.version')}:</span>
                                <span className="font-mono">{currentVersion.version}</span>
                              </div>
                              {currentVersion.qbittorrent_url && (
                                <div className="flex justify-between items-center mt-2 pt-2 border-t border-border/50">
                                  <span className="text-muted-foreground">{t('workers.qbittorrentUrl', 'qBittorrent URL')}:</span>
                                  <span className="font-mono text-xs break-all text-right ml-4">
                                    {currentVersion.qbittorrent_url.startsWith('http') ? (
                                      <a href={currentVersion.qbittorrent_url} target="_blank" rel="noreferrer" className="text-primary hover:underline flex items-center justify-end gap-1">
                                        {currentVersion.qbittorrent_url}
                                        <ExternalLink className="h-3 w-3" />
                                      </a>
                                    ) : (
                                      currentVersion.qbittorrent_url
                                    )}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {worker?.status === 'ERRORED' && (
                      <div className="space-y-3">
                        <h4 className="font-semibold text-sm">{t('workers.instanceInformation')}</h4>
                        <div className="p-3 container-content-background/50 rounded-lg text-sm text-muted-foreground text-center">
                          {t('workers.instanceInfoUnavailable', 'Instance information unavailable - worker connection failed')}
                        </div>
                      </div>
                    )}

                    {worker?.instance && worker?.status !== 'ERRORED' && worker?.status !== 'INITIALIZING' && (
                      <div className="space-y-3">
                        <h4 className="font-semibold text-sm">{t('workers.instanceInformation')}</h4>

                        <div className="grid gap-3 grid-cols-2">
                          <div className="flex p-3 container-content-background/50 rounded-lg">
                            <div className="flex-1 space-y-1">
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Activity className="h-3 w-3" />
                                <span>{t('workers.application')}</span>
                              </div>
                              <div className="text-sm font-medium">
                                {t('workers.version')}: {worker?.instance?.application?.version}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {t('workers.api')}: {worker?.instance?.application?.api_version}
                              </div>
                            </div>
                            <div className="flex items-center justify-center ml-3">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="cursor-help">
                                      <QBittorrentIcon
                                        size="sm"
                                        className="w-5 h-5 text-muted-foreground/60"
                                      />
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>{t('workers.qbittorrent', 'qBittorrent')}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                          </div>
                        </div>

                        {/* Storage Section - Full Width */}
                        <div className="space-y-1 p-3 container-content-background/50 rounded-lg">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <HardDrive className="h-3 w-3" />
                            <span>{t('workers.storage')}</span>
                          </div>
                          <div className="space-y-2 text-sm">
                            {worker && workerTaskStats[worker.uuid] ? (
                              <>
                                <div className="flex justify-between">
                                  <div className="flex flex-col">
                                    <span className="text-muted-foreground">{t('workers.usedSpace')}:</span>
                                    <span className="font-medium">{formatBytes(workerTaskStats[worker.uuid].total_disk_size)}</span>
                                  </div>
                                  <div className="flex flex-col items-end">
                                    <span className="text-muted-foreground">{t('workers.freeSpace')}:</span>
                                    <span className="font-medium">{worker?.instance?.server?.free_space_on_disk && formatBytes(worker.instance.server.free_space_on_disk)}</span>
                                  </div>
                                </div>
                                {(() => {
                                  const freeSpace = worker?.instance?.server?.free_space_on_disk || 0;
                                  const usedSpace = workerTaskStats[worker.uuid].total_disk_size;
                                  const totalSpace = freeSpace + usedSpace;
                                  const usedPercentage = totalSpace > 0 ? (usedSpace / totalSpace) * 100 : 0;

                                  return (
                                    <div className="space-y-1">
                                      <div className="w-full bg-muted rounded-full h-2">
                                        <div
                                          className="bg-primary h-2 rounded-full transition-all duration-300"
                                          style={{ width: `${usedPercentage}%` }}
                                        />
                                      </div>
                                      <div className="text-xs text-muted-foreground text-center">
                                        {usedPercentage.toFixed(1)}% {t('workers.used')}
                                      </div>
                                    </div>
                                  );
                                })()}
                              </>
                            ) : (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">{t('workers.freeSpace')}:</span>
                                <span className="font-medium">{worker?.instance?.server?.free_space_on_disk && formatBytes(worker.instance.server.free_space_on_disk)}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="grid gap-3 grid-cols-2">
                          {/* Transfer Data Card */}
                          <div className="space-y-2 p-3 container-content-background/50 rounded-lg">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                              <Activity className="h-3 w-3" />
                              <span>{t('workers.transferData', 'Transfer Data')}</span>
                            </div>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">{t('workers.downloaded')}:</span>
                                <span className="font-medium">{worker?.instance?.transfer?.all_time_downloaded && formatBytes(worker.instance.transfer.all_time_downloaded)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">{t('workers.uploaded')}:</span>
                                <span className="font-medium">{worker?.instance?.transfer?.all_time_uploaded && formatBytes(worker.instance.transfer.all_time_uploaded)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">{t('workers.globalRatio')}:</span>
                                <span className="font-medium">{worker?.instance?.transfer?.global_ratio?.toFixed(2)}</span>
                              </div>
                            </div>
                          </div>

                          {/* Network Information Card */}
                          <div className="space-y-2 p-3 container-content-background/50 rounded-lg">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                              <Wifi className="h-3 w-3" />
                              <span>{t('workers.networkInfo', 'Network Info')}</span>
                            </div>
                            <div className="space-y-2 text-sm">
                              {worker?.instance?.transfer?.last_external_address_v4 && (
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">{t('workers.ipv4', 'IPv4')}:</span>
                                  <span className="font-mono text-xs">{worker.instance.transfer.last_external_address_v4}</span>
                                </div>
                              )}
                              {worker?.instance?.transfer?.last_external_address_v6 && (
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">{t('workers.ipv6', 'IPv6')}:</span>
                                  <span className="font-mono text-xs">{worker.instance.transfer.last_external_address_v6}</span>
                                </div>
                              )}
                              {!worker?.instance?.transfer?.last_external_address_v4 && !worker?.instance?.transfer?.last_external_address_v6 && (
                                <div className="text-xs text-muted-foreground text-center py-2">
                                  {t('workers.noNetworkInfo', 'No network information available')}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="logs" className="mt-4 flex-1 h-[calc(100vh-270px)]">
              {worker && <WorkerLogsTab workerId={worker.uuid} />}
            </TabsContent>

            <TabsContent value="limites" className="mt-4">
              {worker && <WorkerLimits workerId={worker.uuid} disableScroll />}
            </TabsContent>

            <TabsContent value="schedules" className="mt-4">
              {worker && <BandwidthSchedules workerId={worker.uuid} />}
            </TabsContent>
          </CustomScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
