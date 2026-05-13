import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CustomScrollArea } from "@/components/ui/custom-scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Server,
  Plus,
  Trash2,
  Search,
  Loader2,
  RefreshCw,
  HardDrive,
  Wifi,
  Activity,
  Check,
  AlertTriangle
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { workerService } from "./services/workers";
import type { Worker, UpdateWorkerRequest } from "./types/worker";
import { toast } from "sonner";
import { WorkerIcon } from "./components/ui/WorkerIcon";
import { availableIcons, availableColors } from "./utils/workerUtils";
import { QBittorrentIcon } from "./components/ui/QBittorrentIcon";
import { WorkerDetailsModal } from "./components/WorkerDetailsModal";
import { AddWorkerModal } from "./components/AddWorkerModal";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./components/ui/tooltip";
import { WorkerErrorBadge } from "./components/WorkerErrorDisplay";

function Workers() {
  const { t } = useTranslation();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [workerToDelete, setWorkerToDelete] = useState<Worker | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [workerToEdit, setWorkerToEdit] = useState<Worker | null>(null);
  const [editForm, setEditForm] = useState<UpdateWorkerRequest>({
    name: "",
    url: "",
    username: "",
    password: "",
    icon: "QBittorrent",
    color: "#3b82f6"
  });


  const loadWorkers = useCallback(async () => {
    try {
      setLoading(true);
      const response = await workerService.listWorkers();

      if (response.error) {
        toast.error(response.error);
      } else if (response.data) {
        setWorkers(response.data);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('workers.errors.failedToLoad'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  // Load workers on component mount
  useEffect(() => {
    loadWorkers();
  }, [loadWorkers]);


  const confirmDeleteWorker = (worker: Worker) => {
    setWorkerToDelete(worker);
    setShowDeleteModal(true);
  };

  const handleDeleteWorker = async () => {
    if (!workerToDelete) return;

    try {
      const response = await workerService.deleteWorker(workerToDelete.uuid);
      if (response.error) {
        toast.error(response.error);
      } else {
        setWorkers(workers.filter(w => w.uuid !== workerToDelete.uuid));
        toast.success(t('workers.success.deleted'));
        setShowDeleteModal(false);
        setShowDetailsModal(false);
        setWorkerToDelete(null);
        setSelectedWorker(null);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('workers.errors.failedToDelete'));
    }
  };

  const handleCreateWorkerSuccess = (newWorker: Worker) => {
    setWorkers([...workers, newWorker]);
  };

  const showWorkerDetails = (worker: Worker) => {
    setSelectedWorker(worker);
    setShowDetailsModal(true);
  };

  const showEditWorker = (worker: Worker) => {
    setWorkerToEdit(worker);
    setEditForm({
      name: worker.name,
      url: worker.address,
      username: "",
      password: "",
      icon: worker.icon || "QBittorrent",
      color: worker.color || "#3b82f6"
    });
    setShowEditModal(true);
  };

  const handleUpdateWorker = async () => {
    if (!workerToEdit) return;

    // Only include fields that have been changed
    const updateData: UpdateWorkerRequest = {};
    if (editForm.name && editForm.name !== workerToEdit.name) {
      updateData.name = editForm.name;
    }
    if (editForm.url && editForm.url !== workerToEdit.address) {
      updateData.url = editForm.url;
    }
    if (editForm.username) {
      updateData.username = editForm.username;
    }
    if (editForm.password) {
      updateData.password = editForm.password;
    }
    if (editForm.icon && editForm.icon !== (workerToEdit.icon || "QBittorrent")) {
      updateData.icon = editForm.icon;
    }
    if (editForm.color && editForm.color !== (workerToEdit.color || "#3b82f6")) {
      updateData.color = editForm.color;
    }

    // If no changes, show message and return
    if (Object.keys(updateData).length === 0) {
      toast.error(t('workers.errors.noChangesDetected'));
      return;
    }

    try {
      const response = await workerService.updateWorker(workerToEdit.uuid, updateData);
      if (response.error) {
        toast.error(response.error);
      } else if (response.data) {
        // Update the worker in the list
        const updatedWorkers = workers.map((worker) =>
          worker.uuid === workerToEdit.uuid ? response.data! : worker
        );
        setWorkers(updatedWorkers);

        // Update the selected worker if it's the same one being edited
        if (selectedWorker?.uuid === workerToEdit.uuid) {
          setSelectedWorker(response.data!);
        }

        toast.success(t('workers.success.updated'));
        setShowEditModal(false);
        setShowDetailsModal(false);
        setWorkerToEdit(null);
        setSelectedWorker(null);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('workers.errors.failedToUpdate'));
    }
  };

  // Filter workers
  const filteredWorkers = workers.filter(w =>
    w.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    w.address.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };



  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Server className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">{t('workers.title')}</h1>
            <p className="text-muted-foreground">{t('workers.subtitle')}</p>
          </div>
        </div>
        <div className="flex gap-2 w-full sm:w-auto justify-between sm:justify-end">
          <Button onClick={loadWorkers} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            {t('workers.refresh')}
          </Button>
          <Button onClick={() => setShowCreateForm(true)} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            {t('workers.addWorker')}
          </Button>
        </div>
      </div>

      <AddWorkerModal 
        open={showCreateForm}
        onOpenChange={setShowCreateForm}
        onSuccess={handleCreateWorkerSuccess}
      />

      {/* Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('workers.searchWorkers')}
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Workers List */}
      {loading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">{t('workers.loadingWorkers')}</span>
          </CardContent>
        </Card>
      ) : filteredWorkers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Server className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">{t('workers.noWorkersFound')}</h3>
            <p className="text-muted-foreground text-center mb-4">
              {searchTerm ? t('workers.noWorkersMatch') : t('workers.getStarted')}
            </p>
            {!searchTerm && (
              <Button onClick={() => setShowCreateForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                {t('workers.addWorker')}
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {filteredWorkers.map((worker) => (
              <Card
                key={worker.uuid}
                className={`relative cursor-pointer hover:container-content-background/50 transition-colors ${worker.status === 'ERRORED' ? 'border border-red-500/30' : ''
                  } ${worker.status === 'INITIALIZING' ? 'border border-yellow-500/30' : ''}`}
                onClick={() => showWorkerDetails(worker)}
              >
                <CardContent className="p-0">
                  <div className="flex">
                    {/* Main Content */}
                    <div className="flex-1 p-4">
                      <div className="flex gap-3 items-center">
                        {/* Icon */}
                        <WorkerIcon
                          iconName={worker.icon}
                          color={worker.color}
                          size="lg"
                          className="w-16 h-16 rounded-lg"
                        />

                        {/* Content */}
                        <div className="flex-1 min-w-0 space-y-1.5">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              {worker.status === 'ACTIVE' && (
                                <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] ml-0.5"></div>
                              )}
                              {worker.status === 'ERRORED' && (
                                <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)] ml-0.5"></div>
                              )}
                              {worker.status === 'INITIALIZING' && (
                                <div className="w-2 h-2 rounded-full bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.6)] ml-0.5 animate-pulse"></div>
                              )}
                              <h3 className="font-semibold text-base truncate">{worker.name}</h3>
                              {worker.status === 'ERRORED' && (
                                <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />
                              )}
                              {worker.status === 'INITIALIZING' && (
                                <Loader2 className="h-4 w-4 text-yellow-500 flex-shrink-0 animate-spin" />
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground flex items-center gap-2">
                              <Wifi className="h-3 w-3" />
                              <span className="truncate">{worker.address}</span>
                            </p>
                          </div>

                          <WorkerErrorBadge worker={worker} />

                          {worker.instance && worker.status === 'ACTIVE' && (
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <HardDrive className="h-3 w-3" />
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="cursor-help">{formatBytes(worker.instance.server.free_space_on_disk)}</span>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>{t('workers.freeSpaceOnDisk', 'Free Space on Disk')}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </div>
                              <div className="h-3 w-px bg-border"></div>
                              <div className="flex items-center gap-1">
                                <Activity className="h-3 w-3" />
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="cursor-help">{worker.instance.transfer.global_ratio.toFixed(2)}</span>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>{t('workers.globalRatio', 'Global Ratio')}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Icons - Always displayed on the right */}
                        <div className="flex-shrink-0 flex items-center gap-2">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="cursor-help">
                                  <QBittorrentIcon
                                    size="lg"
                                    className="w-8 h-8 text-muted-foreground/60"
                                  />
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>qBittorrent</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Details Modal */}
          <WorkerDetailsModal
            isOpen={showDetailsModal}
            onClose={() => setShowDetailsModal(false)}
            worker={selectedWorker}
            onEdit={showEditWorker}
            onDelete={confirmDeleteWorker}
          />

          {/* Delete Confirmation Modal */}
          <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{t('workers.deleteWorker')}</DialogTitle>
              </DialogHeader>

              {workerToDelete && (
                  <div className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        {t('workers.confirmDelete.title')} {t('workers.confirmDelete.description')}
                      </p>

                      <div className="flex items-center gap-3 p-3 container-content-background/50 rounded-lg">
                        <WorkerIcon
                          iconName={workerToDelete.icon}
                          color={workerToDelete.color}
                          size="md"
                          className="w-12 h-12 rounded-lg"
                        />
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold text-sm">{workerToDelete.name}</h3>
                          <p className="text-xs text-muted-foreground truncate">{workerToDelete.address}</p>
                        </div>
                      </div>

                      <div className="flex gap-2 justify-end">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setShowDeleteModal(false);
                            setWorkerToDelete(null);
                          }}
                        >
                          {t('workers.cancel')}
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={handleDeleteWorker}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          {t('workers.delete')}
                        </Button>
                      </div>
                  </div>
              )}
            </DialogContent>
          </Dialog>

          {/* Edit Worker Modal */}
          <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
            <DialogContent className="max-w-2xl max-h-[90vh]">
              <DialogHeader>
                <DialogTitle>{t('workers.editWorker')} - {workerToEdit?.name}</DialogTitle>
              </DialogHeader>

              {workerToEdit && (
                <CustomScrollArea className="max-h-[calc(90vh-120px)]" variant="thin" mobileFallback>
                  <div className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="edit-name" className="text-sm">{t('workers.name')}</Label>
                        <Input
                          id="edit-name"
                          placeholder={t('workers.workerName')}
                          value={editForm.name}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                          className="h-9"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="edit-address" className="text-sm">{t('workers.address')}</Label>
                        <Input
                          id="edit-address"
                          placeholder="http://localhost:8080"
                          value={editForm.url}
                          onChange={(e) => setEditForm({ ...editForm, url: e.target.value })}
                          className="h-9"
                        />
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="edit-username" className="text-sm">{t('workers.username', 'Username')} ({t('workers.leaveEmptyToKeep')})</Label>
                        <Input
                          id="edit-username"
                          placeholder={t('workers.usernamePlaceholder', 'qBittorrent username')}
                          value={editForm.username}
                          onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                          className="h-9"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="edit-password" className="text-sm">{t('workers.password', 'Password')} ({t('workers.leaveEmptyToKeep')})</Label>
                        <Input
                          id="edit-password"
                          type="password"
                          placeholder={t('workers.passwordPlaceholder', 'New qBittorrent password')}
                          value={editForm.password}
                          onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                          className="h-9"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="edit-color" className="text-sm">{t('workers.color')}</Label>
                      <div className="flex gap-1.5 flex-wrap">
                        {availableColors.map((color) => (
                          <button
                            key={color.value}
                            type="button"
                            className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${editForm.color === color.value ? 'border-foreground scale-110' : 'border-transparent'
                              }`}
                            style={{ backgroundColor: color.value }}
                            onClick={() => setEditForm({ ...editForm, color: color.value })}
                            title={t(`workers.colors.${color.name.toLowerCase()}`)}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="edit-icon" className="text-sm">{t('workers.icon')}</Label>
                      <div className="flex gap-1.5 flex-wrap">
                        {availableIcons.map((iconItem) => {
                          const IconComponent = iconItem.icon;
                          return (
                            <button
                              key={iconItem.name}
                              type="button"
                              className={`w-8 h-8 rounded-md border-2 flex items-center justify-center transition-all hover:scale-110 ${editForm.icon === iconItem.name ? 'border-foreground bg-accent scale-110' : 'border-border hover:container-content-background/50'
                                }`}
                              onClick={() => setEditForm({ ...editForm, icon: iconItem.name })}
                              title={iconItem.name}
                            >
                              <IconComponent className="h-4 w-4" />
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Preview */}
                    <div className="space-y-1.5">
                      <Label className="text-sm">{t('workers.preview')}</Label>
                      <div className="flex items-center gap-3 p-3 container-content-background/50 rounded-lg">
                        <WorkerIcon
                          iconName={editForm.icon}
                          color={editForm.color}
                          size="md"
                          className="w-12 h-12 rounded-lg"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-sm">
                            {editForm.name || t('workers.workerName')}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {editForm.url || "http://localhost:8080"}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 justify-end pt-1">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowEditModal(false);
                          setWorkerToEdit(null);
                        }}
                        size="sm"
                      >
                        {t('workers.cancel')}
                      </Button>
                      <Button
                        onClick={handleUpdateWorker}
                        size="sm"
                        title={t('workers.updateWorkerInfo', 'Update worker information')}
                      >
                        <Check className="h-4 w-4 mr-1" />
                        {t('workers.updateWorker')}
                      </Button>
                    </div>
                  </div>
                </CustomScrollArea>
              )}
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}

export default Workers;
