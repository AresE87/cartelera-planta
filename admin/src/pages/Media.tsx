import { useEffect, useRef, useState } from 'react';
import { api, Media as MediaItem, User } from '../lib/api';
import PageHeader from '../components/PageHeader';

const ACCEPT = 'image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,audio/mpeg,audio/ogg';

export default function Media({ user }: { user: User }) {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const canWrite = ['admin', 'comunicaciones', 'rrhh', 'produccion', 'seguridad'].includes(user.role);

  const load = () => api.listMedia().then(r => setMedia(r.media));
  useEffect(() => { load(); }, []);

  const handleFiles = async (files: File[]) => {
    if (files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      for (const f of files) await api.uploadMedia(f);
      await load();
    } catch (err: any) {
      setError(err.message || 'No se pudo subir el archivo');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(Array.from(e.target.files ?? []));
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!canWrite) return;
    handleFiles(Array.from(e.dataTransfer.files ?? []));
  };

  return (
    <>
      <PageHeader
        title="Media"
        subtitle="Imagenes, videos y audio disponibles para layouts"
        actions={canWrite && (
          <label className="btn-primary cursor-pointer">
            {uploading ? 'Subiendo...' : 'Subir archivos'}
            <input ref={fileRef} type="file" multiple className="hidden" onChange={handleUpload} accept={ACCEPT} />
          </label>
        )}
      />

      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {canWrite && (
        <div
          onDragOver={e => e.preventDefault()}
          onDrop={onDrop}
          className="mb-6 rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center hover:border-brand-400"
        >
          <div className="font-semibold text-slate-900">Soltar archivos aca</div>
          <div className="mt-1 text-sm text-slate-500">JPG, PNG, GIF, WebP, MP4, WebM, MP3 u OGG.</div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        {media.map(m => (
          <div key={m.id} className="card p-3">
            <Preview item={m} />
            <div className="mt-3 min-w-0">
              <div className="truncate text-sm font-medium" title={m.original_name ?? m.filename}>{m.original_name ?? m.filename}</div>
              <div className="mt-1 flex items-center justify-between gap-2 text-xs text-slate-500">
                <span>{formatBytes(m.size_bytes)}</span>
                <span className="badge bg-slate-100 text-slate-600">{m.type}</span>
              </div>
            </div>
            <div className="mt-3 flex justify-between gap-2">
              <button onClick={() => navigator.clipboard?.writeText(`/api/media/${m.id}/file`)} className="btn-ghost text-xs">Copiar URL</button>
              {canWrite && <button onClick={() => confirm('Borrar archivo?') && api.deleteMedia(m.id).then(load)} className="btn-ghost text-xs text-red-600">Borrar</button>}
            </div>
          </div>
        ))}
        {media.length === 0 && (
          <div className="col-span-full rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center">
            <div className="text-lg font-semibold text-slate-900">No hay media cargada</div>
            {canWrite && <label className="btn-primary mt-4 cursor-pointer">
              Subir primer archivo
              <input ref={fileRef} type="file" multiple className="hidden" onChange={handleUpload} accept={ACCEPT} />
            </label>}
          </div>
        )}
      </div>
    </>
  );
}

function Preview({ item }: { item: MediaItem }) {
  const src = `/api/media/${item.id}/file`;
  if (item.type === 'image') return <img src={src} className="h-32 w-full rounded-md object-cover bg-slate-100" alt={item.original_name ?? ''} />;
  if (item.type === 'video') return <video src={src} className="h-32 w-full rounded-md object-cover bg-slate-900" muted />;
  if (item.type === 'audio') return <div className="grid h-32 place-items-center rounded-md bg-slate-100 text-3xl font-semibold text-slate-500">AUDIO</div>;
  return <div className="grid h-32 place-items-center rounded-md bg-amber-50 text-sm font-medium text-amber-800">No servible</div>;
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}
