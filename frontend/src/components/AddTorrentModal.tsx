import { useState, useEffect, useMemo, useRef } from "react";
import { X, Server, Check, ChevronsUpDown, HardDrive, Download, Link, FileText, Globe, Database, Folder } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WorkerIcon } from "@/components/ui/WorkerIcon";
import { SelectCategory } from "@/components/SelectCategory";
import { SelectTags } from "@/components/SelectTags";
import { convertMagnetUriToTaskMagnetLink } from "@/services/torrents";
import { formatBytes } from "@/utils/bytes";
import { useTranslation } from "react-i18next";
import type { Worker } from "@/types/worker";
import type { CreateTaskRequest, TaskMagnetLink } from "@/types/torrent";
import type { Category } from "@/types/category";

interface AddTorrentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (workerId: string, taskData: CreateTaskRequest) => Promise<void>;
  workers: Worker[];
}

export function AddTorrentModal({ isOpen, onClose, onSubmit, workers }: AddTorrentModalProps) {
  const { t } = useTranslation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>("");
  const [magnetUri, setMagnetUri] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [category, setCategory] = useState("");
  const [directory, setDirectory] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [workerDropdownOpen, setWorkerDropdownOpen] = useState(false);
  const [parsedMagnetLink, setParsedMagnetLink] = useState<TaskMagnetLink | null>(null);
  const workerDropdownRef = useRef<HTMLDivElement>(null);

  // Filter only active workers
  const activeWorkers = useMemo(() => {
    return workers.filter(worker => worker.status === 'ACTIVE');
  }, [workers]);

  // Get selected worker info
  const selectedWorker = useMemo(() => {
    return activeWorkers.find(worker => worker.uuid === selectedWorkerId);
  }, [activeWorkers, selectedWorkerId]);

  // Get free space of selected worker
  const freeSpace = useMemo(() => {
    return selectedWorker?.instance?.server?.free_space_on_disk || 0;
  }, [selectedWorker]);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedWorkerId(activeWorkers.length > 0 ? activeWorkers[0].uuid : "");
      setSelectedCategoryId("");
      setMagnetUri("");
      setCategory("");
      setDirectory("");
      setTags([]);
      setErrors({});
      setParsedMagnetLink(null);
      setIsSubmitting(false);
    }
  }, [isOpen, activeWorkers]);

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

  const handleWorkerChange = (workerId: string) => {
    setSelectedWorkerId(workerId);
    setErrors({ ...errors, worker: "" });
    setWorkerDropdownOpen(false);
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

  // Close worker dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (workerDropdownRef.current && !workerDropdownRef.current.contains(event.target as Node)) {
        setWorkerDropdownOpen(false);
      }
    };

    if (workerDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [workerDropdownOpen]);


  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!selectedWorkerId) {
      newErrors.worker = t("torrents.addModal.errors.workerRequired");
    }

    if (!magnetUri.trim()) {
      newErrors.magnetUri = t("torrents.addModal.errors.magnetRequired");
    } else if (!magnetUri.startsWith("magnet:")) {
      newErrors.magnetUri = t("torrents.addModal.errors.magnetInvalidPrefix");
    }

    if (!selectedCategoryId) {
      newErrors.category = t("torrents.addModal.errors.categoryRequired");
    }

    if (tags.length === 0) {
      newErrors.tags = t("torrents.addModal.errors.tagsRequired");
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

      await onSubmit(selectedWorkerId, taskData);
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
            <h2 className="text-2xl font-bold">{t("torrents.addTorrent")}</h2>
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
              {t("torrents.addModal.magnetUri.label")} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="magnetUri"
              type="text"
              placeholder={t("torrents.addModal.magnetUri.placeholder")}
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
                  <span className="text-sm font-medium text-foreground">{t("torrents.addModal.magnetInfo.title")}</span>
                </div>
                
                <div className="space-y-2">
                  {/* Display Name */}
                  {parsedMagnetLink.display_name && (
                    <div className="flex items-center gap-2">
                      <FileText className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">{t("torrents.addModal.magnetInfo.name")}:</span>
                      <span className="text-xs font-medium text-foreground truncate">
                        {parsedMagnetLink.display_name}
                      </span>
                    </div>
                  )}
                  
                  {/* Trackers Count */}
                  {parsedMagnetLink.trackers.length > 0 && (
                    <div className="flex items-center gap-2">
                      <Globe className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">{t("torrents.addModal.magnetInfo.trackers")}:</span>
                      <span className="text-xs font-medium text-foreground">
                        {t("torrents.addModal.magnetInfo.trackersCount", { count: parsedMagnetLink.trackers.length })}
                      </span>
                    </div>
                  )}
                  
                  {/* Exact Length */}
                  {parsedMagnetLink.exact_length && (
                    <div className="flex items-center gap-2">
                      <HardDrive className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">{t("torrents.addModal.magnetInfo.size")}:</span>
                      <span className="text-xs font-medium text-foreground">
                        {formatBytes(Number.parseInt(parsedMagnetLink.exact_length, 10))}
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
            label={t("torrents.addModal.category.label")}
            required={true}
            error={errors.category}
            showAddButton={true}
          />

          {/* Directory (Optional) */}
          <div className="space-y-2">
            <Label htmlFor="directory" className="flex items-center gap-2">
              <Folder className="h-4 w-4" />
              {t("torrents.addModal.directory.label")} <span className="text-muted-foreground text-xs">({t("torrents.addModal.directory.optional")})</span>
              {selectedCategoryId && (
                <span className="text-xs text-blue-600 ml-2">({t("torrents.addModal.directory.autoFilled")})</span>
              )}
            </Label>
            <Input
              id="directory"
              type="text"
              placeholder={t("torrents.addModal.directory.placeholder")}
              value={directory}
              onChange={(e) => setDirectory(e.target.value)}
            />
          </div>

          {/* Tags */}
          <SelectTags
            tags={tags}
            onTagsChange={setTags}
            label={t("torrents.addModal.tags.label")}
            required={true}
            error={errors.tags}
            placeholder={t("torrents.addModal.tags.placeholder")}
            showHelp={!!(selectedCategoryId && tags.length > 0)}
            helpText={`(${t("torrents.addModal.tags.autoFilled")})`}
          />

          {/* Worker Selection */}
          <div className="space-y-2">
            <Label htmlFor="worker" className="flex items-center gap-2">
              <Server className="h-4 w-4" />
              {t("torrents.addModal.worker.label")} <span className="text-destructive">*</span>
            </Label>
            <div className="relative" ref={workerDropdownRef}>
              <Button
                type="button"
                variant="outline"
                onClick={() => setWorkerDropdownOpen(!workerDropdownOpen)}
                disabled={activeWorkers.length === 0}
                className={`w-full justify-between ${errors.worker ? "border-destructive" : ""}`}
              >
                <div className="flex items-center gap-2">
                  {selectedWorkerId ? (
                    (() => {
                      const selectedWorker = activeWorkers.find(worker => worker.uuid === selectedWorkerId);
                      return selectedWorker ? (
                        <WorkerIcon 
                          iconName={selectedWorker.icon}
                          color={selectedWorker.color}
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
                    {selectedWorkerId 
                      ? activeWorkers.find(worker => worker.uuid === selectedWorkerId)?.name 
                      : activeWorkers.length === 0 
                        ? t("torrents.addModal.worker.noneAvailable")
                        : t("torrents.addModal.worker.select")
                    }
                  </span>
                </div>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
              
              {workerDropdownOpen && activeWorkers.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-60 overflow-auto">
                  {activeWorkers.map((worker) => (
                    <button
                      key={worker.uuid}
                      type="button"
                      onClick={() => handleWorkerChange(worker.uuid)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground text-left"
                    >
                      <WorkerIcon 
                        iconName={worker.icon}
                        color={worker.color}
                        size="md"
                      />
                      <span className="flex-1 truncate">{worker.name}</span>
                      {selectedWorkerId === worker.uuid && (
                        <Check className="h-4 w-4 text-primary" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {errors.worker && (
              <p className="text-sm text-destructive">{errors.worker}</p>
            )}
            {selectedWorkerId && freeSpace > 0 && (
              <div className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
                <HardDrive className="h-3 w-3" />
                <span>{t("torrents.addModal.worker.freeSpace")} {formatBytes(freeSpace)}</span>
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
              {t("common.cancel")}
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || activeWorkers.length === 0}
            >
              {isSubmitting ? t("torrents.addModal.submitting") : t("torrents.addModal.submit")}
            </Button>
          </div>
        </form>
      </div>

    </div>
  );
}

