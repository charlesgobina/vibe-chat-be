# Web Search Setup

Your chatbot now has web search capabilities! 🔍

## Quick Setup

1. **Get Brave Search API Key**
   - Visit: https://api.search.brave.com/
   - Sign up for free (2000 queries/month)
   - Get your API key

2. **Add to Environment**
   ```bash
   # Add to your .env file
   BRAVE_API_KEY=your_brave_search_api_key_here
   ```

3. **Restart Server**
   ```bash
   npm run dev
   ```

## How It Works

- **Automatic**: The AI agent decides when to search based on user queries
- **Personality-aware**: Search results are interpreted through your bot's personality
- **Smart triggers**: Searches for current events, facts, real-time data
- **Fallback graceful**: Works without API key (just disables search)

## Example Queries That Trigger Search

- "What's the latest news about AI?"
- "Current weather in New York"
- "Tesla stock price today"
- "Recent developments in quantum computing"
- "Who won the game last night?"

## Architecture

- **Tool**: `src/tools/webSearchTool.ts` - LangChain Tool implementation
- **Integration**: Added to `ChatAgentService` tools array
- **API**: Brave Search API with 5 results, moderate safe search
- **Logging**: Full request/response logging for debugging

## API Limits

- **Free tier**: 2000 queries/month
- **Rate limit**: 1 request/second
- **Timeout**: 10 seconds per request
- **Results**: Up to 5 per search

The search functionality is now live and ready to use! 🚀