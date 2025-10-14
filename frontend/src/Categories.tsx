import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  Folder, 
  Plus, 
  Trash2, 
  Search, 
  Loader2, 
  RefreshCw,
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
import { useEffect, useState } from "react";
import { categoryService } from "./services/categories";
import type { Category, CreateCategoryRequest, UpdateCategoryRequest } from "./types/category";
import { useToast } from "./hooks/useToast";
import { ToastContainer } from "./components/ui/toast-container";
import { useTranslation } from "react-i18next";

type SortType = "name" | "created_at";

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

function Categories() {
  const { t } = useTranslation();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<SortType>("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
  const [createForm, setCreateForm] = useState<CreateCategoryRequest>({
    name: "",
    default_tags: [],
    directories: [],
    color: "#3b82f6",
    icon: "Folder"
  });
  const [editForm, setEditForm] = useState<UpdateCategoryRequest>({
    default_tags: [],
    directories: [],
    color: "",
    icon: ""
  });
  const [tagInput, setTagInput] = useState("");
  const [directoryInput, setDirectoryInput] = useState("");
  const [editTagInput, setEditTagInput] = useState("");
  const [editDirectoryInput, setEditDirectoryInput] = useState("");
  
  const { toasts, showSuccess, showError, removeToast } = useToast();

  // Load categories on component mount
  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      setLoading(true);
      const response = await categoryService.listCategories();
      
      if (response.error) {
        showError(response.error);
      } else if (response.data) {
        setCategories(response.data);
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : t('categories.errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const confirmDeleteCategory = (category: Category) => {
    setCategoryToDelete(category);
    setShowDeleteModal(true);
  };

  const handleDeleteCategory = async () => {
    if (!categoryToDelete) return;
    
    try {
      const response = await categoryService.deleteCategory(categoryToDelete.id);
      if (response.error) {
        showError(response.error);
      } else {
        setCategories(categories.filter(cat => cat.id !== categoryToDelete.id));
        showSuccess(t('categories.notifications.deleteSuccess'));
        setShowDeleteModal(false);
        setShowEditModal(false);
        setCategoryToDelete(null);
        setEditingCategory(null);
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : t('categories.errors.deleteFailed'));
    }
  };

  const handleCreateCategory = async () => {
    if (!createForm.name) {
      showError(t('categories.errors.nameRequired'));
      return;
    }

    try {
      const response = await categoryService.createCategory(createForm);
      if (response.error) {
        showError(response.error);
      } else if (response.data) {
        setCategories([...categories, response.data]);
        showSuccess(t('categories.notifications.createSuccess'));
        // Reset form
        setCreateForm({
          name: "",
          default_tags: [],
          directories: [],
          color: "#3b82f6",
          icon: "Folder"
        });
        setTagInput("");
        setDirectoryInput("");
        setShowCreateForm(false);
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : t('categories.errors.createFailed'));
    }
  };

  const handleUpdateCategory = async (categoryId: string) => {
    try {
      const response = await categoryService.updateCategory(categoryId, editForm);
      if (response.error) {
        showError(response.error);
      } else if (response.data) {
        setCategories(categories.map(cat => cat.id === categoryId && response.data ? response.data : cat));
        showSuccess(t('categories.notifications.updateSuccess'));
        setShowEditModal(false);
        setEditingCategory(null);
        setEditTagInput("");
        setEditDirectoryInput("");
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : t('categories.errors.updateFailed'));
    }
  };

  const startEditCategory = (category: Category) => {
    setEditingCategory(category);
    setEditForm({
      default_tags: [...(category.default_tags || [])],
      directories: [...(category.directories || [])],
      color: category.color || "#3b82f6",
      icon: category.icon || "Folder"
    });
    setShowEditModal(true);
  };

  const cancelEdit = () => {
    setShowEditModal(false);
    setEditingCategory(null);
    setEditTagInput("");
    setEditDirectoryInput("");
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

  const addDirectory = () => {
    if (directoryInput.trim()) {
      setCreateForm({
        ...createForm,
        directories: [...(createForm.directories || []), directoryInput.trim()]
      });
      setDirectoryInput("");
    }
  };

  const removeDirectory = (index: number) => {
    setCreateForm({
      ...createForm,
      directories: createForm.directories?.filter((_, i) => i !== index) || []
    });
  };

  const addEditTag = () => {
    if (editTagInput.trim()) {
      setEditForm({
        ...editForm,
        default_tags: [...(editForm.default_tags || []), editTagInput.trim()]
      });
      setEditTagInput("");
    }
  };

  const removeEditTag = (index: number) => {
    setEditForm({
      ...editForm,
      default_tags: editForm.default_tags?.filter((_, i) => i !== index) || []
    });
  };

  const addEditDirectory = () => {
    if (editDirectoryInput.trim()) {
      setEditForm({
        ...editForm,
        directories: [...(editForm.directories || []), editDirectoryInput.trim()]
      });
      setEditDirectoryInput("");
    }
  };

  const removeEditDirectory = (index: number) => {
    setEditForm({
      ...editForm,
      directories: editForm.directories?.filter((_, i) => i !== index) || []
    });
  };

  // Filter and sort categories
  const filteredCategories = categories
    .filter(cat => cat.name.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => {
      let comparison = 0;
      if (sortBy === "name") {
        comparison = a.name.localeCompare(b.name);
      } else if (sortBy === "created_at") {
        comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });

  return (
    <div className="space-y-6">
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <h1 className="text-3xl font-bold">{t('categories.title')}</h1>
          <p className="text-muted-foreground">{t('categories.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={loadCategories} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            {t('categories.refresh')}
          </Button>
          <Button onClick={() => setShowCreateForm(!showCreateForm)} size="sm">
            {showCreateForm ? <X className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
            {showCreateForm ? t('common.cancel') : t('categories.addCategory')}
          </Button>
        </div>
      </div>

      {/* Create Category Form */}
      {showCreateForm && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">{t('categories.createNew')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-sm">{t('categories.fields.name')} *</Label>
                <Input
                  id="name"
                  placeholder={t('categories.placeholders.name')}
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="color" className="text-sm">{t('categories.fields.color')}</Label>
                <div className="flex gap-1.5 flex-wrap">
                  {availableColors.map((color) => (
                    <button
                      key={color.value}
                      type="button"
                      className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${
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

            <div className="space-y-1.5">
              <Label htmlFor="icon" className="text-sm">{t('categories.fields.icon')}</Label>
              <div className="flex gap-1.5 flex-wrap">
                {availableIcons.map((iconItem) => {
                  const IconComponent = iconItem.icon;
                  return (
                    <button
                      key={iconItem.name}
                      type="button"
                      className={`w-8 h-8 rounded-md border-2 flex items-center justify-center transition-all hover:scale-110 ${
                        createForm.icon === iconItem.name ? 'border-foreground bg-accent scale-110' : 'border-border hover:bg-accent/50'
                      }`}
                      onClick={() => setCreateForm({ ...createForm, icon: iconItem.name })}
                      title={iconItem.name}
                    >
                      <IconComponent className="h-4 w-4" />
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tags" className="text-sm">{t('categories.fields.defaultTags')}</Label>
              <div className="flex gap-1.5">
                <Input
                  id="tags"
                  placeholder={t('categories.placeholders.tag')}
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                  className="h-9"
                />
                <Button onClick={addTag} size="sm" variant="outline" className="h-9 px-2">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {createForm.default_tags && createForm.default_tags.length > 0 && (
                <div className="flex gap-1 flex-wrap">
                  {createForm.default_tags.map((tag, index) => (
                    <div key={index} className="flex items-center gap-1 bg-accent px-2 py-0.5 rounded text-xs">
                      <Tag className="h-3 w-3" />
                      {tag}
                      <button onClick={() => removeTag(index)} className="ml-0.5 hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="directories" className="text-sm">{t('categories.fields.directories')}</Label>
              <div className="flex gap-1.5">
                <Input
                  id="directories"
                  placeholder={t('categories.placeholders.directory')}
                  value={directoryInput}
                  onChange={(e) => setDirectoryInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addDirectory())}
                  className="h-9"
                />
                <Button onClick={addDirectory} size="sm" variant="outline" className="h-9 px-2">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {createForm.directories && createForm.directories.length > 0 && (
                <div className="flex gap-1 flex-wrap">
                  {createForm.directories.map((dir, index) => (
                    <div key={index} className="flex items-center gap-1 bg-accent px-2 py-0.5 rounded text-xs font-mono">
                      <Folder className="h-3 w-3" />
                      <span className="max-w-[150px] truncate">{dir}</span>
                      <button onClick={() => removeDirectory(index)} className="ml-0.5 hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-2 justify-end pt-1">
              <Button variant="outline" onClick={() => setShowCreateForm(false)} size="sm">
                {t('common.cancel')}
              </Button>
              <Button onClick={handleCreateCategory} size="sm">
                <Check className="h-4 w-4 mr-1" />
                {t('categories.create')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search and Sort */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('categories.search')}
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (sortBy === "name") {
                setSortOrder(sortOrder === "asc" ? "desc" : "asc");
              } else {
                setSortBy("name");
                setSortOrder("asc");
              }
            }}
          >
            {t('categories.sortBy.name')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (sortBy === "created_at") {
                setSortOrder(sortOrder === "asc" ? "desc" : "asc");
              } else {
                setSortBy("created_at");
                setSortOrder("asc");
              }
            }}
          >
            {t('categories.sortBy.date')}
          </Button>
        </div>
      </div>

      {/* Categories List */}
      {loading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">{t('categories.loading')}</span>
          </CardContent>
        </Card>
      ) : filteredCategories.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Folder className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">{t('categories.noCategories')}</h3>
            <p className="text-muted-foreground text-center mb-4">{t('categories.noCategoriesDesc')}</p>
            <Button onClick={() => setShowCreateForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              {t('categories.addCategory')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-3">
            {filteredCategories.map((category) => (
              <Card 
                key={category.id} 
                className="relative cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => startEditCategory(category)}
              >
                <CardContent className="p-4">
                  <div className="flex gap-3 items-center">
                    {/* Icon */}
                    <div
                      className="w-16 h-16 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: category.color || "#3b82f6" }}
                    >
                      {(() => {
                        const iconName = category.icon || "Folder";
                        const IconComponent = availableIcons.find(i => i.name === iconName)?.icon || Folder;
                        return <IconComponent className="h-8 w-8 text-white" />;
                      })()}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div>
                        <h3 className="font-semibold text-base truncate">{category.name}</h3>
                        <p className="text-xs text-muted-foreground">
                          {new Date(category.created_at).toLocaleDateString()}
                        </p>
                      </div>

                      {category.default_tags && category.default_tags.length > 0 && (
                        <div className="flex gap-1 flex-wrap items-center">
                          <Tag className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                          {category.default_tags.slice(0, 3).map((tag, index) => (
                            <span key={index} className="bg-accent px-1.5 py-0.5 rounded text-xs">
                              {tag}
                            </span>
                          ))}
                          {category.default_tags.length > 3 && (
                            <span className="text-xs text-muted-foreground">
                              +{category.default_tags.length - 3}
                            </span>
                          )}
                        </div>
                      )}

                      {category.directories && category.directories.length > 0 && (
                        <div className="flex gap-1 flex-wrap items-center">
                          <Folder className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                          {category.directories.slice(0, 2).map((dir, index) => (
                            <span key={index} className="bg-accent px-1.5 py-0.5 rounded text-xs font-mono truncate max-w-[200px]">
                              {dir}
                            </span>
                          ))}
                          {category.directories.length > 2 && (
                            <span className="text-xs text-muted-foreground">
                              +{category.directories.length - 2}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Edit Modal */}
          <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{t('categories.edit')} - {editingCategory?.name}</DialogTitle>
              </DialogHeader>
              
              {editingCategory && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 bg-accent/50 rounded-lg">
                    <div
                      className="w-14 h-14 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: editForm.color || editingCategory.color }}
                    >
                      {(() => {
                        const iconName = editForm.icon || editingCategory.icon || "Folder";
                        const IconComponent = availableIcons.find(i => i.name === iconName)?.icon || Folder;
                        return <IconComponent className="h-7 w-7 text-white" />;
                      })()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-base">{editingCategory.name}</h3>
                      <p className="text-xs text-muted-foreground">{t('categories.immutableName')}</p>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-sm">{t('categories.fields.color')}</Label>
                    <div className="flex gap-1 flex-wrap">
                      {availableColors.map((color) => (
                        <button
                          key={color.value}
                          type="button"
                          className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${
                            editForm.color === color.value ? 'border-foreground scale-110' : 'border-transparent'
                          }`}
                          style={{ backgroundColor: color.value }}
                          onClick={() => setEditForm({ ...editForm, color: color.value })}
                          title={color.name}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-sm">{t('categories.fields.icon')}</Label>
                    <div className="flex gap-1 flex-wrap">
                      {availableIcons.map((iconItem) => {
                        const IconComponent = iconItem.icon;
                        return (
                          <button
                            key={iconItem.name}
                            type="button"
                            className={`w-7 h-7 rounded-md border-2 flex items-center justify-center transition-all hover:scale-110 ${
                              editForm.icon === iconItem.name ? 'border-foreground bg-accent scale-110' : 'border-border hover:bg-accent/50'
                            }`}
                            onClick={() => setEditForm({ ...editForm, icon: iconItem.name })}
                            title={iconItem.name}
                          >
                            <IconComponent className="h-3.5 w-3.5" />
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-sm">{t('categories.fields.defaultTags')}</Label>
                    <div className="flex gap-1">
                      <Input
                        placeholder={t('categories.placeholders.tag')}
                        value={editTagInput}
                        onChange={(e) => setEditTagInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addEditTag())}
                        className="h-8 text-sm"
                      />
                      <Button onClick={addEditTag} size="sm" variant="outline" className="h-8 px-2">
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    {editForm.default_tags && editForm.default_tags.length > 0 && (
                      <div className="flex gap-1 flex-wrap">
                        {editForm.default_tags.map((tag, index) => (
                          <div key={index} className="flex items-center gap-0.5 bg-accent px-1.5 py-0.5 rounded text-xs">
                            {tag}
                            <button onClick={() => removeEditTag(index)} className="hover:text-destructive">
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-sm">{t('categories.fields.directories')}</Label>
                    <div className="flex gap-1">
                      <Input
                        placeholder={t('categories.placeholders.directory')}
                        value={editDirectoryInput}
                        onChange={(e) => setEditDirectoryInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addEditDirectory())}
                        className="h-8 text-sm"
                      />
                      <Button onClick={addEditDirectory} size="sm" variant="outline" className="h-8 px-2">
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    {editForm.directories && editForm.directories.length > 0 && (
                      <div className="flex gap-1 flex-wrap">
                        {editForm.directories.map((dir, index) => (
                          <div key={index} className="flex items-center gap-0.5 bg-accent px-1.5 py-0.5 rounded text-xs font-mono">
                            <span className="max-w-[120px] truncate">{dir}</span>
                            <button onClick={() => removeEditDirectory(index)} className="hover:text-destructive">
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 justify-between pt-2">
                    <Button 
                      variant="destructive" 
                      onClick={() => confirmDeleteCategory(editingCategory)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      {t('common.delete')}
                    </Button>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={cancelEdit}>
                        <X className="h-4 w-4 mr-2" />
                        {t('common.cancel')}
                      </Button>
                      <Button onClick={() => handleUpdateCategory(editingCategory.id)}>
                        <Check className="h-4 w-4 mr-2" />
                        {t('common.save')}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* Delete Confirmation Modal */}
          <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{t('categories.deleteConfirmTitle')}</DialogTitle>
              </DialogHeader>
              
              {categoryToDelete && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    {t('categories.deleteConfirmMessage', { name: categoryToDelete.name })}
                  </p>
                  
                  <div className="flex items-center gap-3 p-3 bg-accent/50 rounded-lg">
                    <div
                      className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: categoryToDelete.color || "#3b82f6" }}
                    >
                      {(() => {
                        const iconName = categoryToDelete.icon || "Folder";
                        const IconComponent = availableIcons.find(i => i.name === iconName)?.icon || Folder;
                        return <IconComponent className="h-6 w-6 text-white" />;
                      })()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-sm">{categoryToDelete.name}</h3>
                      {categoryToDelete.default_tags && categoryToDelete.default_tags.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          {categoryToDelete.default_tags.length} {t('categories.fields.defaultTags').toLowerCase()}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2 justify-end">
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setShowDeleteModal(false);
                        setCategoryToDelete(null);
                      }}
                    >
                      {t('common.cancel')}
                    </Button>
                    <Button 
                      variant="destructive" 
                      onClick={handleDeleteCategory}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      {t('common.delete')}
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}

export default Categories;

