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
  BarChart3,
  Lock,
  Edit,
  ExternalLink
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useCallback, useEffect, useState } from "react";
import type { Agent, Version, TaskStats } from "../types/agent";
import { AgentIcon } from "./ui/AgentIcon";
import { QBittorrentIcon } from "./ui/QBittorrentIcon";
import { agentService } from "../services/agents";
import { versionService } from "../services/version";
import { useSetup } from "../contexts/SetupContextBase";
import { AgentLimits } from "./AgentLimits";
import { AgentErrorDisplay } from "./AgentErrorDisplay";
import { AgentLogsTab } from "./AgentLogsTab";

interface AgentDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentId?: string | null;
  agent?: Agent | null;
  onEdit: (agent: Agent) => void;
  onDelete: (agent: Agent) => void;
}

export function AgentDetailsModal({
  isOpen,
  onClose,
  agentId,
  agent: initialAgent,
  onEdit,
  onDelete
}: AgentDetailsModalProps) {
  const { t } = useTranslation();

  // Internal state management
  const [agent, setAgent] = useState<Agent | null>(initialAgent || null);
  const [loading, setLoading] = useState(false);
  const [agentVersions, setAgentVersions] = useState<Record<string, Version>>({});
  const [agentTaskStats, setAgentTaskStats] = useState<Record<string, TaskStats>>({});
  const [systemVersion, setSystemVersion] = useState<Version | null>(null);
  const { statisticsEnabled } = useSetup();

  // Load agent details
  const loadAgentDetails = useCallback(async (id: string, agentToPreserve?: Agent | null) => {
    try {
      setLoading(true);
      const response = await agentService.getAgent(id);

      if (response.error) {
        console.error('Failed to load agent:', response.error);

        // Extract error message from errorDetails if available, otherwise use error string
        const errorMessage = response.errorDetails?.error || response.error || 'An unexpected error occurred';

        // If we have an agent to preserve (e.g., when initialAgent was provided), 
        // update only the status and error message while keeping all other data
        if (agentToPreserve && agentToPreserve.uuid === id) {
          setAgent({
            ...agentToPreserve,
            status: 'ERRORED' as const,
            error: errorMessage,
            instance: agentToPreserve.instance || {
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
          // Fallback: try to preserve current agent from state
          setAgent(prevAgent => {
            if (prevAgent && prevAgent.uuid === id) {
              return {
                ...prevAgent,
                status: 'ERRORED' as const,
                error: errorMessage,
                instance: prevAgent.instance || {
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
            // Create a minimal Agent object with error status if no agent to preserve
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
        setAgent(response.data);
      }
    } catch (err) {
      console.error('Failed to load agent:', err);
      if (!agentToPreserve) {
        setAgent(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Load agent version
  const loadAgentVersion = useCallback(async (id: string) => {
    try {
      const response = await agentService.getAgentVersion(id);

      if (response.error) {
        console.warn(`Failed to load version for agent ${id}:`, response.error);
      } else if (response.data) {
        setAgentVersions(prev => ({ ...prev, [id]: response.data! }));
      }
    } catch (err) {
      console.warn(`Failed to load version for agent ${id}:`, err);
    }
  }, []);

  // Load backend system version
  const loadSystemVersion = useCallback(async () => {
    try {
      const response = await versionService.getVersion();
      if (response.error) {
        console.warn("Failed to load system version:", response.error);
      } else if (response.data) {
        setSystemVersion(response.data);
      }
    } catch (err) {
      console.warn("Failed to load system version:", err);
    }
  }, []);

  // Load data when modal opens and agentId or initialAgent changes
  useEffect(() => {
    if (isOpen) {
      // If initial agent is provided, use it immediately and refresh in background
      if (initialAgent) {
        setAgent(initialAgent);
        const id = initialAgent.uuid;
        loadAgentVersion(id);
        loadSystemVersion();
        // Refresh agent details in background to get latest status
        // Pass the initial agent to preserve its data if there's an error
        if (id) {
          loadAgentDetails(id, initialAgent);
        }
      } else if (agentId) {
        // Fallback to loading by ID if no initial agent provided
        loadAgentDetails(agentId);
        loadAgentVersion(agentId);
        loadSystemVersion();
      }
    }
  }, [isOpen, agentId, initialAgent, loadAgentDetails, loadAgentVersion, loadSystemVersion]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setAgent(null);
      setAgentVersions({});
      setAgentTaskStats({});
      setSystemVersion(null);
    }
  }, [isOpen]);

  const compareVersions = (a: string, b: string) => {
    const norm = (v: string) => v.replace(/^v/i, '').split('.').map(s => Number.parseInt(s, 10) || 0);
    const pa = norm(a);
    const pb = norm(b);
    const len = Math.max(pa.length, pb.length);
    for (let i = 0; i < len; i++) {
      const da = pa[i] ?? 0;
      const db = pb[i] ?? 0;
      if (da < db) return -1;
      if (da > db) return 1;
    }
    return 0;
  };


  const openAnalytics = (agentId: string) => {
    const analyticsUrl = `/agent/${agentId}`;
    window.open(analyticsUrl, '_blank', 'noopener,noreferrer');
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-2xl h-[90vh] max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>
            {loading ? t('agents.loadingAgentDetails') :
              agent ? (agent.name ? `${t('agents.agentDetails')} - ${agent.name}` : t('agents.agentDetails')) :
                t('agents.agentDetails')}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="detalhes" className="w-full flex-1 flex flex-col min-h-0 overflow-hidden">
          <TabsList className="grid w-full grid-cols-4 shrink-0">
            <TabsTrigger value="detalhes">{t('agents.details')}</TabsTrigger>
            <TabsTrigger value="logs" disabled={agent?.status === 'ERRORED' || agent?.status === 'INITIALIZING'}>{t('agents.logs.title', 'Logs')}</TabsTrigger>
            <TabsTrigger value="limites" disabled={agent?.status === 'ERRORED' || agent?.status === 'INITIALIZING'}>{t('agents.limits.title')}</TabsTrigger>
            <TabsTrigger value="schedules" disabled>{t('agents.schedules')}</TabsTrigger>
          </TabsList>

          <CustomScrollArea className="w-full flex-1 min-h-0" variant="thin" mobileFallback>
            <TabsContent value="detalhes" className="mt-4">
              <div className="w-full">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-muted-foreground">{t('agents.loadingAgentDetails')}</span>
                  </div>
                ) : !agent ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Server className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">{t('agents.agentNotFound')}</h3>
                    <p className="text-muted-foreground text-center">
                      {t('agents.agentNotFoundDescription')}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center p-3 container-content-background/50 rounded-lg">
                      {/* Agent Icon and Content */}
                      <div className="flex items-center gap-3 flex-1 p-4">
                        <AgentIcon
                          iconName={agent?.icon}
                          color={agent?.color}
                          size="lg"
                          className="w-14 h-14 rounded-lg"
                          standalone={agent?.standalone}
                        />

                        {/* Content */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            {agent?.status === 'ACTIVE' && (
                              <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] ml-0.5"></div>
                            )}
                            {agent?.status === 'ERRORED' && (
                              <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)] ml-0.5"></div>
                            )}
                            {agent?.status === 'INITIALIZING' && (
                              <div className="w-2 h-2 rounded-full bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.6)] ml-0.5 animate-pulse"></div>
                            )}
                            <h3 className="font-semibold text-base">{agent?.name}</h3>
                            {agent?.status === 'ERRORED' && (
                              <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />
                            )}
                            {agent?.status === 'INITIALIZING' && (
                              <Loader2 className="h-4 w-4 text-yellow-500 flex-shrink-0 animate-spin" />
                            )}

                          </div>
                          <p className="text-xs text-muted-foreground">{agent?.address}</p>
                          {agent && systemVersion && agentVersions[agent.uuid] && compareVersions(agentVersions[agent.uuid].version, systemVersion.version) < 0 && (
                            <div className="mt-1 flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                              <AlertTriangle className="h-4 w-4" />
                              <span>
                                {t('agents.versionMismatch', 'Agent version differs from system. Please update the agent to match system version')} {" "}
                                <span className="font-mono">{systemVersion.version}</span>.
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Lock Icon for Standalone Agents */}
                        {agent?.standalone && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex-shrink-0 cursor-help">
                                  <Lock className="h-4 w-4 text-muted-foreground" />
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{t('agents.standalone.tooltip', 'Standalone agent')}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}

                        {/* Edit Button */}
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={agent?.standalone}
                          onClick={() => !agent?.standalone && onEdit(agent)}
                          title={agent?.standalone ? t('agents.standalone.tooltip', 'Standalone agent') : t('agents.editAgent', 'Edit agent')}
                          className="flex-shrink-0"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>

                        {/* Delete Button */}
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={agent?.standalone}
                          onClick={() => !agent?.standalone && onDelete(agent)}
                          title={agent?.standalone ? t('agents.standalone.tooltip', 'Standalone agent') : t('agents.deleteAgent', 'Delete agent')}
                          className="flex-shrink-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {(agent?.status === 'ERRORED' || agent?.status === 'INITIALIZING') && (
                      <AgentErrorDisplay agent={agent} />
                    )}

                    {(() => {
                      const currentVersion = agent ? agentVersions[agent.uuid] : null;
                      if (!agent || !currentVersion) return null;
                      return (
                        <div className="space-y-3">
                          <h4 className="font-semibold text-sm">{t('agents.agentInformation', 'Agent Information')}</h4>
                          <div className="space-y-2 p-3 container-content-background/50 rounded-lg">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                              <Server className="h-3 w-3" />
                              <span>{t('agents.details', 'Details')}</span>
                            </div>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between items-center">
                                <span className="text-muted-foreground">{t('agents.version')}:</span>
                                <span className="font-mono">{currentVersion.version}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-muted-foreground">{t('agents.commit')}:</span>
                                <span className="font-mono text-xs">{currentVersion.commit}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-muted-foreground">{t('agents.date')}:</span>
                                <span className="font-mono text-xs">{currentVersion.date}</span>
                              </div>
                              {currentVersion.qbittorrent_url && (
                                <div className="flex justify-between items-center mt-2 pt-2 border-t border-border/50">
                                  <span className="text-muted-foreground">{t('agents.qbittorrentUrl', 'qBittorrent URL')}:</span>
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

                    {agent?.status === 'ERRORED' && (
                      <div className="space-y-3">
                        <h4 className="font-semibold text-sm">{t('agents.instanceInformation')}</h4>

                        <div className="grid gap-3 grid-cols-2">
                          <div className="p-3 container-content-background/50 rounded-lg">
                            <div className="space-y-2">
                              <div className="h-3 bg-muted rounded animate-pulse"></div>
                              <div className="h-4 bg-muted rounded animate-pulse w-3/4"></div>
                              <div className="h-3 bg-muted rounded animate-pulse w-1/2"></div>
                            </div>
                          </div>

                          <div className="p-3 container-content-background/50 rounded-lg">
                            <div className="space-y-2">
                              <div className="h-3 bg-muted rounded animate-pulse"></div>
                              <div className="h-4 bg-muted rounded animate-pulse w-3/4"></div>
                              <div className="h-3 bg-muted rounded animate-pulse w-1/2"></div>
                            </div>
                          </div>
                        </div>

                        <div className="p-3 container-content-background/50 rounded-lg">
                          <div className="space-y-2">
                            <div className="h-3 bg-muted rounded animate-pulse w-1/4"></div>
                            <div className="h-4 bg-muted rounded animate-pulse w-1/2"></div>
                            <div className="h-2 bg-muted rounded animate-pulse w-full"></div>
                          </div>
                        </div>

                        <div className="grid gap-3 grid-cols-2">
                          <div className="p-3 container-content-background/50 rounded-lg">
                            <div className="space-y-2">
                              <div className="h-3 bg-muted rounded animate-pulse w-1/3"></div>
                              <div className="space-y-1">
                                <div className="h-3 bg-muted rounded animate-pulse w-2/3"></div>
                                <div className="h-3 bg-muted rounded animate-pulse w-1/2"></div>
                                <div className="h-3 bg-muted rounded animate-pulse w-3/4"></div>
                              </div>
                            </div>
                          </div>

                          <div className="p-3 container-content-background/50 rounded-lg">
                            <div className="space-y-2">
                              <div className="h-3 bg-muted rounded animate-pulse w-1/3"></div>
                              <div className="space-y-1">
                                <div className="h-3 bg-muted rounded animate-pulse w-2/3"></div>
                                <div className="h-3 bg-muted rounded animate-pulse w-1/2"></div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {agent?.instance && agent?.status !== 'ERRORED' && agent?.status !== 'INITIALIZING' && (
                      <div className="space-y-3">
                        <h4 className="font-semibold text-sm">{t('agents.instanceInformation')}</h4>

                        <div className="grid gap-3 grid-cols-2">
                          <div className="flex p-3 container-content-background/50 rounded-lg">
                            <div className="flex-1 space-y-1">
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Activity className="h-3 w-3" />
                                <span>{t('agents.application')}</span>
                              </div>
                              <div className="text-sm font-medium">
                                {t('agents.version')}: {agent?.instance?.application?.version}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {t('agents.api')}: {agent?.instance?.application?.api_version}
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
                                    <p>{t('agents.qbittorrent', 'qBittorrent')}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                          </div>

                          {/* Analytics Card */}
                          <div className={`flex items-center p-3 container-content-background/50 rounded-lg border-2 border-dashed ${statisticsEnabled ? 'border-primary/20 hover:border-primary/40' : 'border-muted opacity-60'} transition-colors`}>
                            <div className="flex items-center gap-3 flex-1">
                              <div className={`w-8 h-8 rounded-lg ${statisticsEnabled ? 'bg-primary/10' : 'bg-muted'} flex items-center justify-center flex-shrink-0`}>
                                <BarChart3 className={`h-4 w-4 ${statisticsEnabled ? 'text-primary' : 'text-muted-foreground'}`} />
                              </div>

                              <div className="min-w-0 flex-1">
                                <h4 className={`text-sm font-medium ${statisticsEnabled ? 'text-primary' : 'text-muted-foreground'}`}>Analytics</h4>
                                <p className="text-xs text-muted-foreground">
                                  {statisticsEnabled ? 'View detailed metrics' : 'Statistics disabled'}
                                </p>
                              </div>

                              <Button
                                size="sm"
                                disabled={!statisticsEnabled}
                                onClick={() => agent && openAnalytics(agent.uuid)}
                                className="flex items-center gap-1 h-7 px-2"
                              >
                                <ExternalLink className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </div>

                        {/* Storage Section - Full Width */}
                        <div className="space-y-1 p-3 container-content-background/50 rounded-lg">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <HardDrive className="h-3 w-3" />
                            <span>{t('agents.storage')}</span>
                          </div>
                          <div className="space-y-2 text-sm">
                            {agent && agentTaskStats[agent.uuid] ? (
                              <>
                                <div className="flex justify-between">
                                  <div className="flex flex-col">
                                    <span className="text-muted-foreground">{t('agents.usedSpace')}:</span>
                                    <span className="font-medium">{formatBytes(agentTaskStats[agent.uuid].total_disk_size)}</span>
                                  </div>
                                  <div className="flex flex-col items-end">
                                    <span className="text-muted-foreground">{t('agents.freeSpace')}:</span>
                                    <span className="font-medium">{agent?.instance?.server?.free_space_on_disk && formatBytes(agent.instance.server.free_space_on_disk)}</span>
                                  </div>
                                </div>
                                {(() => {
                                  const freeSpace = agent?.instance?.server?.free_space_on_disk || 0;
                                  const usedSpace = agentTaskStats[agent.uuid].total_disk_size;
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
                                        {usedPercentage.toFixed(1)}% {t('agents.used')}
                                      </div>
                                    </div>
                                  );
                                })()}
                              </>
                            ) : (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">{t('agents.freeSpace')}:</span>
                                <span className="font-medium">{agent?.instance?.server?.free_space_on_disk && formatBytes(agent.instance.server.free_space_on_disk)}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="grid gap-3 grid-cols-2">
                          {/* Transfer Data Card */}
                          <div className="space-y-2 p-3 container-content-background/50 rounded-lg">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                              <Activity className="h-3 w-3" />
                              <span>{t('agents.transferData', 'Transfer Data')}</span>
                            </div>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">{t('agents.downloaded')}:</span>
                                <span className="font-medium">{agent?.instance?.transfer?.all_time_downloaded && formatBytes(agent.instance.transfer.all_time_downloaded)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">{t('agents.uploaded')}:</span>
                                <span className="font-medium">{agent?.instance?.transfer?.all_time_uploaded && formatBytes(agent.instance.transfer.all_time_uploaded)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">{t('agents.globalRatio')}:</span>
                                <span className="font-medium">{agent?.instance?.transfer?.global_ratio?.toFixed(2)}</span>
                              </div>
                            </div>
                          </div>

                          {/* Network Information Card */}
                          <div className="space-y-2 p-3 container-content-background/50 rounded-lg">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                              <Wifi className="h-3 w-3" />
                              <span>{t('agents.networkInfo', 'Network Info')}</span>
                            </div>
                            <div className="space-y-2 text-sm">
                              {agent?.instance?.transfer?.last_external_address_v4 && (
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">{t('agents.ipv4', 'IPv4')}:</span>
                                  <span className="font-mono text-xs">{agent.instance.transfer.last_external_address_v4}</span>
                                </div>
                              )}
                              {agent?.instance?.transfer?.last_external_address_v6 && (
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">{t('agents.ipv6', 'IPv6')}:</span>
                                  <span className="font-mono text-xs">{agent.instance.transfer.last_external_address_v6}</span>
                                </div>
                              )}
                              {!agent?.instance?.transfer?.last_external_address_v4 && !agent?.instance?.transfer?.last_external_address_v6 && (
                                <div className="text-xs text-muted-foreground text-center py-2">
                                  {t('agents.noNetworkInfo', 'No network information available')}
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
              {agent && <AgentLogsTab agentId={agent.uuid} />}
            </TabsContent>

            <TabsContent value="limites" className="mt-4">
              {agent && <AgentLimits agentId={agent.uuid} disableScroll />}
            </TabsContent>

            <TabsContent value="schedules" className="mt-4">
              <div className="space-y-4 p-4">
                <p className="text-sm text-muted-foreground">
                  {t('agents.schedules.comingSoon', 'Speed schedules configuration coming soon...')}
                </p>
              </div>
            </TabsContent>
          </CustomScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
