import { getToken } from './api';

type Listener = (msg: any) => void;

class WsClient {
  private ws: WebSocket | null = null;
  private listeners = new Set<Listener>();
  private reconnectMs = 1000;
  private isConnecting = false;

  connect() {
    if (this.isConnecting || this.ws?.readyState === WebSocket.OPEN) return;
    const token = getToken();
    if (!token) return;
    this.isConnecting = true;
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${proto}//${location.host}/ws?token=${encodeURIComponent(token)}`;
    try {
      const ws = new WebSocket(url);
      this.ws = ws;
      ws.onopen = () => {
        this.reconnectMs = 1000;
        this.isConnecting = false;
      };
      ws.onmessage = ev => {
        try {
          const msg = JSON.parse(ev.data);
          for (const l of this.listeners) l(msg);
        } catch { /* ignore */ }
      };
      ws.onclose = () => {
        this.ws = null;
        this.isConnecting = false;
        setTimeout(() => this.connect(), this.reconnectMs);
        this.reconnectMs = Math.min(30000, this.reconnectMs * 2);
      };
      ws.onerror = () => { /* noop, close handles reconnect */ };
    } catch {
      this.isConnecting = false;
    }
  }

  send(data: unknown) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  disconnect() {
    this.listeners.clear();
    if (this.ws) try { this.ws.close(); } catch {}
    this.ws = null;
  }
}

export const ws = new WsClient();
