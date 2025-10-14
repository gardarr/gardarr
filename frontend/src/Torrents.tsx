import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ArrowDownCircle, ArrowUpCircle, PauseCircle, Info, Search, ChevronLeft, ChevronRight, Loader2, ChevronDown, SortAsc, SortDesc, Server, Clock, XCircle, FileX, Play, RotateCcw, HardDrive, Plus, SlidersHorizontal } from "lucide-react";
import { useEffect, useRef, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
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

type TorrentStatus = 
  | "ERROR" 
  | "MISSING_FILES"
  | "UPLOADING"
  | "PAUSED_UPLOAD"
  | "STOPPED_UPLOAD"
  | "QUEUED_UPLOAD"
  | "STALLED_UPLOAD"
  | "CHECKING_UPLOAD"
  | "FORCED_UPLOAD"
  | "ALLOCATING"
  | "DOWNLOADING"
  | "METADATA_DOWNLOAD"
  | "FORCED_METADATA_DOWNLOAD"
  | "PAUSED_DOWNLOAD"
  | "STOPPED_DOWNLOAD"
  | "QUEUED_DOWNLOAD"
  | "FORCED_DOWNLOAD"
  | "STALLED_DOWNLOAD"
  | "CHECKING_DOWNLOAD"
  | "CHECKING_RESUME_DATA"
  | "MOVING"
  | "UNKNOWN";
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

function getStatusIcon(status: TorrentStatus) {
  switch (status) {
    // Error states - highest priority
    case "ERROR":
      return XCircle;
    case "MISSING_FILES":
      return FileX;
    
    // Download states - second priority
    case "DOWNLOADING":
      return ArrowDownCircle;
    case "METADATA_DOWNLOAD":
    case "FORCED_METADATA_DOWNLOAD":
      return Info;
    case "PAUSED_DOWNLOAD":
    case "STOPPED_DOWNLOAD":
      return PauseCircle;
    case "QUEUED_DOWNLOAD":
      return Clock;
    case "FORCED_DOWNLOAD":
      return Play;
    case "STALLED_DOWNLOAD":
      return PauseCircle;
    case "CHECKING_DOWNLOAD":
    case "CHECKING_RESUME_DATA":
      return RotateCcw;
    
    // Upload states - third priority
    case "UPLOADING":
      return ArrowUpCircle;
    case "PAUSED_UPLOAD":
    case "STOPPED_UPLOAD":
      return PauseCircle;
    case "QUEUED_UPLOAD":
      return Clock;
    case "STALLED_UPLOAD":
      return PauseCircle;
    case "CHECKING_UPLOAD":
      return RotateCcw;
    case "FORCED_UPLOAD":
      return Play;
    
    // Other states - lowest priority
    case "ALLOCATING":
      return HardDrive;
    case "MOVING":
      return ArrowUpCircle;
    case "UNKNOWN":
    default:
      return Info;
  }
}

function getStatusColor(status: TorrentStatus): string {
  switch (status) {
    // Error states - red colors
    case "ERROR":
      return "text-red-600";
    case "MISSING_FILES":
      return "text-red-500";
    
    // Download states - green colors
    case "DOWNLOADING":
      return "text-green-600";
    case "METADATA_DOWNLOAD":
    case "FORCED_METADATA_DOWNLOAD":
      return "text-green-500";
    case "PAUSED_DOWNLOAD":
    case "STOPPED_DOWNLOAD":
      return "text-orange-500";
    case "QUEUED_DOWNLOAD":
      return "text-green-400";
    case "FORCED_DOWNLOAD":
      return "text-green-700";
    case "STALLED_DOWNLOAD":
      return "text-orange-600";
    case "CHECKING_DOWNLOAD":
    case "CHECKING_RESUME_DATA":
      return "text-cyan-500";
    
    // Upload states - purple/lilac colors
    case "UPLOADING":
      return "text-purple-600";
    case "PAUSED_UPLOAD":
    case "STOPPED_UPLOAD":
      return "text-orange-500";
    case "QUEUED_UPLOAD":
      return "text-purple-400";
    case "STALLED_UPLOAD":
      return "text-orange-600";
    case "CHECKING_UPLOAD":
      return "text-cyan-500";
    case "FORCED_UPLOAD":
      return "text-purple-700";
    
    // Other states - neutral colors
    case "ALLOCATING":
      return "text-indigo-500";
    case "MOVING":
      return "text-indigo-500";
    case "UNKNOWN":
    default:
      return "text-gray-500";
  }
}

function getStatusBackgroundColor(status: TorrentStatus): string {
  switch (status) {
    // Error states - light red backgrounds
    case "ERROR":
      return "bg-red-50 dark:bg-red-950/20";
    case "MISSING_FILES":
      return "bg-red-50 dark:bg-red-950/20";
    
    // Download states - light green backgrounds
    case "DOWNLOADING":
      return "bg-green-50 dark:bg-green-950/20";
    case "METADATA_DOWNLOAD":
    case "FORCED_METADATA_DOWNLOAD":
      return "bg-green-50 dark:bg-green-950/20";
    case "PAUSED_DOWNLOAD":
    case "STOPPED_DOWNLOAD":
      return "bg-orange-50 dark:bg-orange-950/20";
    case "QUEUED_DOWNLOAD":
      return "bg-green-50 dark:bg-green-950/20";
    case "FORCED_DOWNLOAD":
      return "bg-green-50 dark:bg-green-950/20";
    case "STALLED_DOWNLOAD":
      return "bg-orange-50 dark:bg-orange-950/20";
    case "CHECKING_DOWNLOAD":
    case "CHECKING_RESUME_DATA":
      return "bg-cyan-50 dark:bg-cyan-950/20";
    
    // Upload states - light purple backgrounds
    case "UPLOADING":
      return "bg-purple-50 dark:bg-purple-950/20";
    case "PAUSED_UPLOAD":
    case "STOPPED_UPLOAD":
      return "bg-orange-50 dark:bg-orange-950/20";
    case "QUEUED_UPLOAD":
      return "bg-purple-50 dark:bg-purple-950/20";
    case "STALLED_UPLOAD":
      return "bg-orange-50 dark:bg-orange-950/20";
    case "CHECKING_UPLOAD":
      return "bg-cyan-50 dark:bg-cyan-950/20";
    case "FORCED_UPLOAD":
      return "bg-purple-50 dark:bg-purple-950/20";
    
    // Other states - light neutral backgrounds
    case "ALLOCATING":
      return "bg-indigo-50 dark:bg-indigo-950/20";
    case "MOVING":
      return "bg-indigo-50 dark:bg-indigo-950/20";
    case "UNKNOWN":
    default:
      return "bg-gray-50 dark:bg-gray-950/20";
  }
}

function getAgentStatusColor(status?: AgentStatus): string {
  switch (status) {
    case "ACTIVE":
      return "text-green-600";
    case "INACTIVE":
      return "text-muted-foreground";
    case "ERRORED":
      return "text-red-600";
    default:
      return "text-muted-foreground";
  }
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
      <CardHeader className={`flex flex-row items-center space-y-0 pt-3 pb-3 px-4 ${getStatusBackgroundColor(torrent.status)}`}>
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
          {torrent.agentName && (
            <span
              className="ml-2 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium text-foreground"
              title={`Agent: ${torrent.agentName}${torrent.agentStatus ? ` (${torrent.agentStatus})` : ""}`}
            >
              <Server className={`h-3 w-3 ${getAgentStatusColor(torrent.agentStatus)}`} />
              {torrent.agentName}
            </span>
          )}
        </div>
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
        {torrent.agentName ? (
          <div className="flex items-center gap-2">
            <Server className={`h-3 w-3 ${getAgentStatusColor(torrent.agentStatus)}`} />
            <span className="truncate max-w-[160px]" title={torrent.agentName}>{torrent.agentName}</span>
          </div>
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
  
  const options = [10, 20, 50, 100];

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
        className="flex items-center gap-2 min-w-[100px] justify-between"
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

export default function TorrentsPage() {
  const { t } = useTranslation();
  const [torrents, setTorrents] = useState<Torrent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortType, setSortType] = useState<SortType>("priority");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [agents, setAgents] = useState<Agent[]>([]);
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
  const { toasts, showSuccess, showError, removeToast } = useToast();

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
  useEffect(() => {
    if (availableStatuses.length > 0 && selectedStatuses.size === 0) {
      setSelectedStatuses(new Set(availableStatuses));
    }
  }, [availableStatuses]);

  // Inicializar todas as categorias como selecionadas quando houver torrents
  useEffect(() => {
    if (availableCategories.length > 0 && selectedCategories.size === 0) {
      setSelectedCategories(new Set(availableCategories));
    }
  }, [availableCategories]);

  // Inicializar todas as tags como selecionadas quando houver torrents
  useEffect(() => {
    if (availableTags.length > 0 && selectedTags.size === 0) {
      setSelectedTags(new Set(availableTags));
    }
  }, [availableTags]);

  // Carregar torrents da API
  const loadTorrents = async () => {
    try {
      setLoading(true);
      const response = await torrentService.listTasks();
      
      if (response.error) {
        showError(response.error);
        return;
      }
      
      if (response.data) {
        setOriginalTasks(response.data);
        const mappedTorrents = response.data.map(mapTaskToTorrent);
        setTorrents(mappedTorrents);
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : t('torrents.error'));
    } finally {
      setLoading(false);
    }
  };

  // Atualização silenciosa para não afetar UI (sem spinner)
  const refreshTorrentsSilently = async () => {
    try {
      const response = await torrentService.listTasks();
      if (response?.data) {
        setOriginalTasks(response.data);
        const mappedTorrents = response.data.map(mapTaskToTorrent);
        setTorrents(mappedTorrents);
      }
    } catch {
      // silencioso
    }
  };

  // Carregar agents da API
  const loadAgents = async () => {
    try {
      const response = await agentService.listAgents();
      if (response.error) return;
      if (response.data) {
        setAgents(response.data);
        // Selecionar todos por padrão somente na primeira carga
        if (selectedAgentIds.size === 0) {
          setSelectedAgentIds(new Set(response.data.map((a) => a.uuid)));
        }
      }
    } catch {
      // silencioso; filtro de agentes é opcional
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

  // Controles de torrent
  const handlePlayTorrent = async (torrentId: string) => {
    try {
      // TODO: Implementar API call para iniciar/retomar torrent com ID: torrentId
      console.log('Play torrent:', torrentId);
      showSuccess('Torrent iniciado com sucesso');
      
      // Recarregar dados sem fechar o modal
      const response = await torrentService.listTasks();
      if (response?.data) {
        setOriginalTasks(response.data);
        const mappedTorrents = response.data.map(mapTaskToTorrent);
        setTorrents(mappedTorrents);
        
        // Atualizar o torrent selecionado para refletir mudanças
        const updatedTask = response.data.find(t => t.id === torrentId);
        if (updatedTask) {
          setSelectedTorrent(updatedTask);
        }
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Erro ao iniciar torrent');
    }
  };

  const handlePauseTorrent = async (torrentId: string) => {
    try {
      // TODO: Implementar API call para pausar torrent com ID: torrentId
      console.log('Pause torrent:', torrentId);
      showSuccess('Torrent pausado com sucesso');
      
      // Recarregar dados sem fechar o modal
      const response = await torrentService.listTasks();
      if (response?.data) {
        setOriginalTasks(response.data);
        const mappedTorrents = response.data.map(mapTaskToTorrent);
        setTorrents(mappedTorrents);
        
        // Atualizar o torrent selecionado para refletir mudanças
        const updatedTask = response.data.find(t => t.id === torrentId);
        if (updatedTask) {
          setSelectedTorrent(updatedTask);
        }
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Erro ao pausar torrent');
    }
  };

  const handleDeleteTorrent = async (torrentId: string) => {
    try {
      const response = await torrentService.deleteTask(torrentId, false);
      
      if (response.error) {
        showError(response.error);
        return;
      }
      
      // Fechar modal e recarregar lista
      handleCloseModal();
      await loadTorrents();
      showSuccess(t('torrents.notifications.deleteSuccess'));
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
    loadTorrents();
    loadAgents();
  }, []);

  // Intervalo de atualização automática
  useEffect(() => {
    if (refreshIntervalSec <= 0) return;
    const id = setInterval(() => {
      refreshTorrentsSilently();
    }, refreshIntervalSec * 1000);
    return () => clearInterval(id);
  }, [refreshIntervalSec]);

  // Filtrar e ordenar torrents
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
    if (availableCategories.length > 0 && selectedCategories.size === 0) {
      // Nenhuma categoria selecionada -> não exibe torrents
      return [] as Torrent[];
    }
    if (availableCategories.length > 0 && selectedCategories.size > 0) {
      filtered = filtered.filter((t) => {
        // Exibe torrents que pertencem às categorias selecionadas OU que não têm categoria
        return !t.category || selectedCategories.has(t.category);
      });
    }

    // Filtrar por tags selecionadas (se houver tags disponíveis)
    if (availableTags.length > 0 && selectedTags.size === 0) {
      // Nenhuma tag selecionada -> não exibe torrents
      return [] as Torrent[];
    }
    if (availableTags.length > 0 && selectedTags.size > 0) {
      filtered = filtered.filter((t) => {
        // Exibe torrents que têm pelo menos uma tag selecionada OU que não têm tags
        return !t.tags || t.tags.length === 0 || t.tags.some(tag => selectedTags.has(tag));
      });
    }
    
    // Aplicar filtro de busca se houver termo
    if (searchTerm.trim()) {
      filtered = filtered.filter(torrent =>
        torrent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        torrent.status.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // Aplicar ordenação baseada no tipo selecionado
    return filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortType) {
        case "priority":
          // Ordenar por prioridade de status (downloading e error primeiro)
          const priorityA = getStatusPriority(a.status);
          const priorityB = getStatusPriority(b.status);
          comparison = priorityA - priorityB;
          // Se as prioridades forem iguais, ordenar por nome
          if (comparison === 0) {
            comparison = a.name.localeCompare(b.name);
          }
          break;
          
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

  const handlePreviousPage = () => {
    setCurrentPage(prev => Math.max(prev - 1, 1));
  };

  const handleNextPage = () => {
    setCurrentPage(prev => Math.min(prev + 1, totalPages));
  };

  // Mostrar estado de carregamento
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t('torrents.title')}</h1>
            <p className="text-muted-foreground">
              {t('torrents.subtitle')}
            </p>
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
    <div className="space-y-6 min-h-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('torrents.title')}</h1>
          <p className="text-muted-foreground">
            {t('torrents.subtitle')}
          </p>
        </div>
        <Button
          onClick={() => setIsAddModalOpen(true)}
          className="bg-green-600 hover:bg-green-700 text-white"
          disabled={agents.length === 0}
        >
          <Plus className="h-4 w-4 mr-2" />
          {t('torrents.addTorrent')}
        </Button>
      </div>

      {/* Filtro de busca e controles */}
      <div className="flex flex-col gap-4 w-full">
        {/* Busca */}
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder={t('torrents.search')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        {/* Controles agrupados - desktop */}
        <div className="hidden sm:flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-sm text-muted-foreground">{t('torrents.itemsPerPage')}:</span>
            <ItemsPerPageDropdown 
              value={itemsPerPage} 
              onChange={handleItemsPerPageChange} 
            />
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-sm text-muted-foreground">{t('torrents.update')}:</span>
            <UpdateIntervalDropdown
              value={refreshIntervalSec}
              onChange={setRefreshIntervalSec}
            />
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <AgentFilter 
              agents={agents}
              selectedAgentIds={selectedAgentIds}
              onToggleAgent={toggleAgent}
              onSetAll={setAllAgents}
            />
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <StatusFilter
              availableStatuses={availableStatuses}
              selectedStatuses={selectedStatuses}
              onToggleStatus={toggleStatus}
              onSetAll={setAllStatuses}
              getStatusIcon={getStatusIcon}
              getStatusColor={getStatusColor}
            />
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <ListFilter
              label="categorias"
              availableItems={availableCategories}
              selectedItems={selectedCategories}
              onToggleItem={toggleCategory}
              onSetAll={setAllCategories}
            />
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <ListFilter
              label="tags"
              availableItems={availableTags}
              selectedItems={selectedTags}
              onToggleItem={toggleTag}
              onSetAll={setAllTags}
            />
          </div>
          <div className="text-sm text-muted-foreground">
            {filteredTorrents.length} {t('torrents.of')} {torrents.length} {t('torrents.torrents')}
            <span className="ml-2 text-xs">
              ({t('torrents.sortedBy')} {t(`torrents.sortBy.${getSortTypeKey(sortType)}`)} {sortDirection === "asc" ? "↑" : "↓"})
            </span>
          </div>
        </div>

        {/* Controles mobile */}
        <div className="sm:hidden mb-2">
          <div className="flex items-stretch gap-1.5">
            <div className="flex items-center gap-1 flex-shrink-0">
              <span className="text-xs text-muted-foreground whitespace-nowrap">{t('torrents.itemsPerPage').split(' ')[0]}:</span>
              <ItemsPerPageDropdown 
                value={itemsPerPage} 
                onChange={handleItemsPerPageChange} 
              />
            </div>
            <div className="w-px bg-border self-stretch flex-shrink-0" />
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
              <span className="text-sm">Filtros</span>
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
      
      {/* Estado vazio */}
      {torrents.length === 0 && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center space-y-4">
            <Info className="h-12 w-12 text-muted-foreground mx-auto" />
            <div>
              <h3 className="text-lg font-semibold">{t('torrents.noTorrents')}</h3>
              <p className="text-muted-foreground">
                {t('torrents.noTorrentsDesc')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Conteúdo principal - apenas quando há torrents */}
      {torrents.length > 0 && (
        <>
      {/* Layout para desktop - Tabela */}
      <div className="hidden md:block">
        <div className="rounded-md border">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
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
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <div className="text-sm text-muted-foreground">
              {t('torrents.page')} {currentPage} {t('torrents.of')} {totalPages} ({filteredTorrents.length} {t('torrents.torrents')})
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePreviousPage}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
                {t('torrents.previous')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNextPage}
                disabled={currentPage === totalPages}
              >
                {t('torrents.next')}
                <ChevronRight className="h-4 w-4" />
              </Button>
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
          <div className="flex gap-2 overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <Button
              variant={sortType === "priority" ? "default" : "outline"}
              size="sm"
              onClick={() => handleSortChange("priority")}
              className="flex-shrink-0 text-xs flex items-center gap-1"
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
              className="flex-shrink-0 text-xs flex items-center gap-1"
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
              className="flex-shrink-0 text-xs flex items-center gap-1"
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
              className="flex-shrink-0 text-xs flex items-center gap-1"
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
              className="flex-shrink-0 text-xs flex items-center gap-1"
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
              className="flex-shrink-0 text-xs flex items-center gap-1"
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
              className="flex-shrink-0 text-xs flex items-center gap-1"
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
              className="flex-shrink-0 text-xs flex items-center gap-1"
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
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <div className="text-sm text-muted-foreground">
              {currentPage} {t('torrents.of')} {totalPages}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePreviousPage}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNextPage}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
        </>
      )}

      {/* Modal de detalhes do torrent */}
      <TorrentDetailsModal
        torrent={selectedTorrent}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onPlay={handlePlayTorrent}
        onPause={handlePauseTorrent}
        onDelete={handleDeleteTorrent}
      />

      {/* Modal de adicionar torrent */}
      <AddTorrentModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={handleCreateTorrent}
        agents={agents}
      />

      {/* Toast notifications */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* Filter Sidebar - Mobile only */}
      <div className="sm:hidden">
        <FilterSidebar isOpen={isFilterSidebarOpen} onClose={() => setIsFilterSidebarOpen(false)}>
          <div className="space-y-6">
            {/* Filtro de agentes */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Server className="h-4 w-4" />
                Agentes
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
              <label className="text-sm font-medium">Status</label>
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
              <label className="text-sm font-medium">Categorias</label>
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
              <label className="text-sm font-medium">Tags</label>
              <ListFilter
                label="tags"
                availableItems={availableTags}
                selectedItems={selectedTags}
                onToggleItem={toggleTag}
                onSetAll={setAllTags}
              />
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
      </div>
    </div>
  );
}


