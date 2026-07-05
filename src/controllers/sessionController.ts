import { Request, Response } from 'express';
import { ChatAgentService } from '../services/chatAgent';

export class SessionController {
  private chatAgent: ChatAgentService;

  constructor(chatAgent: ChatAgentService) {
    this.chatAgent = chatAgent;
  }

  createSession(req: Request, res: Response): void {
    try {
      const { userId } = req.body;
      const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Sessions are now created automatically when first used in ChatAgentService
      res.json({
        sessionId,
        message: 'Chat session ID generated successfully'
      });
    } catch (error) {
      console.error('Error creating session:', error);
      res.status(500).json({ error: 'Failed to create chat session' });
    }
  }

  async getSession(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;
      const summary = await this.chatAgent.getSessionSummary(sessionId);
      
      if (summary === null) {
        res.status(404).json({ error: 'Session not found or empty' });
        return;
      }
      
      res.json({
        sessionId,
        summary,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('Error getting session:', error);
      res.status(500).json({ error: 'Failed to get session' });
    }
  }

  deleteSession(req: Request, res: Response): void {
    try {
      const { sessionId } = req.params;
      const deleted = this.chatAgent.clearSession(sessionId);
      
      if (!deleted) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }
      
      res.json({ message: 'Session deleted successfully' });
    } catch (error) {
      console.error('Error deleting session:', error);
      res.status(500).json({ error: 'Failed to delete session' });
    }
  }

  getUserSessions(req: Request, res: Response): void {
    try {
      const { userId } = req.params;
      
      // With LangChain memory, we don't track user sessions the same way
      // This would need to be implemented differently if user session tracking is needed
      res.json({
        message: 'User session tracking not available with LangChain memory system',
        totalActiveSessions: this.chatAgent.getSessionCount(),
        userId
      });
    } catch (error) {
      console.error('Error getting user sessions:', error);
      res.status(500).json({ error: 'Failed to get user sessions' });
    }
  }

  getStats(req: Request, res: Response): void {
    try {
      const stats = {
        totalSessions: this.chatAgent.getSessionCount(),
        activeSessions: this.chatAgent.getSessionCount(),
        memoryType: 'ConversationSummaryBufferMemory'
      };
      res.json(stats);
    } catch (error) {
      console.error('Error getting stats:', error);
      res.status(500).json({ error: 'Failed to get statistics' });
    }
  }
}