import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface HealthStatus {
  status: string;
  timestamp: string;
  uptime?: string;
}

export default function HealthCheck() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await api.get<HealthStatus>('/health');
        
        if (response.data) {
          setHealth(response.data);
        } else {
          setError(response.error || 'Erro desconhecido');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao verificar saúde da API');
      } finally {
        setLoading(false);
      }
    };

    checkHealth();
    
    // Verificar a cada 30 segundos
    const interval = setInterval(checkHealth, 30000);
    
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
        Verificando API...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-sm text-red-500">
        <div className="w-2 h-2 bg-red-500 rounded-full" />
        API Offline: {error}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-sm text-green-500">
      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
      API Online
      {health?.uptime && (
        <span className="text-muted-foreground">
          ({health.uptime})
        </span>
      )}
    </div>
  );
}
