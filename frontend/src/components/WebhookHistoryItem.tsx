import { Card, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { WebhookHistory } from '@/types/webhook';

interface WebhookHistoryItemProps {
  history: WebhookHistory;
  isSuccess: boolean;
}

export function WebhookHistoryItem({ history, isSuccess }: WebhookHistoryItemProps) {
  return (
    <Card className={isSuccess ? 'border-green-500/50' : 'border-red-500/50'}>
      <CardHeader className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant={isSuccess ? 'default' : 'destructive'}>
                {history.status_code || 'Error'}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {formatDistanceToNow(new Date(history.created_at), { addSuffix: true })}
              </span>
            </div>
            {history.task_name && (
              <p className="text-sm font-medium truncate">{history.task_name}</p>
            )}
            <p className="text-xs text-muted-foreground truncate">Hash: {history.task_hash}</p>
            <p className="text-xs text-muted-foreground">Status: {history.task_status}</p>
            {history.error && (
              <div className="flex items-start gap-2 mt-2 p-2 bg-destructive/10 rounded text-xs">
                <AlertCircle className="h-3 w-3 text-destructive mt-0.5 flex-shrink-0" />
                <span className="text-destructive break-all">{history.error}</span>
              </div>
            )}
            {history.response_body && (
              <details className="mt-2">
                <summary className="text-xs cursor-pointer text-muted-foreground hover:text-foreground">
                  Response Body
                </summary>
                <pre className="mt-1 p-2 bg-muted rounded text-xs overflow-x-auto">
                  {history.response_body}
                </pre>
              </details>
            )}
          </div>
        </div>
      </CardHeader>
    </Card>
  );
}
