import { api } from '../lib/api';
import type { ApiResponse } from '../lib/api';
import type {
  Category,
  CreateCategoryRequest,
  UpdateCategoryRequest
} from '../types/category';

/**
 * Service for communication with the API v1/categories from the backend
 */
export class CategoryService {
  private readonly baseEndpoint = '/categories';

  /**
   * Lists all categories
   */
  async listCategories(): Promise<ApiResponse<Category[]>> {
    return api.get<Category[]>(this.baseEndpoint);
  }

  /**
   * Gets a specific category by ID
   */
  async getCategory(categoryId: string): Promise<ApiResponse<Category>> {
    return api.get<Category>(`${this.baseEndpoint}/${categoryId}`);
  }

  /**
   * Creates a new category
   */
  async createCategory(categoryData: CreateCategoryRequest): Promise<ApiResponse<Category>> {
    return api.post<Category>(this.baseEndpoint, categoryData);
  }

  /**
   * Updates an existing category (name and ID are immutable)
   */
  async updateCategory(categoryId: string, categoryData: UpdateCategoryRequest): Promise<ApiResponse<Category>> {
    return api.put<Category>(`${this.baseEndpoint}/${categoryId}`, categoryData);
  }

  /**
   * Deletes a category
   */
  async deleteCategory(categoryId: string): Promise<ApiResponse<null>> {
    return api.delete<null>(`${this.baseEndpoint}/${categoryId}`);
  }
}

// Default service instance
export const categoryService = new CategoryService();

