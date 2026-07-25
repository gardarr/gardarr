import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Upload, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useTranslation } from "react-i18next";
import type { TaskMetadata } from "@/types/torrent";
import type { Category, CategoryMetadataSource } from "@/types/category";
import { ImageSourceSelector } from "@/components/ImageSourceSelector";
import { TorrentCardPreview } from "./TorrentCardPreview";
import { TorrentCardCompact } from "./TorrentCardCompact";
import { ProviderSearch, type MetadataProvider } from "@/components/ProviderSearch";
import type { MobileTorrent } from "./types";

const noop = () => {};

const METADATA_PROVIDERS: MetadataProvider[] = ["tgdb", "tmdb"];

interface TorrentImageEditorProps {
  readonly taskHash: string;
  readonly taskName: string;
  readonly category?: Category | null;
  readonly metadata?: TaskMetadata | null;
  readonly onUpdate?: (metadata?: TaskMetadata) => void;
}

export function TorrentImageEditor({
  taskHash,
  taskName,
  category,
  metadata,
  onUpdate,
}: TorrentImageEditorProps) {
  const { t } = useTranslation();
  const [imagePreview, setImagePreview] = useState<string | null>(
    metadata?.image_url || null
  );
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [imagePositionY, setImagePositionY] = useState(
    metadata?.image_position_y ?? 50
  );
  const [imageBrightness, setImageBrightness] = useState(() => {
    const rawBrightness = metadata?.image_brightness ?? 65;
    return Math.max(15, Math.min(85, rawBrightness));
  });

  const [isDragging, setIsDragging] = useState(false);
  const [dragStartY, setDragStartY] = useState(0);
  const [imageSource, setImageSource] = useState<"Upload" | "TMDB" | "TGDB">("Upload");
  const [activeProviders, setActiveProviders] = useState<Record<MetadataProvider, boolean>>({
    tgdb: false,
    tmdb: false,
  });
  const isTGDBActive = activeProviders.tgdb;
  const isTMDBActive = activeProviders.tmdb;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const categoryMetadataSource = (category?.metadata_source || "none") as CategoryMetadataSource;

  // Mock torrent for the Card B preview: reuses the real TorrentCardCompact
  // component so the preview never drifts from the actual card markup.
  const mockCardBTorrent: MobileTorrent = {
    id: "preview",
    hash: "preview",
    name: taskName,
    totalSizeBytes: 0,
    downloadRateBps: 10485760, // 10 MB/s
    uploadRateBps: 5242880, // 5 MB/s
    downloadedBytes: 0,
    uploadedBytes: 0,
    status: "DOWNLOADING",
    createdAt: new Date().toISOString(),
    progress: 45,
    ratio: 1.5,
    numSeeds: 25,
    numLeechs: 10,
    category: "",
    canSearchMetadata: false,
    tags: [],
    metadata: metadata
      ? { ...metadata, image_position_y: imagePositionY, image_brightness: imageBrightness }
      : metadata,
  };

  const fetchProviderStatus = useCallback(async (provider: MetadataProvider) => {
    try {
      const response = await api.get<{ active: boolean }>(`/tasks/metadata/providers/${provider}/status`);
      if (response.data) {
        setActiveProviders((prev) => ({ ...prev, [provider]: response.data!.active }));
      }
    } catch (error) {
      console.error(`Failed to fetch ${provider} status`, error);
    }
  }, []);

  useEffect(() => {
    METADATA_PROVIDERS.forEach((provider) => { void fetchProviderStatus(provider); });
  }, [fetchProviderStatus]);

  useEffect(() => {
    if (categoryMetadataSource === "none") return;

    if (activeProviders[categoryMetadataSource]) {
      const source = categoryMetadataSource.toUpperCase() as "TGDB" | "TMDB";
      setImageSource((prev) => (prev === source ? prev : source));
      return;
    }

    setImageSource((prev) => (prev ? prev : "Upload"));
  }, [categoryMetadataSource, activeProviders]);

  // Sincronizar estados quando metadata muda
  useEffect(() => {
    setImagePreview(metadata?.image_url || null);
    setSelectedFile(null);
    setImagePositionY(metadata?.image_position_y ?? 50);
    const rawBrightness = metadata?.image_brightness ?? 65;
    setImageBrightness(Math.max(15, Math.min(85, rawBrightness)));
  }, [metadata]);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error(t('torrentImageEditor.errors.invalidFileType'));
      input.value = ""; // Reset input
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t('torrentImageEditor.errors.fileSizeExceeded'));
      input.value = ""; // Reset input
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

      const response = await api.post<TaskMetadata>(`/tasks/metadata/${taskHash}/image`, formData);

      if (response.error) {
        toast.error(response.error || t('torrentImageEditor.errors.uploadFailed'));
        // Revert preview on error
        setImagePreview(metadata?.image_url || null);
        setSelectedFile(null);
        input.value = ""; // Reset input
        return;
      }

      toast.success(t('torrentImageEditor.success.imageUploaded'));

      setSelectedFile(null);
      input.value = ""; // Reset input to allow re-selection
      onUpdate?.(response.data);
    } catch {
      toast.error(t('torrentImageEditor.errors.uploadFailed'));
      // Revert preview on error
      setImagePreview(metadata?.image_url || null);
      setSelectedFile(null);
      input.value = ""; // Reset input
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteImage = async () => {
    setIsDeleting(true);
    try {
      const response = await api.delete(`/tasks/metadata/${taskHash}/image`);

      if (response.error) {
        toast.error(response.error || t('torrentImageEditor.errors.deleteFailed'));
        return;
      }

      toast.success(t('torrentImageEditor.success.imageDeleted'));

      setImagePreview(null);
      setSelectedFile(null);
      // DELETE returns 204 (no body); build the cleared metadata locally so
      // callers can patch state without a stale image_url.
      onUpdate?.(metadata ? {
        ...metadata,
        image_url: undefined,
        thumbnail_url: undefined,
        image_position_y: undefined,
        image_brightness: undefined,
      } : undefined);
    } catch {
      toast.error(t('torrentImageEditor.errors.deleteFailed'));
    } finally {
      setIsDeleting(false);
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
      const response = await api.put<TaskMetadata>(`/tasks/metadata/${taskHash}/position`, {
        image_position_y: imagePositionY,
      });
      if (response.error) {
        toast.error(response.error || t('torrentImageEditor.errors.savePositionFailed'));
        return;
      }
      toast.success(t('torrentImageEditor.success.positionUpdated'));
      onUpdate?.(response.data);
    } catch {
      toast.error(t('torrentImageEditor.errors.savePositionFailed'));
    }
  };

  const handleBrightnessChange = async (value: number[]) => {
    const newBrightness = value[0];
    setImageBrightness(newBrightness);

    if (!metadata?.image_url) return;

    try {
      const response = await api.put<TaskMetadata>(`/tasks/metadata/${taskHash}/brightness`, {
        image_brightness: newBrightness,
      });
      if (response.error) {
        toast.error(response.error || t('torrentImageEditor.errors.saveBrightnessFailed'));
        return;
      }
      onUpdate?.(response.data);
    } catch {
      toast.error(t('torrentImageEditor.errors.saveBrightnessFailed'));
    }
  };

  let imageContainerCursorClass = "";
  if (!selectedFile) {
    imageContainerCursorClass = isDragging ? "cursor-grabbing" : "cursor-grab";
  }

  return (
    <div className="space-y-6 py-4">
      {/* Image Section */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">
          {t('torrentImageEditor.image.label')}
        </Label>
        <ImageSourceSelector
          value={imageSource}
          onValueChange={setImageSource}
          categoryMetadataSource={categoryMetadataSource}
          isTGDBActive={isTGDBActive}
          isTMDBActive={isTMDBActive}
        />

        {categoryMetadataSource !== "none" && (
          <p className="text-xs text-muted-foreground">
            {t(`torrentImageEditor.sources.restricted.${categoryMetadataSource}`)}
          </p>
        )}

        {imagePreview ? (
          <>
            <Label className="text-sm font-medium">
              {t('torrentImageEditor.imageAdjustments.label')}
            </Label>
            <div
              ref={imageContainerRef}
              className={`relative group ${imageContainerCursorClass}`}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseLeave}
            >
            <div className="relative w-full h-64 overflow-hidden rounded-lg border">
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
              <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} className="border border-white/50" />
                ))}
              </div>
            </div>
            {isUploading ? (
              <div className="absolute top-2 right-2 bg-blue-500 text-white px-2 py-1 rounded text-xs font-medium shadow-md animate-pulse">
                {t('torrentImageEditor.image.uploading')}
              </div>
            ) : selectedFile ? (
              <div className="absolute top-2 right-2 bg-amber-500 text-white px-2 py-1 rounded text-xs font-medium shadow-md">
                {t('torrentImageEditor.image.notSaved')}
              </div>
            ) : metadata?.image_url && (
              <>
                <div className="absolute top-2 right-2 bg-green-500/90 text-white px-2 py-1 rounded text-xs font-medium shadow-md">
                  {t('torrentImageEditor.image.saved')}
                </div>
                {isDragging ? (
                  <div className="absolute top-2 left-2 bg-purple-500/90 text-white px-2 py-1 rounded text-xs font-medium shadow-md">
                    {t('torrentImageEditor.image.position', { position: Math.round(imagePositionY) })}
                  </div>
                ) : (
                  <div className="absolute top-2 left-2 bg-blue-500/90 text-white px-2 py-1 rounded text-xs font-medium shadow-md">
                    {t('torrentImageEditor.image.dragToAdjust')}
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
                {t('torrentImageEditor.image.replace')}
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
                    <>{t('torrentImageEditor.image.deleting')}</>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4 mr-2" />
                      {t('torrentImageEditor.image.remove')}
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
                  {t('torrentImageEditor.image.cancel')}
                </Button>
              )}
            </div>
          </div>
          </>
        ) : imageSource === "TGDB" || imageSource === "TMDB" ? (
          <ProviderSearch
            provider={imageSource === "TGDB" ? "tgdb" : "tmdb"}
            taskHash={taskHash}
            initialQuery={taskName}
            onSelect={(updatedMetadata) => {
              setImageSource("Upload");
              onUpdate?.(updatedMetadata);
            }}
            onCancel={() => setImageSource("Upload")}
          />
        ) : imageSource === "Upload" && (
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
              {t('torrentImageEditor.image.uploadPrompt')}
            </p>
            <p className="text-xs text-muted-foreground">
              {t('torrentImageEditor.image.fileTypes')}
            </p>
            <p className="text-xs text-muted-foreground/70 mt-2">
              {t('torrentImageEditor.image.autoUpload')}
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

        {/* Delete Image Button */}
        {metadata?.image_url && !selectedFile && (
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDeleteImage}
            disabled={isUploading || isDeleting}
            className="w-full"
          >
            {isDeleting ? (
              <>{t('torrentImageEditor.image.deleting')}</>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                {t('torrentImageEditor.image.removeImage')}
              </>
            )}
          </Button>
        )}

        {/* Image Brightness Slider */}
        {metadata?.image_url && !selectedFile && (
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="image-brightness" className="text-sm font-medium">
                {t('torrentImageEditor.brightness.label')}
              </Label>
              <span className="text-xs text-muted-foreground">
                {imageBrightness}%
              </span>
            </div>
            <Slider
              id="image-brightness"
              min={15}
              max={85}
              step={5}
              value={[imageBrightness]}
              onValueChange={(value) => setImageBrightness(value[0])}
              onValueCommit={handleBrightnessChange}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              {t('torrentImageEditor.brightness.hint')}
            </p>
          </div>
        )}
      </div>

      {/* Card Preview Section */}
      {imagePreview && (
        <div className="space-y-3">
          <Label className="text-sm font-medium">
            {t('torrentImageEditor.preview.label')}
          </Label>
          
          <div className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground mb-2">
                {t('torrentImageEditor.preview.normal')}
              </p>
              <TorrentCardPreview
                taskName={taskName}
                metadata={metadata}
                imagePositionY={imagePositionY}
                imageBrightness={imageBrightness}
                compact={false}
              />
            </div>
            
            <div>
              <p className="text-xs text-muted-foreground mb-2">
                {t('torrentImageEditor.preview.compact')}
              </p>
              <TorrentCardPreview
                taskName={taskName}
                metadata={metadata}
                imagePositionY={imagePositionY}
                imageBrightness={imageBrightness}
                compact={true}
              />
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-2">
                {t('torrentImageEditor.preview.cardB')}
              </p>
              <div className="pointer-events-none">
                <TorrentCardCompact
                  torrent={mockCardBTorrent}
                  onShowDetails={noop}
                  onStart={noop}
                  onStop={noop}
                  onRemove={noop}
                  onForceDownload={noop}
                  onForceReannounce={noop}
                  onForceRecheck={noop}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Thumbnail Preview */}
      {metadata?.thumbnail_url && !selectedFile && (
        <div className="space-y-3">
          <Label className="text-sm font-medium">
            {t('torrentImageEditor.thumbnail.label')}
          </Label>
          <img
            src={metadata.thumbnail_url}
            alt={`${taskName} thumbnail`}
            className="w-32 h-32 object-cover rounded-lg border"
          />
        </div>
      )}
    </div>
  );
}
