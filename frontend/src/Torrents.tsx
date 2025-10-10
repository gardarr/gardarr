import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ArrowDownCircle, ArrowUpCircle, PauseCircle, AlertTriangle, MoreHorizontal, Info, Trash2, Search, ChevronLeft, ChevronRight, Loader2, ChevronDown, SortAsc, SortDesc, Server, Clock, XCircle, FileX, Play, RotateCcw, HardDrive } from "lucide-react";
import { useEffect, useRef, useState, useMemo } from "react";
import { torrentService } from "./services/torrents";
import { agentService } from "./services/agents";
import type { Task } from "./types/torrent";
import type { Agent, AgentStatus } from "./types/agent";
import AgentFilter from "@/components/ui/AgentFilter";

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

// Função para calcular nota baseada no ratio (estilo Devil May Cry)
function getRatioGrade(ratio: number): string {
  if (ratio >= 30) return "S";
  if (ratio >= 15) return "A";
  if (ratio >= 7) return "B";
  if (ratio >= 3) return "C";
  return "D";
}

// Função para obter cor da badge baseada na nota (estilo Devil May Cry)
function getGradeColor(grade: string): string {
  switch (grade) {
    case "S":
      return "bg-gradient-to-r from-yellow-200 via-yellow-300 to-yellow-400 text-yellow-700 font-bold shadow-sm shadow-yellow-300/30";
    case "A":
      return "bg-gradient-to-r from-green-400 via-green-500 to-green-600 text-green-900 font-bold shadow-sm shadow-green-500/30";
    case "B":
      return "bg-gradient-to-r from-blue-400 via-blue-500 to-blue-600 text-blue-900 font-semibold shadow-sm shadow-blue-500/20";
    case "C":
      return "bg-gradient-to-r from-orange-400 via-orange-500 to-orange-600 text-orange-900 font-semibold shadow-sm shadow-orange-500/20";
    case "D":
      return "bg-gradient-to-r from-red-400 via-red-500 to-red-600 text-red-900 font-semibold shadow-sm shadow-red-500/20";
    default:
      return "bg-gray-400 text-gray-900 font-semibold";
  }
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

// Função para obter label do tipo de ordenação
function getSortTypeLabel(sortType: SortType): string {
  switch (sortType) {
    case "priority": return "prioridade";
    case "alphabetical": return "alfabético";
    case "size": return "tamanho";
    case "progress": return "progresso";
    case "download_speed": return "velocidade de download";
    case "upload_speed": return "velocidade de upload";
    case "downloaded": return "baixado";
    case "uploaded": return "enviado";
    default: return "nome";
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

// Componente Badge para exibir nota do ratio (estilo Devil May Cry)
function RatioBadge({ ratio }: { ratio: number }) {
  const grade = getRatioGrade(ratio);
  const colorClass = getGradeColor(grade);
  
  return (
    <div className="flex items-center gap-2">
      <span 
        className={`inline-flex items-center px-2.5 py-1.5 rounded-lg text-xs font-mono tracking-widest border-2 border-black/20 transform transition-all duration-200 hover:scale-105 ${colorClass}`}
        title={`Ratio: ${ratio.toFixed(2)} - Nota: ${grade} (${getGradeDescription(grade)})`}
      >
        {grade}
      </span>
      <span className="text-xs text-muted-foreground font-mono">
        {ratio.toFixed(1)}
      </span>
    </div>
  );
}

// Função para obter descrição da nota
function getGradeDescription(grade: string): string {
  switch (grade) {
    case "SSS": return "PERFEITO!";
    case "SS": return "EXCELENTE!";
    case "S": return "MUITO BOM!";
    case "A": return "BOM";
    case "B": return "REGULAR";
    case "C": return "RUIM";
    case "D": return "MUITO RUIM";
    default: return "DESCONHECIDO";
  }
}

function TorrentCard({ torrent, onDelete, isDeleting }: { 
  torrent: Torrent; 
  onDelete: (id: string, purge: boolean) => void;
  isDeleting: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const StatusIcon = getStatusIcon(torrent.status);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
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
        <div className="relative" ref={menuRef}>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            aria-label="Mais opções"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 mt-1 w-36 rounded-md border bg-card text-card-foreground shadow-md z-10 py-1"
            >
              <button
                role="menuitem"
                className="w-full flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
                onClick={() => {
                  setMenuOpen(false);
                  // ação: abrir detalhes
                }}
              >
                <Info className="h-4 w-4" />
                Detalhes
              </button>
              <button
                role="menuitem"
                className="w-full flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
                onClick={() => {
                  setMenuOpen(false);
                  onDelete(torrent.id, false);
                }}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                <Trash2 className="h-4 w-4" />
                )}
                {isDeleting ? 'Removendo...' : 'Remover'}
              </button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold mb-1">{formatBytes(torrent.totalSizeBytes)}</div>
        <div className="mb-2">
          <div className="w-full bg-secondary rounded-full h-2">
            <div 
              className="bg-primary h-2 rounded-full transition-all duration-300" 
              style={{ width: `${torrent.progress}%` }}
            ></div>
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {torrent.progress.toFixed(1)}% concluído
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <StatusIcon 
                  className={`h-3 w-3 ${getStatusColor(torrent.status)}`} 
                />
              </TooltipTrigger>
              <TooltipContent>
                <p>{torrent.status}</p>
              </TooltipContent>
            </Tooltip>
            <span className="font-medium">Status: </span>
            <span className="capitalize">{torrent.status}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-medium">Ratio: </span>
            <RatioBadge ratio={torrent.ratio} />
          </div>
          <div>
            <span className="font-medium">Download: </span>
            <span>{formatRate(torrent.downloadRateBps)}</span>
          </div>
          <div>
            <span className="font-medium">Upload: </span>
            <span>{formatRate(torrent.uploadRateBps)}</span>
          </div>
          <div>
            <span className="font-medium">Seeds: </span>
            <span>{torrent.numSeeds}</span>
          </div>
          <div>
            <span className="font-medium">Leechs: </span>
            <span>{torrent.numLeechs}</span>
          </div>
          <div>
            <span className="font-medium">Downloaded: </span>
            <span>{formatBytes(torrent.downloadedBytes)}</span>
          </div>
          <div>
            <span className="font-medium">Uploaded: </span>
            <span>{formatBytes(torrent.uploadedBytes)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TorrentRow({ torrent, onDelete, isDeleting }: { 
  torrent: Torrent; 
  onDelete: (id: string, purge: boolean) => void;
  isDeleting: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const StatusIcon = getStatusIcon(torrent.status);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  return (
    <tr className="border-b hover:bg-muted/50 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center justify-center">
          <Tooltip>
            <TooltipTrigger asChild>
              <StatusIcon 
                className={`h-4 w-4 ${getStatusColor(torrent.status)}`} 
              />
            </TooltipTrigger>
            <TooltipContent>
              <p>{torrent.status}</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </td>
      <td className="px-4 py-3">
        <span 
          className="text-sm font-medium truncate block" 
          title={isTextTruncated(torrent.name) ? `${torrent.name} (truncado)` : torrent.name}
        >
          {truncateText(torrent.name)}
        </span>
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
        {formatRate(torrent.downloadRateBps)}
      </td>
      <td className="px-4 py-3 text-sm">
        {formatRate(torrent.uploadRateBps)}
      </td>
      <td className="px-4 py-3 text-sm">
        {formatBytes(torrent.downloadedBytes)}
      </td>
      <td className="px-4 py-3 text-sm">
        {formatBytes(torrent.uploadedBytes)}
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
      <td className="px-4 py-3">
        <div className="relative" ref={menuRef}>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            aria-label="Mais opções"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 mt-1 w-36 rounded-md border bg-card text-card-foreground shadow-md z-10 py-1"
            >
              <button
                role="menuitem"
                className="w-full flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
                onClick={() => {
                  setMenuOpen(false);
                  // ação: abrir detalhes
                }}
              >
                <Info className="h-4 w-4" />
                Detalhes
              </button>
              <button
                role="menuitem"
                className="w-full flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
                onClick={() => {
                  setMenuOpen(false);
                  onDelete(torrent.id, false);
                }}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                <Trash2 className="h-4 w-4" />
                )}
                {isDeleting ? 'Removendo...' : 'Remover'}
              </button>
            </div>
          )}
        </div>
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
          className="absolute right-0 mt-1 w-20 rounded-md border bg-card text-card-foreground shadow-md z-10 py-1"
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
          className="absolute right-0 mt-1 w-24 rounded-md border bg-card text-card-foreground shadow-md z-10 py-1"
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
  const [torrents, setTorrents] = useState<Torrent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [deletingTorrents, setDeletingTorrents] = useState<Set<string>>(new Set());
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortType, setSortType] = useState<SortType>("priority");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentIds, setSelectedAgentIds] = useState<Set<string>>(new Set());
  const [refreshIntervalSec, setRefreshIntervalSec] = useState<number>(5);

  // Carregar torrents da API
  const loadTorrents = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await torrentService.listTasks();
      
      if (response.error) {
        setError(response.error);
        return;
      }
      
      if (response.data) {
        const mappedTorrents = response.data.map(mapTaskToTorrent);
        setTorrents(mappedTorrents);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar torrents');
    } finally {
      setLoading(false);
    }
  };

  // Atualização silenciosa para não afetar UI (sem spinner)
  const refreshTorrentsSilently = async () => {
    try {
      const response = await torrentService.listTasks();
      if (response?.data) {
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

  // Remover torrent
  const handleDeleteTorrent = async (torrentId: string, purge: boolean = false) => {
    try {
      setDeletingTorrents(prev => new Set(prev).add(torrentId));
      const response = await torrentService.deleteTask(torrentId, purge);
      
      if (response.error) {
        setError(response.error);
        return;
      }
      
      // Recarregar a lista após remoção
      await loadTorrents();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao remover torrent');
    } finally {
      setDeletingTorrents(prev => {
        const newSet = new Set(prev);
        newSet.delete(torrentId);
        return newSet;
      });
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
        // quando não houver agentName (dados antigos), mantém visível apenas se "Todos" estiver efetivamente selecionando tudo
        if (!t.agentUUID) return selectedAgentIds.size === agents.length;
        return selectedAgentIds.has(t.agentUUID);
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
  }, [torrents, searchTerm, sortType, sortDirection, agents, selectedAgentIds]);

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

  // Selecionar ou limpar todos
  const setAllAgents = (checked: boolean) => {
    if (checked) {
      setSelectedAgentIds(new Set(agents.map((a) => a.uuid)));
    } else {
      setSelectedAgentIds(new Set());
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
            <h1 className="text-3xl font-bold tracking-tight">Torrents</h1>
            <p className="text-muted-foreground">
              Gerencie seus downloads e uploads
            </p>
          </div>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando torrents...
          </div>
        </div>
      </div>
    );
  }

  // Mostrar erro
  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Torrents</h1>
            <p className="text-muted-foreground">
              Gerencie seus downloads e uploads
            </p>
          </div>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="text-center space-y-4">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
            <div>
              <h3 className="text-lg font-semibold">Erro ao carregar torrents</h3>
              <p className="text-muted-foreground">{error}</p>
            </div>
            <Button onClick={loadTorrents} variant="outline">
              Tentar novamente
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Torrents</h1>
          <p className="text-muted-foreground">
            Gerencie seus downloads e uploads
          </p>
        </div>
      </div>

      {/* Filtro de busca e controles */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="relative flex-1 max-w-sm w-full">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Buscar torrents..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground hidden sm:inline">Itens por página:</span>
          <span className="text-sm text-muted-foreground sm:hidden">Por página:</span>
          <ItemsPerPageDropdown 
            value={itemsPerPage} 
            onChange={handleItemsPerPageChange} 
          />
        </div>
      {/* Dropdown de atualização */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground hidden sm:inline">Update:</span>
        <span className="text-sm text-muted-foreground sm:hidden">Upd.:</span>
        <UpdateIntervalDropdown
          value={refreshIntervalSec}
          onChange={setRefreshIntervalSec}
        />
      </div>
      {/* Dropdown de agentes */}
      <div className="flex items-center gap-2">
        <div className="relative">
          <AgentFilter 
            agents={agents}
            selectedAgentIds={selectedAgentIds}
            onToggleAgent={toggleAgent}
            onSetAll={setAllAgents}
          />
        </div>
      </div>
        <div className="text-sm text-muted-foreground">
          {filteredTorrents.length} de {torrents.length} torrents
          <span className="ml-2 text-xs">
            (ordenados por {getSortTypeLabel(sortType)} {sortDirection === "asc" ? "↑" : "↓"})
          </span>
        </div>
      </div>
      
      {/* Estado vazio */}
      {torrents.length === 0 && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center space-y-4">
            <Info className="h-12 w-12 text-muted-foreground mx-auto" />
            <div>
              <h3 className="text-lg font-semibold">Nenhum torrent encontrado</h3>
              <p className="text-muted-foreground">
                Adicione um torrent para começar a fazer download
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
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground w-12">
                    <div className="flex items-center gap-1">
                      <span>Status</span>
                      <SortButton
                        sortType="priority"
                        currentSortType={sortType}
                        currentSortDirection={sortDirection}
                        onSort={handleSortChange}
                      >
                        prioridade
                      </SortButton>
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    Nome
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <span>Tamanho</span>
                      <SortButton
                        sortType="size"
                        currentSortType={sortType}
                        currentSortDirection={sortDirection}
                        onSort={handleSortChange}
                      >
                        tamanho
                      </SortButton>
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <span>Progresso</span>
                      <SortButton
                        sortType="progress"
                        currentSortType={sortType}
                        currentSortDirection={sortDirection}
                        onSort={handleSortChange}
                      >
                        progresso
                      </SortButton>
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <span>Download</span>
                      <SortButton
                        sortType="download_speed"
                        currentSortType={sortType}
                        currentSortDirection={sortDirection}
                        onSort={handleSortChange}
                      >
                        velocidade de download
                      </SortButton>
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <span>Upload</span>
                      <SortButton
                        sortType="upload_speed"
                        currentSortType={sortType}
                        currentSortDirection={sortDirection}
                        onSort={handleSortChange}
                      >
                        velocidade de upload
                      </SortButton>
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <span>Downloaded</span>
                      <SortButton
                        sortType="downloaded"
                        currentSortType={sortType}
                        currentSortDirection={sortDirection}
                        onSort={handleSortChange}
                      >
                        baixado
                      </SortButton>
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <span>Uploaded</span>
                      <SortButton
                        sortType="uploaded"
                        currentSortType={sortType}
                        currentSortDirection={sortDirection}
                        onSort={handleSortChange}
                      >
                        enviado
                      </SortButton>
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    Ratio
                  </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                Agent
              </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground w-12">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedTorrents.map((t) => (
                  <TorrentRow 
                    key={t.id} 
                    torrent={t} 
                    onDelete={handleDeleteTorrent}
                    isDeleting={deletingTorrents.has(t.id)}
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
              Página {currentPage} de {totalPages} ({filteredTorrents.length} torrents)
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePreviousPage}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNextPage}
                disabled={currentPage === totalPages}
              >
                Próxima
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Layout para mobile - Cards em coluna única */}
      <div className="md:hidden">
        {/* Mobile sorting controls */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm font-medium text-muted-foreground">Ordenar por:</span>
            <span className="text-xs text-muted-foreground">
              {getSortTypeLabel(sortType)} {sortDirection === "asc" ? "↑" : "↓"}
            </span>
          </div>
        {/* Filtro de agentes no mobile */}
        {agents.length > 0 && (
          <Card className="mb-3 py-2 px-3">
            <div className="flex items-center gap-2 p-0">
              <span className="text-sm font-medium whitespace-nowrap">Agentes</span>
              <div className="flex gap-2 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                <Button
                  variant={selectedAgentIds.size === agents.length ? "default" : "outline"}
                  size="sm"
                  onClick={() => setAllAgents(true)}
                  className="flex-shrink-0 text-xs"
                >
                  Todos
                </Button>
                {agents.map((a) => (
                  <Button
                    key={a.uuid}
                    variant={selectedAgentIds.has(a.uuid) ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleAgent(a.uuid)}
                    className="flex-shrink-0 text-xs flex items-center gap-1"
                    title={a.name}
                  >
                    <Server className={`h-3 w-3 ${getAgentStatusColor(a.status)}`} />
                    {a.name}
                  </Button>
                ))}
              </div>
            </div>
          </Card>
        )}
          <div className="flex gap-2 overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <Button
              variant={sortType === "priority" ? "default" : "outline"}
              size="sm"
              onClick={() => handleSortChange("priority")}
              className="flex-shrink-0 text-xs flex items-center gap-1"
            >
              Prioridade
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
              Nome
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
              Tamanho
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
              Progresso
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
              Download
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
              Upload
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
              Baixado
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
              Enviado
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
        
        <div className="space-y-4">
          {paginatedTorrents.map((t) => (
            <TorrentCard 
              key={t.id} 
              torrent={t} 
              onDelete={handleDeleteTorrent}
              isDeleting={deletingTorrents.has(t.id)}
            />
          ))}
        </div>
        
        {/* Controles de paginação para mobile */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <div className="text-sm text-muted-foreground">
              {currentPage} de {totalPages}
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
    </div>
  );
}


