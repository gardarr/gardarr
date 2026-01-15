import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BookOpen, Code, Database, FileJson, Info, List } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface WebhookDocumentationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function WebhookDocumentationModal({ isOpen, onClose }: WebhookDocumentationModalProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('structure');

  const eventTypes = [
    {
      type: 'torrent.state_change',
      description: 'Fired when a torrent changes state',
      fields: ['old_value', 'new_value', 'task_hash'],
      metadata: ['name', 'old_progress', 'new_progress'],
    },
    {
      type: 'torrent.added',
      description: 'Fired when a new torrent is detected',
      fields: ['new_value', 'task_hash'],
      metadata: ['name', 'progress', 'category', 'size', 'state', 'tags'],
    },
    {
      type: 'torrent.removed',
      description: 'Fired when a torrent is no longer found',
      fields: ['old_value', 'task_hash'],
      metadata: ['last_progress'],
    },
    {
      type: 'torrent.completed',
      description: 'Fired when a torrent reaches 100% progress',
      fields: ['new_value', 'task_hash'],
      metadata: ['name', 'ratio', 'size', 'category'],
    },
  ];

  const torrentStates = [
    { state: 'DOWNLOADING', description: 'Actively downloading content', color: 'text-blue-500' },
    { state: 'UPLOADING', description: 'Actively seeding/uploading content', color: 'text-green-500' },
    { state: 'STALLED_DOWNLOAD', description: 'Download stalled (no peers)', color: 'text-orange-500' },
    { state: 'STALLED_UPLOAD', description: 'Upload stalled (no leechers)', color: 'text-yellow-500' },
    { state: 'CHECKING', description: 'Checking file integrity', color: 'text-purple-500' },
    { state: 'PAUSED_DOWNLOAD', description: 'Download paused', color: 'text-gray-500' },
    { state: 'PAUSED_UPLOAD', description: 'Upload paused', color: 'text-gray-500' },
    { state: 'QUEUED_DOWNLOAD', description: 'Queued for download', color: 'text-cyan-500' },
    { state: 'QUEUED_UPLOAD', description: 'Queued for upload', color: 'text-cyan-500' },
    { state: 'ERROR', description: 'Torrent in error state', color: 'text-red-500' },
    { state: 'MISSING_FILES', description: 'Files are missing', color: 'text-red-500' },
    { state: 'ALLOCATING', description: 'Allocating disk space', color: 'text-indigo-500' },
  ];

  const metadataFields = [
    { field: 'name', type: 'string', description: 'Torrent name' },
    { field: 'category', type: 'string', description: 'Torrent category' },
    { field: 'state', type: 'string', description: 'Current torrent state' },
    { field: 'progress', type: 'number', description: 'Download progress (0-100)' },
    { field: 'old_progress', type: 'number', description: 'Previous progress value' },
    { field: 'new_progress', type: 'number', description: 'New progress value' },
    { field: 'last_progress', type: 'number', description: 'Last known progress' },
    { field: 'ratio', type: 'number', description: 'Upload/Download ratio' },
    { field: 'size', type: 'number', description: 'Total size in bytes' },
    { field: 'tags', type: 'string[]', description: 'Array of tags' },
    { field: 'directory', type: 'string', description: 'Download directory path' },
    { field: 'hash', type: 'string', description: 'Torrent info hash' },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <BookOpen className="h-6 w-6 text-primary" />
            {t('webhooks.documentation.title', 'Webhook Documentation')}
          </DialogTitle>
          <DialogDescription>
            {t('webhooks.documentation.description', 'Learn about webhook payloads, event types, and field values')}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="structure" className="text-xs sm:text-sm">
              <Database className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Structure</span>
            </TabsTrigger>
            <TabsTrigger value="events" className="text-xs sm:text-sm">
              <List className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Events</span>
            </TabsTrigger>
            <TabsTrigger value="states" className="text-xs sm:text-sm">
              <Info className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">States</span>
            </TabsTrigger>
            <TabsTrigger value="metadata" className="text-xs sm:text-sm">
              <Code className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Metadata</span>
            </TabsTrigger>
            <TabsTrigger value="examples" className="text-xs sm:text-sm">
              <FileJson className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Examples</span>
            </TabsTrigger>
          </TabsList>

          {/* Event Structure Tab */}
          <TabsContent value="structure" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Event Payload Structure</CardTitle>
                <CardDescription>
                  All webhook events follow this standard structure
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-muted p-4 rounded-lg font-mono text-sm overflow-x-auto">
                  <pre>{`{
  "event_id": "uuid",       // Unique event identifier
  "event_type": "string",   // Type of event (see Events tab)
  "agent_id": "uuid",       // Agent that detected the change
  "task_hash": "string",    // Torrent hash identifier
  "old_value": "string",    // Previous value (for changes)
  "new_value": "string",    // New value
  "metadata": {             // Additional context data
    // Dynamic fields based on event type
  },
  "timestamp": "ISO8601"    // Event timestamp
}`}</pre>
                </div>

                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                    <Info className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-sm text-blue-900 dark:text-blue-100">HTTP Method & Headers</p>
                      <p className="text-sm text-blue-800 dark:text-blue-200 mt-1">
                        All webhooks use <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">POST</code> method with{' '}
                        <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">Content-Type: application/json</code>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg">
                    <Info className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-sm text-amber-900 dark:text-amber-100">Optional Fields</p>
                      <p className="text-sm text-amber-800 dark:text-amber-200 mt-1">
                        <code className="bg-amber-100 dark:bg-amber-900 px-1 rounded">old_value</code> is only present in change/removal events.{' '}
                        <code className="bg-amber-100 dark:bg-amber-900 px-1 rounded">metadata</code> content varies by event type.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Event Types Tab */}
          <TabsContent value="events" className="space-y-4 mt-4">
            <div className="grid gap-4">
              {eventTypes.map((event) => (
                <Card key={event.type}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Badge variant="secondary" className="font-mono text-xs">
                        {event.type}
                      </Badge>
                    </CardTitle>
                    <CardDescription>{event.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <p className="text-sm font-semibold mb-2">Required Fields:</p>
                      <div className="flex flex-wrap gap-2">
                        {event.fields.map((field) => (
                          <Badge key={field} variant="outline" className="font-mono text-xs">
                            {field}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-semibold mb-2">Metadata Fields:</p>
                      <div className="flex flex-wrap gap-2">
                        {event.metadata.map((field) => (
                          <Badge key={field} className="bg-primary/10 text-primary hover:bg-primary/20 font-mono text-xs">
                            {field}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Torrent States Tab */}
          <TabsContent value="states" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Torrent States</CardTitle>
                <CardDescription>
                  Possible values for <code className="bg-muted px-1 rounded">old_value</code>,{' '}
                  <code className="bg-muted px-1 rounded">new_value</code>, and{' '}
                  <code className="bg-muted px-1 rounded">metadata.state</code>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3">
                  {torrentStates.map((state) => (
                    <div
                      key={state.state}
                      className="flex items-start gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <Badge variant="outline" className={`${state.color} font-mono text-xs flex-shrink-0`}>
                        {state.state}
                      </Badge>
                      <p className="text-sm text-muted-foreground">{state.description}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Metadata Fields Tab */}
          <TabsContent value="metadata" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Metadata Fields Reference</CardTitle>
                <CardDescription>
                  Available fields in the <code className="bg-muted px-1 rounded">metadata</code> object
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {metadataFields.map((field) => (
                    <div
                      key={field.field}
                      className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Badge variant="outline" className="font-mono text-xs">
                          {field.field}
                        </Badge>
                        <Badge className="bg-primary/10 text-primary text-xs">
                          {field.type}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{field.description}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-6 p-4 bg-muted rounded-lg">
                  <p className="text-sm font-semibold mb-2">Type Reference:</p>
                  <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                    <li><code className="bg-background px-1 rounded">string</code> - Text value</li>
                    <li><code className="bg-background px-1 rounded">number</code> - Numeric value (integer or float)</li>
                    <li><code className="bg-background px-1 rounded">string[]</code> - Array of text values</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Examples Tab */}
          <TabsContent value="examples" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">torrent.state_change</CardTitle>
                <CardDescription>When a torrent transitions between states</CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs font-mono">
{`{
  "event_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "event_type": "torrent.state_change",
  "agent_id": "7f8e9d10-c11b-12a3-4567-890abcdef123",
  "task_hash": "abc123def456",
  "old_value": "DOWNLOADING",
  "new_value": "UPLOADING",
  "metadata": {
    "name": "Ubuntu 25.10 Desktop",
    "old_progress": 0.95,
    "new_progress": 1.0,
    "category": "iso",
    "ratio": 0.3
  },
  "timestamp": "2026-01-15T14:30:00Z"
}`}
                </pre>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">torrent.added</CardTitle>
                <CardDescription>When a new torrent is detected</CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs font-mono">
{`{
  "event_id": "b2c3d4e5-f678-9012-3456-789abcdef012",
  "event_type": "torrent.added",
  "agent_id": "7f8e9d10-c11b-12a3-4567-890abcdef123",
  "task_hash": "def789ghi012",
  "new_value": "DOWNLOADING",
  "metadata": {
    "name": "Linux Mint 24.2 Cinnamon",
    "progress": 0,
    "state": "DOWNLOADING",
    "category": "iso",
    "size": 2684354560,
    "tags": ["linux", "mint", "iso"],
    "directory": "/data/downloads/iso"
  },
  "timestamp": "2026-01-15T14:25:00Z"
}`}
                </pre>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">torrent.completed</CardTitle>
                <CardDescription>When a torrent reaches 100% completion</CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs font-mono">
{`{
  "event_id": "c3d4e5f6-7890-1234-5678-90abcdef1234",
  "event_type": "torrent.completed",
  "agent_id": "7f8e9d10-c11b-12a3-4567-890abcdef123",
  "task_hash": "ghi345jkl678",
  "new_value": "UPLOADING",
  "metadata": {
    "name": "Debian 13 Server",
    "ratio": 0.1,
    "size": 3758096384,
    "category": "iso"
  },
  "timestamp": "2026-01-15T15:00:00Z"
}`}
                </pre>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">torrent.removed</CardTitle>
                <CardDescription>When a torrent is no longer found</CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs font-mono">
{`{
  "event_id": "d4e5f678-9012-3456-7890-abcdef123456",
  "event_type": "torrent.removed",
  "agent_id": "7f8e9d10-c11b-12a3-4567-890abcdef123",
  "task_hash": "jkl901mno234",
  "old_value": "UPLOADING",
  "metadata": {
    "last_progress": 1.0
  },
  "timestamp": "2026-01-15T16:00:00Z"
}`}
                </pre>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
