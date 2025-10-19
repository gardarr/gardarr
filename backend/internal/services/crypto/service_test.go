package crypto

import (
	"encoding/base64"
	"os"
	"testing"
)

// Test encryption key for testing purposes (32 bytes for AES-256)
const testEncryptionKey = "MTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTI="

func setupTestCryptoService(t *testing.T) *CryptoService {
	// Set test environment variable
	os.Setenv("ENCRYPTION_KEY", testEncryptionKey)

	service, err := NewCryptoService()
	if err != nil {
		t.Fatalf("Failed to create crypto service: %v", err)
	}

	return service
}

func TestNewCryptoService(t *testing.T) {
	tests := []struct {
		name        string
		key         string
		expectError bool
		errorMsg    string
	}{
		{
			name:        "Valid 32-byte base64 key",
			key:         testEncryptionKey,
			expectError: false,
		},
		{
			name:        "Empty key",
			key:         "",
			expectError: true,
			errorMsg:    "ENCRYPTION_KEY environment variable is required",
		},
		{
			name:        "Invalid base64 key",
			key:         "invalid-base64-key!",
			expectError: true,
		},
		{
			name:        "Wrong key length (16 bytes)",
			key:         base64.StdEncoding.EncodeToString([]byte("16-byte-key-here")),
			expectError: true,
			errorMsg:    "encryption key must be 32 bytes (AES-256)",
		},
		{
			name:        "Wrong key length (64 bytes)",
			key:         base64.StdEncoding.EncodeToString([]byte("64-byte-key-here-this-is-way-too-long-for-aes-256-key")),
			expectError: true,
			errorMsg:    "encryption key must be 32 bytes (AES-256)",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Set environment variable
			if tt.key != "" {
				os.Setenv("ENCRYPTION_KEY", tt.key)
			} else {
				os.Unsetenv("ENCRYPTION_KEY")
			}

			service, err := NewCryptoService()

			if tt.expectError {
				if err == nil {
					t.Errorf("Expected error but got none")
				}
				if tt.errorMsg != "" && err.Error() != tt.errorMsg {
					t.Errorf("Expected error message '%s', got '%s'", tt.errorMsg, err.Error())
				}
			} else {
				if err != nil {
					t.Errorf("Unexpected error: %v", err)
				}
				if service == nil {
					t.Error("Expected service but got nil")
				}
			}
		})
	}
}

func TestEncrypt(t *testing.T) {
	service := setupTestCryptoService(t)

	tests := []struct {
		name     string
		input    string
		expected string // We can't predict the exact output due to random nonce
	}{
		{
			name:  "Empty string",
			input: "",
		},
		{
			name:  "Simple text",
			input: "Hello, World!",
		},
		{
			name:  "Long text",
			input: "This is a very long text that should be encrypted properly using AES-256-GCM encryption algorithm.",
		},
		{
			name:  "Special characters",
			input: "Special chars: !@#$%^&*()_+-=[]{}|;':\",./<>?",
		},
		{
			name:  "Unicode text",
			input: "Unicode: 你好世界 🌍 ñáéíóú",
		},
		{
			name:  "JSON-like string",
			input: `{"token": "abc123", "user": "test@example.com"}`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			encrypted, err := service.Encrypt(tt.input)
			if err != nil {
				t.Errorf("Encrypt() error = %v", err)
				return
			}

			// Check that encrypted result is not empty
			if encrypted == "" {
				t.Error("Encrypted result should not be empty")
			}

			// Check that encrypted result is different from input
			if encrypted == tt.input {
				t.Error("Encrypted result should be different from input")
			}

			// Check that encrypted result is valid base64
			_, err = base64.StdEncoding.DecodeString(encrypted)
			if err != nil {
				t.Errorf("Encrypted result should be valid base64: %v", err)
			}

			// Test that same input produces different encrypted results (due to random nonce)
			encrypted2, err := service.Encrypt(tt.input)
			if err != nil {
				t.Errorf("Second Encrypt() error = %v", err)
				return
			}
			if encrypted == encrypted2 {
				t.Error("Same input should produce different encrypted results due to random nonce")
			}
		})
	}
}

func TestDecrypt(t *testing.T) {
	service := setupTestCryptoService(t)

	tests := []struct {
		name        string
		input       string
		expectError bool
		errorMsg    string
	}{
		{
			name:        "Empty string",
			input:       "",
			expectError: true,
		},
		{
			name:        "Invalid base64",
			input:       "invalid-base64!",
			expectError: true,
		},
		{
			name:        "Too short ciphertext",
			input:       base64.StdEncoding.EncodeToString([]byte("short")),
			expectError: true,
			errorMsg:    "ciphertext too short",
		},
		{
			name:        "Valid but corrupted ciphertext",
			input:       base64.StdEncoding.EncodeToString([]byte("this-is-32-bytes-long-but-not-valid-ciphertext")),
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := service.Decrypt(tt.input)

			if tt.expectError {
				if err == nil {
					t.Errorf("Expected error but got none")
				}
				if tt.errorMsg != "" && err.Error() != tt.errorMsg {
					t.Errorf("Expected error message '%s', got '%s'", tt.errorMsg, err.Error())
				}
			} else {
				if err != nil {
					t.Errorf("Unexpected error: %v", err)
				}
			}
		})
	}
}

