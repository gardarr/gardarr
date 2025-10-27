import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { 
  Copy, 
  Check, 
  FileText, 
  HardDrive, 
  FolderOpen,
  Activity,
  ArrowUpDown,
  Layers,
  ArrowDown,
  ArrowUp,
  Gauge,
  Database,
  Globe,
  Users,
  UserPlus,
  UserMinus,
  Play,
  Pause,
  Trash2,
  Zap,
  Radio,
  CheckCircle,
  Edit,
  Save
} from "lucide-react";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { AgentIcon } from "@/components/ui/AgentIcon";
import { TagBadge } from "@/components/ui/TagBadge";
import { DeleteTorrentModal } from "@/components/DeleteTorrentModal";
import { getStatusIcon, getStatusColor, getStatusBackgroundColor, type TorrentStatus } from "@/components/TorrentStatusIcon";
import { SelectCategory } from "@/components/SelectCategory";
import { SelectTags } from "@/components/SelectTags";
import { useTranslation } from "react-i18next";
import { torrentService } from "@/services/torrents";
import { useToast } from "@/hooks/useToast";
import { getCategoryIcon, getCategoryColor } from "@/utils/categoryUtils";
import type { Task } from "@/types/torrent";
import type { Category } from "@/types/category";
import { TorrentFilesList } from "@/components/TorrentFilesList";

interface TorrentDetailsModalProps {
  torrent: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onPlay?: (torrentId: string) => void;
  onPause?: (torrentId: string) => void;
  onDelete?: (torrentId: string, purge: boolean) => void;
  onForceDownload?: (torrentId: string) => void;
  onForceReannounce?: (torrentId: string) => void;
  onForceRecheck?: (torrentId: string) => void;
  onRename?: (torrentId: string, newName: string) => void;
  onSetLocation?: (torrentId: string, location: string) => void;
  onUpdateCategory?: (torrentId: string, category: string) => void;
  onUpdateTags?: (torrentId: string, tags: string[]) => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = bytes / Math.pow(k, i);
  return `${value.toFixed(value >= 100 ? 0 : value >= 10 ? 1 : 2)} ${sizes[i]}`;
}

function truncateText(text: string, maxLength: number = 80): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + "...";
}

function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 640);
    };

    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);
    
    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

  return isMobile;
}


