import { TorrentCard } from "./TorrentCard";
import type { MobileTorrent, TorrentListProps } from "./types";

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
  onSearchMetadata,
  onLimits,
  onMetadataUpdate,
  compact,
  selectionMode,
  selectedIds,
  onToggleSelect,
  onRequestDelete,
}: Readonly<TorrentListProps>) {
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
          onSearchMetadata={onSearchMetadata}
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
