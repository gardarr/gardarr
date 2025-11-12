import { useMemo } from "react";
import { getRatioGrade } from "@/utils/ratioUtils";
import type { TorrentStatus } from "@/components/TorrentStatusIcon";

// Função para determinar prioridade de ordenação dos status
function getStatusPriority(status: TorrentStatus): number {
  switch (status) {
    // Error states - highest priority (1-2)
    case "ERROR":
      return 1;
    case "MISSING_FILES":
      return 2;
    
    // Download states - second priority (3-9)
    case "DOWNLOADING":
      return 3;
    case "METADATA_DOWNLOAD":
      return 4;
    case "FORCED_METADATA_DOWNLOAD":
      return 5;
    case "FORCED_DOWNLOAD":
      return 6;
    case "QUEUED_DOWNLOAD":
      return 7;
    case "CHECKING_DOWNLOAD":
    case "CHECKING_RESUME_DATA":
      return 8;
    case "STALLED_DOWNLOAD":
      return 9;
    case "PAUSED_DOWNLOAD":
    case "STOPPED_DOWNLOAD":
      return 10;
    
    // Upload states - third priority (11-17)
    case "UPLOADING":
      return 11;
    case "FORCED_UPLOAD":
      return 12;
    case "QUEUED_UPLOAD":
      return 13;
    case "CHECKING_UPLOAD":
      return 14;
    case "STALLED_UPLOAD":
      return 15;
    case "PAUSED_UPLOAD":
    case "STOPPED_UPLOAD":
      return 16;
    
    // Other states - lowest priority (17+)
    case "ALLOCATING":
      return 17;
    case "MOVING":
      return 18;
    case "UNKNOWN":
    default:
      return 19;
  }
}

type SortType = "priority" | "alphabetical" | "size" | "progress" | "download_speed" | "upload_speed" | "downloaded" | "uploaded";

interface Torrent {
  id: string;
  hash: string;
  name: string;
  totalSizeBytes: number;
  downloadRateBps: number;
  uploadRateBps: number;
  downloadedBytes: number;
  uploadedBytes: number;
  status: TorrentStatus;
  createdAt: string;
  progress: number;
  ratio: number;
  numSeeds: number;
  numLeechs: number;
  agentName?: string;
  agentUUID?: string;
  agentIcon?: string;
  agentColor?: string;
  category: string;
  tags: string[];
}

interface Agent {
  uuid: string;
  name: string;
  status: string;
}

interface UseTorrentFiltersParams {
  torrents: Torrent[];
  lastNonEmptyTorrents: Torrent[];
  isRefreshing: boolean;
  selectionMode: boolean;
  searchTerm: string;
  sortType: SortType;
  sortDirection: "asc" | "desc";
  agents: Agent[];
  selectedAgentIds: Set<string>;
  availableStatuses: TorrentStatus[];
  selectedStatuses: Set<TorrentStatus>;
  availableCategories: string[];
  selectedCategories: Set<string>;
  availableTags: string[];
  selectedTags: Set<string>;
  availableGrades: string[];
  selectedGrades: Set<string>;
}

