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
import { rateLimit } from '../util/rate-limit';

const router: Router = Router();

router.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'cartelera-backend', time: new Date().toISOString() });
});

const apiLimiter = rateLimit({ capacity: 240, refillPerSec: 4 });
const loginLimiter = rateLimit({ capacity: 5, refillPerSec: 1 / 12 });
const pairLimiter = rateLimit({ capacity: 10, refillPerSec: 1 / 6 });

router.use(apiLimiter);
router.use('/auth/login', loginLimiter);
router.use('/player/pair', pairLimiter);

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
