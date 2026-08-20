
import { Button } from "@/components/ui/button";
import { AddTorrentButton } from "@/components/AddTorrentButton";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { LoadingBar } from "@/components/ui/LoadingBar";
import { SortAsc, SortDesc, Plus, Download, Server, Activity, Folder, Tag, AlertTriangle, Star, Search } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { torrentService, type BulkTaskAction } from "./services/torrents";
import { BulkActionBar } from "@/components/torrents/BulkActionBar";
import { workerService } from "./services/workers";
import { categoryService } from "./services/categories";
import { preferencesService } from "@/services/preferences";
import { useTorrentsWS } from "@/hooks/useTorrentsWS";
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
import type { Task, TaskMetadata } from "./types/torrent";
import type { Worker } from "./types/worker";
import type { Category } from "./types/category";
import WorkerFilter from "@/components/ui/WorkerFilter";
import StatusFilter from "@/components/ui/StatusFilter";
import CategoryFilter from "@/components/ui/CategoryFilter";
import { ListFilter } from "@/components/ui/ListFilter";
import { FilterSidebar } from "@/components/ui/FilterSidebar";
import { useFilterControls } from "@/hooks/useFilterControls";
import { TaskMetadataSearchSheet } from "@/components/TaskMetadataSearchSheet";
import { TorrentPlaceholderCard } from "@/components/torrents/TorrentPlaceholderCard";
import { useAddTorrent } from "@/contexts/add-torrent-hooks";
import { RatioBadge } from "@/components/RatioBadge";
import { LazyLoadingSentinel } from "@/components/LazyLoadingSentinel";
import { toast } from "sonner";
import { normalizeTaskStatus } from "@/utils/statusUtils";
import { getRatioGrade } from "@/utils/ratioUtils";
import { useLazyLoadingObserver } from "@/hooks/useLazyLoadingObserver";


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
    // Backend não fornece data de criação, e o campo não é usado para
    // exibição/ordenação hoje; um valor fixo evita quebrar a igualdade
    // referencial do objeto a cada remapeamento (new Date() gerava um valor
    // novo sempre, mesmo quando nada no torrent havia mudado).
    createdAt: "",
    progress: task.progress,
    ratio: task.ratio,
    numSeeds: task.pairs?.seeders || 0,
    numLeechs: task.pairs?.leechers || 0,
    workerName: task.worker?.name,
    workerStatus: task.worker?.status,
    // task.worker_id always comes straight from the backend; task.worker is
    // only populated client-side by joining against the loaded workers list
    // (which can race), so fall back to worker_id to keep context-menu
    // actions (which need a worker id) working even before that join happens.
    workerUUID: task.worker?.uuid || task.worker_id,
    workerIcon: task.worker?.icon,
    workerColor: task.worker?.color,
    category: task.category || "",
    canSearchMetadata: canCategorySearchMetadata(task.category || "", categories),
    tags: task.tags || [],
    metadata: task.metadata,
  };
}

// Desktop table moved to components/TorrentsTable

// Resolves `task.worker` from the loaded workers list when it's still
// missing (e.g. a TORRENT_ADDED event that arrived before the first
// loadWorkers finished). Returns the same reference when nothing changed.
function reattachTaskWorker(task: Task, workers: Worker[]): Task {
  if (task.worker) return task;
  const worker = workers.find((w) => w.uuid === task.worker_id);
  if (!worker) return task;
  return { ...task, worker };
}

