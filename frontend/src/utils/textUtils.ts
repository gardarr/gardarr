export function truncateText(text: string, maxLength: number = 50): string {
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + "...";
}

export function isTextTruncated(text: string, maxLength: number = 50): boolean {
  if (!text) return false;
  return text.length > maxLength;
}
