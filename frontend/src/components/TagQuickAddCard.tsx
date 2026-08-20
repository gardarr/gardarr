import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Tag as TagIcon } from "lucide-react";
import { useState } from "react";
import type { CreateTagRequest, Tag } from "../types/tag";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { availableColors } from "../utils/categoryUtils";

const DEFAULT_COLOR = "#3b82f6";

interface TagQuickAddCardProps {
  onCreate: (tag: CreateTagRequest) => Promise<Tag | undefined> | void;
}

export function TagQuickAddCard({ onCreate }: TagQuickAddCardProps) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error(t('tags.errors.nameRequired'));
      return;
    }

    setSubmitting(true);
    try {
      await onCreate({ name: name.trim(), color });
      setName("");
      setColor(DEFAULT_COLOR);
    } catch {
      // Errors are already surfaced by the caller.
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <TagIcon className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">{t('tags.createNew')}</h3>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="quick-add-tag-name" className="text-sm">{t('tags.fields.name')} *</Label>
          <Input
            id="quick-add-tag-name"
            placeholder={t('tags.placeholders.name')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSubmit();
            }}
            className="h-9"
          />
        </div>

        <div className="space-y-1">
          <Label className="text-sm">{t('tags.fields.color')}</Label>
          <div className="grid grid-cols-5 gap-0.5">
            {availableColors.map((c) => (
              <button
                key={c.value}
                type="button"
                className={`w-full aspect-square rounded-md border-2 transition-transform hover:scale-105 ${color === c.value ? 'border-foreground scale-105' : 'border-transparent'
                  }`}
                style={{ backgroundColor: c.value }}
                onClick={() => setColor(c.value)}
                title={c.name}
              />
            ))}
          </div>
        </div>

        <Button onClick={handleSubmit} disabled={submitting} className="w-full" size="sm">
          <Plus className="h-4 w-4 mr-2" />
          {t('tags.create')}
        </Button>
      </CardContent>
    </Card>
  );
}
