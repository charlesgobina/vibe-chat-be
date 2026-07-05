import { Router } from 'express';
import { ChatController } from '../controllers/chatController';
import { SessionController } from '../controllers/sessionController';
import { PersonalityController } from '../controllers/personalityController';

const router = Router();

const chatController = new ChatController();
const sessionController = new SessionController(chatController.getChatAgent());
const personalityController = new PersonalityController();

// Chat routes
router.post('/agent/chat', (req, res) => chatController.processChat(req, res));

// Session routes
router.post('/agent/session', (req, res) => sessionController.createSession(req, res));
router.get('/agent/session/:sessionId', (req, res) => sessionController.getSession(req, res));
router.delete('/agent/session/:sessionId', (req, res) => sessionController.deleteSession(req, res));
router.get('/agent/user/:userId/sessions', (req, res) => sessionController.getUserSessions(req, res));
router.get('/agent/stats', (req, res) => sessionController.getStats(req, res));

// Personality routes
router.get('/agent/personality/:personality', (req, res) => personalityController.getPersonality(req, res));
router.get('/agent/personalities', (req, res) => personalityController.getAllPersonalities(req, res));


export default router;