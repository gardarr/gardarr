package worker

import (
	"testing"

	"github.com/jfxdev/gardarr/internal/services/crypto"
)

const testEncryptionKey = "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY="

func TestResolveWorkerCredentialDecryptsEncryptedValues(t *testing.T) {
	t.Setenv("ENCRYPTION_KEY", testEncryptionKey)

	cryptoService, err := crypto.NewCryptoService()
	if err != nil {
		t.Fatalf("failed to create crypto service: %v", err)
	}

	encryptedValue, err := cryptoService.Encrypt("secret-value")
	if err != nil {
		t.Fatalf("failed to encrypt value: %v", err)
	}

	repo := &Repository{crypto: cryptoService}

	got, err := repo.resolveWorkerCredential(encryptedValue)
	if err != nil {
		t.Fatalf("expected decryption to succeed, got error: %v", err)
	}

	if got != "secret-value" {
		t.Fatalf("expected decrypted value 'secret-value', got %q", got)
	}
}

func TestResolveWorkerCredentialFallsBackToPlainText(t *testing.T) {
	t.Setenv("ENCRYPTION_KEY", testEncryptionKey)

	cryptoService, err := crypto.NewCryptoService()
	if err != nil {
		t.Fatalf("failed to create crypto service: %v", err)
	}

	repo := &Repository{crypto: cryptoService}

	got, err := repo.resolveWorkerCredential("http://localhost:8080")
	if err != nil {
		t.Fatalf("expected fallback to plain text, got error: %v", err)
	}

	if got != "http://localhost:8080" {
		t.Fatalf("expected plain text fallback, got %q", got)
	}
}
