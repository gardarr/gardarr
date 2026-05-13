
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { LoadingBar } from "@/components/ui/LoadingBar";
import { ChevronDown, SortAsc, SortDesc, Plus, Download, Server, Activity, Folder, Tag, FileUp, AlertTriangle, Star, X, Search, CheckSquare } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { torrentService } from "./services/torrents";
import { workerService } from "./services/workers";
import { categoryService } from "./services/categories";
import { preferencesService } from "@/services/preferences";
import {
  getStatusColor,
  getStatusIcon,
  TorrentControls,
  TorrentDeleteModal,
  TorrentDetailsModal,
  TorrentLimitModal,
  TorrentListCompact,
  TorrentListMobile,
  TorrentSortingHeader,
  TorrentsTable,
  useTorrentFilters,
  type SortType,
  type TorrentListItem,
  type TorrentStatus,
} from "@/components/torrents";
import type { CreateTorrentSubmission } from "./services/torrents";
import type { Task } from "./types/torrent";
import type { Worker } from "./types/worker";
import type { Category } from "./types/category";
import WorkerFilter from "@/components/ui/WorkerFilter";
import StatusFilter from "@/components/ui/StatusFilter";
import CategoryFilter from "@/components/ui/CategoryFilter";
import { ListFilter } from "@/components/ui/ListFilter";
import { FilterSidebar } from "@/components/ui/FilterSidebar";
import { useFilterControls } from "@/hooks/useFilterControls";
import { AddTorrentModal } from "@/components/AddTorrentModal";
import { TaskMetadataSearchSheet } from "@/components/TaskMetadataSearchSheet";
import { RatioBadge } from "@/components/RatioBadge";
import { LazyLoadingSentinel } from "@/components/LazyLoadingSentinel";
import { toast } from "sonner";
import { normalizeTaskStatus } from "@/utils/statusUtils";
import { getRatioGrade } from "@/utils/ratioUtils";


// Helper function to convert sort type to translation key
const getSortTypeKey = (type: string): string => {
  switch (type) {
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
};

type Torrent = TorrentListItem;

const canCategorySearchMetadata = (categoryName: string, categories: Category[]): boolean => {
  if (!categoryName) {
    return false;
  }

  const category = categories.find((item) => item.name === categoryName);
  return Boolean(category && category.metadata_source !== "none");
};

// Função para mapear Task (backend) para Torrent (frontend)
function mapTaskToTorrent(task: Task, categories: Category[]): Torrent {
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
    workerName: task.worker?.name,
    workerStatus: task.worker?.status,
    workerUUID: task.worker?.uuid,
    workerIcon: task.worker?.icon,
    workerColor: task.worker?.color,
    category: task.category || "",
    canSearchMetadata: canCategorySearchMetadata(task.category || "", categories),
    tags: task.tags || [],
    metadata: task.metadata,
  };
}

// Desktop table moved to components/TorrentsTable

