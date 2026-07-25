import { useState, type ReactNode } from "react";
import { Check, Copy, Edit, Save, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { useCopyToClipboard } from "./useCopyToClipboard";

interface InlineEditableTextProps {
  icon: LucideIcon;
  /** Current persisted value; seeds the input when entering edit mode */
  value: string;
  /** Custom read-mode content; defaults to the plain value */
  display?: ReactNode;
  editLabel: string;
  saveLabel: string;
  /** Text copied by the copy button; omit to hide the button */
  copyText?: string;
  /** Return false to keep edit mode open (e.g. save failed) */
  onSave: (value: string) => Promise<boolean | void> | boolean | void;
  className?: string;
}

export function InlineEditableText({
  icon: Icon,
  value,
  display,
  editLabel,
  saveLabel,
  copyText,
  onSave,
  className,
}: InlineEditableTextProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedValue, setEditedValue] = useState("");
  const { copiedField, copyToClipboard } = useCopyToClipboard();

  const handleToggle = async () => {
    if (isEditing) {
      if (editedValue.trim() === "") return;
      const result = await onSave(editedValue.trim());
      if (result !== false) {
        setIsEditing(false);
      }
    } else {
      setEditedValue(value);
      setIsEditing(true);
    }
  };

  const handleCancel = () => {
    setEditedValue(value);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      void handleToggle();
    } else if (e.key === "Escape") {
      // keep the dialog open — Escape only cancels the inline edit
      e.stopPropagation();
      handleCancel();
    }
  };

  return (
    <div className={`flex items-start gap-2 ${className ?? ""}`}>
      <div className="flex items-start gap-2 p-2 sm:p-3 container-content-background/50 rounded-lg border min-w-0 flex-1">
        <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
        {isEditing ? (
          <Input
            value={editedValue}
            onChange={(e) => setEditedValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className="text-xs sm:text-sm font-medium flex-1 h-8 px-2"
            autoFocus
          />
        ) : (
          <div className="flex-1 min-w-0">{display ?? (
            <span className="text-xs sm:text-sm font-medium break-all leading-relaxed">{value}</span>
          )}</div>
        )}
        {!isEditing && copyText && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => copyToClipboard(copyText, "value")}
            className="h-8 w-8 p-0 flex-shrink-0"
          >
            {copiedField === "value" ? (
              <Check className="h-4 w-4 text-green-600" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        )}
      </div>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="default"
            size="sm"
            onClick={handleToggle}
            className="h-8 w-8 p-0 flex-shrink-0 mt-1 sm:mt-2"
            aria-label={isEditing ? saveLabel : editLabel}
          >
            {isEditing ? <Save className="h-4 w-4" /> : <Edit className="h-4 w-4" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{isEditing ? saveLabel : editLabel}</TooltipContent>
      </Tooltip>
    </div>
  );
}
