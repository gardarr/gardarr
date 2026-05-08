import { useTranslation } from 'react-i18next';
import { AlertTriangle, RefreshCw, ShieldAlert, Lock, Wifi, Server, Globe, AlertCircle, CloudOff } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { Worker, WorkerErrorCode } from '@/types/worker';

interface WorkerErrorDisplayProps {
  worker: Worker;
  className?: string;
}

// Icon mapping for error codes
const ERROR_ICONS: Record<WorkerErrorCode, React.ComponentType<{ className?: string }>> = {
  AUTH_FAILURE: Lock,
  TIMEOUT: RefreshCw,
  DNS_ERROR: Globe,
  HTTPS_REQUIRED: ShieldAlert,
  SSL_ERROR: ShieldAlert,
  VERSION_INCOMPATIBLE: AlertTriangle,
  CONNECTION_REFUSED: Server,
  NETWORK_UNREACHABLE: Wifi,
  WORKER_UNREACHABLE: Server,
  BAD_GATEWAY: CloudOff,
  SERVICE_UNAVAILABLE: CloudOff,
  UNKNOWN: AlertCircle,
};

// Permanent error codes that require user intervention
const PERMANENT_ERROR_CODES = new Set<WorkerErrorCode>([
  'AUTH_FAILURE',
  'DNS_ERROR',
  'HTTPS_REQUIRED',
  'SSL_ERROR',
  'VERSION_INCOMPATIBLE',
]);

function isPermanentError(code: WorkerErrorCode): boolean {
  return PERMANENT_ERROR_CODES.has(code);
}

export function WorkerErrorDisplay({ worker, className = '' }: Readonly<WorkerErrorDisplayProps>) {
  const { t } = useTranslation();

  // Only show if there's an error or if initializing
  if (worker.status !== 'ERRORED' && worker.status !== 'INITIALIZING') {
    return null;
  }

  // If in error status, we must have an error code to display details
  if (worker.status === 'ERRORED' && !worker.error_code) {
    return null;
  }

  const errorCode = worker.error_code;
  const isPermanent = worker.permanent ?? (errorCode ? isPermanentError(errorCode) : false);
  const IconComponent = (errorCode ? ERROR_ICONS[errorCode] : null) || (worker.status === 'INITIALIZING' ? Server : AlertCircle);

  return (
    <Alert
      variant={isPermanent ? 'destructive' : 'default'}
      className={`${className} ${isPermanent ? '' : 'border-yellow-500/50 bg-yellow-50 dark:bg-yellow-950/20'}`}
    >
      <IconComponent className={`h-4 w-4 ${isPermanent ? '' : 'text-yellow-600 dark:text-yellow-400'}`} />
      <AlertTitle className={isPermanent ? '' : 'text-yellow-900 dark:text-yellow-100'}>
        {worker.status === 'INITIALIZING' ? t('workers.initializing', 'Starting up...') : t(`workers.errorCodes.${errorCode}.title`)}
      </AlertTitle>
      <AlertDescription className={`space-y-2 ${isPermanent ? '' : 'text-yellow-800 dark:text-yellow-200'}`}>
        <p>{worker.status === 'INITIALIZING' ? t('workers.initializingDescription', 'Waiting for worker to finish starting up...') : t(`workers.errorCodes.${errorCode}.description`)}</p>

        {/* Show detailed error message */}
        {worker.error && (
          <div className="mt-2 text-xs font-mono bg-black/10 dark:bg-white/10 p-2 rounded break-all">
            {worker.error}
          </div>
        )}
      </AlertDescription>
    </Alert>
  );
}

// Compact version for card display
export function WorkerErrorBadge({ worker }: Readonly<{ worker: Worker }>) {
  const { t } = useTranslation();

  if (worker.status !== 'ERRORED' && worker.status !== 'INITIALIZING') {
    return null;
  }

  if (worker.status === 'ERRORED' && !worker.error_code) {
    return null;
  }

  const errorCode = worker.error_code;
  const isPermanent = worker.permanent ?? (errorCode ? isPermanentError(errorCode) : false);
  const IconComponent = (errorCode ? ERROR_ICONS[errorCode] : null) || (worker.status === 'INITIALIZING' ? Server : AlertCircle);

  return (
    <div className={`text-xs flex items-center gap-1 px-2 py-1 rounded ${isPermanent
      ? 'bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-300'
      : 'bg-yellow-100 dark:bg-yellow-950/30 text-yellow-700 dark:text-yellow-300'
      }`}>
      <IconComponent className="h-3 w-3" />
      <span>{worker.status === 'INITIALIZING' ? t('workers.initializing', 'Starting up...') : t(`workers.errorCodes.${errorCode}.title`)}</span>
    </div>
  );
}
