import { ChatOpenAI } from '@langchain/openai';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatGroq } from '@langchain/groq';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { HumanMessage, AIMessage, BaseMessage, SystemMessage } from '@langchain/core/messages';
import { Tool } from '@langchain/core/tools';
import { AgentRequest, AgentResponse, ConversationMessage, PersonalityMode } from '../types';
import { getPersonalityPrompt } from './personalities';
import { Logger } from '../utils/logger';
import { WebSearchTool } from '../tools/webSearchTool';
import { WebOpenTool } from '../tools/webOpenTool';
import { SpotifyTool } from '../tools/spotifyTool';
// import { DelayedActionTool } from '../tools/delayedActionTool';
import dotenv from "dotenv";
dotenv.config(); 

/**
 * Main chat agent service that handles conversation processing with LLM models and tools
 */
export class ChatAgentService {
  private model!: ChatOpenAI | ChatGoogleGenerativeAI | ChatGroq;
  private agent: any;
  private tools: Tool[];
  private sessionMemories: Map<string, ConversationMessage[]> = new Map();
  
  private static readonly MAX_HISTORY_LENGTH = 20;
  private static readonly DEFAULT_CONFIDENCE = 0.85;
  private static readonly AGENT_TIMEOUT = 30000;

  constructor() {
    this.tools = [
      new SpotifyTool(),
      new WebSearchTool(),
      new WebOpenTool(),
      // new DelayedActionTool(),
      // Add other tools here as needed
    ];
    this.initializeModel();
    this.initializeAgent();
  }

  /**
   * Initialize the appropriate LLM model based on available API keys
   * Priority: OpenAI > Google > Groq
   */
  private initializeModel(): void {
    const modelConfig = { temperature: 0.8, reasoning_effort: 'high' };
    
    if (process.env.OPENAI_API_KEY) {
      this.model = new ChatOpenAI({
        modelName: 'gpt-4o-mini',
        streaming: true,
        ...modelConfig
      });
      Logger.info('Initialized OpenAI model');
    } else if (process.env.GOOGLE_API_KEY) {
      this.model = new ChatGoogleGenerativeAI({
        model: 'gemini-1.5-flash',
        ...modelConfig
      });
      Logger.info('Initialized Google Gemini model');
    } else if (process.env.GROQ_API_KEY) {
      this.model = new ChatGroq({
        // model: 'llama-3.3-70b-versatile',
        model: 'openai/gpt-oss-120b',
        // tools: [{"type":"browser_search"}],
        ...modelConfig
      });
      Logger.info('Initialized Groq model with tool calling support');
    } else {
      const error = 'No API key found. Please set OPENAI_API_KEY, GOOGLE_API_KEY, or GROQ_API_KEY in your environment variables.';
      Logger.error('Model initialization failed', new Error(error));
      throw new Error(error);
    }
  }

  /**
   * Initialize the ReAct agent with the configured model and tools
   */
  private async initializeAgent(): Promise<void> {
    try {
      const agentConfig = {
        modelType: this.model.constructor.name,
        toolsCount: this.tools.length,
        toolNames: this.tools.map(t => t.name)
      };
      
      Logger.info('Initializing ReAct agent', agentConfig);
      
      this.agent = createReactAgent({
        llm: this.model,
        tools: this.tools,
      });
      
      Logger.info('ReAct agent initialized successfully', agentConfig);
    } catch (error) {
      const errorContext = {
        modelType: this.model?.constructor?.name,
        toolsCount: this.tools?.length,
        toolNames: this.tools?.map(t => t.name)
      };
      
      Logger.error('Failed to initialize agent', error as Error, errorContext);
      throw error;
    }
  }

  /**
   * Get or create conversation memory for a session
   */
  private getOrCreateMemory(sessionId: string): ConversationMessage[] {
    if (!sessionId) {
      return [];
    }

    const memoryKey = this.getMemoryKey(sessionId);
    if (!this.sessionMemories.has(memoryKey)) {
      this.sessionMemories.set(memoryKey, []);
      Logger.debug('Created new session memory', { sessionId });
    }

    return this.sessionMemories.get(memoryKey) as ConversationMessage[];
  }
  
  /**
   * Generate consistent memory key for sessions
   */
  private getMemoryKey(sessionId: string): string {
    return `session_${sessionId}`;
  }

