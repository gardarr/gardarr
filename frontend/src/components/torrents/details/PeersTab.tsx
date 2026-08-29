import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Users, Ban, Globe } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatBytesPerSecond } from "@/utils/bytes";
import { CountryFlag } from "@/utils/flags";
import type { Task, TaskPeer } from "@/types/torrent";
import { torrentService } from "@/services/torrents";
import { DetailCard } from "./DetailCard";

interface PeersTabProps {
  torrent: Task;
}

interface CountryCount {
  code: string; // "" bucket for peers with no GeoIP resolution
  count: number;
}

const MOBILE_MAX_COUNTRIES = 5;
const DESKTOP_MAX_COUNTRIES = 10;

export function PeersTab({ torrent }: PeersTabProps) {
  const { t } = useTranslation();
  const workerId = torrent.worker?.uuid || torrent.worker_id || "";

  const [peers, setPeers] = useState<TaskPeer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [banningKey, setBanningKey] = useState<string | null>(null);
  const [peerToBan, setPeerToBan] = useState<TaskPeer | null>(null);

  // Guards an in-flight load against the user navigating to a different
  // torrent before it resolves, same pattern as TrackersTab.
  const activeTaskRef = useRef({ workerId, taskId: torrent.id });
  activeTaskRef.current = { workerId, taskId: torrent.id };
  const isCurrentTask = (wId: string, tId: string) =>
    activeTaskRef.current.workerId === wId && activeTaskRef.current.taskId === tId;

  const loadPeers = async (wId: string = workerId, tId: string = torrent.id) => {
    if (!wId || !tId || !isCurrentTask(wId, tId)) return;
    setLoading(true);
    setError(null);
    try {
      const response = await torrentService.listTaskPeers(wId, tId);
      if (!isCurrentTask(wId, tId)) return;
      if (response.error) {
        setError(response.error);
      } else {
        setPeers(response.data ?? []);
      }
    } catch (err) {
      if (!isCurrentTask(wId, tId)) return;
      setError(err instanceof Error ? err.message : "Failed to load peers");
    } finally {
      if (isCurrentTask(wId, tId)) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    loadPeers(workerId, torrent.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workerId, torrent.id]);

  // Most active peers (highest combined transfer speed) first; fully idle
  // peers (no upload or download activity) always trail at the bottom.
  const sortedPeers = useMemo<TaskPeer[]>(() => {
    return [...peers].sort((a, b) => (b.dl_speed + b.up_speed) - (a.dl_speed + a.up_speed));
  }, [peers]);

  const countryCounts = useMemo<CountryCount[]>(() => {
    const counts = new Map<string, number>();
    for (const peer of peers) {
      const code = peer.country_code ? peer.country_code.toUpperCase() : "";
      counts.set(code, (counts.get(code) ?? 0) + 1);
    }
    return Array.from(counts, ([code, count]) => ({ code, count })).sort(
      (a, b) => b.count - a.count || a.code.localeCompare(b.code)
    );
  }, [peers]);

  const renderCountryCounts = (max: number, className: string, testId: string) => {
    if (countryCounts.length === 0) return null;
    const visible = countryCounts.slice(0, max);
    const overflow = countryCounts.length - visible.length;

    return (
      <div className={`flex flex-wrap items-center gap-1 ${className}`} data-testid={testId}>
        {visible.map(({ code, count }) => (
          <span
            key={code || "unknown"}
            className="inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[11px]"
            title={code || t("torrentDetails.peers.unknownCountry", { defaultValue: "Unknown" })}
          >
            {code ? (
              <CountryFlag countryCode={code} className="h-3 w-4 rounded-sm" />
            ) : (
              <Globe className="h-3 w-3 text-muted-foreground" />
            )}
            <span className="tabular-nums text-muted-foreground">{count}</span>
          </span>
        ))}
        {overflow > 0 && (
          <span className="inline-flex items-center rounded-full border px-1.5 py-0.5 text-[11px] text-muted-foreground">
            +{overflow}
          </span>
        )}
      </div>
    );
  };

  const handleConfirmBan = async () => {
    const peer = peerToBan;
    const wId = workerId;
    if (!peer || !wId) return;
    const key = `${peer.ip}:${peer.port}`;
    setPeerToBan(null);
    setBanningKey(key);
    try {
      const response = await torrentService.banPeer(wId, peer.ip, peer.port);
      if (response.error) {
        toast.error(response.error);
        return;
      }
      toast.success(t("torrentDetails.peers.banSuccess", { defaultValue: "Peer banned on this worker" }));
      if (isCurrentTask(wId, torrent.id)) {
        setPeers((prev) => prev.filter((p) => `${p.ip}:${p.port}` !== key));
      }
    } catch {
      toast.error(t("torrentDetails.peers.banError", { defaultValue: "Failed to ban peer" }));
    } finally {
      setBanningKey(null);
    }
  };

  const renderPeersList = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">
            {t("torrentDetails.peers.loading", { defaultValue: "Loading peers..." })}
          </span>
        </div>
      );
    }

    if (error) {
      return (
        <div className="text-center py-6">
          <div className="text-sm text-red-600 dark:text-red-400 mb-2">
            {t("torrentDetails.peers.loadError", { defaultValue: "Failed to load peers" })}
          </div>
          <div className="text-xs text-muted-foreground mb-3">{error}</div>
          <Button variant="outline" size="sm" onClick={() => loadPeers()} className="h-8">
            {t("torrentDetails.peers.retry", { defaultValue: "Try again" })}
          </Button>
        </div>
      );
    }

    if (peers.length === 0) {
      return (
        <div className="text-center py-6 text-sm text-muted-foreground">
          {t("torrentDetails.peers.empty", { defaultValue: "No peers connected" })}
        </div>
      );
    }

    return (
      <div className="space-y-1.5">
        {sortedPeers.map((peer) => {
          const key = `${peer.ip}:${peer.port}`;
          return (
            <div
              key={key}
              className="flex items-center gap-2 px-2 py-1.5 container-content-background/50 rounded-md border text-xs"
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="shrink-0 inline-flex items-center">
                    <CountryFlag countryCode={peer.country_code} className="h-3.5 w-5 rounded-sm" />
                  </span>
                </TooltipTrigger>
                <TooltipContent>{peer.country || peer.country_code || "?"}</TooltipContent>
              </Tooltip>

              <span className="font-mono truncate min-w-0 flex-1" title={key}>
                {peer.ip}:{peer.port}
              </span>

              {peer.client && (
                <span
                  className="hidden sm:inline truncate max-w-[9rem] text-muted-foreground shrink-0"
                  title={peer.flags_desc}
                >
                  {peer.client}
                </span>
              )}

              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="shrink-0 tabular-nums text-muted-foreground hover:text-foreground underline decoration-dotted underline-offset-2"
                  >
                    {(peer.progress * 100).toFixed(0)}%
                  </button>
                </PopoverTrigger>
                <PopoverContent side="top" className="w-auto px-2 py-1 text-xs">
                  {t("torrentDetails.peers.progress", { defaultValue: "Progress" })}
                </PopoverContent>
              </Popover>

              <span className="shrink-0 tabular-nums text-muted-foreground">↓ {formatBytesPerSecond(peer.dl_speed)}</span>
              <span className="shrink-0 tabular-nums text-muted-foreground">↑ {formatBytesPerSecond(peer.up_speed)}</span>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 shrink-0"
                    disabled={banningKey === key}
                    onClick={() => setPeerToBan(peer)}
                    aria-label={t("torrentDetails.peers.banTooltip", {
                      defaultValue: "Ban this peer on every torrent on this worker",
                    })}
                  >
                    {banningKey === key ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Ban className="h-4 w-4 text-destructive" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {t("torrentDetails.peers.banTooltip", {
                    defaultValue: "Ban this peer on every torrent on this worker",
                  })}
                </TooltipContent>
              </Tooltip>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      <DetailCard
        icon={Users}
        title={t("torrentDetails.peers.title", { defaultValue: "Peers" })}
        action={
          !loading && !error && peers.length > 0 ? (
            <div className="ml-2">
              {renderCountryCounts(MOBILE_MAX_COUNTRIES, "flex sm:hidden", "country-counts-mobile")}
              {renderCountryCounts(DESKTOP_MAX_COUNTRIES, "hidden sm:flex", "country-counts-desktop")}
            </div>
          ) : undefined
        }
      >
        {renderPeersList()}
      </DetailCard>

      <Dialog open={peerToBan !== null} onOpenChange={(open) => !open && setPeerToBan(null)}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>{t("torrentDetails.peers.banConfirmTitle", { defaultValue: "Ban this peer?" })}</DialogTitle>
            <DialogDescription>
              {t("torrentDetails.peers.banConfirmDescription", {
                defaultValue: "This bans {{peer}} from every torrent on this worker, not just this one.",
                peer: peerToBan ? `${peerToBan.ip}:${peerToBan.port}` : "",
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setPeerToBan(null)}>
              {t("torrentDetails.peers.banCancel", { defaultValue: "Cancel" })}
            </Button>
            <Button variant="destructive" onClick={handleConfirmBan}>
              {t("torrentDetails.peers.banConfirm", { defaultValue: "Ban peer" })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
