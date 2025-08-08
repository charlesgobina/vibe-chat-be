import { Request, Response } from 'express';
import { ChatAgentService } from '../services/chatAgent';
import { AgentRequest, StreamChunk } from '../types';
import { PERSONALITY_CONFIGS } from '../services/personalities';
import { Logger } from '../utils/logger';

// export interface ConversationMessage {
//   role: 'user' | 'assistant';
//   content: string;
//   timestamp: Date;
// }

// export interface AgentRequest {
//   message: string;
//   personality: PersonalityMode;
//   mood: number;
//   userId?: string;
//   conversationHistory?: ConversationMessage[];
// }

export class ChatController {
  private chatAgent: ChatAgentService;

  constructor() {
    this.chatAgent = new ChatAgentService();
  }

  async processChat(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    let requestId: string = '';
    
    try {
      const request: AgentRequest = req.body;
      const { sessionId } = req.query;

      // Log incoming request
      requestId = Logger.logChatRequest({
        sessionId: sessionId as string,
        userId: request.userId,
        personality: request.personality,
        mood: request.mood,
        userMessage: request.message,
        streaming: req.headers.accept?.includes('text/event-stream') || false,
        conversationLength: request.conversationHistory?.length || 0
      });

      Logger.debug('Processing chat request', {
        requestId,
        hasSessionId: !!sessionId,
        requestHeaders: req.headers,
        userAgent: req.headers['user-agent']
      });

      // Validate request
      const validationError = this.validateChatRequest(request);
      if (validationError) {
        Logger.warn('Chat request validation failed', {
          requestId,
          error: validationError,
          request: {
            hasMessage: !!request.message,
            personality: request.personality,
            mood: request.mood
          }
        });
        res.status(400).json({ error: validationError });
        return;
      }

      Logger.info('Chat request validated and prepared', {
        requestId,
        personality: request.personality,
        mood: request.mood,
        messageLength: request.message.length,
        sessionId: sessionId as string || 'none'
      });

      // Check if client wants streaming response
      const acceptHeader = req.headers.accept;
      const wantsStream = acceptHeader?.includes('text/event-stream');

      // Add requestId to headers for tracking
      req.headers['x-request-id'] = requestId;

      if (wantsStream) {
        await this.handleStreamingResponse(req, res, request, sessionId as string);
      } else {
        await this.handleRegularResponse(req, res, request, sessionId as string);
      }

    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      Logger.logChatError(requestId, error as Error, {
        sessionId: req.query.sessionId as string,
        userId: req.body.userId,
        personality: req.body.personality,
        mood: req.body.mood,
        userMessage: req.body.message,
        streaming: req.headers.accept?.includes('text/event-stream') || false,
        conversationLength: req.body.conversationHistory?.length || 0
      });

      Logger.logPerformanceMetrics(requestId, {
        processingTime,
        memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024
      });
      
      if (!res.headersSent) {
        res.status(500).json({ 
          error: 'Failed to process chat message',
          details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
        });
      }
    }
  }

  private validateChatRequest(request: AgentRequest): string | null {
    if (!request.message || !request.personality || typeof request.mood !== 'number') {
      return 'Missing required fields: message, personality, mood';
    }

    if (request.mood < 0 || request.mood > 100) {
      return 'Mood must be between 0 and 100';
    }

    if (!PERSONALITY_CONFIGS[request.personality]) {
      return 'Invalid personality mode';
    }

    return null;
  }

  private async handleStreamingResponse(
    req: Request, 
    res: Response, 
    request: AgentRequest, 
    sessionId?: string
  ): Promise<void> {
    const requestId = req.headers['x-request-id'] as string || 'unknown';
    
    Logger.logStreamingStart(requestId, {
      sessionId,
      personality: request.personality,
      mood: request.mood,
      userMessage: request.message
    });

    // Set up Server-Sent Events
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // Memory is now handled automatically by the ChatAgentService

    const startTime = Date.now();
    let fullResponse = '';
    let chunkCount = 0;

    try {
      // Send start event
      const startChunk: StreamChunk = {
        type: 'start',
        metadata: {
          personality: request.personality
        }
      };
      res.write(`data: ${JSON.stringify(startChunk)}\n\n`);

      // Stream the response
      for await (const chunk of this.chatAgent.streamMessage(request, sessionId, requestId)) {
        const streamChunk: StreamChunk = {
          type: 'chunk',
          content: chunk
        };
        res.write(`data: ${JSON.stringify(streamChunk)}\n\n`);
        fullResponse += chunk;
        chunkCount++;
        
        Logger.logStreamingChunk(requestId, chunk.length, fullResponse.length);
      }

      // Memory is automatically saved by the ChatAgentService during streaming

      const responseTime = Date.now() - startTime;
      const confidence = 0.85 + Math.random() * 0.15;

      // Log streaming completion
      Logger.logStreamingEnd(requestId, {
        sessionId,
        agentResponse: fullResponse,
        responseTime,
        confidence
      });

      Logger.logPerformanceMetrics(requestId, {
        processingTime: responseTime,
        streamingTime: responseTime,
        memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024
      });

      // Send end event with metadata
      const endChunk: StreamChunk = {
        type: 'end',
        metadata: {
          personality: request.personality,
          confidence,
          responseTime
        }
      };
      res.write(`data: ${JSON.stringify(endChunk)}\n\n`);

    } catch (error) {
      Logger.error('Streaming error occurred', error as Error, {
        requestId,
        sessionId,
        personality: request.personality,
        chunkCount,
        partialResponse: fullResponse.substring(0, 200)
      });
      
      const errorChunk: StreamChunk = {
        type: 'error',
        content: 'Sorry, I encountered an error while processing your message.'
      };
      res.write(`data: ${JSON.stringify(errorChunk)}\n\n`);
    }

    res.end();
  }

  private async handleRegularResponse(
    req: Request, 
    res: Response, 
    request: AgentRequest, 
    sessionId?: string
  ): Promise<void> {
    const requestId = req.headers['x-request-id'] as string || 'unknown';
    const startTime = Date.now();
    
    Logger.debug('Processing regular (non-streaming) response', { requestId });
    
    const response = await this.chatAgent.processMessage(request, sessionId, requestId);
    const responseTime = Date.now() - startTime;

    Logger.logChatResponse(requestId, {
      sessionId,
      personality: request.personality,
      agentResponse: response.message,
      responseTime,
      confidence: response.confidence,
      streaming: false
    });

    // Memory is automatically saved by the ChatAgentService

    Logger.logPerformanceMetrics(requestId, {
      processingTime: responseTime,
      agentResponseTime: response.responseTime,
      memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024
    });

    res.json(response);
  }


  getChatAgent(): ChatAgentService {
    return this.chatAgent;
  }
}