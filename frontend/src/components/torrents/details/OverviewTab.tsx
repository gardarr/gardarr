import { useEffect, useRef, useState } from "react";
import { AlignLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { TorrentRatioWidget } from "@/components/widgets/TorrentRatioWidget";
import { TorrentLifetimeWidget } from "@/components/widgets/TorrentLifetimeWidget";
import type { Task } from "@/types/torrent";
import type { Category } from "@/types/category";
import { DetailCard } from "./DetailCard";
import { TransferStatsCard } from "./TransferStatsCard";
import { CategoryTagsCard } from "./CategoryTagsCard";

interface OverviewTabProps {
  torrent: Task;
  onCategoryDataChange?: (category: Category | null) => void;
  onCategoryTagsUpdate?: (torrentId: string, patch: { category?: string; tags?: string[] }) => void;
  onShare?: () => void;
}

export function OverviewTab({ torrent, onCategoryDataChange, onCategoryTagsUpdate, onShare }: OverviewTabProps) {
  const { t } = useTranslation();
  const descriptionRef = useRef<HTMLParagraphElement>(null);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [descriptionOverflows, setDescriptionOverflows] = useState(false);
  const description = torrent.metadata?.description;

  useEffect(() => {
    setIsDescriptionExpanded(false);

    const frame = requestAnimationFrame(() => {
      const element = descriptionRef.current;
      setDescriptionOverflows(Boolean(element && element.scrollHeight > element.clientHeight));
    });

    return () => cancelAnimationFrame(frame);
  }, [description]);

  return (
    <div className="space-y-3 sm:space-y-4">
      {description && (
        <DetailCard icon={AlignLeft} title={t("torrentDetails.description.label", { defaultValue: "Descrição" })}>
          <div>
            <p
              ref={descriptionRef}
              className={`text-sm leading-relaxed text-muted-foreground ${isDescriptionExpanded ? "" : "line-clamp-3"}`}
            >
              {description}
            </p>
            {descriptionOverflows && (
              <button
                type="button"
                className="mt-2 text-sm font-medium text-primary hover:underline"
                onClick={() => setIsDescriptionExpanded((expanded) => !expanded)}
                aria-expanded={isDescriptionExpanded}
              >
                {isDescriptionExpanded
                  ? t("torrentDetails.description.showLess", { defaultValue: "Mostrar menos" })
                  : t("torrentDetails.description.showMore", { defaultValue: "Mostrar mais" })}
              </button>
            )}
          </div>
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

      <CategoryTagsCard torrent={torrent} onCategoryDataChange={onCategoryDataChange} onCategoryTagsUpdate={onCategoryTagsUpdate} />

      <TorrentLifetimeWidget task={torrent} />

    </div>
  );
}
