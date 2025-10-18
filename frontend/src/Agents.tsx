import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Check
} from "lucide-react";
import { useEffect, useState } from "react";
import { agentService } from "./services/agents";
import type { Agent, AgentStatus, CreateAgentRequest, UpdateAgentRequest } from "./types/agent";
import { useToast } from "./hooks/useToast";
import { ToastContainer } from "./components/ui/toast-container";
import { AgentIcon, availableIcons } from "./components/ui/AgentIcon";

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
  const [createForm, setCreateForm] = useState<CreateAgentRequest>({
    name: "",
    type: "qbittorrent",
    address: "",
    token: "",
    icon: "Server",
    color: "#3b82f6"
  });
  const [editForm, setEditForm] = useState<UpdateAgentRequest>({
    name: "",
    address: "",
    token: "",
    icon: "Server",
    color: "#3b82f6"
  });
  
  const { toasts, showSuccess, showError, removeToast } = useToast();

  // Load agents on component mount
  useEffect(() => {
    loadAgents();
  }, []);

  const loadAgents = async () => {
    try {
      setLoading(true);
      const response = await agentService.listAgents();
      
      if (response.error) {
        showError(response.error);
      } else if (response.data) {
        setAgents(response.data);
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to load agents');
    } finally {
      setLoading(false);
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
        showSuccess('Agent deleted successfully');
        setShowDeleteModal(false);
        setShowDetailsModal(false);
        setAgentToDelete(null);
        setSelectedAgent(null);
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to delete agent');
    }
  };

  const handleCreateAgent = async () => {
    if (!createForm.name || !createForm.address || !createForm.token) {
      showError('Please fill in all required fields');
      return;
    }

    try {
      const response = await agentService.createAgent(createForm);
      if (response.error) {
        showError(response.error);
      } else if (response.data) {
        setAgents([...agents, response.data]);
        showSuccess('Agent created successfully');
        // Reset form
        setCreateForm({ 
          name: "", 
          type: "qbittorrent", 
          address: "", 
          token: "", 
          icon: "Server", 
          color: "#3b82f6" 
        });
        setShowCreateForm(false);
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to create agent');
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
      icon: agent.icon || "Server",
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
    if (editForm.icon && editForm.icon !== (agentToEdit.icon || "Server")) {
      updateData.icon = editForm.icon;
    }
    if (editForm.color && editForm.color !== (agentToEdit.color || "#3b82f6")) {
      updateData.color = editForm.color;
    }

    // If no changes, show message and return
    if (Object.keys(updateData).length === 0) {
      showError('No changes detected');
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
        showSuccess('Agent updated successfully');
        setShowEditModal(false);
        setShowDetailsModal(false);
        setAgentToEdit(null);
        setSelectedAgent(null);
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to update agent');
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
            <h1 className="text-3xl font-bold">Agents</h1>
            <p className="text-muted-foreground">Manage your torrent clients and connections</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={loadAgents} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => setShowCreateForm(!showCreateForm)} size="sm">
            {showCreateForm ? <X className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
            {showCreateForm ? 'Cancel' : 'Add Agent'}
          </Button>
        </div>
      </div>

      {/* Create Agent Form */}
      {showCreateForm && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Create New Agent</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-sm">Name *</Label>
                <Input
                  id="name"
                  placeholder="My Torrent Client"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="type" className="text-sm">Type *</Label>
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
                <Label htmlFor="address" className="text-sm">Address *</Label>
                <Input
                  id="address"
                  placeholder="http://localhost:8080"
                  value={createForm.address}
                  onChange={(e) => setCreateForm({ ...createForm, address: e.target.value })}
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="token" className="text-sm">Token *</Label>
                <Input
                  id="token"
                  type="password"
                  placeholder="Authentication token"
                  value={createForm.token}
                  onChange={(e) => setCreateForm({ ...createForm, token: e.target.value })}
                  className="h-9"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="color" className="text-sm">Color</Label>
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
              <Label htmlFor="icon" className="text-sm">Icon</Label>
              <div className="flex gap-1.5 flex-wrap">
                {availableIcons.map((iconItem) => {
                  const IconComponent = iconItem.icon;
                  return (
                    <button
                      key={iconItem.name}
                      type="button"
                      className={`w-8 h-8 rounded-md border-2 flex items-center justify-center transition-all hover:scale-110 ${
                        createForm.icon === iconItem.name ? 'border-foreground bg-accent scale-110' : 'border-border hover:bg-accent/50'
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
              <Label className="text-sm">Preview</Label>
              <div className="flex items-center gap-3 p-3 bg-accent/50 rounded-lg">
                <AgentIcon 
                  iconName={createForm.icon}
                  color={createForm.color}
                  size="md"
                  className="w-12 h-12 rounded-lg"
                />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm">
                    {createForm.name || "Agent Name"}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {createForm.address || "http://localhost:8080"}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-1">
              <Button variant="outline" onClick={() => setShowCreateForm(false)} size="sm">
                Cancel
              </Button>
              <Button onClick={handleCreateAgent} size="sm">
                <Check className="h-4 w-4 mr-1" />
                Create Agent
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
            placeholder="Search agents..."
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
            Name
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
            <span className="ml-2 text-muted-foreground">Loading agents...</span>
          </CardContent>
        </Card>
      ) : filteredAgents.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Server className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No agents found</h3>
            <p className="text-muted-foreground text-center mb-4">
              {searchTerm ? 'No agents match your search criteria.' : 'Get started by adding your first agent.'}
            </p>
            {!searchTerm && (
              <Button onClick={() => setShowCreateForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Agent
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-3">
            {filteredAgents.map((agent) => (
              <Card 
                key={agent.uuid} 
                className="relative cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => showAgentDetails(agent)}
              >
                <CardContent className="p-4">
                  <div className="flex gap-3 items-center">
                    {/* Icon */}
                    <AgentIcon 
                      iconName={agent.icon}
                      color={agent.color}
                      size="lg"
                      className="w-16 h-16 rounded-lg"
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

                      <div className="flex items-center gap-2">
                        {getStatusIndicator(agent.status)}
                        <span className={`text-xs font-medium ${getStatusTextColor(agent.status)}`}>
                          {agent.status}
                        </span>
                      </div>

                      {agent.error && (
                        <div className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
                          {agent.error}
                        </div>
                      )}

                      {agent.instance && agent.status === 'ACTIVE' && (
                        <div className="flex gap-3 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Activity className="h-3 w-3" />
                            <span>v{agent.instance.application.version}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <HardDrive className="h-3 w-3" />
                            <span>{formatBytes(agent.instance.server.free_space_on_disk)}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Activity className="h-3 w-3" />
                            <span>Ratio: {agent.instance.transfer.global_ratio.toFixed(2)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Details Modal */}
          <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Agent Details - {selectedAgent?.name}</DialogTitle>
              </DialogHeader>
              
              {selectedAgent && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 bg-accent/50 rounded-lg">
                    <AgentIcon 
                      iconName={selectedAgent.icon}
                      color={selectedAgent.color}
                      size="lg"
                      className="w-14 h-14 rounded-lg"
                    />
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-base">{selectedAgent.name}</h3>
                      <p className="text-xs text-muted-foreground">{selectedAgent.address}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusIndicator(selectedAgent.status)}
                      <span className={`text-sm font-medium ${getStatusTextColor(selectedAgent.status)}`}>
                        {selectedAgent.status}
                      </span>
                    </div>
                  </div>

                  {selectedAgent.error && (
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

                  {selectedAgent.instance && (
                    <div className="space-y-3">
                      <h4 className="font-semibold text-sm">Instance Information</h4>
                      
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1 p-3 bg-accent/50 rounded-lg">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Activity className="h-3 w-3" />
                            <span>Application</span>
                          </div>
                          <div className="text-sm font-medium">
                            Version: {selectedAgent.instance.application.version}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            API: {selectedAgent.instance.application.api_version}
                          </div>
                        </div>

                        <div className="space-y-1 p-3 bg-accent/50 rounded-lg">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <HardDrive className="h-3 w-3" />
                            <span>Storage</span>
                          </div>
                          <div className="text-sm font-medium">
                            Free Space: {formatBytes(selectedAgent.instance.server.free_space_on_disk)}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2 p-3 bg-accent/50 rounded-lg">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                          <Activity className="h-3 w-3" />
                          <span>Transfer Statistics</span>
                        </div>
                        <div className="grid gap-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Downloaded:</span>
                            <span className="font-medium">{formatBytes(selectedAgent.instance.transfer.all_time_downloaded)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Uploaded:</span>
                            <span className="font-medium">{formatBytes(selectedAgent.instance.transfer.all_time_uploaded)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Global Ratio:</span>
                            <span className="font-medium">{selectedAgent.instance.transfer.global_ratio.toFixed(2)}</span>
                          </div>
                          {selectedAgent.instance.transfer.last_external_address_v4 && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">IPv4:</span>
                              <span className="font-mono text-xs">{selectedAgent.instance.transfer.last_external_address_v4}</span>
                            </div>
                          )}
                          {selectedAgent.instance.transfer.last_external_address_v6 && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">IPv6:</span>
                              <span className="font-mono text-xs">{selectedAgent.instance.transfer.last_external_address_v6}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 justify-between pt-2">
                    <div className="flex gap-2">
                      <Button 
                        variant="destructive" 
                        onClick={() => confirmDeleteAgent(selectedAgent)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </Button>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        onClick={() => showEditAgent(selectedAgent)}
                      >
                        <Check className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                      <Button variant="outline" onClick={() => setShowDetailsModal(false)}>
                        <X className="h-4 w-4 mr-2" />
                        Close
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* Delete Confirmation Modal */}
          <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Delete Agent</DialogTitle>
              </DialogHeader>
              
              {agentToDelete && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Are you sure you want to delete this agent? This action cannot be undone.
                  </p>
                  
                  <div className="flex items-center gap-3 p-3 bg-accent/50 rounded-lg">
                    <AgentIcon 
                      iconName={agentToDelete.icon}
                      color={agentToDelete.color}
                      size="md"
                      className="w-12 h-12 rounded-lg"
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
                      Cancel
                    </Button>
                    <Button 
                      variant="destructive" 
                      onClick={handleDeleteAgent}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* Edit Agent Modal */}
          <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Edit Agent - {agentToEdit?.name}</DialogTitle>
              </DialogHeader>
              
              {agentToEdit && (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="edit-name" className="text-sm">Name</Label>
                      <Input
                        id="edit-name"
                        placeholder="My Torrent Client"
                        value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="edit-address" className="text-sm">Address</Label>
                      <Input
                        id="edit-address"
                        placeholder="http://localhost:8080"
                        value={editForm.address}
                        onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                        className="h-9"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="edit-token" className="text-sm">Token (leave empty to keep current)</Label>
                    <Input
                      id="edit-token"
                      type="password"
                      placeholder="New authentication token"
                      value={editForm.token}
                      onChange={(e) => setEditForm({ ...editForm, token: e.target.value })}
                      className="h-9"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="edit-color" className="text-sm">Color</Label>
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
                    <Label htmlFor="edit-icon" className="text-sm">Icon</Label>
                    <div className="flex gap-1.5 flex-wrap">
                      {availableIcons.map((iconItem) => {
                        const IconComponent = iconItem.icon;
                        return (
                          <button
                            key={iconItem.name}
                            type="button"
                            className={`w-8 h-8 rounded-md border-2 flex items-center justify-center transition-all hover:scale-110 ${
                              editForm.icon === iconItem.name ? 'border-foreground bg-accent scale-110' : 'border-border hover:bg-accent/50'
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
                    <Label className="text-sm">Preview</Label>
                    <div className="flex items-center gap-3 p-3 bg-accent/50 rounded-lg">
                      <AgentIcon 
                        iconName={editForm.icon}
                        color={editForm.color}
                        size="md"
                        className="w-12 h-12 rounded-lg"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-sm">
                          {editForm.name || "Agent Name"}
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
                        setAgentToEdit(null);
                      }} 
                      size="sm"
                    >
                      Cancel
                    </Button>
                    <Button onClick={handleUpdateAgent} size="sm">
                      <Check className="h-4 w-4 mr-1" />
                      Update Agent
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}

export default Agents;
