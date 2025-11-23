import { api } from '../lib/api';
import type { ApiResponse } from '../lib/api';
import type {
  Webhook,
  CreateWebhookRequest,
  UpdateWebhookRequest
} from '../types/webhook';

/**
 * Service for communication with the API v1/integrations/webhooks from the backend
 */
export class WebhookService {
  private readonly baseEndpoint = '/integrations/webhooks';

  /**
   * Lists all webhooks
   */
  async listWebhooks(): Promise<ApiResponse<Webhook[]>> {
    return api.get<Webhook[]>(this.baseEndpoint);
  }

  /**
   * Gets a specific webhook by UUID
   */
  async getWebhook(webhookId: string): Promise<ApiResponse<Webhook>> {
    return api.get<Webhook>(`${this.baseEndpoint}/${webhookId}`);
  }

  /**
   * Creates a new webhook
   */
  async createWebhook(webhookData: CreateWebhookRequest): Promise<ApiResponse<Webhook>> {
    return api.post<Webhook>(this.baseEndpoint, webhookData);
  }

  /**
   * Updates an existing webhook
   */
  async updateWebhook(webhookId: string, webhookData: UpdateWebhookRequest): Promise<ApiResponse<Webhook>> {
    return api.put<Webhook>(`${this.baseEndpoint}/${webhookId}`, webhookData);
  }

  /**
   * Deletes a webhook
   */
  async deleteWebhook(webhookId: string): Promise<ApiResponse<null>> {
    return api.delete<null>(`${this.baseEndpoint}/${webhookId}`);
  }
}

// Default service instance
export const webhookService = new WebhookService();

