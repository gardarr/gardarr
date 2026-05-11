import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  FolderOpen
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { categoryService } from "./services/categories";
import type { Category, CreateCategoryRequest, UpdateCategoryRequest } from "./types/category";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { AddCategoryModal } from "./components/AddCategoryModal";
import { TagBadge } from "./components/ui/TagBadge";
import { getCategoryIcon } from "./utils/categoryUtils";

function Categories() {
  const { t } = useTranslation();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
  

  const loadCategories = useCallback(async () => {
    try {
      setLoading(true);
      const response = await categoryService.listCategories();
      
      if (response.error) {
        toast.error(response.error);
      } else if (response.data) {
        setCategories(response.data);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('categories.errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  // Load categories on component mount
  useEffect(() => {
    loadCategories();
  }, [loadCategories]);


  const handleDeleteCategory = async () => {
    if (!categoryToDelete) return;
    
    try {
      const response = await categoryService.deleteCategory(categoryToDelete.id);
      if (response.error) {
        toast.error(response.error);
      } else {
        setCategories(categories.filter(cat => cat.id !== categoryToDelete.id));
        toast.success(t('categories.notifications.deleteSuccess'));
        setShowDeleteModal(false);
        setCategoryToDelete(null);
        setEditingCategory(null);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('categories.errors.deleteFailed'));
    }
  };

  const handleCreateCategory = async (createForm: CreateCategoryRequest) => {
    try {
      const response = await categoryService.createCategory(createForm);
      if (response.error) {
        toast.error(response.error);
        throw new Error(response.error);
      } else if (response.data) {
        setCategories([...categories, response.data]);
        toast.success(t('categories.notifications.createSuccess'));
        return response.data;
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('categories.errors.createFailed'));
      throw err;
    }
  };

  const handleUpdateCategory = async (categoryId: string, updateData: UpdateCategoryRequest): Promise<void> => {
    try {
      const response = await categoryService.updateCategory(categoryId, updateData);
      if (response.error) {
        toast.error(response.error);
        throw new Error(response.error);
      } else if (response.data) {
        // Update the categories list
        const updatedCategories = categories.map(cat => cat.id === categoryId && response.data ? response.data : cat);
        setCategories(updatedCategories);
        
        // Update the editing category if it's the same one being updated
        if (editingCategory && editingCategory.id === categoryId) {
          setEditingCategory(response.data);
        }
        
        toast.success(t('categories.notifications.updateSuccess'));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('categories.errors.updateFailed'));
      throw err;
    }
  };

  const startEditCategory = (category: Category) => {
    setEditingCategory(category);
    setShowCreateModal(true);
  };

  const handleModalClose = (open: boolean) => {
    setShowCreateModal(open);
    if (!open) {
      setEditingCategory(null);
    }
  };




  // Filter categories
  const filteredCategories = categories
    .filter(cat => cat.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <FolderOpen className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">{t('categories.title')}</h1>
            <p className="text-muted-foreground">{t('categories.subtitle')}</p>
          </div>
        </div>
        <div className="flex gap-2 w-full sm:w-auto justify-between sm:justify-end">
          <Button onClick={loadCategories} variant="outline" size="icon" aria-label="Refresh categories">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button onClick={() => setShowCreateModal(true)} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            {t('categories.addCategory')}
          </Button>
        </div>
      </div>


      {/* Search */}
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
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              {t('categories.addCategory')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {filteredCategories.map((category) => (
              <Card 
                key={category.id} 
                className="relative cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => startEditCategory(category)}
              >
                <CardContent className="p-4">
                  <div className="flex flex-col gap-3 items-center text-center">
                    {/* Icon */}
                    <div
                      className="w-16 h-16 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: category.color || "#3b82f6" }}
                    >
                      {(() => {
                        const IconComponent = getCategoryIcon(category.icon);
                        return <IconComponent className="h-8 w-8 text-white" />;
                      })()}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 space-y-1.5 w-full">
                      <div>
                        <h3 className="font-semibold text-base truncate">{category.name}</h3>
                      </div>

                      {category.default_tags && category.default_tags.length > 0 && (
                        <div className="flex gap-1 flex-wrap items-center justify-center">
                          {category.default_tags.slice(0, 3).map((tag, index) => (
                            <TagBadge
                              key={index}
                              tag={tag}
                              size="sm"
                              showIcon={false}
                            />
                          ))}
                          {category.default_tags.length > 3 && (
                            <span className="text-xs text-muted-foreground">
                              +{category.default_tags.length - 3}
                            </span>
                          )}
                        </div>
                      )}

                      {category.default_directory && (
                        <div className="flex gap-1 flex-wrap items-center justify-center">
                          <Folder className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                          <span className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono truncate max-w-[200px]">
                            {category.default_directory}
                          </span>
                        </div>
                      )}

                      {category.metadata_source && category.metadata_source !== "none" && (
                        <div className="text-xs text-muted-foreground">
                          {t(`categories.metadataSource.options.${category.metadata_source}`)}
                        </div>
                      )}
                    </div>

                  </div>
                </CardContent>
              </Card>
            ))}
          </div>


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
                        const IconComponent = getCategoryIcon(categoryToDelete.icon);
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

          {/* Add/Edit Category Modal - Always available */}
          <AddCategoryModal
            open={showCreateModal}
            onOpenChange={handleModalClose}
            onCategoryCreated={handleCreateCategory}
            editingCategory={editingCategory}
            onCategoryUpdated={handleUpdateCategory}
          />
    </div>
  );
}

export default Categories;
