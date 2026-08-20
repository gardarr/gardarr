import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Wand2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { TagBadge } from "@/components/ui/TagBadge";
import { parseTag, deriveTags, type DeriveMode } from "@/utils/tagRules";

interface DeriveTagsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source: string;
  onSubmit: (source: string, delimiter: string, values: string[], mode: DeriveMode) => Promise<void>;
}

export function DeriveTagsModal({ open, onOpenChange, source, onSubmit }: DeriveTagsModalProps) {
  const { t } = useTranslation();
  const [delimiter, setDelimiter] = useState("");
  const [mode, setMode] = useState<DeriveMode>("prefix");
  const [values, setValues] = useState<string[]>([]);
  const [valueInput, setValueInput] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setDelimiter("");
      setMode("prefix");
      setValues([]);
      setValueInput("");
    }
  }, [open]);

  const parsedSource = useMemo(() => parseTag(source), [source]);
  const isComposed = parsedSource.kind !== "plain";
  const effectiveDelimiter = isComposed ? "" : delimiter;
  const isSuffixMode = mode === "suffix";

  const preview = useMemo(() => {
    try {
      return deriveTags(source, effectiveDelimiter, values, mode);
    } catch {
      return [];
    }
  }, [source, effectiveDelimiter, values, mode]);

  const addValue = () => {
    const trimmed = valueInput.trim();
    if (trimmed && !values.includes(trimmed)) {
      setValues([...values, trimmed]);
    }
    setValueInput("");
  };

  const removeValue = (index: number) => {
    setValues(values.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (values.length === 0) {
      toast.error(isSuffixMode ? t('tags.errors.suffixesRequired') : t('tags.errors.prefixesRequired'));
      return;
    }
    if (!isComposed && !delimiter.trim()) {
      toast.error(t('tags.errors.delimiterRequired'));
      return;
    }
    if (preview.length === 0) {
      toast.error(t('tags.errors.deriveInvalid'));
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(source, effectiveDelimiter, values, mode);
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
            <Wand2 className="h-5 w-5" />
            {t('tags.deriveTitle')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-sm">{t('tags.fields.source')}</Label>
            <div className="flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2">
              <TagBadge tag={source} size="sm" />
            </div>
          </div>

          {isComposed ? (
            <p className="text-xs text-muted-foreground">
              {t(isSuffixMode ? 'tags.deriveComposedHintSuffix' : 'tags.deriveComposedHint', {
                separator: parsedSource.kind === "scoped" ? "::" : ":",
              })}
            </p>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="derive-delimiter" className="text-sm">{t('tags.fields.delimiter')}</Label>
              <Input
                id="derive-delimiter"
                placeholder={t('tags.placeholders.delimiter')}
                value={delimiter}
                onChange={(e) => setDelimiter(e.target.value)}
                className="h-9"
              />
              <p className="text-xs text-muted-foreground">{t('tags.derivePlainHint')}</p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-sm">{t('tags.fields.mode')}</Label>
            <div className="flex items-center gap-2">
              <span className={`text-xs ${!isSuffixMode ? "font-medium" : "text-muted-foreground"}`}>
                {t('tags.deriveModePrefix')}
              </span>
              <Switch
                id="derive-mode"
                checked={isSuffixMode}
                onCheckedChange={(checked) => setMode(checked ? "suffix" : "prefix")}
              />
              <span className={`text-xs ${isSuffixMode ? "font-medium" : "text-muted-foreground"}`}>
                {t('tags.deriveModeSuffix')}
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">{t(isSuffixMode ? 'tags.fields.suffixes' : 'tags.fields.prefixes')}</Label>
            <div
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[40px] flex-wrap gap-1 items-center cursor-text"
              onClick={() => document.getElementById('derive-value-input')?.focus()}
            >
              {values.map((value, index) => (
                <span
                  key={value}
                  className="inline-flex items-center gap-1 text-xs bg-muted px-2 py-0.5 rounded-full"
                >
                  {value}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeValue(index);
                    }}
                    className="hover:text-destructive transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <input
                id="derive-value-input"
                type="text"
                placeholder={values.length === 0 ? t(isSuffixMode ? 'tags.placeholders.suffixes' : 'tags.placeholders.prefixes') : ""}
                value={valueInput}
                onChange={(e) => setValueInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addValue();
                  } else if (e.key === "Backspace" && valueInput === "" && values.length > 0) {
                    e.preventDefault();
                    removeValue(values.length - 1);
                  }
                }}
                className="flex-1 min-w-[120px] bg-transparent border-none outline-none text-sm"
              />
            </div>
          </div>

          {preview.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-sm">{t('tags.derivePreview')}</Label>
              <div className="flex flex-wrap gap-1.5">
                {preview.map((name) => (
                  <TagBadge key={name} tag={name} size="sm" />
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="pt-4 border-t">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {t('tags.derive')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
