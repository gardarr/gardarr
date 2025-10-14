import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Server, 
  CheckCircle, 
  XCircle,
  AlertTriangle,
  Plus, 
  Trash2, 
  Search, 
  Loader2, 
  RefreshCw,
  HardDrive,
  Wifi,
  Activity,
  Database,
  Cloud,
  Monitor,
  Cpu,
  MemoryStick,
  HardDriveIcon,
  Globe,
  Router,
  Network,
  Download,
  Upload,
  FileText,
  Music,
  Video,
  Image,
  Archive,
  Folder,
  Zap,
  Shield
} from "lucide-react";
import { useEffect, useState } from "react";
import { agentService } from "./services/agents";
import type { Agent, AgentStatus, CreateAgentRequest } from "./types/agent";
import { useToast } from "./hooks/useToast";
import { ToastContainer } from "./components/ui/toast-container";

type SortType = "name" | "status" | "address";

// Available icons for agents
const availableIcons = [
  { name: "Server", component: Server },
  { name: "Database", component: Database },
  { name: "Cloud", component: Cloud },
  { name: "Monitor", component: Monitor },
  { name: "Cpu", component: Cpu },
  { name: "MemoryStick", component: MemoryStick },
  { name: "HardDrive", component: HardDriveIcon },
  { name: "Globe", component: Globe },
  { name: "Router", component: Router },
  { name: "Network", component: Network },
  { name: "Download", component: Download },
  { name: "Upload", component: Upload },
  { name: "FileText", component: FileText },
  { name: "Music", component: Music },
  { name: "Video", component: Video },
  { name: "Image", component: Image },
  { name: "Archive", component: Archive },
  { name: "Folder", component: Folder },
  { name: "Zap", component: Zap },
  { name: "Shield", component: Shield }
];

// Available colors for agents
const availableColors = [
  { name: "Blue", value: "#3b82f6", bg: "bg-blue-500" },
  { name: "Green", value: "#10b981", bg: "bg-green-500" },
  { name: "Purple", value: "#8b5cf6", bg: "bg-purple-500" },
  { name: "Red", value: "#ef4444", bg: "bg-red-500" },
  { name: "Orange", value: "#f97316", bg: "bg-orange-500" },
  { name: "Pink", value: "#ec4899", bg: "bg-pink-500" },
  { name: "Indigo", value: "#6366f1", bg: "bg-indigo-500" },
  { name: "Teal", value: "#14b8a6", bg: "bg-teal-500" },
  { name: "Yellow", value: "#eab308", bg: "bg-yellow-500" },
  { name: "Gray", value: "#6b7280", bg: "bg-gray-500" }
];

