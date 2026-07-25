import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronsUpDown,
  Database,
  Download,
  FileText,
  FileUp,
  Folder,
  Globe,
  HardDrive,
  Link,
  Loader2,
  Server,
  Sparkles,
  X,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { WorkerIcon } from "@/components/ui/WorkerIcon";
import { SelectCategory } from "@/components/SelectCategory";
import { SelectTags } from "@/components/SelectTags";
import { convertMagnetUriToTaskMagnetLink, torrentService } from "@/services/torrents";
import { workerService } from "@/services/workers";
import { useAddTorrent } from "@/contexts/add-torrent-hooks";
import { useIsPortraitMobileOrTablet } from "@/hooks/use-portrait-mobile-tablet";
import { formatBytes } from "@/utils/bytes";
import { useTranslation } from "react-i18next";
import type { CreateTaskRequest, TaskMagnetLink } from "@/types/torrent";
import type { Category } from "@/types/category";
import type { Worker } from "@/types/worker";

const finalizeButtonClassName =
  "bg-primary text-primary-foreground shadow-[0_0_30px_rgba(59,130,246,0.5),0_0_60px_rgba(59,130,246,0.22)] transition-shadow hover:shadow-[0_0_38px_rgba(59,130,246,0.65),0_0_72px_rgba(59,130,246,0.3)]";

