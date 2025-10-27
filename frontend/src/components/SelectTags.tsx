import { useState } from "react";
import { Label } from "@/components/ui/label";
import { TagBadge } from "@/components/ui/TagBadge";
import { Hash } from "lucide-react";

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
  helpText
}: SelectTagsProps) {
  const [tagInput, setTagInput] = useState("");

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
  };

  const handleRemoveTag = (tagToRemove: string) => {
    if (disabled) return;
    onTagsChange(tags.filter(tag => tag !== tagToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddTag();
    } else if (e.key === "Backspace" && tagInput === "" && tags.length > 0) {
      e.preventDefault();
      handleRemoveTag(tags[tags.length - 1]);
    }
  };

  const handleBlur = () => {
    // Add tag when input loses focus and there's text
    if (tagInput.trim()) {
      handleAddTag();
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <Label className="flex items-center gap-2">
        <Hash className="h-4 w-4" />
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      
      <div 
        className={`min-h-[40px] w-full px-3 py-2 border rounded-md bg-background text-foreground focus-within:outline-none focus-within:ring-2 focus-within:ring-primary flex flex-wrap gap-1 items-center ${
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
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          disabled={disabled}
          className="flex-1 min-w-[120px] bg-transparent border-none outline-none text-sm disabled:cursor-not-allowed"
        />
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
