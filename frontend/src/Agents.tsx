import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  X,
  Check,
  Eye,
  EyeOff,
  Lock,
  Pin,
  AlertTriangle
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { agentService } from "./services/agents";
import type { Agent, CreateAgentRequest, UpdateAgentRequest } from "./types/agent";
import { toast } from "sonner";
import { AgentIcon } from "./components/ui/AgentIcon";
import { availableIcons, availableColors } from "./utils/agentUtils";
import { QBittorrentIcon } from "./components/ui/QBittorrentIcon";
import { AgentDetailsModal } from "./components/AgentDetailsModal";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./components/ui/tooltip";
import { AgentErrorBadge } from "./components/AgentErrorDisplay";

function Agents() {
  const { t } = useTranslation();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [agentToDelete, setAgentToDelete] = useState<Agent | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [agentToEdit, setAgentToEdit] = useState<Agent | null>(null);
  const [createForm, setCreateForm] = useState<CreateAgentRequest>({
    name: "",
    type: "qbittorrent",
    address: "",
    token: "",
    icon: "QBittorrent",
    color: "#3b82f6"
  });
  const [editForm, setEditForm] = useState<UpdateAgentRequest>({
    name: "",
    address: "",
    token: "",
    icon: "QBittorrent",
    color: "#3b82f6"
  });
  const [showCreateToken, setShowCreateToken] = useState(false);
  const [showEditToken, setShowEditToken] = useState(false);
  

  const loadAgents = useCallback(async () => {
    try {
      setLoading(true);
      const response = await agentService.listAgents();
      
      if (response.error) {
        toast.error(response.error);
      } else if (response.data) {
        setAgents(response.data);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('agents.errors.failedToLoad'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  // Load agents on component mount
  useEffect(() => {
    loadAgents();
  }, [loadAgents]);


  const confirmDeleteAgent = (agent: Agent) => {
    setAgentToDelete(agent);
    setShowDeleteModal(true);
  };

  const handleDeleteAgent = async () => {
    if (!agentToDelete) return;

    try {
      const response = await agentService.deleteAgent(agentToDelete.uuid);
      if (response.error) {
        toast.error(response.error);
      } else {
        setAgents(agents.filter(agent => agent.uuid !== agentToDelete.uuid));
        toast.success(t('agents.success.deleted'));
        setShowDeleteModal(false);
        setShowDetailsModal(false);
        setAgentToDelete(null);
        setSelectedAgent(null);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('agents.errors.failedToDelete'));
    }
  };

  const handleCreateAgent = async () => {
    if (!createForm.name || !createForm.address || !createForm.token) {
      toast.error(t('agents.errors.fillRequiredFields'));
      return;
    }

    try {
      const response = await agentService.createAgent(createForm);
      if (response.error) {
        toast.error(response.error);
      } else if (response.data) {
        setAgents([...agents, response.data]);
        toast.success(t('agents.success.created'));
        // Reset form
        setCreateForm({ 
          name: "", 
          type: "qbittorrent", 
          address: "", 
          token: "", 
          icon: "QBittorrent", 
          color: "#3b82f6" 
        });
        setShowCreateToken(false);
        setShowCreateForm(false);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('agents.errors.failedToCreate'));
    }
  };

  const showAgentDetails = (agent: Agent) => {
    setSelectedAgent(agent);
    setShowDetailsModal(true);
  };

  const showEditAgent = (agent: Agent) => {
    setAgentToEdit(agent);
    setEditForm({
      name: agent.name,
      address: agent.address,
      token: "", // Don't pre-fill token for security
      icon: agent.icon || "QBittorrent",
      color: agent.color || "#3b82f6"
    });
    setShowEditModal(true);
  };

  const handleUpdateAgent = async () => {
    if (!agentToEdit) return;

    // Only include fields that have been changed
    const updateData: UpdateAgentRequest = {};
    if (editForm.name && editForm.name !== agentToEdit.name) {
      updateData.name = editForm.name;
    }
    if (editForm.address && editForm.address !== agentToEdit.address) {
      updateData.address = editForm.address;
    }
    if (editForm.token) {
      updateData.token = editForm.token;
    }
    if (editForm.icon && editForm.icon !== (agentToEdit.icon || "QBittorrent")) {
      updateData.icon = editForm.icon;
    }
    if (editForm.color && editForm.color !== (agentToEdit.color || "#3b82f6")) {
      updateData.color = editForm.color;
    }

    // If no changes, show message and return
    if (Object.keys(updateData).length === 0) {
      toast.error(t('agents.errors.noChangesDetected'));
      return;
    }

    try {
      const response = await agentService.updateAgent(agentToEdit.uuid, updateData);
      if (response.error) {
        toast.error(response.error);
      } else if (response.data) {
        // Update the agent in the list
        const updatedAgents = agents.map(agent => 
          agent.uuid === agentToEdit.uuid ? response.data! : agent
        );
        setAgents(updatedAgents);
        
        // Update the selected agent if it's the same one being edited
        if (selectedAgent?.uuid === agentToEdit.uuid) {
          setSelectedAgent(response.data!);
        }
        
        toast.success(t('agents.success.updated'));
        setShowEditModal(false);
        setShowDetailsModal(false);
        setShowEditToken(false);
        setAgentToEdit(null);
        setSelectedAgent(null);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('agents.errors.failedToUpdate'));
    }
  };

  // Filter agents
  const filteredAgents = agents.filter(agent => 
    agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    agent.address.toLowerCase().includes(searchTerm.toLowerCase())
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
            <h1 className="text-3xl font-bold">{t('agents.title')}</h1>
            <p className="text-muted-foreground">{t('agents.subtitle')}</p>
          </div>
        </div>
        <div className="flex gap-2 w-full sm:w-auto justify-between sm:justify-end">
          <Button onClick={loadAgents} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            {t('agents.refresh')}
          </Button>
          <Button onClick={() => setShowCreateForm(!showCreateForm)} size="sm">
            {showCreateForm ? <X className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
            {showCreateForm ? t('agents.cancel') : t('agents.addAgent')}
          </Button>
        </div>
      </div>

      {/* Create Agent Form */}
      {showCreateForm && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">{t('agents.createNewAgent')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-sm">{t('agents.name')} *</Label>
                <Input
                  id="name"
                  placeholder={t('agents.agentName')}
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="type" className="text-sm">{t('agents.type')} *</Label>
                <Input
                  id="type"
                  placeholder="qbittorrent"
                  value={createForm.type}
                  onChange={(e) => setCreateForm({ ...createForm, type: e.target.value })}
                  className="h-9"
                  disabled
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="address" className="text-sm">{t('agents.address')} *</Label>
                <Input
                  id="address"
                  placeholder="http://localhost:8080"
                  value={createForm.address}
                  onChange={(e) => setCreateForm({ ...createForm, address: e.target.value })}
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="token" className="text-sm">{t('agents.token')} *</Label>
                <div className="relative">
                  <Input
                    id="token"
                    type={showCreateToken ? "text" : "password"}
                    placeholder={t('agents.authenticationToken')}
                    value={createForm.token}
                    onChange={(e) => setCreateForm({ ...createForm, token: e.target.value })}
                    className="h-9 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCreateToken(!showCreateToken)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showCreateToken ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="color" className="text-sm">{t('agents.color')}</Label>
              <div className="flex gap-1.5 flex-wrap">
                {availableColors.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${
                      createForm.color === color.value ? 'border-foreground scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color.value }}
                    onClick={() => setCreateForm({ ...createForm, color: color.value })}
                    title={t(`agents.colors.${color.name.toLowerCase()}`)}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="icon" className="text-sm">{t('agents.icon')}</Label>
              <div className="flex gap-1.5 flex-wrap">
                {availableIcons.map((iconItem) => {
                  const IconComponent = iconItem.icon;
                  return (
                    <button
                      key={iconItem.name}
                      type="button"
                      className={`w-8 h-8 rounded-md border-2 flex items-center justify-center transition-all hover:scale-110 ${
                        createForm.icon === iconItem.name ? 'border-foreground bg-accent scale-110' : 'border-border hover:container-content-background/50'
                      }`}
                      onClick={() => setCreateForm({ ...createForm, icon: iconItem.name })}
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
              <Label className="text-sm">{t('agents.preview')}</Label>
              <div className="flex items-center gap-3 p-3 container-content-background/50 rounded-lg">
                <AgentIcon 
                  iconName={createForm.icon}
                  color={createForm.color}
                  size="md"
                  className="w-12 h-12 rounded-lg"
                />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm">
                    {createForm.name || t('agents.agentName')}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {createForm.address || "http://localhost:8080"}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-1">
              <Button variant="outline" onClick={() => {
                setShowCreateForm(false);
                setShowCreateToken(false);
              }} size="sm">
                {t('agents.cancel')}
              </Button>
              <Button onClick={handleCreateAgent} size="sm">
                <Check className="h-4 w-4 mr-1" />
                {t('agents.createAgent')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('agents.searchAgents')}
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Agents List */}
      {loading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">{t('agents.loadingAgents')}</span>
          </CardContent>
        </Card>
      ) : filteredAgents.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Server className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">{t('agents.noAgentsFound')}</h3>
            <p className="text-muted-foreground text-center mb-4">
              {searchTerm ? t('agents.noAgentsMatch') : t('agents.getStarted')}
            </p>
            {!searchTerm && (
              <Button onClick={() => setShowCreateForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                {t('agents.addAgent')}
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {filteredAgents.map((agent) => (
              <Card 
                key={agent.uuid} 
                className={`relative cursor-pointer hover:container-content-background/50 transition-colors ${
                  agent.status === 'ERRORED' ? 'border border-red-500/30' : ''
                }`}
                onClick={() => showAgentDetails(agent)}
              >
                {agent.standalone && (
                  <div className="absolute top-2 right-2 z-10">
                    <Pin className="h-4 w-4 text-muted-foreground/70" />
                  </div>
                )}
                <CardContent className="p-0">
                  <div className="flex">
                    {/* Main Content */}
                    <div className="flex-1 p-4">
                      <div className="flex gap-3 items-center">
                        {/* Icon */}
                        <AgentIcon 
                          iconName={agent.icon}
                          color={agent.color}
                          size="lg"
                          className="w-16 h-16 rounded-lg"
                          standalone={agent.standalone}
                        />

                        {/* Content */}
                        <div className="flex-1 min-w-0 space-y-1.5">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              {agent.status === 'ACTIVE' && (
                                <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] ml-0.5"></div>
                              )}
                              {agent.status === 'ERRORED' && (
                                <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)] ml-0.5"></div>
                              )}
                              <h3 className="font-semibold text-base truncate">{agent.name}</h3>
                              {agent.status === 'ERRORED' && (
                                <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground flex items-center gap-2">
                              <Wifi className="h-3 w-3" />
                              <span className="truncate">{agent.address}</span>
                            </p>
                          </div>

                          <AgentErrorBadge agent={agent} />

                          {agent.instance && agent.status === 'ACTIVE' && (
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <HardDrive className="h-3 w-3" />
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="cursor-help">{formatBytes(agent.instance.server.free_space_on_disk)}</span>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>{t('agents.freeSpaceOnDisk', 'Free Space on Disk')}</p>
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
                                      <span className="cursor-help">{agent.instance.transfer.global_ratio.toFixed(2)}</span>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>{t('agents.globalRatio', 'Global Ratio')}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Icons - Always displayed on the right */}
                        <div className="flex-shrink-0 flex items-center gap-2">
                          {agent.standalone && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="cursor-help">
                                    <Lock className="h-4 w-4 text-muted-foreground" />
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{t('agents.standalone.tooltip')}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
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
          <AgentDetailsModal
            isOpen={showDetailsModal}
            onClose={() => setShowDetailsModal(false)}
            agent={selectedAgent}
            onEdit={showEditAgent}
            onDelete={confirmDeleteAgent}
          />

          {/* Delete Confirmation Modal */}
          <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{t('agents.deleteAgent')}</DialogTitle>
              </DialogHeader>
              
              {agentToDelete && (
                <div className="space-y-4">
                  {agentToDelete.standalone ? (
                    <>
                      <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg">
                        <div className="flex items-start gap-2">
                          <Server className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                              {t('agents.standalone.cannotDelete')}
                            </p>
                            <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                              {t('agents.standalone.cannotDeleteDescription')}
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3 p-3 container-content-background/50 rounded-lg">
                        <AgentIcon 
                          iconName={agentToDelete.icon}
                          color={agentToDelete.color}
                          size="md"
                          className="w-12 h-12 rounded-lg"
                          standalone={agentToDelete.standalone}
                        />
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold text-sm">{agentToDelete.name}</h3>
                          <p className="text-xs text-muted-foreground truncate">{agentToDelete.address}</p>
                        </div>
                      </div>

                      <div className="flex gap-2 justify-end">
                        <Button 
                          variant="outline" 
                          onClick={() => {
                            setShowDeleteModal(false);
                            setAgentToDelete(null);
                          }}
                        >
                          {t('agents.close', 'Close')}
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-muted-foreground">
                        {t('agents.confirmDelete.title')} {t('agents.confirmDelete.description')}
                      </p>
                      
                      <div className="flex items-center gap-3 p-3 container-content-background/50 rounded-lg">
                        <AgentIcon 
                          iconName={agentToDelete.icon}
                          color={agentToDelete.color}
                          size="md"
                          className="w-12 h-12 rounded-lg"
                          standalone={agentToDelete.standalone}
                        />
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold text-sm">{agentToDelete.name}</h3>
                          <p className="text-xs text-muted-foreground truncate">{agentToDelete.address}</p>
                        </div>
                      </div>

                      <div className="flex gap-2 justify-end">
                        <Button 
                          variant="outline" 
                          onClick={() => {
                            setShowDeleteModal(false);
                            setAgentToDelete(null);
                          }}
                        >
                          {t('agents.cancel')}
                        </Button>
                        <Button 
                          variant="destructive" 
                          onClick={handleDeleteAgent}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          {t('agents.delete')}
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* Edit Agent Modal */}
          <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
            <DialogContent className="max-w-2xl max-h-[90vh]">
              <DialogHeader>
                <DialogTitle>{t('agents.editAgent')} - {agentToEdit?.name}</DialogTitle>
              </DialogHeader>
              
              {agentToEdit && (
                <CustomScrollArea className="max-h-[calc(90vh-120px)]" variant="thin" mobileFallback>
                  <div className="space-y-4">
                  {agentToEdit.standalone && (
                    <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg">
                      <Server className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      <div>
                        <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                          {t('agents.standalone.title')}
                        </p>
                        <p className="text-xs text-blue-700 dark:text-blue-300">
                          {t('agents.standalone.cannotModify')}
                        </p>
                      </div>
                    </div>
                  )}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="edit-name" className="text-sm">{t('agents.name')}</Label>
                      <Input
                        id="edit-name"
                        placeholder={t('agents.agentName')}
                        value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        className="h-9"
                        disabled={agentToEdit.standalone}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="edit-address" className="text-sm">{t('agents.address')}</Label>
                      <Input
                        id="edit-address"
                        placeholder="http://localhost:3100"
                        value={editForm.address}
                        onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                        className="h-9"
                        disabled={agentToEdit.standalone}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="edit-token" className="text-sm">{t('agents.token')} ({t('agents.leaveEmptyToKeep')})</Label>
                    <div className="relative">
                      <Input
                        id="edit-token"
                        type={showEditToken ? "text" : "password"}
                        placeholder={t('agents.newAuthenticationToken')}
                        value={editForm.token}
                        onChange={(e) => setEditForm({ ...editForm, token: e.target.value })}
                        className="h-9 pr-10"
                        disabled={agentToEdit.standalone}
                      />
                      <button
                        type="button"
                        onClick={() => setShowEditToken(!showEditToken)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        disabled={agentToEdit.standalone}
                      >
                        {showEditToken ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="edit-color" className="text-sm">{t('agents.color')}</Label>
                    <div className="flex gap-1.5 flex-wrap">
                      {availableColors.map((color) => (
                        <button
                          key={color.value}
                          type="button"
                          className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${
                            editForm.color === color.value ? 'border-foreground scale-110' : 'border-transparent'
                          } ${agentToEdit.standalone ? 'opacity-50 cursor-not-allowed' : ''}`}
                          style={{ backgroundColor: color.value }}
                          onClick={() => !agentToEdit.standalone && setEditForm({ ...editForm, color: color.value })}
                          title={t(`agents.colors.${color.name.toLowerCase()}`)}
                          disabled={agentToEdit.standalone}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="edit-icon" className="text-sm">{t('agents.icon')}</Label>
                    <div className="flex gap-1.5 flex-wrap">
                      {availableIcons.map((iconItem) => {
                        const IconComponent = iconItem.icon;
                        return (
                          <button
                            key={iconItem.name}
                            type="button"
                            className={`w-8 h-8 rounded-md border-2 flex items-center justify-center transition-all hover:scale-110 ${
                              editForm.icon === iconItem.name ? 'border-foreground bg-accent scale-110' : 'border-border hover:container-content-background/50'
                            } ${agentToEdit.standalone ? 'opacity-50 cursor-not-allowed' : ''}`}
                            onClick={() => !agentToEdit.standalone && setEditForm({ ...editForm, icon: iconItem.name })}
                            title={iconItem.name}
                            disabled={agentToEdit.standalone}
                          >
                            <IconComponent className="h-4 w-4" />
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Preview */}
                  <div className="space-y-1.5">
                    <Label className="text-sm">{t('agents.preview')}</Label>
                    <div className="flex items-center gap-3 p-3 container-content-background/50 rounded-lg">
                      <AgentIcon 
                        iconName={editForm.icon}
                        color={editForm.color}
                        size="md"
                        className="w-12 h-12 rounded-lg"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-sm">
                          {editForm.name || t('agents.agentName')}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {editForm.address || "http://localhost:8080"}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 justify-end pt-1">
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setShowEditModal(false);
                        setShowEditToken(false);
                        setAgentToEdit(null);
                      }} 
                      size="sm"
                    >
                      {t('agents.cancel')}
                    </Button>
                    <Button 
                      onClick={handleUpdateAgent} 
                      size="sm"
                      disabled={agentToEdit.standalone}
                      title={agentToEdit.standalone ? t('agents.standalone.tooltip', 'Standalone agent') : t('agents.updateAgentInfo', 'Update agent information')}
                    >
                      <Check className="h-4 w-4 mr-1" />
                      {t('agents.updateAgent')}
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

export default Agents;
