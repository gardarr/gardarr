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

func TestInfoName(t *testing.T) {
	info := "d6:lengthi1024e4:name21:The.Matrix.1999.1080pe"
	torrent := []byte(fmt.Sprintf("d8:announce4:test4:info%se", info))
	name, err := InfoName(torrent)
	if err != nil {
		t.Fatalf("InfoName() error = %v", err)
	}
	if name != "The.Matrix.1999.1080p" {
		t.Fatalf("InfoName() = %q", name)
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

func TestFileExtensionsSingleFile(t *testing.T) {
	info := "d6:lengthi1024e4:name8:test.isoe"
	torrent := []byte(fmt.Sprintf("d8:announce4:test4:info%se", info))

	extensions, err := FileExtensions(torrent)
	if err != nil {
		t.Fatalf("FileExtensions() error = %v", err)
	}
	if len(extensions) != 1 || extensions[0] != "iso" {
		t.Fatalf("FileExtensions() = %v, want [iso]", extensions)
	}
}

func TestFileExtensionsMultiFile(t *testing.T) {
	info := "d4:name5:books5:filesl" +
		"d6:lengthi100e4:pathl10:book1.epubee" +
		"d6:lengthi200e4:pathl6:images9:cover.jpgee" +
		"ee"
	torrent := []byte(fmt.Sprintf("d8:announce4:test4:info%se", info))

	extensions, err := FileExtensions(torrent)
	if err != nil {
		t.Fatalf("FileExtensions() error = %v", err)
	}
	if len(extensions) != 2 || extensions[0] != "epub" || extensions[1] != "jpg" {
		t.Fatalf("FileExtensions() = %v, want [epub jpg]", extensions)
	}
}

func TestFileExtensionsMultiFileIgnoresDottedFolderName(t *testing.T) {
	// The top-level "name" is the shared payload folder for a multi-file
	// torrent, not a filename — a dot in the folder name (e.g. a season
	// pack named "Season.1.Complete") must not be counted as a file
	// extension alongside the real per-file extensions.
	info := "d4:name13:Season.1.Comp5:filesl" +
		"d6:lengthi100e4:pathl8:ep01.mkvee" +
		"d6:lengthi100e4:pathl8:ep02.mkvee" +
		"ee"
	torrent := []byte(fmt.Sprintf("d8:announce4:test4:info%se", info))

	extensions, err := FileExtensions(torrent)
	if err != nil {
		t.Fatalf("FileExtensions() error = %v", err)
	}
	if len(extensions) != 2 || extensions[0] != "mkv" || extensions[1] != "mkv" {
		t.Fatalf("FileExtensions() = %v, want [mkv mkv] (folder name extension must be excluded)", extensions)
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
