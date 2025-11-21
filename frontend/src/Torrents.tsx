
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Search, Loader2, ChevronDown, SortAsc, SortDesc, Plus, SlidersHorizontal, Download, Clock, Server, Activity, Folder, Tag, FileUp, AlertTriangle, Star, CheckSquare, Square, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { torrentService } from "./services/torrents";
import { agentService } from "./services/agents";
import { preferencesService } from "@/services/preferences";
import { useTorrentFilters } from "@/components/TorrentFilters";
import type { Task, CreateTaskRequest, TaskMetadata } from "./types/torrent";
import type { Agent, AgentStatus } from "./types/agent";
import AgentFilter from "@/components/ui/AgentFilter";
import StatusFilter from "@/components/ui/StatusFilter";
import { ListFilter } from "@/components/ui/ListFilter";
import { FilterSidebar } from "@/components/ui/FilterSidebar";
import { DropdownSelect } from "@/components/ui/DropdownSelect";
import { useAutoSelectFilters } from "@/hooks/useAutoSelectFilters";
import { TorrentDetailsModal } from "@/components/TorrentDetailsModal";
import { TorrentDeleteModal } from "@/components/TorrentDeleteModal";
import { AddTorrentModal } from "@/components/AddTorrentModal";
import { TorrentMetricsModal } from "@/components/TorrentMetricsModal";
import { TorrentLimitModal } from "@/components/TorrentLimitModal";
import TorrentListMobile from "@/components/TorrentListMobile";
import TorrentsTable from "@/components/TorrentsTable";
import { RatioBadge } from "@/components/RatioBadge";
import { toast } from "sonner";
import { getStatusIcon, getStatusColor, type TorrentStatus } from "@/components/TorrentStatusIcon";
import { normalizeTaskStatus } from "@/utils/statusUtils";
import { getRatioGrade } from "@/utils/ratioUtils";


type SortType = "priority" | "alphabetical" | "size" | "progress" | "download_speed" | "upload_speed" | "downloaded" | "uploaded";


type Torrent = {
  id: string;
  hash: string;
  name: string;
  totalSizeBytes: number;
  downloadRateBps: number;
  uploadRateBps: number;
  downloadedBytes: number;
  uploadedBytes: number;
  status: TorrentStatus;
  createdAt: string; // ISO date string
  progress: number;
  ratio: number;
  numSeeds: number;
  numLeechs: number;
  agentName?: string;
  agentStatus?: AgentStatus;
  agentUUID?: string;
  agentIcon?: string;
  agentColor?: string;
  category: string;
  tags: string[];
  metadata?: TaskMetadata | null;
};

// Função para mapear Task (backend) para Torrent (frontend)
function mapTaskToTorrent(task: Task): Torrent {
  // Mapear status do backend (já convertido para uppercase pelo mapeamento TaskStatuses)
  const mapStatus = (state: string): TorrentStatus => {
    // O backend já converte os status do qBittorrent para uppercase através do mapeamento TaskStatuses
    // Usamos normalizeTaskStatus para garantir que temos um status válido ou 'UNKNOWN'
    return normalizeTaskStatus(state);
  };

  return {
    id: task.id,
    hash: task.hash,
    name: task.name,
    totalSizeBytes: task.size,
    downloadRateBps: task.network?.download?.speed || 0,
    uploadRateBps: task.network?.upload?.speed || 0,
    downloadedBytes: task.network?.download?.amount || 0,
    uploadedBytes: task.network?.upload?.amount || 0,
    status: mapStatus(task.state),
    createdAt: new Date().toISOString(), // Backend não fornece data de criação
    progress: task.progress,
    ratio: task.ratio,
    numSeeds: task.pairs?.seeders || 0,
    numLeechs: task.pairs?.leechers || 0,
    agentName: task.agent?.name,
    agentStatus: task.agent?.status,
    agentUUID: task.agent?.uuid,
    agentIcon: task.agent?.icon,
    agentColor: task.agent?.color,
    category: task.category || "",
    tags: task.tags || [],
    metadata: task.metadata,
  };
}

// Função para obter chave de tradução do tipo de ordenação
function getSortTypeKey(sortType: SortType): string {
  switch (sortType) {
    case "priority": return "priority";
    case "alphabetical": return "alphabetical";
    case "size": return "size";
    case "progress": return "progress";
    case "download_speed": return "downloadSpeed";
    case "upload_speed": return "uploadSpeed";
    case "downloaded": return "downloaded";
    case "uploaded": return "uploaded";
    default: return "alphabetical";
  }
}

// Desktop table moved to components/TorrentsTable

