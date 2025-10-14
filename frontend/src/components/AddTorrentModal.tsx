import { useState, useEffect } from "react";
import { X, Plus, Tag, Server } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Agent } from "@/types/agent";
import type { CreateTaskRequest } from "@/types/torrent";

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
  const [category, setCategory] = useState("");
  const [directory, setDirectory] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedAgentId(agents.length > 0 ? agents[0].uuid : "");
      setMagnetUri("");
      setCategory("");
      setDirectory("");
      setTagInput("");
      setTags([]);
      setErrors({});
      setIsSubmitting(false);
    }
  }, [isOpen, agents]);

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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddTag();
    }
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

    if (!category.trim()) {
      newErrors.category = "Categoria é obrigatória";
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
            <div className="relative">
              <Server className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <select
                id="agent"
                value={selectedAgentId}
                onChange={(e) => {
                  setSelectedAgentId(e.target.value);
                  setErrors({ ...errors, agent: "" });
                }}
                className="w-full pl-10 pr-3 py-2 border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                disabled={agents.length === 0}
              >
                {agents.length === 0 ? (
                  <option value="">Nenhum agente disponível</option>
                ) : (
                  agents.map((agent) => (
                    <option key={agent.uuid} value={agent.uuid}>
                      {agent.name} ({agent.status})
                    </option>
                  ))
                )}
              </select>
            </div>
            {errors.agent && (
              <p className="text-sm text-destructive">{errors.agent}</p>
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

          {/* Category */}
          <div className="space-y-2">
            <Label htmlFor="category">
              Categoria <span className="text-destructive">*</span>
            </Label>
            <Input
              id="category"
              type="text"
              placeholder="Ex: movies, series, music"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setErrors({ ...errors, category: "" });
              }}
              className={errors.category ? "border-destructive" : ""}
            />
            {errors.category && (
              <p className="text-sm text-destructive">{errors.category}</p>
            )}
          </div>

          {/* Directory (Optional) */}
          <div className="space-y-2">
            <Label htmlFor="directory">
              Diretório <span className="text-muted-foreground text-xs">(opcional)</span>
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
            </Label>
            <div className="flex gap-2">
              <Input
                id="tagInput"
                type="text"
                placeholder="Digite uma tag e pressione Enter"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleKeyDown}
                className={errors.tags && tags.length === 0 ? "border-destructive" : ""}
              />
              <Button
                type="button"
                onClick={handleAddTag}
                variant="outline"
                size="icon"
                disabled={!tagInput.trim()}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {tags.map((tag) => (
                  <div
                    key={tag}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-secondary rounded-md text-sm"
                  >
                    <Tag className="h-3 w-3" />
                    <span>{tag}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
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
              disabled={isSubmitting || agents.length === 0}
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

