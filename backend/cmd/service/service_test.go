package service

import (
	"os"
	"testing"

	"github.com/gardarr/gardarr/internal/constants"
	"github.com/gardarr/gardarr/pkg/env"
	"github.com/stretchr/testify/assert"
)

func TestStandaloneModeDetection(t *testing.T) {
	// Test with APP_MODE=standalone
	os.Setenv(constants.AppModeEnv, "standalone")
	defer os.Unsetenv(constants.AppModeEnv)

	appMode := env.Get(constants.AppModeEnv).Value()
	isStandalone := appMode == "standalone"

	assert.True(t, isStandalone, "Should detect standalone mode when APP_MODE=standalone")
}

func TestNormalModeDetection(t *testing.T) {
	// Test with APP_MODE not set to standalone
	os.Setenv(constants.AppModeEnv, "normal")
	defer os.Unsetenv(constants.AppModeEnv)

	appMode := env.Get(constants.AppModeEnv).Value()
	isStandalone := appMode == "standalone"

	assert.False(t, isStandalone, "Should not detect standalone mode when APP_MODE is not 'standalone'")
}

func TestStandaloneModeUnset(t *testing.T) {
	// Test with APP_MODE not set at all
	os.Unsetenv(constants.AppModeEnv)

	appMode := env.Get(constants.AppModeEnv).Value()
	isStandalone := appMode == "standalone"

	assert.False(t, isStandalone, "Should not detect standalone mode when APP_MODE is not set")
}
