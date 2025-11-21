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
      // Apply to all selected tasks in bulk mode
      const ids = selectionMode && selectedIds && selectedIds.size > 1
        ? Array.from(selectedIds)
        : [taskId];
      ids.forEach(id => onStart(id));
    }
  }, [onStart, taskId, selectionMode, selectedIds]);

  const handleStop = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onStop) {
      // Apply to all selected tasks in bulk mode
      const ids = selectionMode && selectedIds && selectedIds.size > 1
        ? Array.from(selectedIds)
        : [taskId];
      ids.forEach(id => onStop(id));
    }
  }, [onStop, taskId, selectionMode, selectedIds]);

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
      // Apply to all selected tasks in bulk mode
      const ids = selectionMode && selectedIds && selectedIds.size > 1
        ? Array.from(selectedIds)
        : [taskId];
      ids.forEach(id => onForceDownload(id));
    }
  }, [onForceDownload, taskId, selectionMode, selectedIds]);

  const handleForceReannounce = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onForceReannounce) {
      // Apply to all selected tasks in bulk mode
      const ids = selectionMode && selectedIds && selectedIds.size > 1
        ? Array.from(selectedIds)
        : [taskId];
      ids.forEach(id => onForceReannounce(id));
    }
  }, [onForceReannounce, taskId, selectionMode, selectedIds]);

  const handleForceRecheck = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onForceRecheck) {
      // Apply to all selected tasks in bulk mode
      const ids = selectionMode && selectedIds && selectedIds.size > 1
        ? Array.from(selectedIds)
        : [taskId];
      ids.forEach(id => onForceRecheck(id));
    }
  }, [onForceRecheck, taskId, selectionMode, selectedIds]);

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
        onCloseAutoFocus={(e: Event) => e.preventDefault()}
      >
        <ContextMenuItem onClick={createProtectedHandler(handleStart)}>
          <Play className="text-green-500" />
          {t("torrents.start")}
        </ContextMenuItem>
        <ContextMenuItem onClick={createProtectedHandler(handleStop)}>
          <Pause />
          {t("torrents.stop")}
        </ContextMenuItem>
        <ContextMenuItem onClick={createProtectedHandler(handleForceDownload)} disabled={!onForceDownload}>
          <Zap />
          {t("torrents.forceDownload")}
        </ContextMenuItem>
        <ContextMenuItem onClick={createProtectedHandler(handleForceReannounce)} disabled={!onForceReannounce}>
          <Radio />
          {t("torrents.forceReannounce")}
        </ContextMenuItem>
        <ContextMenuItem onClick={createProtectedHandler(handleForceRecheck)} disabled={!onForceRecheck}>
          <CheckCircle />
          {t("torrents.forceRecheck")}
        </ContextMenuItem>
        <ContextMenuItem onClick={createProtectedHandler(handleMetrics)} disabled={!onMetrics}>
          <BarChart3 />
          {t("torrents.metrics")}
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
          {t("torrents.metadata")}
        </ContextMenuItem>
        <ContextMenuItem onClick={createProtectedHandler(handleRemove)} variant="destructive">
          <Trash2 />
          {t("torrents.remove")}
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


