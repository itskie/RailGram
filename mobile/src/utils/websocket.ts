/**
 * WebSocket Manager for Real-Time Chat
 * Handles connection, message sending/receiving, and error recovery
 */

import { useEffect, useRef, useState } from 'react';

interface WSMessage {
  type: 'message' | 'read' | 'ping' | 'pong' | 'error';
  data?: any;
  body?: string;
  msg_type?: string;
}

export class ChatWebSocket {
  private ws: WebSocket | null = null;
  private url: string;
  private token: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 3000;
  private messageQueue: WSMessage[] = [];
  private isConnecting = false;

  // Callbacks
  private onMessage: ((msg: any) => void) | null = null;
  private onError: ((error: string) => void) | null = null;
  private onStatusChange: ((status: 'connecting' | 'connected' | 'disconnected' | 'error') => void) | null = null;

  constructor(conversationId: string, token: string, baseUrl = 'https://railgram.in') {
    this.url = `${baseUrl.replace(/^https?:/, 'wss:')}/api/v1/ws/conversations/${conversationId}?token=${token}`;
    this.token = token;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      this.isConnecting = true;
      this.onStatusChange?.('connecting');

      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          console.log('WS Connected:', this.url);
          this.reconnectAttempts = 0;
          this.isConnecting = false;
          this.onStatusChange?.('connected');
          this.flushMessageQueue();
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const msg: WSMessage = JSON.parse(event.data);

            if (msg.type === 'message' && msg.data) {
              this.onMessage?.(msg.data);
            } else if (msg.type === 'error') {
              console.error('WS Error:', msg.data);
              this.onError?.(msg.data?.detail || 'Unknown error');
            } else if (msg.type === 'pong') {
              // Keep-alive pong
            }
          } catch (err) {
            console.error('Failed to parse WS message:', err);
          }
        };

        this.ws.onerror = (event) => {
          console.error('WS Error event:', event);
          this.isConnecting = false;
          this.onStatusChange?.('error');
          this.onError?.('WebSocket connection error');
          reject(new Error('WebSocket connection failed'));
        };

        this.ws.onclose = () => {
          console.log('WS Disconnected');
          this.isConnecting = false;
          this.onStatusChange?.('disconnected');
          this.attemptReconnect();
        };
      } catch (err) {
        this.isConnecting = false;
        this.onStatusChange?.('error');
        reject(err);
      }
    });
  }

  private attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`WS Reconnecting... (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      setTimeout(() => this.connect().catch(console.error), this.reconnectDelay);
    } else {
      console.error('WS Max reconnection attempts reached');
      this.onError?.('Failed to reconnect');
    }
  }

  private flushMessageQueue() {
    while (this.messageQueue.length > 0 && this.ws?.readyState === WebSocket.OPEN) {
      const msg = this.messageQueue.shift();
      if (msg) {
        this.ws.send(JSON.stringify(msg));
      }
    }
  }

  sendMessage(body: string, msg_type: string = 'text') {
    const msg: WSMessage = {
      type: 'message',
      body,
      msg_type,
    };

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    } else {
      this.messageQueue.push(msg);
      console.warn('WS not connected, queuing message');
      if (!this.isConnecting) {
        this.connect().catch(console.error);
      }
    }
  }

  send(msg: WSMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    } else {
      this.messageQueue.push(msg);
    }
  }

  ping() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'ping' }));
    }
  }

  close() {
    this.maxReconnectAttempts = 0; // Stop auto-reconnect
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  isOpen(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  on(
    event: 'message' | 'error' | 'statusChange',
    handler: (data: any) => void
  ) {
    if (event === 'message') {
      this.onMessage = handler;
    } else if (event === 'error') {
      this.onError = handler;
    } else if (event === 'statusChange') {
      this.onStatusChange = handler as any;
    }
  }
}

/**
 * React Hook for WebSocket Chat
 */
export const useWebSocket = (conversationId: string | null, token: string) => {
  const wsRef = useRef<ChatWebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!conversationId || !token) return;

    wsRef.current = new ChatWebSocket(conversationId, token);

    wsRef.current.on('statusChange', (st) => {
      setStatus(st);
      setIsConnected(st === 'connected');
    });

    wsRef.current.on('error', (err) => {
      setError(err);
    });

    wsRef.current.connect().catch((err) => {
      console.error('Failed to connect WS:', err);
      setError('Failed to connect chat');
    });

    // Ping every 30s to keep connection alive
    const pingInterval = setInterval(() => {
      if (wsRef.current?.isOpen()) {
        wsRef.current.ping();
      }
    }, 30000);

    return () => {
      clearInterval(pingInterval);
      wsRef.current?.close();
    };
  }, [conversationId, token]);

  return {
    ws: wsRef.current,
    isConnected,
    status,
    error,
  };
};
