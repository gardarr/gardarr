import { useEffect, useRef, useState, type ReactNode } from "react";
import { AlertCircle, Check, Copy, Loader2, Pencil, type LucideIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCopyToClipboard } from "./useCopyToClipboard";

type SaveState = "idle" | "saving" | "saved" | "error";

interface AutoSaveFieldProps {
  icon?: LucideIcon;
  /** Current persisted value */
  value: string;
  /** Persist a new value. Return false to signal failure (draft is kept). */
  onSave: (value: string) => Promise<boolean | void> | boolean | void;
  ariaLabel: string;
  placeholder?: string;
  /** Text copied by the copy button; omit to hide it */
  copyText?: string;
  /**
   * Rich read-mode content. When provided the field is click-to-edit:
   * the display is shown until clicked, then it becomes an input that
   * autosaves on blur/Enter. When omitted the input is always open.
   */
  display?: ReactNode;
  className?: string;
  inputClassName?: string;
}

/**
 * Always-open (or click-to-edit) text field that autosaves on blur/Enter.
 * No explicit edit/save/cancel buttons — the value persists as soon as the
 * user leaves the field, with a subtle inline status indicator.
 */
export function AutoSaveField({
  icon: Icon,
  value,
  onSave,
  ariaLabel,
  placeholder,
  copyText,
  display,
  className,
  inputClassName,
}: AutoSaveFieldProps) {
  const clickToEdit = display !== undefined;
  const [draft, setDraft] = useState(value);
  const [isEditing, setIsEditing] = useState(!clickToEdit);
  const [state, setState] = useState<SaveState>("idle");
  const focusedRef = useRef(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { copiedField, copyToClipboard } = useCopyToClipboard();

  // Keep the draft in sync with external updates while the user isn't typing.
  useEffect(() => {
    if (!focusedRef.current) setDraft(value);
  }, [value]);

  useEffect(() => () => {
    if (savedTimer.current) clearTimeout(savedTimer.current);
  }, []);

  const commit = async () => {
    focusedRef.current = false;
    if (clickToEdit) setIsEditing(false);

    const next = draft.trim();
    if (next === "" || next === value.trim()) {
      setDraft(value);
      return;
    }

    setState("saving");
    try {
      const result = await onSave(next);
      if (result === false) {
        setState("error");
        return;
      }
      setState("saved");
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setState("idle"), 1600);
    } catch {
      setState("error");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.currentTarget.blur();
    } else if (e.key === "Escape") {
      e.stopPropagation(); // keep the dialog open
      setDraft(value);
      focusedRef.current = false;
      if (clickToEdit) setIsEditing(false);
      e.currentTarget.blur();
    }
  };

  const status = (
    <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center">
      {state === "saving" && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
      {state === "saved" && <Check className="h-4 w-4 text-green-600" />}
      {state === "error" && <AlertCircle className="h-4 w-4 text-destructive" />}
    </span>
  );

  return (
    <div
      className={cn(
        "group flex items-center gap-2 rounded-lg border container-content-background/50 px-2.5 py-2 transition-colors focus-within:border-primary/60",
        className,
      )}
    >
      {Icon && <Icon className="h-4 w-4 flex-shrink-0 text-muted-foreground" />}

      {isEditing ? (
        <Input
          value={draft}
          autoFocus={clickToEdit}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onFocus={() => {
            focusedRef.current = true;
            setState("idle");
          }}
          onBlur={() => void commit()}
          onKeyDown={handleKeyDown}
          aria-label={ariaLabel}
          className={cn(
            "h-7 flex-1 border-0 bg-transparent px-0 text-xs shadow-none focus-visible:ring-0 sm:text-sm",
            inputClassName,
          )}
        />
      ) : (
        <button
          type="button"
          onClick={() => {
            focusedRef.current = true;
            setIsEditing(true);
          }}
          aria-label={ariaLabel}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <span className="min-w-0 flex-1">{display}</span>
          <Pencil className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
        </button>
      )}

      {state === "idle" && copyText ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => copyToClipboard(copyText, "value")}
          className="h-6 w-6 flex-shrink-0 p-0 opacity-0 transition-opacity group-hover:opacity-100"
          aria-label="Copy"
        >
          {copiedField === "value" ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
        </Button>
      ) : (
        status
      )}
    </div>
  );
}
