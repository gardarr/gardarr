package workermanager

import (
	"fmt"
	"sort"
	"strings"

	"github.com/google/uuid"
	"github.com/jfxdev/gardarr/internal/entities"
)

// fetchWorker retrieves a worker by ID string
func (s *Service) fetchWorker(id string) (*entities.Worker, error) {
	uid, err := uuid.Parse(id)
	if err != nil {
		return nil, fmt.Errorf("invalid worker UUID format: %w", err)
	}

	worker, err := s.repository.GetWorkerByUUID(uid)
	if err != nil {
		return nil, fmt.Errorf("failed to retrieve worker: %w", err)
	}

	return worker, nil
}

// calculateWordCloud extracts and counts the top 25 most used terms in task names
func (s *Service) calculateWordCloud(tasks []*entities.Task) map[string]int {
	wordCount := make(map[string]int)

	// Common words to ignore (stop words)
	stopWords := map[string]bool{
		"the": true, "a": true, "an": true, "and": true, "or": true, "but": true,
		"in": true, "on": true, "at": true, "to": true, "for": true, "of": true,
		"with": true, "by": true, "is": true, "are": true, "was": true, "were": true,
		"be": true, "been": true, "have": true, "has": true, "had": true, "do": true,
		"does": true, "did": true, "will": true, "would": true, "could": true, "should": true,
		"may": true, "might": true, "must": true, "can": true, "this": true, "that": true,
		"these": true, "those": true, "i": true, "you": true, "he": true, "she": true,
		"it": true, "we": true, "they": true, "me": true, "him": true, "her": true,
		"us": true, "them": true, "my": true, "your": true, "his": true, "its": true,
		"our": true, "their": true, "from": true, "up": true, "down": true,
		"out": true, "off": true, "over": true, "under": true, "again": true, "further": true,
		"then": true, "once": true, "here": true, "there": true, "when": true, "where": true,
		"why": true, "how": true, "all": true, "any": true, "both": true, "each": true,
		"few": true, "more": true, "most": true, "other": true, "some": true, "such": true,
		"no": true, "nor": true, "not": true, "only": true, "own": true, "same": true,
		"so": true, "than": true, "too": true, "very": true, "s": true, "t": true,
		"just": true, "don": true, "now": true,
		"d": true, "ll": true, "m": true, "o": true, "re": true, "ve": true, "y": true,
		"ain": true, "aren": true, "couldn": true, "didn": true, "doesn": true, "hadn": true,
		"hasn": true, "haven": true, "isn": true, "ma": true, "mightn": true, "mustn": true,
		"needn": true, "shan": true, "shouldn": true, "wasn": true, "weren": true, "won": true,
		"wouldn": true,
	}

	// Extract words from each task name
	for _, task := range tasks {
		if task.Name == "" {
			continue
		}

		// Convert to lowercase and split by common delimiters
		text := strings.ToLower(task.Name)
		// Replace common delimiters with spaces
		delimiters := "._-()[]{} :;,!?@#$%^&*+=|\\/<>~`"
		for _, char := range delimiters {
			text = strings.ReplaceAll(text, string(char), " ")
		}

		// Split into words
		words := strings.Fields(text)

		// Count each word (skip stop words and very short words)
		for _, word := range words {
			// Clean the word (remove any remaining non-alphanumeric characters)
			word = strings.TrimSpace(word)
			if len(word) < 3 || stopWords[word] {
				continue
			}

			// Only count words that contain at least one letter
			hasLetter := false
			for _, char := range word {
				if (char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z') {
					hasLetter = true
					break
				}
			}

			if hasLetter {
				wordCount[word]++
			}
		}
	}

	// Convert to slice for sorting
	type wordCountPair struct {
		word  string
		count int
	}

	var pairs []wordCountPair
	for word, count := range wordCount {
		pairs = append(pairs, wordCountPair{word, count})
	}

	// Sort by count (descending) and then by word (ascending) for consistency
	sort.Slice(pairs, func(i, j int) bool {
		if pairs[i].count == pairs[j].count {
			return pairs[i].word < pairs[j].word
		}
		return pairs[i].count > pairs[j].count
	})

	// Take top 25 and convert back to map
	result := make(map[string]int)
	maxCount := 25
	if len(pairs) < maxCount {
		maxCount = len(pairs)
	}

	for i := 0; i < maxCount; i++ {
		result[pairs[i].word] = pairs[i].count
	}

	return result
}
