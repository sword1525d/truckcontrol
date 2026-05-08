'use client';
import { useEffect, useRef, useCallback, useState } from 'react';
import * as signalR from '@microsoft/signalr';

interface UseSignalROptions {
  hubUrl: string;
  accessTokenFactory?: () => string | Promise<string>;
  onRunUpdate?: (run: unknown) => void;
  onGpsUpdate?: (data: { runId: string; locations: unknown[] }) => void;
  enabled?: boolean;
}

export function useSignalR({
  hubUrl,
  accessTokenFactory,
  onRunUpdate,
  onGpsUpdate,
  enabled = true,
}: UseSignalROptions) {
  const connectionRef = useRef<signalR.HubConnection | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl, {
        accessTokenFactory: accessTokenFactory,
      })
      .withAutomaticReconnect()
      .build();

    if (onRunUpdate) connection.on('RunUpdated', onRunUpdate);
    if (onGpsUpdate) connection.on('GpsBatchReceived', onGpsUpdate);

    connection
      .start()
      .then(() => setIsConnected(true))
      .catch(err => console.error('SignalR connection error:', err));

    connectionRef.current = connection;

    return () => {
      connection.stop();
    };
  }, [hubUrl, enabled]);

  const subscribeToSector = useCallback((companyId: string, sectorId: string) => {
    connectionRef.current?.invoke('SubscribeToSector', companyId, sectorId).catch(() => {});
  }, []);

  const unsubscribeFromSector = useCallback((companyId: string, sectorId: string) => {
    connectionRef.current?.invoke('UnsubscribeFromSector', companyId, sectorId).catch(() => {});
  }, []);

  const subscribeToRun = useCallback((runId: string) => {
    connectionRef.current?.invoke('SubscribeToRun', runId).catch(() => {});
  }, []);

  const unsubscribeFromRun = useCallback((runId: string) => {
    connectionRef.current?.invoke('UnsubscribeFromRun', runId).catch(() => {});
  }, []);

  return { isConnected, subscribeToSector, unsubscribeFromSector, subscribeToRun, unsubscribeFromRun };
}

export default useSignalR;
