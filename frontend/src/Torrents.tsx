import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { ArrowDownCircle, ArrowUpCircle, ArrowDown, ArrowUp, Search, Loader2, ChevronDown, SortAsc, SortDesc, Plus, SlidersHorizontal, Download, Clock, Server, Activity, Folder, Tag, FileUp, AlertTriangle } from "lucide-react";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { torrentService } from "./services/torrents";
import { agentService } from "./services/agents";
import type { Task, CreateTaskRequest } from "./types/torrent";
import type { Agent, AgentStatus } from "./types/agent";
import AgentFilter from "@/components/ui/AgentFilter";
import StatusFilter from "@/components/ui/StatusFilter";
import { ListFilter } from "@/components/ui/ListFilter";
import { FilterSidebar } from "@/components/ui/FilterSidebar";
import { TorrentDetailsModal } from "@/components/TorrentDetailsModal";
import { AddTorrentModal } from "@/components/AddTorrentModal";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { RatioBadge } from "@/components/ui/RatioBadge";
import { ToastContainer } from "@/components/ui/toast-container";
import { useToast } from "@/hooks/useToast";
import { AgentIcon } from "@/components/ui/AgentIcon";
import { getStatusIcon, getStatusColor, getStatusBackgroundColor, type TorrentStatus } from "@/components/TorrentStatusIcon";

type SortType = "priority" | "alphabetical" | "size" | "progress" | "download_speed" | "upload_speed" | "downloaded" | "uploaded";


type Torrent = {
  id: string;
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
};

// Função para mapear Task (backend) para Torrent (frontend)
function mapTaskToTorrent(task: Task): Torrent {
  // Mapear status do backend (já convertido para uppercase pelo mapeamento TaskStatuses)
  const mapStatus = (state: string): TorrentStatus => {
    
    // O backend já converte os status do qBittorrent para uppercase através do mapeamento TaskStatuses
    // Então aqui apenas validamos se é um status conhecido
    const validStatuses: TorrentStatus[] = [
      'ERROR', 'MISSING_FILES', 'UPLOADING', 'PAUSED_UPLOAD', 'STOPPED_UPLOAD',
      'QUEUED_UPLOAD', 'STALLED_UPLOAD', 'CHECKING_UPLOAD', 'FORCED_UPLOAD',
      'ALLOCATING', 'DOWNLOADING', 'METADATA_DOWNLOAD', 'FORCED_METADATA_DOWNLOAD',
      'PAUSED_DOWNLOAD', 'STOPPED_DOWNLOAD', 'QUEUED_DOWNLOAD', 'FORCED_DOWNLOAD',
      'STALLED_DOWNLOAD', 'CHECKING_DOWNLOAD', 'CHECKING_RESUME_DATA', 'MOVING', 'UNKNOWN'
    ];
    
    const mappedStatus = validStatuses.includes(state as TorrentStatus) ? state as TorrentStatus : 'UNKNOWN';
    
    return mappedStatus;
  };

  return {
    id: task.id,
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
  };
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = bytes / Math.pow(k, i);
  return `${value.toFixed(value >= 100 ? 0 : value >= 10 ? 1 : 2)} ${sizes[i]}`;
}

function formatRate(bps: number): string {
  return `${formatBytes(bps)}/s`;
}

function truncateText(text: string, maxLength: number = 50): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength) + "...";
}

