package models

import (
	"reflect"
	"testing"
)

func TestStringArrayScan(t *testing.T) {
	tests := []struct {
		name    string
		input   interface{}
		want    StringArray
		wantErr bool
	}{
		{name: "nil value", input: nil, want: nil},
		{name: "bytes", input: []byte(`["tag1","tag2"]`), want: StringArray{"tag1", "tag2"}},
		{name: "string", input: `["tag1","tag2"]`, want: StringArray{"tag1", "tag2"}},
		{name: "empty json array as string", input: `[]`, want: StringArray{}},
		{name: "invalid json", input: `not-json`, wantErr: true},
		{name: "unsupported type", input: 42, wantErr: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var s StringArray
			err := s.Scan(tt.input)
			if (err != nil) != tt.wantErr {
				t.Fatalf("Scan() error = %v, wantErr %v", err, tt.wantErr)
			}
			if !tt.wantErr && !reflect.DeepEqual(s, tt.want) {
				t.Errorf("Scan() = %v, want %v", s, tt.want)
			}
		})
	}
}

func TestStringArrayValueRoundTrip(t *testing.T) {
	original := StringArray{"tag1", "tag2"}

	value, err := original.Value()
	if err != nil {
		t.Fatalf("Value() error = %v", err)
	}

	var scanned StringArray
	if err := scanned.Scan(value); err != nil {
		t.Fatalf("Scan() error = %v", err)
	}

	if !reflect.DeepEqual(scanned, original) {
		t.Errorf("round trip = %v, want %v", scanned, original)
	}
}

func TestStringArrayValueNil(t *testing.T) {
	var s StringArray
	value, err := s.Value()
	if err != nil {
		t.Fatalf("Value() error = %v", err)
	}
	if value != nil {
		t.Errorf("Value() = %v, want nil", value)
	}
}
