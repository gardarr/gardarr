import { useEffect, useState } from "react";
import { Edit, Layers, Tags } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { TagBadge } from "@/components/ui/TagBadge";
import { SelectCategory } from "@/components/SelectCategory";
import { SelectTags } from "@/components/SelectTags";
import { torrentService } from "@/services/torrents";
import { categoryService } from "@/services/categories";
import { getCategoryIcon, getCategoryColor } from "@/utils/categoryUtils";
import type { Task, TaskMetadata } from "@/types/torrent";
import type { Category } from "@/types/category";
import { DetailCard } from "./DetailCard";

interface CategoryTagsCardProps {
  torrent: Task;
  onUpdate?: (metadata?: TaskMetadata) => Promise<void> | void;
  onCategoryDataChange?: (category: Category | null) => void;
}

export function CategoryTagsCard({ torrent, onUpdate, onCategoryDataChange }: CategoryTagsCardProps) {
  const { t } = useTranslation();
  const [isEditingCategory, setIsEditingCategory] = useState(false);
  const [isEditingTags, setIsEditingTags] = useState(false);
  const [editedCategoryId, setEditedCategoryId] = useState("");
  const [editedCategoryName, setEditedCategoryName] = useState("");
  const [draftCategoryData, setDraftCategoryData] = useState<Category | null>(null);
  const [editedTags, setEditedTags] = useState<string[]>([]);
  const [currentCategory, setCurrentCategory] = useState("");
  const [currentCategoryData, setCurrentCategoryData] = useState<Category | null>(null);
  const [currentTags, setCurrentTags] = useState<string[]>([]);

  useEffect(() => {
    setCurrentCategory(torrent.category || "");
    setCurrentTags([...(torrent.tags || [])]);
  }, [torrent]);

  useEffect(() => {
    let isCurrentRequest = true;

    const loadCategoryData = async () => {
      if (!torrent.category) {
        setCurrentCategoryData(null);
        onCategoryDataChange?.(null);
        return;
      }

      const requestCategory = torrent.category;

      try {
        const response = await categoryService.listCategories();
        if (!isCurrentRequest) return;

        const matchedCategory = response.data?.find((item) => item.name === requestCategory) ?? null;
        setCurrentCategoryData(matchedCategory);
        onCategoryDataChange?.(matchedCategory);
      } catch {
        if (!isCurrentRequest) return;
        setCurrentCategoryData(null);
        onCategoryDataChange?.(null);
      }
    };

    void loadCategoryData();

    return () => {
      isCurrentRequest = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [torrent.category]);

  const refreshAfterMutation = async () => {
    if (onUpdate) {
      await onUpdate();
    }
  };

  const handleEditCategory = async () => {
    if (isEditingCategory) {
      if (torrent.worker?.uuid) {
        try {
          const response = await torrentService.updateTaskCategory(torrent.worker.uuid, torrent.id, editedCategoryName.trim());
          if (response.error) {
            toast.error(response.error);
            return;
          }

          await refreshAfterMutation();
          setCurrentCategory(editedCategoryName.trim());
          setCurrentCategoryData(draftCategoryData);
          onCategoryDataChange?.(draftCategoryData);
          toast.success(t("torrentDetails.toasts.categoryUpdateSuccess", { defaultValue: "Categoria atualizada com sucesso" }));
          setIsEditingCategory(false);
        } catch (error) {
          console.error("Failed to update category:", error);
          toast.error(t("torrentDetails.toasts.categoryUpdateError", { defaultValue: "Falha ao atualizar categoria" }));
        }
      }
    } else {
      setEditedCategoryId(currentCategoryData?.id || "");
      setEditedCategoryName(currentCategory);
      setDraftCategoryData(currentCategoryData);
      setIsEditingCategory(true);
    }
  };

  const handleCancelEditCategory = () => {
    setEditedCategoryId(currentCategoryData?.id || "");
    setEditedCategoryName(currentCategory);
    setDraftCategoryData(currentCategoryData);
    setIsEditingCategory(false);
  };

  const handleCategoryChange = (categoryId: string, category?: Category) => {
    setEditedCategoryId(categoryId);
    setEditedCategoryName(category?.name || "");
    setDraftCategoryData(category ?? null);
  };

  const handleEditTags = async () => {
    if (isEditingTags) {
      if (torrent.worker?.uuid) {
        try {
          await torrentService.updateTaskTags(torrent.worker.uuid, torrent.id, editedTags);
          await refreshAfterMutation();
          setCurrentTags([...editedTags]);
          toast.success(t("torrentDetails.toasts.tagsUpdateSuccess", { defaultValue: "Tags atualizadas com sucesso" }));
          setIsEditingTags(false);
        } catch (error) {
          console.error("Failed to update tags:", error);
          toast.error(t("torrentDetails.toasts.tagsUpdateError", { defaultValue: "Falha ao atualizar tags" }));
        }
      }
    } else {
      setEditedTags([...currentTags]);
      setIsEditingTags(true);
    }
  };

  const handleCancelEditTags = () => {
    setEditedTags([...currentTags]);
    setIsEditingTags(false);
  };

  const editButton = (label: string, onClick: () => void) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="default"
          size="sm"
          className="h-8 w-8 p-0 flex-shrink-0"
          aria-label={label}
          onClick={onClick}
        >
          <Edit className="h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );

  return (
    <DetailCard
      icon={Layers}
      title={t("torrentDetails.category.title", { defaultValue: "Categoria" })}
      action={!isEditingCategory ? editButton(t("torrentDetails.category.edit", { defaultValue: "Editar categoria" }), handleEditCategory) : undefined}
    >
      <div className="space-y-2">
        {isEditingCategory ? (
          <div className="space-y-2">
            <SelectCategory
              selectedCategoryId={editedCategoryId}
              onCategoryChange={handleCategoryChange}
              label=""
              required={false}
              showAddButton={false}
              className="mb-2"
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={handleCancelEditCategory} className="h-8 px-3">
                {t("torrentDetails.category.cancel", { defaultValue: "Cancelar" })}
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleEditCategory}
                className="h-8 px-3"
                aria-label={t("torrentDetails.category.save", { defaultValue: "Salvar" })}
              >
                {t("torrentDetails.category.save", { defaultValue: "Salvar" })}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex justify-between items-center">
            <span className="text-sm">{t("torrentDetails.category.title", { defaultValue: "Categoria" })}:</span>
            <div className="flex items-center gap-2">
              {currentCategoryData ? (
                <>
                  {(() => {
                    const IconComponent = getCategoryIcon(currentCategoryData.icon);
                    const color = getCategoryColor(currentCategoryData.color);
                    return <IconComponent className="h-4 w-4" style={{ color }} />;
                  })()}
                  <span className="text-sm text-muted-foreground">{currentCategoryData.name}</span>
                </>
              ) : (
                <span className="text-sm text-muted-foreground">{currentCategory || "N/A"}</span>
              )}
            </div>
          </div>
        )}
      </div>

      <Separator className="my-3" />

      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Tags className="h-4 w-4 text-muted-foreground" />
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("torrentDetails.tags.title", { defaultValue: "Tags" })}</h4>
        </div>
        {!isEditingTags && editButton(t("torrentDetails.tags.edit", { defaultValue: "Editar tags" }), handleEditTags)}
      </div>
      <div className="space-y-2">
        {isEditingTags ? (
          <div className="space-y-2">
            <SelectTags
              tags={editedTags}
              onTagsChange={setEditedTags}
              label=""
              required={false}
              placeholder={t("torrentDetails.tags.placeholder", { defaultValue: "Digite tags e pressione Enter" })}
              className="mb-2"
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={handleCancelEditTags} className="h-8 px-3">
                {t("torrentDetails.tags.cancel", { defaultValue: "Cancelar" })}
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleEditTags}
                className="h-8 px-3"
                aria-label={t("torrentDetails.tags.save", { defaultValue: "Salvar" })}
              >
                {t("torrentDetails.tags.save", { defaultValue: "Salvar" })}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-1">
            {currentTags && currentTags.length > 0 ? (
              currentTags.map((tag, index) => <TagBadge key={index} tag={tag} size="sm" />)
            ) : (
              <span className="text-xs text-muted-foreground">{t("torrentDetails.tags.empty", { defaultValue: "Sem tags" })}</span>
            )}
          </div>
        )}
      </div>
    </DetailCard>
  );
}
