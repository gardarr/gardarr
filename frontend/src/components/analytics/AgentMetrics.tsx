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
import type { Task } from '../../types/torrent';
 import { agentService } from '../../services/agents';
import MostUploadedTorrents from '@/components/widgets/MostUploadedTorrents';
import ConnectedPeersCard from '@/components/widgets/ConnectedPeersCard';
import ConnectedSeedersCard from '@/components/widgets/ConnectedSeedersCard';
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
  active_seeds: 156,
  active_peers: 89,
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

const mockRecentTasks: Task[] = [
  {
    id: '1',
    name: 'The Matrix 4K HDR',
    hash: 'abc123def456',
    state: 'downloading',
    category: 'movies',
    path: '/downloads/movies',
    priority: 1,
    ratio: 0.0,
    size: 25 * 1024 * 1024 * 1024,
    progress: 65.5,
    magnet_uri: 'magnet:?xt=urn:btih:abc123def456',
    magnet_link: {
      hash: 'abc123def456',
      display_name: 'The Matrix 4K HDR',
      trackers: ['http://tracker.example.com'],
      exact_length: '26843545600',
      exact_source: 'example.com'
    },
    popularity: 95,
    pairs: {
      swarm_seeders: 45,
      swarm_leechers: 23,
      seeders: 42,
      leechers: 21
    },
    network: {
      download: { speed: 15.2 * 1024 * 1024, amount: 16.4 * 1024 * 1024 * 1024 },
      upload: { speed: 2.1 * 1024 * 1024, amount: 1.2 * 1024 * 1024 * 1024 }
    },
    tags: ['4k', 'hdr', 'dolby-atmos']
  },
  {
    id: '2',
    name: 'Stranger Things S04',
    hash: 'def456ghi789',
    state: 'seeding',
    category: 'tv-shows',
    path: '/downloads/tv',
    priority: 2,
    ratio: 2.34,
    size: 18 * 1024 * 1024 * 1024,
    progress: 100.0,
    magnet_uri: 'magnet:?xt=urn:btih:def456ghi789',
    magnet_link: {
      hash: 'def456ghi789',
      display_name: 'Stranger Things S04',
      trackers: ['http://tracker.example.com'],
      exact_length: '19327352832',
      exact_source: 'example.com'
    },
    popularity: 88,
    pairs: {
      swarm_seeders: 78,
      swarm_leechers: 12,
      seeders: 75,
      leechers: 10
    },
    network: {
      download: { speed: 0, amount: 18 * 1024 * 1024 * 1024 },
      upload: { speed: 8.5 * 1024 * 1024, amount: 42.1 * 1024 * 1024 * 1024 }
    },
    tags: ['1080p', 'hdr']
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
  tasks: Task[];
  title: string;
}

const WordCloud: React.FC<WordCloudProps> = ({ tasks, title }) => {
  // Extract and process terms from task names and tags
  const extractTerms = (tasks: Task[]) => {
    const termCounts: Record<string, number> = {};
    
    tasks.forEach(task => {
      // Extract terms from task name (split by common separators)
      const nameTerms = task.name
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(term => term.length > 2 && !['the', 'and', 'for', 'with', 'from', 'this', 'that'].includes(term));
      
      // Add terms from tags
      const tagTerms = task.tags || [];
      
      // Combine and count terms
      [...nameTerms, ...tagTerms].forEach(term => {
        if (term && term.length > 1) {
          termCounts[term] = (termCounts[term] || 0) + 1;
        }
      });
    });
    
    return termCounts;
  };

  const termCounts = extractTerms(tasks);
  const sortedTerms = Object.entries(termCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 25); // Limit to top 25 terms

  const maxCount = Math.max(...sortedTerms.map(([, count]) => count));
  const minCount = Math.min(...sortedTerms.map(([, count]) => count));

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
                <span
                  key={term}
                  className={`inline-block px-2 py-1 rounded-md bg-secondary/50 hover:bg-secondary transition-colors cursor-pointer ${getColor(index)}`}
                  style={{ 
                    fontSize: `${getFontSize(count)}px`,
                    fontWeight: count > maxCount * 0.7 ? 'bold' : 'normal'
                  }}
                  title={`${term}: ${count} occurrences`}
                >
                  {term}
                </span>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <p>No terms available</p>
            </div>
          )}
        </div>
        <div className="mt-4 text-xs text-muted-foreground text-center">
          {sortedTerms.length} terms from {tasks.length} tasks • Click terms to see frequency
        </div>
      </CardContent>
    </Card>
  );
};

interface AgentMetricsProps {
  fromDate?: Date;
  toDate?: Date;
  selectedAgentId?: string | null;
  onAgentChange?: (agentId: string) => void;
}

