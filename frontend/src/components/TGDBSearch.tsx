import type { TaskMetadata } from "@/types/torrent";
import { ProviderSearch } from "@/components/ProviderSearch";

interface TGDBSearchProps {
  taskHash: string;
  initialQuery: string;
  onSelect: (metadata: TaskMetadata) => void;
  onCancel: () => void;
}

export function TGDBSearch(props: TGDBSearchProps) {
  return <ProviderSearch provider="tgdb" {...props} />;
}