export default function TorrentsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [torrents, setTorrents] = useState<Torrent[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortType, setSortType] = useState<SortType>("priority");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [workersLoading, setWorkersLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedWorkerIds, setSelectedWorkerIds] = useState<Set<string>>(new Set());
  const [selectedStatuses, setSelectedStatuses] = useState<Set<TorrentStatus>>(new Set());
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [selectedGrades, setSelectedGrades] = useState<Set<string>>(new Set());
  const [refreshIntervalSec, setRefreshIntervalSec] = useState<number>(5);
  const [isRefreshPaused, setIsRefreshPaused] = useState(false);
  const [selectedTorrent, setSelectedTorrent] = useState<Task | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [originalTasks, setOriginalTasks] = useState<Task[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isLimitsModalOpen, setIsLimitsModalOpen] = useState(false);
  const [limitsTaskIds, setLimitsTaskIds] = useState<string[]>([]);
  const [limitsWorkerId, setLimitsWorkerId] = useState<string>("");
  const [limitsTaskName, setLimitsTaskName] = useState<string>("");
  const [limitsTaskStatus, setLimitsTaskStatus] = useState<string>("");
  const [isFilterSidebarOpen, setIsFilterSidebarOpen] = useState(false);
  const [isAddDropdownOpen, setIsAddDropdownOpen] = useState(false);
  const [compact, setCompact] = useState(false);
  const [displayMode, setDisplayMode] = useState<"table" | "card" | "list">("card");
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastNonEmptyTorrents, setLastNonEmptyTorrents] = useState<Torrent[]>([]);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteIds, setDeleteIds] = useState<string[]>([]);
  const [deleteMode, setDeleteMode] = useState<"single" | "bulk">("single");
  const [deleteSingleName, setDeleteSingleName] = useState<string>("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [metadataSearchTask, setMetadataSearchTask] = useState<Task | null>(null);
  const [isMetadataSearchOpen, setIsMetadataSearchOpen] = useState(false);

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

  // Extrair tags únicas disponíveis (normalizadas e deduplicadas)
  const availableTags = useMemo(() => {
    const tags = new Set<string>();
    torrents.forEach(t => {
      t.tags?.forEach(tag => {
        const trimmed = tag?.trim();
        if (trimmed) tags.add(trimmed);
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

  // Filter controls using custom hook
  const workerControls = useFilterControls(selectedWorkerIds, setSelectedWorkerIds, workers.map(a => a.uuid));
  const statusControls = useFilterControls(selectedStatuses, setSelectedStatuses, availableStatuses);
  const categoryControls = useFilterControls(selectedCategories, setSelectedCategories, availableCategories);
  const tagControls = useFilterControls(selectedTags, setSelectedTags, availableTags);
  const gradeControls = useFilterControls(selectedGrades, setSelectedGrades, availableGrades);
  const mapTasksToTorrents = useCallback((tasks: Task[]) => {
    return tasks.map((task) => mapTaskToTorrent(task, categories));
  }, [categories]);

  // Carregar torrents da API
  const loadTorrents = useCallback(async () => {
    try {
      // Verificar se há pelo menos um worker funcional (não erro) antes de tentar carregar tasks
      const functionalWorkers = workers.filter(worker => worker.status !== 'ERRORED');
      if (functionalWorkers.length === 0) {
        // Se não há workers funcionais, limpar tasks e marcar como completo
        setOriginalTasks([]);
        setTorrents([]);
        setInitialLoadComplete(true);
        return;
      }

      // Carregar tasks apenas dos workers funcionais
      const allTasks: Task[] = [];
      const errors: Record<string, string> = {};

      // Buscar tasks de cada worker funcional individualmente
      await Promise.allSettled(
        functionalWorkers.map(async (worker) => {
          try {
            const response = await torrentService.listWorkerTasks(worker.uuid);
            if (response?.data) {
              // Adicionar informações do worker a cada task
              const tasksWithWorker = response.data.map(task => ({
                ...task,
                worker: worker
              }));
              allTasks.push(...tasksWithWorker);
            } else if (response?.error) {
              errors[worker.uuid] = response.error;
            }
          } catch (err) {
            errors[worker.uuid] = err instanceof Error ? err.message : 'Unknown error';
          }
        })
      );

      // Mostrar erros se houver
      if (Object.keys(errors).length > 0) {
        const errorMessages = Object.entries(errors).map(([workerId, error]) => {
          const worker = workers.find(a => a.uuid === workerId);
          return `Worker ${worker?.name || workerId}: ${error}`;
        });

        console.warn('Some workers failed to load tasks:', errorMessages);
        toast.warning(t('torrents.notifications.someWorkersFailed'), {
          description: errorMessages.join('\n'),
          duration: 5000,
        });
      }

      setOriginalTasks(allTasks);
      const mappedTorrents = mapTasksToTorrents(allTasks);
      setTorrents(mappedTorrents);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('torrents.error'));
    } finally {
      setInitialLoadComplete(true);
    }
  }, [mapTasksToTorrents, t, workers]);

  // Atualização silenciosa para não afetar UI (sem spinner)
  const refreshTorrentsSilently = useCallback(async (): Promise<Task[]> => {
    try {
      // Verificar se há pelo menos um worker funcional (não erro) antes de tentar carregar tasks
      const functionalWorkers = workers.filter(worker => worker.status !== 'ERRORED');
      if (functionalWorkers.length === 0) {
        // Se não há workers funcionais, limpar tasks e retornar
        setOriginalTasks([]);
        setTorrents([]);
        return [];
      }

      // Buscar tasks de cada worker funcional individualmente
      const allTasks: Task[] = [];

      await Promise.allSettled(
        functionalWorkers.map(async (worker) => {
          try {
            const response = await torrentService.listWorkerTasks(worker.uuid);
            if (response?.data) {
              const tasksWithWorker = response.data.map(task => ({
                ...task,
                worker: worker
              }));
              allTasks.push(...tasksWithWorker);
            }
          } catch {
            // silencioso - ignorar erros individuais de workers
          }
        })
      );

      setOriginalTasks(allTasks);
      const mappedTorrents = mapTasksToTorrents(allTasks);
      setTorrents(mappedTorrents);
      return allTasks;
    } catch {
      // silencioso
      return [];
    }
  }, [mapTasksToTorrents, workers]);

  // Carregar workers da API
  const loadWorkers = useCallback(async () => {
    try {
      setWorkersLoading(true);
      const response = await workerService.listWorkers();
      if (response.error) {
        setWorkers([]);
        return;
      }
      if (response.data) {
        setWorkers(response.data);
      } else {
        setWorkers([]);
      }
    } catch {
      // silencioso; filtro de workers é opcional
      setWorkers([]);
    } finally {
      setWorkersLoading(false);
    }
  }, []);

  // Carregar categorias da API
  const loadCategories = useCallback(async () => {
    try {
      const response = await categoryService.listCategories();
      if (response.data) {
        setCategories(response.data);
      } else {
        setCategories([]);
      }
    } catch {
      // silencioso; filtro de categorias é opcional
      setCategories([]);
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
        if (t?.workerUUID) {
          await torrentService.deleteTask(t.workerUUID, id, purge);
        }
      }));

      // Recarregar lista
      await loadTorrents();

      // Exibir mensagem de sucesso
      const message = isBulk
        ? t('torrents.notifications.deleteBulkSuccess', { count: ids.length })
        : t('torrents.notifications.deleteSuccess');
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
      toast.error(t('torrents.notifications.deleteBulkError'), {
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

  const handleOpenMetadataSearch = (taskId: string) => {
    const task = originalTasks.find((item) => item.id === taskId);
    if (!task) {
      return;
    }

    setMetadataSearchTask(task);
    setIsMetadataSearchOpen(true);
  };

  const handleCloseMetadataSearch = () => {
    setIsMetadataSearchOpen(false);
    setMetadataSearchTask(null);
  };

  const handleShowLimits = (taskId: string, workerId?: string) => {
    const task = originalTasks.find(t => t.id === taskId);

    // Se está em modo de seleção e há múltiplos torrents selecionados, usar a seleção
    const isBulkEdit = selectionMode && selectedIds.size > 1;
    const taskIds = isBulkEdit ? Array.from(selectedIds) : [taskId];

    setLimitsTaskIds(taskIds);
    setLimitsWorkerId(workerId || "");
    setLimitsTaskName(task?.name || "");
    setLimitsTaskStatus(task?.state || "");
    setIsLimitsModalOpen(true);
  };

  // Fechar modal de limites
  const handleCloseLimitsModal = () => {
    setIsLimitsModalOpen(false);
    setLimitsTaskIds([]);
    setLimitsWorkerId("");
    setLimitsTaskName("");
    setLimitsTaskStatus("");
  };

  // Handler para atualização de metadados
  const handleMetadataUpdate = useCallback(async () => {
    // Recarregar torrents silenciosamente para obter metadados atualizados
    const updatedTasks = await refreshTorrentsSilently();

    // Atualizar o torrent selecionado no modal se houver um aberto
    setSelectedTorrent(prev => {
      if (prev && updatedTasks.length > 0) {
        const updatedTask = updatedTasks.find(t => t.id === prev.id);
        return updatedTask || prev;
      }
      return prev;
    });
  }, [refreshTorrentsSilently]);

  // Controles de torrent
  const handleGenericTorrentAction = async (
    torrentId: string,
    actionName: string,
    actionFn: (workerId: string, taskId: string) => Promise<{ error?: string }>,
    successMessage: string
  ) => {
    try {
      const task = originalTasks.find(t => t.id === torrentId);
      if (!task || !task.worker?.uuid) {
        toast.error(t('torrents.notifications.workerIdNotFound'));
        return;
      }

      const response = await actionFn(task.worker.uuid, torrentId);
      if (response.error) {
        toast.error(response.error);
        return;
      }

      toast.success(successMessage);

      // Recarregar dados de todos os workers sem fechar o modal
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
      t('torrents.actionButtons.play'),
      torrentService.resumeTask,
      t('torrents.notifications.resumeSuccess')
    );

  const handlePauseTorrent = (torrentId: string) =>
    handleGenericTorrentAction(
      torrentId,
      t('torrents.actionButtons.pause'),
      torrentService.pauseTask,
      t('torrents.notifications.pauseSuccess')
    );

  const handleForceDownloadTorrent = (torrentId: string) =>
    handleGenericTorrentAction(
      torrentId,
      t('torrents.forceDownload'),
      torrentService.forceDownloadTask,
      t('torrents.notifications.forceDownloadSuccess')
    );

  const handleForceReannounceTorrent = (torrentId: string) =>
    handleGenericTorrentAction(
      torrentId,
      t('torrents.forceReannounce'),
      torrentService.forceReannounceTask,
      t('torrents.notifications.forceReannounceSuccess')
    );

  const handleForceRecheckTorrent = (torrentId: string) =>
    handleGenericTorrentAction(
      torrentId,
      t('torrents.forceRecheck'),
      torrentService.forceRecheckTask,
      t('torrents.notifications.forceRecheckSuccess')
    );


  const handleSetLocationTorrent = async (torrentId: string, location: string) => {
    try {
      const task = originalTasks.find(t => t.id === torrentId);
      if (!task || !task.worker?.uuid) {
        toast.error(t('torrents.notifications.workerIdNotFound'));
        return;
      }

      const response = await torrentService.setTaskLocation(task.worker.uuid, torrentId, location);
      if (response.error) {
        toast.error(response.error);
        return;
      }

      toast.success(t('torrents.notifications.pathChangeSuccess'));

      // Recarregar dados de todos os workers sem fechar o modal
      const updatedTasks = await refreshTorrentsSilently();

      // Atualizar o torrent selecionado para refletir mudanças
      const updatedTask = updatedTasks.find(t => t.id === torrentId);
      if (updatedTask) {
        setSelectedTorrent(updatedTask);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('torrents.notifications.pathChangeError'));
    }
  };

  const handleDeleteTorrent = async (torrentId: string, purge: boolean = false) => {
    try {
      const task = originalTasks.find(t => t.id === torrentId);
      if (!task || !task.worker?.uuid) {
        toast.error(t('torrents.notifications.workerIdNotFound'));
        return;
      }

      const response = await torrentService.deleteTask(task.worker.uuid, torrentId, purge);

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
  const handleCreateTorrent = async ({ workerId, taskData }: CreateTorrentSubmission): Promise<Task> => {
    try {
      const response = await torrentService.createTask(workerId, taskData);

      if (response.error) {
        throw new Error(response.error);
      }

      const createdTask = response.data;
      const taskHash = createdTask?.hash;

      if (!taskHash) {
        throw new Error(t('torrents.addModal.errors.taskHashMissing'));
      }

      return createdTask;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : t('torrents.error');
      toast.error(t('torrents.notifications.addError', { error: errorMessage }));
      throw err instanceof Error ? err : new Error(errorMessage);
    }
  };

  const handleFinalizeTorrent = async (task: Task) => {
    void task;
    try {
      await loadTorrents();
      setIsAddModalOpen(false);
      toast.success(t('torrents.notifications.addSuccess'));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : t('torrents.error');
      toast.error(t('torrents.notifications.addError', { error: errorMessage }));
      throw err instanceof Error ? err : new Error(errorMessage);
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
    loadWorkers();
    loadCategories();
  }, [loadWorkers, loadCategories]);

  // Cache da última lista não vazia para evitar flicker quando em seleção múltipla
  useEffect(() => {
    if (torrents.length > 0) {
      setLastNonEmptyTorrents(torrents);
    }
  }, [torrents]);

  useEffect(() => {
    setTorrents(mapTasksToTorrents(originalTasks));
  }, [mapTasksToTorrents, originalTasks]);

  // Carregar torrents quando workers mudarem (para detectar mudanças de status)
  useEffect(() => {
    if (!workersLoading) {
      loadTorrents();
    }
  }, [workers, loadTorrents, workersLoading]);

  // Intervalo de atualização automática com debounce e otimização de visibilidade
  useEffect(() => {
    // Skip if paused or interval is 0
    if (isRefreshPaused || refreshIntervalSec <= 0) return;

    // Don't start auto-refresh until workers have been loaded
    if (workersLoading) return;

    // Pause refresh if there are no functional workers
    const hasFunctionalWorkers = workers.some(worker => worker.status !== 'ERRORED');
    if (!hasFunctionalWorkers) return;

    let timeoutId: NodeJS.Timeout;
    let isPageVisible = !document.hidden;
    let isActive = true;

    // Pause auto refresh when page is not visible
    const handleVisibilityChange = () => {
      isPageVisible = !document.hidden;
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    const scheduleNext = () => {
      if (!isActive) return;
      timeoutId = setTimeout(async () => {
        if (!isActive) return;
        if (isPageVisible) {
          await refreshTorrentsSilently();
        }
        scheduleNext();
      }, refreshIntervalSec * 1000);
    };

    scheduleNext();

    return () => {
      isActive = false;
      clearTimeout(timeoutId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [refreshIntervalSec, refreshTorrentsSilently, workersLoading, workers, isRefreshPaused]);

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
    workers,
    selectedWorkerIds,
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
  const useCardLazyLoading = displayMode === "card" || displayMode === "list";

  // Para card/list view (desktop) e mobile: usar lazy loading
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
        if (target.isIntersecting) {
          setDisplayedItemsCount(prev => prev + ITEMS_PER_LOAD);
        }
      },
      { threshold: 0.1, rootMargin: '200px' }
    );

    observer.observe(sentinelRef.current);

    return () => observer.disconnect();
  }, [useCardLazyLoading]);

  // Intersection Observer para lazy loading (mobile)
  useEffect(() => {
    if (!isMobile || !mobileSentinelRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const target = entries[0];
        if (target.isIntersecting) {
          setDisplayedItemsCount(prev => prev + ITEMS_PER_LOAD);
        }
      },
      { threshold: 0.1, rootMargin: '200px' }
    );

    observer.observe(mobileSentinelRef.current);

    return () => observer.disconnect();
  }, [isMobile]);

  // Função para lidar com mudança de itens por página
  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
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


  // Determinar se está em loading inicial
  const isInitialLoading = !initialLoadComplete || workersLoading;

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
        {/* Controles de adicionar - sempre mostrar, mas desabilitar durante loading */}
        {(isInitialLoading || (workers.length > 0 && workers.some(worker => worker.status !== 'ERRORED'))) && (
          <div className="relative" ref={addDropdownRef}>
            <div className="flex">
              <Button
                onClick={() => setIsAddModalOpen(true)}
                disabled={isInitialLoading || workers.length === 0}
                className="rounded-r-none border-r-0"
              >
                <Plus className="h-4 w-4 mr-2" />
                {t('torrents.addTorrent')}
              </Button>
              <Button
                onClick={() => setIsAddDropdownOpen(!isAddDropdownOpen)}
                disabled={isInitialLoading || workers.length === 0}
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
                aria-label={t('torrents.addTorrent')}
              >
                <button
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground cursor-not-allowed opacity-50"
                  onClick={(e) => e.preventDefault()}
                  role="option"
                  disabled
                  aria-disabled="true"
                >
                  <FileUp className="h-4 w-4" />
                  {t('torrents.addFile')}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Aviso de erro nos workers - mostrar se houver workers com erro (mesmo durante loading) - apenas desktop */}
      {!workersLoading && workers.length > 0 && workers.some(worker => worker.status === 'ERRORED') && (
        <div className="hidden sm:block bg-destructive/10 border border-destructive/20 rounded-lg p-4 mb-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0" />
            <div className="flex-1">
              <h3 className="text-sm font-medium text-destructive">
                {t('torrents.workerErrorWarning.title')}
              </h3>
              <p className="text-sm text-destructive/80 mt-1">
                {t('torrents.workerErrorWarning.description')}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/workers')}
              className="flex-shrink-0 border-destructive/20 text-destructive hover:bg-destructive/10"
            >
              <AlertTriangle className="h-4 w-4 mr-2" />
              {t('torrents.workerErrorWarning.fixWorkers')}
            </Button>
          </div>
        </div>
      )}

      {/* Filtro de busca e controles - sempre exibir, desabilitar durante loading */}
      {(isInitialLoading || (workers.length > 0 && workers.some(worker => worker.status !== 'ERRORED'))) && (
        <div className="flex flex-col gap-4 w-full sm:gap-4 gap-0">
          {/* Desktop controls */}
          <div className="hidden sm:block">
            <TorrentControls
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              selectionMode={selectionMode}
              allSelected={allSelected}
              onToggleSelectAll={handleToggleSelectAll}
              refreshIntervalSec={refreshIntervalSec}
              isRefreshPaused={isRefreshPaused}
              onRefreshIntervalChange={(v) => {
                if (v === 0) {
                  setIsRefreshPaused(true);
                } else {
                  setIsRefreshPaused(false);
                  setRefreshIntervalSec(v);
                }
              }}
              itemsPerPage={itemsPerPage}
              onItemsPerPageChange={handleItemsPerPageChange}
              showItemsPerPage={displayMode === "table"}
              onOpenFilters={() => setIsFilterSidebarOpen(true)}
              hasActiveFilters={
                selectedWorkerIds.size > 0 ||
                selectedStatuses.size > 0 ||
                selectedCategories.size > 0 ||
                selectedTags.size > 0 ||
                selectedGrades.size > 0
              }
              filteredCount={filteredTorrents.length}
              totalCount={torrents.length}
              sortType={sortType}
              sortDirection={sortDirection}
              isLoading={isInitialLoading}
            />
          </div>

          {/* Aviso de erro nos workers - mobile (mostrar mesmo durante loading) */}
          {!workersLoading && workers.some(worker => worker.status === 'ERRORED') && (
            <div className="sm:hidden mb-4">
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xs font-medium text-destructive">
                      {t('torrents.workerErrorWarning.title')}
                    </h3>
                    <p className="text-xs text-destructive/80 mt-1">
                      {t('torrents.workerErrorWarning.descriptionShort')}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate('/workers')}
                    className="flex-shrink-0 border-destructive/20 text-destructive hover:bg-destructive/10 h-7 px-2 text-xs"
                  >
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    {t('torrents.workerErrorWarning.fix')}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Mobile controls */}
          <div className="sm:hidden mb-1">
            <TorrentControls
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              selectionMode={selectionMode}
              allSelected={allSelected}
              onToggleSelectAll={handleToggleSelectAll}
              refreshIntervalSec={refreshIntervalSec}
              isRefreshPaused={isRefreshPaused}
              onRefreshIntervalChange={(v) => {
                if (v === 0) {
                  setIsRefreshPaused(true);
                } else {
                  setIsRefreshPaused(false);
                  setRefreshIntervalSec(v);
                }
              }}
              itemsPerPage={itemsPerPage}
              onItemsPerPageChange={handleItemsPerPageChange}
              showItemsPerPage={displayMode === "table"}
              onOpenFilters={() => setIsFilterSidebarOpen(true)}
              hasActiveFilters={
                selectedWorkerIds.size > 0 ||
                selectedStatuses.size > 0 ||
                selectedCategories.size > 0 ||
                selectedTags.size > 0 ||
                selectedGrades.size > 0
              }
              filteredCount={filteredTorrents.length}
              totalCount={torrents.length}
              sortType={sortType}
              sortDirection={sortDirection}
              isLoading={isInitialLoading}
              isMobile={true}
            />
          </div>

        </div>
      )}

      {/* Estado vazio - sem workers */}
      {!isInitialLoading && workers.length === 0 && (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Server className="h-8 w-8 text-muted-foreground" />
            </EmptyMedia>
            <EmptyTitle>{t('torrents.noWorkers')}</EmptyTitle>
            <EmptyDescription>
              {t('torrents.noWorkersDesc')}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={() => navigate('/workers')}>
              <Plus className="h-4 w-4 mr-2" />
              {t('torrents.addFirstWorker')}
            </Button>
          </EmptyContent>
        </Empty>
      )}

      {/* Estado vazio - todos os workers com erro */}
      {!isInitialLoading && workers.length > 0 && workers.every(worker => worker.status === 'ERRORED') && (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </EmptyMedia>
            <EmptyTitle>{t('torrents.workerError')}</EmptyTitle>
            <EmptyDescription>
              {t('torrents.workerErrorDesc')}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={() => navigate('/workers')}>
              <AlertTriangle className="h-4 w-4 mr-2" />
              {t('torrents.fixWorker')}
            </Button>
          </EmptyContent>
        </Empty>
      )}

      {/* Estado vazio - com workers funcionais mas sem torrents */}
      {!isInitialLoading && workers.length > 0 && workers.some(worker => worker.status !== 'ERRORED') && torrents.length === 0 && (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Download className="h-8 w-8 text-muted-foreground" />
            </EmptyMedia>
            <EmptyTitle>{t('torrents.noTorrentsWithWorkers')}</EmptyTitle>
            <EmptyDescription>
              {t('torrents.noTorrentsWithWorkersDesc')}
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

      {/* Barra de loading acima do conteúdo */}
      {isInitialLoading && (
        <LoadingBar className="mb-4" />
      )}

      {/* Conteúdo principal - apenas quando há workers funcionais e torrents */}
      {!isInitialLoading && workers.length > 0 && workers.some(worker => worker.status !== 'ERRORED') && torrents.length > 0 && (
        <>
          {/* Layout para desktop - Tabela, Cards ou Lista baseado na preferência */}
          <div className="hidden md:block w-full">
            {displayMode === "table" ? (
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
                onSearchMetadata={handleOpenMetadataSearch}
                onLimits={handleShowLimits}
                onMetadataUpdate={handleMetadataUpdate}
                compact={compact}
                selectionMode={selectionMode}
                selectedIds={selectedIds}
                onToggleSelect={handleToggleSelect}
                onRequestDelete={openDeleteModal}
              />
            ) : displayMode === "list" ? (
              // List view for desktop
              <>
                <TorrentSortingHeader
                  sortType={sortType}
                  sortDirection={sortDirection}
                  filteredCount={filteredTorrents.length}
                  totalCount={torrents.length}
                />

                <TorrentListCompact
                  torrents={paginatedTorrents}
                  onShowDetails={handleShowDetails}
                  onStart={handlePlayTorrent}
                  onStop={handlePauseTorrent}
                  onRemove={(id) => handleDeleteTorrent(id, false)}
                  onForceDownload={handleForceDownloadTorrent}
                  onForceReannounce={handleForceReannounceTorrent}
                  onForceRecheck={handleForceRecheckTorrent}
                  onSearchMetadata={handleOpenMetadataSearch}
                  onLimits={handleShowLimits}
                  compact={compact}
                  selectionMode={selectionMode}
                  selectedIds={selectedIds}
                  onToggleSelect={handleToggleSelect}
                  onRequestDelete={openDeleteModal}
                />

                {/* Lazy loading sentinel for list view */}
                <LazyLoadingSentinel
                  ref={sentinelRef}
                  show={useCardLazyLoading && displayedItemsCount < filteredTorrents.length}
                />
              </>
            ) : (
              // Card view for desktop
              <>
                <TorrentSortingHeader
                  sortType={sortType}
                  sortDirection={sortDirection}
                  filteredCount={filteredTorrents.length}
                  totalCount={torrents.length}
                />

                <TorrentListMobile
                  torrents={paginatedTorrents}
                  onShowDetails={handleShowDetails}
                  onStart={handlePlayTorrent}
                  onStop={handlePauseTorrent}
                  onRemove={(id) => handleDeleteTorrent(id, false)}
                  onForceDownload={handleForceDownloadTorrent}
                  onForceReannounce={handleForceReannounceTorrent}
                  onForceRecheck={handleForceRecheckTorrent}
                  onSearchMetadata={handleOpenMetadataSearch}
                  onLimits={handleShowLimits}
                  onMetadataUpdate={handleMetadataUpdate}
                  compact={compact}
                  selectionMode={selectionMode}
                  selectedIds={selectedIds}
                  onToggleSelect={handleToggleSelect}
                  onRequestDelete={openDeleteModal}
                />

                {/* Lazy loading sentinel for card view */}
                <LazyLoadingSentinel
                  ref={sentinelRef}
                  show={useCardLazyLoading && displayedItemsCount < filteredTorrents.length}
                />
              </>
            )}
          </div>

          {/* Layout para mobile - Cards em coluna única */}
          <div className="md:hidden w-full">
            <TorrentSortingHeader
              sortType={sortType}
              sortDirection={sortDirection}
              filteredCount={filteredTorrents.length}
              totalCount={torrents.length}
              isMobile={true}
            />

            <TorrentListMobile
              torrents={paginatedTorrents}
              onShowDetails={handleShowDetails}
              onStart={handlePlayTorrent}
              onStop={handlePauseTorrent}
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
            <LazyLoadingSentinel
              ref={mobileSentinelRef}
              show={displayedItemsCount < filteredTorrents.length}
            />
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
          onSetLocation={handleSetLocationTorrent}
          onUpdate={handleMetadataUpdate}
        />
      )}

      {/* Modal de adicionar torrent - só renderiza quando aberto */}
      {isAddModalOpen && (
        <AddTorrentModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          onCreateTorrent={handleCreateTorrent}
          onFinalizeTorrent={handleFinalizeTorrent}
          workers={workers}
        />
      )}

      <TaskMetadataSearchSheet
        isOpen={isMetadataSearchOpen}
        onClose={handleCloseMetadataSearch}
        task={metadataSearchTask}
        category={categories.find((category) => category.name === metadataSearchTask?.category) ?? null}
        onApplied={handleMetadataUpdate}
      />

      {/* Modal de limites do torrent - só renderiza quando aberto */}
      {isLimitsModalOpen && limitsWorkerId && limitsTaskIds.length > 0 && (
        <TorrentLimitModal
          isOpen={isLimitsModalOpen}
          onClose={handleCloseLimitsModal}
          workerId={limitsWorkerId}
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
              <span className="opacity-90"> {t('torrents.selection.selected')}</span>
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 rounded-full hover:bg-primary-foreground/20 ml-1"
              onClick={handleToggleSelectAll}
              aria-label={t('torrents.selection.disable')}
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


            {/* Filtro de workers */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Server className="w-4 h-4 text-muted-foreground" />
                {t('torrents.filters.workers')}
                {selectedWorkerIds.size > 0 && (
                  <div className="w-2 h-2 rounded-full bg-primary" />
                )}
              </label>
              <WorkerFilter
                workers={workers}
                selectedWorkerIds={selectedWorkerIds}
                onToggleWorker={workerControls.toggle}
                onSetAll={workerControls.setAll}
              />
            </div>

            {/* Filtro de status */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Activity className="w-4 h-4 text-muted-foreground" />
                {t('torrents.filters.status')}
                {selectedStatuses.size > 0 && (
                  <div className="w-2 h-2 rounded-full bg-primary" />
                )}
              </label>
              <StatusFilter
                availableStatuses={availableStatuses}
                selectedStatuses={selectedStatuses}
                onToggleStatus={statusControls.toggle}
                onSetAll={statusControls.setAll}
                getStatusIcon={getStatusIcon}
                getStatusColor={getStatusColor}
              />
            </div>

            {/* Filtro de categorias */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Folder className="w-4 h-4 text-muted-foreground" />
                {t('torrents.filters.categories')}
                {selectedCategories.size > 0 && (
                  <div className="w-2 h-2 rounded-full bg-primary" />
                )}
              </label>
              <CategoryFilter
                categories={categories.filter(cat => availableCategories.includes(cat.name))}
                selectedCategoryNames={selectedCategories}
                onToggleCategory={categoryControls.toggle}
                onSetAll={categoryControls.setAll}
              />
            </div>

            {/* Filtro de tags */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Tag className="w-4 h-4 text-muted-foreground" />
                {t('torrents.filters.tags')}
                {selectedTags.size > 0 && (
                  <div className="w-2 h-2 rounded-full bg-primary" />
                )}
              </label>
              <ListFilter
                label="tags"
                availableItems={availableTags}
                selectedItems={selectedTags}
                onToggleItem={tagControls.toggle}
                onSetAll={tagControls.setAll}
                useTagBadge={true}
              />
            </div>

            {/* Filtro de ratio grades */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Star className="w-4 h-4 text-muted-foreground" />
                {t('torrents.filters.ratioGrades')}
                {selectedGrades.size > 0 && (
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
                      onClick={() => gradeControls.toggle(grade)}
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
                <Button size="sm" variant="outline" onClick={() => gradeControls.setAll(true)} className="h-7 px-2">
                  {t('common.selectAll')}
                </Button>
                <Button size="sm" variant="outline" onClick={() => gradeControls.setAll(false)} className="h-7 px-2">
                  {t('common.clearAll')}
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
