import { TorrentCard, type MobileTorrent } from "@/components/TorrentCard";

// Re-export for backwards compatibility
export type { MobileTorrent };

export default function TorrentListMobile({
  torrents,
  onShowDetails,
  onStart,
  onStop,
  onRemove,
  onForceDownload,
  onForceReannounce,
  onForceRecheck,
  onLimits,
  onMetadataUpdate,
  compact,
  selectionMode,
  selectedIds,
  onToggleSelect,
  onRequestDelete,
}: Readonly<{
  torrents: MobileTorrent[];
  onShowDetails: (id: string) => void;
  onStart: (id: string) => void;
  onStop: (id: string) => void;
  onRemove: (id: string) => void;
  onForceDownload: (id: string) => void;
  onForceReannounce: (id: string) => void;
  onForceRecheck: (id: string) => void;
  onLimits?: (taskId: string, workerId?: string) => void;
  onMetadataUpdate?: () => void;
  compact?: boolean;
  selectionMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onRequestDelete?: (ids: string[]) => void;
}>) {
  return (
    <div className={`w-full grid grid-cols-1 md:grid-cols-3 ${compact ? 'gap-2' : 'gap-4'}`}>
      {torrents.map((t) => (
        <TorrentCard
          key={t.id}
          torrent={t}
          onShowDetails={onShowDetails}
          onStart={onStart}
          onStop={onStop}
          onRemove={onRemove}
          onForceDownload={onForceDownload}
          onForceReannounce={onForceReannounce}
          onForceRecheck={onForceRecheck}
          onLimits={onLimits}
          onMetadataUpdate={onMetadataUpdate}
          compact={compact}
          selectionMode={selectionMode}
          selected={!!selectedIds?.has(t.id)}
          onToggleSelect={onToggleSelect}
          selectedIds={selectedIds}
          onRequestDelete={onRequestDelete}
        />
      ))}
    </div>
  );
}
