import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { RatioBadge } from "@/components/RatioBadge";
import { getStatusBackgroundColor } from "./TorrentStatusIcon";
import { formatBytesPerSecond } from "@/utils/bytes";
import { truncateText } from "@/utils/textUtils";
import taskDefaultBg from "@/assets/img/common/task-default-background.png";
import { Download, Upload } from "lucide-react";
import SeedersAndPeersBadge from "@/components/SeedersAndPeersBadge";
import type { TaskMetadata } from "@/types/torrent";

interface TorrentCardPreviewProps {
  taskName: string;
  metadata?: TaskMetadata | null;
  imagePositionY: number;
  imageBrightness: number;
  compact?: boolean;
}

export function TorrentCardPreview({
  taskName,
  metadata,
  imagePositionY,
  imageBrightness,
  compact = false,
}: TorrentCardPreviewProps) {
  const blurPx = 12; // Default blur
  const hasImage = !!metadata?.image_url;
  const encodedImageUrl = hasImage && metadata?.image_url ? encodeURI(metadata.image_url) : null;

  // Mock data for preview
  const mockTorrent = {
    name: taskName,
    status: "DOWNLOADING" as const,
    ratio: 1.5,
    uploadRateBps: 5242880, // 5 MB/s
    downloadRateBps: 10485760, // 10 MB/s
    progress: 45,
    numSeeds: 25,
    numLeechs: 10,
  };

  return (
    <Card className="hover:shadow-lg transition-shadow overflow-hidden p-0 gap-2 relative pointer-events-none">
      {/* Background image for entire card */}
      {hasImage ? (
        <div
          className="absolute inset-0 bg-cover pointer-events-none z-0"
          style={{
            backgroundImage: `url(${encodedImageUrl})`,
            ...(blurPx > 0 && { filter: `blur(${blurPx}px)` }),
            backgroundPosition: `center ${imagePositionY}%`,
            opacity: Math.max(0.15, Math.min(0.85, imageBrightness / 100))
          }}
          aria-hidden
        />
      ) : (
        <div
          className="absolute inset-0 bg-cover pointer-events-none z-0 opacity-[0.12] dark:opacity-[0.03]"
          style={{ backgroundImage: `url(${taskDefaultBg})` }}
          aria-hidden
        />
      )}

      {compact ? (
        <>
          <CardHeader className={`flex flex-row items-center justify-between space-y-0 py-1.5 px-2.5 relative z-10 ${!hasImage ? getStatusBackgroundColor(mockTorrent.status) : ''}`}>
            <BlurOverlay hasImage={hasImage} blurPx={blurPx} opacityClass="bg-white/30" />
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <StatusBadge status={mockTorrent.status} size="sm" showTooltip={false} />
              <CardTitle className="text-[11px] font-medium text-muted-foreground dark:text-gray-400 truncate">
                {truncateText(mockTorrent.name)}
              </CardTitle>
            </div>
            <div className="flex-shrink-0 ml-2 inline-flex items-center gap-1">
              <RatioBadge ratio={mockTorrent.ratio} showValue={false} showIcon={true} />
            </div>
          </CardHeader>
          <CardContent className="px-3 pt-0 pb-3 relative z-10">
            <div className="flex gap-2 items-center">
              {hasImage && (
                <div className="flex-shrink-0">
                  <img
                    src={encodedImageUrl!}
                    alt={mockTorrent.name}
                    className="w-16 h-16 object-cover rounded-md"
                  />
                </div>
              )}
              <div className="flex-1 flex flex-col gap-1.5 text-[11px] text-muted-foreground">
                <StatBadge
                  icon={Upload}
                  rate={mockTorrent.uploadRateBps}
                  colorClass="text-purple-600 dark:text-purple-400"
                  hasImage={hasImage}
                  blurPx={blurPx}
                  compact
                />
                <StatBadge
                  icon={Download}
                  rate={mockTorrent.downloadRateBps}
                  colorClass="text-green-600 dark:text-green-400"
                  hasImage={hasImage}
                  blurPx={blurPx}
                  compact
                />
              </div>
              <div className="flex flex-col items-end gap-1 ml-2">
                <ProgressBadge progress={mockTorrent.progress} hasImage={hasImage} blurPx={blurPx} size="text-base" />
                <SeedersAndPeersBadge seeders={mockTorrent.numSeeds} leechers={mockTorrent.numLeechs} blur={hasImage} blurIntensity={50} />
              </div>
            </div>
          </CardContent>
        </>
      ) : (
        <>
          <CardHeader className={`flex flex-row items-center justify-between space-y-0 pt-3 pb-3 px-4 relative z-10 ${!hasImage ? getStatusBackgroundColor(mockTorrent.status) : ''}`}>
            <BlurOverlay hasImage={hasImage} blurPx={blurPx} opacityClass="bg-white/60" />
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="flex-shrink-0">
                <StatusBadge status={mockTorrent.status} size="lg" />
              </div>
              <CardTitle className="text-sm font-medium text-muted-foreground dark:text-gray-400 truncate">
                {truncateText(mockTorrent.name)}
              </CardTitle>
            </div>
            <div className="flex-shrink-0 ml-2 flex items-center gap-2">
              <RatioBadge ratio={mockTorrent.ratio} showValue={false} showIcon={true} />
            </div>
          </CardHeader>
          <CardContent className="px-4 pt-1 pb-6 relative z-10">
            <div className="flex gap-3 items-center">
              {hasImage && (
                <div className="flex-shrink-0">
                  <img
                    src={encodedImageUrl!}
                    alt={mockTorrent.name}
                    className="w-24 h-24 object-cover rounded-md"
                  />
                </div>
              )}
              <div className="flex-1 flex flex-col gap-2 text-xs text-muted-foreground">
                <StatBadge
                  icon={Upload}
                  rate={mockTorrent.uploadRateBps}
                  colorClass="text-purple-600 dark:text-purple-400"
                  hasImage={hasImage}
                  blurPx={blurPx}
                />
                <StatBadge
                  icon={Download}
                  rate={mockTorrent.downloadRateBps}
                  colorClass="text-green-600 dark:text-green-400"
                  hasImage={hasImage}
                  blurPx={blurPx}
                />
              </div>
              <div className="flex flex-col items-end gap-2 ml-3">
                <ProgressBadge progress={mockTorrent.progress} hasImage={hasImage} blurPx={blurPx} size="text-lg" />
                <SeedersAndPeersBadge seeders={mockTorrent.numSeeds} leechers={mockTorrent.numLeechs} blur={hasImage} blurIntensity={50} />
              </div>
            </div>
          </CardContent>
        </>
      )}
    </Card>
  );
}