function isTextTruncated(text: string, maxLength: number = 50): boolean {
  return text.length > maxLength;
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

function TorrentCard({ torrent, onShowDetails }: { 
  torrent: Torrent; 
  onShowDetails: (id: string) => void;
}) {
  const { t } = useTranslation();
  const StatusIcon = getStatusIcon(torrent.status);

  return (
    <Card 
      className="hover:shadow-lg transition-shadow overflow-hidden p-0 gap-4 cursor-pointer"
      onClick={() => onShowDetails(torrent.id)}
    >
      <CardHeader className={`flex flex-row items-center justify-between space-y-0 pt-3 pb-3 px-4 ${getStatusBackgroundColor(torrent.status)}`}>
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="flex-shrink-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <StatusIcon 
                  className={`h-5 w-5 ${getStatusColor(torrent.status)}`} 
                />
              </TooltipTrigger>
              <TooltipContent>
                <p>{torrent.status}</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <CardTitle 
            className="text-sm font-medium text-muted-foreground truncate" 
            title={isTextTruncated(torrent.name) ? `${torrent.name} (truncado)` : torrent.name}
          >
            {truncateText(torrent.name)}
          </CardTitle>
        </div>
        {torrent.agentName && (
          <div className="flex-shrink-0 ml-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="inline-flex items-center justify-center rounded-full border p-1">
                  <AgentIcon 
                    iconName={torrent.agentIcon}
                    color={torrent.agentColor}
                    size="sm"
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>{torrent.agentName}</p>
              </TooltipContent>
            </Tooltip>
          </div>
        )}
      </CardHeader>
      <CardContent className="px-4 pt-1 pb-6">
        <ProgressBar progress={torrent.progress} height="md" className="mb-0 opacity-60" showLabel={false} />
        <div className="text-xs text-muted-foreground mt-1 mb-5">
          {torrent.progress.toFixed(1)}% concluído ({formatBytes((torrent.progress / 100) * torrent.totalSizeBytes)} de {formatBytes(torrent.totalSizeBytes)})
        </div>
        <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground">
          <div>
            <span className="font-medium">{t('torrents.download')}: </span>
            <span className={torrent.downloadRateBps > 0 ? 'text-green-600 dark:text-green-400' : ''}>
              {formatRate(torrent.downloadRateBps)}
            </span>
            <span className="text-xs text-muted-foreground ml-1">
              ({formatBytes(torrent.downloadedBytes)})
            </span>
          </div>
          <div>
            <span className="font-medium">{t('torrents.upload')}: </span>
            <span className={torrent.uploadRateBps > 0 ? 'text-purple-600 dark:text-purple-400' : ''}>
              {formatRate(torrent.uploadRateBps)}
            </span>
            <span className="text-xs text-muted-foreground ml-1">
              ({formatBytes(torrent.uploadedBytes)})
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <ArrowUpCircle className="h-3 w-3 text-green-600 dark:text-green-400" />
              <span className="font-medium">{t('torrents.seeds')}: </span>
              <span>{torrent.numSeeds}</span>
            </div>
            <div className="flex items-center gap-1">
              <ArrowDownCircle className="h-3 w-3 text-blue-600 dark:text-blue-400" />
              <span className="font-medium">{t('torrents.leechs')}: </span>
              <span>{torrent.numLeechs}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-medium">{t('torrents.ratio')}: </span>
            <RatioBadge ratio={torrent.ratio} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TorrentRow({ torrent, onShowDetails }: { 
  torrent: Torrent; 
  onShowDetails: (id: string) => void;
}) {
  const StatusIcon = getStatusIcon(torrent.status);

  return (
    <tr 
      className="border-b hover:bg-muted/50 transition-colors cursor-pointer"
      onClick={() => onShowDetails(torrent.id)}
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <StatusIcon 
                className={`h-4 w-4 flex-shrink-0 ${getStatusColor(torrent.status)}`} 
              />
            </TooltipTrigger>
            <TooltipContent>
              <p>{torrent.status}</p>
            </TooltipContent>
          </Tooltip>
          <span 
            className="text-sm font-medium truncate" 
            title={isTextTruncated(torrent.name) ? `${torrent.name} (truncado)` : torrent.name}
          >
            {truncateText(torrent.name)}
          </span>
        </div>
      </td>
      <td className="px-4 py-3 text-sm">
        {formatBytes(torrent.totalSizeBytes)}
      </td>
      <td className="px-4 py-3 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-16 bg-secondary rounded-full h-1.5">
            <div 
              className="bg-primary h-1.5 rounded-full transition-all duration-300" 
              style={{ width: `${torrent.progress}%` }}
            ></div>
          </div>
          <span className="text-xs text-muted-foreground">{torrent.progress.toFixed(0)}%</span>
        </div>
      </td>
      <td className="px-4 py-3 text-sm">
        <div className="flex flex-col">
          <span className={torrent.downloadRateBps > 0 ? 'text-green-600 dark:text-green-400' : ''}>
            {formatRate(torrent.downloadRateBps)}
          </span>
          <span className="text-xs text-muted-foreground">
            ({formatBytes(torrent.downloadedBytes)})
          </span>
        </div>
      </td>
      <td className="px-4 py-3 text-sm">
        <div className="flex flex-col">
          <span className={torrent.uploadRateBps > 0 ? 'text-purple-600 dark:text-purple-400' : ''}>
            {formatRate(torrent.uploadRateBps)}
          </span>
          <span className="text-xs text-muted-foreground">
            ({formatBytes(torrent.uploadedBytes)})
          </span>
        </div>
      </td>
      <td className="px-4 py-3 text-sm">
        <RatioBadge ratio={torrent.ratio} />
      </td>
      <td className="px-4 py-3 text-sm">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <ArrowUp className="h-3.5 w-3.5 text-green-600 dark:text-green-400 flex-shrink-0" />
            <span className="text-xs">{torrent.numSeeds}</span>
          </div>
          <div className="flex items-center gap-1">
            <ArrowDown className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
            <span className="text-xs">{torrent.numLeechs}</span>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-sm">
        {torrent.agentName ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center justify-center">
                <AgentIcon 
                  iconName={torrent.agentIcon}
                  color={torrent.agentColor}
                  size="md"
                />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>{torrent.agentName}</p>
            </TooltipContent>
          </Tooltip>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
    </tr>
  );
}

// Componente para botão de ordenação
function SortButton({ 
  sortType: currentSortType, 
  currentSortType: activeSortType,
  currentSortDirection,
  onSort, 
  children 
}: { 
  sortType: SortType; 
  currentSortType: SortType;
  currentSortDirection: "asc" | "desc";
  onSort: (type: SortType) => void; 
  children: React.ReactNode; 
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => onSort(currentSortType)}
      className={`h-6 w-6 p-0 hover:bg-muted ${
        activeSortType === currentSortType 
          ? "bg-muted text-foreground" 
          : "text-muted-foreground"
      }`}
      title={`Ordenar por ${children}`}
    >
      {activeSortType === currentSortType ? (
        currentSortDirection === "asc" ? (
          <SortAsc className="h-3 w-3" />
        ) : (
          <SortDesc className="h-3 w-3" />
        )
      ) : (
        <SortAsc className="h-3 w-3 opacity-50" />
      )}
    </Button>
  );
}

// Componente dropdown para seleção de itens por página
function ItemsPerPageDropdown({ 
  value, 
  onChange 
}: { 
  value: number; 
  onChange: (value: number) => void; 
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  
  const options = [5, 10, 20, 50, 100];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }
    
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 min-w-[80px] justify-between"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`Itens por página: ${value}`}
      >
        {value}
        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </Button>
      
      {isOpen && (
        <div 
          className="absolute right-0 mt-1 w-20 rounded-md border bg-card text-card-foreground shadow-md z-[100] py-1"
          role="listbox"
          aria-label="Opções de itens por página"
        >
          {options.map((option) => (
            <button
              key={option}
              className="w-full flex items-center justify-center px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
              onClick={() => {
                onChange(option);
                setIsOpen(false);
              }}
              role="option"
              aria-selected={option === value}
            >
              {option}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Componente dropdown para seleção do intervalo de atualização (segundos)
function UpdateIntervalDropdown({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const options = [3, 5, 10, 15, 30, 60];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 min-w-[60px] justify-between"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`Atualizar a cada ${value}s`}
        title={`Atualizar a cada ${value} segundos`}
      >
        {value}s
        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </Button>

      {isOpen && (
        <div
          className="absolute right-0 mt-1 w-24 rounded-md border bg-card text-card-foreground shadow-md z-[100] py-1"
          role="listbox"
          aria-label="Intervalo de atualização (segundos)"
        >
          {options.map((option) => (
            <button
              key={option}
              className="w-full flex items-center justify-center px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
              onClick={() => {
                onChange(option);
                setIsOpen(false);
              }}
              role="option"
              aria-selected={option === value}
            >
              {option}s
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Componente de paginação usando shadcn/ui
function TorrentPagination({
  currentPage,
  totalPages,
  onPageChange,
  className
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}) {
  // Função para gerar os números das páginas
  const generatePageNumbers = () => {
    const pages: (number | 'ellipsis')[] = [];
    const maxVisiblePages = 5;
    
    if (totalPages <= maxVisiblePages) {
      // Se temos poucas páginas, mostrar todas
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Lógica para mostrar páginas com ellipsis
      if (currentPage <= 3) {
        // Mostrar primeiras páginas
        for (let i = 1; i <= 4; i++) {
          pages.push(i);
        }
        pages.push('ellipsis');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        // Mostrar últimas páginas
        pages.push(1);
        pages.push('ellipsis');
        for (let i = totalPages - 3; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        // Mostrar páginas do meio
        pages.push(1);
        pages.push('ellipsis');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pages.push(i);
        }
        pages.push('ellipsis');
        pages.push(totalPages);
      }
    }
    
    return pages;
  };

  if (totalPages <= 1) return null;

  return (
    <Pagination className={className}>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious 
            href="#"
            size="default"
            onClick={(e) => {
              e.preventDefault();
              if (currentPage > 1) onPageChange(currentPage - 1);
            }}
            className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
          />
        </PaginationItem>
        
        {generatePageNumbers().map((page, index) => (
          <PaginationItem key={index}>
            {page === 'ellipsis' ? (
              <PaginationEllipsis />
            ) : (
              <PaginationLink
                href="#"
                size="icon"
                onClick={(e) => {
                  e.preventDefault();
                  onPageChange(page);
                }}
                isActive={page === currentPage}
                className="cursor-pointer"
              >
                {page}
              </PaginationLink>
            )}
          </PaginationItem>
        ))}
        
        <PaginationItem>
          <PaginationNext 
            href="#"
            size="default"
            onClick={(e) => {
              e.preventDefault();
              if (currentPage < totalPages) onPageChange(currentPage + 1);
            }}
            className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}

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
  const [refreshIntervalSec, setRefreshIntervalSec] = useState<number>(5);
  const [selectedTorrent, setSelectedTorrent] = useState<Task | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [originalTasks, setOriginalTasks] = useState<Task[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isFilterSidebarOpen, setIsFilterSidebarOpen] = useState(false);
  const [isAddDropdownOpen, setIsAddDropdownOpen] = useState(false);
  const { toasts, showSuccess, showError, removeToast } = useToast();
  
  // Refs para rastrear valores anteriores de status/categorias/tags disponíveis
  const prevAvailableStatusesRef = useRef<TorrentStatus[]>([]);
  const prevAvailableCategoriesRef = useRef<string[]>([]);
  const prevAvailableTagsRef = useRef<string[]>([]);
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

  // Inicializar todos os status como selecionados quando houver torrents
  // e manter todos selecionados quando novos status aparecerem
  useEffect(() => {
    if (availableStatuses.length === 0) return;
    
    const prevStatuses = prevAvailableStatusesRef.current;
    
    // Se não há status selecionados ainda, selecionar todos
    if (selectedStatuses.size === 0) {
      setSelectedStatuses(new Set(availableStatuses));
      prevAvailableStatusesRef.current = availableStatuses;
      return;
    }
    
    // Detectar novos status que apareceram
    const newStatuses = availableStatuses.filter(s => !prevStatuses.includes(s));
    
    // Se há novos status E todos os status anteriores estão selecionados,
    // adicionar os novos automaticamente
    if (newStatuses.length > 0) {
      const allPreviousSelected = prevStatuses.every(s => selectedStatuses.has(s));
      
      if (allPreviousSelected) {
        setSelectedStatuses(new Set(availableStatuses));
      }
    }
    
    // Atualizar ref para próxima comparação
    prevAvailableStatusesRef.current = availableStatuses;
  }, [availableStatuses, selectedStatuses]);

  // Inicializar todas as categorias como selecionadas quando houver torrents
  // e manter todas selecionadas quando novas categorias aparecerem
  useEffect(() => {
    if (availableCategories.length === 0) return;
    
    const prevCategories = prevAvailableCategoriesRef.current;
    
    // Se não há categorias selecionadas ainda, selecionar todas
    if (selectedCategories.size === 0) {
      setSelectedCategories(new Set(availableCategories));
      prevAvailableCategoriesRef.current = availableCategories;
      return;
    }
    
    // Detectar novas categorias que apareceram
    const newCategories = availableCategories.filter(c => !prevCategories.includes(c));
    
    // Se há novas categorias E todas as categorias anteriores estão selecionadas,
    // adicionar as novas automaticamente
    if (newCategories.length > 0) {
      const allPreviousSelected = prevCategories.every(c => selectedCategories.has(c));
      
      if (allPreviousSelected) {
        setSelectedCategories(new Set(availableCategories));
      }
    }
    
    // Atualizar ref para próxima comparação
    prevAvailableCategoriesRef.current = availableCategories;
  }, [availableCategories, selectedCategories]);

  // Inicializar todas as tags como selecionadas quando houver torrents
  // e manter todas selecionadas quando novas tags aparecerem
  useEffect(() => {
    if (availableTags.length === 0) return;
    
    const prevTags = prevAvailableTagsRef.current;
    
    // Se não há tags selecionadas ainda, selecionar todas
    if (selectedTags.size === 0) {
      setSelectedTags(new Set(availableTags));
      prevAvailableTagsRef.current = availableTags;
      return;
    }
    
    // Detectar novas tags que apareceram
    const newTags = availableTags.filter(t => !prevTags.includes(t));
    
    // Se há novas tags E todas as tags anteriores estão selecionadas,
    // adicionar as novas automaticamente
    if (newTags.length > 0) {
      const allPreviousSelected = prevTags.every(t => selectedTags.has(t));
      
      if (allPreviousSelected) {
        setSelectedTags(new Set(availableTags));
      }
    }
    
    // Atualizar ref para próxima comparação
    prevAvailableTagsRef.current = availableTags;
  }, [availableTags, selectedTags]);

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

      // Buscar tasks de cada agente funcional individualmente
      const allTasks: Task[] = [];
      const errors: string[] = [];

      for (const agent of functionalAgents) {
        try {
          const response = await torrentService.listAgentTasks(agent.uuid);
          if (response.error) {
            errors.push(`Agent ${agent.name}: ${response.error}`);
          } else if (response.data) {
            // Adicionar informações do agente a cada task
            const tasksWithAgent = response.data.map(task => ({
              ...task,
              agent: agent
            }));
            allTasks.push(...tasksWithAgent);
          }
        } catch (err) {
          errors.push(`Agent ${agent.name}: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      }

      // Mostrar erros se houver, mas continuar com as tasks que foram carregadas
      if (errors.length > 0) {
        console.warn('Some agents failed to load tasks:', errors);
        // Opcional: mostrar um toast de aviso sobre agentes com erro
        // showError(`Some agents failed to load tasks: ${errors.join(', ')}`);
      }

      setOriginalTasks(allTasks);
      const mappedTorrents = allTasks.map(mapTaskToTorrent);
      setTorrents(mappedTorrents);
    } catch (err) {
      showError(err instanceof Error ? err.message : t('torrents.error'));
    } finally {
      setLoading(false);
    }
  }, [showError, t, agents]);

  // Atualização silenciosa para não afetar UI (sem spinner)
  const refreshTorrentsSilently = useCallback(async () => {
    try {
      // Verificar se há pelo menos um agente funcional (não erro) antes de tentar carregar tasks
      const functionalAgents = agents.filter(agent => agent.status !== 'ERRORED');
      if (functionalAgents.length === 0) {
        // Se não há agentes funcionais, limpar tasks e retornar
        setOriginalTasks([]);
        setTorrents([]);
        return;
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
    } catch {
      // silencioso
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

  // Controles de torrent
  const handlePlayTorrent = async (torrentId: string) => {
    try {
      const task = originalTasks.find(t => t.id === torrentId);
      if (!task || !task.agent?.uuid) {
        showError('Agent ID não encontrado para este torrent');
        return;
      }

      const response = await torrentService.resumeTask(task.agent.uuid, torrentId);
      if (response.error) {
        showError(response.error);
        return;
      }

      showSuccess('Torrent retomado com sucesso');
      
      // Recarregar dados sem fechar o modal
      const refreshResponse = await torrentService.listTasks();
      if (refreshResponse?.data) {
        setOriginalTasks(refreshResponse.data);
        const mappedTorrents = refreshResponse.data.map(mapTaskToTorrent);
        setTorrents(mappedTorrents);
        
        // Atualizar o torrent selecionado para refletir mudanças
        const updatedTask = refreshResponse.data.find(t => t.id === torrentId);
        if (updatedTask) {
          setSelectedTorrent(updatedTask);
        }
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Erro ao retomar torrent');
    }
  };

  const handlePauseTorrent = async (torrentId: string) => {
    try {
      const task = originalTasks.find(t => t.id === torrentId);
      if (!task || !task.agent?.uuid) {
        showError('Agent ID não encontrado para este torrent');
        return;
      }

      const response = await torrentService.pauseTask(task.agent.uuid, torrentId);
      if (response.error) {
        showError(response.error);
        return;
      }

      showSuccess('Torrent pausado com sucesso');
      
      // Recarregar dados sem fechar o modal
      const refreshResponse = await torrentService.listTasks();
      if (refreshResponse?.data) {
        setOriginalTasks(refreshResponse.data);
        const mappedTorrents = refreshResponse.data.map(mapTaskToTorrent);
        setTorrents(mappedTorrents);
        
        // Atualizar o torrent selecionado para refletir mudanças
        const updatedTask = refreshResponse.data.find(t => t.id === torrentId);
        if (updatedTask) {
          setSelectedTorrent(updatedTask);
        }
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Erro ao pausar torrent');
    }
  };

  const handleForceDownloadTorrent = async (torrentId: string) => {
    try {
      const task = originalTasks.find(t => t.id === torrentId);
      if (!task || !task.agent?.uuid) {
        showError('Agent ID não encontrado para este torrent');
        return;
      }

      const response = await torrentService.forceDownloadTask(task.agent.uuid, torrentId);
      if (response.error) {
        showError(response.error);
        return;
      }

      showSuccess('Force download iniciado com sucesso');
      
      // Recarregar dados sem fechar o modal
      const refreshResponse = await torrentService.listTasks();
      if (refreshResponse?.data) {
        setOriginalTasks(refreshResponse.data);
        const mappedTorrents = refreshResponse.data.map(mapTaskToTorrent);
        setTorrents(mappedTorrents);
        
        // Atualizar o torrent selecionado para refletir mudanças
        const updatedTask = refreshResponse.data.find(t => t.id === torrentId);
        if (updatedTask) {
          setSelectedTorrent(updatedTask);
        }
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Erro ao forçar download do torrent');
    }
  };

  const handleForceReannounceTorrent = async (torrentId: string) => {
    try {
      const task = originalTasks.find(t => t.id === torrentId);
      if (!task || !task.agent?.uuid) {
        showError('Agent ID não encontrado para este torrent');
        return;
      }

      const response = await torrentService.forceReannounceTask(task.agent.uuid, torrentId);
      if (response.error) {
        showError(response.error);
        return;
      }

      showSuccess('Force reannounce iniciado com sucesso');
      
      // Recarregar dados sem fechar o modal
      const refreshResponse = await torrentService.listTasks();
      if (refreshResponse?.data) {
        setOriginalTasks(refreshResponse.data);
        const mappedTorrents = refreshResponse.data.map(mapTaskToTorrent);
        setTorrents(mappedTorrents);
        
        // Atualizar o torrent selecionado para refletir mudanças
        const updatedTask = refreshResponse.data.find(t => t.id === torrentId);
        if (updatedTask) {
          setSelectedTorrent(updatedTask);
        }
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Erro ao forçar reannounce do torrent');
    }
  };

  const handleForceRecheckTorrent = async (torrentId: string) => {
    try {
      const task = originalTasks.find(t => t.id === torrentId);
      if (!task || !task.agent?.uuid) {
        showError('Agent ID não encontrado para este torrent');
        return;
      }

      const response = await torrentService.forceRecheckTask(task.agent.uuid, torrentId);
      if (response.error) {
        showError(response.error);
        return;
      }

      showSuccess('Force recheck iniciado com sucesso');
      
      // Recarregar dados sem fechar o modal
      const refreshResponse = await torrentService.listTasks();
      if (refreshResponse?.data) {
        setOriginalTasks(refreshResponse.data);
        const mappedTorrents = refreshResponse.data.map(mapTaskToTorrent);
        setTorrents(mappedTorrents);
        
        // Atualizar o torrent selecionado para refletir mudanças
        const updatedTask = refreshResponse.data.find(t => t.id === torrentId);
        if (updatedTask) {
          setSelectedTorrent(updatedTask);
        }
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Erro ao forçar recheck do torrent');
    }
  };


  const handleRenameTorrent = async (torrentId: string, newName: string) => {
    try {
      const task = originalTasks.find(t => t.id === torrentId);
      if (!task || !task.agent?.uuid) {
        showError('Agent ID não encontrado para este torrent');
        return;
      }

      const response = await torrentService.renameTask(task.agent.uuid, torrentId, newName);
      if (response.error) {
        showError(response.error);
        return;
      }

      showSuccess('Torrent renomeado com sucesso');
      
      // Recarregar dados sem fechar o modal
      const refreshResponse = await torrentService.listTasks();
      if (refreshResponse?.data) {
        setOriginalTasks(refreshResponse.data);
        const mappedTorrents = refreshResponse.data.map(mapTaskToTorrent);
        setTorrents(mappedTorrents);
        
        // Atualizar o torrent selecionado para refletir mudanças
        const updatedTask = refreshResponse.data.find(t => t.id === torrentId);
        if (updatedTask) {
          setSelectedTorrent(updatedTask);
        }
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Erro ao renomear torrent');
    }
  };

  const handleSetLocationTorrent = async (torrentId: string, location: string) => {
    try {
      const task = originalTasks.find(t => t.id === torrentId);
      if (!task || !task.agent?.uuid) {
        showError('Agent ID não encontrado para este torrent');
        return;
      }

      const response = await torrentService.setTaskLocation(task.agent.uuid, torrentId, location);
      if (response.error) {
        showError(response.error);
        return;
      }

      showSuccess('Caminho alterado com sucesso');
      
      // Recarregar dados sem fechar o modal
      const refreshResponse = await torrentService.listTasks();
      if (refreshResponse?.data) {
        setOriginalTasks(refreshResponse.data);
        const mappedTorrents = refreshResponse.data.map(mapTaskToTorrent);
        setTorrents(mappedTorrents);
        
        // Atualizar o torrent selecionado para refletir mudanças
        const updatedTask = refreshResponse.data.find(t => t.id === torrentId);
        if (updatedTask) {
          setSelectedTorrent(updatedTask);
        }
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Erro ao alterar caminho do torrent');
    }
  };

  const handleDeleteTorrent = async (torrentId: string, purge: boolean = false) => {
    try {
      const task = originalTasks.find(t => t.id === torrentId);
      if (!task || !task.agent?.uuid) {
        showError('Agent ID não encontrado para este torrent');
        return;
      }

      const response = await torrentService.deleteTask(task.agent.uuid, torrentId, purge);
      
      if (response.error) {
        showError(response.error);
        return;
      }
      
      // Fechar modal e recarregar lista
      handleCloseModal();
      await loadTorrents();
      showSuccess(purge 
        ? t('torrents.notifications.deleteWithFilesSuccess') 
        : t('torrents.notifications.deleteSuccess')
      );
    } catch (err) {
      showError(err instanceof Error ? err.message : t('torrents.notifications.deleteError'));
    }
  };

  // Criar novo torrent
  const handleCreateTorrent = async (agentId: string, taskData: CreateTaskRequest) => {
    try {
      const response = await torrentService.createTask(agentId, taskData);
      
      if (response.error) {
        // Fechar o modal e exibir toast com erro
        setIsAddModalOpen(false);
        showError(t('torrents.notifications.addError', { error: response.error }));
        return;
      }
      
      // Recarregar a lista após criação
      await loadTorrents();
      
      // Exibir mensagem de sucesso
      showSuccess(t('torrents.notifications.addSuccess'));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : t('torrents.error');
      // Fechar o modal e exibir toast com erro
      setIsAddModalOpen(false);
      showError(t('torrents.notifications.addError', { error: errorMessage }));
    }
  };

  // Carregar dados na inicialização
  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

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

  // Filtrar e ordenar torrents com otimização para evitar re-renderizações
  const filteredTorrents = useMemo(() => {
    let filtered = torrents;

    // Filtrar por agentes selecionados (se houver agentes carregados)
    if (agents.length > 0 && selectedAgentIds.size === 0) {
      // Nenhum agent selecionado -> não exibe torrents
      return [] as Torrent[];
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
  }, [torrents, searchTerm, sortType, sortDirection, agents, selectedAgentIds, availableStatuses, selectedStatuses, availableCategories, selectedCategories, availableTags, selectedTags]);

  // Calcular dados de paginação
  const totalPages = Math.ceil(filteredTorrents.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedTorrents = filteredTorrents.slice(startIndex, endIndex);

  // Resetar página quando o filtro, itens por página ou tipo de ordenação mudarem
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, itemsPerPage, sortType, sortDirection]);

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

  // Função para mudar de página
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
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
            <UpdateIntervalDropdown
              value={refreshIntervalSec}
              onChange={setRefreshIntervalSec}
            />
          </div>
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
                selectedTags.size < availableTags.length) && (
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
            <div className="flex items-center gap-1 flex-shrink-0">
              <Clock className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              <UpdateIntervalDropdown
                value={refreshIntervalSec}
                onChange={setRefreshIntervalSec}
              />
            </div>
            <div className="w-px bg-border self-stretch flex-shrink-0" />
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
                selectedTags.size < availableTags.length) && (
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
      {/* Layout para desktop - Tabela */}
      <div className="hidden md:block">
        <div className="rounded-md border">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="sticky top-0 bg-background z-10">
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <span>{t('torrents.name')}</span>
                      <SortButton
                        sortType="priority"
                        currentSortType={sortType}
                        currentSortDirection={sortDirection}
                        onSort={handleSortChange}
                      >
                        {t('torrents.sortBy.priority')}
                      </SortButton>
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <span>{t('torrents.size')}</span>
                      <SortButton
                        sortType="size"
                        currentSortType={sortType}
                        currentSortDirection={sortDirection}
                        onSort={handleSortChange}
                      >
                        {t('torrents.sortBy.size')}
                      </SortButton>
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <span>{t('torrents.progress')}</span>
                      <SortButton
                        sortType="progress"
                        currentSortType={sortType}
                        currentSortDirection={sortDirection}
                        onSort={handleSortChange}
                      >
                        {t('torrents.sortBy.progress')}
                      </SortButton>
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <span>{t('torrents.download')}</span>
                      <SortButton
                        sortType="download_speed"
                        currentSortType={sortType}
                        currentSortDirection={sortDirection}
                        onSort={handleSortChange}
                      >
                        {t('torrents.sortBy.downloadSpeed')}
                      </SortButton>
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <span>{t('torrents.upload')}</span>
                      <SortButton
                        sortType="upload_speed"
                        currentSortType={sortType}
                        currentSortDirection={sortDirection}
                        onSort={handleSortChange}
                      >
                        {t('torrents.sortBy.uploadSpeed')}
                      </SortButton>
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    {t('torrents.ratio')}
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <span>Seeds/Peers</span>
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    {t('torrents.agent')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedTorrents.map((t) => (
                  <TorrentRow 
                    key={t.id} 
                    torrent={t} 
                    onShowDetails={handleShowDetails}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
        
        {/* Controles de paginação para desktop */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t bg-background">
            <div className="text-sm text-muted-foreground">
              {t('torrents.page')} {currentPage} {t('torrents.of')} {totalPages} ({filteredTorrents.length} {t('torrents.torrents')})
            </div>
            <div className="flex items-center gap-4">
              <TorrentPagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
              />
            <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{t('torrents.itemsPerPage')}:</span>
                <ItemsPerPageDropdown 
                  value={itemsPerPage} 
                  onChange={handleItemsPerPageChange} 
                />
              </div>
            </div>
          </div>
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
          
          <div className="space-y-4 w-full">
            {paginatedTorrents.map((t) => (
              <TorrentCard 
                key={t.id} 
                torrent={t} 
                onShowDetails={handleShowDetails}
              />
            ))}
          </div>
          
          {/* Controles de paginação para mobile */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t bg-background mt-4">
              <div className="text-sm text-muted-foreground">
                {currentPage} {t('torrents.of')} {totalPages}
              </div>
              <div className="flex items-center gap-3">
                <TorrentPagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={handlePageChange}
                />
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{t('torrents.itemsPerPage').split(' ')[0]}:</span>
                  <ItemsPerPageDropdown 
                    value={itemsPerPage} 
                    onChange={handleItemsPerPageChange} 
                  />
                </div>
              </div>
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

      {/* Toast notifications */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />

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

          {/* Separador */}
          <Separator />

          {/* Controles de ordenação */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <SortAsc className="w-4 h-4 text-muted-foreground" />
              {t('torrents.filters.sorting')}
            </label>
            <div className="grid grid-cols-2 gap-2">
          <Button
            variant={sortType === "priority" ? "default" : "outline"}
            size="sm"
            onClick={() => handleSortChange("priority")}
                className="text-xs flex items-center gap-1"
          >
            {t('torrents.sortButtons.priority')}
            {sortType === "priority" && (
              sortDirection === "asc" ? (
                <SortAsc className="h-3 w-3" />
              ) : (
                <SortDesc className="h-3 w-3" />
              )
            )}
          </Button>
          <Button
            variant={sortType === "alphabetical" ? "default" : "outline"}
            size="sm"
            onClick={() => handleSortChange("alphabetical")}
                className="text-xs flex items-center gap-1"
          >
            {t('torrents.sortButtons.name')}
            {sortType === "alphabetical" && (
              sortDirection === "asc" ? (
                <SortAsc className="h-3 w-3" />
              ) : (
                <SortDesc className="h-3 w-3" />
              )
            )}
          </Button>
          <Button
            variant={sortType === "size" ? "default" : "outline"}
            size="sm"
            onClick={() => handleSortChange("size")}
                className="text-xs flex items-center gap-1"
          >
            {t('torrents.sortButtons.size')}
            {sortType === "size" && (
              sortDirection === "asc" ? (
                <SortAsc className="h-3 w-3" />
              ) : (
                <SortDesc className="h-3 w-3" />
              )
            )}
          </Button>
          <Button
            variant={sortType === "progress" ? "default" : "outline"}
            size="sm"
            onClick={() => handleSortChange("progress")}
                className="text-xs flex items-center gap-1"
          >
            {t('torrents.sortButtons.progress')}
            {sortType === "progress" && (
              sortDirection === "asc" ? (
                <SortAsc className="h-3 w-3" />
              ) : (
                <SortDesc className="h-3 w-3" />
              )
            )}
          </Button>
          <Button
            variant={sortType === "download_speed" ? "default" : "outline"}
            size="sm"
            onClick={() => handleSortChange("download_speed")}
                className="text-xs flex items-center gap-1"
          >
            {t('torrents.sortButtons.download')}
            {sortType === "download_speed" && (
              sortDirection === "asc" ? (
                <SortAsc className="h-3 w-3" />
              ) : (
                <SortDesc className="h-3 w-3" />
              )
            )}
          </Button>
          <Button
            variant={sortType === "upload_speed" ? "default" : "outline"}
            size="sm"
            onClick={() => handleSortChange("upload_speed")}
                className="text-xs flex items-center gap-1"
          >
            {t('torrents.sortButtons.upload')}
            {sortType === "upload_speed" && (
              sortDirection === "asc" ? (
                <SortAsc className="h-3 w-3" />
              ) : (
                <SortDesc className="h-3 w-3" />
              )
            )}
          </Button>
          <Button
            variant={sortType === "downloaded" ? "default" : "outline"}
            size="sm"
            onClick={() => handleSortChange("downloaded")}
                className="text-xs flex items-center gap-1"
          >
            {t('torrents.sortButtons.downloaded')}
            {sortType === "downloaded" && (
              sortDirection === "asc" ? (
                <SortAsc className="h-3 w-3" />
              ) : (
                <SortDesc className="h-3 w-3" />
              )
            )}
          </Button>
          <Button
            variant={sortType === "uploaded" ? "default" : "outline"}
            size="sm"
            onClick={() => handleSortChange("uploaded")}
                className="text-xs flex items-center gap-1"
          >
            {t('torrents.sortButtons.uploaded')}
            {sortType === "uploaded" && (
              sortDirection === "asc" ? (
                <SortAsc className="h-3 w-3" />
              ) : (
                <SortDesc className="h-3 w-3" />
              )
            )}
          </Button>
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


