package statistics

import (
	"bufio"
	"compress/gzip"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"
)

// SnapshotLine is the compact JSON payload we persist per observation
type SnapshotLine struct {
	TS   time.Time `json:"ts"`       // RFC3339
	Task string    `json:"task"`     // task hash
	St   string    `json:"st"`       // state (normalized)
	P01  int       `json:"p01"`      // progress * 100 (0..10000)
	R1e4 int       `json:"r1e4"`     // ratio * 10000
	DlKB int       `json:"dl_kbs"`   // download speed in KB/s
	UlKB int       `json:"ul_kbs"`   // upload speed in KB/s
	Sd   int16     `json:"seed"`     // seeders
	Lc   int16     `json:"leech"`    // leechers
	DlB  int64     `json:"dl_bytes"` // downloaded amount bytes
	UlB  int64     `json:"ul_bytes"` // uploaded amount bytes
}

// FileWriter manages a single gzip-compressed JSONL file
type FileWriter struct {
	mu    sync.Mutex
	f     *os.File
	gz    *gzip.Writer
	bw    *bufio.Writer
	path  string
	lines int64
	size  int64
}

// OpenDaily opens or creates the daily file for agent and date
func (w *FileWriter) OpenDaily(baseDir, agentID string, date time.Time) error {
	w.mu.Lock()
	defer w.mu.Unlock()

	if w.f != nil {
		return nil
	}

	yyyy := date.UTC().Format("2006")
	mm := date.UTC().Format("01")
	dir := filepath.Join(baseDir, yyyy, mm, agentID)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}

	w.path = filepath.Join(dir, fmt.Sprintf("%s-%s.jsonl.gz", agentID, date.UTC().Format("2006-01-02")))
	f, err := os.OpenFile(w.path, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644)
	if err != nil {
		return err
	}
	w.f = f
	w.gz = gzip.NewWriter(f)
	w.bw = bufio.NewWriterSize(w.gz, 64*1024)
	return nil
}

// WriteLine writes a single JSON line (thread-safe)
func (w *FileWriter) WriteLine(line SnapshotLine) error {
	w.mu.Lock()
	defer w.mu.Unlock()
	if w.bw == nil {
		return fmt.Errorf("writer not opened")
	}
	b, err := json.Marshal(line)
	if err != nil {
		return err
	}
	if _, err := w.bw.Write(b); err != nil {
		return err
	}
	if err := w.bw.WriteByte('\n'); err != nil {
		return err
	}
	w.lines++
	w.size += int64(len(b) + 1)
	return nil
}

// Flush ensures buffers are flushed to disk
func (w *FileWriter) Flush() error {
	w.mu.Lock()
	defer w.mu.Unlock()
	if w.bw != nil {
		if err := w.bw.Flush(); err != nil {
			return err
		}
	}
	if w.gz != nil {
		if err := w.gz.Flush(); err != nil {
			return err
		}
	}
	return nil
}

// Close closes all writers and the file
func (w *FileWriter) Close() error {
	w.mu.Lock()
	defer w.mu.Unlock()
	var err error
	setErr := func(e error) {
		if e != nil && err == nil {
			err = e
		}
	}
	if w.bw != nil {
		setErr(w.bw.Flush())
		w.bw = nil
	}
	if w.gz != nil {
		setErr(w.gz.Close())
		w.gz = nil
	}
	if w.f != nil {
		setErr(w.f.Close())
		w.f = nil
	}
	return err
}

func (w *FileWriter) Path() string { return w.path }
func (w *FileWriter) Lines() int64 { return w.lines }
func (w *FileWriter) Size() int64  { return w.size }
