// Package torrentfile extracts info-hashes from raw .torrent file bytes.
//
// A .torrent file is a bencoded dictionary. Its v1 info-hash is the SHA-1 of
// the exact bencoded bytes of the top-level "info" value; BitTorrent v2 uses
// SHA-256 over the same span. Only enough of a bencode parser to locate and
// inspect that value is implemented here, which avoids pulling a full torrent
// library in as a dependency.
package torrentfile

import (
	"crypto/sha1"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strings"
)

// InfoHash returns the lowercase hex v1 info-hash of a .torrent file.
func InfoHash(data []byte) (string, error) {
	hashes, err := InfoHashes(data)
	if err != nil {
		return "", err
	}
	return hashes[0], nil
}

// InfoHashes returns the lowercase hex info-hashes that qBittorrent may expose
// for this torrent. v1 and hybrid torrents include the v1 SHA-1 hash first; v2
// torrents also include the v2 SHA-256 hash so callers can find v2-only uploads.
func InfoHashes(data []byte) ([]string, error) {
	if len(data) == 0 || data[0] != 'd' {
		return nil, fmt.Errorf("invalid torrent file: not a bencoded dictionary")
	}

	pos := 1 // skip top-level 'd'
	for pos < len(data) && data[pos] != 'e' {
		key, next, err := parseString(data, pos)
		if err != nil {
			return nil, fmt.Errorf("invalid torrent file: %w", err)
		}

		valueStart := next
		valueEnd, err := skipValue(data, valueStart)
		if err != nil {
			return nil, fmt.Errorf("invalid torrent file: %w", err)
		}

		if string(key) == "info" {
			info := data[valueStart:valueEnd]
			v1Sum := sha1.Sum(info) // NOSONAR go:S4790 -- BitTorrent v1 info-hash is defined by the protocol as SHA-1, not a sensitive-context digest
			hashes := []string{hex.EncodeToString(v1Sum[:])}
			if isV2Info(info) {
				v2Sum := sha256.Sum256(info)
				hashes = append(hashes, hex.EncodeToString(v2Sum[:]))
			}
			return hashes, nil
		}

		pos = valueEnd
	}

	return nil, fmt.Errorf("invalid torrent file: missing info dictionary")
}

// InfoName returns the name stored in a torrent's info dictionary. It is used
// only for pre-submit suggestions; it does not alter the torrent payload.
func InfoName(data []byte) (string, error) {
	info, err := infoDictionary(data)
	if err != nil {
		return "", err
	}
	if len(info) == 0 || info[0] != 'd' {
		return "", fmt.Errorf("invalid torrent file: info is not a dictionary")
	}
	pos := 1
	for pos < len(info) && info[pos] != 'e' {
		key, next, err := parseString(info, pos)
		if err != nil {
			return "", fmt.Errorf("invalid torrent file: %w", err)
		}
		if string(key) == "name" {
			name, _, err := parseString(info, next)
			if err != nil {
				return "", fmt.Errorf("invalid torrent file: %w", err)
			}
			return string(name), nil
		}
		pos, err = skipValue(info, next)
		if err != nil {
			return "", fmt.Errorf("invalid torrent file: %w", err)
		}
	}
	return "", fmt.Errorf("invalid torrent file: missing info name")
}

func infoDictionary(data []byte) ([]byte, error) {
	if len(data) == 0 || data[0] != 'd' {
		return nil, fmt.Errorf("invalid torrent file: not a bencoded dictionary")
	}
	pos := 1
	for pos < len(data) && data[pos] != 'e' {
		key, next, err := parseString(data, pos)
		if err != nil {
			return nil, fmt.Errorf("invalid torrent file: %w", err)
		}
		valueEnd, err := skipValue(data, next)
		if err != nil {
			return nil, fmt.Errorf("invalid torrent file: %w", err)
		}
		if string(key) == "info" {
			return data[next:valueEnd], nil
		}
		pos = valueEnd
	}
	return nil, fmt.Errorf("invalid torrent file: missing info dictionary")
}

// MatchesInfoHash reports whether any candidate equals one of the hashes
// returned by InfoHashes. Callers should pass a torrent's InfoHashV1 and
// InfoHashV2 fields (not its legacy Hash/TorrentID field, which qBittorrent
// truncates to 20 bytes for v2 and hybrid torrents and would never match the
// untruncated v2 SHA-256 hashes InfoHashes returns). Empty candidates are
// ignored since qBittorrent leaves the unused v1/v2 field blank. Comparison
// is case-insensitive to match the existing magnet dedupe behavior.
func MatchesInfoHash(hashes []string, candidates ...string) bool {
	for _, candidate := range candidates {
		if candidate == "" {
			continue
		}
		for _, hash := range hashes {
			if strings.EqualFold(candidate, hash) {
				return true
			}
		}
	}
	return false
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

func parseInt(data []byte, pos int) (int, int, error) {
	if pos >= len(data) || data[pos] != 'i' {
		return 0, 0, fmt.Errorf("expected integer at offset %d", pos)
	}

	sign := 1
	value := 0
	i := pos + 1
	if i < len(data) && data[i] == '-' {
		sign = -1
		i++
	}
	if i >= len(data) || data[i] < '0' || data[i] > '9' {
		return 0, 0, fmt.Errorf("malformed integer at offset %d", pos)
	}

	for ; i < len(data) && data[i] != 'e'; i++ {
		if data[i] < '0' || data[i] > '9' {
			return 0, 0, fmt.Errorf("malformed integer at offset %d", pos)
		}
		value = value*10 + int(data[i]-'0')
	}
	if i >= len(data) {
		return 0, 0, fmt.Errorf("unterminated integer at offset %d", pos)
	}

	return sign * value, i + 1, nil
}

func isV2Info(info []byte) bool {
	if len(info) == 0 || info[0] != 'd' {
		return false
	}

	pos := 1
	for pos < len(info) && info[pos] != 'e' {
		key, next, err := parseString(info, pos)
		if err != nil {
			return false
		}

		valueStart := next
		valueEnd, err := skipValue(info, valueStart)
		if err != nil {
			return false
		}

		if string(key) == "meta version" {
			version, _, err := parseInt(info, valueStart)
			return err == nil && version == 2
		}

		pos = valueEnd
	}

	return false
}

// skipValue returns the position right after the bencoded value at pos.
func skipValue(data []byte, pos int) (int, error) {
	if pos >= len(data) {
		return 0, fmt.Errorf("unexpected end of input at offset %d", pos)
	}

	switch {
	case data[pos] == 'i': // integer: i<digits>e
		_, next, err := parseInt(data, pos)
		return next, err
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
