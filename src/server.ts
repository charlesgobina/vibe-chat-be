import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import chatRoutes from './routes/chat';
import spotifyRoutes from './routes/spotify';
import delayedActionRoutes, { initializeDelayedActionProcessor } from './routes/delayedAction';
import { requestLoggingMiddleware, errorLoggingMiddleware, performanceLoggingMiddleware } from './middleware/logging';
import { Logger } from './utils/logger';
import { DelayedActionProcessor } from './services/delayedActionProcessor';
import { ChatController } from './controllers/chatController';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8000;

// Add logging middleware first
app.use(requestLoggingMiddleware);
app.use(performanceLoggingMiddleware);

// Configure CORS to allow multiple frontend ports
const allowedOrigins = [
  'http://localhost:3000',  // React default
  'http://localhost:5173',  // Vite default  
  'http://localhost:8080',  // Your current frontend
  'http://localhost:4200',  // Angular default
  process.env.FRONTEND_URL  // Custom frontend URL from env
].filter(Boolean); // Remove undefined values

app.use(cors({
  origin: function (origin, callback) {
    Logger.debug('CORS origin check', { origin, allowedOrigins });
    
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      Logger.debug('CORS: Allowing request with no origin');
      return callback(null, true);
    }
    
    if (allowedOrigins.includes(origin)) {
      Logger.debug('CORS: Origin found in allowed list', { origin });
      return callback(null, true);
    }
    
    // In development, allow any localhost origin
    if (process.env.NODE_ENV === 'development' && origin.includes('localhost')) {
      Logger.debug('CORS: Allowing localhost origin in development', { origin });
      return callback(null, true);
    }
    
    const msg = `The CORS policy for this site does not allow access from the specified origin: ${origin}`;
    Logger.warn('CORS: Origin blocked', { origin, allowedOrigins });
    return callback(new Error(msg), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
  exposedHeaders: ['Content-Length', 'X-Request-ID']
}));

app.use(express.json());

app.use('/api', chatRoutes);
app.use('/api/spotify', spotifyRoutes);
app.use('/api/delayed', delayedActionRoutes);

// Add error logging middleware last
app.use(errorLoggingMiddleware);

app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Initialize delayed action processor
const delayedActionProcessor = new DelayedActionProcessor();

// Set up callback to handle delayed action execution
delayedActionProcessor.setCallback(async (sessionId: string, message: string) => {
  try {
    // Make an HTTP request back to our own chat endpoint
    const chatRequest = {
      message: message,
      personality: 'default',
      mood: 50,
      userId: sessionId,
      conversationHistory: []
    };

    Logger.info('Making delayed chat request', { sessionId, message, timestamp: new Date().toISOString() });

    const response = await fetch(`http://localhost:${PORT}/api/agent/chat?sessionId=${sessionId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Delayed-Action': 'true' // Flag to identify delayed actions
      },
      body: JSON.stringify(chatRequest)
    });

    if (response.ok) {
      const result = await response.json() as { message: string };
      Logger.info('Delayed chat request successful', { 
        sessionId, 
        originalMessage: message,
        aiResponse: result.message?.substring(0, 100) + '...'
      });
    } else {
      Logger.error('Delayed chat request failed', new Error(`HTTP ${response.status}`), { 
        sessionId, 
        message,
        status: response.status 
      });
    }
    
  } catch (error) {
    Logger.error('Error executing delayed action callback', error as Error, { sessionId, message });
  }
});

// Initialize the processor in the routes
initializeDelayedActionProcessor(delayedActionProcessor);

app.listen(PORT, () => {
  // Start the delayed action processor
  delayedActionProcessor.start();
  
  Logger.info('Server started successfully', {
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    endpoints: {
      health: `http://localhost:${PORT}/api/health`,
      chat: `http://localhost:${PORT}/api/agent/chat`,
      personalities: `http://localhost:${PORT}/api/agent/personalities`,
      delayedActions: `http://localhost:${PORT}/api/delayed/stream/:sessionId`
    }
  });
  
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/api/health`);
  console.log(`💬 Chat endpoint: http://localhost:${PORT}/api/agent/chat`);
  console.log(`⏰ Delayed actions: http://localhost:${PORT}/api/delayed/stream/:sessionId`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  Logger.info('SIGTERM received, stopping delayed action processor');
  delayedActionProcessor.stop();
  process.exit(0);
});

process.on('SIGINT', () => {
  Logger.info('SIGINT received, stopping delayed action processor');
  delayedActionProcessor.stop();
  process.exit(0);
});

export default app;