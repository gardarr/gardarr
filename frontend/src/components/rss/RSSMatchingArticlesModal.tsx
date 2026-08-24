import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, FileSearch } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { RSSMatchingArticles } from "@/types/rss";

interface RSSMatchingArticlesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ruleName: string;
  loading: boolean;
  matches: RSSMatchingArticles | null;
}

export function RSSMatchingArticlesModal({ open, onOpenChange, ruleName, loading, matches }: RSSMatchingArticlesModalProps) {
  const { t } = useTranslation();
  const feedNames = matches ? Object.keys(matches) : [];
  const totalMatches = feedNames.reduce((sum, feed) => sum + (matches?.[feed]?.length || 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("rss.matchingArticlesTitle", { name: ruleName })}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : totalMatches === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <FileSearch className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">{t("rss.noMatchingArticles")}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {feedNames.map((feed) => {
              const articles = matches?.[feed] || [];
              if (articles.length === 0) return null;
              return (
                <div key={feed} className="space-y-1">
                  <p className="text-sm font-medium truncate">{feed}</p>
                  <ul className="space-y-1">
                    {articles.map((title) => (
                      <li key={title} className="text-xs text-muted-foreground bg-muted rounded px-2 py-1 truncate">
                        {title}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.close")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
