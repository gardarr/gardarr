package task_metadata

import (
	"testing"
)

func TestMetadataProviderRegistryGet(t *testing.T) {
	provider := mockMetadataProvider{name: "tgdb", allowedImageHosts: []string{"cdn.thegamesdb.net"}}
	registry := NewMetadataProviderRegistry(provider)

	resolved, ok := registry.Get("tgdb")
	if !ok {
		t.Fatal("expected TGDB provider to be registered")
	}

	if resolved.Name() != "tgdb" {
		t.Errorf("expected provider name %q, got %q", "tgdb", resolved.Name())
	}
}
