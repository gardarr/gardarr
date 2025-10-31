import * as React from "react";

import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem
} from "@/components/ui/context-menu";
import { Play, Pause, Trash2, Zap, Radio, CheckCircle } from "lucide-react";

type TorrentContextMenuProps = {
  taskId: string;
  children: React.ReactNode;
  onStart?: (taskId: string) => void;
  onStop?: (taskId: string) => void;
  onRemove?: (taskId: string) => void;
  onForceDownload?: (taskId: string) => void;
  onForceReannounce?: (taskId: string) => void;
  onForceRecheck?: (taskId: string) => void;
};

export default function TorrentContextMenu(props: TorrentContextMenuProps) {
  const { taskId, children, onStart, onStop, onRemove, onForceDownload, onForceReannounce, onForceRecheck } = props;

  const handleStart = React.useCallback(() => {
    if (onStart) {
      onStart(taskId);
    }
  }, [onStart, taskId]);

  const handleStop = React.useCallback(() => {
    if (onStop) {
      onStop(taskId);
    }
  }, [onStop, taskId]);

  const handleRemove = React.useCallback(() => {
    if (onRemove) {
      onRemove(taskId);
    }
  }, [onRemove, taskId]);

  const handleForceDownload = React.useCallback(() => {
    if (onForceDownload) {
      onForceDownload(taskId);
    }
  }, [onForceDownload, taskId]);

  const handleForceReannounce = React.useCallback(() => {
    if (onForceReannounce) {
      onForceReannounce(taskId);
    }
  }, [onForceReannounce, taskId]);

  const handleForceRecheck = React.useCallback(() => {
    if (onForceRecheck) {
      onForceRecheck(taskId);
    }
  }, [onForceRecheck, taskId]);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <ContextMenuItem onClick={handleStart}>
          <Play />
          Start
        </ContextMenuItem>
        <ContextMenuItem onClick={handleStop}>
          <Pause />
          Stop
        </ContextMenuItem>
        <ContextMenuItem onClick={handleForceDownload} disabled={!onForceDownload}>
          <Zap />
          Force download
        </ContextMenuItem>
        <ContextMenuItem onClick={handleForceReannounce} disabled={!onForceReannounce}>
          <Radio />
          Force reannounce
        </ContextMenuItem>
        <ContextMenuItem onClick={handleForceRecheck} disabled={!onForceRecheck}>
          <CheckCircle />
          Force recheck
        </ContextMenuItem>
        <ContextMenuItem onClick={handleRemove} variant="destructive">
          <Trash2 />
          Remove
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}


