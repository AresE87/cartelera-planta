// Registers all built-in widget builders.
import { registerWidget } from './engine';
import { buildBeneficios } from './beneficios';
import { buildCumpleanos } from './cumpleanos';
import { buildAvisos } from './avisos';
import { buildKpis } from './kpis';
import { buildAlertas } from './alertas';
import { buildClima } from './clima';
import { buildReloj } from './reloj';
import { buildRss } from './rss';
import { buildTexto } from './texto';
import { buildImagenUrl } from './imagen-url';
import { buildYoutube } from './youtube';
import { buildIframe } from './iframe';

export function registerAllWidgets() {
  registerWidget('beneficios', buildBeneficios);
  registerWidget('cumpleanos', buildCumpleanos);
  registerWidget('avisos', buildAvisos);
  registerWidget('kpis', buildKpis);
  registerWidget('alertas', buildAlertas);
  registerWidget('clima', buildClima);
  registerWidget('reloj', buildReloj);
  registerWidget('rss', buildRss);
  registerWidget('texto', buildTexto);
  registerWidget('imagen_url', buildImagenUrl);
  registerWidget('youtube', buildYoutube);
  registerWidget('iframe', buildIframe);
}

export { getWidgetData, buildWidgetPayload } from './engine';
