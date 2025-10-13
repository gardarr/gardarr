package ratelimit

import (
	"testing"
	"time"
)

func TestRecordAttempt(t *testing.T) {
	service := NewService(3, 1*time.Minute, 5*time.Minute)
	identifier := "192.168.1.1:Mozilla"

	// First attempt
	service.RecordAttempt(identifier)
	count := service.GetAttemptCount(identifier)
	if count != 1 {
		t.Errorf("expected 1 attempt but got %d", count)
	}

	// Second attempt
	service.RecordAttempt(identifier)
	count = service.GetAttemptCount(identifier)
	if count != 2 {
		t.Errorf("expected 2 attempts but got %d", count)
	}

	// Third attempt - should trigger block
	service.RecordAttempt(identifier)
	blocked, _ := service.IsBlocked(identifier)
	if !blocked {
		t.Error("expected identifier to be blocked after max attempts")
	}
}

func TestIsBlocked(t *testing.T) {
	service := NewService(2, 1*time.Minute, 100*time.Millisecond)
	identifier := "192.168.1.1:Mozilla"

	// Initially not blocked
	blocked, _ := service.IsBlocked(identifier)
	if blocked {
		t.Error("expected identifier to not be blocked initially")
	}

	// Record attempts until blocked
	service.RecordAttempt(identifier)
	service.RecordAttempt(identifier)

	blocked, remaining := service.IsBlocked(identifier)
	if !blocked {
		t.Error("expected identifier to be blocked")
	}

	if remaining <= 0 {
		t.Error("expected positive remaining time")
	}

	// Wait for block to expire
	time.Sleep(150 * time.Millisecond)

	blocked, _ = service.IsBlocked(identifier)
	if blocked {
		t.Error("expected block to have expired")
	}
}

func TestReset(t *testing.T) {
	service := NewService(3, 1*time.Minute, 5*time.Minute)
	identifier := "192.168.1.1:Mozilla"

	// Record attempts
	service.RecordAttempt(identifier)
	service.RecordAttempt(identifier)

	count := service.GetAttemptCount(identifier)
	if count != 2 {
		t.Errorf("expected 2 attempts but got %d", count)
	}

	// Reset
	service.Reset(identifier)

	count = service.GetAttemptCount(identifier)
	if count != 0 {
		t.Errorf("expected 0 attempts after reset but got %d", count)
	}
}

func TestWindowExpiry(t *testing.T) {
	service := NewService(3, 100*time.Millisecond, 5*time.Minute)
	identifier := "192.168.1.1:Mozilla"

	// Record attempt
	service.RecordAttempt(identifier)
	count := service.GetAttemptCount(identifier)
	if count != 1 {
		t.Errorf("expected 1 attempt but got %d", count)
	}

	// Wait for window to expire
	time.Sleep(150 * time.Millisecond)

	count = service.GetAttemptCount(identifier)
	if count != 0 {
		t.Errorf("expected 0 attempts after window expiry but got %d", count)
	}

	// New attempt should start fresh window
	service.RecordAttempt(identifier)
	count = service.GetAttemptCount(identifier)
	if count != 1 {
		t.Errorf("expected 1 attempt in new window but got %d", count)
	}
}

func TestGetIdentifier(t *testing.T) {
	ip := "192.168.1.1"
	userAgent := "Mozilla/5.0"

	id := GetIdentifier(ip, userAgent)
	expected := "192.168.1.1:Mozilla/5.0"

	if id != expected {
		t.Errorf("expected identifier '%s' but got '%s'", expected, id)
	}
}

func TestGetStats(t *testing.T) {
	service := NewService(3, 1*time.Minute, 5*time.Minute)

	// Record some attempts
	service.RecordAttempt("user1")
	service.RecordAttempt("user2")
	service.RecordAttempt("user2")
	service.RecordAttempt("user2") // This should block user2

	stats := service.GetStats()

	if stats["total_tracked"] != 2 {
		t.Errorf("expected 2 tracked users but got %v", stats["total_tracked"])
	}

	if stats["total_blocked"] != 1 {
		t.Errorf("expected 1 blocked user but got %v", stats["total_blocked"])
	}
}

func TestConcurrentAccess(t *testing.T) {
	service := NewService(10, 1*time.Minute, 5*time.Minute)
	identifier := "192.168.1.1:Mozilla"

	done := make(chan bool)

	// Simulate concurrent attempts
	for i := 0; i < 5; i++ {
		go func() {
			for j := 0; j < 10; j++ {
				service.RecordAttempt(identifier)
			}
			done <- true
		}()
	}

	// Wait for all goroutines
	for i := 0; i < 5; i++ {
		<-done
	}

	// Should not panic, and count should be consistent
	count := service.GetAttemptCount(identifier)
	if count != 50 {
		t.Errorf("expected 50 attempts but got %d", count)
	}
}
