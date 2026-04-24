import type { WidgetContext, WidgetPayload } from './engine';

export function buildYoutube(ctx: WidgetContext): WidgetPayload {
  const cfg = ctx.config as { videoId?: string; url?: string; autoplay?: boolean; mute?: boolean };
  let videoId = cfg.videoId;
  if (!videoId && cfg.url) {
    const m = cfg.url.match(/(?:v=|\/embed\/|youtu\.be\/)([A-Za-z0-9_-]{11})/);
    if (m) videoId = m[1];
  }
  return {
    type: 'youtube',
    generatedAt: new Date().toISOString(),
    ttlSeconds: ctx.widget.refresh_seconds,
    data: {
      videoId: videoId ?? '',
      autoplay: cfg.autoplay ?? true,
      mute: cfg.mute ?? true,
    },
  };
}
