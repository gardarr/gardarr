package task

import (
	"reflect"
	"testing"
)

func TestDiffTaskTags(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name         string
		current      string
		desired      []string
		wantToAdd    []string
		wantToRemove []string
	}{
		{
			name:         "adds new tags when current is empty",
			current:      "",
			desired:      []string{"a", "b"},
			wantToAdd:    []string{"a", "b"},
			wantToRemove: []string{},
		},
		{
			name:         "removes tags not present anymore",
			current:      "a,b,c",
			desired:      []string{"b"},
			wantToAdd:    []string{},
			wantToRemove: []string{"a", "c"},
		},
		{
			name:         "mixes additions and removals",
			current:      "a,b",
			desired:      []string{"b", "c"},
			wantToAdd:    []string{"c"},
			wantToRemove: []string{"a"},
		},
		{
			name:         "clears all tags when desired is empty",
			current:      "a,b",
			desired:      []string{},
			wantToAdd:    []string{},
			wantToRemove: []string{"a", "b"},
		},
		{
			name:         "normalizes duplicates and whitespace",
			current:      " a, b ,b",
			desired:      []string{" b ", "c", "", "c"},
			wantToAdd:    []string{"c"},
			wantToRemove: []string{"a"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			gotToAdd, gotToRemove := diffTaskTags(tt.current, tt.desired)

			if !reflect.DeepEqual(gotToAdd, tt.wantToAdd) {
				t.Fatalf("tagsToAdd mismatch: got %v want %v", gotToAdd, tt.wantToAdd)
			}

			if !reflect.DeepEqual(gotToRemove, tt.wantToRemove) {
				t.Fatalf("tagsToRemove mismatch: got %v want %v", gotToRemove, tt.wantToRemove)
			}
		})
	}
}

func TestNormalizeTaskCategory(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name            string
		input           string
		wantCategory    string
		wantShouldClear bool
	}{
		{
			name:            "keeps non-empty category",
			input:           "movies",
			wantCategory:    "movies",
			wantShouldClear: false,
		},
		{
			name:            "trims surrounding whitespace",
			input:           "  series  ",
			wantCategory:    "series",
			wantShouldClear: false,
		},
		{
			name:            "marks empty category for removal",
			input:           "   ",
			wantCategory:    "",
			wantShouldClear: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			gotCategory, gotShouldClear := normalizeTaskCategory(tt.input)
			if gotCategory != tt.wantCategory {
				t.Fatalf("unexpected category: got %q want %q", gotCategory, tt.wantCategory)
			}
			if gotShouldClear != tt.wantShouldClear {
				t.Fatalf("unexpected shouldClear: got %v want %v", gotShouldClear, tt.wantShouldClear)
			}
		})
	}
}
