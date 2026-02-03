/**
 * Task status types and utilities
 * 
 * This file defines all available Task statuses based on qBittorrent API statuses.
 * Statuses are mapped from qBittorrent lowercase format to uppercase constants.
 */

/**
 * All available Task statuses
 * These statuses correspond to qBittorrent API task states, mapped to uppercase format
 */
export type TaskStatus =
  | "ERROR"
  | "MISSING_FILES"
  | "UPLOADING"
  | "PAUSED_UPLOAD"
  | "STOPPED_UPLOAD"
  | "QUEUED_UPLOAD"
  | "STALLED_UPLOAD"
  | "CHECKING_UPLOAD"
  | "FORCED_UPLOAD"
  | "ALLOCATING"
  | "DOWNLOADING"
  | "METADATA_DOWNLOAD"
  | "FORCED_METADATA_DOWNLOAD"
  | "PAUSED_DOWNLOAD"
  | "STOPPED_DOWNLOAD"
  | "QUEUED_DOWNLOAD"
  | "FORCED_DOWNLOAD"
  | "STALLED_DOWNLOAD"
  | "CHECKING_DOWNLOAD"
  | "CHECKING_RESUME_DATA"
  | "MOVING"
  | "UNKNOWN";

/**
 * Array containing all available Task statuses
 * Useful for validation, filtering, or iteration
 */
export const TASK_STATUSES: readonly TaskStatus[] = [
  "ERROR",
  "MISSING_FILES",
  "UPLOADING",
  "PAUSED_UPLOAD",
  "STOPPED_UPLOAD",
  "QUEUED_UPLOAD",
  "STALLED_UPLOAD",
  "CHECKING_UPLOAD",
  "FORCED_UPLOAD",
  "ALLOCATING",
  "DOWNLOADING",
  "METADATA_DOWNLOAD",
  "FORCED_METADATA_DOWNLOAD",
  "PAUSED_DOWNLOAD",
  "STOPPED_DOWNLOAD",
  "QUEUED_DOWNLOAD",
  "FORCED_DOWNLOAD",
  "STALLED_DOWNLOAD",
  "CHECKING_DOWNLOAD",
  "CHECKING_RESUME_DATA",
  "MOVING",
  "UNKNOWN",
] as const;

/**
 * Error-related statuses
 */
export const ERROR_STATUSES: readonly TaskStatus[] = [
  "ERROR",
  "MISSING_FILES",
] as const;

/**
 * Download-related statuses
 */
export const DOWNLOAD_STATUSES: readonly TaskStatus[] = [
  "DOWNLOADING",
  "METADATA_DOWNLOAD",
  "FORCED_METADATA_DOWNLOAD",
  "PAUSED_DOWNLOAD",
  "STOPPED_DOWNLOAD",
  "QUEUED_DOWNLOAD",
  "FORCED_DOWNLOAD",
  "STALLED_DOWNLOAD",
  "CHECKING_DOWNLOAD",
  "CHECKING_RESUME_DATA",
] as const;

/**
 * Upload-related statuses
 */
export const UPLOAD_STATUSES: readonly TaskStatus[] = [
  "UPLOADING",
  "PAUSED_UPLOAD",
  "STOPPED_UPLOAD",
  "QUEUED_UPLOAD",
  "STALLED_UPLOAD",
  "CHECKING_UPLOAD",
  "FORCED_UPLOAD",
] as const;

/**
 * Active statuses - tasks that are actively processing
 */
export const ACTIVE_STATUSES: readonly TaskStatus[] = [
  "DOWNLOADING",
  "UPLOADING",
  "METADATA_DOWNLOAD",
  "FORCED_METADATA_DOWNLOAD",
  "FORCED_DOWNLOAD",
  "FORCED_UPLOAD",
  "CHECKING_DOWNLOAD",
  "CHECKING_UPLOAD",
  "CHECKING_RESUME_DATA",
  "ALLOCATING",
  "MOVING",
] as const;

/**
 * Paused/stopped statuses - tasks that are paused or stopped
 */
export const INACTIVE_STATUSES: readonly TaskStatus[] = [
  "PAUSED_DOWNLOAD",
  "STOPPED_DOWNLOAD",
  "PAUSED_UPLOAD",
  "STOPPED_UPLOAD",
  "STALLED_DOWNLOAD",
  "STALLED_UPLOAD",
  "QUEUED_DOWNLOAD",
  "QUEUED_UPLOAD",
] as const;

/**
 * Check if a status string is a valid Task status
 * @param status - Status string to validate
 * @returns True if the status is valid, false otherwise
 */
export function isValidTaskStatus(status: string): status is TaskStatus {
  return TASK_STATUSES.includes(status as TaskStatus);
}

/**
 * Normalize a status string to a valid TaskStatus
 * Converts to uppercase and validates against known statuses
 * @param status - Status string to normalize
 * @returns Normalized TaskStatus or "UNKNOWN" if invalid
 */
export function normalizeTaskStatus(status: string): TaskStatus {
  const normalized = status.toUpperCase();
  return isValidTaskStatus(normalized) ? normalized : "UNKNOWN";
}

/**
 * Check if a task status represents an active task
 * @param status - Task status to check
 * @returns True if the task is active, false otherwise
 */
export function isActiveStatus(status: TaskStatus): boolean {
  return ACTIVE_STATUSES.includes(status);
}

/**
 * Check if a task status represents an error state
 * @param status - Task status to check
 * @returns True if the task is in an error state, false otherwise
 */
export function isErrorStatus(status: TaskStatus): boolean {
  return ERROR_STATUSES.includes(status);
}

/**
 * Check if a task status represents a download operation
 * @param status - Task status to check
 * @returns True if the task is downloading, false otherwise
 */
export function isDownloadStatus(status: TaskStatus): boolean {
  return DOWNLOAD_STATUSES.includes(status);
}

/**
 * Check if a task status represents an upload operation
 * @param status - Task status to check
 * @returns True if the task is uploading, false otherwise
 */
export function isUploadStatus(status: TaskStatus): boolean {
  return UPLOAD_STATUSES.includes(status);
}

/**
 * Check if a task status represents a paused or stopped state
 * @param status - Task status to check
 * @returns True if the task is paused or stopped, false otherwise
 */
export function isInactiveStatus(status: TaskStatus): boolean {
  return INACTIVE_STATUSES.includes(status);
}

/**
 * Normalize a raw status value to the i18n key format
 * Trims whitespace, converts to uppercase, and normalizes separators (spaces/hyphens to underscores)
 * @param status - Raw status string to normalize
 * @returns Normalized status string suitable for i18n keys (e.g., "DOWNLOADING", "PAUSED_DOWNLOAD")
 */
export function normalizeStatusValue(status: string): string {
  return status
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
}

/**
 * Get the i18n translation key for a task status
 * @param status - Task status to get translation key for
 * @returns Translation key string (e.g., "taskStatus.DOWNLOADING")
 */
export function getStatusTranslationKey(status: TaskStatus): string {
  return `taskStatus.${status}`;
}

/**
 * Get the i18n translation key for a task status description
 * Normalizes the input to handle different casings, whitespace, and separators
 * @param status - Task status to get description translation key for
 * @returns Translation key string (e.g., "taskStatusDescription.DOWNLOADING")
 */
export function getStatusDescriptionKey(status: string): string {
  const normalized = normalizeStatusValue(status);
  return `taskStatusDescription.${normalized}`;
}
