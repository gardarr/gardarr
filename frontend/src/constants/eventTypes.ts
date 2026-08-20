/**
 * Event types available in the system
 * These correspond to the event types defined in the backend
 */

export type EventType =
  | 'torrent.state_change'
  | 'torrent.added'
  | 'torrent.removed'
  | 'torrent.completed'
  | 'bandwidth.schedule_applied';

export const EVENT_TYPES: readonly EventType[] = [
  'torrent.state_change',
  'torrent.added',
  'torrent.removed',
  'torrent.completed',
  'bandwidth.schedule_applied',
] as const;

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  'torrent.state_change': 'State Change',
  'torrent.added': 'Added',
  'torrent.removed': 'Removed',
  'torrent.completed': 'Completed',
  'bandwidth.schedule_applied': 'Bandwidth schedule applied',
};

export const EVENT_TYPE_DESCRIPTIONS: Record<EventType, string> = {
  'torrent.state_change': 'Triggered when a torrent changes its state',
  'torrent.added': 'Triggered when a new torrent is added',
  'torrent.removed': 'Triggered when a torrent is removed',
  'torrent.completed': 'Triggered when a torrent completes downloading',
  'bandwidth.schedule_applied': 'Triggered when a scheduled global speed limit is applied',
};
