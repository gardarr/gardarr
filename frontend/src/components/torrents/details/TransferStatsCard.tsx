import { ArrowDownUp } from "lucide-react";
import { useTranslation } from "react-i18next";
import { DetailCard } from "./DetailCard";
import { Separator } from "@/components/ui/separator";
import { formatBytes, formatBytesPerSecond } from "@/utils/bytes";
import type { Task } from "@/types/torrent";

interface TransferStatsCardProps {
  torrent: Task;
}

interface StatBarProps {
  label: string;
  value: string;
  /** Secondary muted value (e.g. speed) */
  sub?: string;
  /** Fill fraction 0..1 */
  fraction: number;
  barClass: string;
}

function StatBar({ label, value, sub, fraction, barClass }: StatBarProps) {
  const pct = Math.max(0, Math.min(100, fraction * 100));
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-16 flex-shrink-0 text-xs font-medium text-muted-foreground">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full ${barClass} transition-[width] duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="flex w-24 flex-shrink-0 items-baseline justify-end gap-1 text-right">
        <span className="font-mono text-xs font-semibold tabular-nums">{value}</span>
        {sub && <span className="font-mono text-[10px] tabular-nums text-muted-foreground">{sub}</span>}
      </span>
    </div>
  );
}

export function TransferStatsCard({ torrent }: TransferStatsCardProps) {
  const { t } = useTranslation();

  const downAmount = torrent.network?.download?.amount || 0;
  const upAmount = torrent.network?.upload?.amount || 0;
  const transferMax = Math.max(downAmount, upAmount, 1);

  const seeders = torrent.pairs?.swarm_seeders ?? 0;
  const leechers = torrent.pairs?.swarm_leechers ?? 0;
  const peersMax = Math.max(seeders, leechers, 1);

  const connSeeders = torrent.pairs?.seeders ?? 0;
  const connLeechers = torrent.pairs?.leechers ?? 0;

  return (
    <DetailCard icon={ArrowDownUp} title={t("torrentDetails.network.title", { defaultValue: "Rede e Pares" })}>
      <div className="flex h-full flex-col justify-center gap-3">
        <div className="space-y-2">
          <StatBar
            label={t("torrentDetails.download.title", { defaultValue: "Download" })}
            value={formatBytes(downAmount)}
            sub={formatBytesPerSecond(torrent.network?.download?.speed || 0)}
            fraction={downAmount / transferMax}
            barClass="bg-blue-500"
          />
          <StatBar
            label={t("torrentDetails.upload.title", { defaultValue: "Upload" })}
            value={formatBytes(upAmount)}
            sub={formatBytesPerSecond(torrent.network?.upload?.speed || 0)}
            fraction={upAmount / transferMax}
            barClass="bg-green-500"
          />
        </div>

        <Separator />

        <div className="space-y-2">
          <StatBar
            label={t("torrentDetails.swarm.seeders", { defaultValue: "Seeders" }).replace(":", "")}
            value={String(seeders)}
            sub={connSeeders ? `(${connSeeders})` : undefined}
            fraction={seeders / peersMax}
            barClass="bg-emerald-500"
          />
          <StatBar
            label={t("torrentDetails.swarm.leechers", { defaultValue: "Leechers" }).replace(":", "")}
            value={String(leechers)}
            sub={connLeechers ? `(${connLeechers})` : undefined}
            fraction={leechers / peersMax}
            barClass="bg-amber-500"
          />
        </div>
      </div>
    </DetailCard>
  );
}
