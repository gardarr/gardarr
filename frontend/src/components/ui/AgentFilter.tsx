import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronDown, Server, Check } from "lucide-react";
import type { Agent, AgentStatus } from "@/types/agent";

function getAgentStatusColor(status?: AgentStatus): string {
  switch (status) {
    case "ACTIVE":
      return "text-green-600";
    case "INACTIVE":
      return "text-muted-foreground";
    case "ERRORED":
      return "text-red-600";
    default:
      return "text-muted-foreground";
  }
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
        className="flex items-center gap-2 min-w-[140px] justify-between"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label="Filtrar por agent"
      >
        {allSelected ? "Todos" : someSelected ? `${selectedAgentIds.size} selecionado(s)` : "Nenhum agent"}
        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </Button>
      {isOpen && (
        <div 
          className="absolute right-0 mt-1 w-56 rounded-md border bg-card text-card-foreground shadow-md z-10 py-1"
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
              <Server className="h-4 w-4" />
              Todos
            </span>
            {allSelected && <Check className="h-4 w-4" />}
          </button>
          <div className="my-1 h-px bg-border" />
          {agents.map((a) => {
            const selected = selectedAgentIds.has(a.uuid);
            return (
              <button
                key={a.uuid}
                className={`w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground ${selected ? 'bg-muted' : ''}`}
                onClick={() => onToggleAgent(a.uuid)}
                role="option"
                aria-selected={selected}
                title={a.name}
              >
                <span className="flex items-center gap-2">
                  <Server className={`h-4 w-4 ${getAgentStatusColor(a.status)}`} />
                  <span className="truncate max-w-[180px]">{a.name}</span>
                </span>
                {selected && <span className="text-xs">✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default AgentFilter;


