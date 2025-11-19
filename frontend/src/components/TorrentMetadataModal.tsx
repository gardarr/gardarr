import { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Image, Upload, Trash2, X, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { TaskMetadata } from "@/types/torrent";

interface TorrentMetadataModalProps {
  isOpen: boolean;
  taskHash: string;
  taskName: string;
  metadata?: TaskMetadata | null;
  onClose: () => void;
  onUpdate: () => void;
}

export function TorrentMetadataModal({
  isOpen,
  taskHash,
  taskName,
  metadata,
  onClose,
  onUpdate,
}: TorrentMetadataModalProps) {
  const [description, setDescription] = useState(metadata?.description || "");
  const [imagePreview, setImagePreview] = useState<string | null>(
    metadata?.image_url || null
  );
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [imagePositionY, setImagePositionY] = useState(metadata?.image_position_y || 50);
  const [imageOpacity, setImageOpacity] = useState(() => {
    const opacity = metadata?.image_opacity || 65;
    return Math.max(15, Math.min(85, opacity));
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartY, setDragStartY] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);

  // Sincronizar estados quando o modal abre ou metadata muda
  useEffect(() => {
    if (isOpen) {
      setDescription(metadata?.description || "");
      setImagePreview(metadata?.image_url || null);
      setSelectedFile(null);
      setImagePositionY(metadata?.image_position_y || 50);
      const opacity = metadata?.image_opacity || 65;
      setImageOpacity(Math.max(15, Math.min(85, opacity)));
    }
  }, [isOpen, metadata]);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Por favor, selecione um arquivo de imagem válido");
      event.target.value = ""; // Reset input
      return;
    }

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 10MB");
      event.target.value = ""; // Reset input
      return;
    }

    setSelectedFile(file);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Auto-upload after selection
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("image", file);

      await api.post(`/tasks/metadata/${taskHash}/image`, formData);

      toast.success("Imagem enviada com sucesso");

      setSelectedFile(null);
      event.target.value = ""; // Reset input to allow re-selection
      onUpdate();
    } catch (error: unknown) {
      const errorMessage = error && typeof error === 'object' && 'response' in error
        ? (error as { response?: { data?: { error?: string } } }).response?.data?.error
        : undefined;
      toast.error(errorMessage || "Erro ao enviar imagem");
      // Revert preview on error
      setImagePreview(metadata?.image_url || null);
      setSelectedFile(null);
      event.target.value = ""; // Reset input
    } finally {
      setIsUploading(false);
    }
  };


  const handleDeleteImage = async () => {
    setIsDeleting(true);
    try {
      await api.delete(`/tasks/metadata/${taskHash}/image`);

      toast.success("Imagem removida com sucesso");

      setImagePreview(null);
      setSelectedFile(null);
      onUpdate();
    } catch (error: unknown) {
      const errorMessage = error && typeof error === 'object' && 'response' in error
        ? (error as { response?: { data?: { error?: string } } }).response?.data?.error
        : undefined;
      toast.error(errorMessage || "Erro ao remover imagem");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSaveDescription = async () => {
    try {
      await api.put(`/tasks/metadata/${taskHash}/description`, {
        description,
      });

      toast.success("Descrição atualizada com sucesso");

      onUpdate();
    } catch (error: unknown) {
      const errorMessage = error && typeof error === 'object' && 'response' in error
        ? (error as { response?: { data?: { error?: string } } }).response?.data?.error
        : undefined;
      toast.error(errorMessage || "Erro ao salvar descrição");
    }
  };

  const handleCopyImageUrl = async () => {
    if (metadata?.image_url) {
      try {
        await navigator.clipboard.writeText(metadata.image_url);
        setIsCopied(true);
        toast.success("URL copiada para a área de transferência");
        setTimeout(() => setIsCopied(false), 2000);
      } catch {
        toast.error("Erro ao copiar URL");
      }
    }
  };

  // Image position drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!imagePreview || selectedFile) return;
    
    // Don't start drag if clicking on buttons or interactive elements
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('[role="button"]')) {
      return;
    }
    
    setIsDragging(true);
    setDragStartY(e.clientY);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !imageContainerRef.current) return;
    
    const container = imageContainerRef.current;
    const containerHeight = container.clientHeight;
    const deltaY = e.clientY - dragStartY;
    const deltaPercent = (deltaY / containerHeight) * 100;
    
    // Update position (0-100, clamped)
    const newPosition = Math.max(0, Math.min(100, imagePositionY - deltaPercent));
    setImagePositionY(newPosition);
    setDragStartY(e.clientY);
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    // Don't save position if releasing on a button
    const target = e.target as HTMLElement;
    const isButton = target.closest('button') || target.closest('[role="button"]');
    
    if (isDragging && !isButton) {
      setIsDragging(false);
      handleSaveImagePosition();
    } else if (isDragging) {
      // Just cancel dragging without saving
      setIsDragging(false);
    }
  };

  const handleMouseLeave = () => {
    // Cancel dragging when mouse leaves container
    if (isDragging) {
      setIsDragging(false);
    }
  };

  const handleSaveImagePosition = async () => {
    if (!metadata?.image_url) return;
    
    try {
      await api.put(`/tasks/metadata/${taskHash}/position`, {
        image_position_y: imagePositionY,
      });
      toast.success("Posição da imagem atualizada");
      onUpdate();
    } catch (error: unknown) {
      const errorMessage = error && typeof error === 'object' && 'response' in error
        ? (error as { response?: { data?: { error?: string } } }).response?.data?.error
        : undefined;
      toast.error(errorMessage || "Erro ao salvar posição");
    }
  };

  const handleOpacityChange = async (value: number[]) => {
    const newOpacity = value[0];
    setImageOpacity(newOpacity);
    
    if (!metadata?.image_url) return;
    
    try {
      await api.put(`/tasks/metadata/${taskHash}/opacity`, {
        image_opacity: newOpacity,
      });
      onUpdate();
    } catch (error: unknown) {
      const errorMessage = error && typeof error === 'object' && 'response' in error
        ? (error as { response?: { data?: { error?: string } } }).response?.data?.error
        : undefined;
      toast.error(errorMessage || "Erro ao salvar opacidade");
    }
  };

  const handleClose = () => {
    setDescription(metadata?.description || "");
    setImagePreview(metadata?.image_url || null);
    setSelectedFile(null);
    onClose();
  };

  const hasChanges =
    description !== (metadata?.description || "") || 
    selectedFile !== null ||
    imagePositionY !== (metadata?.image_position_y || 50) ||
    imageOpacity !== Math.max(15, Math.min(85, metadata?.image_opacity || 65));

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Image className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-lg">Metadados do Torrent</DialogTitle>
              <DialogDescription className="line-clamp-1">
                {taskName}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Image Section */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Imagem</Label>

            {imagePreview ? (
              <div 
                ref={imageContainerRef}
                className="relative group"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseLeave}
              >
                <div className={`w-full h-64 overflow-hidden rounded-lg border ${!selectedFile && metadata?.image_url ? 'cursor-move' : ''} ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}>
                  <img
                    src={imagePreview}
                    alt={taskName}
                    className="w-full h-full object-cover select-none"
                    style={{ 
                      objectPosition: `center ${imagePositionY}%`,
                      pointerEvents: 'none'
                    }}
                    draggable={false}
                  />
                </div>
                {isUploading ? (
                  <div className="absolute top-2 right-2 bg-blue-500 text-white px-2 py-1 rounded text-xs font-medium shadow-md animate-pulse">
                    Enviando...
                  </div>
                ) : selectedFile ? (
                  <div className="absolute top-2 right-2 bg-amber-500 text-white px-2 py-1 rounded text-xs font-medium shadow-md">
                    Não salvo
                  </div>
                ) : metadata?.image_url && (
                  <>
                    <div className="absolute top-2 right-2 bg-green-500/90 text-white px-2 py-1 rounded text-xs font-medium shadow-md">
                      Salvo
                    </div>
                    {!isDragging && (
                      <div className="absolute top-2 left-2 bg-blue-500/90 text-white px-2 py-1 rounded text-xs font-medium shadow-md">
                        Arraste para ajustar
                      </div>
                    )}
                    {isDragging && (
                      <div className="absolute top-2 left-2 bg-purple-500/90 text-white px-2 py-1 rounded text-xs font-medium shadow-md">
                        Posição: {Math.round(imagePositionY)}%
                      </div>
                    )}
                  </>
                )}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    disabled={isUploading || isDeleting}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Trocar
                  </Button>
                  {metadata?.image_url && !selectedFile && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteImage();
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                      disabled={isUploading || isDeleting}
                    >
                      {isDeleting ? (
                        <>Removendo...</>
                      ) : (
                        <>
                          <Trash2 className="h-4 w-4 mr-2" />
                          Remover
                        </>
                      )}
                    </Button>
                  )}
                  {selectedFile && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFile(null);
                        setImagePreview(metadata?.image_url || null);
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      <X className="h-4 w-4 mr-2" />
                      Cancelar
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div
                role="button"
                tabIndex={0}
                className="border-2 border-dashed rounded-lg p-12 text-center cursor-pointer hover:bg-accent/50 transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
              >
                <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground mb-1">
                  Clique para fazer upload de uma imagem
                </p>
                <p className="text-xs text-muted-foreground">
                  PNG, JPG, GIF, WEBP até 10MB
                </p>
                <p className="text-xs text-muted-foreground/70 mt-2">
                  O upload será feito automaticamente após a seleção
                </p>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
              disabled={isUploading}
            />

            {/* Image Opacity Slider */}
            {metadata?.image_url && !selectedFile && (
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="image-opacity" className="text-sm font-medium">
                    Opacidade da Imagem
                  </Label>
                  <span className="text-xs text-muted-foreground">
                    {imageOpacity}%
                  </span>
                </div>
                <Slider
                  id="image-opacity"
                  min={15}
                  max={85}
                  step={5}
                  value={[imageOpacity]}
                  onValueChange={handleOpacityChange}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  Ajuste entre 15% (mais transparente) e 85% (mais visível)
                </p>
              </div>
            )}
          </div>

          {/* Image URL Section */}
          {metadata?.image_url && !selectedFile && (
            <div className="space-y-3">
              <Label htmlFor="image-url" className="text-sm font-medium">URL da Imagem</Label>
              <div className="flex gap-2">
                <Input
                  id="image-url"
                  value={metadata.image_url}
                  readOnly
                  className="font-mono text-xs"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyImageUrl}
                  className="flex-shrink-0"
                >
                  {isCopied ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Thumbnail Preview */}
          {metadata?.thumbnail_url && !selectedFile && (
            <div className="space-y-3">
              <Label className="text-sm font-medium">Thumbnail</Label>
              <img
                src={metadata.thumbnail_url}
                alt={`${taskName} thumbnail`}
                className="w-32 h-32 object-cover rounded-lg border"
              />
            </div>
          )}

          {/* Description Section */}
          <div className="space-y-3">
            <Label htmlFor="description" className="text-sm font-medium">
              Descrição
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
              placeholder="Adicione uma descrição personalizada..."
              className="min-h-[100px] resize-none"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose}>
            Fechar
          </Button>
          {hasChanges && !selectedFile && (
            <Button onClick={handleSaveDescription}>Salvar Alterações</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
