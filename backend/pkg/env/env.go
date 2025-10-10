package env

import (
	"errors"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/joho/godotenv"
	"github.com/spf13/viper"
)

const maxSecretFileSize = 64 * 1024 // 64KB limit

func init() {
	godotenv.Load(".env")

	viper.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))

	viper.AutomaticEnv()
}

type Env interface {
	Value() string
	Default(any) Env
	ValueInt() int
	ValueBool() bool
	ValueTime() time.Time
	ValueDuration() time.Duration
}

type value struct {
	key   string
	value any
}

// Get retrieves environment variable value, supporting Docker secrets with _FILE suffix
func Get(key string) Env {
	v := &value{key: key}

	// First priority: check if there's a _FILE version of the variable
	if fileValue := readFromFile(key); fileValue != "" {
		v.value = fileValue
		return v
	}

	// Second priority: check the regular environment variable using viper
	if val := viper.GetString(key); val != "" {
		v.value = val
	}

	return v
}

// readFromFile reads content from file when key has _FILE suffix
func readFromFile(key string) string {
	// Get the file path using viper (respects prefix and key replacer)
	if filePath := viper.GetString(key); filePath != "" {
		if content, err := readSecretFile(filePath); err == nil {
			return content
		}
	}

	return ""
}

func readSecretFile(filePath string) (string, error) {
	// Validate path
	if strings.Contains(filePath, "..") {
		return "", errors.New("invalid file path")
	}

	// Check file size
	info, err := os.Stat(filePath)
	if err != nil {
		return "", err
	}
	if info.Size() > maxSecretFileSize {
		return "", errors.New("file too large")
	}

	// Read with size limit
	content, err := os.ReadFile(filePath)
	if err != nil {
		return "", err
	}

	return strings.TrimSpace(string(content)), nil
}

func (v *value) Default(value any) Env {
	if v.Value() != "" {
		return v
	}

	v.value = value
	viper.SetDefault(v.key, value)

	return v
}

func (v *value) Value() string {
	if v.value != nil {
		if str, ok := v.value.(string); ok {
			return str
		}
	}
	return ""
}

// ValueBool returns the environment value as boolean
func (v *value) ValueBool() bool {
	str := v.Value()
	if str == "" {
		return false
	}

	// Parse common boolean representations
	switch strings.ToLower(str) {
	case "true", "1", "yes", "on", "enabled":
		return true
	case "false", "0", "no", "off", "disabled":
		return false
	default:
		// Try standard bool parsing as fallback
		result, _ := strconv.ParseBool(str)
		return result
	}
}

// ValueInt returns the environment value as integer
func (v *value) ValueInt() int {
	str := v.Value()
	if str == "" {
		return 0
	}

	result, err := strconv.Atoi(str)
	if err != nil {
		return 0
	}
	return result
}

// ValueTime returns the environment value as time.Time
// Supports RFC3339, RFC3339Nano, and custom layout parsing
func (v *value) ValueTime() time.Time {
	str := v.Value()
	if str == "" {
		return time.Time{}
	}

	// Try common time formats
	formats := []string{
		time.RFC3339,
		time.RFC3339Nano,
		"2006-01-02 15:04:05",
		"2006-01-02T15:04:05",
		"2006-01-02",
		"15:04:05",
	}

	for _, format := range formats {
		if t, err := time.Parse(format, str); err == nil {
			return t
		}
	}

	// Return zero time if parsing fails
	return time.Time{}
}

// ValueDuration returns the environment value as time.Duration
// Supports standard Go duration format (e.g., "5s", "10m", "2h30m")
func (v *value) ValueDuration() time.Duration {
	str := v.Value()
	if str == "" {
		return 0
	}

	// Try parsing as standard Go duration
	if duration, err := time.ParseDuration(str); err == nil {
		return duration
	}

	// Try parsing as seconds if it's just a number
	if seconds, err := strconv.Atoi(str); err == nil {
		return time.Duration(seconds) * time.Second
	}

	// Return zero duration if parsing fails
	return 0
}
