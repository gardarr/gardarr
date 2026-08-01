const technicalReleasePatterns = [
  /\b(?:web\s*[-_. ]?\s*dl|web\s*[-_. ]?\s*rip|bluray|blu-ray|brrip|bdrip|dvdrip|hdtv|hdrip|telesync|telecine)\b/gi,
  /\b(?:web|dl)\b(?=\s+(?:\d{3,4}\s*[pi]|x26[45]|h\.?26[45]|hevc|dual|multi))\b/gi,
  /\b(?:2160|1440|1080|720|576|480)\s*[pi]\b/gi,
  /\b(?:4k|8k|uhd|fhd|hd)\b/gi,
  /\b(?:x26[45]|h\.?26[45]|hevc|av1|avc|10bit|8bit)\b/gi,
  /\b(?:dual(?:\s+audio)?|multi(?:\s+audio)?|dubbed|remux|proper|repack|extended|unrated)\b/gi,
  /\b(?:aac|ac3|eac3|ddp?|dts|flac|atmos)\b/gi,
  /\b(?:2\.0|5\.1|7\.1|7\.2)\b/gi,
];

/** Converts a torrent release name into a provider-friendly media title. */
export function sanitizeProviderSearchQuery(value: string): string {
  let sanitized = value.trim();

  for (const pattern of technicalReleasePatterns) {
    sanitized = sanitized.replace(pattern, " ");
  }

  return sanitized
    .replace(/[()[\]{}]/g, " ")
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
