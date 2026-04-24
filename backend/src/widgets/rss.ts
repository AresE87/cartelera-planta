import type { WidgetContext, WidgetPayload } from './engine';
import { safeFetch } from '../util/safe-fetch';

/**
 * Widget RSS — parser simple de RSS 2.0 / Atom.
 * Config:
 *   url: string
 *   limit?: number
 *   showImages?: boolean
 */
export async function buildRss(ctx: WidgetContext): Promise<WidgetPayload> {
  const cfg = ctx.config as { url?: string; limit?: number; showImages?: boolean };
  const url = cfg.url || ctx.widget.data_source_url;
  if (!url) {
    return {
      type: 'rss',
      generatedAt: new Date().toISOString(),
      ttlSeconds: ctx.widget.refresh_seconds,
      data: { items: [], error: 'No URL configured' },
    };
  }

  const res = await safeFetch(url, { timeoutMs: 15_000, maxBytes: 2 * 1024 * 1024 });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const items = parseRss(res.text, cfg.limit ?? 10);
  return {
    type: 'rss',
    generatedAt: new Date().toISOString(),
    ttlSeconds: ctx.widget.refresh_seconds,
    data: { items, source: url },
  };
}

interface RssItem { title: string; link: string; pubDate: string; description: string; image?: string }

function parseRss(xml: string, limit: number): RssItem[] {
  const items: RssItem[] = [];
  const itemRegex = /<(item|entry)[^>]*>([\s\S]*?)<\/(item|entry)>/g;
  let m: RegExpExecArray | null;
  while ((m = itemRegex.exec(xml)) !== null && items.length < limit) {
    const block = m[2];
    items.push({
      title: extractTag(block, 'title') ?? '',
      link: extractLink(block),
      pubDate: extractTag(block, 'pubDate') ?? extractTag(block, 'published') ?? '',
      description: stripHtml(extractTag(block, 'description') ?? extractTag(block, 'summary') ?? ''),
      image: extractImage(block),
    });
  }
  return items;
}

function extractTag(block: string, tag: string): string | null {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const m = block.match(re);
  if (!m) return null;
  return decodeCdata(m[1]).trim();
}

function extractLink(block: string): string {
  const m1 = block.match(/<link[^>]*>([^<]+)<\/link>/i);
  if (m1) return m1[1].trim();
  const m2 = block.match(/<link[^>]*href="([^"]+)"/i);
  return m2 ? m2[1] : '';
}

function extractImage(block: string): string | undefined {
  const m = block.match(/<enclosure[^>]*url="([^"]+)"/i) || block.match(/<media:content[^>]*url="([^"]+)"/i);
  return m ? m[1] : undefined;
}

function decodeCdata(s: string): string {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, '').slice(0, 500);
}
