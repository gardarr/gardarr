import { useState, useEffect } from "react";
import { File, Loader2, FileUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { TaskFile } from "@/types/torrent";
import { torrentService } from "@/services/torrents";
import { getStatusColor } from "./TorrentStatusIcon";
import { useTranslation } from "react-i18next";

interface TorrentFilesListProps {
  workerId: string;
  taskId: string;
  onValueChange?: (value: string) => void;
  className?: string;
  showAccordion?: boolean;
  defaultOpen?: boolean;
  title?: string;
}

// qBittorrent file priority values.
const PRIORITY_SKIP = 0;
const PRIORITY_NORMAL = 1;
const PRIORITY_HIGH = 6;
const PRIORITY_MAXIMUM = 7;

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = bytes / Math.pow(k, i);
  return `${value.toFixed(value >= 100 ? 0 : value >= 10 ? 1 : 2)} ${sizes[i]}`;
}


export function TorrentFilesList({
  workerId,
  taskId,
  onValueChange,
  className = "",
  showAccordion = true,
  defaultOpen = false,
  title
}: TorrentFilesListProps) {
  const [files, setFiles] = useState<TaskFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [openTooltipIndex, setOpenTooltipIndex] = useState<number | null>(null);
  // Maps file index -> not-yet-applied priority chosen by the user.
  const [pendingChanges, setPendingChanges] = useState<Map<number, number>>(new Map());
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 640);
    };

    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);

    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

  const loadFiles = async () => {
    if (!workerId || !taskId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await torrentService.listTaskFiles(workerId, taskId);
      if (response.error) {
        setError(response.error);
      } else if (response.data) {
        setFiles(response.data);
        setHasLoaded(true);
        setPendingChanges(new Map());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load files');
    } finally {
      setLoading(false);
    }
  };

  // Without accordion (or with it already expanded) there is no expand event,
  // so load as soon as mounted
  useEffect(() => {
    if ((!showAccordion || defaultOpen) && !hasLoaded && !loading) {
      loadFiles();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAccordion, defaultOpen, workerId, taskId]);

  const handleValueChange = (value: string) => {
    if (value === "files" && !hasLoaded && !loading) {
      loadFiles();
    }
    onValueChange?.(value);
  };

  const handleRetry = () => {
    loadFiles();
  };

  const handleFileClick = (index: number) => {
    if (isMobile) {
      setOpenTooltipIndex(openTooltipIndex === index ? null : index);
    }
  };

  const effectivePriority = (file: TaskFile): number => {
    return pendingChanges.get(file.index) ?? file.priority;
  };

  const setPendingPriority = (index: number, priority: number) => {
    setApplyError(null);
    setPendingChanges((prev) => {
      const next = new Map(prev);
      next.set(index, priority);
      return next;
    });
  };

  const handleToggleFile = (file: TaskFile, checked: boolean) => {
    setPendingPriority(file.index, checked ? PRIORITY_NORMAL : PRIORITY_SKIP);
  };

  const handleSelectAll = () => {
    setApplyError(null);
    setPendingChanges((prev) => {
      const next = new Map(prev);
      for (const file of files) {
        if (effectivePriority(file) === PRIORITY_SKIP) {
          next.set(file.index, PRIORITY_NORMAL);
        }
      }
      return next;
    });
  };

  const handleSelectNone = () => {
    setApplyError(null);
    setPendingChanges((prev) => {
      const next = new Map(prev);
      for (const file of files) {
        next.set(file.index, PRIORITY_SKIP);
      }
      return next;
    });
  };

  const performApply = async () => {
    if (pendingChanges.size === 0 || !workerId || !taskId) return;

    setConfirmOpen(false);
    setApplying(true);
    setApplyError(null);

    // The API sets one priority value per call, so group the pending
    // per-file changes by their target priority.
    const groups = new Map<number, number[]>();
    for (const [index, priority] of pendingChanges) {
      const indexes = groups.get(priority) ?? [];
      indexes.push(index);
      groups.set(priority, indexes);
    }

    // Apply every non-skip priority first, and the skip group last. Applying
    // skip first could transiently leave zero files selected mid-batch (if
    // the newly-included files haven't been applied yet), which the worker
    // rejects.
    const orderedGroups = Array.from(groups.entries()).sort(([a], [b]) => {
      if (a === PRIORITY_SKIP) return 1;
      if (b === PRIORITY_SKIP) return -1;
      return 0;
    });

    try {
      for (const [priority, indexes] of orderedGroups) {
        const response = await torrentService.setTaskFilePriority(workerId, taskId, indexes, priority);
        if (response.error) {
          setApplyError(response.error);
          return;
        }
      }
      await loadFiles();
    } catch (err) {
      setApplyError(err instanceof Error ? err.message : 'Failed to update file priority');
    } finally {
      setApplying(false);
    }
  };

  const renderBulkActions = () => {
    if (!hasLoaded || files.length === 0) return null;

    const hasPendingChanges = pendingChanges.size > 0;

    return (
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={(e) => { e.stopPropagation(); handleSelectAll(); }}
          disabled={applying}
        >
          {t('torrentDetails.files.selectAll', { defaultValue: 'Selecionar todos' })}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={(e) => { e.stopPropagation(); handleSelectNone(); }}
          disabled={applying}
        >
          {t('torrentDetails.files.selectNone', { defaultValue: 'Selecionar nenhum' })}
        </Button>
        <Button
          size="sm"
          className="h-7 text-xs"
          onClick={(e) => { e.stopPropagation(); setConfirmOpen(true); }}
          disabled={!hasPendingChanges || applying}
        >
          {applying
            ? t('torrentDetails.files.applying', { defaultValue: 'Aplicando...' })
            : t('torrentDetails.files.apply', { defaultValue: 'Aplicar' })}
        </Button>
      </div>
    );
  };

  const renderPrioritySelect = (file: TaskFile) => {
    const priority = effectivePriority(file);
    if (priority === PRIORITY_SKIP) return null;

    return (
      <Select
        value={String(priority)}
        onValueChange={(value) => setPendingPriority(file.index, Number(value))}
        disabled={applying}
      >
        <SelectTrigger className="h-7 w-28 text-xs" onClick={(e) => e.stopPropagation()}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={String(PRIORITY_NORMAL)}>
            {t('torrentDetails.files.priority.normal', { defaultValue: 'Normal' })}
          </SelectItem>
          <SelectItem value={String(PRIORITY_HIGH)}>
            {t('torrentDetails.files.priority.high', { defaultValue: 'Alta' })}
          </SelectItem>
          <SelectItem value={String(PRIORITY_MAXIMUM)}>
            {t('torrentDetails.files.priority.maximum', { defaultValue: 'Máxima' })}
          </SelectItem>
        </SelectContent>
      </Select>
    );
  };

  const renderFilesList = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">{t('torrentDetails.files.loading', { defaultValue: 'Carregando arquivos...' })}</span>
        </div>
      );
    }

    if (error) {
      return (
        <div className="text-center py-8">
          <div className="text-sm text-red-600 dark:text-red-400 mb-2">
            {t('torrentDetails.files.loadError', { defaultValue: 'Erro ao carregar arquivos' })}
          </div>
          <div className="text-xs text-muted-foreground mb-4">
            {error}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRetry}
            className="h-8"
          >
            {t('torrentDetails.files.retry', { defaultValue: 'Tentar novamente' })}
          </Button>
        </div>
      );
    }

    if (files.length === 0) {
      return (
        <div className="text-center py-8">
          <File className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <div className="text-sm text-muted-foreground">
            {t('torrentDetails.files.empty', { defaultValue: 'Nenhum arquivo encontrado' })}
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {!showAccordion && (
          <div className="flex items-center gap-2 px-1">
            {renderBulkActions()}
          </div>
        )}

        <div className="text-xs text-muted-foreground px-1">
          {t('torrentDetails.files.deselectNote', {
            defaultValue: 'Desmarcar um arquivo interrompe o download, mas não apaga o que já foi baixado. O progresso do torrent é recalculado após aplicar.'
          })}
        </div>

        {applyError && (
          <div className="text-xs text-red-600 dark:text-red-400 px-1">
            {applyError}
          </div>
        )}

        <div className="max-h-64 overflow-y-auto scrollbar-thin">
          <div className="space-y-1">
            {files.map((file, index) => {
              const priority = effectivePriority(file);
              const checked = priority !== PRIORITY_SKIP;
              return (
                <div
                  key={file.index}
                  className={`py-2 px-1 hover:bg-muted/30 rounded transition-colors flex items-center justify-between gap-2 ${
                    isMobile ? 'cursor-pointer' : ''
                  }`}
                  onClick={() => handleFileClick(index)}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(value) => handleToggleFile(file, value === true)}
                      disabled={applying}
                      onClick={(e) => e.stopPropagation()}
                      aria-label={t('torrentDetails.files.toggleAria', { defaultValue: 'Incluir arquivo no download', name: file.name })}
                    />
                    {file.is_seed ? (
                      <Tooltip open={isMobile ? openTooltipIndex === index : undefined}>
                        <TooltipTrigger asChild>
                          <FileUp
                            className={`h-3.5 w-3.5 flex-shrink-0 ${getStatusColor('UPLOADING')}`}
                          />
                        </TooltipTrigger>
                        <TooltipContent>
                          {t('taskStatus.UPLOADING')}
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <File className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <Tooltip open={isMobile ? openTooltipIndex === index : undefined}>
                        <TooltipTrigger asChild>
                          <div className={`text-sm truncate ${checked ? '' : 'text-muted-foreground line-through'}`} style={{ maxWidth: isMobile ? '20ch' : '50ch' }}>
                            {file.name}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <div className="max-w-xs break-all">{file.name}</div>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground flex-shrink-0">
                    {renderPrioritySelect(file)}
                    <span className="font-mono">{formatBytes(file.size)}</span>
                    <span className="w-12 text-right">
                      {file.progress.toFixed(1)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  // Only count a file as newly "included"/"skipped" if its priority actually
  // crosses that line - a priority-only edit on an already-included file
  // (e.g. Normal -> High) is neither.
  let skipCount = 0;
  let downloadCount = 0;
  for (const [index, pendingPriority] of pendingChanges) {
    const originalPriority = files.find((file) => file.index === index)?.priority;
    const wasSkipped = originalPriority === PRIORITY_SKIP;
    const isSkipped = pendingPriority === PRIORITY_SKIP;
    if (wasSkipped && !isSkipped) downloadCount++;
    else if (!wasSkipped && isSkipped) skipCount++;
  }

  const confirmDialog = (
    <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{t('torrentDetails.files.confirmTitle', { defaultValue: 'Aplicar alterações de arquivos?' })}</DialogTitle>
          <DialogDescription>
            {t('torrentDetails.files.confirmDescription', {
              defaultValue: '{{skip}} arquivo(s) deixarão de ser baixados e {{download}} arquivo(s) serão incluídos no download. Arquivos já baixados não são apagados do disco, e o progresso do torrent será recalculado.',
              skip: skipCount,
              download: downloadCount,
            })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={applying}>
            {t('torrentDetails.files.confirmCancel', { defaultValue: 'Cancelar' })}
          </Button>
          <Button onClick={performApply} disabled={applying}>
            {t('torrentDetails.files.confirmApply', { defaultValue: 'Confirmar' })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  if (showAccordion) {
    return (
      <>
        <div className={`space-y-2 ${className}`}>
          <h3 className="text-sm font-medium text-muted-foreground">{t('torrentDetails.files.heading', { defaultValue: 'Arquivos do Torrent' })}</h3>

          <Accordion type="single" collapsible defaultValue={defaultOpen ? "files" : undefined} onValueChange={handleValueChange}>
            <AccordionItem value="files">
              <AccordionTrigger className="hover:no-underline" headerActions={<div className="pr-4">{renderBulkActions()}</div>}>
                <div className="flex items-center gap-2">
                  <File className="h-4 w-4" />
                  <span>{title ?? t('torrentDetails.files.title', { defaultValue: 'Lista de Arquivos' })}</span>
                  {files.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      ({t('torrentDetails.files.count', { count: files.length, defaultValue: `${files.length} arquivos` })})
                    </span>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent>
                {renderFilesList()}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
        {confirmDialog}
      </>
    );
  }

  return (
    <>
      <div className={className}>
        {renderFilesList()}
      </div>
      {confirmDialog}
    </>
  );
}
