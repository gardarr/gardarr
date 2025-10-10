package key

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"log"

	"github.com/spf13/cobra"
)

var cmd = &cobra.Command{
	Use:   "key",
	Short: "Generate a new AES-256 encryption key",
	Long: `Generate a secure 256-bit encryption key for encrypting sensitive data.
This key is used to encrypt torrent client credentials in the database.`,
	Run: func(cmd *cobra.Command, args []string) {
		encryptionKey := generateEncryptionKey()
		printKeyUsageInstructions(encryptionKey)
	},
}

func Command() *cobra.Command {
	return cmd
}

// generateEncryptionKey generates a secure 32-byte key for AES-256
func generateEncryptionKey() string {
	key := make([]byte, 32) // 32 bytes = 256 bits
	if _, err := rand.Read(key); err != nil {
		log.Fatal("Failed to generate encryption key:", err)
	}
	return base64.StdEncoding.EncodeToString(key)
}

// printKeyUsageInstructions prints instructions on how to use the generated key
func printKeyUsageInstructions(encryptionKey string) {
	fmt.Println("=== ENCRYPTION KEY GENERATED ===")
	fmt.Println()
	fmt.Printf("Your encryption key (%d characters):\n", len(encryptionKey))
	fmt.Printf("\033[1;32m%s\033[0m\n", encryptionKey) // Green color
	fmt.Println()

	// Validate the generated key
	key, err := base64.StdEncoding.DecodeString(encryptionKey)
	if err != nil {
		log.Fatal("Failed to decode generated key:", err)
	}
	fmt.Printf("✓ Key validation: %d bytes (required: 32 bytes)\n", len(key))
	fmt.Println()

	fmt.Println("=== HOW TO USE THIS KEY ===")
	fmt.Println()
	fmt.Println("1. Add to your .env file:")
	fmt.Printf("ENCRYPTION_KEY=%s\n", encryptionKey)
	fmt.Println()

	fmt.Println("2. Export as environment variable:")
	fmt.Printf("export ENCRYPTION_KEY='%s'\n", encryptionKey)
	fmt.Println()

	fmt.Println("3. Docker Compose:")
	fmt.Printf("ENCRYPTION_KEY=%s\n", encryptionKey)
	fmt.Println()

	fmt.Println("⚠️  IMPORTANT SECURITY NOTES:")
	fmt.Println("- Store this key securely and separately from your code")
	fmt.Println("- Never commit this key to version control")
	fmt.Println("- Backup this key - losing it means losing encrypted data")
	fmt.Println("- Generate different keys for dev/staging/production")
}
