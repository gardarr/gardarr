import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, AreaChart, Area, BarChart, Bar } from 'recharts';
import { 
  HardDrive, 
  Download, 
  Upload, 
  Activity, 
  Monitor,
  Users,
  Database,
  Clock,
  ChevronDown
} from 'lucide-react';
import type { Task } from '../../types/torrent';

// Mock data for task metrics
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
  },
  {
    id: '3',
    name: 'Ubuntu 22.04 LTS',
    hash: 'ghi789jkl012',
    state: 'seeding',
    category: 'software',
    path: '/downloads/software',
    priority: 3,
    ratio: 1.87,
    size: 4.7 * 1024 * 1024 * 1024,
    progress: 100.0,
    magnet_uri: 'magnet:?xt=urn:btih:ghi789jkl012',
    magnet_link: {
      hash: 'ghi789jkl012',
      display_name: 'Ubuntu 22.04 LTS',
      trackers: ['http://tracker.example.com'],
      exact_length: '5046586572',
      exact_source: 'example.com'
    },
    popularity: 76,
    pairs: {
      swarm_seeders: 156,
      swarm_leechers: 8,
      seeders: 150,
      leechers: 5
    },
    network: {
      download: { speed: 0, amount: 4.7 * 1024 * 1024 * 1024 },
      upload: { speed: 12.3 * 1024 * 1024, amount: 8.8 * 1024 * 1024 * 1024 }
    },
    tags: ['linux', 'os', 'lts']
  }
];

// Mock individual task metrics
const mockTaskMetrics = {
  '1': {
    downloadSpeed: 15.2 * 1024 * 1024,
    uploadSpeed: 2.1 * 1024 * 1024,
    totalDownloaded: 16.4 * 1024 * 1024 * 1024,
    totalUploaded: 1.2 * 1024 * 1024 * 1024,
    peers: 21,
    seeders: 42,
    eta: '2h 15m',
    availability: 0.95,
    health: 'excellent'
  },
  '2': {
    downloadSpeed: 0,
    uploadSpeed: 8.5 * 1024 * 1024,
    totalDownloaded: 18 * 1024 * 1024 * 1024,
    totalUploaded: 42.1 * 1024 * 1024 * 1024,
    peers: 10,
    seeders: 75,
    eta: 'Completed',
    availability: 0.88,
    health: 'good'
  },
  '3': {
    downloadSpeed: 0,
    uploadSpeed: 12.3 * 1024 * 1024,
    totalDownloaded: 4.7 * 1024 * 1024 * 1024,
    totalUploaded: 8.8 * 1024 * 1024 * 1024,
    peers: 5,
    seeders: 150,
    eta: 'Completed',
    availability: 0.76,
    health: 'excellent'
  }
};

// Mock time-series data for charts
const mockSpeedData = [
  { time: '00:00', download: 0, upload: 0 },
  { time: '01:00', download: 12.5, upload: 2.1 },
  { time: '02:00', download: 18.3, upload: 3.4 },
  { time: '03:00', download: 15.7, upload: 2.8 },
  { time: '04:00', download: 22.1, upload: 4.2 },
  { time: '05:00', download: 25.8, upload: 5.1 },
  { time: '06:00', download: 19.4, upload: 3.7 },
  { time: '07:00', download: 16.2, upload: 2.9 },
  { time: '08:00', download: 14.8, upload: 2.5 },
  { time: '09:00', download: 21.3, upload: 4.0 },
  { time: '10:00', download: 28.7, upload: 5.8 },
  { time: '11:00', download: 32.1, upload: 6.4 },
  { time: '12:00', download: 29.5, upload: 5.9 },
  { time: '13:00', download: 26.8, upload: 5.3 },
  { time: '14:00', download: 24.2, upload: 4.8 },
  { time: '15:00', download: 27.9, upload: 5.6 },
  { time: '16:00', download: 31.4, upload: 6.2 },
  { time: '17:00', download: 33.7, upload: 6.7 },
  { time: '18:00', download: 30.2, upload: 6.0 },
  { time: '19:00', download: 26.5, upload: 5.3 },
  { time: '20:00', download: 23.8, upload: 4.7 },
  { time: '21:00', download: 20.1, upload: 4.0 },
  { time: '22:00', download: 17.6, upload: 3.5 },
  { time: '23:00', download: 13.9, upload: 2.8 }
];