  /**
   * Save conversation turn to session memory with proper cleanup
   */
  private saveToMemory(sessionId: string, userMessage: string, assistantMessage: string): void {
    if (!sessionId) {
      Logger.warn('Attempted to save memory without session ID');
      return;
    }

    const memoryKey = this.getMemoryKey(sessionId);
    let messages = this.sessionMemories.get(memoryKey) || [];
    
    const timestamp = new Date();
    
    // Add user message
    const userMsg: ConversationMessage = {
      role: 'user',
      content: userMessage,
      timestamp
    };
    messages.push(userMsg);

    // Add assistant message
    const assistantMsg: ConversationMessage = {
      role: 'assistant', 
      content: assistantMessage,
      timestamp
    };
    messages.push(assistantMsg);

    // Keep only last N messages to prevent memory bloat
    if (messages.length > ChatAgentService.MAX_HISTORY_LENGTH) {
      const removedCount = messages.length - ChatAgentService.MAX_HISTORY_LENGTH;
      messages = messages.slice(-ChatAgentService.MAX_HISTORY_LENGTH);
      Logger.debug('Trimmed conversation history', { sessionId, removedCount });
    }

    this.sessionMemories.set(memoryKey, messages);
    Logger.debug('Saved conversation to memory', { 
      sessionId, 
      totalMessages: messages.length 
    });
  }

  /**
   * Convert conversation history to LangChain message format
   */
  private convertToLangChainMessages(history: ConversationMessage[]): BaseMessage[] {
    return history.map(msg => {
      if (msg.role === 'user') {
        return new HumanMessage(msg.content);
      } else if (msg.role === 'assistant') {
        return new AIMessage(msg.content);
      } else {
        Logger.warn('Unknown message role in history', { role: msg.role });
        return new HumanMessage(msg.content); // Fallback
      }
    });
  }

  /**
   * Process a user message and return an agent response
   */
  async processMessage(request: AgentRequest, sessionId?: string, requestId: string = 'unknown'): Promise<AgentResponse> {
    const startTime = Date.now();
    
    try {
      this.validateRequest(request);
      
      const conversationHistory = this.getOrCreateMemory(sessionId || '');
      
      Logger.logAgentThinking(requestId, 'processing_started', {
        personality: request.personality,
        mood: request.mood,
        messageLength: request.message.length,
        sessionId: sessionId || 'temporary',
        historyLength: conversationHistory.length,
        availableTools: this.tools.map(tool => tool.name)
      });
      
      const messages = this.buildMessageChain(request, conversationHistory, requestId);
      
      Logger.logAgentThinking(requestId, 'agent_invocation_started');
      
      let response: any;
      let method: string;
      
      if (this.tools.length === 0) {
        response = await this.processWithDirectModel(messages, requestId);
        method = 'direct_model';
      } else {
        response = await this.processWithAgent(messages, requestId, request);
        method = 'agent_invoke';
      }
      
      const finalMessage = await this.extractFinalResponse(response, request, requestId);
      const responseTime = Date.now() - startTime;
      const confidence = ChatAgentService.DEFAULT_CONFIDENCE + Math.random() * 0.15;

      // Save the conversation to memory
      this.saveToMemory(sessionId || '', request.message, finalMessage);
      
      Logger.logAgentThinking(requestId, 'response_formatted', {
        responseTime,
        confidence,
        responseLength: finalMessage.length,
        memorySaved: true,
        method
      });
      
      return {
        message: finalMessage,
        personality: request.personality,
        confidence,
        responseTime
      };

    } catch (error) {
      return this.handleProcessingError(error, request, requestId, Date.now() - startTime);
    }
  }

        
  /**
   * Validate the incoming request
   */
  private validateRequest(request: AgentRequest): void {
    if (!request.message || request.message.trim().length === 0) {
      throw new Error('Message cannot be empty');
    }
    
    if (!request.personality) {
      throw new Error('Personality mode is required');
    }
  }
  
