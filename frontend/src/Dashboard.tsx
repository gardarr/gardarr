import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Activity,
  AlertTriangle
} from 'lucide-react';
import DateRangePicker from '@/components/DateRangePicker';
import AgentMetrics from '@/components/analytics/AgentMetrics';
import { statisticsService } from '@/services/statistics';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { agentService } from '@/services/agents';
import { SelectAgent } from '@/components/SelectAgent';
import { setupService } from '@/services/setup';
import { Card, CardContent } from '@/components/ui/card';


// Main Dashboard Component
const Dashboard: React.FC = () => {
  const { t } = useTranslation();
  const { hash, agent_uuid } = useParams<{ hash?: string; agent_uuid?: string }>();
  const navigate = useNavigate();
  
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [fromDate, setFromDate] = useState<Date | undefined>(new Date(Date.now() - 24 * 60 * 60 * 1000)); // 1 day ago
  const [toDate, setToDate] = useState<Date | undefined>(new Date());
  type AgentTask = { task: string; diff: number };
  const [topUploaded, setTopUploaded] = useState<AgentTask[]>([]);
  const [taskNameById, setTaskNameById] = useState<Record<string, string>>({});
  const [statisticsEnabled, setStatisticsEnabled] = useState<boolean>(true);

  // Manual refresh anchored to now, preserving current range duration
  const handleRefreshNow = () => {
    const now = new Date();
    const currentFrom = fromDate ?? new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const currentTo = toDate ?? now;
    const durationMs = Math.max(0, currentTo.getTime() - currentFrom.getTime());
    setToDate(now);
    setFromDate(new Date(now.getTime() - (durationMs || 24 * 60 * 60 * 1000)));
  };

  // Handle agent selection changes
  const handleAgentChange = (agentId: string) => {
    setSelectedAgentId(agentId);
    // Update URL without reloading page
    if (agentId && agentId.trim() !== '') {
      navigate(`/agent/${agentId}`, { replace: true });
    } else {
      navigate('/', { replace: true });
    }
  };

  // Check setup status to determine if statistics are enabled
  useEffect(() => {
    const checkStatisticsStatus = async () => {
      try {
        const result = await setupService.checkSetup();
        setStatisticsEnabled(result.data?.statistics_enabled ?? true);
      } catch (error) {
        // On error, assume statistics are enabled to avoid blocking the UI
        console.error('Failed to check statistics status:', error);
        setStatisticsEnabled(true);
      }
    };
    checkStatisticsStatus();
  }, []);

  // Handle URL parameters and sync with component state
  useEffect(() => {
    if (agent_uuid) {
      // Agent in URL
      setSelectedAgentId(agent_uuid);
    } else if (hash) {
      // Legacy task hash in URL
      // TODO: Find task by hash
    } else {
      // No specific ID in URL
      setSelectedAgentId('');
    }
  }, [agent_uuid, hash]);

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


  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Activity className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t("navigation.dashboard")}</h1>
            <p className="text-muted-foreground">
              {t("dashboard.description")}
            </p>
          </div>
        </div>
        
        {/* Agent Selector + Date Range Selector + Refresh */}
        <div className="flex flex-row items-center gap-2 flex-wrap">
          <div className="w-48 flex-shrink-0">
            <SelectAgent
              selectedAgentId={selectedAgentId || null}
              onAgentChange={(id) => handleAgentChange(id || '')}
              label=""
              className="space-y-0"
            />
          </div>
          <DateRangePicker
            fromDate={fromDate}
            toDate={toDate}
            onFromDateChange={setFromDate}
            onToDateChange={setToDate}
          />
          <Button variant="outline" size="icon" aria-label={t("dashboard.refreshNow")} onClick={handleRefreshNow} className="flex-shrink-0">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Statistics Warning */}
      {!statisticsEnabled && (
        <Card className="py-4">
          <CardContent className="flex items-center gap-3 py-0">
            <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="h-4 w-4 text-primary" />
            </div>
            <div className="text-sm text-muted-foreground">
              {t("dashboard.statisticsDisabled")}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Agent Metrics */}
      <div className="space-y-6">
        <AgentMetrics 
          fromDate={fromDate}
          toDate={toDate}
          selectedAgentId={selectedAgentId || ''}
          topUploaded={topUploaded}
          taskNameById={taskNameById}
          onAgentChange={handleAgentChange}
        />
      </div>
    </div>
  );
};

export default Dashboard;