func TestEncryptDecryptRoundTrip(t *testing.T) {
	service := setupTestCryptoService(t)

	tests := []struct {
		name  string
		input string
	}{
		{
			name:  "Empty string",
			input: "",
		},
		{
			name:  "Simple text",
			input: "Hello, World!",
		},
		{
			name:  "Long text",
			input: "This is a very long text that should be encrypted and decrypted properly using AES-256-GCM encryption algorithm.",
		},
		{
			name:  "Special characters",
			input: "Special chars: !@#$%^&*()_+-=[]{}|;':\",./<>?",
		},
		{
			name:  "Unicode text",
			input: "Unicode: 你好世界 🌍 ñáéíóú",
		},
		{
			name:  "JSON-like string",
			input: `{"token": "abc123", "user": "test@example.com"}`,
		},
		{
			name:  "Token-like string",
			input: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Encrypt
			encrypted, err := service.Encrypt(tt.input)
			if err != nil {
				t.Errorf("Encrypt() error = %v", err)
				return
			}

			// Decrypt
			decrypted, err := service.Decrypt(encrypted)
			if err != nil {
				t.Errorf("Decrypt() error = %v", err)
				return
			}

			// Verify round trip
			if decrypted != tt.input {
				t.Errorf("Round trip failed. Expected '%s', got '%s'", tt.input, decrypted)
			}
		})
	}
}

func TestSpecificEncryptedValue(t *testing.T) {
	service := setupTestCryptoService(t)

	// The specific encrypted value provided by the user
	encryptedValue := "r5kZYiJEUT8cYFe24KwCBu0trAdfHiwgI1OMx2zhJS4="

	// Try to decrypt it
	decrypted, err := service.Decrypt(encryptedValue)

	if err != nil {
		t.Logf("Failed to decrypt the specific value: %v", err)
		t.Logf("This could mean:")
		t.Logf("1. The value was encrypted with a different key")
		t.Logf("2. The value is corrupted")
		t.Logf("3. The value is not a valid encrypted token")
	} else {
		t.Logf("Successfully decrypted value: '%s'", decrypted)
	}
}

func TestMultipleEncryptionsConsistency(t *testing.T) {
	service := setupTestCryptoService(t)

	// Test that multiple encryptions of the same value can all be decrypted
	testValue := "test-token-123"
	var encryptedValues []string

	// Encrypt the same value multiple times
	for i := 0; i < 10; i++ {
		encrypted, err := service.Encrypt(testValue)
		if err != nil {
			t.Errorf("Encrypt() error on iteration %d: %v", i, err)
			return
		}
		encryptedValues = append(encryptedValues, encrypted)
	}

	// Verify all encrypted values are different (due to random nonce)
	for i := 0; i < len(encryptedValues); i++ {
		for j := i + 1; j < len(encryptedValues); j++ {
			if encryptedValues[i] == encryptedValues[j] {
				t.Error("Multiple encryptions of the same value should produce different results")
			}
		}
	}

	// Verify all encrypted values can be decrypted back to the original
	for i, encrypted := range encryptedValues {
		decrypted, err := service.Decrypt(encrypted)
		if err != nil {
			t.Errorf("Decrypt() error on iteration %d: %v", i, err)
			return
		}
		if decrypted != testValue {
			t.Errorf("Decrypt() failed on iteration %d. Expected '%s', got '%s'", i, testValue, decrypted)
		}
	}
}

func TestCryptoServiceWithDifferentKeys(t *testing.T) {
	// Test that encrypted data with one key cannot be decrypted with another key
	key1 := base64.StdEncoding.EncodeToString([]byte("12345678901234567890123456789012"))
	key2 := base64.StdEncoding.EncodeToString([]byte("abcdefghijklmnopqrstuvwxyz123456"))

	// Create service with first key
	os.Setenv("ENCRYPTION_KEY", key1)
	service1, err := NewCryptoService()
	if err != nil {
		t.Fatalf("Failed to create crypto service 1: %v", err)
	}

	// Create service with second key
	os.Setenv("ENCRYPTION_KEY", key2)
	service2, err := NewCryptoService()
	if err != nil {
		t.Fatalf("Failed to create crypto service 2: %v", err)
	}

	testValue := "secret-token"

	// Encrypt with first service
	encrypted, err := service1.Encrypt(testValue)
	if err != nil {
		t.Errorf("Encrypt with service 1 failed: %v", err)
		return
	}

	// Try to decrypt with second service (should fail)
	_, err = service2.Decrypt(encrypted)
	if err == nil {
		t.Error("Expected decryption to fail with different key, but it succeeded")
	}

	// Verify decryption works with correct service
	decrypted, err := service1.Decrypt(encrypted)
	if err != nil {
		t.Errorf("Decrypt with correct service failed: %v", err)
		return
	}
	if decrypted != testValue {
		t.Errorf("Decrypt failed. Expected '%s', got '%s'", testValue, decrypted)
	}
}
