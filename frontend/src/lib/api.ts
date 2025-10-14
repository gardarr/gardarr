// API client para comunicação com o backend
import type { ResponseError } from '../types/errors';
import { isResponseError, getErrorMessage } from '../types/errors';

const API_BASE_URL = '/v1';

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  errorDetails?: ResponseError;
}

class ApiClient {
  private baseURL: string;

  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = baseURL;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseURL}${endpoint}`;
    
    const defaultOptions: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      credentials: 'include', // Include cookies in requests
    };

    try {
      const response = await fetch(url, { ...defaultOptions, ...options });
      
      // Handle 204 No Content responses (no body to parse)
      if (response.status === 204) {
        return { data: null as T };
      }

      // Check if response has content to parse
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        
        // Handle error responses
        if (!response.ok) {
          // Check if it's a structured ResponseError from backend
          if (isResponseError(data)) {
            return { 
              error: data.message || data.error || `HTTP error! status: ${response.status}`,
              errorDetails: data,
              data: undefined
            };
          }
          
          // Fallback for other error formats
          return { 
            error: getErrorMessage(data) || `HTTP error! status: ${response.status}`,
            data: undefined
          };
        }
        
        return { data };
      } else {
        if (!response.ok) {
          const text = await response.text();
          return { 
            error: text || `HTTP error! status: ${response.status}`,
            data: undefined
          };
        }
        // For non-JSON responses, return the response text or null
        const text = await response.text();
        return { data: (text || null) as T };
      }
    } catch (error) {
      console.error('API request failed:', error);
      return { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  // GET request
  async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  // POST request
  async post<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  // PUT request
  async put<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  // DELETE request
  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

// Instância padrão do cliente API
export const api = new ApiClient();

// Exemplo de uso:
// const response = await api.get('/health');
// if (response.data) {
//   console.log('Health check:', response.data);
// } else {
//   console.error('Error:', response.error);
// }