export default function TorrentsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
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
  const { openAddModal, pendingTorrents, removePendingTorrent } = useAddTorrent();
  const [isLimitsModalOpen, setIsLimitsModalOpen] = useState(false);
  const [limitsTaskIds, setLimitsTaskIds] = useState<string[]>([]);
  const [limitsWorkerId, setLimitsWorkerId] = useState<string>("");
  const [limitsTaskName, setLimitsTaskName] = useState<string>("");
  const [limitsTaskStatus, setLimitsTaskStatus] = useState<string>("");
  const [isFilterSidebarOpen, setIsFilterSidebarOpen] = useState(false);
  const [compact, setCompact] = useState(false);
  const [displayMode, setDisplayMode] = useState<"table" | "card" | "card_b" | "list">("card");
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
  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);


  const mapTasksToTorrents = useCallback((tasks: Task[]) => {
    return tasks.map((task) => mapTaskToTorrent(task, categories));
  }, [categories]);

  // Fonte única de verdade: torrents é sempre derivado de originalTasks.
  // Antes cada callback WS também chamava setTorrents diretamente E um
  // useEffect separado recomputava a partir de originalTasks, causando dois
  // re-renders da lista inteira por evento.
  const torrents = useMemo(() => mapTasksToTorrents(originalTasks), [mapTasksToTorrents, originalTasks]);

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

  // Refs para os dados voláteis que os handlers de ação precisam ler, sem
  // precisar entrar nas deps do useCallback: assim os handlers passados aos
  // cards mantêm identidade estável entre polls/eventos WS, o que é o que
  // permite o React.memo dos cards evitar re-render da lista inteira a cada
  // atualização de um único torrent.
  const originalTasksRef = useRef<Task[]>(originalTasks);
  useEffect(() => { originalTasksRef.current = originalTasks; }, [originalTasks]);
  const torrentsRef = useRef<Torrent[]>(torrents);
  useEffect(() => { torrentsRef.current = torrents; }, [torrents]);
  const lastNonEmptyTorrentsRef = useRef<Torrent[]>(lastNonEmptyTorrents);
  useEffect(() => { lastNonEmptyTorrentsRef.current = lastNonEmptyTorrents; }, [lastNonEmptyTorrents]);
  const selectedIdsRef = useRef<Set<string>>(selectedIds);
  useEffect(() => { selectedIdsRef.current = selectedIds; }, [selectedIds]);
  const selectionModeRef = useRef(selectionMode);
  useEffect(() => { selectionModeRef.current = selectionMode; }, [selectionMode]);

  // originalTasks lido de dentro dos handlers WS via ref: assim os handlers
  // passados ao hook não precisam de `workers` nas deps (o join usa a lista
  // mais recente sem recriar o callback subscrito no WS a cada mudança de
  // workers).
  const workersRef = useRef<Worker[]>(workers);
  useEffect(() => {
    workersRef.current = workers;
  }, [workers]);

  // Hook WebSocket updating all REST polling
  const { isConnected: isWsConnected, requestSync } = useTorrentsWS({
    onInitialState: useCallback((tasks: Task[], errors?: Record<string, string>) => {
      const joinedTasks = tasks.map((task) => ({
        ...task,
        worker: task.worker ?? workersRef.current.find((w) => w.uuid === task.worker_id),
      }));
      setOriginalTasks(joinedTasks);
      setInitialLoadComplete(true);
      if (errors && Object.keys(errors).length > 0) {
        toast.error(t('torrents.notifications.someWorkersFailed'));
      }
    }, [t]),
    onTaskUpdated: useCallback((updatedTask: Partial<Task> & { hash: string, worker_id: string }) => {
      setOriginalTasks(prev => {
        // Hashes are unique only inside a worker. Match both values so an
        // update cannot overwrite the same torrent hosted by another worker.
        const index = prev.findIndex(t =>
          t.hash === updatedTask.hash &&
          (t.worker_id === updatedTask.worker_id || t.worker?.uuid === updatedTask.worker_id)
        );
        if (index >= 0) {
          const next = [...prev];
          const worker = next[index].worker ?? workersRef.current.find(w => w.uuid === updatedTask.worker_id);
          next[index] = { ...next[index], ...updatedTask, worker } as Task;
          return next;
        }
        // New task: attach worker if already known; otherwise keep it
        // unresolved (a later effect re-joins it once `workers` loads)
        // instead of dropping the event, which used to make torrents added
        // before the worker list finished loading vanish from the UI.
        const worker = workersRef.current.find(w => w.uuid === updatedTask.worker_id);
        return [...prev, { ...updatedTask, worker } as Task];
      });
    }, []),
    onTaskRemoved: useCallback((hash: string, workerId: string) => {
      setOriginalTasks(prev => prev.filter(t =>
        !(t.hash === hash && (t.worker_id === workerId || t.worker?.uuid === workerId))
      ));
    }, []),
    onWorkerStats: useCallback(() => {
      // Optional: Update worker stats in UI if needed
    }, []),
  });

  // Re-join: quando a lista de workers chega/muda, resolve o `worker` de
  // tasks que ficaram sem ele (ex.: TORRENT_ADDED que chegou antes do
  // primeiro loadWorkers terminar).
  useEffect(() => {
    if (workers.length === 0) return;
    setOriginalTasks(prev => {
      let changed = false;
      const next = prev.map(task => {
        const joined = reattachTaskWorker(task, workers);
        if (joined !== task) changed = true;
        return joined;
      });
      return changed ? next : prev;
    });
  }, [workers]);

  // Client-driven state sync loop
  useEffect(() => {
    if (isRefreshPaused || !initialLoadComplete) return;

    const intervalId = setInterval(() => {
      requestSync();
    }, refreshIntervalSec * 1000);

    return () => clearInterval(intervalId);
  }, [refreshIntervalSec, isRefreshPaused, initialLoadComplete, requestSync]);

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

  // Remoção otimista: tira da lista na hora, sem esperar o próximo tick do WS
  const removeTasksLocally = useCallback((ids: string[]) => {
    const idSet = new Set(ids.map((id) => id.toLowerCase()));
    setOriginalTasks((prev) =>
      prev.filter(
        (task) => !idSet.has(task.id?.toLowerCase() ?? "") && !idSet.has(task.hash?.toLowerCase() ?? "")
      )
    );
  }, []);

  // Abrir modal de deleção (single/bulk) a partir do contexto (tabela/cards/menu)
  const openDeleteModal = useCallback((ids: string[]) => {
    setDeleteIds(ids);
    const isBulk = selectionModeRef.current && ids.length > 1;
    setDeleteMode(isBulk ? "bulk" : "single");
    if (!isBulk) {
      const found = (torrentsRef.current.find(x => x.id === ids[0]) || lastNonEmptyTorrentsRef.current.find(x => x.id === ids[0]));
      setDeleteSingleName(found?.name || "");
    } else {
      setDeleteSingleName("");
    }
    setIsDeleteModalOpen(true);
  }, []);

  // Confirma deleção de 1..N torrents selecionados
  const handleConfirmDelete = useCallback(async (purge: boolean) => {
    try {
      const ids = deleteIds;
      const source = torrentsRef.current.length > 0 ? torrentsRef.current : lastNonEmptyTorrentsRef.current;
      const isBulk = ids.length > 1;

      // Marcar que estamos fazendo refresh para manter cache ativo
      setIsRefreshing(true);

      const results = await Promise.allSettled(ids.map(async (id) => {
        const t = source.find(x => x.id === id);
        if (!t?.workerUUID) {
          throw new Error("worker not found");
        }
        const response = await torrentService.deleteTask(t.workerUUID, id, purge);
        if (response.error) {
          throw new Error(response.error);
        }
        return id;
      }));

      const deletedIds = results
        .filter((result): result is PromiseFulfilledResult<string> => result.status === "fulfilled")
        .map((result) => result.value);

      removeTasksLocally(deletedIds);

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
  }, [deleteIds, t, removeTasksLocally]);

  // Abrir modal de detalhes
  const handleShowDetails = useCallback((torrentId: string) => {
    const task = originalTasksRef.current.find(t => t.id === torrentId);
    if (task) {
      setSelectedTorrent(task);
      setIsModalOpen(true);
    }
  }, []);

  // Fechar modal
  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setSelectedTorrent(null);
  }, []);

  const handleOpenMetadataSearch = useCallback((taskId: string) => {
    const task = originalTasksRef.current.find((item) => item.id === taskId);
    if (!task) {
      return;
    }

    setMetadataSearchTask(task);
    setIsMetadataSearchOpen(true);
  }, []);

  const handleCloseMetadataSearch = useCallback(() => {
    setIsMetadataSearchOpen(false);
    setMetadataSearchTask(null);
  }, []);

  const handleShowLimits = useCallback((taskId: string, workerId?: string) => {
    const task = originalTasksRef.current.find(t => t.id === taskId);

    // Se está em modo de seleção e há múltiplos torrents selecionados, usar a seleção
    const isBulkEdit = selectionModeRef.current && selectedIdsRef.current.size > 1;
    const taskIds = isBulkEdit ? Array.from(selectedIdsRef.current) : [taskId];

    setLimitsTaskIds(taskIds);
    setLimitsWorkerId(workerId || "");
    setLimitsTaskName(task?.name || "");
    setLimitsTaskStatus(task?.state || "");
    setIsLimitsModalOpen(true);
  }, []);

  // Fechar modal de limites
  const handleCloseLimitsModal = useCallback(() => {
    setIsLimitsModalOpen(false);
    setLimitsTaskIds([]);
    setLimitsWorkerId("");
    setLimitsTaskName("");
    setLimitsTaskStatus("");
  }, []);

  // Handler para atualização de metadados: aplica o retorno da API
  // diretamente na lista e no modal aberto, sem depender de evento WS
  // (uploads/edições de metadata não disparam TORRENT_STATE_CHANGE).
  const handleMetadataUpdate = useCallback((metadata?: TaskMetadata) => {
    if (!metadata?.task_hash) return;

    setOriginalTasks(prev => {
      const index = prev.findIndex(t => t.hash === metadata.task_hash);
      if (index < 0) return prev;
      const next = [...prev];
      next[index] = { ...next[index], metadata };
      return next;
    });

    setSelectedTorrent(prev =>
      prev && prev.hash === metadata.task_hash ? { ...prev, metadata } : prev
    );
  }, []);

  // Aplica o resultado de uma edição de categoria/tags direto na lista e no
  // modal aberto, pelas mesmas razões do handleMetadataUpdate acima: a
  // mudança não dispara TORRENT_STATE_CHANGE de imediato.
  const handleCategoryTagsUpdate = useCallback((torrentId: string, patch: { category?: string; tags?: string[] }) => {
    setOriginalTasks(prev => {
      const index = prev.findIndex(t => t.id === torrentId);
      if (index < 0) return prev;
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });

    setSelectedTorrent(prev =>
      prev && prev.id === torrentId ? { ...prev, ...patch } : prev
    );
  }, []);

  // Controles de torrent
  const handleGenericTorrentAction = useCallback(async (
    torrentId: string,
    actionName: string,
    actionFn: (workerId: string, taskId: string) => Promise<{ error?: string }>,
    successMessage: string
  ) => {
    try {
      const task = originalTasksRef.current.find(t => t.id === torrentId);
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

      // A UI será atualizada via WebSocket (evento TORRENT_STATE_CHANGE)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Erro ao ${actionName}`);
    }
  }, [t]);

  const handlePlayTorrent = useCallback((torrentId: string) =>
    handleGenericTorrentAction(
      torrentId,
      t('torrents.actionButtons.play'),
      torrentService.resumeTask,
      t('torrents.notifications.resumeSuccess')
    ), [handleGenericTorrentAction, t]);

  const handlePauseTorrent = useCallback((torrentId: string) =>
    handleGenericTorrentAction(
      torrentId,
      t('torrents.actionButtons.pause'),
      torrentService.pauseTask,
      t('torrents.notifications.pauseSuccess')
    ), [handleGenericTorrentAction, t]);

  const handleForceDownloadTorrent = useCallback((torrentId: string) =>
    handleGenericTorrentAction(
      torrentId,
      t('torrents.forceDownload'),
      torrentService.forceDownloadTask,
      t('torrents.notifications.forceDownloadSuccess')
    ), [handleGenericTorrentAction, t]);

  const handleForceReannounceTorrent = useCallback((torrentId: string) =>
    handleGenericTorrentAction(
      torrentId,
      t('torrents.forceReannounce'),
      torrentService.forceReannounceTask,
      t('torrents.notifications.forceReannounceSuccess')
    ), [handleGenericTorrentAction, t]);

  const handleForceRecheckTorrent = useCallback((torrentId: string) =>
    handleGenericTorrentAction(
      torrentId,
      t('torrents.forceRecheck'),
      torrentService.forceRecheckTask,
      t('torrents.notifications.forceRecheckSuccess')
    ), [handleGenericTorrentAction, t]);

  const handleSetLocationTorrent = useCallback(async (torrentId: string, location: string) => {
    try {
      const task = originalTasksRef.current.find(t => t.id === torrentId);
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

      // A UI será atualizada via WebSocket
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('torrents.notifications.pathChangeError'));
    }
  }, [t]);

  const handleDeleteTorrent = useCallback(async (torrentId: string, purge: boolean = false) => {
    try {
      const task = originalTasksRef.current.find(t => t.id === torrentId);
      if (!task || !task.worker?.uuid) {
        toast.error(t('torrents.notifications.workerIdNotFound'));
        return;
      }

      const response = await torrentService.deleteTask(task.worker.uuid, torrentId, purge);

      if (response.error) {
        toast.error(response.error);
        return;
      }

      // Fechar modal
      handleCloseModal();
      removeTasksLocally([torrentId]);
      toast.success(purge
        ? t('torrents.notifications.deleteWithFilesSuccess')
        : t('torrents.notifications.deleteSuccess')
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('torrents.notifications.deleteError'));
    }
  }, [t, handleCloseModal, removeTasksLocally]);

  // Aplica uma ação em lote aos torrents selecionados via endpoint bulk
  const handleBulkAction = useCallback(async (
    action: BulkTaskAction,
    options?: { category?: string; tags?: string[] }
  ) => {
    const source = torrentsRef.current.length > 0 ? torrentsRef.current : lastNonEmptyTorrentsRef.current;
    const items = Array.from(selectedIdsRef.current)
      .map((id) => {
        const torrent = source.find((x) => x.id === id);
        return torrent?.workerUUID
          ? { worker_id: torrent.workerUUID, hash: torrent.hash || id }
          : null;
      })
      .filter((item): item is { worker_id: string; hash: string } => item !== null);

    if (items.length === 0) {
      toast.error(t('torrents.notifications.workerIdNotFound'));
      return;
    }

    try {
      const response = await torrentService.bulkTaskAction(action, items, options);
      if (response.error || !response.data) {
        toast.error(response.error || t('torrents.bulk.error'));
        return;
      }

      const { succeeded, failed } = response.data;
      if (failed && Object.keys(failed).length > 0) {
        toast.warning(t('torrents.bulk.partial', { succeeded }));
      } else {
        toast.success(t('torrents.bulk.success', { count: succeeded }));
      }

      // Categoria/tags não geram evento de mudança de estado no WS; força sync
      requestSync();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('torrents.bulk.error'));
    }
  }, [t, requestSync]);

  // Limites em lote a partir da action-bar: usa o worker do primeiro selecionado
  const handleBulkLimits = useCallback(() => {
    const firstId = Array.from(selectedIdsRef.current)[0];
    if (!firstId) return;
    const source = torrentsRef.current.length > 0 ? torrentsRef.current : lastNonEmptyTorrentsRef.current;
    const torrent = source.find((x) => x.id === firstId);
    handleShowLimits(firstId, torrent?.workerUUID);
  }, [handleShowLimits]);

  // Reconciliação dos placeholders otimistas: remove quando o torrent real chega via WS
  useEffect(() => {
    if (pendingTorrents.length === 0) {
      return;
    }

    const now = Date.now();
    for (const pending of pendingTorrents) {
      const arrived = originalTasks.some((task) => task.hash?.toLowerCase() === pending.hash);
      const isStale = now - pending.addedAt > 120_000;
      if (arrived || isStale) {
        removePendingTorrent(pending.hash);
      }
    }
  }, [originalTasks, pendingTorrents, removePendingTorrent]);

  // Antecipar a chegada do torrent real quando um placeholder é criado
  const previousPendingCount = useRef(0);
  useEffect(() => {
    if (pendingTorrents.length > previousPendingCount.current && initialLoadComplete) {
      requestSync();
    }
    previousPendingCount.current = pendingTorrents.length;
  }, [pendingTorrents, initialLoadComplete, requestSync]);

  // Load preferences from localStorage, live-updating when changed elsewhere (e.g. topbar)
  useEffect(() => {
    const loadPrefs = () => {
      const prefs = preferencesService.load();
      if (prefs) {
        setCompact(prefs.compact);
        setDisplayMode(prefs.torrent_display_mode);
      }
    };

    loadPrefs();
    window.addEventListener("storage", loadPrefs);
    window.addEventListener("preferencesUpdated", loadPrefs);
    return () => {
      window.removeEventListener("storage", loadPrefs);
      window.removeEventListener("preferencesUpdated", loadPrefs);
    };
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

  // O WebSocket gerencia o estado e as atualizações em tempo real!

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
  const useCardLazyLoading = displayMode === "card" || displayMode === "card_b" || displayMode === "list";

  // Para card/list view (desktop) e mobile: usar lazy loading
  // Para table view (desktop): usar paginação tradicional
  const displayedTorrents = (useCardLazyLoading || isMobile)
    ? filteredTorrents.slice(0, displayedItemsCount)
    : filteredTorrents.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const totalPages = (useCardLazyLoading || isMobile) ? 1 : Math.ceil(filteredTorrents.length / itemsPerPage);
  const paginatedTorrents = displayedTorrents;
  const visibleIds = useMemo(() => paginatedTorrents.map(t => t.id), [paginatedTorrents]);
  const allSelected = selectionMode && visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));

  // Tri-state select-all button behavior
  const handleToggleSelectAll = useCallback(() => {
    // Phase 0 -> 1: enable selection with none selected
    if (!selectionModeRef.current) {
      setSelectionMode(true);
      setSelectedIds(new Set());
      return;
    }
    // Phase 1 -> 2: select all visible
    const allSelectedLocal = visibleIds.length > 0 && visibleIds.every(id => selectedIdsRef.current.has(id));
    if (!allSelectedLocal) {
      setSelectedIds(new Set(visibleIds));
      return;
    }
    // Phase 2 -> 0: disable selection mode
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, [visibleIds]);

  // Resetar página/contador quando o filtro, itens por página ou tipo de ordenação mudarem
  useEffect(() => {
    setCurrentPage(1);
    setDisplayedItemsCount(30); // Reset lazy loading counter
  }, [searchTerm, itemsPerPage, sortType, sortDirection, displayMode, isMobile]);

  // Intersection Observer para lazy loading. O observer também é reavaliado
  // quando a lista chega depois do carregamento inicial, momento em que o
  // sentinel passa a existir no DOM.
  const sentinelRef = useLazyLoadingObserver({
    enabled: useCardLazyLoading && !isMobile,
    totalItems: filteredTorrents.length,
    displayedItemsCount,
    setDisplayedItemsCount,
    itemsPerLoad: ITEMS_PER_LOAD,
  });
  const mobileSentinelRef = useLazyLoadingObserver({
    enabled: isMobile,
    totalItems: filteredTorrents.length,
    displayedItemsCount,
    setDisplayedItemsCount,
    itemsPerLoad: ITEMS_PER_LOAD,
  });

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
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">{t('torrents.title')}</h1>
              {!isWsConnected && initialLoadComplete && (
                <span
                  className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400"
                  title={t('torrents.ws.reconnecting')}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                  {t('torrents.ws.reconnecting')}
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {t('torrents.subtitle')}
            </p>
          </div>
        </div>
        {/* Controles de adicionar - sempre mostrar, mas desabilitar durante loading */}
        {(isInitialLoading || (workers.length > 0 && workers.some(worker => worker.status !== 'ERRORED'))) && (
          <AddTorrentButton
            onClick={() => openAddModal()}
            disabled={isInitialLoading || workers.length === 0}
          >
            {t('torrents.addTorrent')}
          </AddTorrentButton>
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
      {!isInitialLoading && workers.length > 0 && workers.some(worker => worker.status !== 'ERRORED') && torrents.length === 0 && pendingTorrents.length === 0 && (
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
            <Button onClick={() => openAddModal()}>
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

      {/* Placeholders otimistas de torrents recém-adicionados (aguardando o WS) */}
      {!isInitialLoading && pendingTorrents.length > 0 && (
        <div
          className={
            displayMode === "card" || displayMode === "card_b"
              ? "w-full grid grid-cols-1 md:grid-cols-3 gap-2"
              : "w-full space-y-2"
          }
        >
          {pendingTorrents.map((pending) => (
            <TorrentPlaceholderCard key={pending.hash} pending={pending} variant={displayMode} />
          ))}
        </div>
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
              // Card view (or dense card_b view) for desktop
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
                  variant={displayMode === "card_b" ? "card_b" : "card"}
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
              variant={displayMode === "card_b" ? "card_b" : "card"}
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
          onCategoryTagsUpdate={handleCategoryTagsUpdate}
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

      {/* Floating bulk action bar - shows when selection mode is active */}
      {selectionMode && (
        <BulkActionBar
          selectedCount={selectedIds.size}
          categories={categories}
          availableTags={availableTags}
          onAction={handleBulkAction}
          onLimits={handleBulkLimits}
          onDelete={() => openDeleteModal(Array.from(selectedIds))}
          onClear={() => {
            setSelectionMode(false);
            setSelectedIds(new Set());
          }}
        />
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
