import { useTranslation } from 'react-i18next';
import { AlertTriangle, RefreshCw, ShieldAlert, Lock, Wifi, Server, Globe, AlertCircle, CloudOff } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { Agent, AgentErrorCode } from '@/types/agent';

interface AgentErrorDisplayProps {
  agent: Agent;
  className?: string;
}

// Icon mapping for error codes
const ERROR_ICONS: Record<AgentErrorCode, React.ComponentType<{ className?: string }>> = {
  AUTH_FAILURE: Lock,
  TIMEOUT: RefreshCw,
  DNS_ERROR: Globe,
  HTTPS_REQUIRED: ShieldAlert,
  SSL_ERROR: ShieldAlert,
  VERSION_INCOMPATIBLE: AlertTriangle,
  CONNECTION_REFUSED: Server,
  NETWORK_UNREACHABLE: Wifi,
  AGENT_UNREACHABLE: Server,
  BAD_GATEWAY: CloudOff,
  SERVICE_UNAVAILABLE: CloudOff,
  UNKNOWN: AlertCircle,
};

// Permanent error codes that require user intervention
const PERMANENT_ERROR_CODES = new Set<AgentErrorCode>([
  'AUTH_FAILURE',
  'DNS_ERROR',
  'HTTPS_REQUIRED',
  'SSL_ERROR',
  'VERSION_INCOMPATIBLE',
]);

function isPermanentError(code: AgentErrorCode): boolean {
  return PERMANENT_ERROR_CODES.has(code);
}

export function AgentErrorDisplay({ agent, className = '' }: Readonly<AgentErrorDisplayProps>) {
  const { t } = useTranslation();

  // Only show if there's an error or if initializing
  if (agent.status !== 'ERRORED' && agent.status !== 'INITIALIZING') {
    return null;
  }

  // If in error status, we must have an error code to display details
  if (agent.status === 'ERRORED' && !agent.error_code) {
    return null;
  }

  const errorCode = agent.error_code;
  const isPermanent = agent.permanent ?? (errorCode ? isPermanentError(errorCode) : false);
  const IconComponent = (errorCode ? ERROR_ICONS[errorCode] : null) || (agent.status === 'INITIALIZING' ? Server : AlertCircle);

  return (
    <Alert
      variant={isPermanent ? 'destructive' : 'default'}
      className={`${className} ${isPermanent ? '' : 'border-yellow-500/50 bg-yellow-50 dark:bg-yellow-950/20'}`}
    >
      <IconComponent className={`h-4 w-4 ${isPermanent ? '' : 'text-yellow-600 dark:text-yellow-400'}`} />
      <AlertTitle className={isPermanent ? '' : 'text-yellow-900 dark:text-yellow-100'}>
        {agent.status === 'INITIALIZING' ? t('agents.initializing', 'Starting up...') : t(`agents.errorCodes.${errorCode}.title`)}
      </AlertTitle>
      <AlertDescription className={`space-y-2 ${isPermanent ? '' : 'text-yellow-800 dark:text-yellow-200'}`}>
        <p>{agent.status === 'INITIALIZING' ? t('agents.initializingDescription', 'Waiting for agent to finish starting up...') : t(`agents.errorCodes.${errorCode}.description`)}</p>

        {/* Show detailed error message */}
        {agent.error && (
          <div className="mt-2 text-xs font-mono bg-black/10 dark:bg-white/10 p-2 rounded break-all">
            {agent.error}
          </div>
        )}
      </AlertDescription>
    </Alert>
  );
}

// Compact version for card display
export function AgentErrorBadge({ agent }: Readonly<{ agent: Agent }>) {
  const { t } = useTranslation();

  if (agent.status !== 'ERRORED' && agent.status !== 'INITIALIZING') {
    return null;
  }

  if (agent.status === 'ERRORED' && !agent.error_code) {
    return null;
  }

  const errorCode = agent.error_code;
  const isPermanent = agent.permanent ?? (errorCode ? isPermanentError(errorCode) : false);
  const IconComponent = (errorCode ? ERROR_ICONS[errorCode] : null) || (agent.status === 'INITIALIZING' ? Server : AlertCircle);

  return (
    <div className={`text-xs flex items-center gap-1 px-2 py-1 rounded ${isPermanent
      ? 'bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-300'
      : 'bg-yellow-100 dark:bg-yellow-950/30 text-yellow-700 dark:text-yellow-300'
      }`}>
      <IconComponent className="h-3 w-3" />
      <span>{agent.status === 'INITIALIZING' ? t('agents.initializing', 'Starting up...') : t(`agents.errorCodes.${errorCode}.title`)}</span>
    </div>
  );
}