const mockPeersData = [
  { time: '00:00', seeders: 45, peers: 23 },
  { time: '01:00', seeders: 48, peers: 26 },
  { time: '02:00', seeders: 52, peers: 29 },
  { time: '03:00', seeders: 49, peers: 25 },
  { time: '04:00', seeders: 55, peers: 32 },
  { time: '05:00', seeders: 58, peers: 35 },
  { time: '06:00', seeders: 54, peers: 31 },
  { time: '07:00', seeders: 51, peers: 28 },
  { time: '08:00', seeders: 47, peers: 24 },
  { time: '09:00', seeders: 53, peers: 30 },
  { time: '10:00', seeders: 61, peers: 38 },
  { time: '11:00', seeders: 65, peers: 42 },
  { time: '12:00', seeders: 62, peers: 39 },
  { time: '13:00', seeders: 59, peers: 36 },
  { time: '14:00', seeders: 56, peers: 33 },
  { time: '15:00', seeders: 60, peers: 37 },
  { time: '16:00', seeders: 64, peers: 41 },
  { time: '17:00', seeders: 67, peers: 44 },
  { time: '18:00', seeders: 63, peers: 40 },
  { time: '19:00', seeders: 58, peers: 35 },
  { time: '20:00', seeders: 55, peers: 32 },
  { time: '21:00', seeders: 52, peers: 29 },
  { time: '22:00', seeders: 48, peers: 26 },
  { time: '23:00', seeders: 46, peers: 24 }
];

const mockSwarmData = [
  { time: '00:00', swarm_seeders: 120, swarm_leechers: 45 },
  { time: '01:00', swarm_seeders: 125, swarm_leechers: 48 },
  { time: '02:00', swarm_seeders: 130, swarm_leechers: 52 },
  { time: '03:00', swarm_seeders: 128, swarm_leechers: 49 },
  { time: '04:00', swarm_seeders: 135, swarm_leechers: 55 },
  { time: '05:00', swarm_seeders: 140, swarm_leechers: 58 },
  { time: '06:00', swarm_seeders: 138, swarm_leechers: 54 },
  { time: '07:00', swarm_seeders: 132, swarm_leechers: 51 },
  { time: '08:00', swarm_seeders: 128, swarm_leechers: 47 },
  { time: '09:00', swarm_seeders: 135, swarm_leechers: 53 },
  { time: '10:00', swarm_seeders: 145, swarm_leechers: 61 },
  { time: '11:00', swarm_seeders: 150, swarm_leechers: 65 },
  { time: '12:00', swarm_seeders: 148, swarm_leechers: 62 },
  { time: '13:00', swarm_seeders: 142, swarm_leechers: 59 },
  { time: '14:00', swarm_seeders: 138, swarm_leechers: 56 },
  { time: '15:00', swarm_seeders: 144, swarm_leechers: 60 },
  { time: '16:00', swarm_seeders: 148, swarm_leechers: 64 },
  { time: '17:00', swarm_seeders: 152, swarm_leechers: 67 },
  { time: '18:00', swarm_seeders: 149, swarm_leechers: 63 },
  { time: '19:00', swarm_seeders: 142, swarm_leechers: 58 },
  { time: '20:00', swarm_seeders: 138, swarm_leechers: 55 },
  { time: '21:00', swarm_seeders: 135, swarm_leechers: 52 },
  { time: '22:00', swarm_seeders: 130, swarm_leechers: 48 },
  { time: '23:00', swarm_seeders: 125, swarm_leechers: 46 }
];

// Mock file data for the selected task
const mockFileData = [
  { name: 'movie.mkv', size: 8.5 * 1024 * 1024 * 1024, sizeGB: 8.5 },
  { name: 'subtitle_en.srt', size: 45 * 1024, sizeGB: 0.000043 },
  { name: 'subtitle_pt.srt', size: 52 * 1024, sizeGB: 0.00005 },
  { name: 'poster.jpg', size: 2.3 * 1024 * 1024, sizeGB: 0.0023 },
  { name: 'backdrop.jpg', size: 4.1 * 1024 * 1024, sizeGB: 0.0041 },
  { name: 'trailer.mp4', size: 156 * 1024 * 1024, sizeGB: 0.156 },
  { name: 'info.nfo', size: 1.2 * 1024, sizeGB: 0.0000012 },
  { name: 'sample.mkv', size: 89 * 1024 * 1024, sizeGB: 0.089 }
];

