package ratelimit

import (
	"fmt"
	"sync"
	"time"
)

// Attempt tracks failed authentication attempts
type Attempt struct {
	Count     int
	FirstTry  time.Time
	BlockedAt time.Time
	IsBlocked bool
}

// Service provides rate limiting functionality
type Service struct {
	attempts map[string]*Attempt
	mu       sync.RWMutex

	// Configuration
	maxAttempts    int
	windowDuration time.Duration
	blockDuration  time.Duration
}

// NewService creates a new rate limiting service
func NewService(maxAttempts int, windowDuration, blockDuration time.Duration) *Service {
	s := &Service{
		attempts:       make(map[string]*Attempt),
		maxAttempts:    maxAttempts,
		windowDuration: windowDuration,
		blockDuration:  blockDuration,
	}

	// Start cleanup goroutine
	go s.cleanup()

	return s
}

// NewDefaultService creates a service with default settings
// 5 attempts per 5 minutes, block for 15 minutes
func NewDefaultService() *Service {
	return NewService(5, 5*time.Minute, 15*time.Minute)
}

// RecordAttempt records a failed authentication attempt
func (s *Service) RecordAttempt(identifier string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	now := time.Now()
	attempt, exists := s.attempts[identifier]

	if !exists {
		// First attempt
		s.attempts[identifier] = &Attempt{
			Count:    1,
			FirstTry: now,
		}
		return
	}

	// Check if window has expired
	if now.Sub(attempt.FirstTry) > s.windowDuration {
		// Reset window
		s.attempts[identifier] = &Attempt{
			Count:    1,
			FirstTry: now,
		}
		return
	}

	// Increment attempt count
	attempt.Count++

	// Check if should be blocked
	if attempt.Count >= s.maxAttempts && !attempt.IsBlocked {
		attempt.IsBlocked = true
		attempt.BlockedAt = now
	}
}

// IsBlocked checks if an identifier is currently blocked
func (s *Service) IsBlocked(identifier string) (bool, time.Duration) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	attempt, exists := s.attempts[identifier]
	if !exists {
		return false, 0
	}

	if !attempt.IsBlocked {
		return false, 0
	}

	// Check if block has expired
	elapsed := time.Since(attempt.BlockedAt)
	if elapsed >= s.blockDuration {
		// Block expired, but we'll clean it up in the cleanup goroutine
		return false, 0
	}

	remaining := s.blockDuration - elapsed
	return true, remaining
}

// Reset removes all attempts for an identifier (e.g., after successful auth)
func (s *Service) Reset(identifier string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.attempts, identifier)
}

// GetAttemptCount returns the current attempt count for an identifier
func (s *Service) GetAttemptCount(identifier string) int {
	s.mu.RLock()
	defer s.mu.RUnlock()

	attempt, exists := s.attempts[identifier]
	if !exists {
		return 0
	}

	// If window expired, return 0
	if time.Since(attempt.FirstTry) > s.windowDuration {
		return 0
	}

	return attempt.Count
}

// cleanup periodically removes expired entries
func (s *Service) cleanup() {
	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		s.mu.Lock()
		now := time.Now()

		for key, attempt := range s.attempts {
			// Remove if window expired and not blocked
			if !attempt.IsBlocked && now.Sub(attempt.FirstTry) > s.windowDuration {
				delete(s.attempts, key)
				continue
			}

			// Remove if block expired
			if attempt.IsBlocked && now.Sub(attempt.BlockedAt) > s.blockDuration {
				delete(s.attempts, key)
			}
		}

		s.mu.Unlock()
	}
}

// GetIdentifier creates a unique identifier for rate limiting
// Can be based on IP, IP+UserAgent, or other factors
func GetIdentifier(ip, userAgent string) string {
	return fmt.Sprintf("%s:%s", ip, userAgent)
}

// GetStats returns current rate limiting statistics
func (s *Service) GetStats() map[string]interface{} {
	s.mu.RLock()
	defer s.mu.RUnlock()

	totalBlocked := 0
	totalAttempts := 0

	for _, attempt := range s.attempts {
		totalAttempts++
		if attempt.IsBlocked {
			totalBlocked++
		}
	}

	return map[string]interface{}{
		"total_tracked":  totalAttempts,
		"total_blocked":  totalBlocked,
		"max_attempts":   s.maxAttempts,
		"window_minutes": s.windowDuration.Minutes(),
		"block_minutes":  s.blockDuration.Minutes(),
	}
}
