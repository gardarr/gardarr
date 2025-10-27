import { useState, useEffect, useMemo, useRef } from "react";
import { X, Server, Check, ChevronsUpDown, HardDrive, Download, Link, FileText, Globe, Database, Folder } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AgentIcon } from "@/components/ui/AgentIcon";
import { SelectCategory } from "@/components/SelectCategory";
import { SelectTags } from "@/components/SelectTags";
import { convertMagnetUriToTaskMagnetLink } from "@/services/torrents";
import type { Agent } from "@/types/agent";
import type { CreateTaskRequest, TaskMagnetLink } from "@/types/torrent";
import type { Category } from "@/types/category";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = bytes / Math.pow(k, i);
  return `${value.toFixed(value >= 100 ? 0 : value >= 10 ? 1 : 2)} ${sizes[i]}`;
}

interface AddTorrentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (agentId: string, taskData: CreateTaskRequest) => Promise<void>;
  agents: Agent[];
}

export function AddTorrentModal({ isOpen, onClose, onSubmit, agents }: AddTorrentModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [magnetUri, setMagnetUri] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [category, setCategory] = useState("");
  const [directory, setDirectory] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [agentDropdownOpen, setAgentDropdownOpen] = useState(false);
  const [parsedMagnetLink, setParsedMagnetLink] = useState<TaskMagnetLink | null>(null);
  const agentDropdownRef = useRef<HTMLDivElement>(null);

  // Filter only active agents
  const activeAgents = useMemo(() => {
    return agents.filter(agent => agent.status === 'ACTIVE');
  }, [agents]);

  // Get selected agent info
  const selectedAgent = useMemo(() => {
    return activeAgents.find(agent => agent.uuid === selectedAgentId);
  }, [activeAgents, selectedAgentId]);

  // Get free space of selected agent
  const freeSpace = useMemo(() => {
    return selectedAgent?.instance?.server?.free_space_on_disk || 0;
  }, [selectedAgent]);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedAgentId(activeAgents.length > 0 ? activeAgents[0].uuid : "");
      setSelectedCategoryId("");
      setMagnetUri("");
      setCategory("");
      setDirectory("");
      setTags([]);
      setErrors({});
      setParsedMagnetLink(null);
      setIsSubmitting(false);
    }
  }, [isOpen, activeAgents]);

  // Parse magnet URI when it changes
  useEffect(() => {
    if (magnetUri.trim() && magnetUri.startsWith("magnet:")) {
      const parsed = convertMagnetUriToTaskMagnetLink(magnetUri.trim());
      setParsedMagnetLink(parsed);
    } else {
      setParsedMagnetLink(null);
    }
  }, [magnetUri]);

  const handleCategoryChange = (categoryId: string, category?: Category) => {
    setSelectedCategoryId(categoryId);
    setErrors({ ...errors, category: "" });
    
    if (categoryId && category) {
      setCategory(category.name);
      setTags([...(category.default_tags || [])]);
      setDirectory(category.directory || "");
    } else {
      setCategory("");
      setTags([]);
      setDirectory("");
    }
  };

  const handleAgentChange = (agentId: string) => {
    setSelectedAgentId(agentId);
    setErrors({ ...errors, agent: "" });
    setAgentDropdownOpen(false);
  };

  // Close modal on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [isOpen, onClose]);

  // Close agent dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (agentDropdownRef.current && !agentDropdownRef.current.contains(event.target as Node)) {
        setAgentDropdownOpen(false);
      }
    };

    if (agentDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [agentDropdownOpen]);


  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!selectedAgentId) {
      newErrors.agent = "Selecione um agente";
    }

    if (!magnetUri.trim()) {
      newErrors.magnetUri = "Magnet URI é obrigatório";
    } else if (!magnetUri.startsWith("magnet:")) {
      newErrors.magnetUri = "Magnet URI deve começar com 'magnet:'";
    }

    if (!selectedCategoryId) {
      newErrors.category = "Selecione uma categoria";
    }

    if (tags.length === 0) {
      newErrors.tags = "Adicione pelo menos uma tag";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const taskData: CreateTaskRequest = {
        magnet_uri: magnetUri.trim(),
        category: category.trim(),
        tags: tags,
        ...(directory.trim() && { directory: directory.trim() }),
      };

      await onSubmit(selectedAgentId, taskData);
      // Fechar modal apenas se sucesso (onSubmit irá fechar em caso de erro)
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-card border rounded-lg shadow-lg w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Download className="h-4 w-4 text-primary" />
            </div>
            <h2 className="text-2xl font-bold">Adicionar Torrent</h2>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Magnet URI */}
          <div className="space-y-2">
            <Label htmlFor="magnetUri" className="flex items-center gap-2">
              <Link className="h-4 w-4" />
              Magnet URI <span className="text-destructive">*</span>
            </Label>
            <Input
              id="magnetUri"
              type="text"
              placeholder="magnet:?xt=urn:btih:..."
              value={magnetUri}
              onChange={(e) => {
                setMagnetUri(e.target.value);
                setErrors({ ...errors, magnetUri: "" });
              }}
              className={errors.magnetUri ? "border-destructive" : ""}
            />
            {errors.magnetUri && (
              <p className="text-sm text-destructive">{errors.magnetUri}</p>
            )}
            
            {/* Parsed Magnet Information */}
            {parsedMagnetLink && (
              <div className="mt-3 p-4 bg-muted/50 rounded-lg border">
                <div className="flex items-center gap-2 mb-3">
                  <Database className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium text-foreground">Informações do Torrent</span>
                </div>
                
                <div className="space-y-2">
                  {/* Display Name */}
                  {parsedMagnetLink.display_name && (
                    <div className="flex items-center gap-2">
                      <FileText className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Nome:</span>
                      <span className="text-xs font-medium text-foreground truncate">
                        {parsedMagnetLink.display_name}
                      </span>
                    </div>
                  )}
                  
                  {/* Trackers Count */}
                  {parsedMagnetLink.trackers.length > 0 && (
                    <div className="flex items-center gap-2">
                      <Globe className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Trackers:</span>
                      <span className="text-xs font-medium text-foreground">
                        {parsedMagnetLink.trackers.length} encontrado(s)
                      </span>
                    </div>
                  )}
                  
                  {/* Exact Length */}
                  {parsedMagnetLink.exact_length && (
                    <div className="flex items-center gap-2">
                      <HardDrive className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Tamanho:</span>
                      <span className="text-xs font-medium text-foreground">
                        {formatBytes(parseInt(parsedMagnetLink.exact_length))}
                      </span>
                    </div>
                  )}
                  
                </div>
              </div>
            )}
          </div>

          {/* Category Selection */}
          <SelectCategory
            selectedCategoryId={selectedCategoryId}
            onCategoryChange={handleCategoryChange}
            label="Categoria"
            required={true}
            error={errors.category}
            showAddButton={true}
          />

          {/* Directory (Optional) */}
          <div className="space-y-2">
            <Label htmlFor="directory" className="flex items-center gap-2">
              <Folder className="h-4 w-4" />
              Diretório <span className="text-muted-foreground text-xs">(opcional)</span>
              {selectedCategoryId && (
                <span className="text-xs text-blue-600 ml-2">(preenchido automaticamente)</span>
              )}
            </Label>
            <Input
              id="directory"
              type="text"
              placeholder="Ex: /downloads/movies"
              value={directory}
              onChange={(e) => setDirectory(e.target.value)}
            />
          </div>

          {/* Tags */}
          <SelectTags
            tags={tags}
            onTagsChange={setTags}
            label="Tags"
            required={true}
            error={errors.tags}
            placeholder="Digite uma tag e pressione Enter"
            showHelp={!!(selectedCategoryId && tags.length > 0)}
            helpText="(preenchidas automaticamente)"
          />

          {/* Agent Selection */}
          <div className="space-y-2">
            <Label htmlFor="agent" className="flex items-center gap-2">
              <Server className="h-4 w-4" />
              Agente <span className="text-destructive">*</span>
            </Label>
            <div className="relative" ref={agentDropdownRef}>
              <Button
                type="button"
                variant="outline"
                onClick={() => setAgentDropdownOpen(!agentDropdownOpen)}
                disabled={activeAgents.length === 0}
                className={`w-full justify-between ${errors.agent ? "border-destructive" : ""}`}
              >
                <div className="flex items-center gap-2">
                  {selectedAgentId ? (
                    (() => {
                      const selectedAgent = activeAgents.find(agent => agent.uuid === selectedAgentId);
                      return selectedAgent ? (
                        <AgentIcon 
                          iconName={selectedAgent.icon}
                          color={selectedAgent.color}
                          size="sm"
                        />
                      ) : (
                        <Server className="h-4 w-4 text-muted-foreground" />
                      );
                    })()
                  ) : (
                    <Server className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="truncate">
                    {selectedAgentId 
                      ? activeAgents.find(agent => agent.uuid === selectedAgentId)?.name 
                      : activeAgents.length === 0 
                        ? "Nenhum agente ativo disponível"
                        : "Selecione um agente"
                    }
                  </span>
                </div>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
              
              {agentDropdownOpen && activeAgents.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-60 overflow-auto">
                  {activeAgents.map((agent) => (
                    <button
                      key={agent.uuid}
                      type="button"
                      onClick={() => handleAgentChange(agent.uuid)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground text-left"
                    >
                      <AgentIcon 
                        iconName={agent.icon}
                        color={agent.color}
                        size="md"
                      />
                      <span className="flex-1 truncate">{agent.name}</span>
                      {selectedAgentId === agent.uuid && (
                        <Check className="h-4 w-4 text-primary" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {errors.agent && (
              <p className="text-sm text-destructive">{errors.agent}</p>
            )}
            {selectedAgentId && freeSpace > 0 && (
              <div className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
                <HardDrive className="h-3 w-3" />
                <span>Espaço livre em disco: {formatBytes(freeSpace)}</span>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex gap-3 justify-end pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || activeAgents.length === 0}
            >
              {isSubmitting ? "Adicionando..." : "Adicionar"}
            </Button>
          </div>
        </form>
      </div>

    </div>
  );
}

