import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, User } from '../lib/api';
import PageHeader from '../components/PageHeader';

export default function WidgetEditor({ user }: { user: User }) {
  const { id } = useParams<{ id: string }>();
  const [widget, setWidget] = useState<any | null>(null);
  const [configText, setConfigText] = useState<string>('');
  const [name, setName] = useState('');
  const [refreshSeconds, setRefreshSeconds] = useState(300);
  const [dataSourceUrl, setDataSourceUrl] = useState('');
  const [preview, setPreview] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const canWrite = ['admin', 'comunicaciones', 'rrhh', 'produccion', 'seguridad'].includes(user.role);

  useEffect(() => {
    if (!id) return;
    api.getWidget(Number(id)).then(r => {
      setWidget(r.widget);
      setConfigText(JSON.stringify(r.widget.config ?? {}, null, 2));
      setName(r.widget.name);
      setRefreshSeconds(r.widget.refresh_seconds);
      setDataSourceUrl(r.widget.data_source_url ?? '');
    });
    api.getWidgetData(Number(id)).then(setPreview).catch(() => {});
  }, [id]);

  const save = async () => {
    if (!widget) return;
    try {
      const config = JSON.parse(configText);
      await api.updateWidget(widget.id, {
        name, refresh_seconds: refreshSeconds, config,
        data_source_url: dataSourceUrl || null,
      });
      setError(null);
      setSavedMsg('Guardado ✓');
      setTimeout(() => setSavedMsg(null), 2000);
      api.refreshWidget(widget.id).then(setPreview).catch(() => {});
    } catch (err: any) {
      setError(err.message || 'JSON inválido');
    }
  };

  const refresh = async () => {
    if (!widget) return;
    const p = await api.refreshWidget(widget.id);
    setPreview(p);
  };

  if (!widget) return <div>Cargando...</div>;

  return (
    <>
      <PageHeader title={`Widget: ${widget.name}`} subtitle={`Tipo: ${widget.type}`}
        actions={<>
          <Link to="/widgets" className="btn-secondary">← Volver</Link>
          {canWrite && <>
            {savedMsg && <span className="text-green-600 text-sm">{savedMsg}</span>}
            <button onClick={refresh} className="btn-secondary">⟳ Refresh data</button>
            <button onClick={save} className="btn-primary">💾 Guardar</button>
          </>}
        </>} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Editor */}
        <div className="card">
          <h3 className="font-semibold mb-4">Configuración</h3>
          <div className="space-y-4">
            <div><label className="label">Nombre</label><input className="input" value={name} onChange={e => setName(e.target.value)} disabled={!canWrite} /></div>
            <div><label className="label">URL externa (opcional)</label><input className="input" value={dataSourceUrl} onChange={e => setDataSourceUrl(e.target.value)} placeholder="https://..." disabled={!canWrite} /></div>
            <div><label className="label">Refresh cada (segundos)</label><input type="number" min={10} max={86400} className="input" value={refreshSeconds} onChange={e => setRefreshSeconds(Number(e.target.value))} disabled={!canWrite} /></div>
            <div>
              <label className="label">Config (JSON)</label>
              <textarea className="input font-mono text-xs" rows={20} value={configText} onChange={e => setConfigText(e.target.value)} spellCheck={false} disabled={!canWrite} />
              {error && <div className="text-xs text-red-600 mt-1">{error}</div>}
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="card">
          <h3 className="font-semibold mb-4">Preview / Datos actuales</h3>
          {preview ? (
            <div className="space-y-3">
              <div className="text-xs text-slate-500">
                Generado: {new Date(preview.generatedAt).toLocaleString('es-AR')} · TTL {preview.ttlSeconds}s
              </div>
              <pre className="bg-slate-900 text-green-300 p-3 rounded text-xs overflow-auto max-h-96 font-mono">{JSON.stringify(preview.data, null, 2)}</pre>
            </div>
          ) : (
            <div className="text-slate-500 text-sm">Sin data aún — click en "Refresh data"</div>
          )}
        </div>
      </div>
    </>
  );
}
