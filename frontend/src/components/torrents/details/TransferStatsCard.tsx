import { ArrowDown, ArrowUp, Users, Wifi, ArrowDownUp } from "lucide-react";
import { useTranslation } from "react-i18next";
import { DetailCard } from "./DetailCard";
import { formatBytes, formatBytesPerSecond } from "@/utils/bytes";
import type { Task } from "@/types/torrent";

interface TransferStatsCardProps {
  torrent: Task;
}

export function TransferStatsCard({ torrent }: TransferStatsCardProps) {
  const { t } = useTranslation();

  const groups = [
    {
      icon: ArrowDown,
      title: t("torrentDetails.download.title", { defaultValue: "Download" }),
      iconClass: "text-blue-600 dark:text-blue-400",
      rows: [
        { label: t("torrentDetails.download.speed", { defaultValue: "Velocidade:" }), value: formatBytesPerSecond(torrent.network?.download?.speed || 0) },
        { label: t("torrentDetails.download.total", { defaultValue: "Total:" }), value: formatBytes(torrent.network?.download?.amount || 0) },
      ],
    },
    {
      icon: ArrowUp,
      title: t("torrentDetails.upload.title", { defaultValue: "Upload" }),
      iconClass: "text-green-600 dark:text-green-400",
      rows: [
        { label: t("torrentDetails.upload.speed", { defaultValue: "Velocidade:" }), value: formatBytesPerSecond(torrent.network?.upload?.speed || 0) },
        { label: t("torrentDetails.upload.total", { defaultValue: "Total:" }), value: formatBytes(torrent.network?.upload?.amount || 0) },
      ],
    },
    {
      icon: Users,
      title: t("torrentDetails.swarm.title", { defaultValue: "Swarm" }),
      iconClass: "text-purple-600 dark:text-purple-400",
      rows: [
        { label: t("torrentDetails.swarm.seeders", { defaultValue: "Seeders:" }), value: String(torrent.pairs?.swarm_seeders ?? 0) },
        { label: t("torrentDetails.swarm.leechers", { defaultValue: "Leechers:" }), value: String(torrent.pairs?.swarm_leechers ?? 0) },
      ],
    },
    {
      icon: Wifi,
      title: t("torrentDetails.connected.title", { defaultValue: "Conectados" }),
      iconClass: "text-orange-600 dark:text-orange-400",
      rows: [
        { label: t("torrentDetails.connected.seeders", { defaultValue: "Seeders:" }), value: String(torrent.pairs?.seeders ?? 0) },
        { label: t("torrentDetails.connected.leechers", { defaultValue: "Leechers:" }), value: String(torrent.pairs?.leechers ?? 0) },
      ],
    },
  ];

  return (
    <DetailCard icon={ArrowDownUp} title={t("torrentDetails.network.title", { defaultValue: "Rede e Pares" })}>
      <div className="grid grid-cols-2 gap-3 h-full content-center">
        {groups.map(({ icon: Icon, title, iconClass, rows }) => (
          <div key={title} className="space-y-1">
            <div className="flex items-center gap-1.5">
              <Icon className={`h-3.5 w-3.5 ${iconClass}`} />
              <span className="text-xs font-medium">{title}</span>
            </div>
            {rows.map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between gap-2 text-xs">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-mono">{value}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </DetailCard>
  );
}
