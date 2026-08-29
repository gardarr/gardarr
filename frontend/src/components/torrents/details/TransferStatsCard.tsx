import type { LucideIcon } from "lucide-react";
import { ArrowDownUp, Download, Upload, Users, UserPlus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { DetailCard } from "./DetailCard";
import { formatBytes, formatBytesPerSecond } from "@/utils/bytes";
import type { Task } from "@/types/torrent";

interface TransferStatsCardProps {
  torrent: Task;
}

interface StatTileProps {
  icon: LucideIcon;
  label: string;
  value: string;
  /** Secondary muted value (e.g. speed, connected count) */
  sub?: string;
  colorClass: string;
}

function StatTile({ icon: Icon, label, value, sub, colorClass }: StatTileProps) {
  return (
    <div className="flex h-full items-center gap-1.5 rounded-md bg-muted/40 py-1.5 px-2">
      <Icon className={`h-3.5 w-3.5 flex-shrink-0 ${colorClass}`} />
      <span className="min-w-0 flex-1 truncate text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="flex flex-shrink-0 flex-col items-end leading-none">
        <span className="font-mono text-xs font-semibold tabular-nums">{value}</span>
        {sub && <span className="font-mono text-[9px] tabular-nums text-muted-foreground">{sub}</span>}
      </span>
    </div>
  );
}

export function TransferStatsCard({ torrent }: TransferStatsCardProps) {
  const { t } = useTranslation();

  const downAmount = torrent.network?.download?.amount || 0;
  const upAmount = torrent.network?.upload?.amount || 0;

  const seeders = torrent.pairs?.swarm_seeders ?? 0;
  const leechers = torrent.pairs?.swarm_leechers ?? 0;

  const connSeeders = torrent.pairs?.seeders ?? 0;
  const connLeechers = torrent.pairs?.leechers ?? 0;

  return (
    <DetailCard icon={ArrowDownUp} title={t("torrentDetails.network.title", { defaultValue: "Rede e Pares" })}>
      <div className="grid h-full grid-cols-2 auto-rows-fr gap-1.5">
        <StatTile
          icon={Download}
          label={t("torrentDetails.download.title", { defaultValue: "Download" })}
          value={formatBytes(downAmount)}
          sub={torrent.network?.download?.speed ? formatBytesPerSecond(torrent.network.download.speed) : undefined}
          colorClass="text-blue-500"
        />
        <StatTile
          icon={Upload}
          label={t("torrentDetails.upload.title", { defaultValue: "Upload" })}
          value={formatBytes(upAmount)}
          sub={torrent.network?.upload?.speed ? formatBytesPerSecond(torrent.network.upload.speed) : undefined}
          colorClass="text-green-500"
        />
        <StatTile
          icon={Users}
          label={t("torrentDetails.swarm.seeders", { defaultValue: "Seeders" }).replace(":", "")}
          value={String(seeders)}
          sub={connSeeders ? `(${connSeeders})` : undefined}
          colorClass="text-emerald-500"
        />
        <StatTile
          icon={UserPlus}
          label={t("torrentDetails.swarm.leechers", { defaultValue: "Leechers" }).replace(":", "")}
          value={String(leechers)}
          sub={connLeechers ? `(${connLeechers})` : undefined}
          colorClass="text-amber-500"
        />
      </div>
    </DetailCard>
  );
}
