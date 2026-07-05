import { ConversationMessage, ChatSession } from '../types';

export class ConversationHistoryService {
  private sessions: Map<string, ChatSession> = new Map();
  private readonly MAX_HISTORY_LENGTH = 20;
  private readonly SESSION_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours

  constructor() {
    this.startCleanupTimer();
  }

  createSession(userId?: string): string {
    const sessionId = this.generateSessionId();
    const session: ChatSession = {
      id: sessionId,
      userId,
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    this.sessions.set(sessionId, session);
    return sessionId;
  }

  addMessage(sessionId: string, message: ConversationMessage): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    session.messages.push({
      ...message,
      timestamp: new Date()
    });

    if (session.messages.length > this.MAX_HISTORY_LENGTH) {
      session.messages = session.messages.slice(-this.MAX_HISTORY_LENGTH);
    }

    session.updatedAt = new Date();
    this.sessions.set(sessionId, session);
  }

  addMessageSafe(sessionId: string | undefined, message: ConversationMessage): boolean {
    if (!sessionId) {
      return false;
    }
    
    try {
      this.addMessage(sessionId, message);
      return true;
    } catch (error) {
      console.warn(`Failed to add message to session ${sessionId}:`, error);
      return false;
    }
  }

  getHistory(sessionId: string): ConversationMessage[] {
    const session = this.sessions.get(sessionId);
    return session ? session.messages : [];
  }

  getSession(sessionId: string): ChatSession | undefined {
    return this.sessions.get(sessionId);
  }

  deleteSession(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  getUserSessions(userId: string): ChatSession[] {
    return Array.from(this.sessions.values())
      .filter(session => session.userId === userId)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private startCleanupTimer(): void {
    setInterval(() => {
      const now = Date.now();
      const sessionsToDelete: string[] = [];

      for (const [sessionId, session] of this.sessions.entries()) {
        if (now - session.updatedAt.getTime() > this.SESSION_TIMEOUT) {
          sessionsToDelete.push(sessionId);
        }
      }

      sessionsToDelete.forEach(sessionId => {
        this.sessions.delete(sessionId);
        console.log(`Cleaned up expired session: ${sessionId}`);
      });

      if (sessionsToDelete.length > 0) {
        console.log(`Cleaned up ${sessionsToDelete.length} expired sessions`);
      }
    }, 60 * 60 * 1000); // Run every hour
  }

  getStats(): { totalSessions: number; activeSessions: number } {
    const now = Date.now();
    const activeSessions = Array.from(this.sessions.values())
      .filter(session => now - session.updatedAt.getTime() < this.SESSION_TIMEOUT)
      .length;

    return {
      totalSessions: this.sessions.size,
      activeSessions
    };
  }
}