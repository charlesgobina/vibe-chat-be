// import express from 'express';
// import { DelayedActionProcessor } from '../services/delayedActionProcessor';
// import { Logger } from '../utils/logger';

// const router = express.Router();
// let processor: DelayedActionProcessor | null = null;

// /**
//  * Initialize delayed action processor
//  * This should be called from server.ts
//  */
// export function initializeDelayedActionProcessor(delayedProcessor: DelayedActionProcessor): void {
//   processor = delayedProcessor;
// }

// /**
//  * Get processor status
//  */
// router.get('/status', (req, res) => {
//   if (!processor) {
//     return res.status(503).json({ error: 'Delayed action processor not initialized' });
//   }

//   const status = processor.getStatus();
//   res.json(status);
// });

// /**
//  * Manual trigger for testing
//  */
// router.post('/trigger', async (req, res) => {
//   if (!processor) {
//     return res.status(503).json({ error: 'Delayed action processor not initialized' });
//   }

//   try {
//     await processor.triggerManualProcess();
//     res.json({ success: true, message: 'Manual processing triggered' });
//   } catch (error) {
//     Logger.error('Manual delayed action trigger failed', error as Error);
//     res.status(500).json({ error: 'Failed to trigger processing' });
//   }
// });

// export default router;