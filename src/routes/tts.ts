import { Router } from 'express';
import { ttsController } from '../controllers/ttsController';

const router = Router();

router.post('/tts/rhubarb', (req, res) => ttsController.analyzeRhubarb(req, res));

export default router;
