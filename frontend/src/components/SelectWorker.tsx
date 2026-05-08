import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { workerService } from "@/services/workers";
import type { Worker } from "@/types/worker";
import { Server, ChevronsUpDown, Check } from "lucide-react";

interface SelectWorkerProps {
  selectedWorkerId?: string | null;
  onWorkerChange: (workerId: string, worker?: Worker) => void;
  onActiveWorkers?: (workers: Worker[]) => void;
  label?: string;
  required?: boolean;
  error?: string;
  className?: string;
  autoLoad?: boolean;
}

export function SelectWorker({
  selectedWorkerId = null,
  onWorkerChange,
  onActiveWorkers,
  label = "Worker",
  required = false,
  error,
  className = "",
  autoLoad = true
}: SelectWorkerProps) {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const didAutoSelectRef = useRef(false);

  const loadWorkers = useCallback(async () => {
    try {
      const response = await workerService.listWorkers();
      if (response.data) {
        setWorkers(response.data);
        // If no selected worker was provided, return all ACTIVE workers to parent
        if (!selectedWorkerId && onActiveWorkers) {
          const activeWorkers = response.data.filter((w) => w.status === "ACTIVE");
          onActiveWorkers(activeWorkers);
        }
      }
    } catch (err) {
      console.error("Failed to load workers:", err);
    }
  }, [selectedWorkerId, onActiveWorkers]);

  useEffect(() => {
    if (autoLoad) {
      loadWorkers();
    }
  }, [autoLoad, loadWorkers]);

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

  // Auto-select provided selectedWorkerId on mount once workers are loaded
  useEffect(() => {
    if (didAutoSelectRef.current) return;
    if (!selectedWorkerId) return;
    if (!workers || workers.length === 0) return;
    const worker = workers.find((w) => w.uuid === selectedWorkerId);
    if (worker) {
      onWorkerChange(selectedWorkerId, worker);
      didAutoSelectRef.current = true;
    }
  }, [workers, selectedWorkerId, onWorkerChange]);

  const handleWorkerChange = (workerId: string) => {
    const worker = workers.find((w) => w.uuid === workerId);
    onWorkerChange(workerId, worker);
    setDropdownOpen(false);
  };

  const selectedWorker = workers.find((w) => w.uuid === selectedWorkerId);

  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <Label className="flex items-center gap-2">
          <Server className="h-4 w-4" />
          {label} {required && <span className="text-destructive">*</span>}
        </Label>
      )}

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
              {selectedWorker ? selectedWorker.name : "Select a worker"}
            </span>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>

        {dropdownOpen && (
          <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-60 overflow-auto">
            {workers.length === 0 ? (
              <div className="px-3 py-2 text-sm text-muted-foreground">No workers available</div>
            ) : (
              <>
                <button
                  key="all-workers"
                  type="button"
                  onClick={() => handleWorkerChange("")}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground text-left"
                >
                  <span className="inline-flex h-2.5 w-2.5 rounded-full bg-muted-foreground" />
                  <span className="flex-1 truncate">Todos</span>
                  {!selectedWorkerId && <Check className="h-4 w-4 text-primary" />}
                </button>
                {workers.map((worker) => (
                  <button
                    key={worker.uuid}
                    type="button"
                    onClick={() => handleWorkerChange(worker.uuid)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground text-left"
                  >
                    <span
                      className="inline-flex h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: worker.color || "#9CA3AF" }}
                    />
                    <span className="flex-1 truncate">{worker.name}</span>
                    {selectedWorkerId === worker.uuid && <Check className="h-4 w-4 text-primary" />}
                  </button>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