  /**
   * Build the message chain for the LLM
   */
  private buildMessageChain(request: AgentRequest, history: ConversationMessage[], requestId: string): BaseMessage[] {
    const systemPrompt = getPersonalityPrompt(request.personality, request.mood);
    
    Logger.logAgentThinking(requestId, 'personality_prompt_generated', {
      personality: request.personality,
      mood: request.mood,
      promptLength: systemPrompt.length
    });

    const messages: BaseMessage[] = [];

    // Add system message first
    messages.push(new SystemMessage(systemPrompt));

    // Add conversation history
    if (history.length > 0) {
      messages.push(...this.convertToLangChainMessages(history));
      Logger.logAgentThinking(requestId, 'history_loaded', {
        historyMessages: history.length 
      });
    }

    // Add current user message
    messages.push(new HumanMessage(request.message));
    
    Logger.logAgentThinking(requestId, 'messages_prepared', {
      totalMessages: messages.length
    });
    
    return messages;
  }
  
  /**
   * Process message using direct model call (no tools)
   */
  private async processWithDirectModel(messages: BaseMessage[], requestId: string): Promise<any> {
    Logger.debug('Using direct model call (no tools)', { requestId });
    const directResponse = await this.model.invoke(messages);
    Logger.logAgentThinking(requestId, 'direct_model_completed');
    return { messages: [directResponse] };
  }
  
  /**
   * Process message using agent with tools
   */
  private async processWithAgent(messages: BaseMessage[], requestId: string, request: AgentRequest): Promise<any> {
    try {
      // Simple agent invocation without complex constraints
      const response = await this.agent.invoke({
        messages: messages,
      });
      
      Logger.logAgentThinking(requestId, 'agent_invocation_completed');
      return response;
    } catch (agentError) {
      Logger.error('Agent invocation failed, falling back to direct model', agentError as Error, { requestId });
      
      // Fallback to direct model call if agent fails
      const directResponse = await this.model.invoke(messages);
      return { messages: [directResponse] };
    }
  }
  
  /**
   * Extract the final response from agent output
   */
  private async extractFinalResponse(response: any, request: AgentRequest, requestId: string): Promise<string> {
    // Safety check for response structure
    if (!response || !response.messages || response.messages.length === 0) {
      Logger.error('Invalid agent response structure', new Error('Response missing messages'), { requestId });
      return "I'm having trouble processing that. Could you try again?";
    }

    // Simple approach: get the last AI message content
    for (let i = response.messages.length - 1; i >= 0; i--) {
      const msg = response.messages[i];
      if (msg && msg.content && typeof msg.content === 'string' && msg.content.trim()) {
        const content = msg.content.trim();
        Logger.debug('Found AI response', { requestId, content: content.substring(0, 100) });
        return content;
      }
    }
    
    Logger.warn('No valid AI response found in messages', { requestId, messageCount: response.messages.length });
    return "I'm having trouble processing that. Could you try again?";
  }
  
  
  /**
   * Check if response contains malformed function calls
   */
  private hasMalformedFunctionCall(response: string): boolean {
    return response.includes('<function') || /function\s*=\s*[\w_]+/.test(response);
  }
  
  /**
   * Handle malformed function calls in responses
   */
  private async handleMalformedFunctionCall(response: string, request: AgentRequest, requestId: string): Promise<string> {
    Logger.warn('Detected malformed function call in response, attempting to fix', {
      requestId,
      originalResponse: response
    });
    
    const isMusicRequest = this.isMusicRequest(request.message);
    
    if (isMusicRequest) {
      return await this.handleMalformedMusicRequest(response, request, requestId);
    } else {
      return 'I encountered an issue processing your request. Please try rephrasing it.';
    }
  }
  
  /**
   * Check if the request is music-related
   */
  private isMusicRequest(message: string): boolean {
    return /play|music|spotify|song|artist|album|pause|resume|skip/i.test(message);
  }
  
  /**
   * Handle malformed music requests by attempting manual tool invocation
   */
  private async handleMalformedMusicRequest(response: string, request: AgentRequest, requestId: string): Promise<string> {
    const songName = this.extractSongName(response, request.message);
    
    Logger.info('Processing malformed music request', {
      requestId,
      originalMessage: request.message,
      extractedSongName: songName
    });
    
    if (songName) {
      return await this.manuallyInvokeSpotifyTool(songName, requestId);
    } else {
      Logger.warn('Could not extract song name from request', { 
        requestId, 
        originalMessage: request.message,
        malformedResponse: response 
      });
      return 'I had trouble with that music request. Make sure you\'re logged into Spotify and try something like "play Bohemian Rhapsody".';
    }
  }
  
