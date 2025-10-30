import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  BarChart3, 
  HardDrive, 
  Download, 
  Upload, 
  Activity, 
  TrendingUp, 
  Server
} from 'lucide-react';
import type { TaskStats, Agent } from '../../types/agent';
 import { agentService } from '../../services/agents';
import MostUploadedTorrents from '@/components/widgets/MostUploadedTorrents';
import RecentCreatedTorrents from '@/components/widgets/RecentCreatedTorrents';
import MostUsedCategoriesWidget from '@/components/widgets/MostUsedCategoriesWidget';

// Mock data for analytics
const mockTaskStats: TaskStats = {
  total_disk_size: 2.4 * 1024 * 1024 * 1024 * 1024, // 2.4 TB
  current_upload_speed: 15.2 * 1024 * 1024, // 15.2 MB/s
  current_download_speed: 45.8 * 1024 * 1024, // 45.8 MB/s
  average_ratio: 1.24,
  median_ratio: 1.15,
  highest_ratio: 3.67,
  lowest_ratio: 0.12,
  active_tasks_count: 23,
  total_tasks_count: 45,
  active_seeds: 156,
  active_peers: 89,
  swarm_seeders: 320,
  swarm_leechers: 210,
  category_usage: {
    'movies': 45,
    'tv-shows': 32,
    'music': 18,
    'software': 12,
    'books': 8
  },
  tags_usage: {
    '4k': 15,
    '1080p': 28,
    '720p': 12,
    'hdr': 8,
    'dolby-atmos': 6
  },
  word_cloud: {
    'movie': 15,
    'series': 12,
    'episode': 10,
    'season': 8,
    'hd': 7,
    'bluray': 6,
    'x264': 5,
    '1080p': 4,
    'hdtv': 3,
    'webrip': 2,
    'torrent': 8,
    'download': 5,
    'complete': 4,
    'rip': 3,
    'quality': 2
  }
};

const mockAgents: Agent[] = [
  {
    uuid: '1',
    name: 'qBittorrent',
    address: 'http://localhost:8080',
    status: 'ACTIVE',
    icon: '⚡',
    color: '#ff6b6b',
    instance: {
      application: { version: '4.6.0', api_version: '2.0' },
      server: { free_space_on_disk: 500 * 1024 * 1024 * 1024 },
      transfer: {
        all_time_downloaded: 1.2 * 1024 * 1024 * 1024 * 1024,
        all_time_uploaded: 1.5 * 1024 * 1024 * 1024 * 1024,
        global_ratio: 1.25,
        last_external_address_v4: '192.168.1.100',
        last_external_address_v6: '::1'
      }
    }
  },
  {
    uuid: '2',
    name: 'Transmission',
    address: 'http://localhost:9091',
    status: 'ACTIVE',
    icon: '🌊',
    color: '#4ecdc4',
    instance: {
      application: { version: '4.0.3', api_version: '1.0' },
      server: { free_space_on_disk: 300 * 1024 * 1024 * 1024 },
      transfer: {
        all_time_downloaded: 800 * 1024 * 1024 * 1024,
        all_time_uploaded: 900 * 1024 * 1024 * 1024,
        global_ratio: 1.12,
        last_external_address_v4: '192.168.1.101',
        last_external_address_v6: '::1'
      }
    }
  }
];


// Utility functions
const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const formatSpeed = (bytesPerSecond: number): string => {
  return formatBytes(bytesPerSecond) + '/s';
};


// Metric Card Component
interface MetricCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  color?: string;
}

const MetricCard: React.FC<MetricCardProps> = ({ title, value, subtitle, icon: Icon, color }) => (
  <Card className="hover:shadow-lg transition-shadow">
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium text-muted-foreground">
        {title}
      </CardTitle>
      <Icon className={`h-4 w-4 ${color || 'text-primary'}`} />
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
      {subtitle && (
        <p className="text-xs text-muted-foreground mt-1">
          {subtitle}
        </p>
      )}
    </CardContent>
  </Card>
);


// Word Cloud Component
interface WordCloudProps {
  wordCloud: Record<string, number>;
  title: string;
}

