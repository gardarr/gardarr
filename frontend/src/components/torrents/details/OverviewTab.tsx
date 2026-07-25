import { AlignLeft, FolderOpen } from "lucide-react";
import { useTranslation } from "react-i18next";
import { TorrentRatioWidget } from "@/components/widgets/TorrentRatioWidget";
import { TorrentLifetimeWidget } from "@/components/widgets/TorrentLifetimeWidget";
import type { Task, TaskMetadata } from "@/types/torrent";
import type { Category } from "@/types/category";
import { DetailCard } from "./DetailCard";
import { InlineEditableText } from "./InlineEditableText";
import { TransferStatsCard } from "./TransferStatsCard";
import { CategoryTagsCard } from "./CategoryTagsCard";

interface OverviewTabProps {
  torrent: Task;
  onSetLocation?: (torrentId: string, location: string) => void;
  onUpdate?: (metadata?: TaskMetadata) => Promise<void> | void;
  onCategoryDataChange?: (category: Category | null) => void;
}

export function OverviewTab({ torrent, onSetLocation, onUpdate, onCategoryDataChange }: OverviewTabProps) {
  const { t } = useTranslation();

  const handleSavePath = (path: string) => {
    if (onSetLocation) {
      onSetLocation(torrent.id, path);
    }
  };

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
        />
        <TransferStatsCard torrent={torrent} />
      </div>

      <TorrentLifetimeWidget task={torrent} />

      <CategoryTagsCard torrent={torrent} onUpdate={onUpdate} onCategoryDataChange={onCategoryDataChange} />

      <div className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground">{t("torrentDetails.path.title", { defaultValue: "Caminho" })}</h3>
        <InlineEditableText
          icon={FolderOpen}
          value={torrent.path}
          editLabel={t("torrentDetails.path.edit", { defaultValue: "Editar caminho" })}
          saveLabel={t("torrentDetails.path.save", { defaultValue: "Salvar caminho" })}
          copyText={torrent.path}
          onSave={handleSavePath}
          display={<span className="text-xs sm:text-sm break-all leading-relaxed">{torrent.path}</span>}
        />
      </div>
    </div>
  );
}