const AgentMetrics: React.FC<AgentMetricsProps> = ({ fromDate, toDate, selectedAgentId, onAgentChange }) => {
  const [stats, setStats] = useState<TaskStats | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [recentTasks, setRecentTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);

  // API calls for agent metrics
  useEffect(() => {
    const fetchAgentMetrics = async () => {
      setIsLoading(true);
      try {
        // Fetch agents list
        const agentsResponse = await agentService.listAgents();
        setAgents(agentsResponse.data || []);
        
        // If a specific agent is selected, fetch its stats and agent details
        if (selectedAgentId) {
          const [statsResponse, agentResponse] = await Promise.all([
            agentService.getAgentTaskStats(selectedAgentId),
            agentService.getAgent(selectedAgentId)
          ]);
          
          setStats(statsResponse.data || null);
          
          // Update the agent with real storage information
          if (agentResponse.data) {
            const updatedAgent = { ...agentResponse.data };
            setAgents(prevAgents => 
              prevAgents.map(agent => 
                agent.uuid === selectedAgentId ? updatedAgent : agent
              )
            );
          }
        } else {
          // If no specific agent selected, aggregate data from all active agents
          const activeAgents = agentsResponse.data?.filter(agent => agent.status === 'ACTIVE') || [];
          
          if (activeAgents.length > 0) {
            // Fetch stats for all active agents
            const statsPromises = activeAgents.map(agent => 
              agentService.getAgentTaskStats(agent.uuid).catch(() => null)
            );
            
            const allStats = await Promise.all(statsPromises);
            const validStats = allStats.filter(response => response?.data);
            
            if (validStats.length > 0) {
              // Aggregate the stats from all active agents
              const aggregatedStats = validStats.reduce((acc, response) => {
                const data = response!.data!;
                return {
                  total_disk_size: acc.total_disk_size + data.total_disk_size,
                  current_upload_speed: acc.current_upload_speed + data.current_upload_speed,
                  current_download_speed: acc.current_download_speed + data.current_download_speed,
                  average_ratio: (acc.average_ratio + data.average_ratio) / 2, // Average of averages
                  median_ratio: (acc.median_ratio + data.median_ratio) / 2, // Average of medians
                  highest_ratio: Math.max(acc.highest_ratio, data.highest_ratio),
                  lowest_ratio: Math.min(acc.lowest_ratio, data.lowest_ratio),
                  active_tasks_count: acc.active_tasks_count + data.active_tasks_count,
                  active_seeds: acc.active_seeds + data.active_seeds,
                  active_peers: acc.active_peers + data.active_peers,
                  category_usage: Object.keys(data.category_usage).reduce((catAcc, category) => {
                    catAcc[category] = (catAcc[category] || 0) + data.category_usage[category];
                    return catAcc;
                  }, acc.category_usage),
                  tags_usage: Object.keys(data.tags_usage).reduce((tagAcc, tag) => {
                    tagAcc[tag] = (tagAcc[tag] || 0) + data.tags_usage[tag];
                    return tagAcc;
                  }, acc.tags_usage)
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
                active_seeds: 0,
                active_peers: 0,
                category_usage: {} as Record<string, number>,
                tags_usage: {} as Record<string, number>
              });
              
              // Fix lowest_ratio if no valid ratios were found
              if (aggregatedStats.lowest_ratio === Infinity) {
                aggregatedStats.lowest_ratio = 0;
              }
              
              setStats(aggregatedStats);
            } else {
              // Fallback to mock data if no valid stats
              setStats(mockTaskStats);
            }
          } else {
            // No active agents, use mock data
            setStats(mockTaskStats);
          }
        }
        
        // For now, use mock tasks data
        setRecentTasks(mockRecentTasks);
      } catch (error) {
        console.error('Failed to fetch agent metrics:', error);
        // Set fallback data
        setStats(mockTaskStats);
        setAgents(mockAgents);
        setRecentTasks(mockRecentTasks);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAgentMetrics();
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
          subtitle={selectedAgent ? `Free: ${formatBytes(selectedAgent.instance.server.free_space_on_disk)}` : "Used disk space (all agents)"}
          icon={HardDrive}
          color="text-blue-500"
        />
        <MetricCard
          title="Download Speed"
          value={formatSpeed(stats.current_download_speed)}
          subtitle="Current rate"
          icon={Download}
          color="text-green-500"
        />
        <MetricCard
          title="Upload Speed"
          value={formatSpeed(stats.current_upload_speed)}
          subtitle="Current rate"
          icon={Upload}
          color="text-purple-500"
        />
        <MetricCard
          title="Active Tasks"
          value={stats.active_tasks_count.toString()}
          subtitle={`${stats.active_seeds} seeding, ${stats.active_peers} peers`}
          icon={Activity}
          color="text-purple-500"
        />
        <MetricCard
          title="Ratio"
          value={selectedAgent ? selectedAgent.instance.transfer.global_ratio.toFixed(2) : stats.average_ratio.toFixed(2)}
          subtitle={selectedAgent ? `${stats.highest_ratio.toFixed(2)} highest / ${stats.lowest_ratio.toFixed(2)} lowest` : `${stats.highest_ratio.toFixed(2)} highest / ${stats.lowest_ratio.toFixed(2)} lowest (all agents)`}
          icon={TrendingUp}
          color="text-lime-500"
        />
        <ConnectedSeedersCard />
        <ConnectedPeersCard />
      </div>


      {/* Word Cloud Section */}
      <WordCloud
        tasks={recentTasks}
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
        <MostUploadedTorrents />
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
