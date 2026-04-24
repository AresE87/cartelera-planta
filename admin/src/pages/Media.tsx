import { useEffect, useRef, useState } from 'react';
import { api, Media as MediaItem, User } from '../lib/api';
import PageHeader from '../components/PageHeader';

export default function Media({ user }: { user: User }) {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const canWrite = ['admin', 'comunicaciones', 'rrhh', 'produccion', 'seguridad'].includes(user.role);

  const load = () => api.listMedia().then(r => setMedia(r.media));
  useEffect(() => { load(); }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setUploading(true);
    try {
      for (const f of files) {
        await api.uploadMedia(f);
      }
      load();
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <>
      <PageHeader title="Media" subtitle="Imágenes, videos y HTML para usar en layouts"
        actions={canWrite && (
          <label className="btn-primary cursor-pointer">
            {uploading ? 'Subiendo...' : '+ Subir archivo(s)'}
            <input ref={fileRef} type="file" multiple className="hidden" onChange={handleUpload}
              accept="image/*,video/mp4,video/webm,audio/*,text/html" />
          </label>
        )} />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {media.map(m => (
          <div key={m.id} className="card p-2">
            {m.type === 'image' && <img src={`/media/file/${m.filename}`} className="w-full h-32 object-cover rounded-md mb-2" alt={m.original_name ?? ''} />}
            {m.type === 'video' && <video src={`/media/file/${m.filename}`} className="w-full h-32 object-cover rounded-md mb-2" muted />}
            {m.type === 'audio' && <div className="h-32 flex items-center justify-center text-5xl bg-slate-100 rounded-md mb-2">🎵</div>}
            {m.type === 'html'  && <div className="h-32 flex items-center justify-center text-5xl bg-slate-100 rounded-md mb-2">📄</div>}
            <div className="text-xs font-medium truncate" title={m.original_name ?? ''}>{m.original_name ?? m.filename}</div>
            <div className="text-xs text-slate-500 flex justify-between items-center mt-1">
              <span>{formatBytes(m.size_bytes)}</span>
              <span className="badge bg-slate-100 text-slate-600">{m.type}</span>
            </div>
            <div className="flex justify-between mt-2">
              <button onClick={() => navigator.clipboard.writeText(`/media/file/${m.filename}`)} className="btn-ghost text-xs">Copiar URL</button>
              {canWrite && <button onClick={() => confirm('¿Borrar?') && api.deleteMedia(m.id).then(load)} className="btn-ghost text-xs text-red-600">Borrar</button>}
            </div>
          </div>
        ))}
        {media.length === 0 && <p className="col-span-full text-slate-500 text-center py-12">Sin archivos subidos.</p>}
      </div>
    </>
  );
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}
