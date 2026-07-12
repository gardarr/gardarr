import { useEffect, useRef, useState, useCallback } from 'react';
import type { Task } from '@/types/torrent';

export type WSEventType = 'INITIAL_STATE' | 'WORKER_STATS_UPDATED' | 'TORRENT_ADDED' | 'TORRENT_STATE_CHANGE' | 'TORRENT_COMPLETED' | 'TORRENT_REMOVED';

export interface WSEvent {
  event_type: WSEventType;
  worker_id?: string;
  payload: Record<string, unknown> | unknown;
  errors?: Record<string, string>;
}

interface UseTorrentsWSOptions {
  onInitialState?: (tasks: Task[], errors?: Record<string, string>) => void;
  onWorkerStats?: (workerId: string, stats: Record<string, unknown>) => void;
  onTaskUpdated?: (task: Partial<Task> & { hash: string, worker_id: string }) => void;
  onTaskRemoved?: (hash: string, workerId: string) => void;
}

export function useTorrentsWS(options: UseTorrentsWSOptions = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Event | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const optionsRef = useRef(options);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  
  // Keep options ref up to date to avoid dependency cycle in useEffect
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    // Use current host and protocol for WS URL
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    // Assuming backend is served on same host/port in production, or proxied in dev
    // For local dev, Vite proxies /v1 to backend. But websockets might need ws:// setup.
    // If Vite proxies /v1, it also proxies ws:// if configured.
    const wsUrl = `${protocol}//${host}/v1/ws/torrents`;

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setIsConnected(true);
      setError(null);
      reconnectAttemptsRef.current = 0;
      console.log('[WS] Connected to torrents stream');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as WSEvent;
        
        switch (data.event_type) {
          case 'INITIAL_STATE':
            if (optionsRef.current.onInitialState) {
              optionsRef.current.onInitialState(data.payload as Task[], data.errors);
            }
            break;

          case 'WORKER_STATS_UPDATED':
            if (optionsRef.current.onWorkerStats && data.worker_id) {
              optionsRef.current.onWorkerStats(data.worker_id, data.payload as Record<string, unknown>);
            }
            break;

          case 'TORRENT_ADDED':
          case 'TORRENT_STATE_CHANGE':
          case 'TORRENT_COMPLETED':
            if (optionsRef.current.onTaskUpdated && data.worker_id) {
              // Payload has { hash, old_value, new_value, metadata }
              const payload = data.payload as Record<string, unknown>;
              const meta = (payload.metadata || {}) as Record<string, unknown>;
              
              const updatedTask: Partial<Task> & { hash: string, worker_id: string } = {
                hash: payload.hash as string,
                worker_id: data.worker_id,
                state: payload.new_value as string,
                name: meta.name as string,
                category: meta.category as string,
                tags: meta.tags as string[],
                path: meta.directory as string,
                size: meta.size as number,
                progress: meta.progress as number,
                ratio: meta.ratio as number,
              };
              
              optionsRef.current.onTaskUpdated(updatedTask);
            }
            break;
            
          case 'TORRENT_REMOVED':
            if (optionsRef.current.onTaskRemoved && data.worker_id) {
              const payload = data.payload as Record<string, unknown>;
              optionsRef.current.onTaskRemoved(payload.hash as string, data.worker_id);
            }
            break;

          default:
            console.warn('[WS] Unknown event_type received', data.event_type);
            break;
        }
      } catch (err) {
        console.error('[WS] Failed to parse message', err);
      }
    };

    ws.onerror = (e) => {
      console.error('[WS] Error', e);
      setError(e);
    };

    ws.onclose = () => {
      setIsConnected(false);
      
      // Exponential backoff with jitter: min(1s * 2^attempts, 30s) + random(0-1s)
      const attempts = reconnectAttemptsRef.current;
      const baseDelay = Math.min(1000 * Math.pow(2, attempts), 30000);
      
      // Use crypto for safe random generation instead of Math.random
      const randomArray = new Uint32Array(1);
      window.crypto.getRandomValues(randomArray);
      const jitter = randomArray[0] % 1000;
      
      const nextDelay = baseDelay + jitter;
      
      reconnectAttemptsRef.current += 1;
      
      console.log(`[WS] Disconnected, attempting reconnect in ${Math.round(nextDelay/1000)}s...`);
      // Reconnect logic
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, nextDelay);
    };

    wsRef.current = ws;
  }, []);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        // Stop onclose from attempting to reconnect when unmounting
        wsRef.current.onclose = null;
        wsRef.current.onerror = null;
        wsRef.current.close();
      }
    };
  }, [connect]);
  
  // Expose global close method for logout
  const close = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  const requestSync = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: "request_sync" }));
    }
  }, []);

  return { isConnected, error, close, requestSync };
}
