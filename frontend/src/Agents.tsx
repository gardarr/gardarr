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
  XCircle,
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
  TrendingUp,
  TrendingDown,
  Users,
  BarChart3,
  Tag,
  Folder
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { agentService } from "./services/agents";
import type { Agent, AgentStatus, CreateAgentRequest, UpdateAgentRequest, Version, TaskStats } from "./types/agent";
import { useToast } from "./hooks/useToast";
import { ToastContainer } from "./components/ui/toast-container";
import { AgentIcon } from "./components/ui/AgentIcon";
import { availableIcons } from "./components/ui/agent-icons";
import { QBittorrentIcon } from "./components/ui/QBittorrentIcon";
import { ChartPieLegend } from "./components/ui/chart-pie-legend";
import type { ChartConfig } from "./components/ui/chart";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./components/ui/tooltip";

type SortType = "name" | "status";


// Available colors for agents
const availableColors = [
  { name: "Blue", value: "#3b82f6" },
  { name: "Green", value: "#10b981" },
  { name: "Purple", value: "#8b5cf6" },
  { name: "Red", value: "#ef4444" },
  { name: "Orange", value: "#f97316" },
  { name: "Pink", value: "#ec4899" },
  { name: "Indigo", value: "#6366f1" },
  { name: "Teal", value: "#14b8a6" },
  { name: "Yellow", value: "#eab308" },
  { name: "Gray", value: "#6b7280" }
];

