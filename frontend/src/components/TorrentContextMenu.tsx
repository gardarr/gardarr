import * as React from "react";
import { useTranslation } from "react-i18next";

import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem
} from "@/components/ui/context-menu";
import { Play, Pause, Trash2, Zap, Radio, CheckCircle, BarChart3, Settings, FileText } from "lucide-react";
import { TorrentMetadataModal } from "./TorrentMetadataModal";
import type { TaskMetadata } from "@/types/torrent";

type TorrentContextMenuProps = {
  taskId: string;
  agentId?: string;
  taskHash: string;
  taskName: string;
  metadata?: TaskMetadata | null;
  children: React.ReactNode;
  onStart?: (taskId: string) => void;
  onStop?: (taskId: string) => void;
  onRemove?: (taskId: string) => void;
  onForceDownload?: (taskId: string) => void;
  onForceReannounce?: (taskId: string) => void;
  onForceRecheck?: (taskId: string) => void;
  onMetrics?: (taskId: string, agentId?: string) => void;
  onLimits?: (taskId: string, agentId?: string) => void;
  onMetadataUpdate?: () => void;
  selectionMode?: boolean;
  selectedIds?: Set<string>;
  onRequestDelete?: (ids: string[]) => void;
};

export default function TorrentContextMenu(props: TorrentContextMenuProps) {
  const { t } = useTranslation();
  const { taskId, agentId, taskHash, taskName, metadata, children, onStart, onStop, onRemove, onForceDownload, onForceReannounce, onForceRecheck, onMetrics, onLimits, onMetadataUpdate, selectionMode, selectedIds, onRequestDelete } = props;
  
  const [isMetadataModalOpen, setIsMetadataModalOpen] = React.useState(false);
  const [isMenuReady, setIsMenuReady] = React.useState(false);

  const handleStart = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onStart) {
      onStart(taskId);
    }
  }, [onStart, taskId]);

  const handleStop = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onStop) {
      onStop(taskId);
    }
  }, [onStop, taskId]);

  const handleRemove = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onRequestDelete) {
      const ids = selectionMode && selectedIds && selectedIds.size > 0
        ? Array.from(selectedIds)
        : [taskId];
      onRequestDelete(ids);
      return;
    }
    if (onRemove) {
      onRemove(taskId);
    }
  }, [onRequestDelete, selectionMode, selectedIds, onRemove, taskId]);

  const handleForceDownload = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onForceDownload) {
      onForceDownload(taskId);
    }
  }, [onForceDownload, taskId]);

  const handleForceReannounce = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onForceReannounce) {
      onForceReannounce(taskId);
    }
  }, [onForceReannounce, taskId]);

  const handleForceRecheck = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onForceRecheck) {
      onForceRecheck(taskId);
    }
  }, [onForceRecheck, taskId]);

  const handleMetrics = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onMetrics) {
      onMetrics(taskId, agentId);
    }
  }, [onMetrics, taskId, agentId]);

  const handleLimits = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onLimits) {
      onLimits(taskId, agentId);
    }
  }, [onLimits, taskId, agentId]);

  const handleMetadata = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsMetadataModalOpen(true);
  }, []);

  const handleMetadataClose = React.useCallback(() => {
    setIsMetadataModalOpen(false);
  }, []);

  const handleMetadataUpdateWrapper = React.useCallback(() => {
    if (onMetadataUpdate) {
      onMetadataUpdate();
    }
  }, [onMetadataUpdate]);

  const isMultipleSelection = selectionMode && selectedIds && selectedIds.size > 1;

  const handleOpenChange = React.useCallback((open: boolean) => {
    if (open) {
      setIsMenuReady(false);
      // Small delay to allow menu positioning to stabilize
      setTimeout(() => setIsMenuReady(true), 100);
    } else {
      setIsMenuReady(false);
    }
  }, []);

  const createProtectedHandler = React.useCallback(
    (handler: (e: React.MouseEvent) => void) => {
      return (e: React.MouseEvent) => {
        if (!isMenuReady) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        handler(e);
      };
    },
    [isMenuReady]
  );

  return (
    <ContextMenu modal={false} onOpenChange={handleOpenChange}>
      <ContextMenuTrigger asChild>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent 
        className="w-48"
        onCloseAutoFocus={(e) => e.preventDefault()}
        onOpenAutoFocus={(e) => e.preventDefault()}
        collisionPadding={10}
      >
        <ContextMenuItem onClick={createProtectedHandler(handleStart)}>
          <Play className="text-green-500" />
          Start
        </ContextMenuItem>
        <ContextMenuItem onClick={createProtectedHandler(handleStop)}>
          <Pause />
          Stop
        </ContextMenuItem>
        <ContextMenuItem onClick={createProtectedHandler(handleForceDownload)} disabled={!onForceDownload}>
          <Zap />
          Force download
        </ContextMenuItem>
        <ContextMenuItem onClick={createProtectedHandler(handleForceReannounce)} disabled={!onForceReannounce}>
          <Radio />
          Force reannounce
        </ContextMenuItem>
        <ContextMenuItem onClick={createProtectedHandler(handleForceRecheck)} disabled={!onForceRecheck}>
          <CheckCircle />
          Force recheck
        </ContextMenuItem>
        <ContextMenuItem onClick={createProtectedHandler(handleMetrics)} disabled={!onMetrics}>
          <BarChart3 />
          Métricas
        </ContextMenuItem>
        <ContextMenuItem onClick={createProtectedHandler(handleLimits)}>
          <Settings />
          {t("torrents.limits")}
        </ContextMenuItem>
        <ContextMenuItem 
          onClick={createProtectedHandler(handleMetadata)} 
          disabled={isMultipleSelection}
        >
          <FileText />
          Metadados
        </ContextMenuItem>
        <ContextMenuItem onClick={createProtectedHandler(handleRemove)} variant="destructive">
          <Trash2 />
          Remove
        </ContextMenuItem>
      </ContextMenuContent>
      
      <TorrentMetadataModal
        isOpen={isMetadataModalOpen}
        taskHash={taskHash}
        taskName={taskName}
        metadata={metadata}
        onClose={handleMetadataClose}
        onUpdate={handleMetadataUpdateWrapper}
      />
    </ContextMenu>
  );
}


