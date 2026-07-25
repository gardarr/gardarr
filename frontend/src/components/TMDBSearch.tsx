import type { TaskMetadata } from "@/types/torrent";
import { ProviderSearch } from "@/components/ProviderSearch";

interface TMDBSearchProps {
  taskHash: string;
  initialQuery: string;
  onSelect: (metadata: TaskMetadata) => void;
  onCancel: () => void;
}

export function TMDBSearch(props: TMDBSearchProps) {
  return <ProviderSearch provider="tmdb" {...props} />;
}
