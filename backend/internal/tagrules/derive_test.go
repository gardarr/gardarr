package tagrules

import (
	"encoding/json"
	"os"
	"reflect"
	"testing"
)

// deriveFixtureCase mirrors one entry of tests/testdata/tag_derive.json, the
// fixture shared with the TypeScript mirror (frontend/src/utils/tagRules.ts)
// so both implementations are held to the same contract.
type deriveFixtureCase struct {
	Name      string   `json:"name"`
	Source    string   `json:"source"`
	Delimiter string   `json:"delimiter"`
	Mode      string   `json:"mode"`
	Values    []string `json:"values"`
	Expected  []string `json:"expected"`
	Error     bool     `json:"error"`
}

func loadDeriveFixture(t *testing.T) []deriveFixtureCase {
	t.Helper()

	data, err := os.ReadFile("../../../tests/testdata/tag_derive.json")
	if err != nil {
		t.Fatalf("failed to read shared fixture: %v", err)
	}

	var cases []deriveFixtureCase
	if err := json.Unmarshal(data, &cases); err != nil {
		t.Fatalf("failed to parse shared fixture: %v", err)
	}

	return cases
}

func TestDerive_SharedFixture(t *testing.T) {
	for _, tc := range loadDeriveFixture(t) {
		t.Run(tc.Name, func(t *testing.T) {
			got, err := Derive(tc.Source, tc.Delimiter, tc.Values, Mode(tc.Mode))

			if tc.Error {
				if err == nil {
					t.Fatalf("expected an error, got result %v", got)
				}
				return
			}

			if err != nil {
				t.Fatalf("expected no error, got %v", err)
			}
			if !reflect.DeepEqual(got, tc.Expected) {
				t.Errorf("got %v, want %v", got, tc.Expected)
			}
		})
	}
}
