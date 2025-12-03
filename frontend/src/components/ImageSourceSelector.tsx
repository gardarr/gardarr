import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { cn } from "@/lib/utils";

type ImageSource = "Upload" | "TMDB" | "TGDB";

interface ImageSourceSelectorProps {
  value: ImageSource;
  onValueChange: (value: ImageSource) => void;
  className?: string;
}

export function ImageSourceSelector({
  value,
  onValueChange,
  className,
}: ImageSourceSelectorProps) {
  const sources: ImageSource[] = ["Upload", "TMDB", "TGDB"];

  return (
    <ButtonGroup orientation="horizontal" className={cn("w-full", className)}>
      {sources.map((source) => (
        <Button
          key={source}
          variant={value === source ? "default" : "outline"}
          size="sm"
          onClick={() => onValueChange(source)}
          disabled={source === "TMDB" || source === "TGDB"}
          className={cn(
            "transition-all flex-1",
            value === source && "shadow-sm"
          )}
        >
          {source}
        </Button>
      ))}
    </ButtonGroup>
  );
}

