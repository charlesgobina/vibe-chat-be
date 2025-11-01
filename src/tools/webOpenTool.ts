import { Tool } from '@langchain/core/tools';
import { CallbackManagerForToolRun } from '@langchain/core/callbacks/manager';
import { Logger } from '../utils/logger';
import open from 'open';

export class WebOpenTool extends Tool {
  name = "web_open";
  description = `Open URLs and web pages in the user's default browser.

  Use this tool when the user asks to:
  - Open a specific website or URL
  - Launch a web page
  - View a webpage in their browser
  - Navigate to a URL

  Input: A valid URL string (must include http:// or https://)`;

  async _call(
    url: string,
    runManager?: CallbackManagerForToolRun
  ): Promise<string> {
    const requestId = 'open-' + Date.now();

    try {
      Logger.info('Opening web page', { requestId, url });

      // Validate URL format
      if (!url || typeof url !== 'string') {
        Logger.warn('Invalid URL provided', { requestId, url });
        return 'Please provide a valid URL to open.';
      }

      // Ensure URL has a protocol
      const urlPattern = /^https?:\/\//i;
      if (!urlPattern.test(url)) {
        // Try to auto-fix by adding https://
        if (url.includes('.') && !url.includes(' ')) {
          url = `https://${url}`;
          Logger.info('Auto-added https:// protocol to URL', { requestId, originalUrl: url, fixedUrl: url });
        } else {
          Logger.warn('URL does not appear to be valid', { requestId, url });
          return 'Please provide a valid URL with http:// or https:// protocol.';
        }
      }

      // Additional URL validation
      try {
        new URL(url);
      } catch (error) {
        Logger.warn('URL failed validation', { requestId, url, error: (error as Error).message });
        return 'The provided URL is not valid. Please check the format and try again.';
      }

      // Open the URL
      await open(url);

      Logger.info('Successfully opened web page', { requestId, url });
      return `Successfully opened ${url} in your default browser.`;

    } catch (error) {
      Logger.error('Failed to open web page', error as Error, {
        requestId,
        url,
        errorType: error instanceof Error ? error.name : 'Unknown'
      });

      if (error instanceof Error) {
        if (error.message.includes('ENOENT') || error.message.includes('command not found')) {
          return 'Unable to open browser. No default browser application found on this system.';
        } else if (error.message.includes('permission')) {
          return 'Permission denied when trying to open browser. Please check system permissions.';
        }
      }

      return 'Failed to open the web page. Please try again or open the URL manually.';
    }
  }
}