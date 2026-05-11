import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { cn } from "@/lib/utils";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { CategoryMetadataSource } from "@/types/category";

type ImageSource = "Upload" | "TMDB" | "TGDB";

interface ImageSourceSelectorProps {
  value: ImageSource;
  onValueChange: (value: ImageSource) => void;
  className?: string;
  isTGDBActive?: boolean;
  categoryMetadataSource?: CategoryMetadataSource;
}

export function ImageSourceSelector({
  value,
  onValueChange,
  className,
  isTGDBActive = false,
  categoryMetadataSource = "none",
}: ImageSourceSelectorProps) {
  const { t } = useTranslation();
  const sources = useMemo<ImageSource[]>(() => {
    if (categoryMetadataSource === "tgdb") {
      return ["TGDB"];
    }

    if (categoryMetadataSource === "tmdb") {
      return ["TMDB"];
    }

    return ["Upload"];
  }, [categoryMetadataSource]);

  const isSourceDisabled = (source: ImageSource): boolean => {
    if (source === "Upload") {
      return false;
    }

    if (categoryMetadataSource === "none") {
      return true;
    }

    if (categoryMetadataSource === "tgdb") {
      return source !== "TGDB" || !isTGDBActive;
    }

    if (categoryMetadataSource === "tmdb") {
      return source !== "TMDB";
    }

    return true;
  };

  return (
    <ButtonGroup orientation="horizontal" className={cn("w-full", className)}>
      {sources.map((source) => (
        <Button
          key={source}
          variant={value === source ? "default" : "outline"}
          size="sm"
          onClick={() => onValueChange(source)}
          disabled={isSourceDisabled(source)}
          className={cn(
            "transition-all flex-1",
            value === source && "shadow-sm"
          )}
        >
          <span className="flex flex-col items-center text-center leading-tight">
            <span>{t(`torrentImageEditor.sources.options.${source.toLowerCase()}`)}</span>
            {source === "TGDB" && (
              <span className="text-[11px] font-normal text-muted-foreground">
                {t("torrentImageEditor.sources.subtitles.tgdb")}
              </span>
            )}
          </span>
        </Button>
      ))}
    </ButtonGroup>
  );
}