// Chart configuration
const speedChartConfig = {
  download: {
    label: "Download Speed",
    theme: {
      light: "hsl(142.1 76.2% 36.3%)", // green-700
      dark: "hsl(142.1 70.6% 45.3%)",  // green-600
    },
  },
  upload: {
    label: "Upload Speed", 
    theme: {
      light: "hsl(262.1 83.3% 57.8%)", // purple-600
      dark: "hsl(263.4 70% 50.4%)",    // purple-700
    },
  },
};

const peersChartConfig = {
  seeders: {
    label: "Seeders",
    theme: {
      light: "hsl(262.1 83.3% 57.8%)", // purple-600
      dark: "hsl(263.4 70% 50.4%)",    // purple-700
    },
  },
  peers: {
    label: "Peers",
    theme: {
      light: "hsl(24.6 95% 53.1%)",    // orange-500
      dark: "hsl(20.5 90.2% 48.2%)",   // orange-600
    },
  },
};

const swarmChartConfig = {
  swarm_seeders: {
    label: "Swarm Seeders",
    theme: {
      light: "hsl(142.1 76.2% 36.3%)", // green-700
      dark: "hsl(142.1 70.6% 45.3%)",  // green-600
    },
  },
  swarm_leechers: {
    label: "Swarm Leechers",
    theme: {
      light: "hsl(0 84.2% 60.2%)",     // red-500
      dark: "hsl(0 72.2% 50.6%)",      // red-600
    },
  },
};

// Speed Chart Component
interface SpeedChartProps {
  data: unknown[];
  title: string;
}

const SpeedChart: React.FC<SpeedChartProps> = ({ data, title }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={speedChartConfig} className="h-[300px] w-full">
          <LineChart data={data} width={undefined} height={300}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="time" 
              tick={{ fontSize: 12 }}
              tickLine={{ stroke: 'hsl(var(--muted-foreground))' }}
            />
            <YAxis 
              tick={{ fontSize: 12 }}
              tickLine={{ stroke: 'hsl(var(--muted-foreground))' }}
              label={{ value: 'MB/s', angle: -90, position: 'insideLeft' }}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line 
              type="monotone" 
              dataKey="download" 
              stroke="var(--color-download)" 
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 6, stroke: 'var(--color-download)', strokeWidth: 2 }}
            />
            <Line 
              type="monotone" 
              dataKey="upload" 
              stroke="var(--color-upload)" 
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 6, stroke: 'var(--color-upload)', strokeWidth: 2 }}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};

// Peers Chart Component
interface PeersChartProps {
  data: unknown[];
  title: string;
}

const PeersChart: React.FC<PeersChartProps> = ({ data, title }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={peersChartConfig} className="h-[300px] w-full">
          <AreaChart data={data} width={undefined} height={300}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="time" 
              tick={{ fontSize: 12 }}
              tickLine={{ stroke: 'hsl(var(--muted-foreground))' }}
            />
            <YAxis 
              tick={{ fontSize: 12 }}
              tickLine={{ stroke: 'hsl(var(--muted-foreground))' }}
              label={{ value: 'Count', angle: -90, position: 'insideLeft' }}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Area 
              type="monotone" 
              dataKey="seeders" 
              stackId="1"
              stroke="var(--color-seeders)" 
              fill="var(--color-seeders)"
              fillOpacity={0.6}
            />
            <Area 
              type="monotone" 
              dataKey="peers" 
              stackId="1"
              stroke="var(--color-peers)" 
              fill="var(--color-peers)"
              fillOpacity={0.6}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};

// Swarm Chart Component
interface SwarmChartProps {
  data: unknown[];
  title: string;
}

