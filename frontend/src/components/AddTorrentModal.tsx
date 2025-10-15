import { useState, useEffect, useMemo, useRef } from "react";
import { X, Tag, Server, Folder, Check, ChevronsUpDown, HardDrive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AgentIcon } from "@/components/ui/AgentIcon";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { categoryService } from "@/services/categories";
import type { Agent } from "@/types/agent";
import type { CreateTaskRequest } from "@/types/torrent";
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
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [agentDropdownOpen, setAgentDropdownOpen] = useState(false);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);
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

  // Load categories when modal opens
  useEffect(() => {
    if (isOpen) {
      loadCategories();
    }
  }, [isOpen]);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedAgentId(activeAgents.length > 0 ? activeAgents[0].uuid : "");
      setSelectedCategoryId("");
      setMagnetUri("");
      setCategory("");
      setDirectory("");
      setTagInput("");
      setTags([]);
      setErrors({});
      setIsSubmitting(false);
    }
  }, [isOpen, activeAgents]);

  const loadCategories = async () => {
    try {
      const response = await categoryService.listCategories();
      if (response.data) {
        setCategories(response.data);
      }
    } catch (err) {
      console.error('Failed to load categories:', err);
    }
  };

  const handleCategoryChange = (categoryId: string) => {
    setSelectedCategoryId(categoryId);
    setErrors({ ...errors, category: "" });
    setCategoryDropdownOpen(false);
    
    if (categoryId) {
      const selectedCategory = categories.find(cat => cat.id === categoryId);
      if (selectedCategory) {
        setCategory(selectedCategory.name);
        setTags([...(selectedCategory.default_tags || [])]);
        setDirectory(selectedCategory.directories?.[0] || "");
      }
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

  // Close category dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target as Node)) {
        setCategoryDropdownOpen(false);
      }
    };

    if (categoryDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [categoryDropdownOpen]);

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

  const handleAddTag = () => {
    const trimmedTag = tagInput.trim();
    if (trimmedTag && !tags.includes(trimmedTag)) {
      setTags([...tags, trimmedTag]);
      setTagInput("");
      setErrors({ ...errors, tags: "" });
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };


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
          <h2 className="text-2xl font-bold">Adicionar Torrent</h2>
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
          {/* Agent Selection */}
          <div className="space-y-2">
            <Label htmlFor="agent">
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

          {/* Magnet URI */}
          <div className="space-y-2">
            <Label htmlFor="magnetUri">
              Magnet URI <span className="text-destructive">*</span>
            </Label>
            <textarea
              id="magnetUri"
              rows={5}
              placeholder="magnet:?xt=urn:btih:..."
              value={magnetUri}
              onChange={(e) => {
                setMagnetUri(e.target.value);
                setErrors({ ...errors, magnetUri: "" });
              }}
              className={`w-full px-3 py-2 border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none ${
                errors.magnetUri ? "border-destructive" : ""
              }`}
            />
            {errors.magnetUri && (
              <p className="text-sm text-destructive">{errors.magnetUri}</p>
            )}
          </div>

          {/* Category Selection */}
          <div className="space-y-2">
            <Label htmlFor="category">
              Categoria <span className="text-destructive">*</span>
            </Label>
            <div className="relative" ref={categoryDropdownRef}>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCategoryDropdownOpen(!categoryDropdownOpen)}
                className={`w-full justify-between ${errors.category ? "border-destructive" : ""}`}
              >
                <div className="flex items-center gap-2">
                  {selectedCategoryId ? (
                    (() => {
                      const selectedCategory = categories.find(cat => cat.id === selectedCategoryId);
                      return selectedCategory ? (
                        <CategoryIcon 
                          iconName={selectedCategory.icon}
                          color={selectedCategory.color}
                          size="sm"
                        />
                      ) : (
                        <Folder className="h-4 w-4 text-muted-foreground" />
                      );
                    })()
                  ) : (
                    <Folder className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="truncate">
                    {selectedCategoryId 
                      ? categories.find(cat => cat.id === selectedCategoryId)?.name 
                      : "Selecione uma categoria"
                    }
                  </span>
                </div>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
              
              {categoryDropdownOpen && (
                <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-60 overflow-auto">
                  {categories.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                      Nenhuma categoria disponível
                    </div>
                  ) : (
                    categories.map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => handleCategoryChange(cat.id)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground text-left"
                      >
                        <CategoryIcon 
                          iconName={cat.icon}
                          color={cat.color}
                          size="sm"
                        />
                        <span className="flex-1 truncate">{cat.name}</span>
                        {selectedCategoryId === cat.id && (
                          <Check className="h-4 w-4 text-primary" />
                        )}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
            {errors.category && (
              <p className="text-sm text-destructive">{errors.category}</p>
            )}
          </div>

          {/* Directory (Optional) */}
          <div className="space-y-2">
            <Label htmlFor="directory">
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
          <div className="space-y-2">
            <Label htmlFor="tagInput">
              Tags <span className="text-destructive">*</span>
              {selectedCategoryId && tags.length > 0 && (
                <span className="text-xs text-blue-600 ml-2">(preenchidas automaticamente)</span>
              )}
            </Label>
            <div 
              className={`min-h-[40px] w-full px-3 py-2 border rounded-md bg-background text-foreground focus-within:outline-none focus-within:ring-2 focus-within:ring-primary flex flex-wrap gap-1 items-center ${
                errors.tags && tags.length === 0 ? "border-destructive" : ""
              }`}
              onClick={() => document.getElementById('tagInput')?.focus()}
            >
              {tags.map((tag) => (
                <div
                  key={tag}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary border border-primary/20 rounded-md text-sm"
                >
                  <Tag className="h-3 w-3" />
                  <span>{tag}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveTag(tag);
                    }}
                    className="ml-1 hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              <input
                id="tagInput"
                type="text"
                placeholder={tags.length === 0 ? "Digite uma tag e pressione Enter" : ""}
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddTag();
                  } else if (e.key === "Backspace" && tagInput === "" && tags.length > 0) {
                    e.preventDefault();
                    handleRemoveTag(tags[tags.length - 1]);
                  }
                }}
                className="flex-1 min-w-[120px] bg-transparent border-none outline-none text-sm"
              />
            </div>
            {errors.tags && (
              <p className="text-sm text-destructive">{errors.tags}</p>
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
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {isSubmitting ? "Adicionando..." : "Adicionar"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

