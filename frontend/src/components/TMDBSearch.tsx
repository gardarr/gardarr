import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useTranslation } from "react-i18next";
import type { TaskMetadata } from "@/types/torrent";

interface TMDBResult {
  id: string;
  title: string;
  release_date?: string;
  description?: string;
  image_id?: string;
  image_url?: string;
}

type TMDBAppliedMetadata = TaskMetadata;

interface TMDBSearchProps {
  taskHash: string;
  initialQuery: string;
  onSelect: (metadata: TMDBAppliedMetadata) => void;
  onCancel: () => void;
}

export function TMDBSearch({ taskHash, initialQuery, onSelect, onCancel }: TMDBSearchProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState(initialQuery);
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<TMDBResult[]>([]);
  const [isApplying, setIsApplying] = useState(false);
  const [applyingResultId, setApplyingResultId] = useState<string | null>(null);

  const handleSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const response = await api.get<TMDBResult[]>(`/tasks/metadata/${taskHash}/providers/tmdb/search?q=${encodeURIComponent(searchQuery)}`);
      setResults(response.data || []);
    } catch {
      toast.error(t("tmdb.errors.searchFailed"));
    } finally {
      setIsSearching(false);
    }
  }, [taskHash, t]);

  const handleApply = async (result: TMDBResult) => {
    if (isApplying) {
      return;
    }

    setIsApplying(true);
    setApplyingResultId(result.id);
    try {
      const response = await api.post<TMDBAppliedMetadata>(`/tasks/metadata/${taskHash}/providers/tmdb`, {
        id: result.id,
        title: result.title,
        release_date: result.release_date,
        description: result.description,
        image_id: result.image_id,
      });
      if (response.error || !response.data) {
        toast.error(response.error || t("tmdb.errors.applyFailed"));
        return;
      }

      toast.success(t("tmdb.success.applied"));
      onSelect(response.data);
    } catch {
      toast.error(t("tmdb.errors.applyFailed"));
    } finally {
      setIsApplying(false);
      setApplyingResultId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("tmdb.search.placeholder")}
          aria-label="Search TMDB"
          onKeyDown={(e) => e.key === "Enter" && handleSearch(query)}
        />
        <Button aria-label="Execute search" onClick={() => handleSearch(query)} disabled={isSearching || isApplying}>
          {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 max-h-96 overflow-y-auto p-2">
        {results.map((result) => (
          <button
            type="button"
            key={result.id}
            className="border rounded-lg overflow-hidden flex flex-col hover:border-primary cursor-pointer transition-colors disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-border text-left"
            onClick={() => handleApply(result)}
            disabled={isApplying}
            aria-busy={applyingResultId === result.id}
          >
            {result.image_url ? (
              <img src={result.image_url} alt={result.title} className="w-full h-48 object-cover" />
            ) : (
              <div className="w-full h-48 bg-muted flex items-center justify-center text-muted-foreground text-xs">
                {t("tmdb.search.noImage")}
              </div>
            )}
            <div className="p-2 bg-card">
              <div className="flex items-center justify-between gap-2">
                <h4 className="font-medium text-sm truncate" title={result.title}>{result.title}</h4>
                {applyingResultId === result.id && (
                  <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                )}
              </div>
              <p className="text-xs text-muted-foreground">{result.release_date || t("tmdb.search.unknownDate")}</p>
            </div>
          </button>
        ))}
        {results.length === 0 && !isSearching && (
          <div className="col-span-2 text-center py-8 text-muted-foreground">
            {t("tmdb.search.noResults")}
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
