import * as React from "react";
import { useTranslation } from "react-i18next";

import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem
} from "@/components/ui/context-menu";
import { Play, Pause, Trash2, Zap, Radio, CheckCircle, BarChart3, Settings, Info } from "lucide-react";
import { useSetup } from "@/contexts/SetupContext";

type TorrentContextMenuProps = {
  taskId: string;
  agentId?: string;
  children: React.ReactNode;
  onStart?: (taskId: string) => void;
  onStop?: (taskId: string) => void;
  onRemove?: (taskId: string) => void;
  onForceDownload?: (taskId: string) => void;
  onForceReannounce?: (taskId: string) => void;
  onForceRecheck?: (taskId: string) => void;
  onMetrics?: (taskId: string, agentId?: string) => void;
  onLimits?: (taskId: string, agentId?: string) => void;
  onShowDetails?: (taskId: string) => void;
  selectionMode?: boolean;
  selectedIds?: Set<string>;
  onRequestDelete?: (ids: string[]) => void;
};

export default function TorrentContextMenu(props: TorrentContextMenuProps) {
  const { t } = useTranslation();
  const { taskId, agentId, children, onStart, onStop, onRemove, onForceDownload, onForceReannounce, onForceRecheck, onMetrics, onLimits, onShowDetails, selectionMode, selectedIds, onRequestDelete } = props;

  const [isMenuReady, setIsMenuReady] = React.useState(false);
  const { statisticsEnabled } = useSetup();

  const handleStart = React.useCallback((e: React.MouseEvent) => {
    if (!isMenuReady) { e.preventDefault(); e.stopPropagation(); return; }
    e.preventDefault();
    e.stopPropagation();
    if (onStart) {
      const ids = selectionMode && selectedIds && selectedIds.size > 1 ? Array.from(selectedIds) : [taskId];
      ids.forEach(id => onStart(id));
    }
  }, [isMenuReady, onStart, taskId, selectionMode, selectedIds]);

  const handleStop = React.useCallback((e: React.MouseEvent) => {
    if (!isMenuReady) { e.preventDefault(); e.stopPropagation(); return; }
    e.preventDefault();
    e.stopPropagation();
    if (onStop) {
      const ids = selectionMode && selectedIds && selectedIds.size > 1 ? Array.from(selectedIds) : [taskId];
      ids.forEach(id => onStop(id));
    }
  }, [isMenuReady, onStop, taskId, selectionMode, selectedIds]);

  const handleRemove = React.useCallback((e: React.MouseEvent) => {
    if (!isMenuReady) { e.preventDefault(); e.stopPropagation(); return; }
    e.preventDefault();
    e.stopPropagation();
    if (onRequestDelete) {
      const ids = selectionMode && selectedIds && selectedIds.size > 0 ? Array.from(selectedIds) : [taskId];
      onRequestDelete(ids);
      return;
    }
    if (onRemove) {
      onRemove(taskId);
    }
  }, [isMenuReady, onRequestDelete, selectionMode, selectedIds, onRemove, taskId]);

  const handleForceDownload = React.useCallback((e: React.MouseEvent) => {
    if (!isMenuReady) { e.preventDefault(); e.stopPropagation(); return; }
    e.preventDefault();
    e.stopPropagation();
    if (onForceDownload) {
      const ids = selectionMode && selectedIds && selectedIds.size > 1 ? Array.from(selectedIds) : [taskId];
      ids.forEach(id => onForceDownload(id));
    }
  }, [isMenuReady, onForceDownload, taskId, selectionMode, selectedIds]);

  const handleForceReannounce = React.useCallback((e: React.MouseEvent) => {
    if (!isMenuReady) { e.preventDefault(); e.stopPropagation(); return; }
    e.preventDefault();
    e.stopPropagation();
    if (onForceReannounce) {
      const ids = selectionMode && selectedIds && selectedIds.size > 1 ? Array.from(selectedIds) : [taskId];
      ids.forEach(id => onForceReannounce(id));
    }
  }, [isMenuReady, onForceReannounce, taskId, selectionMode, selectedIds]);

  const handleForceRecheck = React.useCallback((e: React.MouseEvent) => {
    if (!isMenuReady) { e.preventDefault(); e.stopPropagation(); return; }
    e.preventDefault();
    e.stopPropagation();
    if (onForceRecheck) {
      const ids = selectionMode && selectedIds && selectedIds.size > 1 ? Array.from(selectedIds) : [taskId];
      ids.forEach(id => onForceRecheck(id));
    }
  }, [isMenuReady, onForceRecheck, taskId, selectionMode, selectedIds]);

  const handleMetrics = React.useCallback((e: React.MouseEvent) => {
    if (!isMenuReady) { e.preventDefault(); e.stopPropagation(); return; }
    e.preventDefault();
    e.stopPropagation();
    if (onMetrics) {
      onMetrics(taskId, agentId);
    }
  }, [isMenuReady, onMetrics, taskId, agentId]);

  const handleLimits = React.useCallback((e: React.MouseEvent) => {
    if (!isMenuReady) { e.preventDefault(); e.stopPropagation(); return; }
    e.preventDefault();
    e.stopPropagation();
    if (onLimits) {
      onLimits(taskId, agentId);
    }
  }, [isMenuReady, onLimits, taskId, agentId]);

  const handleShowDetails = React.useCallback((e: React.MouseEvent) => {
    if (!isMenuReady) { e.preventDefault(); e.stopPropagation(); return; }
    e.preventDefault();
    e.stopPropagation();
    if (onShowDetails) {
      onShowDetails(taskId);
    }
  }, [isMenuReady, onShowDetails, taskId]);

  const handleOpenChange = React.useCallback((open: boolean) => {
    if (open) {
      setIsMenuReady(false);
      setTimeout(() => setIsMenuReady(true), 100);
    } else {
      setIsMenuReady(false);
    }
  }, []);

  return (
    <ContextMenu modal={false} onOpenChange={handleOpenChange}>
      <ContextMenuTrigger asChild>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent
        className="w-48"
        onCloseAutoFocus={(e: Event) => e.preventDefault()}
      >
        <ContextMenuItem onClick={handleShowDetails} disabled={!onShowDetails}>
          <Info />
          {t("torrents.showDetails")}
        </ContextMenuItem>
        <ContextMenuItem onClick={handleStart}>
          <Play className="text-green-500" />
          {t("torrents.start")}
        </ContextMenuItem>
        <ContextMenuItem onClick={handleStop}>
          <Pause />
          {t("torrents.stop")}
        </ContextMenuItem>
        <ContextMenuItem onClick={handleForceDownload} disabled={!onForceDownload}>
          <Zap />
          {t("torrents.forceDownload")}
        </ContextMenuItem>
        <ContextMenuItem onClick={handleForceReannounce} disabled={!onForceReannounce}>
          <Radio />
          {t("torrents.forceReannounce")}
        </ContextMenuItem>
        <ContextMenuItem onClick={handleForceRecheck} disabled={!onForceRecheck}>
          <CheckCircle />
          {t("torrents.forceRecheck")}
        </ContextMenuItem>
        <ContextMenuItem onClick={handleMetrics} disabled={!onMetrics || !statisticsEnabled}>
          <BarChart3 />
          {t("torrents.metrics")}
        </ContextMenuItem>
        <ContextMenuItem onClick={handleLimits}>
          <Settings />
          {t("torrents.limits")}
        </ContextMenuItem>
        <ContextMenuItem onClick={handleRemove} variant="destructive">
          <Trash2 />
          {t("torrents.remove")}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}