// Helper Components
function BlurOverlay({ hasImage, blurPx, rounded = false, opacityClass = "bg-white/50" }: { hasImage: boolean, blurPx: number, rounded?: boolean, opacityClass?: string }) {
  if (!hasImage) return null;
  return (
    <>
      <div className={`absolute inset-0 bg-background/20 -z-10 ${rounded ? 'rounded-md' : ''}`} style={blurPx > 0 ? { backdropFilter: `blur(${blurPx}px)` } : undefined} aria-hidden />
      <div className={`absolute inset-0 ${opacityClass} dark:bg-black/40 -z-10 ${rounded ? 'rounded-md' : ''}`} aria-hidden />
    </>
  );
}

function StatBadge({ icon: Icon, rate, colorClass, hasImage, blurPx, compact = false }: {
  icon: React.ElementType,
  rate: number,
  colorClass: string,
  hasImage: boolean,
  blurPx: number,
  compact?: boolean
}) {
  return (
    <div className={`flex items-center gap-1.5 relative px-2 py-1 w-fit ${compact ? 'px-1.5 py-0.5' : ''}`}>
      <BlurOverlay hasImage={hasImage} blurPx={blurPx} rounded />
      <Icon className={`${compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} ${colorClass}`} aria-hidden="true" />
      <span className={rate > 0 ? colorClass : ''}>
        {formatBytesPerSecond(rate)}
      </span>
    </div>
  );
}

function ProgressBadge({ progress, hasImage, blurPx, size }: { progress: number, hasImage: boolean, blurPx: number, size: string }) {
  return (
    <span className={`${size} text-muted-foreground relative px-2 py-1`}>
      <BlurOverlay hasImage={hasImage} blurPx={blurPx} rounded />
      {progress.toFixed(0)}%
    </span>
  );
}
