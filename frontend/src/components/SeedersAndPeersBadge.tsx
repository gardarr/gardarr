import { ArrowUp, ArrowDown } from "lucide-react";

interface SeedersAndPeersBadgeProps {
  seeders: number;
  leechers: number;
  blur?: boolean;
  blurIntensity?: number;
}

export default function SeedersAndPeersBadge({ seeders, leechers, blur = false, blurIntensity = 50 }: SeedersAndPeersBadgeProps) {
  // Convert blur intensity (0-100) to pixels
  // Scale: 0 = 0px, 50 = 12px, 100 = 24px
  const blurPx = Math.round((blurIntensity / 100) * 24);
  return (
    <div className={`inline-flex items-center rounded-full border border-border p-0.5 text-xs font-medium relative ${blur ? '' : 'bg-background'}`}>
      {blur && (
        <>
          <div className="absolute inset-0 bg-background/20 -z-10 rounded-full" style={blurPx > 0 ? { backdropFilter: `blur(${blurPx}px)` } : undefined} aria-hidden />
          <div className="absolute inset-0 bg-white/50 dark:bg-black/40 -z-10 rounded-full" aria-hidden />
        </>
      )}
      <div className="px-1.5 py-1 text-green-600 dark:text-green-400 border-r border-border flex items-center gap-1">
        <ArrowUp className="w-3 h-3" />
        <span>{seeders}</span>
      </div>
      <div className="px-1.5 py-1 text-blue-600 dark:text-blue-400 flex items-center gap-1">
        <ArrowDown className="w-3 h-3" />
        <span>{leechers}</span>
      </div>
    </div>
  );
}