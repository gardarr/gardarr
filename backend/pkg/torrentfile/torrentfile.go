// Package torrentfile extracts the info-hash from raw .torrent file bytes.
//
// A .torrent file is a bencoded dictionary; its v1 info-hash is the SHA-1 of
// the exact bencoded bytes of the top-level "info" value. Only enough of a
// bencode parser to locate and span that value is implemented here, which
// avoids pulling a full torrent library in as a dependency.
package torrentfile

import (
	"crypto/sha1"
	"encoding/hex"
	"fmt"
)

// InfoHash returns the lowercase hex v1 info-hash of a .torrent file.
func InfoHash(data []byte) (string, error) {
	if len(data) == 0 || data[0] != 'd' {
		return "", fmt.Errorf("invalid torrent file: not a bencoded dictionary")
	}

	pos := 1 // skip top-level 'd'
	for pos < len(data) && data[pos] != 'e' {
		key, next, err := parseString(data, pos)
		if err != nil {
			return "", fmt.Errorf("invalid torrent file: %w", err)
		}

		valueStart := next
		valueEnd, err := skipValue(data, valueStart)
		if err != nil {
			return "", fmt.Errorf("invalid torrent file: %w", err)
		}

		if string(key) == "info" {
			sum := sha1.Sum(data[valueStart:valueEnd])
			return hex.EncodeToString(sum[:]), nil
		}

		pos = valueEnd
	}

	return "", fmt.Errorf("invalid torrent file: missing info dictionary")
}

// parseString parses a bencoded string ("<len>:<bytes>") starting at pos and
// returns its bytes plus the position right after it.
func parseString(data []byte, pos int) ([]byte, int, error) {
	length := 0
	i := pos
	for ; i < len(data) && data[i] != ':'; i++ {
		if data[i] < '0' || data[i] > '9' {
			return nil, 0, fmt.Errorf("malformed string length at offset %d", pos)
		}
		length = length*10 + int(data[i]-'0')
		if length > len(data) {
			return nil, 0, fmt.Errorf("string length out of bounds at offset %d", pos)
		}
	}
	if i >= len(data) {
		return nil, 0, fmt.Errorf("unterminated string at offset %d", pos)
	}
	start := i + 1
	end := start + length
	if end > len(data) {
		return nil, 0, fmt.Errorf("string exceeds input at offset %d", pos)
	}
	return data[start:end], end, nil
}

// skipValue returns the position right after the bencoded value at pos.
func skipValue(data []byte, pos int) (int, error) {
	if pos >= len(data) {
		return 0, fmt.Errorf("unexpected end of input at offset %d", pos)
	}

	switch {
	case data[pos] == 'i': // integer: i<digits>e
		for i := pos + 1; i < len(data); i++ {
			if data[i] == 'e' {
				return i + 1, nil
			}
		}
		return 0, fmt.Errorf("unterminated integer at offset %d", pos)
	case data[pos] == 'l' || data[pos] == 'd': // list/dict: elements until 'e'
		i := pos + 1
		for i < len(data) && data[i] != 'e' {
			next, err := skipValue(data, i)
			if err != nil {
				return 0, err
			}
			i = next
		}
		if i >= len(data) {
			return 0, fmt.Errorf("unterminated container at offset %d", pos)
		}
		return i + 1, nil
	case data[pos] >= '0' && data[pos] <= '9': // string
		_, next, err := parseString(data, pos)
		return next, err
	default:
		return 0, fmt.Errorf("unknown bencode type %q at offset %d", data[pos], pos)
	}
}
