import { useEffect, useRef, useCallback, useState } from 'react';

type WsStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

interface UseWebSocketOptions {
  /** URL completa del WebSocket, e.g. ws://localhost:8000/ws/admin */
  url: string;
  /** Activar/desactivar la conexión (por defecto true) */
  enabled?: boolean;
  /** Retardo inicial en ms antes del primer reintento (default 1000) */
  baseDelay?: number;
  /** Factor multiplicador por intento (default 2) */
  backoffFactor?: number;
  /** Máximo retardo en ms (default 30000) */
  maxDelay?: number;
  /** Máximo número de reintentos (default Infinity) */
  maxRetries?: number;
  /** Callback al recibir un mensaje */
  onMessage?: (event: MessageEvent) => void;
  /** Callback al conectar */
  onOpen?: () => void;
  /** Callback al desconectar */
  onClose?: () => void;
  /** Callback al error */
  onError?: (event: Event) => void;
}

interface UseWebSocketReturn {
  status: WsStatus;
  send: (data: string | ArrayBufferLike | Blob | ArrayBufferView) => void;
  disconnect: () => void;
  reconnect: () => void;
  retryCount: number;
}

export function useWebSocket({
  url,
  enabled = true,
  baseDelay = 1000,
  backoffFactor = 2,
  maxDelay = 30_000,
  maxRetries = Infinity,
  onMessage,
  onOpen,
  onClose,
  onError,
}: UseWebSocketOptions): UseWebSocketReturn {
  const wsRef = useRef<WebSocket | null>(null);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const manuallyDisconnectedRef = useRef(false);
  const mountedRef = useRef(true);

  const [status, setStatus] = useState<WsStatus>('disconnected');
  const [retryCount, setRetryCount] = useState(0);

  // Stable refs so callbacks don't cause re-connections
  const onMessageRef = useRef(onMessage);
  const onOpenRef = useRef(onOpen);
  const onCloseRef = useRef(onClose);
  const onErrorRef = useRef(onError);
  useEffect(() => { onMessageRef.current = onMessage; }, [onMessage]);
  useEffect(() => { onOpenRef.current = onOpen; }, [onOpen]);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  const clearRetryTimer = () => {
    if (retryTimerRef.current !== null) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  };

  const connect = useCallback(() => {
    if (!mountedRef.current) return;
    if (wsRef.current && wsRef.current.readyState < 2) return; // CONNECTING or OPEN

    setStatus('connecting');

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) return;
      retryCountRef.current = 0;
      setRetryCount(0);
      setStatus('connected');
      onOpenRef.current?.();
    };

    ws.onmessage = (event) => {
      onMessageRef.current?.(event);
    };

    ws.onerror = (event) => {
      if (!mountedRef.current) return;
      setStatus('error');
      onErrorRef.current?.(event);
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      setStatus('disconnected');
      onCloseRef.current?.();

      if (manuallyDisconnectedRef.current) return;
      if (retryCountRef.current >= maxRetries) return;

      // Exponential backoff con jitter
      const delay = Math.min(
        baseDelay * Math.pow(backoffFactor, retryCountRef.current) + Math.random() * 200,
        maxDelay,
      );
      retryCountRef.current += 1;
      setRetryCount(retryCountRef.current);

      retryTimerRef.current = setTimeout(() => {
        if (!mountedRef.current || manuallyDisconnectedRef.current) return;
        connect();
      }, delay);
    };
  }, [url, baseDelay, backoffFactor, maxDelay, maxRetries]);

  const disconnect = useCallback(() => {
    manuallyDisconnectedRef.current = true;
    clearRetryTimer();
    wsRef.current?.close();
    wsRef.current = null;
  }, []);

  const reconnect = useCallback(() => {
    manuallyDisconnectedRef.current = false;
    retryCountRef.current = 0;
    setRetryCount(0);
    clearRetryTimer();
    wsRef.current?.close();
    wsRef.current = null;
    connect();
  }, [connect]);

  const send = useCallback(
    (data: string | ArrayBufferLike | Blob | ArrayBufferView) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(data);
      } else {
        console.warn('[useWebSocket] send() called but socket is not open');
      }
    },
    [],
  );

  // Mount / unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reacts to url / enabled changes
  useEffect(() => {
    if (!enabled) {
      disconnect();
      return;
    }
    manuallyDisconnectedRef.current = false;
    connect();

    return () => {
      clearRetryTimer();
      wsRef.current?.close();
      wsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, enabled]);

  return { status, send, disconnect, reconnect, retryCount };
}
