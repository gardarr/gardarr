import { AlignLeft, FolderOpen } from "lucide-react";
import { useTranslation } from "react-i18next";
import { TorrentRatioWidget } from "@/components/widgets/TorrentRatioWidget";
import { TorrentLifetimeWidget } from "@/components/widgets/TorrentLifetimeWidget";
import type { Task } from "@/types/torrent";
import type { Category } from "@/types/category";
import { DetailCard } from "./DetailCard";
import { AutoSaveField } from "./AutoSaveField";
import { TransferStatsCard } from "./TransferStatsCard";
import { CategoryTagsCard } from "./CategoryTagsCard";

interface OverviewTabProps {
  torrent: Task;
  onSetLocation?: (torrentId: string, location: string) => void;
  onCategoryDataChange?: (category: Category | null) => void;
  onCategoryTagsUpdate?: (torrentId: string, patch: { category?: string; tags?: string[] }) => void;
  onShare?: () => void;
}

export function OverviewTab({ torrent, onSetLocation, onCategoryDataChange, onCategoryTagsUpdate, onShare }: OverviewTabProps) {
  const { t } = useTranslation();

  const handleSavePath = (path: string) => onSetLocation?.(torrent.id, path);

  return (
    <div className="space-y-3 sm:space-y-4">
      {torrent.metadata?.description && (
        <DetailCard icon={AlignLeft} title={t("torrentDetails.description.label", { defaultValue: "Descrição" })}>
          <p className="text-sm text-muted-foreground leading-relaxed">{torrent.metadata.description}</p>
        </DetailCard>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <TorrentRatioWidget
          ratio={torrent.ratio}
          popularity={torrent.popularity}
          totalUploaded={torrent.network?.upload?.amount}
          onShare={onShare}
        />
        <TransferStatsCard torrent={torrent} />
      </div>

      <TorrentLifetimeWidget task={torrent} />

      <CategoryTagsCard torrent={torrent} onCategoryDataChange={onCategoryDataChange} onCategoryTagsUpdate={onCategoryTagsUpdate} />

      <div className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground">{t("torrentDetails.path.title", { defaultValue: "Caminho" })}</h3>
        {onSetLocation ? (
          <AutoSaveField
            icon={FolderOpen}
            value={torrent.path}
            ariaLabel={t("torrentDetails.path.edit", { defaultValue: "Editar caminho" })}
            copyText={torrent.path}
            onSave={handleSavePath}
          />
        ) : (
          <div className="flex min-h-7 items-center gap-2 text-xs sm:text-sm">
            <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 break-all text-muted-foreground">{torrent.path}</span>
          </div>
        )}
      </div>
    </div>
  );
}
