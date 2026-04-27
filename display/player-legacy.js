/*
 * Legacy display runtime for old Smart TV browsers.
 * Deliberately ES5-only: no fetch, promises, async/await, const/let, Map,
 * template literals, optional chaining, classList, or modern array helpers.
 */
(function () {
  var STORAGE_TOKEN = 'cartelera.token';
  var STORAGE_DISPLAY_ID = 'cartelera.displayId';
  var STORAGE_CONFIG = 'cartelera.config.v1';
  var state = {
    serverBase: window.location.protocol + '//' + window.location.host,
    token: storageGet(STORAGE_TOKEN),
    displayId: Number(storageGet(STORAGE_DISPLAY_ID) || 0) || null,
    config: null,
    timers: [],
    alertTimer: null
  };

  window.CarteleraLegacyStarted = true;

  function $(id) { return document.getElementById(id); }

  function storageGet(key) {
    try { return window.localStorage ? window.localStorage.getItem(key) : null; } catch (e) { return null; }
  }

  function storageSet(key, value) {
    try { if (window.localStorage) window.localStorage.setItem(key, value); } catch (e) {}
  }

  function storageRemove(key) {
    try { if (window.localStorage) window.localStorage.removeItem(key); } catch (e) {}
  }

  function addClass(el, name) {
    if (!el) return;
    if ((' ' + el.className + ' ').indexOf(' ' + name + ' ') < 0) el.className += (el.className ? ' ' : '') + name;
  }

  function removeClass(el, name) {
    if (!el) return;
    el.className = (' ' + el.className + ' ').replace(' ' + name + ' ', ' ').replace(/^\s+|\s+$/g, '');
  }

  function on(el, eventName, fn) {
    if (!el) return;
    if (el.addEventListener) el.addEventListener(eventName, fn, false);
    else if (el.attachEvent) el.attachEvent('on' + eventName, fn);
    else el['on' + eventName] = fn;
  }

  function setText(el, value) {
    if (!el) return;
    if ('textContent' in el) el.textContent = value;
    else el.innerText = value;
  }

  function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function xhr(method, url, body, headers, cb) {
    var req = new XMLHttpRequest();
    req.open(method, url, true);
    req.onreadystatechange = function () {
      if (req.readyState !== 4) return;
      var data = null;
      try { data = req.responseText ? JSON.parse(req.responseText) : null; } catch (e) {}
      cb(null, { status: req.status, body: data, text: req.responseText || '' });
    };
    req.onerror = function () { cb(new Error('network error')); };
    headers = headers || {};
    for (var k in headers) {
      if (Object.prototype.hasOwnProperty.call(headers, k)) req.setRequestHeader(k, headers[k]);
    }
    req.send(body ? JSON.stringify(body) : null);
  }

  function clearTimers() {
    for (var i = 0; i < state.timers.length; i++) clearTimeout(state.timers[i]);
    state.timers = [];
  }

  function showPairing() {
    removeClass($('pairing'), 'hidden');
    addClass($('player'), 'hidden');
    addClass($('loader'), 'hidden');
    setText($('server-host'), state.serverBase);
    var input = $('pairing-code');
    if (input) {
      input.value = '';
      try { input.focus(); } catch (e) {}
    }
    xhr('GET', state.serverBase + '/api/health', null, {}, function (_err, res) {
      if (res && res.status >= 200 && res.status < 300) addClass($('server-status'), 'dot');
      else setText($('server-status'), 'sin conexion');
    });
    var button = $('pairing-submit');
    if (button) button.onclick = pairDisplay;
    if (input) input.onkeydown = function (ev) {
      ev = ev || window.event;
      if ((ev.keyCode || ev.which) === 13) pairDisplay();
    };
  }

  function showError(msg) {
    var el = $('pairing-error');
    setText(el, msg);
    removeClass(el, 'hidden');
  }

  function pairDisplay() {
    var input = $('pairing-code');
    var button = $('pairing-submit');
    var code = input ? String(input.value || '').replace(/\s+/g, '').toUpperCase() : '';
    if (code.length !== 6) {
      showError('El codigo debe tener 6 caracteres');
      return;
    }
    if (button) button.disabled = true;
    xhr('POST', state.serverBase + '/api/player/pair', {
      code: code,
      user_agent: navigator.userAgent || 'legacy-tv',
      hardware_info: { legacy: true, screen: { w: screen.width || 0, h: screen.height || 0 } }
    }, { 'content-type': 'application/json' }, function (_err, res) {
      if (button) button.disabled = false;
      if (!res || res.status < 200 || res.status >= 300 || !res.body || !res.body.token) {
        showError((res && res.body && res.body.error) || 'Codigo invalido');
        return;
      }
      state.token = res.body.token;
      state.displayId = res.body.display_id;
      storageSet(STORAGE_TOKEN, state.token);
      storageSet(STORAGE_DISPLAY_ID, String(state.displayId));
      addClass($('pairing'), 'hidden');
      bootstrap();
    });
  }

  function bootstrap() {
    removeClass($('player'), 'hidden');
    removeClass($('loader'), 'hidden');
    loadConfig(function () {
      addClass($('loader'), 'hidden');
      startHeartbeat();
      setInterval(function () { loadConfig(function () {}); }, 60000);
      startClock();
    });
  }

  function loadConfig(done) {
    xhr('GET', state.serverBase + '/api/player/config', null, {
      authorization: 'Bearer ' + state.token
    }, function (_err, res) {
      if (!res || res.status === 401) {
        storageRemove(STORAGE_TOKEN);
        storageRemove(STORAGE_DISPLAY_ID);
        state.token = null;
        showPairing();
        if (done) done();
        return;
      }
      if (res.status < 200 || res.status >= 300 || !res.body) {
        renderCached();
        if (done) done();
        return;
      }
      state.config = res.body;
      storageSet(STORAGE_CONFIG, JSON.stringify(res.body));
      renderConfig(res.body);
      if (done) done();
    });
  }

  function renderCached() {
    var cached = storageGet(STORAGE_CONFIG);
    if (!cached) return;
    try {
      state.config = JSON.parse(cached);
      renderConfig(state.config);
    } catch (e) {}
  }

  function renderConfig(config) {
    var display = config.display || {};
    setText($('display-name'), display.name || '');
    setText($('zone-name'), display.zone_name || '');
    renderLayout(config.layout);
    renderAlerts(config.alerts || []);
  }

  function renderLayout(layout) {
    clearTimers();
    var regions = $('regions');
    if (!regions) return;
    regions.innerHTML = '';
    if (!layout || !layout.id || !layout.definition) {
      regions.innerHTML = '<div style="position:absolute;left:0;top:0;right:0;bottom:0;text-align:center;padding-top:220px;color:#dbeafe;font-size:42px;">Sin layout asignado</div>';
      document.body.style.backgroundColor = '#0f172a';
      return;
    }
    document.body.style.backgroundColor = layout.background_color || '#000000';
    var def = layout.definition;
    var vw = layout.width || 1920;
    var vh = layout.height || 1080;
    var scaleX = (window.innerWidth || document.documentElement.clientWidth || vw) / vw;
    var scaleY = (window.innerHeight || document.documentElement.clientHeight || vh) / vh;
    var list = def.regions || [];
    for (var i = 0; i < list.length; i++) renderRegion(regions, list[i], scaleX, scaleY);
  }

  function renderRegion(parent, region, scaleX, scaleY) {
    var div = document.createElement('div');
    div.className = 'region';
    div.style.left = Math.round((region.x || 0) * scaleX) + 'px';
    div.style.top = Math.round((region.y || 0) * scaleY) + 'px';
    div.style.width = Math.round((region.w || 100) * scaleX) + 'px';
    div.style.height = Math.round((region.h || 100) * scaleY) + 'px';
    parent.appendChild(div);
    cycleRegion(div, region, 0);
  }

  function cycleRegion(el, region, idx) {
    var items = region.items || [];
    if (!items.length) return;
    if (idx >= items.length) idx = 0;
    renderItem(el, items[idx]);
    if (items.length > 1) {
      state.timers.push(setTimeout(function () {
        cycleRegion(el, region, idx + 1);
      }, Math.max(1000, items[idx].durationMs || 10000)));
    }
  }

  function renderItem(el, item) {
    if (item.type === 'text') {
      renderText(el, item);
    } else if (item.type === 'media') {
      el.innerHTML = '<img class="region-media-img" src="' + escapeHtml(state.serverBase + '/api/media/' + item.mediaId + '/file') + '" alt="" />';
    } else {
      el.innerHTML = '<div class="region-text">Widget ' + escapeHtml(item.widgetId || '') + '</div>';
    }
  }

  function renderText(el, item) {
    var style = item.style || {};
    var css = 'width:100%;height:100%;display:table;text-align:' + escapeHtml(style.textAlign || 'center') + ';';
    css += 'color:' + escapeHtml(style.color || '#ffffff') + ';';
    css += 'font-size:' + escapeHtml(style.fontSize || '42px') + ';';
    css += 'font-weight:' + escapeHtml(style.fontWeight || '700') + ';';
    el.innerHTML = '<div style="' + css + '"><div style="display:table-cell;vertical-align:middle;padding:20px;">' + escapeHtml(item.text || '') + '</div></div>';
  }

  function renderAlerts(alerts) {
    var layer = $('alerts-layer');
    if (!layer) return;
    layer.innerHTML = '';
    if (!alerts || !alerts.length) return;
    var a = alerts[0];
    layer.innerHTML = '<div class="alert-banner severity-' + escapeHtml(a.severity || 'info') + '"><div class="alert-body"><div class="alert-title">' + escapeHtml(a.title || '') + '</div>' + (a.body ? '<div class="alert-msg">' + escapeHtml(a.body) + '</div>' : '') + '</div></div>';
    if (state.alertTimer) clearTimeout(state.alertTimer);
    if (a.duration_seconds) {
      state.alertTimer = setTimeout(function () { layer.innerHTML = ''; }, a.duration_seconds * 1000);
    }
  }

  function startHeartbeat() {
    function send() {
      if (!state.token) return;
      xhr('POST', state.serverBase + '/api/player/heartbeat', {
        uptime_s: Math.floor(new Date().getTime() / 1000),
        version: 'legacy-tv'
      }, { 'content-type': 'application/json', authorization: 'Bearer ' + state.token }, function () {});
    }
    send();
    setInterval(send, 45000);
  }

  function startClock() {
    function tick() {
      var d = new Date();
      var h = d.getHours();
      var m = d.getMinutes();
      setText($('clock'), (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m);
    }
    tick();
    setInterval(tick, 10000);
  }

  if (state.token && state.displayId) bootstrap();
  else showPairing();
})();
