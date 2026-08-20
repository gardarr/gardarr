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

/** Zero value is "prefix". */
export type DeriveMode = "prefix" | "suffix";

/**
 * Builds new tag names that reuse one side of source's separator while
 * varying the other across values. If source already has a built-in
 * separator ("::" scoped or ":" grouped, per parseTag), that separator is
 * reused automatically and delimiter is ignored. Otherwise (a plain tag)
 * delimiter must be supplied by the caller to say where the prefix/suffix
 * boundary is, matched against source's last occurrence of it. mode picks
 * which side is kept from source ("prefix", the default, or "suffix").
 * Throws on invalid input (empty source, a plain source without a usable
 * delimiter, or zero resulting values).
 */
export function deriveTags(
  source: string,
  delimiter: string,
  values: string[],
  mode: DeriveMode = "prefix",
): string[] {
  const trimmedSource = source.trim();
  if (!trimmedSource) {
    throw new Error("source is required");
  }

  const { sep, fixed } = deriveSeparatorAndFixedPart(trimmedSource, delimiter, mode);
  if (!fixed) {
    throw new Error(mode === "suffix" ? "source has an empty prefix" : "source has an empty suffix");
  }

  const seen = new Set<string>();
  const result: string[] = [];
  for (const rawValue of values) {
    const value = rawValue.trim();
    if (!value) continue;
    const derived = mode === "suffix" ? fixed + sep + value : value + sep + fixed;
    if (seen.has(derived)) continue;
    seen.add(derived);
    result.push(derived);
  }

  if (result.length === 0) {
    throw new Error("at least one value is required");
  }

  return result;
}

function deriveSeparatorAndFixedPart(
  source: string,
  delimiter: string,
  mode: DeriveMode,
): { sep: string; fixed: string } {
  const parsed = parseTag(source);
  if (parsed.kind === "scoped") {
    return { sep: "::", fixed: mode === "suffix" ? parsed.key : parsed.value };
  }
  if (parsed.kind === "grouped") {
    return { sep: ":", fixed: mode === "suffix" ? parsed.key : parsed.value };
  }

  if (!delimiter) {
    throw new Error("delimiter is required to derive from a plain tag");
  }
  const idx = source.lastIndexOf(delimiter);
  if (idx < 0) {
    throw new Error(`delimiter "${delimiter}" not found in tag "${source}"`);
  }
  const fixed = mode === "suffix" ? source.slice(0, idx) : source.slice(idx + delimiter.length);
  return { sep: delimiter, fixed };
}

function splitOnce(raw: string, sep: string): { key: string; value: string } | null {
  const idx = raw.indexOf(sep);
  if (idx < 0) return null;

  const key = raw.slice(0, idx).trim();
  const value = raw.slice(idx + sep.length).trim();
  if (!key || !value) return null;

  return { key, value };
}
