package tagrules

import (
	"errors"
	"fmt"
	"strings"
)

// Mode selects which side of the separator source's derived tags keep fixed.
type Mode string

const (
	// ModePrefix (the default) keeps source's suffix fixed and varies the
	// prefix across values - the original derive behavior.
	ModePrefix Mode = "prefix"
	// ModeSuffix keeps source's prefix fixed and varies the suffix across
	// values.
	ModeSuffix Mode = "suffix"
)

// Derive builds new tag names that reuse one side of source's separator
// while varying the other across values - see gardarr#87. If source already
// has a built-in separator ("::" scoped or ":" grouped, per Parse), that
// separator is reused automatically and delimiter is ignored. Otherwise (a
// plain tag) delimiter must be supplied by the caller to say where the
// prefix/suffix boundary is, matched against source's last occurrence of
// it. mode picks which side is kept from source ("prefix", the default, or
// "suffix").
func Derive(source, delimiter string, values []string, mode Mode) ([]string, error) {
	source = strings.TrimSpace(source)
	if source == "" {
		return nil, errors.New("source is required")
	}
	if mode == "" {
		mode = ModePrefix
	}

	sep, fixed, err := deriveSeparatorAndFixedPart(source, delimiter, mode)
	if err != nil {
		return nil, err
	}
	if fixed == "" {
		if mode == ModeSuffix {
			return nil, errors.New("source has an empty prefix")
		}
		return nil, errors.New("source has an empty suffix")
	}

	result := make([]string, 0, len(values))
	seen := make(map[string]struct{}, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" {
			continue
		}
		var derived string
		if mode == ModeSuffix {
			derived = fixed + sep + value
		} else {
			derived = value + sep + fixed
		}
		if _, exists := seen[derived]; exists {
			continue
		}
		seen[derived] = struct{}{}
		result = append(result, derived)
	}

	if len(result) == 0 {
		return nil, errors.New("at least one value is required")
	}

	return result, nil
}

// deriveSeparatorAndFixedPart returns the separator to reuse and the part of
// source that stays fixed - source's suffix in ModePrefix, source's prefix
// in ModeSuffix.
func deriveSeparatorAndFixedPart(source, delimiter string, mode Mode) (sep, fixed string, err error) {
	parsed := Parse(source)
	switch parsed.Kind {
	case KindScoped:
		sep = "::"
	case KindGrouped:
		sep = ":"
	default:
		if delimiter == "" {
			return "", "", errors.New("delimiter is required to derive from a plain tag")
		}
		idx := strings.LastIndex(source, delimiter)
		if idx < 0 {
			return "", "", fmt.Errorf("delimiter %q not found in tag %q", delimiter, source)
		}
		if mode == ModeSuffix {
			return delimiter, source[:idx], nil
		}
		return delimiter, source[idx+len(delimiter):], nil
	}

	if mode == ModeSuffix {
		return sep, parsed.Key, nil
	}
	return sep, parsed.Value, nil
}
