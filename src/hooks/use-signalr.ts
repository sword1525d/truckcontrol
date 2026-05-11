'use client';
import { useEffect, useRef, useCallback, useState } from 'react';
import * as signalR from '@microsoft/signalr';

interface UseSignalROptions {
  hubUrl: string;
  accessTokenFactory?: () => string | Promise<string>;
  handlers?: Record<string, (...args: unknown[]) => void>;
  enabled?: boolean;
}

export function useSignalR({
  hubUrl,
  accessTokenFactory,
  handlers,
  enabled = true,
}: UseSignalROptions) {
  const connectionRef = useRef<signalR.HubConnection | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  // Track whether the current effect instance is still active
  const activeRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    activeRef.current = true;

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl, {
        accessTokenFactory: accessTokenFactory,
      })
      .configureLogging(signalR.LogLevel.None)
      .withAutomaticReconnect()
      .build();

    const registerHandlers = () => {
      const h = handlersRef.current;
      if (!h) return;
      for (const event of Object.keys(h)) {
        connection.off(event);
      }
      for (const [event, handler] of Object.entries(h)) {
        connection.on(event, handler);
      }
    };

    registerHandlers();
    connection.onreconnected(() => {
      registerHandlers();
    });

    connection
      .start()
      .then(() => {
        if (activeRef.current) setIsConnected(true);
      })
      .catch(err => {
        if (activeRef.current) console.error('SignalR connection error:', err);
      });

    connection.onclose(() => {
      if (activeRef.current) setIsConnected(false);
    });
    connection.onreconnecting(() => {
      if (activeRef.current) setIsConnected(false);
    });
    connection.onreconnected(() => {
      if (activeRef.current) setIsConnected(true);
    });

    connectionRef.current = connection;

    return () => {
      activeRef.current = false;
      connectionRef.current = null;
      connection.stop().catch(() => {});
      setIsConnected(false);
    };
  }, [hubUrl, enabled]);

  const invokeWhenReady = useCallback(<T,>(method: string, ...args: unknown[]): Promise<T> => {
    return new Promise((resolve, reject) => {
      const conn = connectionRef.current;
      if (!conn || conn.state !== signalR.HubConnectionState.Connected) {
        const tryInvoke = () => {
          const c = connectionRef.current;
          if (c && c.state === signalR.HubConnectionState.Connected) {
            c.invoke(method, ...args).then(resolve).catch(reject);
          } else {
            reject(new Error('Not connected'));
          }
        };
        setTimeout(tryInvoke, 500);
        return;
      }
      conn.invoke(method, ...args).then(resolve).catch(reject);
    });
  }, []);

  const subscribeToSector = useCallback((companyId: string, sectorId: string) => {
    invokeWhenReady('SubscribeToSector', companyId, sectorId).catch(() => {});
  }, [invokeWhenReady]);

  const unsubscribeFromSector = useCallback((companyId: string, sectorId: string) => {
    invokeWhenReady('UnsubscribeFromSector', companyId, sectorId).catch(() => {});
  }, [invokeWhenReady]);

  const subscribeToRun = useCallback((runId: string) => {
    invokeWhenReady('SubscribeToRun', runId).catch(() => {});
  }, [invokeWhenReady]);

  const unsubscribeFromRun = useCallback((runId: string) => {
    invokeWhenReady('UnsubscribeFromRun', runId).catch(() => {});
  }, [invokeWhenReady]);

  return { isConnected, subscribeToSector, unsubscribeFromSector, subscribeToRun, unsubscribeFromRun };
}

export default useSignalR;
