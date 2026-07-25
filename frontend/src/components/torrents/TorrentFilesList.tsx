import { useState, useEffect } from "react";
import { File, Loader2, FileUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
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
      <div className="max-h-64 overflow-y-auto scrollbar-thin">
        <div className="space-y-1">
          {files.map((file, index) => (
              <div
                key={index}
                className={`py-2 px-1 hover:bg-muted/30 rounded transition-colors flex items-center justify-between ${
                  isMobile ? 'cursor-pointer' : ''
                }`}
                onClick={() => handleFileClick(index)}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
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
                        <div className="text-sm truncate" style={{ maxWidth: isMobile ? '20ch' : '50ch' }}>
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
                  <span className="font-mono">{formatBytes(file.size)}</span>
                  <span className="w-12 text-right">
                    {file.progress.toFixed(1)}%
                  </span>
                </div>
              </div>
          ))}
        </div>
      </div>
    );
  };

  if (showAccordion) {
    return (
      <div className={`space-y-2 ${className}`}>
        <h3 className="text-sm font-medium text-muted-foreground">{t('torrentDetails.files.heading', { defaultValue: 'Arquivos do Torrent' })}</h3>

        <Accordion type="single" collapsible defaultValue={defaultOpen ? "files" : undefined} onValueChange={handleValueChange}>
          <AccordionItem value="files">
            <AccordionTrigger className="hover:no-underline">
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
    );
  }

  return (
    <div className={className}>
      {renderFilesList()}
    </div>
  );
}
