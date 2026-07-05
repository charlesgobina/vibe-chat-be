import { Tool } from '@langchain/core/tools';
import { CallbackManagerForToolRun } from '@langchain/core/callbacks/manager';
import { Logger } from '../utils/logger';

export interface BraveSearchResult {
  title: string;
  url: string;
  description: string;
  published?: string;
}

export interface BraveSearchResponse {
  web?: {
    results: Array<{
      title: string;
      url: string;
      description: string;
      published?: string;
    }>;
  };
}

export class WebSearchTool extends Tool {
  name = "web_search";
  description = `Search the web for current information, news, facts, and real-time data.
  
  Use this tool when the user asks about:
  - Current events, news, or recent developments
  - Real-time information (weather, stock prices, etc.)
  - Facts that might have changed recently
  - Information you're not certain about
  - Specific companies, products, or services
  
  Input: A search query string (be specific and concise)`;

  private apiKey: string;
  private baseUrl = 'https://api.search.brave.com/res/v1/web/search';

  constructor() {
    super();
    this.apiKey = process.env.BRAVE_API_KEY || '';
    
    if (!this.apiKey) {
      Logger.warn('BRAVE_API_KEY not found in environment variables. Web search will be disabled.');
    }
  }

  async _call(
    query: string,
    runManager?: CallbackManagerForToolRun
  ): Promise<string> {
    const requestId = 'search-' + Date.now();
    if (!this.apiKey) {
      Logger.warn('Web search attempted but no API key configured', { requestId, query });
      return 'Web search is currently unavailable. Please check the configuration.';
    }

    try {
      Logger.info('Performing web search', { requestId, query });

      const url = new URL(this.baseUrl);
      url.searchParams.set('q', query);
      url.searchParams.set('count', '5');
      url.searchParams.set('search_lang', 'en');
      url.searchParams.set('country', 'US');
      url.searchParams.set('safesearch', 'moderate');

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip',
          'X-Subscription-Token': this.apiKey,
        },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        Logger.error('Brave Search API error', new Error(`HTTP ${response.status}: ${errorText}`), {
          requestId,
          query,
          status: response.status,
          statusText: response.statusText
        });
        
        if (response.status === 429) {
          return 'Search rate limit exceeded. Please try again later.';
        } else if (response.status === 401) {
          return 'Search API authentication failed. Please check the configuration.';
        } else {
          return 'Search service temporarily unavailable. Please try again later.';
        }
      }

      const data = await response.json() as BraveSearchResponse;
      
      if (!data.web?.results || data.web.results.length === 0) {
        Logger.info('No search results found', { requestId, query });
        return `No current information found for "${query}". The topic might be too specific or new.`;
      }

      const results = data.web.results.slice(0, 5).map((result, index) => {
        const publishedInfo = result.published ? ` (${result.published})` : '';
        return `${index + 1}. **${result.title}**${publishedInfo}
   ${result.description}
   Source: ${result.url}`;
      });

      const searchSummary = `Found ${data.web.results.length} results for "${query}":

${results.join('\n\n')}`;

      Logger.info('Web search completed successfully', {
        requestId,
        query,
        resultCount: data.web.results.length,
        topResult: data.web.results[0]?.title
      });

      return searchSummary;

    } catch (error) {
      Logger.error('Web search failed', error as Error, {
        requestId,
        query,
        errorType: error instanceof Error ? error.name : 'Unknown'
      });

      if (error instanceof Error && error.name === 'AbortError') {
        return 'Search request timed out. Please try a more specific query.';
      }

      return 'Search temporarily unavailable due to a technical issue. Please try again later.';
    }
  }
}