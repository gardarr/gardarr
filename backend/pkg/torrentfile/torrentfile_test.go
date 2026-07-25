package torrentfile

import (
	"crypto/sha1"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"testing"
)

func TestInfoHash(t *testing.T) {
	info := "d6:lengthi1024e4:name8:test.iso12:piece lengthi16384e6:pieces20:aaaaaaaaaaaaaaaaaaaae"
	torrent := []byte(fmt.Sprintf("d8:announce30:http://tracker.example.com/ann4:info%se", info))

	expected := sha1.Sum([]byte(info))

	hash, err := InfoHash(torrent)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if hash != hex.EncodeToString(expected[:]) {
		t.Errorf("expected %s, got %s", hex.EncodeToString(expected[:]), hash)
	}
}

func TestInfoHashesIncludesV2Hash(t *testing.T) {
	info := "d9:file treede4:name8:test.iso12:piece lengthi16384e12:meta versioni2ee"
	torrent := []byte(fmt.Sprintf("d8:announce30:http://tracker.example.com/ann4:info%se", info))

	expectedV1 := sha1.Sum([]byte(info))
	expectedV2 := sha256.Sum256([]byte(info))

	hashes, err := InfoHashes(torrent)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(hashes) != 2 {
		t.Fatalf("expected v1 and v2 hashes, got %v", hashes)
	}
	if hashes[0] != hex.EncodeToString(expectedV1[:]) {
		t.Errorf("expected v1 %s, got %s", hex.EncodeToString(expectedV1[:]), hashes[0])
	}
	if hashes[1] != hex.EncodeToString(expectedV2[:]) {
		t.Errorf("expected v2 %s, got %s", hex.EncodeToString(expectedV2[:]), hashes[1])
	}
}

func TestInfoHashSkipsNestedStructures(t *testing.T) {
	// announce-list is a list of lists; creation date is an integer — both
	// must be skipped correctly before reaching info.
	info := "d4:name4:testi5e3:fooe"
	torrent := []byte(fmt.Sprintf("d13:announce-listll20:http://a.example/annee13:creation datei1700000000e4:info%se", info))

	expected := sha1.Sum([]byte(info))

	hash, err := InfoHash(torrent)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if hash != hex.EncodeToString(expected[:]) {
		t.Errorf("expected %s, got %s", hex.EncodeToString(expected[:]), hash)
	}
}

func TestInfoHashErrors(t *testing.T) {
	tests := []struct {
		name string
		data []byte
	}{
		{"empty", nil},
		{"not a dict", []byte("4:spam")},
		{"missing info", []byte("d8:announce4:spame")},
		{"truncated", []byte("d4:info")},
		{"malformed length", []byte("dx:infoe")},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if _, err := InfoHash(tt.data); err == nil {
				t.Error("expected error, got nil")
			}
		})
	}
}
