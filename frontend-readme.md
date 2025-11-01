# Vibe Chat Creator

A dynamic AI-powered chat interface for creating social media content with customizable personality modes and advanced voice synthesis. This application allows users to interact with an AI agent that adapts its personality and response intensity based on user preferences.

## Features

- **6 Personality Modes**: Default, Roast, Hype, Conspiracy, Motivational, and Sleepy
- **Mood Intensity Control**: Adjustable slider (0-100) to control response intensity
- **Voice Synthesis**: Text-to-speech with multiple providers (Google TTS, Web Speech API)
- **Real-time Chat Interface**: Clean, modern UI with typing indicators
- **Conversation History**: Context-aware responses with message history
- **Visual Effects**: Particle background effects that respond to personality and mood
- **Responsive Design**: Works on desktop and mobile devices

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **UI Framework**: shadcn/ui + Tailwind CSS
- **State Management**: Zustand
- **API Client**: TanStack Query (React Query)
- **Voice Synthesis**: Google Cloud TTS + Web Speech API
- **Build Tool**: Vite

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Optional: Google Cloud account for advanced TTS features

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd vibe-chat-creator
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
```bash
cp .env.example .env
```

4. Start the development server:
```bash
npm run dev
```

## Environment Configuration

Create a `.env` file with the following variables:

```bash
# Agent API Configuration
VITE_AGENT_API_URL=http://localhost:8000/api
VITE_AGENT_API_KEY=your_api_key_here

# Development settings
VITE_USE_MOCK_API=true

# Google Cloud Text-to-Speech (Optional)
VITE_GOOGLE_PROJECT_ID=your-project-id-here
VITE_GOOGLE_ACCESS_TOKEN=your-access-token-here
```

## API Integration

### Chat Message Payload

The application sends the following payload structure to the backend agent API:

```typescript
interface AgentRequest {
  message: string;                    // User's input message
  personality: PersonalityMode;       // Current personality mode
  mood: number;                       // Intensity level (0-100)
  userId?: string;                    // Optional user identifier
  conversationHistory?: ConversationMessage[];  // Previous messages for context
}

interface ConversationMessage {
  role: 'user' | 'assistant';        // Message sender type
  content: string;                    // Message content
  timestamp: Date;                    // When message was sent
}

type PersonalityMode = 'default' | 'roast' | 'hype' | 'conspiracy' | 'motivational' | 'sleepy';
```

### API Response Structure

The backend should respond with:

```typescript
interface AgentResponse {
  message: string;                    // AI-generated response
  personality: PersonalityMode;       // Personality used for response
  confidence: number;                 // Response confidence (0-1)
  responseTime: number;               // Processing time in milliseconds
  suggestions?: string[];             // Optional content suggestions
}
```

### API Endpoints

- `POST /api/agent/chat` - Send message and receive AI response
- `GET /api/agent/personality/{personality}` - Get personality information
- `GET /api/health` - Health check endpoint

### Error Handling

The application includes comprehensive error handling:
- Automatic fallback to mock responses if API fails
- Graceful degradation for voice synthesis errors
- User-friendly error messages

## Personality Modes

### 1. Default
- Professional and helpful
- Balanced tone for general content creation
- Clean, engaging responses

### 2. Roast 🔥
- Sarcastic and witty
- Uses fire emojis and bold language
- Mood affects intensity from playful to savage

### 3. Hype 🚀
- Enthusiastic and energetic
- Celebration emojis and caps lock
- Gets progressively more excited with higher mood

### 4. Conspiracy 👁️
- Mysterious and questioning
- References "hidden truths" and conspiracies
- More paranoid with higher mood levels

### 5. Motivational 💪
- Inspiring and empowering
- Uses power words like "CHAMPION"
- Increasingly intense motivation with higher mood

### 6. Sleepy 😴
- Calm and dreamy
- Soft, peaceful language
- More drowsy responses at higher mood levels

## Mood System

The mood slider (0-100) controls response intensity:

- **Low Mood (0-30)**: Subtle personality traits
- **Medium Mood (31-70)**: Balanced personality expression
- **High Mood (71-100)**: Full personality intensity

Examples for Roast personality:
- Low: "Oh honey... that's cute. Let me help you! 🔥"
- High: "OH NO YOU DIDN'T! 🔥 Time to absolutely DEMOLISH this topic!"

## Voice Synthesis

### Supported Providers

1. **Google Cloud TTS** (Primary)
   - High-quality voices
   - Multiple language support
   - Requires API key

2. **Web Speech API** (Fallback)
   - Browser-native synthesis
   - No API key required
   - Limited voice options

### Voice Configuration

Voices are mapped to personalities for consistent experience:
- Each personality has specific voice characteristics
- Automatic provider fallback if primary fails
- Real-time synthesis with playback controls

## Project Structure

```
src/
├── components/           # React components
│   ├── ui/              # shadcn/ui components
│   ├── ChatInterface.tsx
│   ├── PersonalitySelector.tsx
│   └── ...
├── hooks/               # Custom React hooks
│   ├── useAgentAPI.ts   # API integration hooks
│   └── ...
├── services/            # External service integrations
│   ├── agentService.ts  # Backend API service
│   ├── voice/           # Voice synthesis services
│   └── ...
├── stores/              # Zustand state management
│   └── chatStore.ts     # Main chat state
└── ...
```

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

### Code Style

- TypeScript strict mode enabled
- ESLint with React hooks rules
- Consistent import organization
- Component-first architecture

## Backend Integration

### Switching from Mock to Real API

1. Update `chatStore.ts` line 200:
```typescript
// Change from:
const response = await agentService.sendMessageMock(request);

// To:
const response = await agentService.sendMessage(request);
```

2. Set environment variables for your backend URL and API key

3. Ensure your backend implements the expected API contract

### Expected Backend Behavior

- Process user message with personality and mood context
- Maintain conversation history for context-aware responses
- Return personality-appropriate responses
- Handle error cases gracefully

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For issues and questions:
- Create an issue in the GitHub repository
- Check the documentation for common solutions
- Review the console logs for debugging information
