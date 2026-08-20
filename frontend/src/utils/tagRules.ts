// TypeScript mirror of backend/internal/tagrules/tagrules.go (see
// gardarr#87). Both are exercised against the same fixture at
// tests/testdata/tag_rules.json so the two can't silently drift apart.

/** Zero value is "plain". */
export type TagKind = "plain" | "grouped" | "scoped";

export interface ParsedTag {
  kind: TagKind;
  /** Scope/group name. Empty unless kind is "grouped" or "scoped". */
  key: string;
  /** Part after the separator for "grouped"/"scoped", or the full trimmed tag for "plain". */
  value: string;
  /** Tag name with surrounding whitespace trimmed. */
  raw: string;
}

/**
 * Classifies a tag name. Precedence is not optional: "::" is tested before
 * ":", and only the first occurrence is split on - "a::b::c" yields key
 * "a", value "b::c", not a further split of the remainder. A "::" or ":"
 * with nothing on one side (e.g. "::x", "x::") is not a valid key/value
 * pair and falls back to "plain" with the tag left intact.
 */
export function parseTag(tag: string): ParsedTag {
  const raw = tag.trim();

  if (raw.includes("::")) {
    const split = splitOnce(raw, "::");
    if (split) {
      return { kind: "scoped", key: split.key, value: split.value, raw };
    }
    return { kind: "plain", key: "", value: raw, raw };
  }

  const split = splitOnce(raw, ":");
  if (split) {
    return { kind: "grouped", key: split.key, value: split.value, raw };
  }

  return { kind: "plain", key: "", value: raw, raw };
}

/** Returns the scope key of a "scoped" tag, or null for anything else. */
export function scopeOf(tag: string): string | null {
  const parsed = parseTag(tag);
  return parsed.kind === "scoped" ? parsed.key : null;
}

function splitOnce(raw: string, sep: string): { key: string; value: string } | null {
  const idx = raw.indexOf(sep);
  if (idx < 0) return null;

  const key = raw.slice(0, idx).trim();
  const value = raw.slice(idx + sep.length).trim();
  if (!key || !value) return null;

  return { key, value };
}
