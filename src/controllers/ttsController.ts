import { Request, Response } from 'express';
import { analyzeWithRhubarb, RhubarbRequestPayload } from '../services/rhubarbService';
import { Logger } from '../utils/logger';

export class TtsController {
  async analyzeRhubarb(req: Request, res: Response): Promise<void> {
    const requestId = req.headers['x-request-id'] as string || 'unknown';

    try {
      const payload = req.body as RhubarbRequestPayload;

      if (!payload?.audioContent || !payload?.audioEncoding) {
        res.status(400).json({ error: 'Missing required fields: audioContent, audioEncoding' });
        return;
      }

      const result = await analyzeWithRhubarb(payload);

      res.json({
        metadata: result.metadata,
        mouthCues: result.mouthCues
      });
    } catch (error) {
      Logger.error('Rhubarb analysis failed', error as Error, {
        requestId
      });
      res.status(500).json({
        error: 'Failed to analyze audio with Rhubarb',
        details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      });
    }
  }
}

export const ttsController = new TtsController();
