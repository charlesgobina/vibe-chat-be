import { PersonalityMode } from '../types';

export interface ChatLogData {
  sessionId?: string;
  userId?: string;
  requestId: string;
  personality: PersonalityMode;
  mood: number;
  userMessage: string;
  agentResponse?: string;
  responseTime?: number;
  confidence?: number;
  toolsUsed?: string[];
  error?: string;
  timestamp: Date;
  streaming?: boolean;
  conversationLength?: number;
}

export class Logger {
  private static formatTimestamp(date: Date): string {
    return date.toISOString();
  }

  private static generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  static logChatRequest(data: Partial<ChatLogData>): string {
    const requestId = this.generateRequestId();
    const logEntry = {
      level: 'INFO',
      type: 'CHAT_REQUEST',
      requestId,
      timestamp: this.formatTimestamp(new Date()),
      sessionId: data.sessionId,
      userId: data.userId,
      personality: data.personality,
      mood: data.mood,
      messageLength: data.userMessage?.length || 0,
      conversationLength: data.conversationLength || 0,
      streaming: data.streaming || false,
      userMessage: data.userMessage ? this.sanitizeMessage(data.userMessage) : undefined
    };

    console.log('🔵 [CHAT_REQUEST]', JSON.stringify(logEntry, null, 2));
    return requestId;
  }

  static logChatResponse(requestId: string, data: Partial<ChatLogData>): void {
    const logEntry = {
      level: 'INFO',
      type: 'CHAT_RESPONSE',
      requestId,
      timestamp: this.formatTimestamp(new Date()),
      sessionId: data.sessionId,
      personality: data.personality,
      responseTime: data.responseTime,
      confidence: data.confidence,
      responseLength: data.agentResponse?.length || 0,
      toolsUsed: data.toolsUsed || [],
      streaming: data.streaming || false,
      agentResponse: data.agentResponse ? this.sanitizeMessage(data.agentResponse) : undefined
    };

    console.log('🟢 [CHAT_RESPONSE]', JSON.stringify(logEntry, null, 2));
  }

  static logChatError(requestId: string, error: Error, data: Partial<ChatLogData>): void {
    const logEntry = {
      level: 'ERROR',
      type: 'CHAT_ERROR',
      requestId,
      timestamp: this.formatTimestamp(new Date()),
      sessionId: data.sessionId,
      userId: data.userId,
      personality: data.personality,
      mood: data.mood,
      error: {
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        name: error.name
      },
      context: {
        messageLength: data.userMessage?.length || 0,
        conversationLength: data.conversationLength || 0,
        streaming: data.streaming || false
      }
    };

    console.error('🔴 [CHAT_ERROR]', JSON.stringify(logEntry, null, 2));
  }

  static logStreamingStart(requestId: string, data: Partial<ChatLogData>): void {
    const logEntry = {
      level: 'INFO',
      type: 'STREAMING_START',
      requestId,
      timestamp: this.formatTimestamp(new Date()),
      sessionId: data.sessionId,
      personality: data.personality,
      mood: data.mood
    };

    console.log('🟡 [STREAMING_START]', JSON.stringify(logEntry, null, 2));
  }

  static logStreamingChunk(requestId: string, chunkSize: number, totalSize: number): void {
    const logEntry = {
      level: 'DEBUG',
      type: 'STREAMING_CHUNK',
      requestId,
      timestamp: this.formatTimestamp(new Date()),
      chunkSize,
      totalSize
    };

    if (process.env.NODE_ENV === 'development') {
      console.log('📝 [STREAMING_CHUNK]', JSON.stringify(logEntry, null, 2));
    }
  }

  static logStreamingEnd(requestId: string, data: Partial<ChatLogData>): void {
    const logEntry = {
      level: 'INFO',
      type: 'STREAMING_END',
      requestId,
      timestamp: this.formatTimestamp(new Date()),
      sessionId: data.sessionId,
      responseTime: data.responseTime,
      responseLength: data.agentResponse?.length || 0,
      confidence: data.confidence
    };

    console.log('🟢 [STREAMING_END]', JSON.stringify(logEntry, null, 2));
  }

  static logAgentThinking(requestId: string, step: string, details?: any): void {
    const logEntry = {
      level: 'DEBUG',
      type: 'AGENT_THINKING',
      requestId,
      timestamp: this.formatTimestamp(new Date()),
      step,
      details
    };

    if (process.env.NODE_ENV === 'development') {
      console.log('🧠 [AGENT_THINKING]', JSON.stringify(logEntry, null, 2));
    }
  }

  static logToolUsage(requestId: string, toolName: string, input: string, output: string): void {
    const logEntry = {
      level: 'INFO',
      type: 'TOOL_USAGE',
      requestId,
      timestamp: this.formatTimestamp(new Date()),
      toolName,
      input: this.sanitizeMessage(input),
      output: this.sanitizeMessage(output),
      inputLength: input.length,
      outputLength: output.length
    };

    console.log('🔧 [TOOL_USAGE]', JSON.stringify(logEntry, null, 2));
  }

  static logSessionEvent(eventType: 'CREATE' | 'DELETE' | 'CLEANUP', sessionId: string, details?: any): void {
    const logEntry = {
      level: 'INFO',
      type: 'SESSION_EVENT',
      timestamp: this.formatTimestamp(new Date()),
      eventType,
      sessionId,
      details
    };

    console.log('📂 [SESSION_EVENT]', JSON.stringify(logEntry, null, 2));
  }

  static logPerformanceMetrics(requestId: string, metrics: {
    processingTime: number;
    memoryUsage?: number;
    agentResponseTime?: number;
    streamingTime?: number;
  }): void {
    const logEntry = {
      level: 'INFO',
      type: 'PERFORMANCE',
      requestId,
      timestamp: this.formatTimestamp(new Date()),
      metrics
    };

    console.log('⚡ [PERFORMANCE]', JSON.stringify(logEntry, null, 2));
  }

  private static sanitizeMessage(message: string, maxLength: number = 500): string {
    if (message.length <= maxLength) {
      return message;
    }
    return message.substring(0, maxLength) + '...[truncated]';
  }

  static info(message: string, data?: any): void {
    const logEntry = {
      level: 'INFO',
      timestamp: this.formatTimestamp(new Date()),
      message,
      data
    };
    console.log('ℹ️ [INFO]', JSON.stringify(logEntry, null, 2));
  }

  static warn(message: string, data?: any): void {
    const logEntry = {
      level: 'WARN',
      timestamp: this.formatTimestamp(new Date()),
      message,
      data
    };
    console.warn('⚠️ [WARN]', JSON.stringify(logEntry, null, 2));
  }

  static error(message: string, error?: Error, data?: any): void {
    const logEntry = {
      level: 'ERROR',
      timestamp: this.formatTimestamp(new Date()),
      message,
      error: error ? {
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        name: error.name
      } : undefined,
      data
    };
    console.error('❌ [ERROR]', JSON.stringify(logEntry, null, 2));
  }

  static debug(message: string, data?: any): void {
    if (process.env.NODE_ENV === 'development') {
      const logEntry = {
        level: 'DEBUG',
        timestamp: this.formatTimestamp(new Date()),
        message,
        data
      };
      console.log('🐛 [DEBUG]', JSON.stringify(logEntry, null, 2));
    }
  }
}