const SwarmChart: React.FC<SwarmChartProps> = ({ data, title }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={swarmChartConfig} className="h-[300px] w-full">
          <LineChart data={data} width={undefined} height={300}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="time" 
              tick={{ fontSize: 12 }}
              tickLine={{ stroke: 'hsl(var(--muted-foreground))' }}
            />
            <YAxis 
              tick={{ fontSize: 12 }}
              tickLine={{ stroke: 'hsl(var(--muted-foreground))' }}
              label={{ value: 'Count', angle: -90, position: 'insideLeft' }}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line 
              type="monotone" 
              dataKey="swarm_seeders" 
              stroke="var(--color-swarm_seeders)" 
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 6, stroke: 'var(--color-swarm_seeders)', strokeWidth: 2 }}
            />
            <Line 
              type="monotone" 
              dataKey="swarm_leechers" 
              stroke="var(--color-swarm_leechers)" 
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 6, stroke: 'var(--color-swarm_leechers)', strokeWidth: 2 }}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};

// File Size Chart Component using the existing horizontal bar chart
interface FileSizeChartProps {
  data: unknown[];
  title: string;
}

const FileSizeChart: React.FC<FileSizeChartProps> = ({ data, title }) => {
  // Transform data to match the expected format for ChartBarHorizontal and sort by size (largest to smallest)
  const chartData = data
    .map(file => ({
      name: file.name,
      size: file.sizeGB
    }))
    .sort((a, b) => b.size - a.size);

  const chartConfig = {
    size: {
      label: "File Size (GB)",
      color: "var(--chart-1)",
    },
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HardDrive className="h-5 w-5" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[400px] w-full">
          <BarChart
            accessibilityLayer
            data={chartData}
            layout="vertical"
            margin={{
              left: -20,
            }}
          >
            <XAxis type="number" dataKey="size" hide />
            <YAxis
              dataKey="name"
              type="category"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              width={120}
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel />}
              formatter={(value: number) => [`${value.toFixed(3)} GB`, 'File Size']}
            />
            <Bar dataKey="size" fill="var(--color-size)" radius={5} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};

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