const WordCloud: React.FC<WordCloudProps> = ({ wordCloud, title }) => {
  const sortedTerms = Object.entries(wordCloud)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 25); // Limit to top 25 terms

  const maxCount = sortedTerms.length > 0 ? Math.max(...sortedTerms.map(([, count]) => count)) : 0;
  const minCount = sortedTerms.length > 0 ? Math.min(...sortedTerms.map(([, count]) => count)) : 0;

  // Color variations for theme compatibility
  const colors = [
    'text-blue-500',
    'text-green-500', 
    'text-purple-500',
    'text-orange-500',
    'text-pink-500',
    'text-cyan-500',
    'text-lime-500',
    'text-red-500',
    'text-indigo-500',
    'text-teal-500'
  ];

  const getFontSize = (count: number) => {
    if (maxCount === minCount) return 16; // Default size when all counts are the same
    const ratio = (count - minCount) / (maxCount - minCount);
    return Math.max(12, Math.min(32, 12 + ratio * 20));
  };

  const getColor = (index: number) => {
    return colors[index % colors.length];
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="min-h-[200px] p-4 border border-dashed border-border rounded-lg">
          {sortedTerms.length > 0 ? (
            <div className="flex flex-wrap gap-2 justify-center items-center h-full">
              {sortedTerms.map(([term, count], index) => (
                <div
                  key={term}
                  className="relative group"
                >
                  <span
                    className={`inline-block px-2 py-1 rounded-md bg-secondary/50 hover:bg-secondary transition-colors cursor-pointer ${getColor(index)}`}
                    style={{ 
                      fontSize: `${getFontSize(count)}px`,
                      fontWeight: count > maxCount * 0.7 ? 'bold' : 'normal'
                    }}
                  >
                    {term}
                  </span>
                  {/* Tooltip */}
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                    {term}: {count} occurrences
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <p>No terms available</p>
            </div>
          )}
        </div>
        <div className="mt-4 text-xs text-muted-foreground text-center">
          {sortedTerms.length} terms from task names • Hover terms to see frequency
        </div>
      </CardContent>
    </Card>
  );
};

interface AgentMetricsProps {
  fromDate?: Date;
  toDate?: Date;
  selectedAgentId?: string | null;
  topUploaded?: Array<{ task: string; diff: number }>;
  taskNameById?: Record<string, string>;
}

const AgentMetrics: React.FC<AgentMetricsProps> = ({ fromDate, toDate, selectedAgentId, topUploaded, taskNameById }) => {
  const [stats, setStats] = useState<TaskStats | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);

  // API calls for agent metrics
  useEffect(() => {
    let isMounted = true; // Flag to track if component is mounted
    
    const fetchAgentMetrics = async () => {
      setIsLoading(true);
      try {
        console.log('Fetching metrics for selectedAgentId:', selectedAgentId, 'Type:', typeof selectedAgentId);
        
        // Early return if no selectedAgentId to avoid unnecessary processing
        if (!selectedAgentId || selectedAgentId.trim() === '') {
          console.log('No selectedAgentId, loading aggregated data from all agents');
          // Fetch agents list
          const agentsResponse = await agentService.listAgents();
          if (!isMounted) return; // Check if still mounted
          
          setAgents(agentsResponse.data || []);
          
          // If no specific agent selected, aggregate data from all active agents
          const activeAgents = agentsResponse.data?.filter(agent => agent.status === 'ACTIVE') || [];
          
          if (activeAgents.length > 0) {
            // Fetch stats for all active agents
            const statsPromises = activeAgents.map(agent => 
              agentService.getAgentTaskStats(agent.uuid).catch(() => null)
            );
            
            const allStats = await Promise.all(statsPromises);
            if (!isMounted) return; // Check if still mounted
            
            const validStats = allStats.filter(response => response?.data);
            
            if (validStats.length > 0) {
              console.log('Aggregating stats from', validStats.length, 'agents');
              // Aggregate the stats from all active agents
              const aggregatedStats = validStats.reduce((acc, response) => {
                const data = response!.data!;
                console.log('Adding stats from agent:', data);
                return {
                  total_disk_size: acc.total_disk_size + data.total_disk_size,
                  current_upload_speed: acc.current_upload_speed + data.current_upload_speed,
                  current_download_speed: acc.current_download_speed + data.current_download_speed,
                  average_ratio: (acc.average_ratio + data.average_ratio) / 2, // Average of averages
                  median_ratio: (acc.median_ratio + data.median_ratio) / 2, // Average of medians
                  highest_ratio: Math.max(acc.highest_ratio, data.highest_ratio),
                  lowest_ratio: Math.min(acc.lowest_ratio, data.lowest_ratio),
                  active_tasks_count: acc.active_tasks_count + data.active_tasks_count,
                  total_tasks_count: acc.total_tasks_count + data.total_tasks_count,
                  active_seeds: acc.active_seeds + data.active_seeds,
                  active_peers: acc.active_peers + data.active_peers,
                  swarm_seeders: acc.swarm_seeders + (data.swarm_seeders ?? 0),
                  swarm_leechers: acc.swarm_leechers + (data.swarm_leechers ?? 0),
                  category_usage: Object.keys(data.category_usage).reduce((catAcc, category) => {
                    catAcc[category] = (catAcc[category] || 0) + data.category_usage[category];
                    return catAcc;
                  }, acc.category_usage),
                  tags_usage: Object.keys(data.tags_usage).reduce((tagAcc, tag) => {
                    tagAcc[tag] = (tagAcc[tag] || 0) + data.tags_usage[tag];
                    return tagAcc;
                  }, acc.tags_usage),
                  word_cloud: Object.keys(data.word_cloud || {}).reduce((wordAcc, word) => {
                    wordAcc[word] = (wordAcc[word] || 0) + data.word_cloud[word];
                    return wordAcc;
                  }, acc.word_cloud)
                };
              }, {
                total_disk_size: 0,
                current_upload_speed: 0,
                current_download_speed: 0,
                average_ratio: 0,
                median_ratio: 0,
                highest_ratio: 0,
                lowest_ratio: Infinity,
                active_tasks_count: 0,
                total_tasks_count: 0,
                active_seeds: 0,
                active_peers: 0,
                swarm_seeders: 0,
                swarm_leechers: 0,
                category_usage: {} as Record<string, number>,
                tags_usage: {} as Record<string, number>,
                word_cloud: {} as Record<string, number>
              });
              
              // Fix lowest_ratio if no valid ratios were found
              if (aggregatedStats.lowest_ratio === Infinity) {
                aggregatedStats.lowest_ratio = 0;
              }
              
              console.log('Final aggregated stats:', aggregatedStats);
              if (isMounted) setStats(aggregatedStats);
            } else {
              // Fallback to mock data if no valid stats
              if (isMounted) setStats(mockTaskStats);
            }
          } else {
            // No active agents, use mock data
            if (isMounted) setStats(mockTaskStats);
          }
          return;
        }
        
        // If a specific agent is selected, fetch its stats, agent details and windowed data
        if (selectedAgentId && selectedAgentId.trim() !== '') {
          console.log('Loading single agent data for:', selectedAgentId);
        const [statsResponse, agentResponse] = await Promise.all([
          agentService.getAgentTaskStats(selectedAgentId),
          agentService.getAgent(selectedAgentId)
        ]);
          
          if (!isMounted) return; // Check if still mounted
          
          console.log('Single agent stats:', statsResponse.data);
          setStats(statsResponse.data || null);
          
          // Update the agent with real storage information
          if (agentResponse.data) {
            const updatedAgent = { ...agentResponse.data };
            // Ensure the selected agent is present in the agents list and set it as selected
            setAgents(prevAgents => {
              const exists = prevAgents.some(agent => agent.uuid === selectedAgentId);
              if (exists) {
                return prevAgents.map(agent =>
                  agent.uuid === selectedAgentId ? updatedAgent : agent
                );
              }
              return [...prevAgents, updatedAgent];
            });
            setSelectedAgent(updatedAgent);
          }
        }
      } catch (error) {
        console.error('Failed to fetch agent metrics:', error);
        // Set fallback data
        if (isMounted) {
          setStats(mockTaskStats);
          setAgents(mockAgents);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchAgentMetrics();
    
    // Cleanup function to mark component as unmounted
    return () => {
      isMounted = false;
    };
  }, [fromDate, toDate, selectedAgentId]);

  // Handle selectedAgentId changes
  useEffect(() => {
    if (selectedAgentId && agents.length > 0) {
      const agent = agents.find(a => a.uuid === selectedAgentId);
      setSelectedAgent(agent || null);
    } else {
      setSelectedAgent(null);
    }
  }, [selectedAgentId, agents]);


  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Metrics Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-3 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Charts Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Array.from({ length: 2 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <div key={j} className="flex items-center justify-between">
                      <Skeleton className="h-4 w-20" />
                      <div className="flex items-center space-x-3 flex-1 mx-4">
                        <Skeleton className="flex-1 h-2" />
                        <Skeleton className="h-4 w-8" />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Failed to load agent metrics</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* All Information Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Storage"
          value={formatBytes(stats.total_disk_size)}
          subtitle={selectedAgent ? `Free: ${formatBytes(selectedAgent.instance.server.free_space_on_disk)}` : `Free: ${formatBytes(agents.filter(a => a.status === 'ACTIVE').reduce((sum, agent) => sum + agent.instance.server.free_space_on_disk, 0))}`}
          icon={HardDrive}
          color="text-blue-500"
        />
        <MetricCard
          title="Download Speed"
          value={formatSpeed(stats.current_download_speed)}
          subtitle={selectedAgent ? `${selectedAgent.name}` : `Combined from ${agents.filter(a => a.status === 'ACTIVE').length} agents`}
          icon={Download}
          color="text-green-500"
        />
        <MetricCard
          title="Upload Speed"
          value={formatSpeed(stats.current_upload_speed)}
          subtitle={selectedAgent ? `${selectedAgent.name}` : `Combined from ${agents.filter(a => a.status === 'ACTIVE').length} agents`}
          icon={Upload}
          color="text-purple-500"
        />
        <MetricCard
          title="Active Tasks"
          value={stats.active_tasks_count.toString()}
          subtitle={`${stats.total_tasks_count} total tasks`}
          icon={Activity}
          color="text-purple-500"
        />
        <MetricCard
          title="Ratio"
          value={selectedAgent ? selectedAgent.instance.transfer.global_ratio.toFixed(2) : stats.average_ratio.toFixed(2)}
          subtitle={`${stats.highest_ratio.toFixed(2)} highest / ${stats.lowest_ratio.toFixed(2)} lowest`}
          icon={TrendingUp}
          color="text-lime-500"
        />
        <MetricCard
          title="Connected Seeders"
          value={stats.active_seeds.toString()}
          subtitle={selectedAgent ? `Swarm: ${stats.swarm_seeders ?? 0}` : `Active seeders`}
          icon={Upload}
          color="text-green-500"
        />
        <MetricCard
          title="Connected Peers"
          value={stats.active_peers.toString()}
          subtitle={selectedAgent ? `Swarm: ${stats.swarm_leechers ?? 0}` : `Active peers`}
          icon={Download}
          color="text-orange-500"
        />
      </div>


      {/* Word Cloud Section */}
      <WordCloud
        wordCloud={stats.word_cloud || {}}
        title="Task Terms Cloud"
      />


      {/* Activities Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Created Torrents Card */}
        <RecentCreatedTorrents />

        {/* Most Used Categories & Tags Widget */}
        <MostUsedCategoriesWidget 
          categoryUsage={stats.category_usage}
          tagsUsage={stats.tags_usage}
        />

        {/* Most Uploaded Torrents Card */}
        <MostUploadedTorrents items={topUploaded} taskNameById={taskNameById} />
      </div>

      {/* Selected Agent Details */}
      {selectedAgent && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              Selected Agent: {selectedAgent.name}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Address</p>
                <p className="text-sm">{selectedAgent.address}</p>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Version</p>
                <p className="text-sm">{selectedAgent.instance.application.version}</p>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Free Space</p>
                <p className="text-sm">{formatBytes(selectedAgent.instance.server.free_space_on_disk)}</p>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Global Ratio</p>
                <p className="text-sm">{selectedAgent.instance.transfer.global_ratio.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

    </div>
  );
};

export default AgentMetrics;
