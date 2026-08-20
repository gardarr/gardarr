import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import type { CategoryMetadataSource } from "@/types/category";

type ImageSource = "Upload" | "TMDB" | "TGDB";
type ProviderMetadataSource = Exclude<CategoryMetadataSource, "none">;

interface ImageSourceSelectorProps {
  value: ImageSource;
  onValueChange: (value: ImageSource) => void;
  className?: string;
  isTGDBActive?: boolean;
  isTMDBActive?: boolean;
  categoryMetadataSource?: CategoryMetadataSource;
}

export function ImageSourceSelector({
  value,
  onValueChange,
  className,
  isTGDBActive = false,
  isTMDBActive = false,
  categoryMetadataSource = "none",
}: ImageSourceSelectorProps) {
  const { t } = useTranslation();

  // One entry per provider-backed source; adding a provider means adding a
  // row here instead of another branch in every place that consumes it.
  const providerSources: Record<ProviderMetadataSource, { source: ImageSource; isActive: boolean }> = {
    tgdb: { source: "TGDB", isActive: isTGDBActive },
    tmdb: { source: "TMDB", isActive: isTMDBActive },
  };

  // Upload is always first; the category provider, when available, comes after it.
  const providerEntry = categoryMetadataSource !== "none" ? providerSources[categoryMetadataSource] : undefined;
  const sources: ImageSource[] = providerEntry ? ["Upload", providerEntry.source] : ["Upload"];

  const isSourceDisabled = (source: ImageSource): boolean => {
    if (source === "Upload") {
      return false;
    }
    return providerEntry ? !providerEntry.isActive : false;
  };

  // Sem image source de categoria: só Upload existe, não exibir abas.
  if (sources.length <= 1) {
    return null;
  }

  return (
    <Tabs
      value={value}
      onValueChange={(v) => onValueChange(v as ImageSource)}
      className={cn("w-full", className)}
    >
      <TabsList className="w-full h-auto">
        {sources.map((source) => (
          <TabsTrigger
            key={source}
            value={source}
            disabled={isSourceDisabled(source)}
            className="flex-1 py-2"
          >
            <span className="flex flex-col items-center text-center leading-tight">
              <span>{t(`torrentImageEditor.sources.options.${source.toLowerCase()}`)}</span>
              {source === "TGDB" && (
                <span className="text-[11px] font-normal text-muted-foreground">
                  {t("torrentImageEditor.sources.subtitles.tgdb")}
                </span>
              )}
              {source === "TMDB" && (
                <span className="text-[11px] font-normal text-muted-foreground">
                  {t("torrentImageEditor.sources.subtitles.tmdb")}
                </span>
              )}
            </span>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