export default function TorrentsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [torrents, setTorrents] = useState<Torrent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortType, setSortType] = useState<SortType>("priority");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(true);
  const [selectedAgentIds, setSelectedAgentIds] = useState<Set<string>>(new Set());
  const [selectedStatuses, setSelectedStatuses] = useState<Set<TorrentStatus>>(new Set());
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [selectedGrades, setSelectedGrades] = useState<Set<string>>(new Set());
  const [refreshIntervalSec, setRefreshIntervalSec] = useState<number>(5);
  const [selectedTorrent, setSelectedTorrent] = useState<Task | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [originalTasks, setOriginalTasks] = useState<Task[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isMetricsModalOpen, setIsMetricsModalOpen] = useState(false);
  const [metricsTaskId, setMetricsTaskId] = useState<string>("");
  const [metricsAgentId, setMetricsAgentId] = useState<string>("");
  const [metricsTaskName, setMetricsTaskName] = useState<string>("");
  const [metricsSelectedCount, setMetricsSelectedCount] = useState<number>(1);
  const [metricsTaskIds, setMetricsTaskIds] = useState<string[]>([]);
  const [isLimitsModalOpen, setIsLimitsModalOpen] = useState(false);
  const [limitsTaskIds, setLimitsTaskIds] = useState<string[]>([]);
  const [limitsAgentId, setLimitsAgentId] = useState<string>("");
  const [limitsTaskName, setLimitsTaskName] = useState<string>("");
  const [limitsTaskStatus, setLimitsTaskStatus] = useState<string>("");
  const [isFilterSidebarOpen, setIsFilterSidebarOpen] = useState(false);
  const [isAddDropdownOpen, setIsAddDropdownOpen] = useState(false);
  const [compact, setCompact] = useState(false);
  const [displayMode, setDisplayMode] = useState<"default" | "card">("default");
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastNonEmptyTorrents, setLastNonEmptyTorrents] = useState<Torrent[]>([]);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteIds, setDeleteIds] = useState<string[]>([]);
  const [deleteMode, setDeleteMode] = useState<"single" | "bulk">("single");
  const [deleteSingleName, setDeleteSingleName] = useState<string>("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Lazy loading states for card view
  const [displayedItemsCount, setDisplayedItemsCount] = useState(30); // Initial load: 30 items (3x10 rows)
  const sentinelRef = useRef<HTMLDivElement>(null);
  const mobileSentinelRef = useRef<HTMLDivElement>(null);
  const ITEMS_PER_LOAD = 30; // Load 30 more items each time

  // Detect mobile viewport
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768); // md breakpoint
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Toggle single selection
  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Tri-state select-all button behavior
  const handleToggleSelectAll = () => {
    // Phase 0 -> 1: enable selection with none selected
    if (!selectionMode) {
      setSelectionMode(true);
      setSelectedIds(new Set());
      return;
    }
    // Phase 1 -> 2: select all visible
    const visibleIdsLocal = paginatedTorrents.map(t => t.id);
    const allSelectedLocal = visibleIdsLocal.length > 0 && visibleIdsLocal.every(id => selectedIds.has(id));
    if (!allSelectedLocal) {
      setSelectedIds(new Set(visibleIdsLocal));
      return;
    }
    // Phase 2 -> 0: disable selection mode
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  const addDropdownRef = useRef<HTMLDivElement | null>(null);

  // Extrair status únicos disponíveis
  const availableStatuses = useMemo(() => {
    const statuses = new Set<TorrentStatus>();
    torrents.forEach(t => statuses.add(t.status));
    return Array.from(statuses).sort();
  }, [torrents]);

  // Extrair categorias únicas disponíveis
  const availableCategories = useMemo(() => {
    const categories = new Set<string>();
    torrents.forEach(t => {
      if (t.category) categories.add(t.category);
    });
    return Array.from(categories).sort();
  }, [torrents]);

  // Extrair tags únicas disponíveis
  const availableTags = useMemo(() => {
    const tags = new Set<string>();
    torrents.forEach(t => {
      t.tags?.forEach(tag => {
        if (tag) tags.add(tag);
      });
    });
    return Array.from(tags).sort();
  }, [torrents]);

  // Extrair ratio grades únicas disponíveis (ordenadas pela hierarquia)
  const availableGrades = useMemo(() => {
    const grades = new Set<string>();
    torrents.forEach(t => {
      grades.add(getRatioGrade(t.ratio));
    });
    const order = ["S++", "S+", "S", "A", "B", "C", "D", "E"];
    return Array.from(grades).sort((a, b) => order.indexOf(a) - order.indexOf(b));
  }, [torrents]);

  // Auto-select filters
  useAutoSelectFilters(availableStatuses, selectedStatuses, setSelectedStatuses);
  useAutoSelectFilters(availableCategories, selectedCategories, setSelectedCategories);
  useAutoSelectFilters(availableTags, selectedTags, setSelectedTags);
  useAutoSelectFilters(availableGrades, selectedGrades, setSelectedGrades);

  // Carregar torrents da API
  const loadTorrents = useCallback(async () => {
    try {
      setLoading(true);

      // Verificar se há pelo menos um agente funcional (não erro) antes de tentar carregar tasks
      const functionalAgents = agents.filter(agent => agent.status !== 'ERRORED');
      if (functionalAgents.length === 0) {
        // Se não há agentes funcionais, limpar tasks e não tentar carregar
        setOriginalTasks([]);
        setTorrents([]);
        return;
      }

      const response = await torrentService.listTasks();

      if (response.error) {
        toast.error(response.error);
        return;
      }

      const allTasks = response.data?.tasks || [];
      const errors = response.data?.errors || {};

      // Mostrar erros se houver
      if (Object.keys(errors).length > 0) {
        const errorMessages = Object.entries(errors).map(([agentId, error]) => {
          const agent = agents.find(a => a.uuid === agentId);
          return `Agent ${agent?.name || agentId}: ${error}`;
        });

        console.warn('Some agents failed to load tasks:', errorMessages);
        // Mostrar toast persistente ou com duração maior para erros parciais
        toast.warning('Alguns agentes falharam ao carregar tarefas', {
          description: errorMessages.join('\n'),
          duration: 5000,
        });
      }

      // Enriquecer tasks com info do agente
      const enrichedTasks = allTasks.map(task => {
        // O backend não retorna o objeto agent completo dentro da task na listagem geral,
        // precisamos associar manualmente se necessário, ou confiar que o backend já preencheu
        // No caso do endpoint /agents/tasks, o backend atual (após refactor) retorna []Task.
        // Se o backend não preenche o campo agent, precisamos fazer o match pelo ID se disponível,
        // mas a struct Task tem `Agent *Agent`. Vamos assumir que o backend preenche.
        // Se não, teríamos que ter o agentId na task.
        return task;
      });

      setOriginalTasks(enrichedTasks);
      const mappedTorrents = enrichedTasks.map(mapTaskToTorrent);
      setTorrents(mappedTorrents);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('torrents.error'));
    } finally {
      setLoading(false);
    }
  }, [t, agents]);

  // Atualização silenciosa para não afetar UI (sem spinner)
  const refreshTorrentsSilently = useCallback(async (): Promise<Task[]> => {
    try {
      // Verificar se há pelo menos um agente funcional (não erro) antes de tentar carregar tasks
      const functionalAgents = agents.filter(agent => agent.status !== 'ERRORED');
      if (functionalAgents.length === 0) {
        // Se não há agentes funcionais, limpar tasks e retornar
        setOriginalTasks([]);
        setTorrents([]);
        return [];
      }

      // Buscar tasks de cada agente funcional individualmente
      const allTasks: Task[] = [];

      for (const agent of functionalAgents) {
        try {
          const response = await torrentService.listAgentTasks(agent.uuid);
          if (response?.data) {
            // Adicionar informações do agente a cada task
            const tasksWithAgent = response.data.map(task => ({
              ...task,
              agent: agent
            }));
            allTasks.push(...tasksWithAgent);
          }
        } catch {
          // silencioso - ignorar erros individuais de agentes
        }
      }

      setOriginalTasks(allTasks);
      const mappedTorrents = allTasks.map(mapTaskToTorrent);
      setTorrents(mappedTorrents);
      return allTasks;
    } catch {
      // silencioso
      return [];
    }
  }, [agents]);

  // Carregar agents da API
  const loadAgents = useCallback(async () => {
    try {
      setAgentsLoading(true);
      const response = await agentService.listAgents();
      if (response.error) {
        setAgents([]);
        return;
      }
      if (response.data) {
        setAgents(response.data);
        // Selecionar todos por padrão somente na primeira carga
        setSelectedAgentIds(prev => {
          if (prev.size === 0 && response.data) {
            return new Set(response.data.map((a) => a.uuid));
          }
          return prev;
        });
      } else {
        setAgents([]);
      }
    } catch {
      // silencioso; filtro de agentes é opcional
      setAgents([]);
    } finally {
      setAgentsLoading(false);
    }
  }, []);

  // Abrir modal de deleção (single/bulk) a partir do contexto (tabela/cards/menu)
  const openDeleteModal = (ids: string[]) => {
    setDeleteIds(ids);
    const isBulk = selectionMode && ids.length > 1;
    setDeleteMode(isBulk ? "bulk" : "single");
    if (!isBulk) {
      const t = (torrents.find(x => x.id === ids[0]) || lastNonEmptyTorrents.find(x => x.id === ids[0]));
      setDeleteSingleName(t?.name || "");
    } else {
      setDeleteSingleName("");
    }
    setIsDeleteModalOpen(true);
  };

  // Confirma deleção de 1..N torrents selecionados
  const handleConfirmDelete = async (purge: boolean) => {
    try {
      const ids = deleteIds;
      const source = torrents.length > 0 ? torrents : lastNonEmptyTorrents;
      const isBulk = ids.length > 1;

      // Marcar que estamos fazendo refresh para manter cache ativo
      setIsRefreshing(true);

      await Promise.allSettled(ids.map(async (id) => {
        const t = source.find(x => x.id === id);
        if (t?.agentUUID) {
          await torrentService.deleteTask(t.agentUUID, id, purge);
        }
      }));

      // Recarregar lista
      await loadTorrents();

      // Exibir mensagem de sucesso
      const message = isBulk
        ? `${ids.length} ${ids.length === 1 ? 'torrent removido' : 'torrents removidos'} com sucesso`
        : 'Torrent removido com sucesso';
      toast.success(message, {
        position: 'top-center',
        className: 'toast-success-icon-only',
      });

      // Limpar seleção apenas após recarga completa
      if (isBulk) {
        setSelectedIds(new Set());
        setSelectionMode(false);
      }
    } catch (err) {
      console.error(err);
      toast.error('Erro ao remover torrent(s)', {
        position: 'top-center',
        className: 'toast-error-icon-only',
      });
    } finally {
      setIsRefreshing(false);
      setIsDeleteModalOpen(false);
      setDeleteIds([]);
    }
  };

  // Abrir modal de detalhes
  const handleShowDetails = (torrentId: string) => {
    const task = originalTasks.find(t => t.id === torrentId);
    if (task) {
      setSelectedTorrent(task);
      setIsModalOpen(true);
    }
  };

  // Fechar modal
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedTorrent(null);
  };

  // Abrir modal de métricas
  const handleShowMetrics = (taskId: string, agentId?: string) => {
    const task = originalTasks.find(t => t.id === taskId);

    // Se está em modo de seleção e há múltiplos torrents selecionados, usar a seleção
    const isBulkView = selectionMode && selectedIds.size > 1;
    const count = isBulkView ? selectedIds.size : 1;
    const taskIds = isBulkView ? Array.from(selectedIds) : [taskId];

    setMetricsTaskId(taskId);
    setMetricsAgentId(agentId || "");
    setMetricsTaskName(task?.name || "");
    setMetricsSelectedCount(count);
    setMetricsTaskIds(taskIds);
    setIsMetricsModalOpen(true);
  };

  // Fechar modal de métricas
  const handleCloseMetricsModal = () => {
    setIsMetricsModalOpen(false);
    setMetricsTaskId("");
    setMetricsAgentId("");
    setMetricsTaskName("");
    setMetricsSelectedCount(1);
    setMetricsTaskIds([]);
  };

  // Abrir modal de limites
  const handleShowLimits = (taskId: string, agentId?: string) => {
    const task = originalTasks.find(t => t.id === taskId);

    // Se está em modo de seleção e há múltiplos torrents selecionados, usar a seleção
    const isBulkEdit = selectionMode && selectedIds.size > 1;
    const taskIds = isBulkEdit ? Array.from(selectedIds) : [taskId];

    setLimitsTaskIds(taskIds);
    setLimitsAgentId(agentId || "");
    setLimitsTaskName(task?.name || "");
    setLimitsTaskStatus(task?.state || "");
    setIsLimitsModalOpen(true);
  };

  // Fechar modal de limites
  const handleCloseLimitsModal = () => {
    setIsLimitsModalOpen(false);
    setLimitsTaskIds([]);
    setLimitsAgentId("");
    setLimitsTaskName("");
    setLimitsTaskStatus("");
  };

  // Handler para atualização de metadados
  const handleMetadataUpdate = useCallback(async () => {
    // Recarregar torrents silenciosamente para obter metadados atualizados
    await refreshTorrentsSilently();
  }, [refreshTorrentsSilently]);

  // Controles de torrent
  const handleGenericTorrentAction = async (
    torrentId: string,
    actionName: string,
    actionFn: (agentId: string, taskId: string) => Promise<{ error?: string }>,
    successMessage: string
  ) => {
    try {
      const task = originalTasks.find(t => t.id === torrentId);
      if (!task || !task.agent?.uuid) {
        toast.error('Agent ID não encontrado para este torrent');
        return;
      }

      const response = await actionFn(task.agent.uuid, torrentId);
      if (response.error) {
        toast.error(response.error);
        return;
      }

      toast.success(successMessage);

      // Recarregar dados de todos os agentes sem fechar o modal
      const updatedTasks = await refreshTorrentsSilently();

      // Atualizar o torrent selecionado para refletir mudanças
      const updatedTask = updatedTasks.find(t => t.id === torrentId);
      if (updatedTask) {
        setSelectedTorrent(updatedTask);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Erro ao ${actionName}`);
    }
  };

  const handlePlayTorrent = (torrentId: string) =>
    handleGenericTorrentAction(
      torrentId,
      'retomar torrent',
      torrentService.resumeTask,
      'Torrent retomado com sucesso'
    );

  const handlePauseTorrent = (torrentId: string) =>
    handleGenericTorrentAction(
      torrentId,
      'pausar torrent',
      torrentService.pauseTask,
      'Torrent pausado com sucesso'
    );

  const handleForceDownloadTorrent = (torrentId: string) =>
    handleGenericTorrentAction(
      torrentId,
      'forçar download do torrent',
      torrentService.forceDownloadTask,
      'Force download iniciado com sucesso'
    );

  const handleForceReannounceTorrent = (torrentId: string) =>
    handleGenericTorrentAction(
      torrentId,
      'forçar reannounce do torrent',
      torrentService.forceReannounceTask,
      'Force reannounce iniciado com sucesso'
    );

  const handleForceRecheckTorrent = (torrentId: string) =>
    handleGenericTorrentAction(
      torrentId,
      'forçar recheck do torrent',
      torrentService.forceRecheckTask,
      'Force recheck iniciado com sucesso'
    );


  const handleRenameTorrent = async (torrentId: string, newName: string) => {
    try {
      const task = originalTasks.find(t => t.id === torrentId);
      if (!task || !task.agent?.uuid) {
        toast.error('Agent ID não encontrado para este torrent');
        return;
      }

      const response = await torrentService.renameTask(task.agent.uuid, torrentId, newName);
      if (response.error) {
        toast.error(response.error);
        return;
      }

      toast.success('Torrent renomeado com sucesso');

      // Recarregar dados de todos os agentes sem fechar o modal
      const updatedTasks = await refreshTorrentsSilently();

      // Atualizar o torrent selecionado para refletir mudanças
      const updatedTask = updatedTasks.find(t => t.id === torrentId);
      if (updatedTask) {
        setSelectedTorrent(updatedTask);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao renomear torrent');
    }
  };

  const handleSetLocationTorrent = async (torrentId: string, location: string) => {
    try {
      const task = originalTasks.find(t => t.id === torrentId);
      if (!task || !task.agent?.uuid) {
        toast.error('Agent ID não encontrado para este torrent');
        return;
      }

      const response = await torrentService.setTaskLocation(task.agent.uuid, torrentId, location);
      if (response.error) {
        toast.error(response.error);
        return;
      }

      toast.success('Caminho alterado com sucesso');

      // Recarregar dados de todos os agentes sem fechar o modal
      const updatedTasks = await refreshTorrentsSilently();

      // Atualizar o torrent selecionado para refletir mudanças
      const updatedTask = updatedTasks.find(t => t.id === torrentId);
      if (updatedTask) {
        setSelectedTorrent(updatedTask);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao alterar caminho do torrent');
    }
  };

  const handleDeleteTorrent = async (torrentId: string, purge: boolean = false) => {
    try {
      const task = originalTasks.find(t => t.id === torrentId);
      if (!task || !task.agent?.uuid) {
        toast.error('Agent ID não encontrado para este torrent');
        return;
      }

      const response = await torrentService.deleteTask(task.agent.uuid, torrentId, purge);

      if (response.error) {
        toast.error(response.error);
        return;
      }

      // Fechar modal e recarregar lista
      handleCloseModal();
      await loadTorrents();
      toast.success(purge
        ? t('torrents.notifications.deleteWithFilesSuccess')
        : t('torrents.notifications.deleteSuccess')
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('torrents.notifications.deleteError'));
    }
  };

  // Criar novo torrent
  const handleCreateTorrent = async (agentId: string, taskData: CreateTaskRequest) => {
    try {
      const response = await torrentService.createTask(agentId, taskData);

      if (response.error) {
        // Fechar o modal e exibir toast com erro
        setIsAddModalOpen(false);
        toast.error(t('torrents.notifications.addError', { error: response.error }));
        return;
      }

      // Recarregar a lista após criação
      await loadTorrents();

      // Exibir mensagem de sucesso
      toast.success(t('torrents.notifications.addSuccess'));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : t('torrents.error');
      // Fechar o modal e exibir toast com erro
      setIsAddModalOpen(false);
      toast.error(t('torrents.notifications.addError', { error: errorMessage }));
    }
  };

  // Load preferences from localStorage
  useEffect(() => {
    const prefs = preferencesService.load();
    if (prefs) {
      setCompact(prefs.compact);
      setDisplayMode(prefs.torrent_display_mode);
    }
  }, []);

  // Carregar dados na inicialização
  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  // Cache da última lista não vazia para evitar flicker quando em seleção múltipla
  useEffect(() => {
    if (torrents.length > 0) {
      setLastNonEmptyTorrents(torrents);
    }
  }, [torrents]);

  // Carregar torrents quando agents mudarem (para detectar mudanças de status)
  useEffect(() => {
    if (!agentsLoading) {
      loadTorrents();
    }
  }, [agents, loadTorrents, agentsLoading]);

  // Intervalo de atualização automática com debounce e otimização de visibilidade
  useEffect(() => {
    if (refreshIntervalSec <= 0) return;

    // Não iniciar atualização automática até que os agentes tenham sido carregados
    if (agentsLoading) return;

    // Pausar atualização se não há agentes funcionais
    const hasFunctionalAgents = agents.some(agent => agent.status !== 'ERRORED');
    if (!hasFunctionalAgents) return;

    let timeoutId: NodeJS.Timeout;
    let isPageVisible = true;

    // Pausar auto refresh quando a página não está visível
    const handleVisibilityChange = () => {
      isPageVisible = !document.hidden;
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    const id = setInterval(() => {
      // Só atualiza se a página estiver visível
      if (!isPageVisible) return;

      // Debounce para evitar atualizações excessivas
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        refreshTorrentsSilently();
      }, 100); // 100ms de debounce
    }, refreshIntervalSec * 1000);

    return () => {
      clearInterval(id);
      clearTimeout(timeoutId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [refreshIntervalSec, refreshTorrentsSilently, agentsLoading, agents]);

  // Handle clicking outside the add dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (addDropdownRef.current && !addDropdownRef.current.contains(event.target as Node)) {
        setIsAddDropdownOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsAddDropdownOpen(false);
    }

    if (isAddDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isAddDropdownOpen]);

  // Filtrar e ordenar torrents usando hook customizado
  const filteredTorrents = useTorrentFilters({
    torrents,
    lastNonEmptyTorrents,
    isRefreshing,
    selectionMode,
    searchTerm,
    sortType,
    sortDirection,
    agents,
    selectedAgentIds,
    availableStatuses,
    selectedStatuses,
    availableCategories,
    selectedCategories,
    availableTags,
    selectedTags,
    availableGrades,
    selectedGrades,
  });

  // Calcular dados de paginação ou lazy loading baseado no displayMode
  const useCardLazyLoading = displayMode === "card";

  // Para card view (desktop) e mobile: usar lazy loading
  // Para table view (desktop): usar paginação tradicional
  const displayedTorrents = (useCardLazyLoading || isMobile)
    ? filteredTorrents.slice(0, displayedItemsCount)
    : filteredTorrents.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const totalPages = (useCardLazyLoading || isMobile) ? 1 : Math.ceil(filteredTorrents.length / itemsPerPage);
  const paginatedTorrents = displayedTorrents;
  const visibleIds = useMemo(() => paginatedTorrents.map(t => t.id), [paginatedTorrents]);
  const allSelected = selectionMode && visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));

  // Resetar página/contador quando o filtro, itens por página ou tipo de ordenação mudarem
  useEffect(() => {
    setCurrentPage(1);
    setDisplayedItemsCount(30); // Reset lazy loading counter
  }, [searchTerm, itemsPerPage, sortType, sortDirection, displayMode, isMobile]);

  // Intersection Observer para lazy loading (card view desktop)
  useEffect(() => {
    if (!useCardLazyLoading || !sentinelRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const target = entries[0];
        if (target.isIntersecting && displayedItemsCount < filteredTorrents.length) {
          setDisplayedItemsCount(prev => Math.min(prev + ITEMS_PER_LOAD, filteredTorrents.length));
        }
      },
      { threshold: 0.1, rootMargin: '200px' }
    );

    observer.observe(sentinelRef.current);

    return () => observer.disconnect();
  }, [useCardLazyLoading, displayedItemsCount, filteredTorrents.length, ITEMS_PER_LOAD]);

  // Intersection Observer para lazy loading (mobile)
  useEffect(() => {
    if (!isMobile || !mobileSentinelRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const target = entries[0];
        if (target.isIntersecting && displayedItemsCount < filteredTorrents.length) {
          setDisplayedItemsCount(prev => Math.min(prev + ITEMS_PER_LOAD, filteredTorrents.length));
        }
      },
      { threshold: 0.1, rootMargin: '200px' }
    );

    observer.observe(mobileSentinelRef.current);

    return () => observer.disconnect();
  }, [isMobile, displayedItemsCount, filteredTorrents.length, ITEMS_PER_LOAD]);

  // Função para lidar com mudança de itens por página
  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
  };

  // Alternar seleção de agente
  const toggleAgent = (agentId: string) => {
    setSelectedAgentIds((prev) => {
      const next = new Set(prev);
      if (next.has(agentId)) next.delete(agentId); else next.add(agentId);
      return next;
    });
  };

  // Selecionar ou limpar todos agentes
  const setAllAgents = (checked: boolean) => {
    if (checked) {
      setSelectedAgentIds(new Set(agents.map((a) => a.uuid)));
    } else {
      setSelectedAgentIds(new Set());
    }
  };

  // Alternar seleção de status
  const toggleStatus = (status: TorrentStatus) => {
    setSelectedStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status); else next.add(status);
      return next;
    });
  };

  // Selecionar ou limpar todos status
  const setAllStatuses = (checked: boolean) => {
    if (checked) {
      setSelectedStatuses(new Set(availableStatuses));
    } else {
      setSelectedStatuses(new Set());
    }
  };

  // Alternar seleção de categoria
  const toggleCategory = (category: string) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category); else next.add(category);
      return next;
    });
  };

  // Selecionar ou limpar todas categorias
  const setAllCategories = (checked: boolean) => {
    if (checked) {
      setSelectedCategories(new Set(availableCategories));
    } else {
      setSelectedCategories(new Set());
    }
  };

  // Alternar seleção de tag
  const toggleTag = (tag: string) => {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag); else next.add(tag);
      return next;
    });
  };

  // Selecionar ou limpar todas tags
  const setAllTags = (checked: boolean) => {
    if (checked) {
      setSelectedTags(new Set(availableTags));
    } else {
      setSelectedTags(new Set());
    }
  };

  // Alternar seleção de ratio grade
  const toggleGrade = (grade: string) => {
    setSelectedGrades((prev) => {
      const next = new Set(prev);
      if (next.has(grade)) next.delete(grade); else next.add(grade);
      return next;
    });
  };

  // Selecionar ou limpar todos os ratio grades
  const setAllGrades = (checked: boolean) => {
    if (checked) {
      setSelectedGrades(new Set(availableGrades));
    } else {
      setSelectedGrades(new Set());
    }
  };

  // Função para alterar tipo de ordenação
  const handleSortChange = (newSortType: SortType) => {
    if (sortType === newSortType) {
      // Se já está ordenando por este tipo, alterna a direção
      setSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      // Se é um novo tipo, define como ascendente
      setSortType(newSortType);
      setSortDirection("asc");
    }
  };


  // Mostrar estado de carregamento
  if (loading || agentsLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Download className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{t('torrents.title')}</h1>
              <p className="text-muted-foreground">
                {t('torrents.subtitle')}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('torrents.loading')}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 w-full pb-0">
      {/* Header - sempre mostrado */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Download className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t('torrents.title')}</h1>
            <p className="text-muted-foreground">
              {t('torrents.subtitle')}
            </p>
          </div>
        </div>
        {/* Controles de adicionar - apenas quando há agentes funcionais */}
        {!agentsLoading && agents.length > 0 && agents.some(agent => agent.status !== 'ERRORED') && (
          <div className="relative" ref={addDropdownRef}>
            <div className="flex">
              <Button
                onClick={() => setIsAddModalOpen(true)}
                disabled={agents.length === 0}
                className="rounded-r-none border-r-0"
              >
                <Plus className="h-4 w-4 mr-2" />
                {t('torrents.addTorrent')}
              </Button>
              <Button
                onClick={() => setIsAddDropdownOpen(!isAddDropdownOpen)}
                disabled={agents.length === 0}
                className="rounded-l-none px-2 border-l-0"
                aria-haspopup="listbox"
                aria-expanded={isAddDropdownOpen}
              >
                <ChevronDown className={`h-4 w-4 transition-transform ${isAddDropdownOpen ? 'rotate-180' : ''}`} />
              </Button>
            </div>

            {isAddDropdownOpen && (
              <div
                className="absolute right-0 mt-1 w-48 rounded-md border bg-card text-card-foreground shadow-md z-[100] py-1"
                role="listbox"
                aria-label="Add torrent options"
              >
                <button
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground cursor-not-allowed opacity-50"
                  onClick={(e) => e.preventDefault()}
                  role="option"
                  disabled
                  aria-disabled="true"
                >
                  <FileUp className="h-4 w-4" />
                  Adicionar arquivo
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Aviso de erro nos agentes - apenas quando há tasks e agentes com erro */}
      {!agentsLoading && agents.length > 0 && agents.some(agent => agent.status === 'ERRORED') && torrents.length > 0 && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 mb-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0" />
            <div className="flex-1">
              <h3 className="text-sm font-medium text-destructive">
                {t('torrents.agentErrorWarning.title', 'Agent Errors Detected')}
              </h3>
              <p className="text-sm text-destructive/80 mt-1">
                {t('torrents.agentErrorWarning.description', 'Some agents have errors that need to be fixed. This may affect task management and monitoring.')}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/agents')}
              className="flex-shrink-0 border-destructive/20 text-destructive hover:bg-destructive/10"
            >
              <AlertTriangle className="h-4 w-4 mr-2" />
              {t('torrents.agentErrorWarning.fixAgents', 'Fix Agents')}
            </Button>
          </div>
        </div>
      )}

      {/* Filtro de busca e controles - apenas quando há agentes funcionais */}
      {!agentsLoading && agents.length > 0 && agents.some(agent => agent.status !== 'ERRORED') && (
        <div className="flex flex-col gap-4 w-full sm:gap-4 gap-0">
          {/* Busca e controles - desktop na mesma linha */}
          <div className="hidden sm:flex items-center gap-4 w-full">
            {/* Select All (left of search) */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={selectionMode ? "default" : "outline"}
                  size="icon"
                  className="h-9 w-9 flex-shrink-0"
                  onClick={handleToggleSelectAll}
                  aria-label={!selectionMode ? 'Habilitar seleção' : (!allSelected ? 'Selecionar todos' : 'Desabilitar seleção múltipla')}
                >
                  {allSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{!selectionMode ? 'Habilitar seleção' : (!allSelected ? 'Selecionar todos' : 'Desabilitar seleção múltipla')}</p>
              </TooltipContent>
            </Tooltip>

            {/* Busca */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder={t('torrents.search')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Controles */}
            <div className="flex items-center gap-4 flex-shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{t('torrents.update')}:</span>
                <DropdownSelect
                  value={refreshIntervalSec}
                  onChange={setRefreshIntervalSec}
                  options={[3, 5, 10, 15, 30, 60]}
                  formatLabel={(v) => `${v}s`}
                  ariaLabel={`Atualizar a cada ${refreshIntervalSec}s`}
                  title={`Atualizar a cada ${refreshIntervalSec} segundos`}
                  minWidth="60px"
                />
              </div>
              {displayMode !== "card" && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">{t('torrents.itemsPerPage')}:</span>
                  <DropdownSelect
                    value={itemsPerPage}
                    onChange={handleItemsPerPageChange}
                    options={[5, 10, 20, 50, 100]}
                    ariaLabel={`Itens por página: ${itemsPerPage}`}
                    minWidth="80px"
                  />
                </div>
              )}
              <Button
                variant="outline"
                onClick={() => setIsFilterSidebarOpen(true)}
                className="flex items-center gap-2 min-w-[120px]"
              >
                <SlidersHorizontal className="h-4 w-4" />
                <span className="text-sm">{t('torrents.filters.title')}</span>
                {(selectedAgentIds.size < agents.length ||
                  selectedStatuses.size < availableStatuses.length ||
                  selectedCategories.size < availableCategories.length ||
                  selectedTags.size < availableTags.length ||
                  selectedGrades.size < availableGrades.length) && (
                    <span className="ml-auto h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                  )}
              </Button>
              <div className="text-sm text-muted-foreground">
                {filteredTorrents.length} {t('torrents.of')} {torrents.length} {t('torrents.torrents')}
                <span className="ml-2 text-xs">
                  ({t('torrents.sortedBy')} {t(`torrents.sortBy.${getSortTypeKey(sortType)}`)} {sortDirection === "asc" ? "↑" : "↓"})
                </span>
              </div>
            </div>
          </div>

          {/* Aviso de erro nos agentes - mobile */}
          {agents.some(agent => agent.status === 'ERRORED') && torrents.length > 0 && (
            <div className="sm:hidden mb-4">
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xs font-medium text-destructive">
                      {t('torrents.agentErrorWarning.title', 'Agent Errors Detected')}
                    </h3>
                    <p className="text-xs text-destructive/80 mt-1">
                      {t('torrents.agentErrorWarning.description', 'Some agents have errors that need to be fixed.')}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate('/agents')}
                    className="flex-shrink-0 border-destructive/20 text-destructive hover:bg-destructive/10 h-7 px-2 text-xs"
                  >
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    {t('torrents.agentErrorWarning.fix', 'Fix')}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Controles mobile */}
          <div className="sm:hidden mb-1">
            <div className="flex items-stretch gap-1.5">
              {/* Select All (left of refresh) */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={selectionMode ? "default" : "outline"}
                    size="icon"
                    className="flex-shrink-0 h-8 w-8"
                    onClick={handleToggleSelectAll}
                    aria-label={!selectionMode ? 'Habilitar seleção' : (!allSelected ? 'Selecionar todos' : 'Desabilitar seleção múltipla')}
                  >
                    {allSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{!selectionMode ? 'Habilitar seleção' : (!allSelected ? 'Selecionar todos' : 'Desabilitar seleção múltipla')}</p>
                </TooltipContent>
              </Tooltip>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Clock className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                <DropdownSelect
                  value={refreshIntervalSec}
                  onChange={setRefreshIntervalSec}
                  options={[3, 5, 10, 15, 30, 60]}
                  formatLabel={(v) => `${v}s`}
                  ariaLabel={`Atualizar a cada ${refreshIntervalSec}s`}
                  title={`Atualizar a cada ${refreshIntervalSec} segundos`}
                  minWidth="60px"
                />
              </div>
              {displayMode !== "card" && (
                <>
                  <div className="w-px bg-border self-stretch flex-shrink-0" />
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className="text-xs text-muted-foreground">{t('torrents.itemsPerPage').split(' ')[0]}:</span>
                    <DropdownSelect
                      value={itemsPerPage}
                      onChange={handleItemsPerPageChange}
                      options={[5, 10, 20, 50, 100]}
                      ariaLabel={`Itens por página: ${itemsPerPage}`}
                      minWidth="80px"
                    />
                  </div>
                  <div className="w-px bg-border self-stretch flex-shrink-0" />
                </>
              )}
              <Button
                variant="outline"
                onClick={() => setIsFilterSidebarOpen(true)}
                className="flex items-center gap-2 flex-1 min-w-0"
              >
                <SlidersHorizontal className="h-4 w-4 flex-shrink-0" />
                <span className="text-sm">{t('torrents.filters.title')}</span>
                {(selectedAgentIds.size < agents.length ||
                  selectedStatuses.size < availableStatuses.length ||
                  selectedCategories.size < availableCategories.length ||
                  selectedTags.size < availableTags.length ||
                  selectedGrades.size < availableGrades.length) && (
                    <span className="ml-auto h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                  )}
              </Button>
            </div>
          </div>

        </div>
      )}

      {/* Estado vazio - sem agentes */}
      {!agentsLoading && agents.length === 0 && !loading && (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Server className="h-8 w-8 text-muted-foreground" />
            </EmptyMedia>
            <EmptyTitle>{t('torrents.noAgents')}</EmptyTitle>
            <EmptyDescription>
              {t('torrents.noAgentsDesc')}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={() => navigate('/agents')}>
              <Plus className="h-4 w-4 mr-2" />
              {t('torrents.addFirstAgent')}
            </Button>
          </EmptyContent>
        </Empty>
      )}

      {/* Estado vazio - todos os agentes com erro */}
      {!agentsLoading && agents.length > 0 && agents.every(agent => agent.status === 'ERRORED') && !loading && (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </EmptyMedia>
            <EmptyTitle>{t('torrents.agentError')}</EmptyTitle>
            <EmptyDescription>
              {t('torrents.agentErrorDesc')}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={() => navigate('/agents')}>
              <AlertTriangle className="h-4 w-4 mr-2" />
              {t('torrents.fixAgent')}
            </Button>
          </EmptyContent>
        </Empty>
      )}

      {/* Estado vazio - com agentes funcionais mas sem torrents */}
      {!agentsLoading && agents.length > 0 && agents.some(agent => agent.status !== 'ERRORED') && torrents.length === 0 && !loading && (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Download className="h-8 w-8 text-muted-foreground" />
            </EmptyMedia>
            <EmptyTitle>{t('torrents.noTorrentsWithAgents')}</EmptyTitle>
            <EmptyDescription>
              {t('torrents.noTorrentsWithAgentsDesc')}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={() => setIsAddModalOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              {t('torrents.addTorrent')}
            </Button>
          </EmptyContent>
        </Empty>
      )}

      {/* Conteúdo principal - apenas quando há agentes funcionais e torrents */}
      {!agentsLoading && agents.length > 0 && agents.some(agent => agent.status !== 'ERRORED') && torrents.length > 0 && (
        <>
          {/* Layout para desktop - Tabela ou Cards baseado na preferência */}
          <div className="hidden md:block w-full">
            {displayMode === "default" ? (
              <TorrentsTable
                torrents={paginatedTorrents}
                sortType={sortType}
                sortDirection={sortDirection}
                onSortChange={handleSortChange}
                onShowDetails={handleShowDetails}
                currentPage={currentPage}
                totalPages={totalPages}
                filteredTorrentsLength={filteredTorrents.length}
                onPreviousPage={() => currentPage > 1 ? setCurrentPage(currentPage - 1) : undefined}
                onNextPage={() => currentPage < totalPages ? setCurrentPage(currentPage + 1) : undefined}
                onStart={handlePlayTorrent}
                onStop={handlePauseTorrent}
                onRemove={(id) => handleDeleteTorrent(id, false)}
                onForceDownload={handleForceDownloadTorrent}
                onForceReannounce={handleForceReannounceTorrent}
                onForceRecheck={handleForceRecheckTorrent}
                onMetrics={handleShowMetrics}
                onLimits={handleShowLimits}
                onMetadataUpdate={handleMetadataUpdate}
                compact={compact}
                selectionMode={selectionMode}
                selectedIds={selectedIds}
                onToggleSelect={handleToggleSelect}
                onRequestDelete={openDeleteModal}
              />
            ) : (
              // Card view for desktop
              <>
                {/* Desktop sorting controls for card view */}
                <div className="mb-4">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-muted-foreground">{t('torrents.sortedBy')}:</span>
                      <span className="text-sm text-muted-foreground">
                        {t(`torrents.sortBy.${getSortTypeKey(sortType)}`)} {sortDirection === "asc" ? "↑" : "↓"}
                      </span>
                    </div>
                    <span className="text-sm text-muted-foreground whitespace-nowrap">
                      {filteredTorrents.length} {t('torrents.of')} {torrents.length}
                    </span>
                  </div>
                </div>

                <TorrentListMobile
                  torrents={paginatedTorrents}
                  onShowDetails={handleShowDetails}
                  onStart={handlePlayTorrent}
                  onStop={handlePauseTorrent}
                  onMetrics={handleShowMetrics}
                  onRemove={(id) => handleDeleteTorrent(id, false)}
                  onForceDownload={handleForceDownloadTorrent}
                  onForceReannounce={handleForceReannounceTorrent}
                  onForceRecheck={handleForceRecheckTorrent}
                  onLimits={handleShowLimits}
                  onMetadataUpdate={handleMetadataUpdate}
                  compact={compact}
                  selectionMode={selectionMode}
                  selectedIds={selectedIds}
                  onToggleSelect={handleToggleSelect}
                  onRequestDelete={openDeleteModal}
                />

                {/* Lazy loading sentinel for card view */}
                {useCardLazyLoading && displayedItemsCount < filteredTorrents.length && (
                  <div ref={sentinelRef} className="flex items-center justify-center py-4">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                )}
              </>
            )}
          </div>

          {/* Layout para mobile - Cards em coluna única */}
          <div className="md:hidden w-full">
            {/* Mobile sorting controls */}
            <div className="mb-4">
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-muted-foreground">{t('torrents.sortedBy')}:</span>
                  <span className="text-xs text-muted-foreground">
                    {t(`torrents.sortBy.${getSortTypeKey(sortType)}`)} {sortDirection === "asc" ? "↑" : "↓"}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {filteredTorrents.length} {t('torrents.of')} {torrents.length}
                </span>
              </div>
            </div>

            <TorrentListMobile
              torrents={paginatedTorrents}
              onShowDetails={handleShowDetails}
              onStart={handlePlayTorrent}
              onStop={handlePauseTorrent}
              onMetrics={handleShowMetrics}
              onRemove={(id) => handleDeleteTorrent(id, false)}
              onForceDownload={handleForceDownloadTorrent}
              onForceReannounce={handleForceReannounceTorrent}
              onForceRecheck={handleForceRecheckTorrent}
              onLimits={handleShowLimits}
              onMetadataUpdate={handleMetadataUpdate}
              compact={compact}
              selectionMode={selectionMode}
              selectedIds={selectedIds}
              onToggleSelect={handleToggleSelect}
              onRequestDelete={openDeleteModal}
            />

            {/* Lazy loading sentinel for mobile */}
            {displayedItemsCount < filteredTorrents.length && (
              <div ref={mobileSentinelRef} className="flex items-center justify-center py-4">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
        </>
      )}

      {/* Modal de detalhes do torrent - só renderiza quando aberto */}
      {isModalOpen && selectedTorrent && (
        <TorrentDetailsModal
          torrent={selectedTorrent}
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          onPlay={handlePlayTorrent}
          onPause={handlePauseTorrent}
          onDelete={handleDeleteTorrent}
          onForceDownload={handleForceDownloadTorrent}
          onForceReannounce={handleForceReannounceTorrent}
          onForceRecheck={handleForceRecheckTorrent}
          onRename={handleRenameTorrent}
          onSetLocation={handleSetLocationTorrent}
        />
      )}

      {/* Modal de adicionar torrent - só renderiza quando aberto */}
      {isAddModalOpen && (
        <AddTorrentModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          onSubmit={handleCreateTorrent}
          agents={agents}
        />
      )}

      {/* Modal de métricas do torrent - só renderiza quando aberto */}
      {isMetricsModalOpen && metricsTaskId && (
        <TorrentMetricsModal
          isOpen={isMetricsModalOpen}
          onClose={handleCloseMetricsModal}
          taskId={metricsTaskId}
          agentId={metricsAgentId}
          taskName={metricsTaskName}
          selectedCount={metricsSelectedCount}
          taskIds={metricsTaskIds}
        />
      )}

      {/* Modal de limites do torrent - só renderiza quando aberto */}
      {isLimitsModalOpen && limitsAgentId && limitsTaskIds.length > 0 && (
        <TorrentLimitModal
          isOpen={isLimitsModalOpen}
          onClose={handleCloseLimitsModal}
          agentId={limitsAgentId}
          taskIds={limitsTaskIds}
          taskName={limitsTaskName}
          taskStatus={limitsTaskStatus}
        />
      )}

      {/* Modal de deleção (single/bulk) */}
      {isDeleteModalOpen && (
        <TorrentDeleteModal
          isOpen={isDeleteModalOpen}
          mode={deleteMode}
          torrentName={deleteSingleName}
          selectedCount={deleteMode === 'bulk' ? deleteIds.length : undefined}
          onClose={() => setIsDeleteModalOpen(false)}
          onConfirm={handleConfirmDelete}
        />
      )}

      {/* Floating selection counter - shows when selection mode is active */}
      {selectionMode && (
        <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-5 duration-300">
          <div className="bg-primary text-primary-foreground border border-primary/20 rounded-full px-5 py-2.5 shadow-lg flex items-center gap-3">
            <CheckSquare className="h-4 w-4" />
            <span className="text-sm font-medium">
              <span className="font-semibold">{selectedIds.size}</span>
              <span className="opacity-90"> selected</span>
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 rounded-full hover:bg-primary-foreground/20 ml-1"
              onClick={handleToggleSelectAll}
              aria-label="Desativar seleção múltipla"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Filter Sidebar - só renderiza quando aberto */}
      {isFilterSidebarOpen && (
        <FilterSidebar
          isOpen={isFilterSidebarOpen}
          onClose={() => setIsFilterSidebarOpen(false)}
          title={t('torrents.filters.title')}
        >
          <div className="space-y-6">
            {/* Busca - apenas mobile */}
            <div className="sm:hidden">
              <div className="relative w-full bg-primary/10 rounded-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder={t('torrents.search')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && filteredTorrents.length > 0) {
                      setIsFilterSidebarOpen(false);
                    }
                  }}
                  className="pl-10 bg-transparent border-0 focus:ring-0 focus:ring-offset-0"
                />
              </div>
            </div>


            {/* Filtro de agentes */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Server className="w-4 h-4 text-muted-foreground" />
                {t('torrents.filters.agents')}
                {selectedAgentIds.size > 0 && selectedAgentIds.size < agents.length && (
                  <div className="w-2 h-2 rounded-full bg-primary" />
                )}
              </label>
              <AgentFilter
                agents={agents}
                selectedAgentIds={selectedAgentIds}
                onToggleAgent={toggleAgent}
                onSetAll={setAllAgents}
              />
            </div>

            {/* Filtro de status */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Activity className="w-4 h-4 text-muted-foreground" />
                {t('torrents.filters.status')}
                {selectedStatuses.size > 0 && selectedStatuses.size < availableStatuses.length && (
                  <div className="w-2 h-2 rounded-full bg-primary" />
                )}
              </label>
              <StatusFilter
                availableStatuses={availableStatuses}
                selectedStatuses={selectedStatuses}
                onToggleStatus={toggleStatus}
                onSetAll={setAllStatuses}
                getStatusIcon={getStatusIcon}
                getStatusColor={getStatusColor}
              />
            </div>

            {/* Filtro de categorias */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Folder className="w-4 h-4 text-muted-foreground" />
                {t('torrents.filters.categories')}
                {selectedCategories.size > 0 && selectedCategories.size < availableCategories.length && (
                  <div className="w-2 h-2 rounded-full bg-primary" />
                )}
              </label>
              <ListFilter
                label="categorias"
                availableItems={availableCategories}
                selectedItems={selectedCategories}
                onToggleItem={toggleCategory}
                onSetAll={setAllCategories}
              />
            </div>

            {/* Filtro de tags */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Tag className="w-4 h-4 text-muted-foreground" />
                {t('torrents.filters.tags')}
                {selectedTags.size > 0 && selectedTags.size < availableTags.length && (
                  <div className="w-2 h-2 rounded-full bg-primary" />
                )}
              </label>
              <ListFilter
                label="tags"
                availableItems={availableTags}
                selectedItems={selectedTags}
                onToggleItem={toggleTag}
                onSetAll={setAllTags}
                useTagBadge={true}
              />
            </div>

            {/* Filtro de ratio grades */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Star className="w-4 h-4 text-muted-foreground" />
                {t('torrents.filters.ratioGrades', 'Ratio grades')}
                {selectedGrades.size > 0 && selectedGrades.size < availableGrades.length && (
                  <div className="w-2 h-2 rounded-full bg-primary" />
                )}
              </label>
              {/* Grade badges selector */}
              <div className="flex flex-wrap gap-2">
                {availableGrades.map((grade) => {
                  const selected = selectedGrades.has(grade);
                  const gradeToSampleRatio: Record<string, number> = {
                    "S++": 100,
                    "S+": 50,
                    "S": 30,
                    "A": 15,
                    "B": 7,
                    "C": 3,
                    "D": 1,
                    "E": 0,
                  };
                  return (
                    <button
                      key={grade}
                      type="button"
                      onClick={() => toggleGrade(grade)}
                      className={`inline-flex items-center gap-2 rounded-md border px-2 py-1 transition-colors ${selected ? 'bg-accent text-accent-foreground border-border' : 'hover:bg-accent hover:text-accent-foreground border-border'}`}
                      aria-pressed={selected}
                      title={grade}
                    >
                      <RatioBadge ratio={gradeToSampleRatio[grade] ?? 0} showValue={false} />
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Button size="sm" variant="outline" onClick={() => setAllGrades(true)} className="h-7 px-2">
                  {t('common.selectAll', 'Select all')}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setAllGrades(false)} className="h-7 px-2">
                  {t('common.clearAll', 'Clear all')}
                </Button>
              </div>
            </div>

            {/* Separador */}
            <Separator />

            {/* Controles de ordenação */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <SortAsc className="w-4 h-4 text-muted-foreground" />
                {t('torrents.filters.sorting')}
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { type: "priority", label: "priority" },
                  { type: "alphabetical", label: "name" },
                  { type: "size", label: "size" },
                  { type: "progress", label: "progress" },
                  { type: "download_speed", label: "download" },
                  { type: "upload_speed", label: "upload" },
                  { type: "downloaded", label: "downloaded" },
                  { type: "uploaded", label: "uploaded" },
                ].map((option) => (
                  <Button
                    key={option.type}
                    variant={sortType === option.type ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleSortChange(option.type as SortType)}
                    className="text-xs flex items-center gap-1"
                  >
                    {t(`torrents.sortButtons.${option.label}`)}
                    {sortType === option.type && (
                      sortDirection === "asc" ? (
                        <SortAsc className="h-3 w-3" />
                      ) : (
                        <SortDesc className="h-3 w-3" />
                      )
                    )}
                  </Button>
                ))}
              </div>
            </div>

            {/* Informação de resultados */}
            <div className="pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                {filteredTorrents.length} {t('torrents.of')} {torrents.length} {t('torrents.torrents')}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {t('torrents.sortedBy')} {t(`torrents.sortBy.${getSortTypeKey(sortType)}`)} {sortDirection === "asc" ? "↑" : "↓"}
              </div>
            </div>
          </div>
        </FilterSidebar>
      )}
    </div>
  );
}


