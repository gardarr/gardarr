/**
 * Event types available in the system
 * These correspond to the event types defined in the backend
 */

export type EventType =
  | 'torrent.state_change'
  | 'torrent.added'
  | 'torrent.removed'
  | 'torrent.completed';

export const EVENT_TYPES: readonly EventType[] = [
  'torrent.state_change',
  'torrent.added',
  'torrent.removed',
  'torrent.completed',
] as const;

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  'torrent.state_change': 'State Change',
  'torrent.added': 'Added',
  'torrent.removed': 'Removed',
  'torrent.completed': 'Completed',
};

export const EVENT_TYPE_DESCRIPTIONS: Record<EventType, string> = {
  'torrent.state_change': 'Triggered when a torrent changes its state',
  'torrent.added': 'Triggered when a new torrent is added',
  'torrent.removed': 'Triggered when a torrent is removed',
  'torrent.completed': 'Triggered when a torrent completes downloading',
};

