import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Folder, 
  X,
  Check,
  Tag,
  FolderOpen,
  Film,
  Tv,
  Music,
  BookOpen,
  Gamepad2,
  FileText,
  Image,
  Video,
  Download,
  Star,
  Heart,
  Archive,
  Package,
  Disc,
  type LucideIcon
} from "lucide-react";
import { useState, useEffect } from "react";
import type { CreateCategoryRequest, UpdateCategoryRequest, Category } from "../types/category";
import { useToast } from "../hooks/useToast";
import { useTranslation } from "react-i18next";

// Available icons for categories
const availableIcons: { name: string; icon: LucideIcon }[] = [
  { name: "Folder", icon: Folder },
  { name: "FolderOpen", icon: FolderOpen },
  { name: "Film", icon: Film },
  { name: "Tv", icon: Tv },
  { name: "Music", icon: Music },
  { name: "BookOpen", icon: BookOpen },
  { name: "Gamepad2", icon: Gamepad2 },
  { name: "FileText", icon: FileText },
  { name: "Image", icon: Image },
  { name: "Video", icon: Video },
  { name: "Download", icon: Download },
  { name: "Star", icon: Star },
  { name: "Heart", icon: Heart },
  { name: "Archive", icon: Archive },
  { name: "Package", icon: Package },
  { name: "Disc", icon: Disc }
];

// Available colors for categories
const availableColors = [
  { name: "Blue", value: "#3b82f6" },
  { name: "Green", value: "#10b981" },
  { name: "Purple", value: "#8b5cf6" },
  { name: "Red", value: "#ef4444" },
  { name: "Orange", value: "#f97316" },
  { name: "Pink", value: "#ec4899" },
  { name: "Indigo", value: "#6366f1" },
  { name: "Teal", value: "#14b8a6" },
  { name: "Yellow", value: "#eab308" },
  { name: "Gray", value: "#6b7280" }
];

interface AddCategoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCategoryCreated: (category: any) => void;
  editingCategory?: Category | null;
  onCategoryUpdated?: (categoryId: string, updateData: UpdateCategoryRequest) => Promise<void>;
}

