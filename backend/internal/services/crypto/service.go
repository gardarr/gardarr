package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"io"

	"github.com/gardarr/gardarr/pkg/env"
)

// CryptoService handles encryption and decryption of sensitive data
type CryptoService struct {
	gcm cipher.AEAD
}

// NewCryptoService creates a new crypto service with AES-256-GCM
func NewCryptoService() (*CryptoService, error) {
	// Get encryption key from environment variable (32 bytes for AES-256)
	keyStr := env.Get("ENCRYPTION_KEY").Value()
	if keyStr == "" {
		return nil, errors.New("ENCRYPTION_KEY environment variable is required")
	}

	// Decode base64 key
	key, err := base64.StdEncoding.DecodeString(keyStr)
	if err != nil {
		return nil, err
	}

	fmt.Println(key)
	if len(key) != 32 {
		return nil, errors.New("encryption key must be 32 bytes (AES-256)")
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	return &CryptoService{gcm: gcm}, nil
}

// Encrypt encrypts plaintext using AES-256-GCM
func (cs *CryptoService) Encrypt(plaintext string) (string, error) {
	nonce := make([]byte, cs.gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}

	ciphertext := cs.gcm.Seal(nonce, nonce, []byte(plaintext), nil)
	return base64.StdEncoding.EncodeToString(ciphertext), nil
}

// Decrypt decrypts ciphertext using AES-256-GCM
func (cs *CryptoService) Decrypt(ciphertext string) (string, error) {
	data, err := base64.StdEncoding.DecodeString(ciphertext)
	if err != nil {
		return "", err
	}

	nonceSize := cs.gcm.NonceSize()
	if len(data) < nonceSize {
		return "", errors.New("ciphertext too short")
	}

	nonce, ciphertext_bytes := data[:nonceSize], data[nonceSize:]
	plaintext, err := cs.gcm.Open(nil, nonce, ciphertext_bytes, nil)
	if err != nil {
		return "", err
	}

	return string(plaintext), nil
}
