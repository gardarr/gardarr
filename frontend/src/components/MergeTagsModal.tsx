import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ArrowDown, Merge } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { TagBadge } from "@/components/ui/TagBadge";

interface MergeTagsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // A single source opens the dialog as a rename; adding more (or opening
  // with more than one already) turns it into a merge - mirroring how the
  // backend treats rename as a merge with one source.
  initialSources: string[];
  initialTarget?: string;
  onSubmit: (sources: string[], target: string) => Promise<void>;
}

export function MergeTagsModal({ open, onOpenChange, initialSources, initialTarget, onSubmit }: MergeTagsModalProps) {
  const { t } = useTranslation();
  const [sources, setSources] = useState<string[]>([]);
  const [sourceInput, setSourceInput] = useState("");
  const [target, setTarget] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setSources(initialSources);
      setSourceInput("");
      setTarget(initialTarget || "");
    }
  }, [open, initialSources, initialTarget]);

  const isRename = sources.length <= 1;

  const addSource = () => {
    const trimmed = sourceInput.trim();
    if (trimmed && !sources.includes(trimmed)) {
      setSources([...sources, trimmed]);
    }
    setSourceInput("");
  };

  const removeSource = (index: number) => {
    setSources(sources.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    const trimmedTarget = target.trim();

    if (sources.length === 0) {
      toast.error(t('tags.errors.sourcesRequired'));
      return;
    }
    if (!trimmedTarget) {
      toast.error(t('tags.errors.targetRequired'));
      return;
    }
    if (sources.includes(trimmedTarget)) {
      toast.error(t('tags.errors.targetInSources'));
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(sources, trimmedTarget);
      onOpenChange(false);
    } catch {
      // onSubmit already surfaces its own error toast
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] sm:w-full max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Merge className="h-5 w-5" />
            {isRename ? t('tags.renameTitle') : t('tags.mergeTitle')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-sm">{t('tags.fields.sources')}</Label>
            <div
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[40px] flex-wrap gap-1 items-center cursor-text"
              onClick={() => document.getElementById('merge-source-input')?.focus()}
            >
              {sources.map((source, index) => (
                <TagBadge
                  key={source}
                  tag={source}
                  size="sm"
                  showIcon={false}
                  showDelete={true}
                  onDelete={() => removeSource(index)}
                />
              ))}
              <input
                id="merge-source-input"
                type="text"
                placeholder={sources.length === 0 ? t('tags.placeholders.sources') : ""}
                value={sourceInput}
                onChange={(e) => setSourceInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addSource();
                  } else if (e.key === "Backspace" && sourceInput === "" && sources.length > 0) {
                    e.preventDefault();
                    removeSource(sources.length - 1);
                  }
                }}
                className="flex-1 min-w-[120px] bg-transparent border-none outline-none text-sm"
              />
            </div>
            <p className="text-xs text-muted-foreground">{t('tags.mergeSourcesHint')}</p>
          </div>

          <div className="flex items-center justify-center text-muted-foreground">
            <ArrowDown className="h-4 w-4" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="merge-target" className="text-sm">{t('tags.fields.target')}</Label>
            <Input
              id="merge-target"
              placeholder={t('tags.placeholders.target')}
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="h-9"
            />
          </div>
        </div>

        <DialogFooter className="pt-4 border-t">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {isRename ? t('tags.rename') : t('tags.merge')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
