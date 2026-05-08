package worker

import (
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/jfxdev/gardarr/internal/constants"
	"github.com/jfxdev/gardarr/internal/infra/database"
	"github.com/jfxdev/gardarr/internal/services/crypto"
)

func TestRepositoryTimeout(t *testing.T) {
	// Mock database and crypto service
	db := &database.Database{}
	cryptoService := &crypto.CryptoService{}

	// Test with default timeout
	repo, err := NewRepository(db, cryptoService)
	if err != nil {
		t.Fatalf("Failed to create repository: %v", err)
	}

	// Verify default timeout is set
	expectedTimeout := time.Duration(constants.DefaultWorkerTimeoutSeconds) * time.Second
	if repo.http.Timeout != expectedTimeout {
		t.Errorf("Expected timeout %v, got %v", expectedTimeout, repo.http.Timeout)
	}
}

func TestRepositoryTimeoutWithEnvironmentVariable(t *testing.T) {
	// Set environment variable
	originalValue := os.Getenv(constants.WorkerTimeoutSecondsEnv)
	defer func() {
		// Restore original value
		if originalValue != "" {
			os.Setenv(constants.WorkerTimeoutSecondsEnv, originalValue)
		} else {
			os.Unsetenv(constants.WorkerTimeoutSecondsEnv)
		}
	}()

	// Test with custom timeout
	os.Setenv(constants.WorkerTimeoutSecondsEnv, "10")

	db := &database.Database{}
	cryptoService := &crypto.CryptoService{}

	repo, err := NewRepository(db, cryptoService)
	if err != nil {
		t.Fatalf("Failed to create repository: %v", err)
	}

	// Verify custom timeout is set
	expectedTimeout := 10 * time.Second
	if repo.http.Timeout != expectedTimeout {
		t.Errorf("Expected timeout %v, got %v", expectedTimeout, repo.http.Timeout)
	}
}

func TestRepositoryTimeoutWithInvalidEnvironmentVariable(t *testing.T) {
	// Set invalid environment variable
	originalValue := os.Getenv(constants.WorkerTimeoutSecondsEnv)
	defer func() {
		// Restore original value
		if originalValue != "" {
			os.Setenv(constants.WorkerTimeoutSecondsEnv, originalValue)
		} else {
			os.Unsetenv(constants.WorkerTimeoutSecondsEnv)
		}
	}()

	// Test with invalid timeout (should fallback to default)
	os.Setenv(constants.WorkerTimeoutSecondsEnv, "invalid")

	db := &database.Database{}
	cryptoService := &crypto.CryptoService{}

	repo, err := NewRepository(db, cryptoService)
	if err != nil {
		t.Fatalf("Failed to create repository: %v", err)
	}

	// Verify default timeout is used when invalid value is provided
	expectedTimeout := time.Duration(constants.DefaultWorkerTimeoutSeconds) * time.Second
	if repo.http.Timeout != expectedTimeout {
		t.Errorf("Expected timeout %v, got %v", expectedTimeout, repo.http.Timeout)
	}
}

func TestRepositoryTimeoutWithZeroEnvironmentVariable(t *testing.T) {
	// Set zero timeout (should fallback to default)
	originalValue := os.Getenv(constants.WorkerTimeoutSecondsEnv)
	defer func() {
		// Restore original value
		if originalValue != "" {
			os.Setenv(constants.WorkerTimeoutSecondsEnv, originalValue)
		} else {
			os.Unsetenv(constants.WorkerTimeoutSecondsEnv)
		}
	}()

	// Test with zero timeout (should fallback to default)
	os.Setenv(constants.WorkerTimeoutSecondsEnv, "0")

	db := &database.Database{}
	cryptoService := &crypto.CryptoService{}

	repo, err := NewRepository(db, cryptoService)
	if err != nil {
		t.Fatalf("Failed to create repository: %v", err)
	}

	// Verify default timeout is used when zero value is provided
	expectedTimeout := time.Duration(constants.DefaultWorkerTimeoutSeconds) * time.Second
	if repo.http.Timeout != expectedTimeout {
		t.Errorf("Expected timeout %v, got %v", expectedTimeout, repo.http.Timeout)
	}
}

func TestRepositoryTimeoutBehavior(t *testing.T) {
	// Create a test server that responds after 10 seconds
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(10 * time.Second)
		w.WriteHeader(http.StatusOK)
		if _, err := w.Write([]byte("{}")); err != nil {
			// best effort in test handler
			http.Error(w, err.Error(), http.StatusInternalServerError)
		}
	}))
	defer server.Close()

	// Create repository with 2 second timeout
	os.Setenv(constants.WorkerTimeoutSecondsEnv, "2")
	defer os.Unsetenv(constants.WorkerTimeoutSecondsEnv)

	db := &database.Database{}
	cryptoService := &crypto.CryptoService{}

	repo, err := NewRepository(db, cryptoService)
	if err != nil {
		t.Fatalf("Failed to create repository: %v", err)
	}

	// Test that request times out
	start := time.Now()
	req, err := http.NewRequest("GET", server.URL, nil)
	if err != nil {
		t.Fatalf("Failed to create request: %v", err)
	}

	_, err = repo.http.Do(req)
	duration := time.Since(start)

	if err == nil {
		t.Error("Expected request to timeout, but it succeeded")
	}

	// Verify timeout occurred within reasonable time (should be around 2 seconds)
	if duration < 1*time.Second || duration > 5*time.Second {
		t.Errorf("Expected timeout around 2 seconds, but took %v", duration)
	}
}