export function useTorrentFilters({
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
}: UseTorrentFiltersParams): Torrent[] {
  return useMemo(() => {
    // Evita tabela vazia temporária mantendo última lista não vazia durante refresh ou seleção múltipla
    const source = torrents.length > 0 ? torrents : ((isRefreshing || selectionMode) ? lastNonEmptyTorrents : torrents);
    let filtered = source;

    // Filtrar por agentes selecionados (se houver agentes carregados)
    if (agents.length > 0 && selectedAgentIds.size === 0) {
      // Nenhum agent selecionado -> não exibe torrents
      return [] as Torrent[];
    }

    // Filtrar por ratio grades selecionados (se houver grades disponíveis)
    if (availableGrades.length > 0 && selectedGrades.size === 0) {
      // Nenhum grade selecionado -> não exibe torrents
      return [] as Torrent[];
    }
    if (availableGrades.length > 0 && selectedGrades.size > 0) {
      filtered = filtered.filter((t) => {
        const grade = getRatioGrade(t.ratio);
        return selectedGrades.has(grade);
      });
    }
    if (agents.length > 0 && selectedAgentIds.size > 0) {
      filtered = filtered.filter((t) => {
        // Só exibe torrents que pertencem aos agentes selecionados
        return t.agentUUID && selectedAgentIds.has(t.agentUUID);
      });
    }

    // Filtrar por status selecionados (se houver status disponíveis)
    if (availableStatuses.length > 0 && selectedStatuses.size === 0) {
      // Nenhum status selecionado -> não exibe torrents
      return [] as Torrent[];
    }
    if (availableStatuses.length > 0 && selectedStatuses.size > 0) {
      filtered = filtered.filter((t) => {
        // Só exibe torrents que pertencem aos status selecionados
        return selectedStatuses.has(t.status);
      });
    }

    // Filtrar por categorias selecionadas (se houver categorias disponíveis)
    if (availableCategories.length > 0 && selectedCategories.size > 0) {
      filtered = filtered.filter((t) => {
        // Verifica se o torrent não tem categoria (sempre exibe)
        const hasNoCategory = !t.category || t.category.trim() === '';
        if (hasNoCategory) return true;
        
        // Se tem categoria, verifica se está selecionada
        return selectedCategories.has(t.category);
      });
    } else if (availableCategories.length > 0 && selectedCategories.size === 0) {
      // Nenhuma categoria selecionada -> exibe apenas torrents sem categoria
      filtered = filtered.filter((t) => !t.category || t.category.trim() === '');
    }

    // Filtrar por tags selecionadas (se houver tags disponíveis)
    if (availableTags.length > 0 && selectedTags.size > 0) {
      filtered = filtered.filter((t) => {
        // Filtrar tags válidas (não vazias)
        const validTags = t.tags.filter(tag => tag && tag.trim() !== '');
        
        // Torrents sem tags válidas são sempre exibidos
        if (validTags.length === 0) {
          return true;
        }
        
        // Se tem tags válidas, verifica se pelo menos uma está selecionada
        return validTags.some(tag => selectedTags.has(tag));
      });
    } else if (availableTags.length > 0 && selectedTags.size === 0) {
      // Nenhuma tag selecionada -> exibe apenas torrents sem tags
      filtered = filtered.filter((t) => {
        const validTags = t.tags.filter(tag => tag && tag.trim() !== '');
        return validTags.length === 0;
      });
    }
    
    // Aplicar filtro de busca se houver termo
    if (searchTerm.trim()) {
      filtered = filtered.filter(torrent =>
        torrent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        torrent.status.toLowerCase().includes(searchTerm.toLowerCase()) ||
        torrent.id.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // Aplicar ordenação baseada no tipo selecionado
    return filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortType) {
        case "priority": {
          // Ordenar por prioridade de status (downloading e error primeiro)
          const priorityA = getStatusPriority(a.status);
          const priorityB = getStatusPriority(b.status);
          comparison = priorityA - priorityB;
          // Se as prioridades forem iguais, ordenar por nome
          if (comparison === 0) {
            comparison = a.name.localeCompare(b.name);
          }
          break;
        }
          
        case "alphabetical":
          // Ordenar alfabeticamente por status, depois por nome
          comparison = a.status.localeCompare(b.status);
          if (comparison === 0) {
            comparison = a.name.localeCompare(b.name);
          }
          break;
          
        case "size":
          comparison = a.totalSizeBytes - b.totalSizeBytes;
          break;
          
        case "progress":
          comparison = a.progress - b.progress;
          break;
          
        case "download_speed":
          comparison = a.downloadRateBps - b.downloadRateBps;
          break;
          
        case "upload_speed":
          comparison = a.uploadRateBps - b.uploadRateBps;
          break;
          
        case "downloaded":
          comparison = a.downloadedBytes - b.downloadedBytes;
          break;
          
        case "uploaded":
          comparison = a.uploadedBytes - b.uploadedBytes;
          break;
          
        default:
          comparison = a.name.localeCompare(b.name);
      }
      
      // Aplicar direção da ordenação
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [
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
  ]);
}
