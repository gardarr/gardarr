package tagrules

import (
	"encoding/json"
	"os"
	"testing"
)

// fixtureCase mirrors one entry of tests/testdata/tag_rules.json, the
// fixture shared with the TypeScript mirror (frontend/src/utils/tagRules.ts)
// so both implementations are held to the same contract.
type fixtureCase struct {
	Name  string `json:"name"`
	Input string `json:"input"`
	Kind  string `json:"kind"`
	Key   string `json:"key"`
	Value string `json:"value"`
	Raw   string `json:"raw"`
}

func loadFixture(t *testing.T) []fixtureCase {
	t.Helper()

	data, err := os.ReadFile("../../../tests/testdata/tag_rules.json")
	if err != nil {
		t.Fatalf("failed to read shared fixture: %v", err)
	}

	var cases []fixtureCase
	if err := json.Unmarshal(data, &cases); err != nil {
		t.Fatalf("failed to parse shared fixture: %v", err)
	}

	return cases
}

func TestParse_SharedFixture(t *testing.T) {
	for _, tc := range loadFixture(t) {
		t.Run(tc.Name, func(t *testing.T) {
			got := Parse(tc.Input)

			if string(got.Kind) != tc.Kind {
				t.Errorf("Kind = %q, want %q", got.Kind, tc.Kind)
			}
			if got.Key != tc.Key {
				t.Errorf("Key = %q, want %q", got.Key, tc.Key)
			}
			if got.Value != tc.Value {
				t.Errorf("Value = %q, want %q", got.Value, tc.Value)
			}
			if got.Raw != tc.Raw {
				t.Errorf("Raw = %q, want %q", got.Raw, tc.Raw)
			}
		})
	}
}

func TestScopeOf(t *testing.T) {
	tests := []struct {
		name      string
		tag       string
		wantScope string
		wantOK    bool
	}{
		{name: "scoped tag", tag: "quality::4k", wantScope: "quality", wantOK: true},
		{name: "grouped tag is not a scope", tag: "genre:action", wantOK: false},
		{name: "plain tag is not a scope", tag: "movies", wantOK: false},
		{name: "invalid scope falls back to plain", tag: "::x", wantOK: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			scope, ok := ScopeOf(tt.tag)
			if ok != tt.wantOK {
				t.Fatalf("ok = %v, want %v", ok, tt.wantOK)
			}
			if ok && scope != tt.wantScope {
				t.Errorf("scope = %q, want %q", scope, tt.wantScope)
			}
		})
	}
}
