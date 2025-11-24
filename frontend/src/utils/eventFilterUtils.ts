import type { EventFilterRequest } from '@/types/webhook';

// Utility functions for filter management
export function buildFilterFromStrings(
  eventTypeFilter: string,
  statusFilter: string,
  categoryFilter: string,
  nameTerms: string
): EventFilterRequest | undefined {
  const hasEventType = eventTypeFilter.trim().length > 0;
  const hasStatus = statusFilter.trim().length > 0;
  const hasCategory = categoryFilter.trim().length > 0;
  const hasNameTerms = nameTerms.trim().length > 0;

  if (!hasEventType && !hasStatus && !hasCategory && !hasNameTerms) {
    return undefined;
  }

  return {
    event_type_filter: hasEventType ? eventTypeFilter.trim() : undefined,
    status_filter: hasStatus
      ? statusFilter.split(',').map(s => s.trim()).filter(s => s.length > 0)
      : undefined,
    category_filter: hasCategory
      ? categoryFilter.split(',').map(s => s.trim()).filter(s => s.length > 0)
      : undefined,
    name_terms: hasNameTerms
      ? nameTerms.split(',').map(s => s.trim()).filter(s => s.length > 0)
      : undefined,
  };
}

export function filterToStrings(filter?: EventFilterRequest | null): {
  eventTypeFilter: string;
  statusFilter: string;
  categoryFilter: string;
  nameTerms: string;
} {
  return {
    eventTypeFilter: filter?.event_type_filter || '',
    statusFilter: filter?.status_filter?.join(', ') || '',
    categoryFilter: filter?.category_filter?.join(', ') || '',
    nameTerms: filter?.name_terms?.join(', ') || '',
  };
}

