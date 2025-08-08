export type PersonalityMode = 'default' | 'roast' | 'hype' | 'conspiracy' | 'motivational' | 'sleepy' | 'funfact';

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface AgentRequest {
  message: string;
  personality: PersonalityMode;
  mood: number;
  userId?: string;
  conversationHistory?: ConversationMessage[];
}

export interface AgentResponse {
  message: string;
  personality: PersonalityMode;
  confidence: number;
  responseTime: number;
  suggestions?: string[];
}

export interface StreamChunk {
  type: 'start' | 'chunk' | 'end' | 'error';
  content?: string;
  metadata?: {
    personality: PersonalityMode;
    confidence?: number;
    responseTime?: number;
    suggestions?: string[];
  };
}

export interface PersonalityConfig {
  name: string;
  description: string;
  systemPrompt: string;
  moodModifiers: {
    low: string;
    medium: string;
    high: string;
  };
}

export interface ChatSession {
  id: string;
  userId?: string;
  messages: ConversationMessage[];
  createdAt: Date;
  updatedAt: Date;
}

export interface SearchResult {
  title: string;
  url: string;
  description: string;
  published?: string;
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
  timestamp: Date;
}