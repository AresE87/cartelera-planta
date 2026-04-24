import { Router } from 'express';
import auth from './auth';
import users from './users';
import zones from './zones';
import displays from './displays';
import media from './media';
import layouts from './layouts';
import schedules from './schedules';
import widgets from './widgets';
import alerts from './alerts';
import player from './player';

const router: Router = Router();

router.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'cartelera-backend', time: new Date().toISOString() });
});

router.use('/auth', auth);
router.use('/users', users);
router.use('/zones', zones);
router.use('/displays', displays);
router.use('/media', media);
router.use('/layouts', layouts);
router.use('/schedules', schedules);
router.use('/widgets', widgets);
router.use('/alerts', alerts);
router.use('/player', player);

export default router;
