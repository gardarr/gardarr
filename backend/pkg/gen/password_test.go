package gen

import (
	"strings"
	"testing"
)

func TestGeneratePassword(t *testing.T) {
	tests := []struct {
		name    string
		length  int
		wantLen int
		wantErr bool
	}{
		{
			name:    "default length",
			length:  0,
			wantLen: DefaultPasswordLength,
			wantErr: false,
		},
		{
			name:    "custom length 16",
			length:  16,
			wantLen: 16,
			wantErr: false,
		},
		{
			name:    "custom length 64",
			length:  64,
			wantLen: 64,
			wantErr: false,
		},
		{
			name:    "negative length",
			length:  -1,
			wantLen: DefaultPasswordLength,
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := GeneratePassword(tt.length)
			if (err != nil) != tt.wantErr {
				t.Errorf("GeneratePassword() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if len(got) != tt.wantLen {
				t.Errorf("GeneratePassword() length = %v, want %v", len(got), tt.wantLen)
			}

			// Check if password contains only alphanumeric characters
			for _, char := range got {
				if !strings.ContainsRune(AlphanumericCharset, char) {
					t.Errorf("GeneratePassword() contains invalid character: %c", char)
				}
			}
		})
	}
}

func TestGenerateMultiplePasswords(t *testing.T) {
	tests := []struct {
		name    string
		count   int
		length  int
		wantLen int
		wantErr bool
	}{
		{
			name:    "single password",
			count:   1,
			length:  16,
			wantLen: 1,
			wantErr: false,
		},
		{
			name:    "multiple passwords",
			count:   5,
			length:  32,
			wantLen: 5,
			wantErr: false,
		},
		{
			name:    "zero count",
			count:   0,
			length:  16,
			wantLen: 1, // Should default to 1
			wantErr: false,
		},
		{
			name:    "negative count",
			count:   -1,
			length:  16,
			wantLen: 1, // Should default to 1
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := GenerateMultiplePasswords(tt.count, tt.length)
			if (err != nil) != tt.wantErr {
				t.Errorf("GenerateMultiplePasswords() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if len(got) != tt.wantLen {
				t.Errorf("GenerateMultiplePasswords() count = %v, want %v", len(got), tt.wantLen)
			}

			// Check each password
			for i, password := range got {
				if len(password) != tt.length {
					t.Errorf("GenerateMultiplePasswords() password[%d] length = %v, want %v", i, len(password), tt.length)
				}

				// Check if password contains only alphanumeric characters
				for _, char := range password {
					if !strings.ContainsRune(AlphanumericCharset, char) {
						t.Errorf("GenerateMultiplePasswords() password[%d] contains invalid character: %c", i, char)
					}
				}
			}
		})
	}
}

func TestGenerateCustomPassword(t *testing.T) {
	tests := []struct {
		name    string
		length  int
		charset string
		wantLen int
		wantErr bool
	}{
		{
			name:    "letters only",
			length:  16,
			charset: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
			wantLen: 16,
			wantErr: false,
		},
		{
			name:    "numbers only",
			length:  16,
			charset: "0123456789",
			wantLen: 16,
			wantErr: false,
		},
		{
			name:    "empty charset",
			length:  16,
			charset: "",
			wantLen: 16,
			wantErr: false,
		},
		{
			name:    "zero length",
			length:  0,
			charset: "ABC",
			wantLen: DefaultPasswordLength,
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := GenerateCustomPassword(tt.length, tt.charset)
			if (err != nil) != tt.wantErr {
				t.Errorf("GenerateCustomPassword() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if len(got) != tt.wantLen {
				t.Errorf("GenerateCustomPassword() length = %v, want %v", len(got), tt.wantLen)
			}

			// Check if password contains only characters from the specified charset
			expectedCharset := tt.charset
			if expectedCharset == "" {
				expectedCharset = AlphanumericCharset
			}

			for _, char := range got {
				if !strings.ContainsRune(expectedCharset, char) {
					t.Errorf("GenerateCustomPassword() contains invalid character: %c", char)
				}
			}
		})
	}
}

func TestPasswordUniqueness(t *testing.T) {
	// Generate multiple passwords and check they are unique
	passwords, err := GenerateMultiplePasswords(100, 32)
	if err != nil {
		t.Errorf("GenerateMultiplePasswords() error = %v", err)
		return
	}

	// Check for duplicates
	seen := make(map[string]bool)
	for _, password := range passwords {
		if seen[password] {
			t.Errorf("Duplicate password generated: %s", password)
		}
		seen[password] = true
	}
}

func BenchmarkGeneratePassword(b *testing.B) {
	for i := 0; i < b.N; i++ {
		_, err := GeneratePassword(32)
		if err != nil {
			b.Errorf("GeneratePassword() error = %v", err)
		}
	}
}
