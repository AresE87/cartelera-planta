/**
 * Widget renderers for the display client.
 * Each renderer receives (el, data, config) and mutates `el`.
 *
 * Data is the payload returned from the backend's widget engine:
 *   { type, generatedAt, ttlSeconds, data: <widget-specific> }
 */
(function (global) {
  const renderers = {};

  function mount(el, type, title, innerHtml) {
    el.className = `widget widget-${type}`;
    el.innerHTML = innerHtml;
  }

  function renderError(el, type, message) {
    el.className = `widget widget-error`;
    el.innerHTML = `<div><strong>Widget (${escapeHtml(type)}) no disponible</strong><br/><small>${escapeHtml(message)}</small></div>`;
  }

  function escapeHtml(s) {
    if (s === null || s === undefined) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // ----- beneficios -----
  renderers.beneficios = function (el, payload) {
    const items = payload?.data?.items || [];
    if (items.length === 0) {
      mount(el, 'beneficios', 'Beneficios', '<div>Sin beneficios vigentes</div>');
      return;
    }
    // Rotate through items based on generatedAt; player handles per-item duration via region loop
    const idx = Math.floor(Date.now() / 6000) % items.length;
    const b = items[idx];
    const label = b.destacado ? '<div class="label">★ Destacado</div>' : '';
    const category = b.categoria ? `<div class="category">${escapeHtml(b.categoria)}</div>` : '';
    const desc = b.descripcion ? `<div class="desc">${escapeHtml(b.descripcion)}</div>` : '';
    el.className = 'widget widget-beneficios';
    el.innerHTML = `
      ${label}
      <div class="title">🎁 ${escapeHtml(b.titulo || '')}</div>
      ${desc}
      ${category}
    `;
  };

  // ----- cumpleanos -----
  renderers.cumpleanos = function (el, payload) {
    const people = payload?.data?.people || [];
    const month = payload?.data?.month || '';
    const monthName = [
      'Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
    ][(Number(month) || 1) - 1] || '';
    const html = `
      <div class="header">
        <span class="emoji">🎂</span>
        <div class="title">Cumpleaños de ${escapeHtml(monthName)}</div>
      </div>
      <ul>
        ${people.map(p => {
          const d = new Date(p.fecha);
          const day = isNaN(d) ? '-' : d.getDate();
          return `<li>
            <span>${escapeHtml([p.nombre, p.apellido].filter(Boolean).join(' '))}${p.area ? ` <small style="opacity:.7">· ${escapeHtml(p.area)}</small>` : ''}</span>
            <span class="day">${day}</span>
          </li>`;
        }).join('')}
      </ul>
      ${people.length === 0 ? '<div style="text-align:center;opacity:.7">Sin cumpleaños cargados este mes</div>' : ''}
    `;
    el.className = 'widget widget-cumpleanos';
    el.innerHTML = html;
  };

  // ----- avisos -----
  renderers.avisos = function (el, payload) {
    const items = payload?.data?.items || [];
    el.className = 'widget widget-avisos';
    el.innerHTML = `
      <div class="header"><span style="font-size:32px">📣</span><div class="title">Avisos</div></div>
      <ul>
        ${items.map(a => `
          <li class="${escapeHtml(a.prioridad || 'baja')}">
            <div class="aviso-title">${escapeHtml(a.titulo || '')}</div>
            ${a.cuerpo ? `<div class="aviso-body">${escapeHtml(a.cuerpo)}</div>` : ''}
            ${a.fecha ? `<div class="aviso-meta">${escapeHtml(new Date(a.fecha).toLocaleDateString('es-AR'))}</div>` : ''}
          </li>
        `).join('')}
        ${items.length === 0 ? '<li>Sin avisos</li>' : ''}
      </ul>
    `;
  };

  // ----- kpis -----
  renderers.kpis = function (el, payload) {
    const kpis = payload?.data?.kpis || [];
    el.className = 'widget widget-kpis';
    el.innerHTML = `
      <div class="header"><span style="font-size:28px">📊</span><div class="title">KPIs</div></div>
      <div class="grid">
        ${kpis.map(k => `
          <div class="kpi" style="border-top-color:${escapeHtml(k.color || '#3b82f6')}">
            <div>
              <div class="label">${escapeHtml(k.icon ? k.icon + ' ' : '')}${escapeHtml(k.label || '')}</div>
              <div class="value">${escapeHtml(String(k.value))}<small style="font-size:24px;opacity:.7">${escapeHtml(k.unit || '')}</small></div>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center">
              <span class="target">${k.target !== undefined ? 'Meta: ' + escapeHtml(String(k.target)) + escapeHtml(k.unit || '') : ''}</span>
              <span class="trend">${k.trend === 'up' ? '↗' : k.trend === 'down' ? '↘' : ''}</span>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  };

  // ----- alertas (widget, en slot normal) -----
  renderers.alertas = function (el, payload) {
    const alerts = payload?.data?.alerts || [];
    el.className = 'widget widget-avisos';
    if (alerts.length === 0) {
      el.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;opacity:.7">Sin alertas activas</div>`;
      return;
    }
    el.innerHTML = `
      <div class="header"><span style="font-size:32px">⚠</span><div class="title">Alertas</div></div>
      <ul>
        ${alerts.map(a => `
          <li class="${escapeHtml(a.severity === 'emergency' || a.severity === 'critical' ? 'alta' : a.severity === 'warn' ? 'media' : 'baja')}">
            <div class="aviso-title">${escapeHtml(a.title)}</div>
            ${a.body ? `<div class="aviso-body">${escapeHtml(a.body)}</div>` : ''}
          </li>
        `).join('')}
      </ul>
    `;
  };

  // ----- clima -----
  const weatherIcon = code => {
    if (code === 0) return '☀️';
    if (code >= 1 && code <= 3) return '⛅';
    if (code >= 45 && code <= 48) return '🌫️';
    if (code >= 51 && code <= 67) return '🌧️';
    if (code >= 71 && code <= 77) return '❄️';
    if (code >= 80 && code <= 82) return '🌦️';
    if (code >= 95) return '⛈️';
    return '🌤️';
  };
  renderers.clima = function (el, payload) {
    const d = payload?.data || {};
    const cur = d.current || {};
    el.className = 'widget widget-clima';
    if (d.error) {
      el.innerHTML = `<div>${escapeHtml(d.nombre || 'Clima')}</div><div class="detail">No disponible</div>`;
      return;
    }
    el.innerHTML = `
      <div class="icon">${weatherIcon(cur.weather_code)}</div>
      <div class="city">${escapeHtml(d.nombre || '')}</div>
      <div class="temp">${Math.round(cur.temperature_2m ?? 0)}<span class="unit">°C</span></div>
      <div class="detail">Sensación ${Math.round(cur.apparent_temperature ?? 0)}° · Viento ${Math.round(cur.wind_speed_10m ?? 0)} km/h</div>
    `;
  };

  // ----- reloj -----
  renderers.reloj = function (el, payload) {
    const cfg = payload?.data || {};
    const tz = cfg.tz || 'America/Argentina/Buenos_Aires';
    const now = new Date();
    const time = now.toLocaleTimeString('es-AR', {
      hour: '2-digit', minute: '2-digit',
      hour12: cfg.formato === '12h',
      timeZone: tz,
    });
    const date = cfg.mostrarFecha
      ? now.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: tz })
      : '';
    el.className = 'widget widget-reloj';
    el.innerHTML = `
      <div class="time">${escapeHtml(time)}</div>
      ${date ? `<div class="date">${escapeHtml(date)}</div>` : ''}
    `;
  };

  // ----- texto -----
  renderers.texto = function (el, payload) {
    const d = payload?.data || {};
    const style = Object.entries(d.estilo || {}).map(([k, v]) => `${k}:${v}`).join(';');
    el.className = 'widget widget-texto';
    el.style.textAlign = d.alineacion || 'center';
    if (d.animacion === 'marquee') {
      el.innerHTML = `<div class="marquee" style="${escapeHtml(style)}">${escapeHtml(d.texto || '')}</div>`;
    } else {
      el.innerHTML = `<div style="width:100%;${escapeHtml(style)}">${escapeHtml(d.texto || '')}</div>`;
    }
  };

  // ----- imagen_url -----
  renderers.imagen_url = function (el, payload) {
    const d = payload?.data || {};
    el.className = 'widget widget-imagen_url';
    el.innerHTML = d.url
      ? `<img src="${escapeHtml(d.url)}" style="object-fit:${escapeHtml(d.fit || 'cover')}" alt=""/>`
      : '<div class="widget-error">Sin URL configurada</div>';
  };

  // ----- youtube -----
  renderers.youtube = function (el, payload) {
    const d = payload?.data || {};
    if (!d.videoId) {
      el.className = 'widget widget-error';
      el.innerHTML = 'Sin videoId configurado';
      return;
    }
    el.className = 'widget widget-youtube';
    const params = new URLSearchParams({
      autoplay: d.autoplay ? '1' : '0',
      mute: d.mute ? '1' : '0',
      controls: '0',
      loop: '1',
      playlist: d.videoId,
      modestbranding: '1',
      rel: '0',
    });
    el.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${escapeHtml(d.videoId)}?${params.toString()}" allow="autoplay; fullscreen"></iframe>`;
  };

  // ----- iframe -----
  renderers.iframe = function (el, payload) {
    const d = payload?.data || {};
    el.className = 'widget widget-iframe';
    el.innerHTML = d.url
      ? `<iframe src="${escapeHtml(d.url)}" sandbox="${escapeHtml(d.sandbox || 'allow-scripts allow-same-origin')}"></iframe>`
      : '<div class="widget-error">Sin URL configurada</div>';
  };

  // ----- rss -----
  renderers.rss = function (el, payload) {
    const items = payload?.data?.items || [];
    el.className = 'widget widget-rss';
    el.innerHTML = `
      <div class="header"><span style="font-size:28px">📰</span><div class="title">Noticias</div></div>
      <ul>
        ${items.slice(0, 8).map(i => `
          <li>
            <div class="item-title">${escapeHtml(i.title)}</div>
            ${i.description ? `<div class="item-desc">${escapeHtml(i.description.slice(0, 200))}</div>` : ''}
          </li>
        `).join('')}
      </ul>
    `;
  };

  global.CarteleraRenderers = {
    render(el, payload) {
      if (!payload || !payload.type) {
        renderError(el, 'unknown', 'Payload inválido');
        return;
      }
      const fn = renderers[payload.type];
      if (!fn) {
        renderError(el, payload.type, 'Renderer no registrado');
        return;
      }
      try {
        fn(el, payload);
      } catch (err) {
        renderError(el, payload.type, err?.message || String(err));
      }
    },
  };
})(window);
