import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useTranslation } from "react-i18next";

interface TGDBSearchProps {
  taskHash: string;
  initialQuery: string;
  onSelect: (metadata: any) => void;
  onCancel: () => void;
}

export function TGDBSearch({ taskHash, initialQuery, onSelect, onCancel }: TGDBSearchProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState(initialQuery);
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [isApplying, setIsApplying] = useState(false);

  const handleSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const response = await api.get<any>(`/tasks/metadata/${taskHash}/providers/tgdb/search?q=${encodeURIComponent(searchQuery)}`);
      setResults(response.data || []);
    } catch (error) {
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

  const handleApply = async (game: any) => {
    setIsApplying(true);
    try {
      const response = await api.post(`/tasks/metadata/${taskHash}/providers/tgdb`, {
        name: game.title,
        release_date: game.release_date,
        description: game.description,
        image_url: game.image_url
      });
      toast.success(t("tgdb.success.applied"));
      onSelect(response.data);
    } catch (error) {
      toast.error(t("tgdb.errors.applyFailed"));
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input 
          value={query} 
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("tgdb.search.placeholder")}
          onKeyDown={(e) => e.key === "Enter" && handleSearch(query)}
        />
        <Button onClick={() => handleSearch(query)} disabled={isSearching || isApplying}>
          {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
        </Button>
      </div>
      
      <div className="grid grid-cols-2 gap-4 max-h-96 overflow-y-auto p-2">
        {results.map((game) => (
          <div 
            key={game.id} 
            className="border rounded-lg overflow-hidden flex flex-col hover:border-primary cursor-pointer transition-colors"
            onClick={() => handleApply(game)}
          >
            {game.image_url ? (
              <img src={game.image_url} alt={game.title} className="w-full h-48 object-cover" />
            ) : (
              <div className="w-full h-48 bg-muted flex items-center justify-center text-muted-foreground text-xs">
                {t("tgdb.search.noImage")}
              </div>
            )}
            <div className="p-2 bg-card">
              <h4 className="font-medium text-sm truncate" title={game.title}>{game.title}</h4>
              <p className="text-xs text-muted-foreground">{game.release_date || t("tgdb.search.unknownDate")}</p>
            </div>
          </div>
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
