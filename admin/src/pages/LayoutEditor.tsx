import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, User, Widget, Media } from '../lib/api';
import PageHeader from '../components/PageHeader';

interface RegionItem {
  type: 'media' | 'widget' | 'text';
  mediaId?: number;
  widgetId?: number;
  text?: string;
  durationMs: number;
}
interface Region {
  id: string;
  name?: string;
  x: number; y: number; w: number; h: number;
  items: RegionItem[];
  loop?: boolean;
  transition?: 'none' | 'fade' | 'slide';
}
interface LayoutDef {
  regions: Region[];
}

export default function LayoutEditor({ user }: { user: User }) {
  const { id } = useParams<{ id: string }>();
  const [layout, setLayout] = useState<any | null>(null);
  const [def, setDef] = useState<LayoutDef>({ regions: [] });
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [media, setMedia] = useState<Media[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const canWrite = ['admin', 'comunicaciones', 'rrhh', 'produccion', 'seguridad'].includes(user.role);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      api.getLayout(Number(id)),
      api.listWidgets(),
      api.listMedia(),
    ]).then(([l, w, m]) => {
      setLayout(l.layout);
      setDef(l.layout.definition || { regions: [] });
      setWidgets(w.widgets);
      setMedia(m.media);
    });
  }, [id]);

  if (!layout) return <div>Cargando...</div>;

  const save = async () => {
    await api.updateLayout(layout.id, { definition: def as any });
    setSavedMsg('Guardado ✓');
    setTimeout(() => setSavedMsg(null), 2000);
  };

  const publish = async () => {
    await api.updateLayout(layout.id, { published: true });
    setLayout({ ...layout, published: 1 });
  };

  const addRegion = () => {
    const newR: Region = {
      id: `region_${Date.now()}`,
      name: 'Nueva región',
      x: 0, y: 0, w: 400, h: 300,
      items: [{ type: 'text', text: 'Región vacía', durationMs: 10000 }],
      loop: true,
      transition: 'fade',
    };
    setDef({ regions: [...def.regions, newR] });
    setSelected(def.regions.length);
  };

  const updateRegion = (idx: number, r: Region) => {
    const regions = [...def.regions];
    regions[idx] = r;
    setDef({ regions });
  };

  const removeRegion = (idx: number) => {
    if (!confirm('¿Eliminar región?')) return;
    const regions = def.regions.filter((_, i) => i !== idx);
    setDef({ regions });
    setSelected(null);
  };

  // Preview scale
  const scale = Math.min(700 / layout.width, 450 / layout.height);

  return (
    <>
      <PageHeader title={`Layout: ${layout.name}`}
        subtitle={`${layout.width} × ${layout.height} — ${layout.regions?.length ?? def.regions.length} regiones`}
        actions={<>
          <Link to="/layouts" className="btn-secondary">← Volver</Link>
          {canWrite && <>
            {savedMsg && <span className="text-green-600 text-sm">{savedMsg}</span>}
            {!layout.published && <button onClick={publish} className="btn-secondary">Publicar</button>}
            <button onClick={save} className="btn-primary">💾 Guardar</button>
          </>}
        </>} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Canvas preview */}
        <div className="card lg:col-span-2">
          <div className="mb-3 flex justify-between items-center">
            <h3 className="font-semibold">Vista previa</h3>
            {canWrite && <button onClick={addRegion} className="btn-secondary text-sm">+ Región</button>}
          </div>
          <div className="relative mx-auto bg-slate-900 overflow-hidden rounded"
               style={{ width: layout.width * scale, height: layout.height * scale }}>
            {def.regions.map((r, i) => (
              <div key={r.id} onClick={() => setSelected(i)}
                   className={`absolute border-2 ${selected === i ? 'border-brand-500 z-10' : 'border-white/30'} hover:border-white/60 transition-colors cursor-pointer`}
                   style={{ left: r.x * scale, top: r.y * scale, width: r.w * scale, height: r.h * scale, background: 'rgba(59,130,246,0.15)' }}>
                <div className="text-white text-xs p-1 truncate">{r.name || r.id}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Properties panel */}
        <div className="card">
          {selected !== null && def.regions[selected] ? (
            <RegionEditor
              region={def.regions[selected]}
              layoutW={layout.width}
              layoutH={layout.height}
              widgets={widgets}
              media={media}
              onChange={r => updateRegion(selected, r)}
              onRemove={() => removeRegion(selected)}
              canWrite={canWrite}
            />
          ) : (
            <div className="text-slate-500 text-sm">Click en una región para editar.</div>
          )}
        </div>
      </div>
    </>
  );
}

