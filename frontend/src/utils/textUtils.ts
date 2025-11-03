export function truncateText(text: string, maxLength: number = 50): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength) + "...";
}

export function isTextTruncated(text: string, maxLength: number = 50): boolean {
  return text.length > maxLength;
}

