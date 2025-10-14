// Types for communication with the API v1/categories

export interface Category {
  id: string;
  name: string;
  default_tags: string[];
  directories: string[];
  color?: string;
  icon?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateCategoryRequest {
  name: string;
  default_tags?: string[];
  directories?: string[];
  color?: string;
  icon?: string;
}

export interface UpdateCategoryRequest {
  default_tags?: string[];
  directories?: string[];
  color?: string;
  icon?: string;
}

export interface CategoryListResponse {
  data: Category[];
}

export interface CategoryResponse {
  data: Category;
}

export interface CategoryDeleteResponse {
  data: null;
}

