// Types for communication with the API v1/integrations/webhooks

export interface EventFilter {
  uuid: string;
  integration_id: string;
  integration_type: string;
  event_type_filter?: string;
  status_filter?: string[];
  category_filter?: string[];
  name_terms?: string[];
  created_at: string;
  updated_at: string;
}

export interface EventFilterRequest {
  event_type_filter?: string;
  status_filter?: string[];
  category_filter?: string[];
  name_terms?: string[];
}

export interface Webhook {
  uuid: string;
  url: string;
  insecure_skip_verify: boolean;
  enabled: boolean;
  timeout_seconds: number;
  filter?: EventFilter;
  created_at: string;
  updated_at: string;
}

export interface CreateWebhookRequest {
  url: string;
  insecure_skip_verify?: boolean;
  timeout_seconds?: number;
  filter?: EventFilterRequest;
}

export interface UpdateWebhookRequest {
  url?: string;
  insecure_skip_verify?: boolean;
  enabled?: boolean;
  timeout_seconds?: number;
  filter?: EventFilterRequest;
}

