import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import { useDropdown } from "@/hooks/useDropdown";

interface DropdownSelectProps<T> {
    value: T;
    onChange: (value: T) => void;
    options: T[];
    formatLabel?: (value: T) => string;
    ariaLabel?: string;
    minWidth?: string;
    title?: string;
}

export function DropdownSelect<T extends string | number>({
    value,
    onChange,
    options,
    formatLabel = (v) => String(v),
    ariaLabel,
    minWidth = "80px",
    title
}: DropdownSelectProps<T>) {
    const { isOpen, setIsOpen, ref: dropdownRef } = useDropdown();

    return (
        <div className="relative" ref={dropdownRef}>
            <Button
                variant="outline"
                size="sm"
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-2 justify-between`}
                style={{ minWidth }}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
                aria-label={ariaLabel}
                title={title}
            >
                {formatLabel(value)}
                <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </Button>

            {isOpen && (
                <div
                    className="absolute right-0 mt-1 w-full min-w-fit rounded-md border bg-card text-card-foreground shadow-md z-[100] py-1"
                    role="listbox"
                >
                    {options.map((option) => (
                        <button
                            key={String(option)}
                            className="w-full flex items-center justify-center px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground whitespace-nowrap"
                            onClick={() => {
                                onChange(option);
                                setIsOpen(false);
                            }}
                            role="option"
                            aria-selected={option === value}
                        >
                            {formatLabel(option)}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
