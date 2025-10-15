import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronDown, Check, HardDrive } from "lucide-react";
import type { Agent } from "@/types/agent";
import { AgentIcon } from "@/components/ui/AgentIcon";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = bytes / Math.pow(k, i);
  return `${value.toFixed(value >= 100 ? 0 : value >= 10 ? 1 : 2)} ${sizes[i]}`;
}

export function AgentFilter({
  agents,
  selectedAgentIds,
  onToggleAgent,
  onSetAll,
}: {
  agents: Agent[];
  selectedAgentIds: Set<string>;
  onToggleAgent: (id: string) => void;
  onSetAll: (checked: boolean) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const allSelected = agents.length > 0 && selectedAgentIds.size === agents.length;
  const someSelected = selectedAgentIds.size > 0 && !allSelected;

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 min-w-[100px] justify-between text-xs sm:min-w-[140px] sm:text-sm w-full"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label="Filtrar por agent"
      >
        <span className="truncate">
          {allSelected ? "Todos" : someSelected ? `${selectedAgentIds.size} agent${selectedAgentIds.size > 1 ? 's' : ''}` : "Nenhum"}
        </span>
        <ChevronDown className={`h-3.5 w-3.5 sm:h-4 sm:w-4 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
      </Button>
      {isOpen && (
        <div 
          className="absolute right-0 mt-1 w-64 rounded-md border bg-card text-card-foreground shadow-md z-[100] py-1"
          role="listbox"
          aria-label="Filtrar por agents"
        >
          <button
            className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
            onClick={() => onSetAll(true)}
            role="option"
            aria-selected={allSelected}
          >
            <span className="flex items-center gap-2">
              <AgentIcon size="md" className="w-4 h-4" />
              Todos
            </span>
            {allSelected && <Check className="h-4 w-4" />}
          </button>
          <div className="my-1 h-px bg-border" />
          {agents.map((a) => {
            const selected = selectedAgentIds.has(a.uuid);
            const freeSpace = a.instance?.server?.free_space_on_disk || 0;
            return (
              <button
                key={a.uuid}
                className={`w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground ${selected ? 'bg-muted' : ''}`}
                onClick={() => onToggleAgent(a.uuid)}
                role="option"
                aria-selected={selected}
                title={`${a.name} - Espaço livre: ${formatBytes(freeSpace)}`}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <AgentIcon 
                    iconName={a.icon}
                    color={a.color}
                    size="md"
                    className="w-4 h-4 flex-shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate max-w-[140px]">{a.name}</div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <HardDrive className="h-3 w-3" />
                      <span>{formatBytes(freeSpace)}</span>
                    </div>
                  </div>
                </div>
                {selected && <span className="text-xs flex-shrink-0">✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default AgentFilter;