const getStateVariant = (state: string): "default" | "secondary" | "destructive" | "outline" => {
  switch (state) {
    case 'downloading': return 'default';
    case 'seeding': return 'default';
    case 'paused': return 'secondary';
    case 'error': return 'destructive';
    default: return 'outline';
  }
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

// Custom Task Selector Component
interface TaskSelectorProps {
  tasks: Task[];
  selectedTaskId: string;
  onTaskChange: (taskId: string) => void;
}

const TaskSelector: React.FC<TaskSelectorProps> = ({ tasks, selectedTaskId, onTaskChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectedTask = tasks.find(task => task.id === selectedTaskId);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 text-sm border border-input bg-background rounded-md hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      >
        <div className="flex items-center gap-2">
          <span className="truncate">{selectedTask?.name || 'Select a task'}</span>
          {selectedTask && (
            <Badge variant="outline" className="text-xs">
              {selectedTask.category}
            </Badge>
          )}
        </div>
        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-md shadow-lg z-50 max-h-60 overflow-y-auto">
          {tasks.map((task) => (
            <button
              key={task.id}
              onClick={() => {
                onTaskChange(task.id);
                setIsOpen(false);
              }}
              className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground text-left"
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="truncate">{task.name}</span>
                <Badge variant="outline" className="text-xs flex-shrink-0">
                  {task.category}
                </Badge>
              </div>
              <Badge variant={getStateVariant(task.state)} className="text-xs flex-shrink-0">
                {task.state}
              </Badge>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

interface TaskMetricsProps {
  fromDate?: Date;
  toDate?: Date;
  selectedTaskId?: string;
  selectedAgentId?: string;
  onTaskChange?: (taskId: string) => void;
}

const TaskMetrics: React.FC<TaskMetricsProps> = ({ 
  fromDate, 
  toDate, 
  selectedTaskId = '1', 
  onTaskChange 
}) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // API calls for task metrics
  useEffect(() => {
    const fetchTaskMetrics = async () => {
      setIsLoading(true);
      try {
        // TODO: Replace with actual API calls
        // const tasksResponse = await taskService.getTasks(fromDate, toDate);
        // const metricsResponse = await taskService.getTaskMetrics(selectedTaskId, fromDate, toDate);
        
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        setTasks(mockRecentTasks);
      } catch (error) {
        console.error('Failed to fetch task metrics:', error);
        // Set fallback data
        setTasks(mockRecentTasks);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTaskMetrics();
  }, [fromDate, toDate, selectedTaskId]);

  const handleTaskChange = (taskId: string) => {
    if (onTaskChange) {
      onTaskChange(taskId);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Task Selection Skeleton */}
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-64" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>

        {/* Metrics Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
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
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-48" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-[300px] w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const selectedTask = tasks.find(task => task.id === selectedTaskId);
  const selectedTaskMetrics = mockTaskMetrics[selectedTaskId as keyof typeof mockTaskMetrics];

  return (
    <div className="space-y-6">
      {/* Task Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Monitor className="h-5 w-5" />
            Select Task for Detailed Metrics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <TaskSelector
                tasks={tasks}
                selectedTaskId={selectedTaskId}
                onTaskChange={handleTaskChange}
              />
            </div>
            {selectedTask && (
              <div className="text-sm text-muted-foreground">
                <Badge variant={getStateVariant(selectedTask.state)}>
                  {selectedTask.state}
                </Badge>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Selected Task Overview */}
      {selectedTask && selectedTaskMetrics && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                {selectedTask.name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Size</p>
                  <p className="text-lg font-semibold">{formatBytes(selectedTask.size)}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Progress</p>
                  <div className="flex items-center space-x-2">
                    <ProgressBar 
                      progress={selectedTask.progress} 
                      showLabel={false}
                      height="sm"
                      className="flex-1"
                    />
                    <span className="text-sm font-semibold">{selectedTask.progress.toFixed(1)}%</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Ratio</p>
                  <p className="text-lg font-semibold">{selectedTask.ratio.toFixed(2)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Task Performance Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <MetricCard
              title="Download Speed"
              value={formatSpeed(selectedTaskMetrics.downloadSpeed)}
              subtitle="Current rate"
              icon={Download}
              color="text-green-500"
            />
            <MetricCard
              title="Upload Speed"
              value={formatSpeed(selectedTaskMetrics.uploadSpeed)}
              subtitle="Current rate"
              icon={Upload}
              color="text-orange-500"
            />
            <MetricCard
              title="Connected Peers"
              value={selectedTaskMetrics.peers.toString()}
              subtitle={`${selectedTaskMetrics.seeders} seeders`}
              icon={Users}
              color="text-blue-500"
            />
            <MetricCard
              title="ETA"
              value={selectedTaskMetrics.eta}
              subtitle="Estimated time"
              icon={Clock}
              color="text-purple-500"
            />
          </div>

          {/* Speed and Peers Charts */}
          <div className="space-y-6">
            <SpeedChart
              data={mockSpeedData}
              title="Download & Upload Speed (24h)"
            />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <PeersChart
                data={mockPeersData}
                title="Connected Seeders & Peers (24h)"
              />
              <SwarmChart
                data={mockSwarmData}
                title="Swarm Seeders & Leechers (24h)"
              />
            </div>
            <FileSizeChart
              data={mockFileData}
              title="File Sizes in Torrent"
            />
          </div>

          {/* Task Data Transfer */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="h-5 w-5" />
                  Download Statistics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Total Downloaded</span>
                    <span className="font-semibold">{formatBytes(selectedTaskMetrics.totalDownloaded)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Current Speed</span>
                    <span className="font-semibold">{formatSpeed(selectedTaskMetrics.downloadSpeed)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Availability</span>
                    <span className="font-semibold">{(selectedTaskMetrics.availability * 100).toFixed(1)}%</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Upload Statistics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Total Uploaded</span>
                    <span className="font-semibold">{formatBytes(selectedTaskMetrics.totalUploaded)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Current Speed</span>
                    <span className="font-semibold">{formatSpeed(selectedTaskMetrics.uploadSpeed)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Health</span>
                    <Badge variant={selectedTaskMetrics.health === 'excellent' ? 'default' : 'secondary'}>
                      {selectedTaskMetrics.health}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
};

export default TaskMetrics;