function RegionEditor({ region, layoutW, layoutH, widgets, media, onChange, onRemove, canWrite }: {
  region: Region; layoutW: number; layoutH: number;
  widgets: Widget[]; media: Media[];
  onChange: (r: Region) => void;
  onRemove: () => void;
  canWrite: boolean;
}) {
  const update = (patch: Partial<Region>) => onChange({ ...region, ...patch });

  const addItem = (type: RegionItem['type']) => {
    const item: RegionItem =
      type === 'text'   ? { type: 'text', text: 'Nuevo texto', durationMs: 8000 } :
      type === 'media'  ? { type: 'media', mediaId: media[0]?.id ?? 0, durationMs: 8000 } :
                           { type: 'widget', widgetId: widgets[0]?.id ?? 0, durationMs: 12000 };
    update({ items: [...region.items, item] });
  };

  const updateItem = (i: number, item: RegionItem) => {
    const items = [...region.items];
    items[i] = item;
    update({ items });
  };

  const removeItem = (i: number) => update({ items: region.items.filter((_, idx) => idx !== i) });

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">Región: {region.id}</h3>
        {canWrite && <button onClick={onRemove} className="btn-ghost text-red-600 text-xs">Eliminar</button>}
      </div>

      <div>
        <label className="label">Nombre</label>
        <input className="input" value={region.name ?? ''} onChange={e => update({ name: e.target.value })} disabled={!canWrite} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div><label className="label">X</label><input type="number" className="input" value={region.x} onChange={e => update({ x: Number(e.target.value) })} disabled={!canWrite} /></div>
        <div><label className="label">Y</label><input type="number" className="input" value={region.y} onChange={e => update({ y: Number(e.target.value) })} disabled={!canWrite} /></div>
        <div><label className="label">Ancho</label><input type="number" className="input" value={region.w} max={layoutW} onChange={e => update({ w: Number(e.target.value) })} disabled={!canWrite} /></div>
        <div><label className="label">Alto</label><input type="number" className="input" value={region.h} max={layoutH} onChange={e => update({ h: Number(e.target.value) })} disabled={!canWrite} /></div>
      </div>

      <div>
        <label className="label">Transición</label>
        <select className="input" value={region.transition ?? 'fade'} onChange={e => update({ transition: e.target.value as any })} disabled={!canWrite}>
          <option value="none">Sin transición</option>
          <option value="fade">Fade</option>
          <option value="slide">Slide</option>
        </select>
      </div>

      <div>
        <div className="flex justify-between items-center mb-2">
          <label className="label mb-0">Items ({region.items.length})</label>
          {canWrite && <div className="flex gap-1">
            <button onClick={() => addItem('widget')} className="btn-ghost text-xs">+ Widget</button>
            <button onClick={() => addItem('media')} className="btn-ghost text-xs">+ Media</button>
            <button onClick={() => addItem('text')} className="btn-ghost text-xs">+ Texto</button>
          </div>}
        </div>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {region.items.map((item, i) => (
            <div key={i} className="p-2 border border-slate-200 rounded-lg">
              <div className="flex justify-between mb-1"><span className="text-xs font-medium">#{i + 1} · {item.type}</span>
                {canWrite && <button onClick={() => removeItem(i)} className="text-xs text-red-600">✕</button>}
              </div>
              {item.type === 'text' && (
                <textarea className="input text-sm" rows={2} value={item.text ?? ''} onChange={e => updateItem(i, { ...item, text: e.target.value })} disabled={!canWrite} />
              )}
              {item.type === 'widget' && (
                <select className="input text-sm" value={item.widgetId ?? ''} onChange={e => updateItem(i, { ...item, widgetId: Number(e.target.value) })} disabled={!canWrite}>
                  {widgets.map(w => <option key={w.id} value={w.id}>{w.type} · {w.name}</option>)}
                </select>
              )}
              {item.type === 'media' && (
                <select className="input text-sm" value={item.mediaId ?? ''} onChange={e => updateItem(i, { ...item, mediaId: Number(e.target.value) })} disabled={!canWrite}>
                  {media.map(m => <option key={m.id} value={m.id}>{m.type} · {m.original_name ?? m.filename}</option>)}
                </select>
              )}
              <div className="mt-1">
                <label className="text-xs text-slate-500">Duración (ms)</label>
                <input type="number" min={500} step={500} className="input text-sm" value={item.durationMs} onChange={e => updateItem(i, { ...item, durationMs: Number(e.target.value) })} disabled={!canWrite} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
