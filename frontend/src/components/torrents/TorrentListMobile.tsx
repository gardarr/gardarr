import { TorrentCard } from "./TorrentCard";
import { TorrentCardCompact } from "./TorrentCardCompact";
import { getTorrentRenderKey, type MobileTorrent, type TorrentListProps } from "./types";

// Re-export for backwards compatibility
export type { MobileTorrent };

interface TorrentListMobileProps extends TorrentListProps {
  variant?: "card" | "card_b";
}

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
  variant = "card",
}: Readonly<TorrentListMobileProps>) {
  if (variant === "card_b") {
    return (
      <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-2">
        {torrents.map((t) => (
          <TorrentCardCompact
            key={getTorrentRenderKey(t)}
            torrent={t}
            compact={compact}
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

  return (
    <div className={`w-full grid grid-cols-1 md:grid-cols-3 ${compact ? 'gap-2' : 'gap-4'}`}>
      {torrents.map((t) => (
        <TorrentCard
          key={getTorrentRenderKey(t)}
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
