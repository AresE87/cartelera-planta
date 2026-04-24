/**
 * Cartelera Display — player runtime
 *
 * Flow:
 *   1. Check LocalStorage for api_token (saved from pairing)
 *   2. If no token -> show pairing screen
 *   3. If token   -> connect to WebSocket + poll /api/player/config
 *   4. Render current layout (regions with rotating items)
 *   5. Listen for refresh / alert / layout_change events over WS
 *   6. Cache config + widget data in LocalStorage for offline
 */
(function () {
  const STORAGE_KEYS = {
    token: 'cartelera.token',
    displayId: 'cartelera.displayId',
    config: 'cartelera.config.v1',
    widgetCache: 'cartelera.widgets.v1',
  };

  // ---- State ----
  const state = {
    serverBase: location.origin,
    token: localStorage.getItem(STORAGE_KEYS.token),
    displayId: Number(localStorage.getItem(STORAGE_KEYS.displayId) || 0) || null,
    config: null,       // latest /api/player/config response
    widgetCache: loadJson(STORAGE_KEYS.widgetCache) || {},  // widgetId -> payload
    ws: null,
    wsReconnectMs: 1000,
    isOffline: false,
    regionTimers: new Map(),      // regionId -> timer
    regionIndex: new Map(),       // regionId -> current item index
    showingAlert: null,
    alertTimer: null,
    statusBarTimer: null,
  };

  // Allow ?server=http://other to override for dev
  const qp = new URLSearchParams(location.search);
  if (qp.has('server')) state.serverBase = qp.get('server');

  function loadJson(key) {
    try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; }
  }

  function saveJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* quota */ }
  }

  function $(id) { return document.getElementById(id); }

  // ---- Pairing screen ----
  function showPairing() {
    $('pairing').classList.remove('hidden');
    $('player').classList.add('hidden');
    $('loader').classList.add('hidden');
    $('server-host').textContent = state.serverBase;

    const input = $('pairing-code');
    input.value = '';
    input.focus();

    // Ping server
    fetch(state.serverBase + '/api/health')
      .then(r => r.ok ? $('server-status').classList.add('dot') : null)
      .catch(() => {
        $('server-status').textContent = '⚠ sin conexión';
      });

    $('pairing-submit').onclick = async () => {
      const code = input.value.trim().toUpperCase();
      if (code.length !== 6) {
        showPairingError('El código debe tener 6 caracteres');
        return;
      }
      $('pairing-submit').disabled = true;
      try {
        const res = await fetch(state.serverBase + '/api/player/pair', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            code,
            user_agent: navigator.userAgent,
            hardware_info: {
              screen: { w: screen.width, h: screen.height, ratio: devicePixelRatio },
              platform: navigator.platform,
              lang: navigator.language,
            },
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Código inválido');
        }
        const data = await res.json();
        localStorage.setItem(STORAGE_KEYS.token, data.token);
        localStorage.setItem(STORAGE_KEYS.displayId, String(data.display_id));
        state.token = data.token;
        state.displayId = data.display_id;
        $('pairing').classList.add('hidden');
        bootstrap();
      } catch (err) {
        showPairingError(err.message || String(err));
      } finally {
        $('pairing-submit').disabled = false;
      }
    };

    // Enter submits
    input.onkeydown = e => { if (e.key === 'Enter') $('pairing-submit').click(); };
  }

  function showPairingError(msg) {
    const el = $('pairing-error');
    el.textContent = msg;
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 5000);
  }

  // ---- Bootstrap after pairing ----
  async function bootstrap() {
    $('player').classList.remove('hidden');
    $('loader').classList.remove('hidden');

    // Load cached config first so we have something immediately
    const cached = loadJson(STORAGE_KEYS.config);
    if (cached) {
      state.config = cached;
      renderLayout(cached.layout);
      renderAlerts(cached.alerts || []);
      $('display-name').textContent = cached.display?.name || '—';
      $('zone-name').textContent = cached.display?.zone_name || '—';
    }

    try {
      await fetchConfig();
      $('loader').classList.add('hidden');
    } catch (err) {
      // Offline — keep cached layout going
      setOffline(true);
      $('loader').classList.add('hidden');
    }

    connectWs();
    startClock();
    startHeartbeat();
    startConfigPoll();
  }

  async function fetchConfig() {
    const res = await fetch(state.serverBase + '/api/player/config', {
      headers: { authorization: 'Bearer ' + state.token },
    });
    if (res.status === 401) {
      // Token invalid, re-pair
      localStorage.removeItem(STORAGE_KEYS.token);
      localStorage.removeItem(STORAGE_KEYS.displayId);
      state.token = null;
      showPairing();
      throw new Error('Token inválido');
    }
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    state.config = data;
    saveJson(STORAGE_KEYS.config, data);
    setOffline(false);
    $('display-name').textContent = data.display?.name || '—';
    $('zone-name').textContent = data.display?.zone_name || '—';
    renderLayout(data.layout);
    renderAlerts(data.alerts || []);
    return data;
  }

  async function fetchWidget(id) {
    try {
      const res = await fetch(`${state.serverBase}/api/player/widget/${id}/data`, {
        headers: { authorization: 'Bearer ' + state.token },
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const payload = await res.json();
      state.widgetCache[id] = payload;
      saveJson(STORAGE_KEYS.widgetCache, state.widgetCache);
      return payload;
    } catch (err) {
      return state.widgetCache[id] || null;
    }
  }

  // ---- Rendering ----
  function renderLayout(layout) {
    // Clear existing regions
    for (const t of state.regionTimers.values()) clearInterval(t);
    state.regionTimers.clear();
    state.regionIndex.clear();

    const regions = $('regions');
    regions.innerHTML = '';

    if (!layout || !layout.id || !layout.definition) {
      regions.innerHTML = `
        <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:24px;color:#64748b;text-align:center;padding:48px;">
          <div style="font-size:80px">📺</div>
          <div style="font-size:32px">Sin layout asignado</div>
          <div style="font-size:18px">Display ${state.config?.display?.name || ''}</div>
          <div style="font-size:14px">Asigná un layout desde el panel de administración</div>
        </div>
      `;
      document.body.style.background = '#0f172a';
      return;
    }

    const def = layout.definition;
    const vw = layout.width || 1920;
    const vh = layout.height || 1080;

    // Scale to viewport
    const scaleX = window.innerWidth / vw;
    const scaleY = window.innerHeight / vh;

    for (const r of def.regions || []) {
      const div = document.createElement('div');
      div.className = 'region';
      div.dataset.regionId = r.id;
      div.style.left = (r.x * scaleX) + 'px';
      div.style.top  = (r.y * scaleY) + 'px';
      div.style.width  = (r.w * scaleX) + 'px';
      div.style.height = (r.h * scaleY) + 'px';
      regions.appendChild(div);

      state.regionIndex.set(r.id, 0);
      renderRegionItem(div, r, 0);
      if ((r.items || []).length > 1) {
        scheduleNextItem(div, r);
      }
    }

    document.body.style.background = layout.background_color || '#000';
  }

  function scheduleNextItem(regionEl, region) {
    const items = region.items || [];
    if (items.length <= 1) return;
    const idx = state.regionIndex.get(region.id) ?? 0;
    const duration = Math.max(500, items[idx].durationMs ?? 10000);
    const t = setTimeout(() => {
      const next = (idx + 1) % items.length;
      state.regionIndex.set(region.id, next);
      renderRegionItem(regionEl, region, next);
      scheduleNextItem(regionEl, region);
    }, duration);
    state.regionTimers.set(region.id, t);
  }

  async function renderRegionItem(regionEl, region, idx) {
    const item = (region.items || [])[idx];
    if (!item) return;

    const newEl = document.createElement('div');
    newEl.className = 'region-item';
    regionEl.appendChild(newEl);

    // Render into newEl
    try {
      if (item.type === 'media') {
        await renderMedia(newEl, item.mediaId);
      } else if (item.type === 'widget') {
        await renderWidget(newEl, item.widgetId);
      } else if (item.type === 'text') {
        newEl.className = 'region-item region-text';
        newEl.textContent = item.text;
        if (item.style) Object.assign(newEl.style, item.style);
      }
    } catch (err) {
      newEl.innerHTML = `<div class="widget widget-error">Error: ${escapeHtml(err.message)}</div>`;
    }

    // Fade transition: show new, remove old after transition
    requestAnimationFrame(() => {
      const existing = regionEl.querySelectorAll('.region-item.active');
      existing.forEach(e => {
        e.classList.remove('active');
        e.classList.add('leaving');
        setTimeout(() => e.remove(), 800);
      });
      newEl.classList.add('active');
    });
  }

  async function renderMedia(el, mediaId) {
    const url = `${state.serverBase}/api/media/file/${mediaId}`;
    // We don't have /api/media/file/:id — media route uses /media/file/:filename
    // So we need to look up filename from config's embedded media map if present.
    // For simplicity, assume layout editor stores URLs too. Fall back:
    el.innerHTML = `<img class="region-media-img" src="${escapeHtml(state.serverBase + '/api/media/' + mediaId + '/raw')}" onerror="this.style.display='none'"/>`;
  }

  async function renderWidget(el, widgetId) {
    let payload = state.widgetCache[widgetId];
    // Always refresh if we have network (fire and forget for freshness, but await if no cache)
    const refreshNeeded = !payload || payloadStale(payload);
    if (refreshNeeded && !state.isOffline) {
      try {
        payload = await fetchWidget(widgetId);
      } catch { /* use cached */ }
    } else if (!state.isOffline) {
      // Background refresh
      fetchWidget(widgetId).catch(() => {});
    }
    if (payload && window.CarteleraRenderers) {
      window.CarteleraRenderers.render(el, payload);
    } else {
      el.innerHTML = `<div class="widget widget-error">Widget ${widgetId} no disponible</div>`;
    }
  }

  function payloadStale(payload) {
    if (!payload || !payload.generatedAt) return true;
    const age = (Date.now() - new Date(payload.generatedAt).getTime()) / 1000;
    return age > (payload.ttlSeconds || 300);
  }

  // ---- Alerts ----
  function renderAlerts(alerts) {
    const layer = $('alerts-layer');
    layer.innerHTML = '';
    if (!alerts || alerts.length === 0) return;
    const top = alerts[0];
    showAlert(top);
  }

  function showAlert(alert) {
    const layer = $('alerts-layer');
    layer.innerHTML = '';
    if (!alert) return;

    const banner = document.createElement('div');
    banner.className = `alert-banner severity-${alert.severity || 'info'}`;
    const icon = alert.severity === 'emergency' ? '🚨'
               : alert.severity === 'critical'  ? '⚠️'
               : alert.severity === 'warn'      ? '⚠'
               :                                   'ℹ';
    banner.innerHTML = `
      <div class="alert-icon">${alert.icon || icon}</div>
      <div class="alert-body">
        <div class="alert-title">${escapeHtml(alert.title)}</div>
        ${alert.body ? `<div class="alert-msg">${escapeHtml(alert.body)}</div>` : ''}
      </div>
    `;
    layer.appendChild(banner);
    state.showingAlert = alert;

    if (alert.play_sound) {
      try {
        const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQ==');
        audio.play().catch(() => {});
      } catch { /* ignore */ }
    }

    if (state.alertTimer) clearTimeout(state.alertTimer);
    if (alert.duration_seconds) {
      state.alertTimer = setTimeout(() => {
        layer.innerHTML = '';
        state.showingAlert = null;
      }, alert.duration_seconds * 1000);
    }
  }

  // ---- WebSocket ----
  function connectWs() {
    if (state.ws) try { state.ws.close(); } catch {}
    const wsUrl = state.serverBase.replace(/^http/, 'ws') + '/ws?token=' + encodeURIComponent(state.token);
    try {
      const ws = new WebSocket(wsUrl);
      state.ws = ws;

      ws.addEventListener('open', () => {
        state.wsReconnectMs = 1000;
        setOffline(false);
      });

      ws.addEventListener('message', ev => {
        let msg;
        try { msg = JSON.parse(ev.data); } catch { return; }
        if (msg.type === 'hello') return;
        if (msg.type === 'refresh') fetchConfig().catch(() => {});
        else if (msg.type === 'layout_change') fetchConfig().catch(() => {});
        else if (msg.type === 'alert') showAlert(msg.alert);
        else if (msg.type === 'alert_dismiss') { $('alerts-layer').innerHTML = ''; state.showingAlert = null; }
        else if (msg.type === 'widget_update') {
          // Re-fetch this widget's data
          fetchWidget(msg.widgetId).then(() => {
            // Force re-render of regions currently displaying this widget
            // Simplest: refetch config to regenerate regions
            refreshCurrentWidgets(msg.widgetId);
          }).catch(() => {});
        }
      });

      ws.addEventListener('close', () => {
        setOffline(true);
        setTimeout(connectWs, state.wsReconnectMs);
        state.wsReconnectMs = Math.min(30_000, state.wsReconnectMs * 2);
      });

      ws.addEventListener('error', () => {
        setOffline(true);
      });
    } catch (err) {
      setOffline(true);
      setTimeout(connectWs, state.wsReconnectMs);
    }
  }

  async function refreshCurrentWidgets(widgetId) {
    // Re-render any region item currently showing this widget
    const regions = document.querySelectorAll('.region');
    for (const regionEl of regions) {
      const rid = regionEl.dataset.regionId;
      const region = state.config?.layout?.definition?.regions?.find(r => r.id === rid);
      if (!region) continue;
      const idx = state.regionIndex.get(rid) ?? 0;
      const item = region.items?.[idx];
      if (item?.type === 'widget' && item.widgetId === widgetId) {
        renderRegionItem(regionEl, region, idx);
      }
    }
  }

  // ---- Polling fallback ----
  function startConfigPoll() {
    setInterval(() => {
      fetchConfig().catch(() => {});
    }, 60_000);
  }

  function startHeartbeat() {
    const send = () => {
      fetch(state.serverBase + '/api/player/heartbeat', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer ' + state.token },
        body: JSON.stringify({
          uptime_s: Math.floor(performance.now() / 1000),
          version: '1.0.0',
        }),
      }).catch(() => {});
    };
    send();
    setInterval(send, 45_000);
  }

  function startClock() {
    const tick = () => {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      $('clock').textContent = `${hh}:${mm}`;
    };
    tick();
    setInterval(tick, 10_000);
  }

  // ---- Offline UI ----
  function setOffline(offline) {
    state.isOffline = offline;
    const badge = $('cache-badge');
    const dot = $('connection-dot');
    if (offline) {
      badge.classList.remove('hidden');
      dot.classList.add('offline');
    } else {
      badge.classList.add('hidden');
      dot.classList.remove('offline');
    }
  }

  // ---- Status bar reveal (admin tools) ----
  document.addEventListener('mousemove', () => {
    $('status-bar').classList.add('visible');
    if (state.statusBarTimer) clearTimeout(state.statusBarTimer);
    state.statusBarTimer = setTimeout(() => $('status-bar').classList.remove('visible'), 3000);
  });

  // Hidden unpair (ctrl+shift+U)
  document.addEventListener('keydown', e => {
    if (e.ctrlKey && e.shiftKey && (e.key === 'U' || e.key === 'u')) {
      if (confirm('¿Desvincular este display?')) {
        localStorage.removeItem(STORAGE_KEYS.token);
        localStorage.removeItem(STORAGE_KEYS.displayId);
        location.reload();
      }
    }
    if (e.ctrlKey && e.shiftKey && (e.key === 'R' || e.key === 'r')) {
      location.reload();
    }
  });

  // Re-render on window resize
  let resizeTimer;
  window.addEventListener('resize', () => {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (state.config?.layout) renderLayout(state.config.layout);
    }, 300);
  });

  function escapeHtml(s) {
    if (s === null || s === undefined) return '';
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  // ---- Register Service Worker for offline ----
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }

  // ---- Start ----
  if (state.token && state.displayId) {
    bootstrap();
  } else {
    showPairing();
  }
})();
