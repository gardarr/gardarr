import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ColorPickerProps {
  label: string;
  value: string;
  onChange: (color: string) => void;
  disabled?: boolean;
}

export function ColorPicker({ label, value, onChange, disabled = false }: ColorPickerProps) {
  const [localValue, setLocalValue] = useState(value);
  const isCompact = !label;

  // Sync local value with prop when it changes externally
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = (newValue: string) => {
    setLocalValue(newValue);
    // Validate hex color format
    if (/^#[0-9A-Fa-f]{6}$/.test(newValue)) {
      onChange(newValue);
    }
  };

  // Compact mode: just the color input
  if (isCompact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <input
              type="color"
              value={value}
              onChange={(e) => handleChange(e.target.value)}
              disabled={disabled}
              className="w-8 h-8 rounded border border-border cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
            />
          </TooltipTrigger>
          <TooltipContent>
            <p className="font-mono text-xs">{value.toUpperCase()}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Full mode: label + color input + text input
  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          disabled={disabled}
          className="w-12 h-10 rounded border border-border cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <Input
          type="text"
          value={localValue}
          onChange={(e) => handleChange(e.target.value)}
          disabled={disabled}
          placeholder="#000000"
          maxLength={7}
          className="flex-1 text-sm font-mono uppercase"
        />
      </div>
    </div>
  );
}
