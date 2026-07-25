import { Check, Copy, Hash, Link2, Radio } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/utils/bytes";
import type { Task } from "@/types/torrent";
import { DetailCard } from "./DetailCard";
import { useCopyToClipboard } from "./useCopyToClipboard";

interface TrackersTabProps {
  torrent: Task;
}

export function TrackersTab({ torrent }: TrackersTabProps) {
  const { t } = useTranslation();
  const { copiedField, copyToClipboard } = useCopyToClipboard();

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

  return (
    <div className="space-y-3 sm:space-y-4">
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
                    <li key={index} className="flex items-center justify-between gap-2 p-2 container-content-background/50 rounded-md border">
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
