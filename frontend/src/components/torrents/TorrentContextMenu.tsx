import * as React from "react";
import { useTranslation } from "react-i18next";

import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem
} from "@/components/ui/context-menu";
import { Play, Pause, Trash2, Zap, Radio, CheckCircle, Settings, Info, Search } from "lucide-react";

type TorrentContextMenuProps = {
  taskId: string;
  workerId?: string;
  children: React.ReactNode;
  onStart?: (taskId: string) => void;
  onStop?: (taskId: string) => void;
  onRemove?: (taskId: string) => void;
  onForceDownload?: (taskId: string) => void;
  onForceReannounce?: (taskId: string) => void;
  onForceRecheck?: (taskId: string) => void;
  onSearchMetadata?: (taskId: string) => void;
  canSearchMetadata?: boolean;
  onLimits?: (taskId: string, workerId?: string) => void;
  onShowDetails?: (taskId: string) => void;
  selectionMode?: boolean;
  selectedIds?: Set<string>;
  onRequestDelete?: (ids: string[]) => void;
};

export default function TorrentContextMenu(props: TorrentContextMenuProps) {
  const { t } = useTranslation();
  const { taskId, workerId, children, onStart, onStop, onRemove, onForceDownload, onForceReannounce, onForceRecheck, onSearchMetadata, canSearchMetadata, onLimits, onShowDetails, selectionMode, selectedIds, onRequestDelete } = props;

  const [isMenuReady, setIsMenuReady] = React.useState(false);
  const getTargetIds = React.useCallback(() => {
    return selectionMode && selectedIds && selectedIds.size > 1
      ? Array.from(selectedIds)
      : [taskId];
  }, [selectionMode, selectedIds, taskId]);

  const guardMenuAction = React.useCallback((e: React.MouseEvent): boolean => {
    if (!isMenuReady) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }

    e.preventDefault();
    e.stopPropagation();
    return true;
  }, [isMenuReady]);

  const createBatchHandler = React.useCallback((
    action?: (taskId: string) => void,
    options?: { enabled?: boolean }
  ) => {
    return (e: React.MouseEvent) => {
      if (!guardMenuAction(e) || !action || options?.enabled === false) {
        return;
      }

      getTargetIds().forEach((id) => action(id));
    };
  }, [getTargetIds, guardMenuAction]);

  const handleStart = React.useMemo(() => createBatchHandler(onStart), [createBatchHandler, onStart]);
  const handleStop = React.useMemo(() => createBatchHandler(onStop), [createBatchHandler, onStop]);

  const handleRemove = React.useCallback((e: React.MouseEvent) => {
    if (!guardMenuAction(e)) {
      return;
    }

    if (onRequestDelete) {
      const ids = selectionMode && selectedIds && selectedIds.size > 0 ? Array.from(selectedIds) : [taskId];
      onRequestDelete(ids);
      return;
    }
    if (onRemove) {
      onRemove(taskId);
    }
  }, [guardMenuAction, onRequestDelete, selectionMode, selectedIds, onRemove, taskId]);

  const handleForceDownload = React.useMemo(() => createBatchHandler(onForceDownload), [createBatchHandler, onForceDownload]);
  const handleForceReannounce = React.useMemo(() => createBatchHandler(onForceReannounce), [createBatchHandler, onForceReannounce]);
  const handleForceRecheck = React.useMemo(() => createBatchHandler(onForceRecheck), [createBatchHandler, onForceRecheck]);

  const handleLimits = React.useCallback((e: React.MouseEvent) => {
    if (!guardMenuAction(e)) {
      return;
    }

    if (onLimits) {
      onLimits(taskId, workerId);
    }
  }, [guardMenuAction, onLimits, taskId, workerId]);

  const handleSearchMetadata = React.useMemo(
    () => createBatchHandler(onSearchMetadata, { enabled: canSearchMetadata }),
    [canSearchMetadata, createBatchHandler, onSearchMetadata]
  );

  const handleShowDetails = React.useCallback((e: React.MouseEvent) => {
    if (!guardMenuAction(e)) {
      return;
    }

    if (onShowDetails) {
      onShowDetails(taskId);
    }
  }, [guardMenuAction, onShowDetails, taskId]);

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
        <ContextMenuItem onClick={handleSearchMetadata} disabled={!onSearchMetadata || !canSearchMetadata}>
          <Search />
          {t("torrents.addModal.metadata.searchButton")}
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
