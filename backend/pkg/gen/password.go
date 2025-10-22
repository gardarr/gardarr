package gen

import (
	"crypto/rand"
	"math/big"
)

const (
	// DefaultPasswordLength is the default length for generated passwords
	DefaultPasswordLength = 32

	// AlphanumericCharset contains all alphanumeric characters
	AlphanumericCharset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
)

// GeneratePassword generates a secure alphanumeric password of specified length
func GeneratePassword(length int) (string, error) {
	if length <= 0 {
		length = DefaultPasswordLength
	}

	charset := AlphanumericCharset
	charsetLen := big.NewInt(int64(len(charset)))

	password := make([]byte, length)
	for i := range password {
		// Generate cryptographically secure random number
		n, err := rand.Int(rand.Reader, charsetLen)
		if err != nil {
			return "", err
		}
		password[i] = charset[n.Int64()]
	}

	return string(password), nil
}

// GenerateMultiplePasswords generates multiple passwords
func GenerateMultiplePasswords(count, length int) ([]string, error) {
	if count <= 0 {
		count = 1
	}
	if length <= 0 {
		length = DefaultPasswordLength
	}

	passwords := make([]string, count)
	for i := 0; i < count; i++ {
		password, err := GeneratePassword(length)
		if err != nil {
			return nil, err
		}
		passwords[i] = password
	}

	return passwords, nil
}

// GenerateCustomPassword generates a password with custom character set
func GenerateCustomPassword(length int, charset string) (string, error) {
	if length <= 0 {
		length = DefaultPasswordLength
	}
	if charset == "" {
		charset = AlphanumericCharset
	}

	charsetLen := big.NewInt(int64(len(charset)))
	password := make([]byte, length)

	for i := range password {
		// Generate cryptographically secure random number
		n, err := rand.Int(rand.Reader, charsetLen)
		if err != nil {
			return "", err
		}
		password[i] = charset[n.Int64()]
	}

	return string(password), nil
}
