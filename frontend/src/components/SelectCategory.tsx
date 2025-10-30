import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { AddCategoryModal } from "@/components/AddCategoryModal";
import { categoryService } from "@/services/categories";
import { Folder, ChevronsUpDown, Check, Plus } from "lucide-react";
import type { Category, CreateCategoryRequest } from "@/types/category";

interface SelectCategoryProps {
  selectedCategoryId: string;
  onCategoryChange: (categoryId: string, category?: Category) => void;
  label?: string;
  required?: boolean;
  error?: string;
  className?: string;
  showAddButton?: boolean;
  onCategoryCreated?: (category: Category) => void;
  autoLoad?: boolean;
}

/**
 * Render a category selector with a dropdown list and an optional modal to create new categories.
 *
 * The component loads categories on mount when `autoLoad` is true, closes the dropdown when clicking outside,
 * and keeps the selected category highlighted. Selecting a category calls `onCategoryChange` with the selected
 * category id and the matching category object. Creating a category via the modal reloads the list, selects
 * the new category, and invokes `onCategoryCreated` if provided.
 *
 * @param selectedCategoryId - Id of the currently selected category.
 * @param onCategoryChange - Callback invoked when a category is selected; receives the category id and the category object when available.
 * @param label - Visible label for the selector.
 * @param required - If true, renders a required indicator next to the label.
 * @param error - Optional error message displayed beneath the selector.
 * @param className - Additional container class names.
 * @param showAddButton - If true, shows a button to open the add-category modal.
 * @param onCategoryCreated - Optional callback invoked with the newly created category after creation.
 * @param autoLoad - If true, categories are loaded automatically on mount.
 * @returns The rendered SelectCategory component element.
 */
export function SelectCategory({
  selectedCategoryId,
  onCategoryChange,
  label = "Categoria",
  required = false,
  error,
  className = "",
  showAddButton = true,
  onCategoryCreated,
  autoLoad = true
}: SelectCategoryProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);

  // Load categories on mount if autoLoad is enabled
  useEffect(() => {
    if (autoLoad) {
      loadCategories();
    }
  }, [autoLoad]);

  // Close category dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target as Node)) {
        setCategoryDropdownOpen(false);
      }
    };

    if (categoryDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [categoryDropdownOpen]);

  const loadCategories = async () => {
    try {
      const response = await categoryService.listCategories();
      if (response.data) {
        setCategories(response.data);
      }
    } catch (err) {
      console.error('Failed to load categories:', err);
    }
  };

  const handleCategoryChange = (categoryId: string) => {
    const selectedCategory = categories.find(cat => cat.id === categoryId);
    onCategoryChange(categoryId, selectedCategory);
    setCategoryDropdownOpen(false);
  };

  const handleAddCategoryClick = () => {
    setCategoryModalOpen(true);
  };

  const handleCategoryCreated = async (categoryData: unknown): Promise<Category | undefined> => {
    try {
      const response = await categoryService.createCategory(categoryData as CreateCategoryRequest);
      if (response.data) {
        // Reload categories list
        await loadCategories();
        // Select the newly created category
        onCategoryChange(response.data.id);
        // Call optional callback
        if (onCategoryCreated) {
          onCategoryCreated(response.data);
        }
        return response.data;
      }
    } catch (err) {
      console.error('Failed to create category:', err);
    }
    return undefined;
  };

  const selectedCategory = categories.find(cat => cat.id === selectedCategoryId);

  return (
    <div className={`space-y-2 ${className}`}>
      <Label className="flex items-center gap-2">
        <Folder className="h-4 w-4" />
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      
      <div className="flex gap-2">
        <div className="relative flex-1" ref={categoryDropdownRef}>
          <Button
            type="button"
            variant="outline"
            onClick={() => setCategoryDropdownOpen(!categoryDropdownOpen)}
            className={`w-full justify-between ${error ? "border-destructive" : ""}`}
          >
            <div className="flex items-center gap-2">
              {selectedCategory ? (
                <CategoryIcon 
                  iconName={selectedCategory.icon}
                  color={selectedCategory.color}
                  size="sm"
                />
              ) : (
                <Folder className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="truncate">
                {selectedCategory?.name || "Selecione uma categoria"}
              </span>
            </div>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
          
          {categoryDropdownOpen && (
            <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-60 overflow-auto">
              {categories.length === 0 ? (
                <div className="px-3 py-2 text-sm text-muted-foreground">
                  Nenhuma categoria disponível
                </div>
              ) : (
                categories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleCategoryChange(cat.id)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground text-left"
                  >
                    <CategoryIcon 
                      iconName={cat.icon}
                      color={cat.color}
                      size="sm"
                    />
                    <span className="flex-1 truncate">{cat.name}</span>
                    {selectedCategoryId === cat.id && (
                      <Check className="h-4 w-4 text-primary" />
                    )}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
        
        {showAddButton && (
          <Button
            type="button"
            variant="default"
            size="sm"
            className="h-10 px-3"
            title="Adicionar Categoria"
            onClick={handleAddCategoryClick}
          >
            <Plus className="h-4 w-4" />
          </Button>
        )}
      </div>
      
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {/* Category Creation Modal */}
      <AddCategoryModal
        open={categoryModalOpen}
        onOpenChange={setCategoryModalOpen}
        onCategoryCreated={handleCategoryCreated}
      />
    </div>
  );
}