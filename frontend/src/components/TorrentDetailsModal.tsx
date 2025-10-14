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
import { 
  Copy, 
  Check, 
  Hash, 
  Link, 
  FileText, 
  HardDrive, 
  Server,
  Tag,
  FolderOpen,
  Activity,
  ArrowUpDown,
  Flag,
  Layers,
  TrendingUp,
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
  Trash2
} from "lucide-react";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { useTranslation } from "react-i18next";
import type { Task } from "@/types/torrent";

interface TorrentDetailsModalProps {
  torrent: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onPlay?: (torrentId: string) => void;
  onPause?: (torrentId: string) => void;
  onDelete?: (torrentId: string) => void;
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


export function TorrentDetailsModal({ torrent, isOpen, onClose, onPlay, onPause, onDelete }: TorrentDetailsModalProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const isMobile = useIsMobile();
  const { t } = useTranslation();

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  if (!torrent) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[90vw] max-w-[90vw] max-h-[85vh] overflow-y-auto mx-4 sm:mx-0 sm:w-auto sm:max-w-4xl sm:max-h-[90vh]">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4 pr-8">
            <div className="flex-1">
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Detalhes do Torrent
              </DialogTitle>
              <DialogDescription>
                Informações completas sobre o torrent selecionado
              </DialogDescription>
            </div>
            <ButtonGroup className="flex-shrink-0 mt-1">
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
              {onDelete && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => onDelete(torrent.id)}
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

        <div className="space-y-3 sm:space-y-6">
          {/* Nome do Torrent */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">Nome</h3>
            <div className="flex items-start gap-2 p-2 sm:p-3 bg-muted rounded-lg min-w-0">
              <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
              <span className="text-xs sm:text-sm font-medium break-words flex-1 leading-relaxed">
                {truncateText(torrent.name, isMobile ? 40 : 100)}
              </span>
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
            </div>
          </div>

          <Separator />

          {/* Hash */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">Hash</h3>
            <div className="flex items-center gap-2 p-2 sm:p-3 bg-muted rounded-lg">
              <Hash className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="text-xs sm:text-sm font-mono break-all flex-1">
                {truncateText(torrent.hash, isMobile ? 25 : 60)}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(torrent.hash, 'hash')}
                className="h-8 w-8 p-0"
              >
                {copiedField === 'hash' ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          <Separator />

          {/* Magnet Link */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">Magnet Link</h3>
            <div className="flex items-center gap-2 p-2 sm:p-3 bg-muted rounded-lg min-w-0">
              <Link className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0 overflow-hidden">
                <span 
                  className="text-xs sm:text-sm font-mono block truncate" 
                  title={torrent.magnet_uri}
                >
                  {truncateText(torrent.magnet_uri, isMobile ? 30 : 70)}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(torrent.magnet_uri, 'magnet')}
                className="h-8 w-8 p-0 flex-shrink-0"
              >
                {copiedField === 'magnet' ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          <Separator />

          {/* Informações Gerais */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground">Informações Gerais</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <HardDrive className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Tamanho:</span>
                  <span className="text-sm text-muted-foreground">{formatBytes(torrent.size)}</span>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Progresso:</span>
                  </div>
                  <ProgressBar progress={torrent.progress} height="md" />
                </div>
                <div className="flex items-center gap-2">
                  <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Ratio:</span>
                  <span className="text-sm text-muted-foreground">{torrent.ratio.toFixed(2)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Flag className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Prioridade:</span>
                  <span className="text-sm text-muted-foreground">{torrent.priority}</span>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Estado:</span>
                  <span className="text-sm text-muted-foreground capitalize">{torrent.state}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Categoria:</span>
                  <span className="text-sm text-muted-foreground">{torrent.category || 'N/A'}</span>
                </div>
                {torrent.tags && torrent.tags.length > 0 && (
                  <div className="flex items-start gap-2">
                    <Tag className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-sm font-medium">Tags:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {torrent.tags.map((tag, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded-full text-xs font-medium"
                        >
                          <Tag className="h-3 w-3" />
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Popularidade:</span>
                  <span className="text-sm text-muted-foreground">{torrent.popularity}</span>
                </div>
                {torrent.agent && (
                  <div className="flex items-center gap-2">
                    <Server className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Agent:</span>
                    <span className="text-sm text-muted-foreground">{torrent.agent.name}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <Separator />

          {/* Rede e Pares */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground">Rede e Pares</h3>
            
            {/* Barra de Progresso de Seeding */}
            <div className="space-y-3 p-3 bg-muted rounded-lg">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
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
              <div className="space-y-3">
                <div className="flex items-center gap-2">
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
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 pt-2">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
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
              <div className="space-y-3">
                <div className="flex items-center gap-2">
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

          {/* Caminho */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">Caminho</h3>
            <div className="flex items-center gap-2 p-2 sm:p-3 bg-muted rounded-lg">
              <FolderOpen className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="text-xs sm:text-sm break-all flex-1">
                {truncateText(torrent.path, isMobile ? 35 : 80)}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(torrent.path, 'path')}
                className="h-8 w-8 p-0"
              >
                {copiedField === 'path' ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Informações do Magnet Link */}
          {torrent.magnet_link && (
            <>
              <Separator />
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground">Detalhes do Magnet</h3>
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
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
