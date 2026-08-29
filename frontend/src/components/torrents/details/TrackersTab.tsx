import { useEffect, useRef, useState } from "react";
import {
  Check,
  Copy,
  Hash,
  Link2,
  Loader2,
  Pencil,
  Plus,
  Radio,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatBytes } from "@/utils/bytes";
import type { Task, TaskTracker } from "@/types/torrent";
import { torrentService } from "@/services/torrents";
import { DetailCard } from "./DetailCard";
import { useCopyToClipboard } from "./useCopyToClipboard";

interface TrackersTabProps {
  torrent: Task;
}

// qBittorrent tracker status codes (torrents/trackers "status" field).
const STATUS_VARIANT: Record<number, "default" | "secondary" | "destructive" | "outline"> = {
  0: "outline", // disabled
  1: "secondary", // not contacted
  2: "default", // working
  3: "secondary", // updating
  4: "destructive", // not working
};

export function TrackersTab({ torrent }: TrackersTabProps) {
  const { t } = useTranslation();
  const { copiedField, copyToClipboard } = useCopyToClipboard();
  const workerId = torrent.worker?.uuid || torrent.worker_id || "";

  const [trackers, setTrackers] = useState<TaskTracker[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newUrl, setNewUrl] = useState("");
  const [adding, setAdding] = useState(false);
  // Tracker URLs with a mutation in flight, keyed by URL so concurrent
  // operations on different trackers don't clear each other's pending state.
  const [pendingUrls, setPendingUrls] = useState<Set<string>>(new Set());
  const addPendingUrl = (url: string) => setPendingUrls((prev) => new Set(prev).add(url));
  const removePendingUrl = (url: string) => setPendingUrls((prev) => {
    if (!prev.has(url)) return prev;
    const next = new Set(prev);
    next.delete(url);
    return next;
  });
  const [editingUrl, setEditingUrl] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  // Tracks which torrent/worker the component is currently showing, so an
  // in-flight request for a torrent the user has since navigated away from
  // (e.g. a post-mutation refresh) can't overwrite the newly active one.
  const activeTaskRef = useRef({ workerId, taskId: torrent.id });
  activeTaskRef.current = { workerId, taskId: torrent.id };

  const isCurrentTask = (wId: string, tId: string) =>
    activeTaskRef.current.workerId === wId && activeTaskRef.current.taskId === tId;

  const statusLabel = (status: number) =>
    t(`torrentDetails.trackersLive.status.${status}`, { defaultValue: t("torrentDetails.trackersLive.status.unknown", { defaultValue: "Unknown" }) });

  const loadTrackers = async (wId: string = workerId, tId: string = torrent.id) => {
    if (!wId || !tId || !isCurrentTask(wId, tId)) return;
    setLoading(true);
    setError(null);
    try {
      const response = await torrentService.listTaskTrackers(wId, tId);
      if (!isCurrentTask(wId, tId)) return;
      if (response.error) {
        setError(response.error);
      } else {
        setTrackers(response.data ?? []);
      }
    } catch (err) {
      if (!isCurrentTask(wId, tId)) return;
      setError(err instanceof Error ? err.message : "Failed to load trackers");
    } finally {
      if (isCurrentTask(wId, tId)) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    loadTrackers(workerId, torrent.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workerId, torrent.id]);

  const handleAdd = async () => {
    const url = newUrl.trim();
    const wId = workerId;
    const tId = torrent.id;
    if (!url || !wId) return;
    setAdding(true);
    try {
      const response = await torrentService.addTaskTrackers(wId, tId, [url]);
      if (response.error) {
        toast.error(response.error);
        return;
      }
      toast.success(t("torrentDetails.toasts.trackerAddSuccess", { defaultValue: "Tracker added" }));
      if (isCurrentTask(wId, tId)) {
        setNewUrl("");
      }
      await loadTrackers(wId, tId);
    } catch {
      toast.error(t("torrentDetails.toasts.trackerAddError", { defaultValue: "Failed to add tracker" }));
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (url: string) => {
    const wId = workerId;
    const tId = torrent.id;
    if (!wId) return;
    addPendingUrl(url);
    try {
      const response = await torrentService.removeTaskTrackers(wId, tId, [url]);
      if (response.error) {
        toast.error(response.error);
        return;
      }
      toast.success(t("torrentDetails.toasts.trackerRemoveSuccess", { defaultValue: "Tracker removed" }));
      if (isCurrentTask(wId, tId)) {
        setTrackers((prev) => prev.filter((tracker) => tracker.url !== url));
      }
    } catch {
      toast.error(t("torrentDetails.toasts.trackerRemoveError", { defaultValue: "Failed to remove tracker" }));
    } finally {
      removePendingUrl(url);
    }
  };

  const startEdit = (url: string) => {
    setEditingUrl(url);
    setEditValue(url);
  };

  const cancelEdit = () => {
    setEditingUrl(null);
    setEditValue("");
  };

  const handleEditSave = async (origUrl: string) => {
    const newValue = editValue.trim();
    const wId = workerId;
    const tId = torrent.id;
    if (!newValue || !wId) return;
    if (newValue === origUrl) {
      cancelEdit();
      return;
    }
    addPendingUrl(origUrl);
    try {
      const response = await torrentService.editTaskTracker(wId, tId, origUrl, newValue);
      if (response.error) {
        toast.error(response.error);
        return;
      }
      toast.success(t("torrentDetails.toasts.trackerEditSuccess", { defaultValue: "Tracker updated" }));
      if (isCurrentTask(wId, tId)) {
        cancelEdit();
      }
      await loadTrackers(wId, tId);
    } catch {
      toast.error(t("torrentDetails.toasts.trackerEditError", { defaultValue: "Failed to update tracker" }));
    } finally {
      removePendingUrl(origUrl);
    }
  };

  const copyButton = (text: string, field: string) => (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => copyToClipboard(text, field)}
      className="h-8 w-8 p-0 flex-shrink-0"
    >
      {copiedField === field ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
    </Button>
  );

  const renderTrackersList = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">
            {t("torrentDetails.trackersLive.loading", { defaultValue: "Loading trackers..." })}
          </span>
        </div>
      );
    }

    if (error) {
      return (
        <div className="text-center py-6">
          <div className="text-sm text-red-600 dark:text-red-400 mb-2">
            {t("torrentDetails.trackersLive.loadError", { defaultValue: "Failed to load trackers" })}
          </div>
          <div className="text-xs text-muted-foreground mb-3">{error}</div>
          <Button variant="outline" size="sm" onClick={() => loadTrackers()} className="h-8">
            {t("torrentDetails.trackersLive.retry", { defaultValue: "Try again" })}
          </Button>
        </div>
      );
    }

    if (trackers.length === 0) {
      return (
        <div className="text-center py-6 text-sm text-muted-foreground">
          {t("torrentDetails.trackersLive.empty", { defaultValue: "No trackers found" })}
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {trackers.map((tracker) => (
          <div key={tracker.url} className="p-2 container-content-background/50 rounded-md border space-y-1.5">
            <div className="flex items-center gap-2">
              <Badge variant={STATUS_VARIANT[tracker.status] ?? "outline"} className="shrink-0">
                {statusLabel(tracker.status)}
              </Badge>

              {editingUrl === tracker.url ? (
                <div className="flex-1 flex items-center gap-1.5 min-w-0">
                  <Input
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="h-8 text-xs font-mono"
                    autoFocus
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 flex-shrink-0"
                    disabled={pendingUrls.has(tracker.url)}
                    onClick={() => handleEditSave(tracker.url)}
                  >
                    <Check className="h-4 w-4 text-green-600" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 flex-shrink-0" onClick={cancelEdit}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <span className="flex-1 font-mono text-xs break-all min-w-0" title={tracker.url}>
                  {tracker.url}
                </span>
              )}

              {editingUrl !== tracker.url && (
                <div className="flex items-center gap-0.5 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => startEdit(tracker.url)}
                    title={t("torrentDetails.trackersLive.edit", { defaultValue: "Edit" }) as string}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    disabled={pendingUrls.has(tracker.url)}
                    onClick={() => handleRemove(tracker.url)}
                    title={t("torrentDetails.trackersLive.remove", { defaultValue: "Remove" }) as string}
                  >
                    {pendingUrls.has(tracker.url) ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4 text-destructive" />
                    )}
                  </Button>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground pl-1">
              <span>{t("torrentDetails.trackersLive.tier", { defaultValue: "Tier" })}: {tracker.tier}</span>
              <span>{t("torrentDetails.trackersLive.seeds", { defaultValue: "Seeds" })}: {tracker.num_seeds}</span>
              <span>{t("torrentDetails.trackersLive.peers", { defaultValue: "Peers" })}: {tracker.num_peers}</span>
              <span>{t("torrentDetails.trackersLive.leeches", { defaultValue: "Leeches" })}: {tracker.num_leeches}</span>
              {tracker.message && (
                <span className="break-all" title={tracker.message}>{tracker.message}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      <DetailCard icon={Radio} title={t("torrentDetails.trackersLive.title", { defaultValue: "Trackers" })}>
        <div className="space-y-3">
          {renderTrackersList()}

          <div className="flex items-center gap-1.5">
            <Input
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAdd();
                }
              }}
              placeholder={t("torrentDetails.trackersLive.addPlaceholder", { defaultValue: "Add tracker URL" })}
              className="h-8 text-xs font-mono"
              disabled={adding}
            />
            <Button
              variant="outline"
              size="sm"
              className="h-8 flex-shrink-0"
              disabled={adding || !newUrl.trim()}
              onClick={handleAdd}
            >
              {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              <span className="ml-1">{t("torrentDetails.trackersLive.add", { defaultValue: "Add" })}</span>
            </Button>
          </div>
        </div>
      </DetailCard>

      <DetailCard
        icon={Hash}
        title={t("torrentDetails.magnet.hash", { defaultValue: "Hash:" }).replace(/:\s*$/, "")}
        action={copyButton(torrent.hash, "hash")}
      >
        <span className="text-xs sm:text-sm font-mono break-all">{torrent.hash}</span>
      </DetailCard>

      <DetailCard
        icon={Link2}
        title={t("torrentDetails.magnet.link", { defaultValue: "Magnet Link:" }).replace(/:\s*$/, "")}
        action={copyButton(torrent.magnet_uri, "magnet")}
      >
        <span className="text-xs sm:text-sm font-mono break-all line-clamp-4" title={torrent.magnet_uri}>
          {torrent.magnet_uri}
        </span>
      </DetailCard>

      {torrent.magnet_link && (
        <DetailCard icon={Radio} title={t("torrentDetails.magnet.title", { defaultValue: "Detalhes do Magnet" })}>
          <div className="space-y-2 text-xs">
            {torrent.magnet_link.display_name && (
              <div className="flex items-center gap-2">
                <span className="font-medium">{t("torrentDetails.magnet.displayName", { defaultValue: "Display Name:" })}</span>
                <span className="text-muted-foreground break-all">{torrent.magnet_link.display_name}</span>
              </div>
            )}
            {torrent.magnet_link.exact_length && (
              <div className="flex items-center gap-2">
                <span className="font-medium">{t("torrentDetails.magnet.exactLength", { defaultValue: "Exact Length:" })}</span>
                <span className="text-muted-foreground">{formatBytes(Number(torrent.magnet_link.exact_length) || 0)}</span>
              </div>
            )}
            {torrent.magnet_link.exact_source && (
              <div className="flex items-center gap-2">
                <span className="font-medium">{t("torrentDetails.magnet.exactSource", { defaultValue: "Exact Source:" })}</span>
                <span className="text-muted-foreground break-all">{torrent.magnet_link.exact_source}</span>
              </div>
            )}
            {torrent.magnet_link.trackers && torrent.magnet_link.trackers.length > 0 && (
              <div className="space-y-1">
                <span className="font-medium">{t("torrentDetails.magnet.trackers", { defaultValue: "Trackers:" })}</span>
                <ul className="space-y-1">
                  {torrent.magnet_link.trackers.map((tracker, index) => (
                    <li key={tracker} className="flex items-center justify-between gap-2 p-2 container-content-background/50 rounded-md border">
                      <span className="font-mono break-all text-muted-foreground">{tracker}</span>
                      {copyButton(tracker, `tracker-${index}`)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </DetailCard>
      )}
    </div>
  );
}
