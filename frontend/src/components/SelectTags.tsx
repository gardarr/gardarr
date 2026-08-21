import { useEffect, useRef, useState } from "react";
import { Label } from "@/components/ui/label";
import { TagBadge } from "@/components/ui/TagBadge";
import { Hash } from "lucide-react";
import { tagService } from "@/services/tags";

const SUGGESTIONS_MIN_CHARS = 2;
const SUGGESTIONS_MAX_RESULTS = 3;
const SUGGESTIONS_DEBOUNCE_MS = 300;

interface SelectTagsProps {
  tags: string[];
  onTagsChange: (tags: string[]) => void;
  label?: string;
  required?: boolean;
  error?: string;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  showHelp?: boolean;
  helpText?: string;
  /** Compact height for dense layouts. */
  dense?: boolean;
}

export function SelectTags({
  tags,
  onTagsChange,
  label = "Tags",
  required = false,
  error,
  className = "",
  placeholder = "Digite uma tag e pressione Enter",
  disabled = false,
  showHelp = false,
  helpText,
  dense = false
}: SelectTagsProps) {
  const [tagInput, setTagInput] = useState("");
  const [knownTagNames, setKnownTagNames] = useState<string[] | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // Registered unconditionally (not gated on suggestions.length) so the
  // listener is already attached before any suggestions can appear —
  // gating it on suggestions.length left a window, right after the
  // dropdown's first render, where an outside click landed before the
  // effect had run and was silently missed.
  useEffect(() => {
    const handlePointerDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        setSuggestions((prev) => (prev.length > 0 ? [] : prev));
        setHighlightedIndex(-1);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  // Loaded lazily, on first focus, so forms that never get used don't
  // fetch the tag list.
  const ensureKnownTagsLoaded = () => {
    if (knownTagNames !== null || disabled) return;
    tagService.listTags()
      .then(res => setKnownTagNames((res.data ?? []).map(t => t.name)))
      .catch(() => setKnownTagNames([]));
  };

  const scheduleSuggestions = (value: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const query = value.trim().toLowerCase();
    if (query.length < SUGGESTIONS_MIN_CHARS || !knownTagNames) {
      setSuggestions([]);
      setHighlightedIndex(-1);
      return;
    }

    debounceRef.current = setTimeout(() => {
      const matches = knownTagNames
        .filter(name => !tags.includes(name) && name.toLowerCase().includes(query))
        .sort((a, b) => {
          const aStarts = a.toLowerCase().startsWith(query) ? 0 : 1;
          const bStarts = b.toLowerCase().startsWith(query) ? 0 : 1;
          return aStarts - bStarts || a.localeCompare(b);
        })
        .slice(0, SUGGESTIONS_MAX_RESULTS);

      setSuggestions(matches);
      setHighlightedIndex(-1);
    }, SUGGESTIONS_DEBOUNCE_MS);
  };

  const handleInputChange = (value: string) => {
    setTagInput(value);
    scheduleSuggestions(value);
  };

  const clearSuggestions = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSuggestions([]);
    setHighlightedIndex(-1);
  };

  const handleAddTag = () => {
    if (disabled) return;

    // Split by comma and trim each tag, then remove all whitespace
    const newTags = tagInput.split(',').map(tag => tag.trim().replace(/\s+/g, '')).filter(tag => tag.length > 0);

    if (newTags.length > 0) {
      const uniqueNewTags = newTags.filter(tag => !tags.includes(tag));
      if (uniqueNewTags.length > 0) {
        onTagsChange([...tags, ...uniqueNewTags]);
        setTagInput("");
      }
    }
    clearSuggestions();
  };

  const handleSelectSuggestion = (tag: string) => {
    if (disabled) return;
    if (!tags.includes(tag)) {
      onTagsChange([...tags, tag]);
    }
    setTagInput("");
    clearSuggestions();
    document.getElementById('tagInput')?.focus();
  };

  const handleRemoveTag = (tagToRemove: string) => {
    if (disabled) return;
    onTagsChange(tags.filter(tag => tag !== tagToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (suggestions.length > 0 && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault();
      const direction = e.key === "ArrowDown" ? 1 : -1;
      setHighlightedIndex(prev => {
        const next = prev + direction;
        if (next < 0) return suggestions.length - 1;
        if (next >= suggestions.length) return 0;
        return next;
      });
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      if (highlightedIndex >= 0 && suggestions[highlightedIndex]) {
        handleSelectSuggestion(suggestions[highlightedIndex]);
      } else {
        handleAddTag();
      }
    } else if (e.key === "Escape" && suggestions.length > 0) {
      // Stop the dropdown-close Escape from bubbling to an enclosing
      // Dialog, which would otherwise close the whole modal instead.
      e.stopPropagation();
      clearSuggestions();
    } else if (e.key === "Backspace" && tagInput === "" && tags.length > 0) {
      e.preventDefault();
      handleRemoveTag(tags[tags.length - 1]);
    }
  };

  const handleFocus = () => {
    ensureKnownTagsLoaded();
  };

  const handleBlur = () => {
    // Add tag when input loses focus and there's text
    if (tagInput.trim()) {
      handleAddTag();
    }
    clearSuggestions();
  };

  return (
    <div className={`space-y-2 ${className}`} ref={containerRef}>
      {label !== "" && (
        <Label className="flex items-center gap-2">
          <Hash className="h-4 w-4" />
          {label} {required && <span className="text-destructive">*</span>}
        </Label>
      )}

      <div className="relative">
        <div
          className={`${dense ? "min-h-[36px] py-1.5" : "min-h-[40px] py-2"} w-full px-3 border rounded-md bg-background text-foreground shadow-xs dark:bg-input/30 dark:border-input focus-within:outline-none focus-within:ring-2 focus-within:ring-primary flex flex-wrap gap-1 items-center ${
            error && tags.length === 0 ? "border-destructive" : ""
          } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
          onClick={() => !disabled && document.getElementById('tagInput')?.focus()}
        >
          {tags.map((tag) => (
            <TagBadge
              key={tag}
              tag={tag}
              size="sm"
              showIcon={true}
              showDelete={!disabled}
              onDelete={disabled ? undefined : () => handleRemoveTag(tag)}
            />
          ))}
          <input
            id="tagInput"
            type="text"
            placeholder={tags.length === 0 ? placeholder : ""}
            value={tagInput}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            onBlur={handleBlur}
            disabled={disabled}
            autoComplete="off"
            role="combobox"
            aria-expanded={suggestions.length > 0}
            aria-autocomplete="list"
            className="flex-1 min-w-[120px] bg-transparent border-none outline-none text-sm disabled:cursor-not-allowed"
          />
        </div>

        {suggestions.length > 0 && (
          <ul
            role="listbox"
            className="absolute z-10 mt-1 w-full min-w-[160px] rounded-md border bg-popover text-popover-foreground shadow-md overflow-hidden"
          >
            {suggestions.map((suggestion, index) => (
              <li key={suggestion} role="option" aria-selected={index === highlightedIndex}>
                <button
                  type="button"
                  // onMouseDown fires before the input's onBlur, so the
                  // suggestion is selected instead of being dismissed.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelectSuggestion(suggestion);
                  }}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left ${
                    index === highlightedIndex ? "bg-accent text-accent-foreground" : "hover:bg-accent hover:text-accent-foreground"
                  }`}
                >
                  <Hash className="h-3 w-3 shrink-0 opacity-60" />
                  {suggestion}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {showHelp && helpText && (
        <div className="text-xs text-muted-foreground">
          {helpText}
        </div>
      )}
    </div>
  );
}