export function AddCategoryModal({ open, onOpenChange, onCategoryCreated, editingCategory, onCategoryUpdated }: AddCategoryModalProps) {
  const { t } = useTranslation();
  const [createForm, setCreateForm] = useState<CreateCategoryRequest>({
    name: "",
    default_tags: [],
    directory: "",
    color: "#3b82f6",
    icon: "Folder"
  });
  const [tagInput, setTagInput] = useState("");
  
  const { showError } = useToast();

  // Initialize form when modal opens
  useEffect(() => {
    if (open) {
      if (editingCategory) {
        // Editing mode - populate with existing data
        setCreateForm({
          name: editingCategory.name,
          default_tags: [...(editingCategory.default_tags || [])],
          directory: editingCategory.directory || "",
          color: editingCategory.color || "#3b82f6",
          icon: editingCategory.icon || "Folder"
        });
      } else {
        // Create mode - reset to defaults
        setCreateForm({
          name: "",
          default_tags: [],
          directory: "",
          color: "#3b82f6",
          icon: "Folder"
        });
      }
      setTagInput("");
    }
  }, [open, editingCategory]);

  const handleSubmit = async () => {
    if (!createForm.name) {
      showError(t('categories.errors.nameRequired'));
      return;
    }

    try {
      if (editingCategory && onCategoryUpdated) {
        // Update existing category
        const updateData: UpdateCategoryRequest = {
          default_tags: createForm.default_tags,
          directory: createForm.directory,
          color: createForm.color,
          icon: createForm.icon
        };
        await onCategoryUpdated(editingCategory.id, updateData);
      } else {
        // Create new category
        await onCategoryCreated(createForm);
      }
      
      // Reset form
      setCreateForm({
        name: "",
        default_tags: [],
        directory: "",
        color: "#3b82f6",
        icon: "Folder"
      });
      setTagInput("");
      onOpenChange(false);
    } catch (err) {
      showError(err instanceof Error ? err.message : (editingCategory ? t('categories.errors.updateFailed') : t('categories.errors.createFailed')));
    }
  };

  const addTag = () => {
    if (tagInput.trim()) {
      setCreateForm({
        ...createForm,
        default_tags: [...(createForm.default_tags || []), tagInput.trim()]
      });
      setTagInput("");
    }
  };

  const removeTag = (index: number) => {
    setCreateForm({
      ...createForm,
      default_tags: createForm.default_tags?.filter((_, i) => i !== index) || []
    });
  };

  const handleDirectoryChange = (value: string) => {
    setCreateForm({
      ...createForm,
      directory: value
    });
  };

  const handleClose = () => {
    // Reset form when closing
    setCreateForm({
      name: "",
      default_tags: [],
      directory: "",
      color: "#3b82f6",
      icon: "Folder"
    });
    setTagInput("");
    onOpenChange(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />
      
      {/* Modal */}
      <div className="relative bg-card border rounded-lg shadow-lg w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <div 
              className="h-10 w-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: createForm.color || "#3b82f6" }}
            >
              {(() => {
                const iconName = createForm.icon || "Folder";
                const IconComponent = availableIcons.find(i => i.name === iconName)?.icon || Folder;
                return <IconComponent className="h-6 w-6 text-white" />;
              })()}
            </div>
            <h2 className="text-2xl font-bold">
              {editingCategory ? t('categories.edit') : t('categories.createNew')}
            </h2>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Form Content */}
        <div className="p-6 space-y-6">
          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-sm">{t('categories.fields.name')} *</Label>
            <Input
              id="name"
              placeholder={t('categories.placeholders.name')}
              value={createForm.name}
              onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
              disabled={!!editingCategory}
              className="h-9"
            />
            {editingCategory && (
              <p className="text-xs text-muted-foreground">{t('categories.immutableName')}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tags" className="text-sm">{t('categories.fields.defaultTags')}</Label>
            <div 
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 min-h-[40px] flex-wrap gap-1 items-center"
              onClick={() => document.getElementById('tagInput')?.focus()}
            >
              {createForm.default_tags && createForm.default_tags.map((tag, index) => (
                <div
                  key={index}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary border border-primary/20 rounded-md text-sm"
                >
                  <Tag className="h-3 w-3" />
                  <span>{tag}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeTag(index);
                    }}
                    className="ml-1 hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              <input
                id="tagInput"
                type="text"
                placeholder={createForm.default_tags?.length === 0 ? "Digite uma tag e pressione Enter" : ""}
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTag();
                  } else if (e.key === "Backspace" && tagInput === "" && createForm.default_tags && createForm.default_tags.length > 0) {
                    e.preventDefault();
                    removeTag(createForm.default_tags.length - 1);
                  }
                }}
                className="flex-1 min-w-[120px] bg-transparent border-none outline-none text-sm"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="directory" className="text-sm">{t('categories.fields.directory')}</Label>
            <Input
              id="directory"
              placeholder={t('categories.placeholders.directory')}
              value={createForm.directory}
              onChange={(e) => handleDirectoryChange(e.target.value)}
              className="h-9"
            />
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="icon" className="text-sm">{t('categories.fields.icon')}</Label>
              <div className="grid grid-cols-5 gap-2">
                {availableIcons.map((iconItem) => {
                  const IconComponent = iconItem.icon;
                  return (
                    <button
                      key={iconItem.name}
                      type="button"
                      className={`w-10 h-10 rounded-md border-2 flex items-center justify-center transition-all hover:scale-110 ${
                        createForm.icon === iconItem.name ? 'border-foreground bg-accent scale-110' : 'border-border hover:bg-accent/50'
                      }`}
                      onClick={() => setCreateForm({ ...createForm, icon: iconItem.name })}
                      title={iconItem.name}
                    >
                      <IconComponent className="h-5 w-5" />
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="color" className="text-sm">{t('categories.fields.color')}</Label>
              <div className="grid grid-cols-5 gap-2">
                {availableColors.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${
                      createForm.color === color.value ? 'border-foreground scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color.value }}
                    onClick={() => setCreateForm({ ...createForm, color: color.value })}
                    title={color.name}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex gap-3 justify-end pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
            >
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSubmit}>
              <Check className="h-4 w-4 mr-2" />
              {editingCategory ? t('common.save') : t('categories.create')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}