function Agents() {
  const { t } = useTranslation();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<SortType>("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [agentToDelete, setAgentToDelete] = useState<Agent | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [agentToEdit, setAgentToEdit] = useState<Agent | null>(null);
  const [agentVersions, setAgentVersions] = useState<Record<string, Version>>({});
  const [loadingVersions, setLoadingVersions] = useState<Record<string, boolean>>({});
  const [agentTaskStats, setAgentTaskStats] = useState<Record<string, TaskStats>>({});
  const [loadingTaskStats, setLoadingTaskStats] = useState<Record<string, boolean>>({});
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
  
  const { toasts, showSuccess, showError, removeToast } = useToast();

  const loadAgents = useCallback(async () => {
    try {
      setLoading(true);
      const response = await agentService.listAgents();
      
      if (response.error) {
        showError(response.error);
      } else if (response.data) {
        setAgents(response.data);
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : t('agents.errors.failedToLoad'));
    } finally {
      setLoading(false);
    }
  }, [showError, t]);

  // Load agents on component mount
  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  const loadAgentVersion = async (agentId: string) => {
    try {
      setLoadingVersions(prev => ({ ...prev, [agentId]: true }));
      const response = await agentService.getAgentVersion(agentId);
      
      if (response.error) {
        console.warn(`Failed to load version for agent ${agentId}:`, response.error);
      } else if (response.data) {
        setAgentVersions(prev => ({ ...prev, [agentId]: response.data! }));
      }
    } catch (err) {
      console.warn(`Failed to load version for agent ${agentId}:`, err);
    } finally {
      setLoadingVersions(prev => ({ ...prev, [agentId]: false }));
    }
  };

  const loadAgentTaskStats = async (agentId: string) => {
    try {
      setLoadingTaskStats(prev => ({ ...prev, [agentId]: true }));
      const response = await agentService.getAgentTaskStats(agentId);
      
      if (response.error) {
        console.warn(`Failed to load task stats for agent ${agentId}:`, response.error);
      } else if (response.data) {
        setAgentTaskStats(prev => ({ ...prev, [agentId]: response.data! }));
      }
    } catch (err) {
      console.warn(`Failed to load task stats for agent ${agentId}:`, err);
    } finally {
      setLoadingTaskStats(prev => ({ ...prev, [agentId]: false }));
    }
  };

  const confirmDeleteAgent = (agent: Agent) => {
    setAgentToDelete(agent);
    setShowDeleteModal(true);
  };

  const handleDeleteAgent = async () => {
    if (!agentToDelete) return;

    try {
      const response = await agentService.deleteAgent(agentToDelete.uuid);
      if (response.error) {
        showError(response.error);
      } else {
        setAgents(agents.filter(agent => agent.uuid !== agentToDelete.uuid));
        showSuccess(t('agents.success.deleted'));
        setShowDeleteModal(false);
        setShowDetailsModal(false);
        setAgentToDelete(null);
        setSelectedAgent(null);
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : t('agents.errors.failedToDelete'));
    }
  };

  const handleCreateAgent = async () => {
    if (!createForm.name || !createForm.address || !createForm.token) {
      showError(t('agents.errors.fillRequiredFields'));
      return;
    }

    try {
      const response = await agentService.createAgent(createForm);
      if (response.error) {
        showError(response.error);
      } else if (response.data) {
        setAgents([...agents, response.data]);
        showSuccess(t('agents.success.created'));
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
      showError(err instanceof Error ? err.message : t('agents.errors.failedToCreate'));
    }
  };

  const showAgentDetails = (agent: Agent) => {
    setSelectedAgent(agent);
    setShowDetailsModal(true);
    // Always fetch version and task stats when opening modal
    loadAgentVersion(agent.uuid);
    loadAgentTaskStats(agent.uuid);
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
      showError(t('agents.errors.noChangesDetected'));
      return;
    }

    try {
      const response = await agentService.updateAgent(agentToEdit.uuid, updateData);
      if (response.error) {
        showError(response.error);
      } else if (response.data) {
        // Update the agent in the list
        setAgents(agents.map(agent => 
          agent.uuid === agentToEdit.uuid ? response.data! : agent
        ));
        showSuccess(t('agents.success.updated'));
        setShowEditModal(false);
        setShowDetailsModal(false);
        setShowEditToken(false);
        setAgentToEdit(null);
        setSelectedAgent(null);
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : t('agents.errors.failedToUpdate'));
    }
  };

  // Filter and sort agents
  const filteredAgents = agents
    .filter(agent => 
      agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      agent.address.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      let comparison = 0;
      if (sortBy === "name") {
        comparison = a.name.localeCompare(b.name);
      } else if (sortBy === "status") {
        comparison = a.status.localeCompare(b.status);
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });

  const getStatusIndicator = (status: AgentStatus) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <div 
            className="w-3 h-3 rounded-full bg-green-500" 
            style={{ boxShadow: '0 0 8px 2px rgba(34, 197, 94, 0.5)' }}
          />
        );
      case 'ERRORED':
        return (
          <div 
            className="w-3 h-3 rounded-full bg-red-500" 
            style={{ boxShadow: '0 0 8px 2px rgba(239, 68, 68, 0.5)' }}
          />
        );
      case 'INACTIVE':
        return (
          <div 
            className="w-3 h-3 rounded-full bg-yellow-500" 
            style={{ boxShadow: '0 0 8px 2px rgba(234, 179, 8, 0.5)' }}
          />
        );
      default:
        return (
          <div 
            className="w-3 h-3 rounded-full bg-gray-500" 
            style={{ boxShadow: '0 0 8px 2px rgba(107, 114, 128, 0.5)' }}
          />
        );
    }
  };

  const getStatusTextColor = (status: AgentStatus) => {
    switch (status) {
      case 'ACTIVE':
        return 'text-green-600';
      case 'ERRORED':
        return 'text-red-600';
      case 'INACTIVE':
        return 'text-yellow-600';
      default:
        return 'text-gray-600';
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const generateCategoryChartData = (categoryUsage: Record<string, number>) => {
    const colors = [
      "var(--chart-1)",
      "var(--chart-2)", 
      "var(--chart-3)",
      "var(--chart-4)",
      "var(--chart-5)",
      "var(--chart-6)",
      "var(--chart-7)",
      "var(--chart-8)"
    ];
    
    return Object.entries(categoryUsage).map(([category, count], index) => ({
      name: category,
      value: count,
      fill: colors[index % colors.length]
    }));
  };

  const generateCategoryChartConfig = (categoryUsage: Record<string, number>): ChartConfig => {
    const config: ChartConfig = {
      value: {
        label: "Count",
      }
    };
    
    Object.keys(categoryUsage).forEach((category, index) => {
      const colors = [
        "var(--chart-1)",
        "var(--chart-2)", 
        "var(--chart-3)",
        "var(--chart-4)",
        "var(--chart-5)",
        "var(--chart-6)",
        "var(--chart-7)",
        "var(--chart-8)"
      ];
      
      config[category] = {
        label: category.charAt(0).toUpperCase() + category.slice(1),
        color: colors[index % colors.length]
      };
    });
    
    return config;
  };

  const generateTagsChartData = (tagsUsage: Record<string, number>) => {
    const colors = [
      "var(--chart-1)",
      "var(--chart-2)", 
      "var(--chart-3)",
      "var(--chart-4)",
      "var(--chart-5)",
      "var(--chart-6)",
      "var(--chart-7)",
      "var(--chart-8)"
    ];
    
    return Object.entries(tagsUsage).map(([tag, count], index) => ({
      name: tag,
      value: count,
      fill: colors[index % colors.length]
    }));
  };

  const generateTagsChartConfig = (tagsUsage: Record<string, number>): ChartConfig => {
    const config: ChartConfig = {
      value: {
        label: "Count",
      }
    };
    
    Object.keys(tagsUsage).forEach((tag, index) => {
      const colors = [
        "var(--chart-1)",
        "var(--chart-2)", 
        "var(--chart-3)",
        "var(--chart-4)",
        "var(--chart-5)",
        "var(--chart-6)",
        "var(--chart-7)",
        "var(--chart-8)"
      ];
      
      config[tag] = {
        label: tag.charAt(0).toUpperCase() + tag.slice(1),
        color: colors[index % colors.length]
      };
    });
    
    return config;
  };

  return (
    <div className="space-y-6">
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      
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
        <div className="flex gap-2">
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
                    title={color.name}
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

      {/* Search and Sort */}
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
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (sortBy === "name") {
                setSortOrder(sortOrder === "asc" ? "desc" : "asc");
              } else {
                setSortBy("name");
                setSortOrder("asc");
              }
            }}
          >
            {t('agents.name')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (sortBy === "status") {
                setSortOrder(sortOrder === "asc" ? "desc" : "asc");
              } else {
                setSortBy("status");
                setSortOrder("asc");
              }
            }}
          >
            Status
          </Button>
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
          <div className="grid gap-3 md:grid-cols-2">
            {filteredAgents.map((agent) => (
              <Card 
                key={agent.uuid} 
                className="relative cursor-pointer hover:container-content-background/50 transition-colors"
                onClick={() => showAgentDetails(agent)}
              >
                <CardContent className="p-0">
                  <div className="flex">
                    {/* Status Indicator - Left Side */}
                    <div className="flex flex-col items-center justify-center p-4 border-r border-border">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="cursor-help">
                              {getStatusIndicator(agent.status)}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="capitalize">{agent.status.toLowerCase()}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>

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
                            <h3 className="font-semibold text-base truncate">{agent.name}</h3>
                            <p className="text-xs text-muted-foreground flex items-center gap-2">
                              <Wifi className="h-3 w-3" />
                              <span className="truncate">{agent.address}</span>
                            </p>
                          </div>

                          {agent.error && (
                            <div className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
                              {agent.error}
                            </div>
                          )}

                          {agent.instance && agent.status === 'ACTIVE' && (
                            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 text-xs text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <Activity className="h-3 w-3" />
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="cursor-help">{agent.instance.application.version}</span>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Version</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </div>
                              <div className="flex items-center gap-1">
                                <HardDrive className="h-3 w-3" />
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="cursor-help">{formatBytes(agent.instance.server.free_space_on_disk)}</span>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Free Space on Disk</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </div>
                              <div className="flex items-center gap-1">
                                <Activity className="h-3 w-3" />
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="cursor-help">{agent.instance.transfer.global_ratio.toFixed(2)}</span>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Global Ratio</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* qBittorrent Icon - Always displayed on the right */}
                        <div className="flex-shrink-0">
                          <QBittorrentIcon 
                            size="lg"
                            className="w-8 h-8 text-muted-foreground/60"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Details Modal */}
          <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
            <DialogContent className="max-w-2xl max-h-[90vh]">
              <DialogHeader>
                <DialogTitle>{t('agents.agentDetails')} - {selectedAgent?.name || 'Unknown'}</DialogTitle>
              </DialogHeader>
              
              {selectedAgent && (
                <CustomScrollArea className="w-full max-h-[calc(90vh-120px)]" variant="thin" mobileFallback>
                  <div className="w-full">
                  <Tabs defaultValue="info" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 mb-4">
                      <TabsTrigger value="info">{t('agents.info')}</TabsTrigger>
                      <TabsTrigger value="stats">{t('agents.stats')}</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="info" className="space-y-4">
                      <div className="flex items-center gap-3 p-3 container-content-background/50 rounded-lg">
                        <AgentIcon 
                          iconName={selectedAgent?.icon}
                          color={selectedAgent?.color}
                          size="lg"
                          className="w-14 h-14 rounded-lg"
                          standalone={selectedAgent?.standalone}
                        />
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold text-base">{selectedAgent?.name}</h3>
                          <p className="text-xs text-muted-foreground">{selectedAgent?.address}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {selectedAgent && getStatusIndicator(selectedAgent.status)}
                          <span className={`text-sm font-medium ${selectedAgent && getStatusTextColor(selectedAgent.status)}`}>
                            {selectedAgent?.status}
                          </span>
                        </div>
                      </div>

                      {selectedAgent?.error && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                          <div className="flex items-start gap-2">
                            <XCircle className="h-4 w-4 text-red-500 mt-0.5" />
                            <div>
                              <h4 className="text-sm font-medium text-red-900">Error</h4>
                              <p className="text-sm text-red-700">{selectedAgent.error}</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {selectedAgent?.instance && (
                        <div className="space-y-3">
                          <h4 className="font-semibold text-sm">{t('agents.instanceInformation')}</h4>
                          
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="flex p-3 container-content-background/50 rounded-lg">
                              <div className="flex-1 space-y-1">
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <Activity className="h-3 w-3" />
                                  <span>{t('agents.application')}</span>
                                </div>
                                <div className="text-sm font-medium">
                                  {t('agents.version')}: {selectedAgent?.instance?.application?.version}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {t('agents.api')}: {selectedAgent?.instance?.application?.api_version}
                                </div>
                              </div>
                              <div className="flex items-center justify-center ml-3">
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div className="cursor-help">
                                        <QBittorrentIcon 
                                          size="sm"
                                          className="w-5 h-5 text-muted-foreground/60"
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

                            {selectedAgent && agentVersions[selectedAgent.uuid] && (
                              <div className="space-y-1 p-3 container-content-background/50 rounded-lg">
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <Server className="h-3 w-3" />
                                  <span>{t('agents.agent')}</span>
                                </div>
                                <div className="text-sm font-medium">
                                  {t('agents.version')}: {agentVersions[selectedAgent.uuid].version}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {t('agents.commit')}: {agentVersions[selectedAgent.uuid].commit}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {t('agents.date')}: {agentVersions[selectedAgent.uuid].date}
                                </div>
                              </div>
                            )}
                            {selectedAgent && loadingVersions[selectedAgent.uuid] && (
                              <div className="space-y-1 p-3 container-content-background/50 rounded-lg">
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <Server className="h-3 w-3" />
                                  <span>{t('agents.agent')}</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                  <span>{t('agents.loadingVersion')}</span>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Storage Section - Full Width */}
                          <div className="space-y-1 p-3 container-content-background/50 rounded-lg">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <HardDrive className="h-3 w-3" />
                              <span>{t('agents.storage')}</span>
                            </div>
                            <div className="space-y-2 text-sm">
                              {selectedAgent && agentTaskStats[selectedAgent.uuid] ? (
                                <>
                                  <div className="flex justify-between">
                                    <div className="flex flex-col">
                                      <span className="text-muted-foreground">{t('agents.usedSpace')}:</span>
                                      <span className="font-medium">{formatBytes(agentTaskStats[selectedAgent.uuid].total_disk_size)}</span>
                                    </div>
                                    <div className="flex flex-col items-end">
                                      <span className="text-muted-foreground">{t('agents.freeSpace')}:</span>
                                      <span className="font-medium">{selectedAgent?.instance?.server?.free_space_on_disk && formatBytes(selectedAgent.instance.server.free_space_on_disk)}</span>
                                    </div>
                                  </div>
                                  {(() => {
                                    const freeSpace = selectedAgent?.instance?.server?.free_space_on_disk || 0;
                                    const usedSpace = agentTaskStats[selectedAgent.uuid].total_disk_size;
                                    const totalSpace = freeSpace + usedSpace;
                                    const usedPercentage = totalSpace > 0 ? (usedSpace / totalSpace) * 100 : 0;
                                    
                                    return (
                                      <div className="space-y-1">
                                        <div className="w-full bg-muted rounded-full h-2">
                                          <div 
                                            className="bg-primary h-2 rounded-full transition-all duration-300" 
                                            style={{ width: `${usedPercentage}%` }}
                                          />
                                        </div>
                                        <div className="text-xs text-muted-foreground text-center">
                                          {usedPercentage.toFixed(1)}% {t('agents.used')}
                                        </div>
                                      </div>
                                    );
                                  })()}
                                </>
                              ) : (
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">{t('agents.freeSpace')}:</span>
                                  <span className="font-medium">{selectedAgent?.instance?.server?.free_space_on_disk && formatBytes(selectedAgent.instance.server.free_space_on_disk)}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="space-y-2 p-3 container-content-background/50 rounded-lg">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                              <Activity className="h-3 w-3" />
                              <span>{t('agents.transferStatistics')}</span>
                            </div>
                            <div className="grid gap-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">{t('agents.downloaded')}:</span>
                                <span className="font-medium">{selectedAgent?.instance?.transfer?.all_time_downloaded && formatBytes(selectedAgent.instance.transfer.all_time_downloaded)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">{t('agents.uploaded')}:</span>
                                <span className="font-medium">{selectedAgent?.instance?.transfer?.all_time_uploaded && formatBytes(selectedAgent.instance.transfer.all_time_uploaded)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">{t('agents.globalRatio')}:</span>
                                <span className="font-medium">{selectedAgent?.instance?.transfer?.global_ratio?.toFixed(2)}</span>
                              </div>
                              {selectedAgent?.instance?.transfer?.last_external_address_v4 && (
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">IPv4:</span>
                                  <span className="font-mono text-xs">{selectedAgent.instance.transfer.last_external_address_v4}</span>
                                </div>
                              )}
                              {selectedAgent?.instance?.transfer?.last_external_address_v6 && (
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">IPv6:</span>
                                  <span className="font-mono text-xs">{selectedAgent.instance.transfer.last_external_address_v6}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="stats" className="space-y-4">
                      {/* Task Statistics Section */}
                      {selectedAgent && agentTaskStats[selectedAgent.uuid] && (
                        <div className="space-y-3">
                          <h4 className="font-semibold text-sm">{t('agents.torrentStatistics')}</h4>
                        
                          {/* Overview Stats */}
                          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            <div className="space-y-1 p-3 container-content-background/50 rounded-lg">
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <HardDrive className="h-3 w-3" />
                                <span>{t('agents.totalSize')}</span>
                              </div>
                              <div className="text-sm font-medium">
                                {formatBytes(agentTaskStats[selectedAgent.uuid].total_disk_size)}
                              </div>
                            </div>

                            <div className="space-y-1 p-3 container-content-background/50 rounded-lg">
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Activity className="h-3 w-3" />
                                <span>{t('agents.activeTasks')}</span>
                              </div>
                              <div className="text-sm font-medium">
                                {agentTaskStats[selectedAgent.uuid].active_tasks_count}
                              </div>
                            </div>

                            <div className="space-y-1 p-3 container-content-background/50 rounded-lg">
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Users className="h-3 w-3" />
                                <span>{t('agents.activePeers')}</span>
                              </div>
                              <div className="text-sm font-medium">
                                {agentTaskStats[selectedAgent.uuid].active_peers}
                              </div>
                            </div>
                          </div>

                          {/* Speed Stats */}
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1 p-3 container-content-background/50 rounded-lg">
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <TrendingUp className="h-3 w-3" />
                                <span>{t('agents.uploadSpeed')}</span>
                              </div>
                              <div className="text-sm font-medium">
                                {formatBytes(agentTaskStats[selectedAgent.uuid].current_upload_speed)}/s
                              </div>
                            </div>

                            <div className="space-y-1 p-3 container-content-background/50 rounded-lg">
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <TrendingDown className="h-3 w-3" />
                                <span>{t('agents.downloadSpeed')}</span>
                              </div>
                              <div className="text-sm font-medium">
                                {formatBytes(agentTaskStats[selectedAgent.uuid].current_download_speed)}/s
                              </div>
                            </div>
                          </div>

                          {/* Ratio Stats */}
                          <div className="space-y-2 p-3 container-content-background/50 rounded-lg">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                              <BarChart3 className="h-3 w-3" />
                              <span>{t('agents.ratioStatistics')}</span>
                            </div>
                            <div className="grid gap-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">{t('agents.average')}:</span>
                                <span className="font-medium">{agentTaskStats[selectedAgent.uuid].average_ratio.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">{t('agents.median')}:</span>
                                <span className="font-medium">{agentTaskStats[selectedAgent.uuid].median_ratio.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">{t('agents.highest')}:</span>
                                <span className="font-medium">{agentTaskStats[selectedAgent.uuid].highest_ratio.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">{t('agents.lowest')}:</span>
                                <span className="font-medium">{agentTaskStats[selectedAgent.uuid].lowest_ratio.toFixed(2)}</span>
                              </div>
                            </div>
                          </div>

                          {/* Category Usage */}
                          {Object.keys(agentTaskStats[selectedAgent.uuid].category_usage).length > 0 && (
                            <div className="space-y-2">
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Folder className="h-3 w-3" />
                                <span>{t('agents.categoryUsage')}</span>
                              </div>
                              <ChartPieLegend
                                data={generateCategoryChartData(agentTaskStats[selectedAgent.uuid].category_usage)}
                                config={generateCategoryChartConfig(agentTaskStats[selectedAgent.uuid].category_usage)}
                                title=""
                                description=""
                                className="container-content-background/50"
                              />
                            </div>
                          )}

                          {/* Tags Usage */}
                          {Object.keys(agentTaskStats[selectedAgent.uuid].tags_usage).length > 0 && (
                            <div className="space-y-2">
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Tag className="h-3 w-3" />
                                <span>{t('agents.tagsUsage')}</span>
                              </div>
                              <ChartPieLegend
                                data={generateTagsChartData(agentTaskStats[selectedAgent.uuid].tags_usage)}
                                config={generateTagsChartConfig(agentTaskStats[selectedAgent.uuid].tags_usage)}
                                title=""
                                description=""
                                className="container-content-background/50"
                              />
                            </div>
                          )}
                        </div>
                      )}

                      {selectedAgent && loadingTaskStats[selectedAgent.uuid] && (
                        <div className="space-y-3">
                          <h4 className="font-semibold text-sm">{t('agents.torrentStatistics')}</h4>
                          <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            <span className="ml-2 text-muted-foreground">{t('agents.loadingStatistics')}</span>
                          </div>
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>

                  <div className="flex gap-2 justify-between pt-2">
                    <div className="flex gap-2">
                      <Button 
                        variant="destructive" 
                        onClick={() => selectedAgent && confirmDeleteAgent(selectedAgent)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        {t('agents.delete')}
                      </Button>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        onClick={() => selectedAgent && showEditAgent(selectedAgent)}
                      >
                        <Check className="h-4 w-4 mr-2" />
                        {t('agents.edit')}
                      </Button>
                      <Button variant="outline" onClick={() => setShowDetailsModal(false)}>
                        <X className="h-4 w-4 mr-2" />
                        {t('agents.close')}
                      </Button>
                    </div>
                  </div>
                  </div>
                </CustomScrollArea>
              )}
            </DialogContent>
          </Dialog>

          {/* Delete Confirmation Modal */}
          <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{t('agents.deleteAgent')}</DialogTitle>
              </DialogHeader>
              
              {agentToDelete && (
                <div className="space-y-4">
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
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="edit-name" className="text-sm">{t('agents.name')}</Label>
                      <Input
                        id="edit-name"
                        placeholder={t('agents.agentName')}
                        value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        className="h-9"
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
                      />
                      <button
                        type="button"
                        onClick={() => setShowEditToken(!showEditToken)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
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
                          }`}
                          style={{ backgroundColor: color.value }}
                          onClick={() => setEditForm({ ...editForm, color: color.value })}
                          title={color.name}
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
                    <Button onClick={handleUpdateAgent} size="sm">
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
