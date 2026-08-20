import { useEffect, useRef, useState } from "react";
import { AlertCircle, Check, Folder, Layers, Loader2, Tags } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { SelectCategory } from "@/components/SelectCategory";
import { SelectTags } from "@/components/SelectTags";
import { torrentService } from "@/services/torrents";
import { categoryService } from "@/services/categories";
import type { Task } from "@/types/torrent";
import type { Category } from "@/types/category";
import { DetailCard } from "./DetailCard";

interface CategoryTagsCardProps {
  torrent: Task;
  onCategoryDataChange?: (category: Category | null) => void;
  onCategoryTagsUpdate?: (torrentId: string, patch: { category?: string; tags?: string[] }) => void;
}

type SaveState = "idle" | "saving" | "saved" | "error";

const normalizeTags = (values: string[] = []) => values
  .map((tag) => tag.trim())
  .filter((tag) => tag.length > 0);

export function CategoryTagsCard({ torrent, onCategoryDataChange, onCategoryTagsUpdate }: CategoryTagsCardProps) {
  const { t } = useTranslation();
  const [categoryId, setCategoryId] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [state, setState] = useState<SaveState>("idle");
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const categoryOperation = useRef(0);
  const tagsOperation = useRef(0);
  const currentCategory = useRef<Category | null>(null);

  useEffect(() => {
    setTags(normalizeTags(torrent.tags));
  }, [torrent]);

  // Resolve the current category to its full data (icon/color) and seed the select.
  useEffect(() => {
    let alive = true;

    const load = async () => {
      if (!torrent.category) {
        if (!alive) return;
        setCategoryId("");
        onCategoryDataChange?.(null);
        return;
      }
      try {
        const response = await categoryService.listCategories();
        if (!alive) return;
        const matched =
          response.data?.find(
            (item) => item.name.localeCompare(torrent.category!, undefined, { sensitivity: "base" }) === 0,
          ) ?? null;
        setCategoryId(matched?.id ?? "");
        currentCategory.current = matched;
        onCategoryDataChange?.(matched);
      } catch {
        if (!alive) return;
        setCategoryId("");
        currentCategory.current = null;
        onCategoryDataChange?.(null);
      }
    };

    void load();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [torrent.category]);

  useEffect(() => () => {
    if (savedTimer.current) clearTimeout(savedTimer.current);
  }, []);

  const flashSaved = () => {
    setState("saved");
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setState("idle"), 1600);
  };

  const handleCategoryChange = async (id: string, category?: Category) => {
    if (!torrent.worker?.uuid) return;
    const name = category?.name ?? "";
    const operation = ++categoryOperation.current;
    const previousCategoryID = categoryId;
    const previousCategory = currentCategory.current;

    // Optimistic UI
    setCategoryId(id);
    currentCategory.current = category ?? null;
    onCategoryDataChange?.(category ?? null);
    setState("saving");

    try {
      const response = await torrentService.updateTaskCategory(torrent.worker.uuid, torrent.id, name.trim());
      if (operation !== categoryOperation.current) return;
      if (response.error) {
        setCategoryId(previousCategoryID);
        currentCategory.current = previousCategory;
        onCategoryDataChange?.(previousCategory);
        setState("error");
        toast.error(response.error);
        return;
      }
      onCategoryTagsUpdate?.(torrent.id, { category: name.trim() });
      flashSaved();
    } catch {
      if (operation !== categoryOperation.current) return;
      setCategoryId(previousCategoryID);
      currentCategory.current = previousCategory;
      onCategoryDataChange?.(previousCategory);
      setState("error");
      toast.error(t("torrentDetails.toasts.categoryUpdateError", { defaultValue: "Falha ao atualizar categoria" }));
    }
  };

  const handleTagsChange = async (next: string[]) => {
    const operation = ++tagsOperation.current;
    const previousTags = [...tags];
    const previousParentTags = [...(torrent.tags ?? [])];
    const normalizedTags = normalizeTags(next);
    setTags(normalizedTags); // optimistic
    if (!torrent.worker?.uuid) return;
    setState("saving");
    try {
      await torrentService.updateTaskTags(torrent.worker.uuid, torrent.id, normalizedTags);
      if (operation !== tagsOperation.current) return;
      onCategoryTagsUpdate?.(torrent.id, { tags: normalizedTags });
      flashSaved();
    } catch {
      if (operation !== tagsOperation.current) return;
      setTags(previousTags);
      onCategoryTagsUpdate?.(torrent.id, { tags: previousParentTags });
      setState("error");
      toast.error(t("torrentDetails.toasts.tagsUpdateError", { defaultValue: "Falha ao atualizar tags" }));
    }
  };

  const statusIndicator = (
    <span className="flex h-5 items-center gap-1.5 text-xs text-muted-foreground">
      {state === "saving" && (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {t("torrentDetails.autosave.saving", { defaultValue: "Salvando…" })}
        </>
      )}
      {state === "saved" && (
        <>
          <Check className="h-3.5 w-3.5 text-green-600" />
          {t("torrentDetails.autosave.saved", { defaultValue: "Salvo" })}
        </>
      )}
      {state === "error" && (
        <>
          <AlertCircle className="h-3.5 w-3.5 text-destructive" />
          {t("torrentDetails.autosave.error", { defaultValue: "Erro" })}
        </>
      )}
    </span>
  );

  return (
    <DetailCard
      icon={Layers}
      title={t("torrentDetails.editSection.title", { defaultValue: "Detalhes" })}
      action={statusIndicator}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
        <div className="space-y-1.5">
          <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Folder className="h-3.5 w-3.5" />
            {t("torrentDetails.category.title", { defaultValue: "Categoria" })}
          </span>
          <SelectCategory
            selectedCategoryId={categoryId}
            onCategoryChange={handleCategoryChange}
            label=""
            required={false}
            showAddButton={false}
            dense
            className="!space-y-0"
          />
        </div>

        <div className="space-y-1.5">
          <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Tags className="h-3.5 w-3.5" />
            {t("torrentDetails.tags.title", { defaultValue: "Tags" })}
          </span>
          <SelectTags
            tags={tags}
            onTagsChange={handleTagsChange}
            label=""
            required={false}
            placeholder={t("torrentDetails.tags.placeholder", { defaultValue: "Digite tags e pressione Enter" })}
            dense
            className="!space-y-0"
          />
        </div>
      </div>
    </DetailCard>
  );
}
