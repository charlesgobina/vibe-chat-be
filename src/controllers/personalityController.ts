import { Request, Response } from 'express';
import { PERSONALITY_CONFIGS } from '../services/personalities';

export class PersonalityController {
  getPersonality(req: Request, res: Response): void {
    try {
      const { personality } = req.params;
      const config = PERSONALITY_CONFIGS[personality as keyof typeof PERSONALITY_CONFIGS];
      
      if (!config) {
        res.status(404).json({ error: 'Personality not found' });
        return;
      }
      
      res.json(config);
    } catch (error) {
      console.error('Error getting personality:', error);
      res.status(500).json({ error: 'Failed to get personality information' });
    }
  }

  getAllPersonalities(req: Request, res: Response): void {
    try {
      const personalities = Object.entries(PERSONALITY_CONFIGS).map(([key, config]) => ({
        id: key,
        ...config
      }));
      
      res.json(personalities);
    } catch (error) {
      console.error('Error getting personalities:', error);
      res.status(500).json({ error: 'Failed to get personalities' });
    }
  }
}