export function AddTorrentModal() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const isPortraitMobileOrTablet = useIsPortraitMobileOrTablet();
  const { isAddModalOpen, addModalMode, closeAddModal, addPendingTorrent, removePendingTorrent } = useAddTorrent();
  const isFileMode = addModalMode === "file";

  const [workers, setWorkers] = useState<Worker[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>("");
  const [magnetUri, setMagnetUri] = useState("");
  const [torrentFile, setTorrentFile] = useState<File | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [category, setCategory] = useState("");
  const [directory, setDirectory] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [workerDropdownOpen, setWorkerDropdownOpen] = useState(false);
  const [parsedMagnetLink, setParsedMagnetLink] = useState<TaskMagnetLink | null>(null);
  const workerDropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeWorkers = useMemo(() => workers.filter((worker) => worker.status === "ACTIVE"), [workers]);
  const selectedWorker = useMemo(
    () => activeWorkers.find((worker) => worker.uuid === selectedWorkerId),
    [activeWorkers, selectedWorkerId]
  );
  const freeSpace = useMemo(() => selectedWorker?.instance?.server?.free_space_on_disk || 0, [selectedWorker]);

  useEffect(() => {
    if (!isAddModalOpen) {
      return;
    }

    setSelectedWorkerId("");
    setSelectedCategoryId("");
    setMagnetUri("");
    setTorrentFile(null);
    setCategory("");
    setDirectory("");
    setTags([]);
    setErrors({});
    setParsedMagnetLink(null);
    setCreateError("");
    setIsCreating(false);
    setWorkerDropdownOpen(false);

    let cancelled = false;
    workerService
      .listWorkers()
      .then((response) => {
        if (!cancelled && response.data) {
          setWorkers(response.data);
        }
      })
      .catch((error) => {
        console.error("Failed to load workers:", error);
      });

    return () => {
      cancelled = true;
    };
  }, [isAddModalOpen]);

  useEffect(() => {
    if (!isAddModalOpen || selectedWorkerId !== "") {
      return;
    }

    setSelectedWorkerId(activeWorkers.length > 0 ? activeWorkers[0].uuid : "");
  }, [isAddModalOpen, activeWorkers, selectedWorkerId]);

  useEffect(() => {
    if (magnetUri.trim() && magnetUri.startsWith("magnet:")) {
      setParsedMagnetLink(convertMagnetUriToTaskMagnetLink(magnetUri.trim()));
      return;
    }

    setParsedMagnetLink(null);
  }, [magnetUri]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (workerDropdownRef.current && !workerDropdownRef.current.contains(event.target as Node)) {
        setWorkerDropdownOpen(false);
      }
    };

    if (!workerDropdownOpen) {
      return;
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [workerDropdownOpen]);

  const isBusy = isCreating;

  const validate = (): boolean => {
    const nextErrors: Record<string, string> = {};

    if (isFileMode) {
      if (!torrentFile) {
        nextErrors.magnetUri = t("torrents.addModal.errors.fileRequired");
      } else if (!torrentFile.name.toLowerCase().endsWith(".torrent")) {
        nextErrors.magnetUri = t("torrents.addModal.errors.fileInvalidExtension");
      }
    } else if (!magnetUri.trim()) {
      nextErrors.magnetUri = t("torrents.addModal.errors.magnetRequired");
    } else if (!magnetUri.startsWith("magnet:")) {
      nextErrors.magnetUri = t("torrents.addModal.errors.magnetInvalidPrefix");
    } else if (!parsedMagnetLink?.hash) {
      nextErrors.magnetUri = t("torrents.addModal.errors.magnetInvalidPrefix");
    }

    if (!selectedCategoryId) {
      nextErrors.category = t("torrents.addModal.errors.categoryRequired");
    }

    if (!selectedWorkerId) {
      nextErrors.worker = t("torrents.addModal.errors.workerRequired");
    }

    if (tags.length === 0) {
      nextErrors.tags = t("torrents.addModal.errors.tagsRequired");
    }

    setErrors({
      magnetUri: nextErrors.magnetUri || "",
      category: nextErrors.category || "",
      worker: nextErrors.worker || "",
      tags: nextErrors.tags || "",
    });

    return Object.keys(nextErrors).length === 0;
  };

  const handleCategoryChange = (categoryId: string, nextCategory?: Category) => {
    setSelectedCategoryId(categoryId);
    setErrors((current) => ({ ...current, category: "" }));

    if (categoryId && nextCategory) {
      setCategory(nextCategory.name);
      setTags([...(nextCategory.default_tags || [])]);
      setDirectory(nextCategory.default_directory || "");
      return;
    }

    setCategory("");
    setTags([]);
    setDirectory("");
  };

  const handleWorkerChange = (workerId: string) => {
    setSelectedWorkerId(workerId);
    setErrors((current) => ({ ...current, worker: "" }));
    setWorkerDropdownOpen(false);
  };

  const handleSubmitFile = async () => {
    if (!torrentFile) {
      return;
    }

    const workerId = selectedWorkerId;
    setIsCreating(true);
    setCreateError("");
    closeAddModal();
    if (location.pathname !== "/torrents") {
      navigate("/torrents");
    }

    try {
      const response = await torrentService.createTaskFromFile(workerId, torrentFile, {
        category: category.trim(),
        directory: directory.trim() || undefined,
        tags,
      });

      if (response.error) {
        throw new Error(response.error);
      }

      // Sem hash conhecido de antemão: o card real chega via evento WS
      // TORRENT_ADDED (sem placeholder otimista, diferente do fluxo magnet).
      toast.success(t("torrents.notifications.addSuccess"));
    } catch (error) {
      const errorMessage = error instanceof Error && error.message ? error.message : t("torrents.error");
      toast.error(t("torrents.notifications.addError", { error: errorMessage }));
    } finally {
      setIsCreating(false);
    }
  };

  const handleSubmitMagnet = async () => {
    if (!parsedMagnetLink?.hash) {
      return;
    }

    const hash = parsedMagnetLink.hash.toLowerCase();
    const parsedSize = parsedMagnetLink.exact_length
      ? Number.parseInt(parsedMagnetLink.exact_length, 10)
      : undefined;

    const taskData: CreateTaskRequest = {
      magnet_uri: magnetUri.trim(),
      category: category.trim(),
      tags,
      ...(directory.trim() && { directory: directory.trim() }),
    };
    const workerId = selectedWorkerId;

    setIsCreating(true);
    setCreateError("");

    addPendingTorrent({
      hash,
      name: parsedMagnetLink.display_name || hash,
      size: Number.isFinite(parsedSize) ? parsedSize : undefined,
      workerId,
      category: taskData.category,
      addedAt: Date.now(),
    });

    closeAddModal();
    if (location.pathname !== "/torrents") {
      navigate("/torrents");
    }

    try {
      const response = await torrentService.createTask(workerId, taskData);

      if (response.error || !response.data?.hash) {
        throw new Error(response.error || t("torrents.addModal.errors.taskHashMissing"));
      }

      toast.success(t("torrents.notifications.addSuccess"));
    } catch (error) {
      removePendingTorrent(hash);
      const errorMessage = error instanceof Error && error.message ? error.message : t("torrents.error");
      toast.error(t("torrents.notifications.addError", { error: errorMessage }));
    } finally {
      setIsCreating(false);
    }
  };

  const handleSubmit = async () => {
    if (isBusy || !validate()) {
      return;
    }

    if (isFileMode) {
      await handleSubmitFile();
    } else {
      await handleSubmitMagnet();
    }
  };

  const handleRequestClose = () => {
    if (!isBusy) {
      closeAddModal();
    }
  };

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isAddModalOpen && !isBusy) {
        closeAddModal();
      }
    };

    if (!isAddModalOpen) {
      return;
    }

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isAddModalOpen, isBusy, closeAddModal]);

  if (!isAddModalOpen) {
    return null;
  }

  const content = (
    <form
      className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden"
      onSubmit={(event) => {
        event.preventDefault();
        void handleSubmit();
      }}
    >
      <div className="z-20 flex items-center justify-between border-b bg-card p-4 sm:p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <Download className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">{t("torrents.addTorrent")}</h2>
            <p className="text-sm text-muted-foreground">{t("torrents.addModal.subtitle")}</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={handleRequestClose} className="h-8 w-8" type="button">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="h-full min-h-0 min-w-0">
        <div className="space-y-6 p-4 pt-5 sm:p-6">
          {createError && (
            <p
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {createError}
            </p>
          )}

          {isFileMode ? (
            <div className="space-y-2">
              <Label htmlFor="torrentFile" className="flex items-center gap-2">
                <FileUp className="h-4 w-4" />
                {t("torrents.addModal.file.label")} <span className="text-destructive">*</span>
              </Label>
              <input
                ref={fileInputRef}
                id="torrentFile"
                type="file"
                accept=".torrent"
                className="hidden"
                disabled={isBusy}
                onChange={(event) => {
                  setTorrentFile(event.target.files?.[0] ?? null);
                  setErrors((current) => ({ ...current, magnetUri: "" }));
                }}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={isBusy}
                className={`w-full justify-start gap-2 ${errors.magnetUri ? "border-destructive" : ""}`}
              >
                <FileUp className="h-4 w-4" />
                <span className="truncate">
                  {torrentFile ? torrentFile.name : t("torrents.addModal.file.placeholder")}
                </span>
              </Button>
              {errors.magnetUri && <p className="text-sm text-destructive">{errors.magnetUri}</p>}
            </div>
          ) : (
          <div className="space-y-2">
            <Label htmlFor="magnetUri" className="flex items-center gap-2">
              <Link className="h-4 w-4" />
              {t("torrents.addModal.magnetUri.label")} <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="magnetUri"
              placeholder={t("torrents.addModal.magnetUri.placeholder")}
              value={magnetUri}
              onChange={(event) => {
                setMagnetUri(event.target.value);
                setErrors((current) => ({ ...current, magnetUri: "" }));
              }}
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                  event.preventDefault();
                  void handleSubmit();
                }
              }}
              className={`min-h-28 resize-y whitespace-pre-wrap break-all font-mono text-sm ${errors.magnetUri ? "border-destructive" : ""}`}
              disabled={isBusy}
            />
            {errors.magnetUri && <p className="text-sm text-destructive">{errors.magnetUri}</p>}

            {parsedMagnetLink && (
              <div className="mt-3 min-w-0 space-y-3 overflow-hidden rounded-lg border bg-muted/50 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Database className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium text-foreground">{t("torrents.addModal.magnetInfo.title")}</span>
                </div>

                {parsedMagnetLink.display_name && (
                  <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-start gap-2 text-xs">
                    <FileText className="h-3 w-3 text-muted-foreground" />
                    <div className="min-w-0">
                      <span className="block text-muted-foreground">{t("torrents.addModal.magnetInfo.name")}:</span>
                      <span className="block break-words font-medium text-foreground">{parsedMagnetLink.display_name}</span>
                    </div>
                  </div>
                )}

                {parsedMagnetLink.hash && !isPortraitMobileOrTablet && (
                  <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-start gap-2 text-xs">
                    <Sparkles className="h-3 w-3 text-muted-foreground" />
                    <div className="min-w-0">
                      <span className="block text-muted-foreground">{t("torrents.addModal.magnetInfo.hash")}:</span>
                      <span className="block break-all font-mono text-foreground">{parsedMagnetLink.hash}</span>
                    </div>
                  </div>
                )}

                {parsedMagnetLink.trackers.length > 0 && (
                  <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-start gap-2 text-xs">
                    <Globe className="h-3 w-3 text-muted-foreground" />
                    <div className="min-w-0">
                      <span className="block text-muted-foreground">{t("torrents.addModal.magnetInfo.trackers")}:</span>
                      <span className="block break-words font-medium text-foreground">
                        {t("torrents.addModal.magnetInfo.trackersCount", { count: parsedMagnetLink.trackers.length })}
                      </span>
                    </div>
                  </div>
                )}

                {parsedMagnetLink.exact_length && (
                  <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-start gap-2 text-xs">
                    <HardDrive className="h-3 w-3 text-muted-foreground" />
                    <div className="min-w-0">
                      <span className="block text-muted-foreground">{t("torrents.addModal.magnetInfo.size")}:</span>
                      <span className="block break-words font-medium text-foreground">
                        {formatBytes(Number.parseInt(parsedMagnetLink.exact_length, 10))}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          )}

          <SelectCategory
            selectedCategoryId={selectedCategoryId}
            onCategoryChange={handleCategoryChange}
            label={t("torrents.addModal.category.label")}
            required={true}
            error={errors.category}
            showAddButton={true}
          />

          <div className="space-y-2">
            <Label htmlFor="directory" className="flex items-center gap-2">
              <Folder className="h-4 w-4" />
              {t("torrents.addModal.directory.label")}
              <span className="text-xs text-muted-foreground">({t("torrents.addModal.directory.optional")})</span>
              {selectedCategoryId && directory && (
                <span className="ml-2 text-xs text-blue-600">({t("torrents.addModal.directory.autoFilled")})</span>
              )}
            </Label>
            <Input
              id="directory"
              type="text"
              placeholder={t("torrents.addModal.directory.placeholder")}
              value={directory}
              onChange={(event) => setDirectory(event.target.value)}
              disabled={isBusy}
            />
          </div>

          <SelectTags
            tags={tags}
            onTagsChange={(nextTags) => {
              setTags(nextTags);
              if (nextTags.length > 0) {
                setErrors((current) => ({ ...current, tags: "" }));
              }
            }}
            label={t("torrents.addModal.tags.label")}
            required={true}
            error={errors.tags}
            placeholder={t("torrents.addModal.tags.placeholder")}
            showHelp={!!(selectedCategoryId && tags.length > 0)}
            helpText={`(${t("torrents.addModal.tags.autoFilled")})`}
            disabled={isBusy}
          />

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
                disabled={activeWorkers.length === 0 || isBusy}
                className={`w-full justify-between ${errors.worker ? "border-destructive" : ""}`}
              >
                <div className="flex items-center gap-2">
                  {selectedWorker ? (
                    <WorkerIcon iconName={selectedWorker.icon} color={selectedWorker.color} size="sm" />
                  ) : (
                    <Server className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="truncate">
                    {selectedWorker?.name ||
                      (activeWorkers.length === 0
                        ? t("torrents.addModal.worker.noneAvailable")
                        : t("torrents.addModal.worker.select"))}
                  </span>
                </div>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>

              {workerDropdownOpen && activeWorkers.length > 0 && (
                <div className="absolute bottom-full z-50 mb-1 max-h-60 w-full overflow-auto rounded-md border border-border bg-background shadow-lg">
                  {activeWorkers.map((worker) => (
                    <button
                      key={worker.uuid}
                      type="button"
                      onClick={() => handleWorkerChange(worker.uuid)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                    >
                      <WorkerIcon iconName={worker.icon} color={worker.color} size="md" />
                      <span className="flex-1 truncate">{worker.name}</span>
                      {selectedWorkerId === worker.uuid && <Check className="h-4 w-4 text-primary" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {errors.worker && <p className="text-sm text-destructive">{errors.worker}</p>}

            {selectedWorkerId && freeSpace > 0 && (
              <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                <HardDrive className="h-3 w-3" />
                <span>{t("torrents.addModal.worker.freeSpace")} {formatBytes(freeSpace)}</span>
              </div>
            )}
          </div>
        </div>
      </ScrollArea>

      <div className="z-20 border-t bg-card px-4 py-4 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <Button type="button" variant="outline" onClick={handleRequestClose} disabled={isBusy}>
            {t("common.cancel")}
          </Button>

          <Button
            type="submit"
            disabled={isBusy || activeWorkers.length === 0}
            className={`min-w-28 ${finalizeButtonClassName}`}
          >
            {isCreating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("torrents.addModal.actions.creating")}
              </>
            ) : (
              t("torrents.addModal.actions.add")
            )}
          </Button>
        </div>
      </div>
    </form>
  );

  if (isPortraitMobileOrTablet) {
    return (
      <Sheet
        open={isAddModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            handleRequestClose();
          }
        }}
      >
        <SheetContent
          side="bottom"
          hideClose
          className="flex h-[calc(100dvh-0.5rem)] w-full max-w-none flex-col gap-0 overflow-x-hidden rounded-t-2xl border-x border-t p-0"
        >
          {content}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <button
        type="button"
        aria-label={t("common.cancel")}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleRequestClose}
      />
      <div className="relative mx-2 grid max-h-[calc(100dvh-1rem)] w-full max-w-2xl grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-lg border bg-card shadow-lg sm:mx-4">
        {content}
      </div>
    </div>
  );
}
