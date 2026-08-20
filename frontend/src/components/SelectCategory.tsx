import { useState, useEffect, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { AddCategoryModal } from "@/components/AddCategoryModal";
import { categoryService } from "@/services/categories";
import { Folder, ChevronsUpDown, Check, Plus, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
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
  /** Compact trigger height for dense layouts. */
  dense?: boolean;
}

export function SelectCategory({
  selectedCategoryId,
  onCategoryChange,
  label,
  required = false,
  error,
  className = "",
  showAddButton = true,
  onCategoryCreated,
  autoLoad = true,
  dense = false
}: SelectCategoryProps) {
  const { t } = useTranslation();
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const categoryDropdownRef = useRef<HTMLDivElement>(null);
  const filteredCategories = useMemo(
    () => categories.filter((cat) => cat.name.toLowerCase().includes(searchQuery.trim().toLowerCase())),
    [categories, searchQuery]
  );

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

  useEffect(() => {
    if (!categoryDropdownOpen) {
      setSearchQuery("");
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
    setSearchQuery("");
    setCategoryDropdownOpen(false);
  };

  const handleAddCategoryClick = () => {
    setCategoryModalOpen(true);
  };

  const handleCategoryCreated = async (categoryData: CreateCategoryRequest): Promise<Category | undefined> => {
    try {
      const response = await categoryService.createCategory(categoryData);
      if (response.data) {
        // Reload categories list
        await loadCategories();
        // Select the newly created category
        onCategoryChange(response.data.id, response.data);
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
      {label !== "" && (
        <Label className="flex items-center gap-2">
          <Folder className="h-4 w-4" />
          {(label ?? t("torrents.addModal.category.label"))} {required && <span className="text-destructive">*</span>}
        </Label>
      )}

      <div className="flex gap-2">
        <div className="relative flex-1" ref={categoryDropdownRef}>
          <Button
            type="button"
            variant="outline"
            onClick={() => setCategoryDropdownOpen(!categoryDropdownOpen)}
            className={`${dense ? "h-9 px-3" : "h-12 px-4"} w-full justify-between text-left ${error ? "border-destructive" : ""}`}
          >
            <div className="flex min-w-0 items-center gap-2">
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
                {selectedCategory?.name || t("selectCategory.placeholder")}
              </span>
            </div>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
          
          {categoryDropdownOpen && (
            <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-60 overflow-auto">
              <div className="sticky top-0 z-10 border-b bg-background p-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder={t("selectCategory.searchPlaceholder")}
                    className="pl-9"
                  />
                </div>
              </div>
              {categories.length === 0 ? (
                <div className="px-3 py-2 text-sm text-muted-foreground">
                  {t("selectCategory.empty")}
                </div>
              ) : filteredCategories.length === 0 ? (
                <div className="px-3 py-2 text-sm text-muted-foreground">
                  {t("selectCategory.noResults")}
                </div>
              ) : (
                filteredCategories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleCategoryChange(cat.id)}
                    className="flex w-full items-center gap-3 px-3 py-3 text-left text-sm hover:bg-accent hover:text-accent-foreground"
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
            className="h-12 px-3"
            title={t("selectCategory.add")}
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
