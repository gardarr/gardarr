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
import { Check, Tag as TagIcon } from "lucide-react";
import { useState, useEffect } from "react";
import type { Tag, CreateTagRequest, UpdateTagRequest } from "../types/tag";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { availableColors } from "../utils/categoryUtils";

interface AddTagModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTagCreated: (tag: CreateTagRequest) => Promise<Tag | undefined> | void;
  editingTag?: Tag | null;
  onTagUpdated?: (tagId: string, updateData: UpdateTagRequest) => Promise<void>;
}

const DEFAULT_COLOR = "#3b82f6";

export function AddTagModal({ open, onOpenChange, onTagCreated, editingTag, onTagUpdated }: AddTagModalProps) {
  const { t } = useTranslation();
  const [form, setForm] = useState<CreateTagRequest>({ name: "", color: DEFAULT_COLOR });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      if (editingTag) {
        setForm({ name: editingTag.name, color: editingTag.color || DEFAULT_COLOR });
      } else {
        setForm({ name: "", color: DEFAULT_COLOR });
      }
    }
  }, [open, editingTag]);

  const handleSubmit = async () => {
    if (!editingTag && !form.name.trim()) {
      toast.error(t('tags.errors.nameRequired'));
      return;
    }

    setSubmitting(true);
    try {
      if (editingTag && onTagUpdated) {
        await onTagUpdated(editingTag.id, { color: form.color });
      } else {
        await onTagCreated(form);
      }
      onOpenChange(false);
    } catch (err) {
      const errorMessage = err instanceof Error
        ? err.message
        : editingTag
          ? t('tags.errors.updateFailed')
          : t('tags.errors.createFailed');
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] sm:w-full max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div
              className="h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: form.color || DEFAULT_COLOR }}
            >
              <TagIcon className="h-5 w-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-2xl font-bold">
                {editingTag ? t('tags.edit') : t('tags.createNew')}
              </DialogTitle>
              {editingTag && (
                <p className="text-sm text-muted-foreground">{editingTag.name}</p>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {!editingTag && (
            <div className="space-y-1.5">
              <Label htmlFor="tag-name" className="text-sm">{t('tags.fields.name')} *</Label>
              <Input
                id="tag-name"
                placeholder={t('tags.placeholders.name')}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="h-9"
              />
              <p className="text-xs text-muted-foreground">{t('tags.createHint')}</p>
            </div>
          )}

          <div className="space-y-1">
            <Label className="text-sm">{t('tags.fields.color')}</Label>
            <div className="grid grid-cols-5 gap-0.5">
              {availableColors.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  className={`w-11 h-11 rounded-md border-2 transition-transform hover:scale-105 ${form.color === color.value ? 'border-foreground scale-105' : 'border-transparent'
                    }`}
                  style={{ backgroundColor: color.value }}
                  onClick={() => setForm({ ...form, color: color.value })}
                  title={color.name}
                />
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="pt-4 border-t">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            <Check className="h-4 w-4 mr-2" />
            {editingTag ? t('common.save') : t('tags.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