  /**
   * Extract song name from various sources
   */
  private extractSongName(response: string, originalMessage: string): string {
    const patterns = [
      /play\s+([^"'}]+)/i,
      /"([^"]+)"/,
      originalMessage.match(/play\s+(.+)/i)
    ];
    
    for (const pattern of patterns) {
      if (pattern && Array.isArray(pattern)) {
        return pattern[1]?.trim() || '';
      }
      const match = response.match(pattern as RegExp);
      if (match) {
        return match[1]?.trim() || '';
      }
    }
    
    return '';
  }
  
  /**
   * Manually invoke Spotify tool as fallback
   */
  private async manuallyInvokeSpotifyTool(songName: string, requestId: string): Promise<string> {
    try {
      const spotifyTool = this.tools.find(t => t.name === 'spotify_control');
      if (spotifyTool) {
        Logger.info('Manually invoking Spotify tool', { requestId, songName });
        const toolResult = await spotifyTool.invoke({ input: `play:${songName}` });
        Logger.info('Spotify tool result', { requestId, toolResult });
        return toolResult;
      } else {
        Logger.error('Spotify tool not found in tools array', new Error('Tool missing'), { 
          requestId, 
          availableTools: this.tools.map(t => t.name) 
        });
        return `I'd like to play "${songName}" but I'm having trouble with the music system. Make sure you're logged into Spotify.`;
      }
    } catch (toolError) {
      Logger.error('Manual tool invocation failed', toolError as Error, { requestId, songName });
      return `I'd like to play "${songName}" but I'm having trouble with the music system. Make sure you're logged into Spotify.`;
    }
  }
  
  /**
   * Get default error message based on request type
   */
  private getDefaultErrorMessage(message: string): string {
    if (this.isMusicRequest(message)) {
      return 'I had trouble with that music request. Make sure you\'re logged into Spotify and try something like "play Bohemian Rhapsody" or "pause music".';
    }
    return 'I encountered an issue processing your request. Please try rephrasing it.';
  }
  
  /**
   * Handle processing errors
   */
  private handleProcessingError(error: unknown, request: AgentRequest, requestId: string, responseTime: number): AgentResponse {
    Logger.error('Error processing message with agent', error as Error, {
      requestId,
      personality: request.personality,
      mood: request.mood,
      messageLength: request.message.length
    });
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    if (this.isMusicRequest(request.message)) {
      return {
        message: 'I had trouble with that music request. Make sure you\'re logged into Spotify and try something like "play Bohemian Rhapsody" or "pause music".',
        personality: request.personality,
        confidence: 0.5,
        responseTime
      };
    }
    
    return {
      message: `I encountered an issue: ${errorMessage}. Please try rephrasing your request.`,
      personality: request.personality,
      confidence: 0.5,
      responseTime
    };
  }