function Agents() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<SortType>("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState<CreateAgentRequest>({
    name: "",
    type: "qbittorrent",
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

  const handleDeleteAgent = async (agentId: string) => {
    if (!confirm('Are you sure you want to delete this agent?')) {
      return;
    }

    try {
      const response = await agentService.deleteAgent(agentId);
      if (response.error) {
        showError(response.error);
      } else {
        // Remove agent from local state
        setAgents(agents.filter(agent => agent.uuid !== agentId));
        showSuccess('Agent deleted successfully');
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
        setShowCreateForm(false);
        setCreateForm({ name: "", type: "qbittorrent", address: "", token: "", icon: "Server", color: "#3b82f6" });
        showSuccess('Agent created successfully');
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to create agent');
    }
  };

  // Filter and sort agents
  const filteredAndSortedAgents = agents
    .filter(agent => 
      agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      agent.address.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case "name":
          comparison = a.name.localeCompare(b.name);
          break;
        case "status":
          comparison = a.status.localeCompare(b.status);
          break;
        case "address":
          comparison = a.address.localeCompare(b.address);
          break;
      }
      
      return sortOrder === "asc" ? comparison : -comparison;
    });

  const getStatusIcon = (status: AgentStatus) => {
    switch (status) {
      case 'ACTIVE':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'ERRORED':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'INACTIVE':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: AgentStatus) => {
    switch (status) {
      case 'ACTIVE':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'ERRORED':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'INACTIVE':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading agents...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Agents</h1>
          <p className="text-muted-foreground">
            Manage your torrent clients and their connections
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadAgents}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={() => setShowCreateForm(true)}>
            <Plus className="h-4 w-4" />
            Add Agent
          </Button>
        </div>
      </div>

      {/* Create Agent Form */}
      {showCreateForm && (
        <Card>
          <CardHeader>
            <CardTitle>Add New Agent</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Name</label>
                <Input
                  value={createForm.name}
                  onChange={(e) => setCreateForm({...createForm, name: e.target.value})}
                  placeholder="Agent name"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Type</label>
                <Input
                  value={createForm.type}
                  onChange={(e) => setCreateForm({...createForm, type: e.target.value})}
                  placeholder="qbittorrent"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Address</label>
                <Input
                  value={createForm.address}
                  onChange={(e) => setCreateForm({...createForm, address: e.target.value})}
                  placeholder="http://localhost:8080"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Token</label>
                <Input
                  type="password"
                  value={createForm.token}
                  onChange={(e) => setCreateForm({...createForm, token: e.target.value})}
                  placeholder="Authentication token"
                />
              </div>
            </div>
            
            {/* Icon Selector */}
            <div>
              <label className="text-sm font-medium mb-2 block">Icon</label>
              <div className="grid grid-cols-5 gap-2">
                {availableIcons.map((iconOption) => {
                  const IconComponent = iconOption.component;
                  return (
                    <button
                      key={iconOption.name}
                      type="button"
                      onClick={() => setCreateForm({...createForm, icon: iconOption.name})}
                      className={`p-3 border rounded-lg hover:bg-gray-50 transition-colors ${
                        createForm.icon === iconOption.name 
                          ? 'border-blue-500 bg-blue-50' 
                          : 'border-gray-200'
                      }`}
                    >
                      <IconComponent className="h-6 w-6 mx-auto" />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Color Selector */}
            <div>
              <label className="text-sm font-medium mb-2 block">Color</label>
              <div className="flex flex-wrap gap-2">
                {availableColors.map((colorOption) => (
                  <button
                    key={colorOption.name}
                    type="button"
                    onClick={() => setCreateForm({...createForm, color: colorOption.value})}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      createForm.color === colorOption.value 
                        ? 'border-gray-800 scale-110' 
                        : 'border-gray-300 hover:scale-105'
                    }`}
                    style={{ backgroundColor: colorOption.value }}
                    title={colorOption.name}
                  />
                ))}
              </div>
            </div>

            {/* Preview */}
            <div>
              <label className="text-sm font-medium mb-2 block">Preview</label>
              <div className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg bg-gray-50">
                {(() => {
                  const iconData = availableIcons.find(icon => icon.name === createForm.icon);
                  const IconComponent = iconData ? iconData.component : Server;
                  return (
                    <IconComponent 
                      className="h-8 w-8" 
                      style={{ color: createForm.color || '#3b82f6' }}
                    />
                  );
                })()}
                <div>
                  <div className="font-medium text-gray-900">
                    {createForm.name || "Agent Name"}
                  </div>
                  <div className="text-sm text-gray-500">
                    {createForm.type} • {createForm.address || "Address"}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex space-x-2">
              <Button onClick={handleCreateAgent}>Create Agent</Button>
              <Button variant="outline" onClick={() => setShowCreateForm(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search and Sort */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center space-x-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search agents..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">Sort by:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortType)}
                className="px-3 py-1 border rounded-md text-sm"
              >
                <option value="name">Name</option>
                <option value="status">Status</option>
                <option value="address">Address</option>
              </select>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
              >
                {sortOrder === "asc" ? "↑" : "↓"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Agents Grid */}
      {filteredAndSortedAgents.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Server className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No agents found</h3>
              <p className="text-gray-500 mb-4">
                {searchTerm ? 'No agents match your search criteria.' : 'Get started by adding your first agent.'}
              </p>
              {!searchTerm && (
                <Button onClick={() => setShowCreateForm(true)}>
                  <Plus className="h-4 w-4" />
                  Add Agent
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAndSortedAgents.map((agent) => (
            <Card key={agent.uuid} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {(() => {
                      const iconData = availableIcons.find(icon => icon.name === agent.icon);
                      const IconComponent = iconData ? iconData.component : Server;
                      return (
                        <IconComponent 
                          className="h-5 w-5" 
                          style={{ color: agent.color || '#3b82f6' }}
                        />
                      );
                    })()}
                    <CardTitle className="text-lg">{agent.name}</CardTitle>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteAgent(agent.uuid)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Status */}
                <div className="flex items-center space-x-2">
                  {getStatusIcon(agent.status)}
                  <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(agent.status)}`}>
                    {agent.status}
                  </span>
                </div>

                {/* Address */}
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <Wifi className="h-4 w-4" />
                  <span className="truncate">{agent.address}</span>
                </div>

                {/* Error Message */}
                {agent.error && (
                  <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                    {agent.error}
                  </div>
                )}

                {/* Instance Info */}
                {agent.instance && (
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2 text-sm">
                      <Activity className="h-4 w-4 text-green-500" />
                      <span>Version: {agent.instance.application.version}</span>
                    </div>
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <HardDrive className="h-4 w-4" />
                      <span>Free Space: {formatBytes(agent.instance.server.free_space_on_disk)}</span>
                    </div>
                    <div className="text-sm text-gray-600">
                      <div>Downloaded: {formatBytes(agent.instance.transfer.all_time_downloaded)}</div>
                      <div>Uploaded: {formatBytes(agent.instance.transfer.all_time_uploaded)}</div>
                      <div>Ratio: {agent.instance.transfer.global_ratio.toFixed(2)}</div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}

export default Agents;
