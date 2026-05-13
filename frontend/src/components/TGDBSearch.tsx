import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useTranslation } from "react-i18next";
import type { TaskMetadata } from "@/types/torrent";

interface TGDBGameResult {
  id: string;
  title: string;
  release_date?: string;
  description?: string;
  image_url?: string;
}

type TGDBAppliedMetadata = TaskMetadata;

interface TGDBSearchProps {
  taskHash: string;
  initialQuery: string;
  onSelect: (metadata: TGDBAppliedMetadata) => void;
  onCancel: () => void;
}

export function TGDBSearch({ taskHash, initialQuery, onSelect, onCancel }: TGDBSearchProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState(initialQuery);
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<TGDBGameResult[]>([]);
  const [isApplying, setIsApplying] = useState(false);
  const [applyingGameId, setApplyingGameId] = useState<string | null>(null);

  const handleSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const response = await api.get<TGDBGameResult[]>(`/tasks/metadata/${taskHash}/providers/tgdb/search?q=${encodeURIComponent(searchQuery)}`);
      setResults(response.data || []);
    } catch {
      toast.error(t("tgdb.errors.searchFailed"));
    } finally {
      setIsSearching(false);
    }
  }, [taskHash, t]);

  useEffect(() => {
    if (initialQuery) {
      handleSearch(initialQuery);
    }
  }, [initialQuery, handleSearch]);

  const handleApply = async (game: TGDBGameResult) => {
    if (isApplying) {
      return;
    }

    setIsApplying(true);
    setApplyingGameId(game.id);
    try {
      const response = await api.post<TGDBAppliedMetadata>(`/tasks/metadata/${taskHash}/providers/tgdb`, {
        id: game.id,
        title: game.title,
        release_date: game.release_date,
        description: game.description,
        image_url: game.image_url,
      });
      if (response.error || !response.data) {
        toast.error(response.error || t("tgdb.errors.applyFailed"));
        return;
      }

      toast.success(t("tgdb.success.applied"));
      onSelect(response.data);
    } catch {
      toast.error(t("tgdb.errors.applyFailed"));
    } finally {
      setIsApplying(false);
      setApplyingGameId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input 
          value={query} 
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("tgdb.search.placeholder")}
          aria-label="Search TGDB"
          onKeyDown={(e) => e.key === "Enter" && handleSearch(query)}
        />
        <Button aria-label="Execute search" onClick={() => handleSearch(query)} disabled={isSearching || isApplying}>
          {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
        </Button>
      </div>
      
      <div className="grid grid-cols-2 gap-4 max-h-96 overflow-y-auto p-2">
        {results.map((game) => (
          <button
            type="button"
            key={game.id} 
            className="border rounded-lg overflow-hidden flex flex-col hover:border-primary cursor-pointer transition-colors disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-border text-left"
            onClick={() => handleApply(game)}
            disabled={isApplying}
            aria-busy={applyingGameId === game.id}
          >
            {game.image_url ? (
              <img src={game.image_url} alt={game.title} className="w-full h-48 object-cover" />
            ) : (
              <div className="w-full h-48 bg-muted flex items-center justify-center text-muted-foreground text-xs">
                {t("tgdb.search.noImage")}
              </div>
            )}
            <div className="p-2 bg-card">
              <div className="flex items-center justify-between gap-2">
                <h4 className="font-medium text-sm truncate" title={game.title}>{game.title}</h4>
                {applyingGameId === game.id && (
                  <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                )}
              </div>
              <p className="text-xs text-muted-foreground">{game.release_date || t("tgdb.search.unknownDate")}</p>
            </div>
          </button>
        ))}
        {results.length === 0 && !isSearching && (
          <div className="col-span-2 text-center py-8 text-muted-foreground">
            {t("tgdb.search.noResults")}
          </div>
        )}
      </div>
      
      <div className="flex justify-end pt-2">
        <Button variant="outline" onClick={onCancel}>
          {t("common.cancel", "Cancel")}
        </Button>
      </div>
    </div>
  );
}
