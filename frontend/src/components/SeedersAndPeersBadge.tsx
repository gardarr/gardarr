interface SeedersAndPeersBadgeProps {
  seeders: number;
  leechers: number;
}

export default function SeedersAndPeersBadge({ seeders, leechers }: SeedersAndPeersBadgeProps) {
  return (
    <div className="inline-flex items-center rounded-full border border-border bg-background p-0.5 text-xs font-medium">
      <div className="px-1.5 py-1 text-green-600 dark:text-green-400 border-r border-border">
        <span>{seeders}</span>
      </div>
      <div className="px-1.5 py-1 text-blue-600 dark:text-blue-400">
        <span>{leechers}</span>
      </div>
    </div>
  );
}