  async *streamMessage(request: AgentRequest, sessionId?: string, requestId: string = 'unknown'): AsyncGenerator<string, void, unknown> {
    let fullResponse = '';
    try {
      // Get conversation history from simple memory
      const conversationHistory = this.getOrCreateMemory(sessionId || '');
      
      Logger.logAgentThinking(requestId, 'streaming_started', {
        personality: request.personality,
        mood: request.mood,
        messageLength: request.message.length,
        sessionId: sessionId || 'temporary',
        historyLength: conversationHistory.length,
        availableTools: this.tools.map(tool => tool.name)
      });
      
      const systemPrompt = getPersonalityPrompt(request.personality, request.mood);

      const messages: BaseMessage[] = [];

      // Add system message first
      messages.push(new SystemMessage(systemPrompt));

      // Add conversation history
      if (conversationHistory.length > 0) {
        messages.push(...this.convertToLangChainMessages(conversationHistory));
        Logger.logAgentThinking(requestId, 'streaming_history_loaded', {
          historyMessages: conversationHistory.length
        });
      }

      // Add current user message
      messages.push(new HumanMessage(request.message));
      
      Logger.logAgentThinking(requestId, 'streaming_agent_started');
      
      if (this.tools.length === 0) {
        Logger.debug('Using direct model streaming (no tools)', { requestId });
        const stream = await this.model.stream(messages);
        
        let totalChunks = 0;
        let totalLength = 0;
        
        for await (const chunk of stream) {
          if (chunk.content) {
            totalChunks++;
            totalLength += String(chunk.content).length;
            fullResponse += String(chunk.content);
            
            Logger.logAgentThinking(requestId, 'streaming_chunk_generated', {
              chunkNumber: totalChunks,
              chunkLength: String(chunk.content).length,
              totalLength,
              method: 'direct_model_stream'
            });
            
            yield String(chunk.content);
          }
        }
      } else {
        const stream = await this.agent.stream({
          messages: messages,
        }, {
          maxIterations: 2, // Prevents excessive tool usage loops
          maxExecutionTime: 30000 // 30 second timeout
        });

        let totalChunks = 0;
        let totalLength = 0;
        
        let lastChunkContent = '';
        
        for await (const chunk of stream) {
          if (chunk.messages && chunk.messages.length > 0) {
            // Look for the final AI response (last AIMessage without tool_calls)
            let chunkContent = '';
            
            for (let i = chunk.messages.length - 1; i >= 0; i--) {
              const msg = chunk.messages[i];
              if (msg.constructor.name === 'AIMessage' && !msg.tool_calls && msg.content && msg.content.trim()) {
                chunkContent = msg.content.trim();
                break;
              }
            }
            
            // If we found new content that's different from the last chunk
            if (chunkContent && chunkContent !== lastChunkContent) {
              const newContent = chunkContent.slice(lastChunkContent.length);
              if (newContent) {
                totalChunks++;
                totalLength += newContent.length;
                fullResponse += newContent;
                
                Logger.logAgentThinking(requestId, 'streaming_chunk_generated', {
                  chunkNumber: totalChunks,
                  chunkLength: newContent.length,
                  totalLength,
                  method: 'agent_stream'
                });
                
                yield newContent;
                lastChunkContent = chunkContent;
              }
            }
          }
        }
      }

      // Save the complete conversation to simple memory
      if (fullResponse) {
        this.saveToMemory(sessionId || '', request.message, fullResponse);
      }
      
      Logger.logAgentThinking(requestId, 'streaming_completed', {
        responseLength: fullResponse.length,
        memorySaved: !!fullResponse
      });
      
    } catch (error) {
      Logger.error('Error streaming message with agent', error as Error, {
        requestId,
        personality: request.personality,
        mood: request.mood
      });
      yield 'Sorry, I encountered an error while processing your message.';
    }
  }

  private generateSuggestions(personality: PersonalityMode, message: string): string[] {
    const baseQuestions = [
      "Tell me more about that",
      "What's your take on this?",
      "Can you give me another perspective?",
      "How would you approach this differently?"
    ];

    const personalityQuestions: Record<PersonalityMode, string[]> = {
      default: ["What are the key points?", "Can you elaborate further?"],
      roast: ["Roast this topic harder! 🔥", "What else can we tear apart?"],
      hype: ["Get me MORE excited about this! 🚀", "What's the most amazing part?"],
      conspiracy: ["What are they hiding about this? 👁️", "What's the real truth here?"],
      motivational: ["How can I dominate this? 💪", "What's my next power move?"],
      sleepy: ["Tell me a dreamy story about this 😴", "What peaceful thoughts come to mind?"],
      funfact: ["That's interesting! Speaking of that... 🤓", "Oh, that reminds me of a cool fact!"],
      eli: ["What does the Bible say about this? ✝️", "Can you share a scripture that relates?"]
    };

    return [...baseQuestions.slice(0, 2), ...personalityQuestions[personality]];
  }

  // Memory management methods
  clearSession(sessionId: string): boolean {
    return this.sessionMemories.delete(`session_${sessionId}`);
  }

  getSessionCount(): number {
    return this.sessionMemories.size;
  }

  clearAllSessions(): void {
    this.sessionMemories.clear();
  }

  // Get memory buffer for a session (for debugging/stats)
  async getSessionSummary(sessionId: string): Promise<string | null> {
    const messages = this.sessionMemories.get(`session_${sessionId}`);
    if (!messages || messages.length === 0) return null;
    
    try {
      return messages.map(msg => `${msg.role}: ${msg.content}`).join('\n');
    } catch (error) {
      Logger.error('Error loading session summary', error as Error, { sessionId });
      return null;
    }
  }

}