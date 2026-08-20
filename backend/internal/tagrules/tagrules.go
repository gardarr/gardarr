// Package tagrules parses qBittorrent tag names into Gardarr's composite
// tag semantics (see gardarr#87). It has no dependency on the rest of the
// codebase so it stays trivial to keep in lockstep with its TypeScript
// mirror in frontend/src/utils/tagRules.ts; both are exercised against the
// same fixture at tests/testdata/tag_rules.json so the two can't silently
// drift apart.
package tagrules

import "strings"

// Kind classifies a parsed tag. The zero value is KindPlain.
type Kind string

const (
	// KindPlain is an ordinary tag with no key/value structure.
	KindPlain Kind = "plain"
	// KindGrouped is a "key:value" tag: hierarchical for display and
	// filtering, but not mutually exclusive - a torrent may hold several
	// values under the same key.
	KindGrouped Kind = "grouped"
	// KindScoped is a "key::value" tag with GitLab scoped-label semantics:
	// mutually exclusive within key, so applying a new value replaces
	// whatever the torrent already holds for that key.
	KindScoped Kind = "scoped"
)

// Parsed is the result of parsing a single tag name.
type Parsed struct {
	Kind Kind
	// Key is the scope/group name. Empty unless Kind is KindGrouped or
	// KindScoped.
	Key string
	// Value is the tag's value: the part after the separator for
	// KindGrouped/KindScoped, or the full trimmed tag for KindPlain.
	Value string
	// Raw is the tag name with surrounding whitespace trimmed.
	Raw string
}

// Parse classifies a tag name. Precedence is not optional: "::" is tested
// before ":", and only the first occurrence is split on - "a::b::c" yields
// Key "a", Value "b::c", not a further split of the remainder. A "::" or
// ":" with nothing on one side (e.g. "::x", "x::") is not a valid
// key/value pair and falls back to KindPlain with the tag left intact.
func Parse(tag string) Parsed {
	raw := strings.TrimSpace(tag)

	if strings.Contains(raw, "::") {
		if key, value, ok := splitOnce(raw, "::"); ok {
			return Parsed{Kind: KindScoped, Key: key, Value: value, Raw: raw}
		}
		return Parsed{Kind: KindPlain, Value: raw, Raw: raw}
	}

	if key, value, ok := splitOnce(raw, ":"); ok {
		return Parsed{Kind: KindGrouped, Key: key, Value: value, Raw: raw}
	}

	return Parsed{Kind: KindPlain, Value: raw, Raw: raw}
}

// ScopeOf returns the scope key of a KindScoped tag, or "" and false for
// anything else.
func ScopeOf(tag string) (string, bool) {
	parsed := Parse(tag)
	if parsed.Kind != KindScoped {
		return "", false
	}
	return parsed.Key, true
}

func splitOnce(raw, sep string) (key, value string, ok bool) {
	idx := strings.Index(raw, sep)
	if idx < 0 {
		return "", "", false
	}

	key = strings.TrimSpace(raw[:idx])
	value = strings.TrimSpace(raw[idx+len(sep):])
	if key == "" || value == "" {
		return "", "", false
	}

	return key, value, true
}
