import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { agentService } from "@/services/agents";
import type { Agent } from "@/types/agent";
import { Server, ChevronsUpDown, Check } from "lucide-react";

interface SelectAgentProps {
  selectedAgentId?: string | null;
  onAgentChange: (agentId: string, agent?: Agent) => void;
  onActiveAgents?: (agents: Agent[]) => void;
  label?: string;
  required?: boolean;
  error?: string;
  className?: string;
  autoLoad?: boolean;
}

export function SelectAgent({
  selectedAgentId = null,
  onAgentChange,
  onActiveAgents,
  label = "Agent",
  required = false,
  error,
  className = "",
  autoLoad = true
}: SelectAgentProps) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const didAutoSelectRef = useRef(false);

  const loadAgents = useCallback(async () => {
    try {
      const response = await agentService.listAgents();
      if (response.data) {
        setAgents(response.data);
        // If no selected agent was provided, return all ACTIVE agents to parent
        if (!selectedAgentId && onActiveAgents) {
          const activeAgents = response.data.filter(a => a.status === 'ACTIVE');
          onActiveAgents(activeAgents);
        }
      }
    } catch (err) {
      console.error('Failed to load agents:', err);
    }
  }, [selectedAgentId, onActiveAgents]);

  useEffect(() => {
    if (autoLoad) {
      loadAgents();
    }
  }, [autoLoad, loadAgents]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };

    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [dropdownOpen]);

  

  // Auto-select provided selectedAgentId on mount once agents are loaded
  useEffect(() => {
    if (didAutoSelectRef.current) return;
    if (!selectedAgentId) return;
    if (!agents || agents.length === 0) return;
    const agent = agents.find(a => a.uuid === selectedAgentId);
    if (agent) {
      onAgentChange(selectedAgentId, agent);
      didAutoSelectRef.current = true;
    }
  }, [agents, selectedAgentId, onAgentChange]);

  const handleAgentChange = (agentId: string) => {
    const agent = agents.find(a => a.uuid === agentId);
    onAgentChange(agentId, agent);
    setDropdownOpen(false);
  };

  const selectedAgent = agents.find(a => a.uuid === selectedAgentId);

  return (
    <div className={`space-y-2 ${className}`}>
      <Label className="flex items-center gap-2">
        <Server className="h-4 w-4" />
        {label} {required && <span className="text-destructive">*</span>}
      </Label>

      <div className="relative" ref={dropdownRef}>
        <Button
          type="button"
          variant="outline"
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className={`w-full justify-between ${error ? "border-destructive" : ""}`}
        >
          <div className="flex items-center gap-2">
            <Server className="h-4 w-4 text-muted-foreground" />
            <span className="truncate">
              {selectedAgent ? selectedAgent.name : "Select an agent"}
            </span>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>

        {dropdownOpen && (
          <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-60 overflow-auto">
            {agents.length === 0 ? (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                No agents available
              </div>
            ) : (
              <>
                <button
                  key="all-agents"
                  type="button"
                  onClick={() => handleAgentChange("")}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground text-left"
                >
                  <span className="inline-flex h-2.5 w-2.5 rounded-full bg-muted-foreground" />
                  <span className="flex-1 truncate">Todos</span>
                  {!selectedAgentId && (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                </button>
                {agents.map((agent) => (
                  <button
                    key={agent.uuid}
                    type="button"
                    onClick={() => handleAgentChange(agent.uuid)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground text-left"
                  >
                    <span className="inline-flex h-2.5 w-2.5 rounded-full" style={{ backgroundColor: agent.color || '#9CA3AF' }} />
                    <span className="flex-1 truncate">{agent.name}</span>
                    {selectedAgentId === agent.uuid && (
                      <Check className="h-4 w-4 text-primary" />
                    )}
                  </button>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}


