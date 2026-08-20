import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CustomScrollArea } from "@/components/ui/custom-scroll-area";
import { FileText, Files, Radio, Image } from "lucide-react";
import { DeleteTorrentModal } from "@/components/DeleteTorrentModal";
import { useTranslation } from "react-i18next";
import type { Task, TaskMetadata } from "@/types/torrent";
import type { Category } from "@/types/category";
import { TorrentFilesList } from "./TorrentFilesList";
import { TorrentImageEditor } from "./TorrentImageEditor";
import { TorrentHeroHeader } from "./details/TorrentHeroHeader";
import { TorrentActionBar } from "./details/TorrentActionBar";
import { OverviewTab } from "./details/OverviewTab";
import { TrackersTab } from "./details/TrackersTab";
import { ShareableTorrentCardDialog } from "./share/ShareableTorrentCardDialog";

interface TorrentDetailsModalProps {
  torrent: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onPlay?: (torrentId: string) => void;
  onPause?: (torrentId: string) => void;
  onDelete?: (torrentId: string, purge: boolean) => void;
  onForceDownload?: (torrentId: string) => void;
  onForceReannounce?: (torrentId: string) => void;
  onForceRecheck?: (torrentId: string) => void;
  onSetLocation?: (torrentId: string, location: string) => void;
  onUpdate?: (metadata?: TaskMetadata) => Promise<void> | void;
  onCategoryTagsUpdate?: (torrentId: string, patch: { category?: string; tags?: string[] }) => void;
}

export function TorrentDetailsModal({
  torrent,
  isOpen,
  onClose,
  onPlay,
  onPause,
  onDelete,
  onForceDownload,
  onForceReannounce,
  onForceRecheck,
  onSetLocation,
  onUpdate,
  onCategoryTagsUpdate,
}: TorrentDetailsModalProps) {
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [currentCategoryData, setCurrentCategoryData] = useState<Category | null>(null);
  const { t } = useTranslation();

  if (!torrent) return null;

  const handleDeleteConfirm = (purge: boolean) => {
    if (onDelete) {
      onDelete(torrent.id, purge);
    }
    setIsDeleteModalOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-4xl h-[90vh] max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>{t("torrentDetails.title")}</DialogTitle>
          <DialogDescription>{t("torrentDetails.subtitle")}</DialogDescription>
        </DialogHeader>

        <div className="shrink-0 space-y-3">
          <TorrentHeroHeader torrent={torrent} onUpdate={onUpdate} />
          <TorrentActionBar
            torrentId={torrent.id}
            onPlay={onPlay}
            onPause={onPause}
            onForceDownload={onForceDownload}
            onForceReannounce={onForceReannounce}
            onForceRecheck={onForceRecheck}
            onShare={() => setIsShareModalOpen(true)}
            onDelete={onDelete ? () => setIsDeleteModalOpen(true) : undefined}
          />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex-1 flex flex-col min-h-0 overflow-hidden">
          <TabsList className="grid w-full grid-cols-4 shrink-0">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <FileText className="h-4 w-4 hidden sm:block" />
              {t("torrentDetails.tabs.overview", { defaultValue: "Visão Geral" })}
            </TabsTrigger>
            <TabsTrigger value="files" className="flex items-center gap-2">
              <Files className="h-4 w-4 hidden sm:block" />
              {t("torrentDetails.tabs.files", { defaultValue: "Arquivos" })}
            </TabsTrigger>
            <TabsTrigger value="trackers" className="flex items-center gap-2">
              <Radio className="h-4 w-4 hidden sm:block" />
              {t("torrentDetails.tabs.trackers", { defaultValue: "Trackers" })}
            </TabsTrigger>
            <TabsTrigger value="image" className="flex items-center gap-2">
              <Image className="h-4 w-4 hidden sm:block" />
              {t("torrentDetails.tabs.image", { defaultValue: "Imagem" })}
            </TabsTrigger>
          </TabsList>

          {/* key resets scroll position when switching tabs */}
          <CustomScrollArea key={activeTab} className="w-full flex-1 min-h-0" variant="thin" mobileFallback>
            <TabsContent value="overview" className="mt-4">
              <OverviewTab
                torrent={torrent}
                onSetLocation={onSetLocation}
                onCategoryDataChange={setCurrentCategoryData}
                onCategoryTagsUpdate={onCategoryTagsUpdate}
                onShare={() => setIsShareModalOpen(true)}
              />
            </TabsContent>

            <TabsContent value="files" className="mt-4">
              <TorrentFilesList
                workerId={torrent.worker?.uuid || ""}
                taskId={torrent.id}
                defaultOpen
                title={t("torrentDetails.files.title", { defaultValue: "Lista de Arquivos" })}
              />
            </TabsContent>

            <TabsContent value="trackers" className="mt-4">
              <TrackersTab torrent={torrent} />
            </TabsContent>

            <TabsContent value="image" className="mt-4">
              <TorrentImageEditor
                taskHash={torrent.hash}
                taskName={torrent.name}
                category={currentCategoryData}
                metadata={torrent.metadata}
                onUpdate={onUpdate}
              />
            </TabsContent>
          </CustomScrollArea>
        </Tabs>
      </DialogContent>

      <DeleteTorrentModal
        isOpen={isDeleteModalOpen}
        torrentName={torrent.name}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDeleteConfirm}
      />

      <ShareableTorrentCardDialog
        torrent={torrent}
        open={isShareModalOpen}
        onOpenChange={setIsShareModalOpen}
      />
    </Dialog>
  );
}