export function TorrentDetailsModal({ torrent, isOpen, onClose, onPlay, onPause, onDelete, onForceDownload, onForceReannounce, onForceRecheck, onRename, onSetLocation, onUpdateCategory, onUpdateTags }: TorrentDetailsModalProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingPath, setIsEditingPath] = useState(false);
  const [isEditingCategory, setIsEditingCategory] = useState(false);
  const [isEditingTags, setIsEditingTags] = useState(false);
  const [editedName, setEditedName] = useState("");
  const [editedPath, setEditedPath] = useState("");
  const [editedCategoryId, setEditedCategoryId] = useState("");
  const [editedTags, setEditedTags] = useState<string[]>([]);
  const [currentCategory, setCurrentCategory] = useState("");
  const [currentCategoryData, setCurrentCategoryData] = useState<Category | null>(null);
  const [currentTags, setCurrentTags] = useState<string[]>([]);
  const isMobile = useIsMobile();
  const { t } = useTranslation();
  const { showSuccess, showError } = useToast();

  // Initialize current values when torrent changes
  useEffect(() => {
    if (torrent) {
      setCurrentCategory(torrent.category || '');
      setCurrentTags([...(torrent.tags || [])]);
      
      // Initialize category data if available
      if (torrent.category) {
        // For now, we'll create a basic category object
        // In a real scenario, you might want to fetch the full category data
        setCurrentCategoryData({
          id: torrent.category,
          name: torrent.category,
          icon: 'Folder',
          color: 'Blue',
          directory: '',
          default_tags: [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      } else {
        setCurrentCategoryData(null);
      }
    }
  }, [torrent]);

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };


  const handleDeleteClick = () => {
    setIsDeleteModalOpen(true);
  };

  const handleDeleteConfirm = (purge: boolean) => {
    if (onDelete && torrent) {
      onDelete(torrent.id, purge);
    }
    setIsDeleteModalOpen(false);
  };

  const handleEditName = () => {
    if (isEditingName) {
      // Salvar
      if (onRename && torrent && editedName.trim() !== '') {
        onRename(torrent.id, editedName);
      }
      setIsEditingName(false);
    } else {
      // Entrar em modo de edição
      setEditedName(torrent?.name || '');
      setIsEditingName(true);
    }
  };

  const handleCancelEditName = () => {
    setEditedName(torrent?.name || '');
    setIsEditingName(false);
  };

  const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleEditName();
    } else if (e.key === 'Escape') {
      handleCancelEditName();
    }
  };

  const handleEditPath = () => {
    if (isEditingPath) {
      // Salvar
      if (onSetLocation && torrent && editedPath.trim() !== '') {
        onSetLocation(torrent.id, editedPath);
      }
      setIsEditingPath(false);
    } else {
      // Entrar em modo de edição
      setEditedPath(torrent?.path || '');
      setIsEditingPath(true);
    }
  };

  const handleCancelEditPath = () => {
    setEditedPath(torrent?.path || '');
    setIsEditingPath(false);
  };

  const handlePathKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleEditPath();
    } else if (e.key === 'Escape') {
      handleCancelEditPath();
    }
  };

  const handleEditCategory = async () => {
    if (isEditingCategory) {
      // Salvar
      if (torrent && editedCategoryId.trim() !== '' && torrent.agent?.uuid) {
        try {
          await torrentService.updateTaskCategory(torrent.agent.uuid, torrent.id, editedCategoryId);
          
          // Update local state
          setCurrentCategory(editedCategoryId);
          
          // Callback opcional para atualizar o estado local
          if (onUpdateCategory) {
            onUpdateCategory(torrent.id, editedCategoryId);
          }
          
          showSuccess("Categoria atualizada com sucesso");
          
          setIsEditingCategory(false);
        } catch (error) {
          console.error('Failed to update category:', error);
          showError("Falha ao atualizar categoria");
        }
      }
    } else {
      // Entrar em modo de edição
      setEditedCategoryId(currentCategory);
      setIsEditingCategory(true);
    }
  };

  const handleCancelEditCategory = () => {
    setEditedCategoryId(currentCategory);
    setIsEditingCategory(false);
  };

  const handleCategoryChange = (categoryId: string, category?: Category) => {
    setEditedCategoryId(categoryId);
    if (category) {
      setCurrentCategoryData(category);
    }
  };

  const handleEditTags = async () => {
    if (isEditingTags) {
      // Salvar
      if (torrent && torrent.agent?.uuid) {
        try {
          await torrentService.updateTaskTags(torrent.agent.uuid, torrent.id, editedTags);
          
          // Update local state
          setCurrentTags([...editedTags]);
          
          // Callback opcional para atualizar o estado local
          if (onUpdateTags) {
            onUpdateTags(torrent.id, editedTags);
          }
          
          showSuccess("Tags atualizadas com sucesso");
          
          setIsEditingTags(false);
        } catch (error) {
          console.error('Failed to update tags:', error);
          showError("Falha ao atualizar tags");
        }
      }
    } else {
      // Entrar em modo de edição
      setEditedTags([...currentTags]);
      setIsEditingTags(true);
    }
  };

  const handleCancelEditTags = () => {
    setEditedTags([...currentTags]);
    setIsEditingTags(false);
  };

  const handleTagsChange = (tags: string[]) => {
    setEditedTags(tags);
  };

  if (!torrent) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-[95vw] max-h-[85vh] overflow-y-auto mx-0 sm:w-auto sm:max-w-4xl sm:max-h-[90vh]">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4 pr-0 sm:pr-8">
            <div className="flex-1">
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Detalhes do Torrent
              </DialogTitle>
              <DialogDescription>
                Informações completas sobre o torrent selecionado
              </DialogDescription>
            </div>
            {/* Botões de ação - Desktop apenas */}
            <ButtonGroup className="hidden sm:flex flex-shrink-0 mt-1">
              {onPlay && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => onPlay(torrent.id)}
                      className="h-10 w-10"
                      aria-label={t('torrents.actionButtons.play')}
                    >
                      <Play className="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {t('torrents.actionButtons.play')}
                  </TooltipContent>
                </Tooltip>
              )}
              {onPause && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => onPause(torrent.id)}
                      className="h-10 w-10"
                      aria-label={t('torrents.actionButtons.pause')}
                    >
                      <Pause className="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {t('torrents.actionButtons.pause')}
                  </TooltipContent>
                </Tooltip>
              )}
              {onForceDownload && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => onForceDownload(torrent.id)}
                      className="h-10 w-10 text-orange-600 hover:text-orange-700 hover:bg-orange-50 dark:hover:bg-orange-950 dark:text-orange-400 dark:hover:text-orange-300"
                      aria-label="Force Download"
                    >
                      <Zap className="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    Force Download
                  </TooltipContent>
                </Tooltip>
              )}
              {onForceReannounce && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => onForceReannounce(torrent.id)}
                      className="h-10 w-10 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950 dark:text-blue-400 dark:hover:text-blue-300"
                      aria-label="Force Reannounce"
                    >
                      <Radio className="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    Force Reannounce
                  </TooltipContent>
                </Tooltip>
              )}
              {onForceRecheck && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => onForceRecheck(torrent.id)}
                      className="h-10 w-10 text-purple-600 hover:text-purple-700 hover:bg-purple-50 dark:hover:bg-purple-950 dark:text-purple-400 dark:hover:text-purple-300"
                      aria-label="Force Recheck"
                    >
                      <CheckCircle className="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    Force Recheck
                  </TooltipContent>
                </Tooltip>
              )}
              {onDelete && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleDeleteClick}
                      className="h-10 w-10 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950 dark:text-red-400 dark:hover:text-red-300"
                      aria-label={t('torrents.actionButtons.delete')}
                    >
                      <Trash2 className="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {t('torrents.actionButtons.delete')}
                  </TooltipContent>
                </Tooltip>
              )}
            </ButtonGroup>
          </div>
        </DialogHeader>

        {/* Botões de ação - Mobile apenas (abaixo do header) */}
        <div className="flex sm:hidden overflow-x-auto pb-3 border-b scrollbar-hide"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          <ButtonGroup className="flex-shrink-0">
          {onPlay && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => onPlay(torrent.id)}
                  className="h-12 w-12 flex-shrink-0"
                  aria-label={t('torrents.actionButtons.play')}
                >
                  <Play className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {t('torrents.actionButtons.play')}
              </TooltipContent>
            </Tooltip>
          )}
          {onPause && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => onPause(torrent.id)}
                  className="h-12 w-12 flex-shrink-0"
                  aria-label={t('torrents.actionButtons.pause')}
                >
                  <Pause className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {t('torrents.actionButtons.pause')}
              </TooltipContent>
            </Tooltip>
          )}
          {onForceDownload && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => onForceDownload(torrent.id)}
                  className="h-12 w-12 flex-shrink-0 text-orange-600 hover:text-orange-700 hover:bg-orange-50 dark:hover:bg-orange-950 dark:text-orange-400 dark:hover:text-orange-300"
                  aria-label="Force Download"
                >
                  <Zap className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                Force Download
              </TooltipContent>
            </Tooltip>
          )}
          {onForceReannounce && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => onForceReannounce(torrent.id)}
                  className="h-12 w-12 flex-shrink-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950 dark:text-blue-400 dark:hover:text-blue-300"
                  aria-label="Force Reannounce"
                >
                  <Radio className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                Force Reannounce
              </TooltipContent>
            </Tooltip>
          )}
          {onForceRecheck && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => onForceRecheck(torrent.id)}
                  className="h-12 w-12 flex-shrink-0 text-purple-600 hover:text-purple-700 hover:bg-purple-50 dark:hover:bg-purple-950 dark:text-purple-400 dark:hover:text-purple-300"
                  aria-label="Force Recheck"
                >
                  <CheckCircle className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                Force Recheck
              </TooltipContent>
            </Tooltip>
          )}
          {onDelete && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleDeleteClick}
                  className="h-12 w-12 flex-shrink-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950 dark:text-red-400 dark:hover:text-red-300"
                  aria-label={t('torrents.actionButtons.delete')}
                >
                  <Trash2 className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {t('torrents.actionButtons.delete')}
              </TooltipContent>
            </Tooltip>
          )}
          </ButtonGroup>
        </div>

        <div className="space-y-3 sm:space-y-6">
          {/* Nome do Torrent */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">Nome</h3>
            <div className="flex items-start gap-2">
              <div className="flex items-start gap-2 p-2 sm:p-3 container-content-background/50 rounded-lg min-w-0 flex-1">
                <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                {isEditingName ? (
                  <Input
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    onKeyDown={handleNameKeyDown}
                    className="text-xs sm:text-sm font-medium flex-1 h-8 px-2"
                    autoFocus
                  />
                ) : (
                  <span className="text-xs sm:text-sm font-medium break-words flex-1 leading-relaxed">
                    {truncateText(torrent.name, isMobile ? 40 : 100)}
                  </span>
                )}
                {!isEditingName && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(torrent.name, 'name')}
                    className="h-8 w-8 p-0 flex-shrink-0"
                  >
                    {copiedField === 'name' ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                )}
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleEditName}
                    className="h-8 w-8 p-0 flex-shrink-0 mt-2 sm:mt-3"
                  >
                    {isEditingName ? (
                      <Save className="h-4 w-4" />
                    ) : (
                      <Edit className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {isEditingName ? 'Salvar nome' : 'Editar nome'}
                </TooltipContent>
              </Tooltip>
            </div>
          </div>


          {/* Informações Gerais */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground">Informações Gerais</h3>
            <div className="space-y-4">
              {/* Card Status - Full width */}
              <div className="p-3 container-content-background/50 rounded-lg border">
                <div className="flex items-center gap-2 mb-3">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</h4>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Estado:</span>
                    <div className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium w-fit ${getStatusBackgroundColor(torrent.state as TorrentStatus)} ${getStatusColor(torrent.state as TorrentStatus)}`}>
                      {(() => {
                        const StatusIcon = getStatusIcon(torrent.state as TorrentStatus);
                        return <StatusIcon className="h-4 w-4" />;
                      })()}
                      <span className="capitalize">{torrent.state}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Cards Tamanho e Ratio - Always on same row */}
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                {/* Card Tamanho e Progresso */}
                <div className="p-3 container-content-background/50 rounded-lg border">
                  <div className="flex items-center gap-2 mb-3">
                    <HardDrive className="h-4 w-4 text-muted-foreground" />
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tamanho</h4>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Total:</span>
                      <span className="text-sm text-muted-foreground">{formatBytes(torrent.size)}</span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Progresso:</span>
                        <span className="text-sm text-muted-foreground">{torrent.progress.toFixed(1)}%</span>
                      </div>
                      <ProgressBar progress={torrent.progress} height="sm" />
                    </div>
                  </div>
                </div>

                {/* Card Ratio e Popularidade */}
                <div className="p-3 container-content-background/50 rounded-lg border">
                  <div className="flex items-center gap-2 mb-3">
                    <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Ratio</h4>
                  </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Ratio:</span>
                    <span className="text-sm text-muted-foreground">{torrent.ratio.toFixed(2)}x</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Popularidade:</span>
                    <span className="text-sm text-muted-foreground">{torrent.popularity.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Prioridade:</span>
                    <span className="text-sm text-muted-foreground">{torrent.priority}</span>
                  </div>
                </div>
                </div>
              </div>

              {/* Card Categoria */}
              <div className="p-3 container-content-background/50 rounded-lg border">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-muted-foreground" />
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Categoria</h4>
                  </div>
                  {!isEditingCategory && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 bg-primary hover:bg-primary/90"
                          aria-label="Editar categoria"
                          onClick={handleEditCategory}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        Editar categoria
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
                <div className="space-y-2">
                  {isEditingCategory ? (
                    <div className="space-y-2">
                      <SelectCategory
                        selectedCategoryId={editedCategoryId}
                        onCategoryChange={handleCategoryChange}
                        label=""
                        required={false}
                        showAddButton={false}
                        className="mb-2"
                      />
                      <div className="flex gap-2 justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleCancelEditCategory}
                          className="h-8 px-3"
                        >
                          Cancelar
                        </Button>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={handleEditCategory}
                          className="h-8 px-3"
                        >
                          Salvar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Categoria:</span>
                      <div className="flex items-center gap-2">
                        {currentCategoryData ? (
                          <>
                            {(() => {
                              const IconComponent = getCategoryIcon(currentCategoryData.icon);
                              const color = getCategoryColor(currentCategoryData.color);
                              return (
                                <IconComponent 
                                  className="h-4 w-4" 
                                  style={{ color }}
                                />
                              );
                            })()}
                            <span className="text-sm text-muted-foreground">{currentCategoryData.name}</span>
                          </>
                        ) : (
                          <span className="text-sm text-muted-foreground">{currentCategory || 'N/A'}</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Card Tags */}
              {(currentTags && currentTags.length > 0) || isEditingTags ? (
                <div className="p-3 container-content-background/50 rounded-lg border">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Layers className="h-4 w-4 text-muted-foreground" />
                      <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tags</h4>
                    </div>
                    {!isEditingTags && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 bg-primary hover:bg-primary/90"
                            aria-label="Editar tags"
                            onClick={handleEditTags}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          Editar tags
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                  <div className="space-y-2">
                    {isEditingTags ? (
                      <div className="space-y-2">
                        <SelectTags
                          tags={editedTags}
                          onTagsChange={handleTagsChange}
                          label=""
                          required={false}
                          placeholder="Digite tags e pressione Enter"
                          className="mb-2"
                        />
                        <div className="flex gap-2 justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleCancelEditTags}
                            className="h-8 px-3"
                          >
                            Cancelar
                          </Button>
                          <Button
                            variant="default"
                            size="sm"
                            onClick={handleEditTags}
                            className="h-8 px-3"
                          >
                            Salvar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {currentTags?.map((tag, index) => (
                          <TagBadge
                            key={index}
                            tag={tag}
                            size="sm"
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : null}

              {/* Card Agent */}
              {torrent.agent && (
                <div className="p-3 container-content-background/50 rounded-lg border">
                  <div className="flex items-center gap-2 mb-3">
                    <AgentIcon 
                      iconName={torrent.agent.icon}
                      color={torrent.agent.color}
                      size="sm"
                    />
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Agent</h4>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Nome:</span>
                    <span className="text-sm text-muted-foreground">{torrent.agent.name}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Caminho */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">Caminho</h3>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 p-2 sm:p-3 container-content-background/50 rounded-lg flex-1">
                <FolderOpen className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                {isEditingPath ? (
                  <Input
                    value={editedPath}
                    onChange={(e) => setEditedPath(e.target.value)}
                    onKeyDown={handlePathKeyDown}
                    className="text-xs sm:text-sm flex-1 h-8 px-2"
                    autoFocus
                  />
                ) : (
                  <span className="text-xs sm:text-sm break-all flex-1">
                    {truncateText(torrent.path, isMobile ? 35 : 80)}
                  </span>
                )}
                {!isEditingPath && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(torrent.path, 'path')}
                    className="h-8 w-8 p-0 flex-shrink-0"
                  >
                    {copiedField === 'path' ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                )}
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleEditPath}
                    className="h-8 w-8 p-0 flex-shrink-0"
                  >
                    {isEditingPath ? (
                      <Save className="h-4 w-4" />
                    ) : (
                      <Edit className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {isEditingPath ? 'Salvar caminho' : 'Editar caminho'}
                </TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* Arquivos do Torrent */}
          <Separator />
          <TorrentFilesList
            agentId={torrent.agent?.uuid || ""}
            taskId={torrent.id}
            showAccordion={true}
            title="Lista de Arquivos"
          />

          <Separator />

          {/* Rede e Pares */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground">Rede e Pares</h3>
            
            {/* Barra de Progresso de Seeding */}
            <div className="space-y-3 p-3 container-content-background/50 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Contribuição para a Rede</span>
                <span className="text-sm font-mono font-medium">
                  {torrent.ratio.toFixed(2)}x
                </span>
              </div>
              
              {/* Barra de Proporção Download/Upload */}
              <div className="space-y-2">
                <div className="w-full h-8 rounded-lg overflow-hidden flex">
                  {(() => {
                    const downloadAmount = torrent.network.download.amount;
                    const uploadAmount = torrent.network.upload.amount;
                    const total = downloadAmount + uploadAmount;
                    const downloadPercent = total > 0 ? (downloadAmount / total) * 100 : 50;
                    const uploadPercent = total > 0 ? (uploadAmount / total) * 100 : 50;
                    
                    return (
                      <>
                        {/* Parte de Download */}
                        <div 
                          className="flex items-center justify-center text-xs font-medium text-white transition-all duration-500"
                          style={{ 
                            width: `${downloadPercent}%`,
                            background: 'linear-gradient(90deg, #3b82f6 0%, #2563eb 100%)',
                            minWidth: downloadPercent > 0 ? '20%' : '0%'
                          }}
                        >
                          {downloadPercent > 15 && (
                            <span className="truncate px-2">
                              ↓ {formatBytes(downloadAmount)}
                            </span>
                          )}
                        </div>
                        
                        {/* Parte de Upload */}
                        <div 
                          className="flex items-center justify-center text-xs font-medium text-white transition-all duration-500"
                          style={{ 
                            width: `${uploadPercent}%`,
                            background: 'linear-gradient(90deg, #10b981 0%, #059669 100%)',
                            minWidth: uploadPercent > 0 ? '20%' : '0%'
                          }}
                        >
                          {uploadPercent > 15 && (
                            <span className="truncate px-2">
                              ↑ {formatBytes(uploadAmount)}
                            </span>
                          )}
                        </div>
                      </>
                    );
                  })()}
                </div>
                
                {/* Labels abaixo da barra */}
                <div className="flex justify-between items-center text-xs px-1">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded" style={{ background: '#3b82f6' }}></div>
                    <span className="font-medium text-muted-foreground">Baixado:</span>
                    <span className="font-mono">{formatBytes(torrent.network.download.amount)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded" style={{ background: '#10b981' }}></div>
                    <span className="font-medium text-muted-foreground">Enviado:</span>
                    <span className="font-mono">{formatBytes(torrent.network.upload.amount)}</span>
                  </div>
                </div>
              </div>
              
              {/* Status do seeding */}
              {torrent.ratio >= 1 && (
                <div className="text-center">
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    torrent.ratio >= 2 
                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                      : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                  }`}>
                    {torrent.ratio >= 2 
                      ? '🌱 Excelente contribuidor!' 
                      : '📈 Boa contribuição'
                    }
                  </span>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              {/* Card Download */}
              <div className="p-3 container-content-background/50 rounded-lg border">
                <div className="flex items-center gap-2 mb-3">
                  <ArrowDown className="h-4 w-4 text-blue-500" />
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Download</h4>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <Gauge className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-sm">Velocidade:</span>
                    </div>
                    <span className="text-sm text-muted-foreground">{formatBytes(torrent.network.download.speed)}/s</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <Database className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-sm">Total:</span>
                    </div>
                    <span className="text-sm text-muted-foreground">{formatBytes(torrent.network.download.amount)}</span>
                  </div>
                </div>
              </div>

              {/* Card Upload */}
              <div className="p-3 container-content-background/50 rounded-lg border">
                <div className="flex items-center gap-2 mb-3">
                  <ArrowUp className="h-4 w-4 text-green-500" />
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Upload</h4>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <Gauge className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-sm">Velocidade:</span>
                    </div>
                    <span className="text-sm text-muted-foreground">{formatBytes(torrent.network.upload.speed)}/s</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <Database className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-sm">Total:</span>
                    </div>
                    <span className="text-sm text-muted-foreground">{formatBytes(torrent.network.upload.amount)}</span>
                  </div>
                </div>
              </div>

              {/* Card Swarm */}
              <div className="p-3 container-content-background/50 rounded-lg border">
                <div className="flex items-center gap-2 mb-3">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Swarm</h4>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <UserPlus className="h-3.5 w-3.5 text-green-600" />
                      <span className="text-sm">Seeders:</span>
                    </div>
                    <span className="text-sm text-muted-foreground">{torrent.pairs.swarm_seeders}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <UserMinus className="h-3.5 w-3.5 text-orange-600" />
                      <span className="text-sm">Leechers:</span>
                    </div>
                    <span className="text-sm text-muted-foreground">{torrent.pairs.swarm_leechers}</span>
                  </div>
                </div>
              </div>

              {/* Card Conectados */}
              <div className="p-3 container-content-background/50 rounded-lg border">
                <div className="flex items-center gap-2 mb-3">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Conectados</h4>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <UserPlus className="h-3.5 w-3.5 text-green-600" />
                      <span className="text-sm">Seeders:</span>
                    </div>
                    <span className="text-sm text-muted-foreground">{torrent.pairs.seeders}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <UserMinus className="h-3.5 w-3.5 text-orange-600" />
                      <span className="text-sm">Leechers:</span>
                    </div>
                    <span className="text-sm text-muted-foreground">{torrent.pairs.leechers}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Informações do Magnet Link */}
          <Separator />
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">Detalhes do Magnet</h3>
            
            {/* Hash */}
            <div className="space-y-2">
              <span className="text-sm font-medium">Hash:</span>
              <div className="relative">
                <div className="p-3 container-content-background/50 rounded-lg border pr-12">
                  <span className="text-xs sm:text-sm font-mono break-all">
                    {truncateText(torrent.hash, isMobile ? 25 : 60)}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(torrent.hash, 'hash')}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
                >
                  {copiedField === 'hash' ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* Magnet Link */}
            <div className="space-y-2">
              <span className="text-sm font-medium">Magnet Link:</span>
              <div className="relative">
                <div className="p-3 container-content-background/50 rounded-lg border pr-12">
                  <span 
                    className="text-xs sm:text-sm font-mono break-all" 
                    title={torrent.magnet_uri}
                  >
                    {truncateText(torrent.magnet_uri, isMobile ? 30 : 70)}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(torrent.magnet_uri, 'magnet')}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
                >
                  {copiedField === 'magnet' ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* Magnet Link Details */}
            {torrent.magnet_link && (
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-medium">Display Name:</span>
                  <span className="text-muted-foreground">{torrent.magnet_link.display_name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">Exact Length:</span>
                  <span className="text-muted-foreground">{torrent.magnet_link.exact_length}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">Exact Source:</span>
                  <span className="text-muted-foreground">{torrent.magnet_link.exact_source}</span>
                </div>
                {torrent.magnet_link.trackers && torrent.magnet_link.trackers.length > 0 && (
                  <div>
                    <span className="font-medium">Trackers:</span>
                    <ul className="list-disc list-inside ml-2 text-muted-foreground">
                      {torrent.magnet_link.trackers.map((tracker, index) => (
                        <li key={index} className="break-all">{tracker}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

        </div>
      </DialogContent>

      {/* Modal de confirmação de deleção */}
      <DeleteTorrentModal
        isOpen={isDeleteModalOpen}
        torrentName={torrent.name}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDeleteConfirm}
      />
    </Dialog>
  );
}
