// WebSocket client. Falls back to solo play if the server is unreachable.
export class Net {
  constructor() {
    this.ws = null;
    this.connected = false;
    this.id = 'local';
    this.hostId = 'local';
    this.room = '';
    this.handlers = {};
    this.queue = [];
  }

  get isHost() { return !this.connected || this.hostId === this.id; }

  on(type, fn) { this.handlers[type] = fn; }

  connect(room, name, look, timeoutMs = 2500) {
    this.room = room;
    return new Promise((resolve) => {
      let done = false;
      const finish = (ok) => { if (!done) { done = true; resolve(ok); } };
      let url;
      try {
        const proto = location.protocol === 'https:' ? 'wss' : 'ws';
        url = `${proto}://${location.host}/ws`;
        this.ws = new WebSocket(url);
      } catch (_) { finish(false); return; }
      const timer = setTimeout(() => { try { this.ws.close(); } catch (_) { /* ignore */ } finish(false); }, timeoutMs);
      this.ws.onopen = () => {
        this.ws.send(JSON.stringify({ t: 'join', room, name, look }));
      };
      this.ws.onmessage = (ev) => {
        let m;
        try { m = JSON.parse(ev.data); } catch (_) { return; }
        if (m.t === 'welcome') {
          clearTimeout(timer);
          this.connected = true;
          this.id = m.id;
          this.hostId = m.hostId;
          finish(true);
        }
        if (m.t === 'host') this.hostId = m.hostId;
        const h = this.handlers[m.t];
        if (h) h(m);
      };
      this.ws.onclose = () => {
        clearTimeout(timer);
        const was = this.connected;
        this.connected = false;
        finish(false);
        if (was && this.handlers.disconnect) this.handlers.disconnect();
      };
      this.ws.onerror = () => { /* onclose follows */ };
    });
  }

  send(m) {
    if (!this.connected || this.ws.readyState !== 1) return;
    this.ws.send(JSON.stringify(m));
  }
}
