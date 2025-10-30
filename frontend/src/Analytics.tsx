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
import { statisticsService } from '@/services/statistics';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { agentService } from '@/services/agents';


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
  type AgentTask = { task: string; diff: number };
  const [topUploaded, setTopUploaded] = useState<AgentTask[]>([]);
  const [taskNameById, setTaskNameById] = useState<Record<string, string>>({});

  // Manual refresh anchored to now, preserving current range duration
  const handleRefreshNow = () => {
    const now = new Date();
    const currentFrom = fromDate ?? new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const currentTo = toDate ?? now;
    const durationMs = Math.max(0, currentTo.getTime() - currentFrom.getTime());
    setToDate(now);
    setFromDate(new Date(now.getTime() - (durationMs || 24 * 60 * 60 * 1000)));
  };

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

  // Fetch Top Uploaded Torrents using upload-diffs endpoint
  useEffect(() => {
    const agentId = selectedAgentId || '';
    const to = (toDate ?? new Date()).toISOString();
    const from = (fromDate ?? new Date(Date.now() - 24 * 60 * 60 * 1000)).toISOString();

    const aggregateResults = (resultsArrays: AgentTask[][]) => {
      const taskDiffMap: Record<string, number> = {};
      resultsArrays.forEach(list => {
        list.forEach(({ task, diff }) => {
          taskDiffMap[task] = (taskDiffMap[task] || 0) + diff;
        });
      });
      const aggregated = Object.entries(taskDiffMap)
        .map(([task, diff]) => ({ task, diff }))
        .sort((a, b) => b.diff - a.diff)
        .slice(0, 10);
      setTopUploaded(aggregated);
    };

    if (agentId) {
      statisticsService
        .getUploadDiffs({ agentId, from, to, step: '5m', limit: 200 })
        .then((response) => {
          if (response.data?.results) {
            const byTask = response.data.results.reduce((acc: Record<string, number>, r) => {
              acc[r.task] = (acc[r.task] || 0) + r.diff;
              return acc;
            }, {});
            const list = Object.entries(byTask)
              .map(([task, diff]) => ({ task, diff }))
              .sort((a, b) => b.diff - a.diff)
              .slice(0, 10);
            setTopUploaded(list);
          } else {
            setTopUploaded([]);
          }
        })
        .catch(() => setTopUploaded([]));
    } else {
      // No agent selected: iterate active agents and aggregate
      agentService.listAgents()
        .then(async (res) => {
          const active = (res.data || []).filter(a => a.status === 'ACTIVE');
          if (active.length === 0) {
            setTopUploaded([]);
            return;
          }
          const calls = active.map(a => statisticsService.getUploadDiffs({ agentId: a.uuid, from, to, step: '5m', limit: 200 }));
          const settled = await Promise.allSettled(calls);
          const perAgentLists: AgentTask[][] = [];
          settled.forEach(s => {
            if (s.status === 'fulfilled') {
              const results = s.value.data?.results || [];
              const byTask: Record<string, number> = {};
              results.forEach(r => { byTask[r.task] = (byTask[r.task] || 0) + r.diff; });
              perAgentLists.push(Object.entries(byTask).map(([task, diff]) => ({ task, diff })));
            }
          });
          aggregateResults(perAgentLists);
        })
        .catch(() => setTopUploaded([]));
    }
  }, [fromDate, toDate, selectedAgentId]);

  // Fetch tasks once per agent context to build id->name map (reuse across components)
  useEffect(() => {
    const loadTasks = async () => {
      try {
        const agentId = selectedAgentId || '';
        const map: Record<string, string> = {};
        if (agentId) {
          const r = await agentService.listAgentTasks(agentId);
          const tasks = (r.data as unknown[] | undefined) || [];
          tasks.forEach((t: unknown) => { 
            const task = t as { id?: string; name?: string };
            if (task?.id) map[task.id] = task?.name || task?.id; 
          });
        } else {
          // No agent selected: fetch tasks per active agent and merge
          const agentsRes = await agentService.listAgents();
          const activeAgents = (agentsRes.data || []).filter(a => a.status === 'ACTIVE');
          const calls = activeAgents.map(a => agentService.listAgentTasks(a.uuid));
          const settled = await Promise.allSettled(calls);
          settled.forEach(s => {
            if (s.status === 'fulfilled') {
              const tasks = (s.value.data as unknown[] | undefined) || [];
              tasks.forEach((t: unknown) => { 
                const task = t as { id?: string; name?: string };
                if (task?.id) map[task.id] = task?.name || task?.id; 
              });
            }
          });
        }
        setTaskNameById(map);
      } catch {
        setTaskNameById({});
      }
    };
    loadTasks();
  }, [selectedAgentId]);

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
        
        {/* Date Range Selector + Refresh */}
        <div className="flex items-center gap-2">
          <DateRangePicker
            fromDate={fromDate}
            toDate={toDate}
            onFromDateChange={setFromDate}
            onToDateChange={setToDate}
          />
          <Button variant="outline" size="icon" aria-label="Refresh now" onClick={handleRefreshNow}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
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
            selectedAgentId={selectedAgentId || ''}
            topUploaded={topUploaded}
            taskNameById={taskNameById}
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
