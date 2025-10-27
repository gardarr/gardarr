import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  BarChart3, 
  Server,
  Monitor
} from 'lucide-react';
import DateRangePicker from '@/components/DateRangePicker';
import AgentMetrics from '@/components/analytics/AgentMetrics';
import TaskMetrics from '@/components/analytics/TaskMetrics';


// Main Analytics Component
const Analytics: React.FC = () => {
  const { t } = useTranslation();
  const { hash, agent_uuid, uuid } = useParams<{ hash?: string; agent_uuid?: string; uuid?: string }>();
  const navigate = useNavigate();
  
  const [selectedTaskId, setSelectedTaskId] = useState<string>('1');
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<string>('agents');
  const [fromDate, setFromDate] = useState<Date | undefined>(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)); // 7 days ago
  const [toDate, setToDate] = useState<Date | undefined>(new Date());

  // Handle URL parameters and sync with component state
  useEffect(() => {
    if (agent_uuid && uuid) {
      // Both agent and task in URL - open tasks tab with selected agent and task
      setActiveTab('tasks');
      setSelectedAgentId(agent_uuid);
      setSelectedTaskId(uuid);
    } else if (agent_uuid) {
      // Only agent in URL - open agents tab with selected agent
      setActiveTab('agents');
      setSelectedAgentId(agent_uuid);
    } else if (hash) {
      // Legacy task hash in URL - open tasks tab with selected task
      setActiveTab('tasks');
      // TODO: Find task by hash and set selectedTaskId
    } else {
      // No specific ID in URL, default to agents tab
      setActiveTab('agents');
      setSelectedAgentId('');
    }
  }, [agent_uuid, uuid, hash, navigate]);

  // Handle tab changes
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    if (value === 'agents') {
      // Navigate to base analytics URL when switching to agents tab
      navigate('/analytics');
      setSelectedAgentId('');
    } else if (value === 'tasks') {
      // Navigate to base analytics URL when switching to tasks tab
      navigate('/analytics');
    }
  };

  // Handle agent selection changes
  const handleAgentChange = (agentId: string) => {
    setSelectedAgentId(agentId);
    if (agentId) {
      // Update URL to include agent UUID
      navigate(`/analytics/agent/${agentId}`);
    } else {
      // Navigate to base analytics URL when no agent selected
      navigate('/analytics');
    }
  };

  // Get the effective agent ID for metrics calculation
  const getEffectiveAgentId = () => {
    // If no agent is selected, return null to indicate "all agents"
    // The AgentMetrics component will handle aggregating data from all active agents
    return selectedAgentId || null;
  };

  // Handle task selection changes
  const handleTaskChange = (taskId: string) => {
    setSelectedTaskId(taskId);
    if (selectedAgentId && taskId) {
      // Update URL to include both agent UUID and task UUID
      navigate(`/analytics/agent/${selectedAgentId}/task/${taskId}`);
    } else if (taskId) {
      // If no agent selected, just navigate to tasks tab
      navigate('/analytics');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <BarChart3 className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t("navigation.analytics")}</h1>
            <p className="text-muted-foreground">
              Monitor your torrent activity and performance metrics
            </p>
          </div>
        </div>
        
        {/* Date Range Selector */}
        <DateRangePicker
          fromDate={fromDate}
          toDate={toDate}
          onFromDateChange={setFromDate}
          onToDateChange={setToDate}
        />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="agents" className="flex items-center gap-2">
            <Server className="h-4 w-4" />
            Agent Metrics
          </TabsTrigger>
          <TabsTrigger value="tasks" className="flex items-center gap-2">
            <Monitor className="h-4 w-4" />
            Task Metrics
          </TabsTrigger>
        </TabsList>

        {/* Agent Metrics Tab */}
        <TabsContent value="agents" className="space-y-6">
          <AgentMetrics 
            fromDate={fromDate}
            toDate={toDate}
            selectedAgentId={getEffectiveAgentId()}
            onAgentChange={handleAgentChange}
          />
        </TabsContent>

        {/* Task Metrics Tab */}
        <TabsContent value="tasks" className="space-y-6">
          <TaskMetrics 
            fromDate={fromDate}
            toDate={toDate}
            selectedTaskId={selectedTaskId}
            selectedAgentId={selectedAgentId}
            onTaskChange={handleTaskChange}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Analytics;
