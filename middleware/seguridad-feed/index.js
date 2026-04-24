/**
 * Middleware Seguridad — expone alertas HSE / industriales.
 *
 * En producción real, este servicio escucharía:
 *   - Webhooks de sistemas de alarmas
 *   - MQTT de sensores industriales
 *   - Emails/SMS gateway de HSE
 *
 * Al recibir una alerta, puede también empujarla directo al backend
 * de Cartelera vía POST /api/alerts (requiere API key de un usuario
 * con rol 'seguridad').
 */

const express = require('express');

const PORT = Number(process.env.PORT || 4003);
const CARTELERA_URL = process.env.CARTELERA_URL || 'http://backend:3000';
const CARTELERA_TOKEN = process.env.CARTELERA_TOKEN || '';  // JWT token of a 'seguridad' user

let alerts = [];

const app = express();
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true, service: 'seguridad-feed', activeAlerts: alerts.length }));

app.get('/alertas', (_req, res) => {
  // Return alerts active in the last hour
  const cutoff = Date.now() - 60 * 60 * 1000;
  const active = alerts.filter(a => new Date(a.created_at).getTime() > cutoff);
  res.json({ alerts: active });
});

/**
 * Webhook-style endpoint: an external system POSTs here to raise an alert.
 * Requires a token or API key in real deployments.
 */
app.post('/trigger', async (req, res) => {
  const { title, body, severity = 'warn', target_type = 'all', target_id = null, duration_seconds = 300, play_sound = false } = req.body || {};
  if (!title) return res.status(400).json({ error: 'title required' });

  const alert = {
    id: Date.now(),
    title, body, severity, target_type, target_id, duration_seconds, play_sound,
    created_at: new Date().toISOString(),
  };
  alerts.unshift(alert);
  alerts = alerts.slice(0, 100);

  // Forward to Cartelera backend so the displays get it in real-time
  if (CARTELERA_TOKEN) {
    try {
      const resp = await fetch(`${CARTELERA_URL}/api/alerts`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer ' + CARTELERA_TOKEN },
        body: JSON.stringify({ title, body, severity, target_type, target_id, duration_seconds, play_sound }),
      });
      if (!resp.ok) {
        console.warn('[seguridad] forwarding to Cartelera failed:', resp.status);
      }
    } catch (err) {
      console.warn('[seguridad] forwarding error:', err.message);
    }
  }

  res.json({ ok: true, alert });
});

app.listen(PORT, () => console.log(`[seguridad-feed] listening on :${PORT}`));
