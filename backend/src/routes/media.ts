import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { nanoid } from 'nanoid';
import { getDb } from '../db';
import { config } from '../config';
import { authRequired, roleRequired } from '../auth/middleware';
import { parseBody, idParamSchema } from '../util/validators';
import { NotFound, BadRequest, HttpError, UnsupportedMediaType } from '../util/errors';
import { logAudit } from '../util/audit';

const router: Router = Router();

if (!fs.existsSync(config.uploads.dir)) fs.mkdirSync(config.uploads.dir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, config.uploads.dir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}_${nanoid(8)}${ext}`);
  },
});

const ALLOWED_MIME = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'video/mp4', 'video/webm',
  'audio/mpeg', 'audio/ogg',
];

const upload = multer({
  storage,
  limits: { fileSize: config.uploads.maxBytes },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME.includes(file.mimetype)) {
      return cb(new Error(`Unsupported mime: ${file.mimetype}`));
    }
    cb(null, true);
  },
});

function uploadSingleFile(req: Request, res: Response, next: NextFunction) {
  upload.single('file')(req, res, err => {
    if (!err) return next();
    if (err instanceof HttpError) return next(err);
    return next(BadRequest(err instanceof Error ? err.message : String(err)));
  });
}

function typeFromMime(mime: string): 'image' | 'video' | 'audio' {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  throw BadRequest(`Unsupported mime: ${mime}`);
}

// Public endpoint: players store media by id in layout definitions, while the
// canonical file URL uses an opaque filename. Resolve the id here without
// exposing write/delete operations.
router.get('/:id/file', (req, res, next) => {
  try {
    const { id } = parseBody(idParamSchema, req.params);
    const db = getDb();
    const media = db.prepare('SELECT filename, mime_type FROM media WHERE id = ?')
      .get(id) as { filename: string; mime_type: string } | undefined;
    if (!media) throw NotFound();
    if (media.mime_type === 'text/html' || media.mime_type === 'image/svg+xml') {
      throw UnsupportedMediaType();
    }

    if (media.filename.includes('..') || media.filename.includes('/') || media.filename.includes('\\')) {
      throw NotFound();
    }

    const abs = path.join(config.uploads.dir, media.filename);
    if (!fs.existsSync(abs)) throw NotFound();
    res.setHeader('Content-Type', media.mime_type);
    res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
    fs.createReadStream(abs).pipe(res);
  } catch (err) { next(err); }
});

router.use(authRequired);

router.get('/', (_req, res, next) => {
  try {
    const db = getDb();
    const media = db.prepare('SELECT * FROM media ORDER BY created_at DESC LIMIT 500').all();
    res.json({ media });
  } catch (err) { next(err); }
});

router.post('/upload',
  roleRequired('admin', 'comunicaciones', 'rrhh', 'produccion', 'seguridad'),
  uploadSingleFile,
  (req, res, next) => {
    try {
      if (!req.file) throw BadRequest('No file received');
      const db = getDb();
      const info = db.prepare(`
        INSERT INTO media (type, filename, original_name, mime_type, size_bytes, uploaded_by)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        typeFromMime(req.file.mimetype),
        req.file.filename,
        req.file.originalname,
        req.file.mimetype,
        req.file.size,
        req.user!.sub,
      );
      logAudit(req, 'media.upload', 'media', Number(info.lastInsertRowid), {
        original_name: req.file.originalname,
        size: req.file.size,
      });
      res.status(201).json({
        id: info.lastInsertRowid,
        filename: req.file.filename,
        url: `/media/file/${req.file.filename}`,
      });
    } catch (err) { next(err); }
  }
);

router.delete('/:id', roleRequired('admin', 'comunicaciones'), (req, res, next) => {
  try {
    const { id } = parseBody(idParamSchema, req.params);
    const db = getDb();
    const media = db.prepare('SELECT filename FROM media WHERE id = ?').get(id) as { filename: string } | undefined;
    if (!media) throw NotFound();
    db.prepare('DELETE FROM media WHERE id = ?').run(id);
    const filePath = path.join(config.uploads.dir, media.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    logAudit(req, 'media.delete', 'media', id);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

export default router;
