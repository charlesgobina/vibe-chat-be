import { Tool } from '@langchain/core/tools';
import { CallbackManagerForToolRun } from '@langchain/core/callbacks/manager';
import { Logger } from '../utils/logger';
import { getUserSpotifyToken } from '../routes/spotify';

interface SpotifyTrack {
  id: string;
  name: string;
  artists: Array<{ name: string }>;
  album: { name: string };
  external_urls: { spotify: string };
}

interface SpotifySearchResponse {
  tracks: {
    items: SpotifyTrack[];
  };
}

interface SpotifyCurrentlyPlayingResponse {
  item: SpotifyTrack;
  is_playing: boolean;
  device: {
    name: string;
    type: string;
  };
}

interface SpotifyDevice {
  id: string;
  name: string;
  type: string;
  is_active: boolean;
  is_private_session: boolean;
  is_restricted: boolean;
  volume_percent: number;
}

interface SpotifyDevicesResponse {
  devices: SpotifyDevice[];
}

/**
 * Spotify music control tool for LangChain agents
 * Provides comprehensive music playback control and search functionality
 */
export class SpotifyTool extends Tool {
  name = "spotify_control";
  description = `Search, control, and manage Spotify music playback.

Use this tool ONLY when users make explicit requests for Spotify actions:
- Playing specific songs/artists (e.g., "play Bohemian Rhapsody", "play The Beatles")
- Searching for music (e.g., "search for jazz playlist", "find rock songs")
- Controlling playback (pause, resume, skip, volume)
- Getting current song information (what's playing, current song)

Do NOT use for casual music discussions, general questions about music, or when users just mention music in passing.

CRITICAL: Use EXACT format "action:query" (colon separated). Examples:
- play:Bohemian Rhapsody
- play:The Beatles
- search:jazz playlist
- pause
- resume
- skip
- current
- volume:75

DO NOT use XML-like syntax or function calls. Use only the colon-separated format above.`;
  
  private static readonly SPOTIFY_BASE_URL = 'https://api.spotify.com/v1';
  private static readonly DEFAULT_SEARCH_LIMIT = 5;
  private static readonly DEVICE_ACTIVATION_DELAY = 1000;

  /**
   * Get the current user's Spotify access token
   */
  private getUserToken(): string | null {
    const token = getUserSpotifyToken();
    if (!token) {
      Logger.warn('No Spotify token available for user');
    }
    return token;
  }

  /**
   * Get available Spotify devices for the user
   */
  private async getAvailableDevices(requestId: string): Promise<SpotifyDevice[]> {
    const userToken = this.getUserToken();
    if (!userToken) {
      Logger.warn('Cannot get devices without valid token', { requestId });
      return [];
    }

    try {
      const response = await fetch(`${SpotifyTool.SPOTIFY_BASE_URL}/me/player/devices`, {
        headers: {
          'Authorization': `Bearer ${userToken}`
        }
      });

      if (response.ok) {
        const data = await response.json() as SpotifyDevicesResponse;
        Logger.debug('Retrieved Spotify devices', { 
          requestId, 
          deviceCount: data.devices.length,
          devices: data.devices.map(d => ({ name: d.name, type: d.type, active: d.is_active }))
        });
        return data.devices;
      } else {
        Logger.warn('Failed to get devices', { requestId, status: response.status });
      }
    } catch (error) {
      Logger.error('Get devices error', error as Error, { requestId });
    }
    
    return [];
  }

  /**
   * Activate a specific Spotify device
   */
  private async activateDevice(deviceId: string, requestId: string): Promise<boolean> {
    const userToken = this.getUserToken();
    if (!userToken) {
      Logger.warn('Cannot activate device without valid token', { requestId, deviceId });
      return false;
    }

    try {
      Logger.debug('Attempting to activate device', { requestId, deviceId });
      
      const response = await fetch(`${SpotifyTool.SPOTIFY_BASE_URL}/me/player`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${userToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          device_ids: [deviceId],
          play: false
        })
      });

      const success = response.status === 200;
      Logger.debug('Device activation result', { requestId, deviceId, success, status: response.status });
      return success;
    } catch (error) {
      Logger.error('Activate device error', error as Error, { requestId, deviceId });
      return false;
    }
  }

  /**
   * Main entry point for the Spotify tool
   */
  async _call(
    input: string,
    runManager?: CallbackManagerForToolRun
  ): Promise<string> {
    const requestId = this.generateRequestId();
    
    try {
      Logger.info('Spotify tool invoked', { requestId, input, inputLength: input?.length });

      // Validate authentication
      const authResult = this.validateAuthentication(requestId);
      if (authResult) {
        return authResult;
      }

      // Parse and validate input
      const parsedInput = this.parseInput(input, requestId);
      if (!parsedInput) {
        return 'Invalid input format. Please use: "play:song name", "pause", "search:query", etc.';
      }

      const { action, query } = parsedInput;
      
      Logger.info('Spotify tool action parsed', { 
        requestId, 
        action, 
        query: query || '(none)'
      });
      
      return await this.executeAction(action, query, requestId);

    } catch (error) {
      return this.handleError(error, requestId, input);
    }
  }
  
  /**
   * Generate unique request ID for tracking
   */
  private generateRequestId(): string {
    return `spotify-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
  }
  
  /**
   * Validate user authentication
   */
  private validateAuthentication(requestId: string): string | null {
    const userToken = this.getUserToken();
    Logger.debug('Spotify authentication check', { requestId, hasToken: !!userToken });
    
    if (!userToken) {
      Logger.warn('No Spotify token available', { requestId });
      return 'You need to connect your Spotify account first. Visit: http://127.0.0.1:8000/api/spotify/login';
    }
    
    return null;
  }
  
  /**
   * Parse and validate input format
   */
  private parseInput(input: string, requestId: string): { action: string; query: string } | null {
    const cleanInput = input.trim();
    
    // Handle malformed XML-like input
    if (this.isMalformedInput(cleanInput)) {
      Logger.warn('Received malformed XML-like input, attempting to parse', { requestId });
      return this.parseMalformedInput(cleanInput, requestId);
    }
    
    const [action, ...queryParts] = cleanInput.split(':');
    const query = queryParts.join(':'); // Rejoin in case there were multiple colons
    
    if (!action) {
      return null;
    }
    
    return { action: action.toLowerCase(), query: query || '' };
  }
  
  /**
   * Check if input is malformed XML-like format
   */
  private isMalformedInput(input: string): boolean {
    return input.includes('<function') || input.includes('action=') || input.includes('query=');
  }
  
  /**
   * Parse malformed XML-like input
   */
  private parseMalformedInput(input: string, requestId: string): { action: string; query: string } | null {
    const actionMatch = input.match(/action[=\\s]*[\"']?([^\"'\\s>]+)[\"']?/);
    const queryMatch = input.match(/query[=\\s]*[\"']?([^\"'\\s>]+)[\"']?/);
    
    if (actionMatch) {
      const action = actionMatch[1].toLowerCase();
      const query = queryMatch ? queryMatch[1] : '';
      Logger.info('Corrected malformed input', { requestId, action, query });
      return { action, query };
    }
    
    return null;
  }
  
  /**
   * Execute the parsed action
   */
  private async executeAction(action: string, query: string, requestId: string): Promise<string> {
    switch (action) {
      case 'search':
        return await this.searchMusic(query, requestId);
      case 'play':
        return await this.playTrack(query, requestId);
      case 'pause':
        return await this.pausePlayback(requestId);
      case 'resume':
        return await this.resumePlayback(requestId);
      case 'skip':
        return await this.skipTrack(requestId);
      case 'current':
        return await this.getCurrentTrack(requestId);
      case 'volume':
        const volume = this.parseVolume(query);
        return await this.setVolume(volume, requestId);
      default:
        return `Unknown Spotify action: ${action}. Available actions: search, play, pause, resume, skip, current, volume`;
    }
  }
  
  /**
   * Parse volume value with validation
   */
  private parseVolume(query: string): number {
    const volume = parseInt(query || '50');
    return Math.max(0, Math.min(100, volume)); // Clamp between 0-100
  }
  
  /**
   * Handle errors with appropriate user messages
   */
  private handleError(error: unknown, requestId: string, input: string): string {
    Logger.error('Spotify tool error', error as Error, { requestId, input });
    
    if (error instanceof Error) {
      if (error.message.includes('401') || error.message.includes('authentication')) {
        return 'Spotify authentication expired. Please reconnect: http://localhost:8000/api/spotify/login';
      }
      
      if (error.message.includes('403')) {
        return 'Spotify access denied. Please check your account permissions.';
      }
      
      if (error.message.includes('429')) {
        return 'Spotify rate limit exceeded. Please try again in a moment.';
      }
    }
    
    return `Spotify error: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }


  /**
   * Search for music on Spotify
   */
  private async searchMusic(query: string, requestId: string): Promise<string> {
    if (!query?.trim()) {
      return 'Please provide a search query. Example: "search:jazz music"';
    }

    const userToken = this.getUserToken();
    if (!userToken) {
      return 'Authentication required. Visit: http://localhost:8000/api/spotify/login';
    }

    try {
      const response = await fetch(
        `${SpotifyTool.SPOTIFY_BASE_URL}/search?q=${encodeURIComponent(query)}&type=track&limit=${SpotifyTool.DEFAULT_SEARCH_LIMIT}`,
        {
          headers: {
            'Authorization': `Bearer ${userToken}`
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Search failed with status ${response.status}`);
      }

      const data = await response.json() as SpotifySearchResponse;
      
      if (data.tracks.items.length === 0) {
        Logger.info('No tracks found for search', { requestId, query });
        return `No tracks found for "${query}". Try a different search term.`;
      }

      const tracks = data.tracks.items.slice(0, 3).map((track, index) => {
        const artists = track.artists.map(artist => artist.name).join(', ');
        return `${index + 1}. **${track.name}** by ${artists}\n   Album: ${track.album.name}`;
      });

      Logger.info('Spotify search completed', { requestId, query, resultCount: data.tracks.items.length });

      return `Found tracks for "${query}":\n\n${tracks.join('\n\n')}\n\nSay "play:[song name]" to start playing!`;
    } catch (error) {
      Logger.error('Search music error', error as Error, { requestId, query });
      throw error;
    }
  }

  private async playTrack(trackName: string, requestId: string): Promise<string> {
    if (!trackName) {
      return 'Please specify a track to play. Example: "play:bohemian rhapsody"';
    }

    const userToken = this.getUserToken();
    if (!userToken) {
      return 'Authentication required. Visit: http://localhost:8000/api/spotify/login';
    }

    try {
      // First search for the track
      const searchResponse = await fetch(
        `https://api.spotify.com/v1/search?q=${encodeURIComponent(trackName)}&type=track&limit=1`,
        {
          headers: {
            'Authorization': `Bearer ${userToken}`
          }
        }
      );

      if (!searchResponse.ok) {
        throw new Error(`Search failed: ${searchResponse.status}`);
      }

      const searchData = await searchResponse.json() as SpotifySearchResponse;
      
      if (searchData.tracks.items.length === 0) {
        return `No tracks found for "${trackName}". Try a different search term.`;
      }

      const track = searchData.tracks.items[0];
      
      // Try to start playback
      let playResponse = await fetch('https://api.spotify.com/v1/me/player/play', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${userToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          uris: [`spotify:track:${track.id}`]
        })
      });

      // If no active device, try to activate one automatically
      if (playResponse.status === 404) {
        Logger.info('No active device, attempting to activate one', { requestId });
        
        const devices = await this.getAvailableDevices(requestId);
        const availableDevice = devices.find(d => !d.is_restricted && !d.is_private_session);
        
        if (availableDevice) {
          const activated = await this.activateDevice(availableDevice.id, requestId);
          if (activated) {
            // Wait a moment for device activation, then retry
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            playResponse = await fetch('https://api.spotify.com/v1/me/player/play', {
              method: 'PUT',
              headers: {
                'Authorization': `Bearer ${userToken}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                uris: [`spotify:track:${track.id}`]
              })
            });
          }
        }
      }

      if (playResponse.status === 200) {
        const artists = track.artists.map(artist => artist.name).join(', ');
        return `🎵 Now playing: **${track.name}** by ${artists}`;
      } else if (playResponse.status === 404) {
        const devices = await this.getAvailableDevices(requestId);
        if (devices.length === 0) {
          return `To play music, please open Spotify on one of your devices first. Once Spotify is open, try your request again.\n\nFound: **${track.name}** by ${track.artists.map(a => a.name).join(', ')}`;
        } else {
          const deviceNames = devices.map(d => d.name).join(', ');
          return `Found devices (${deviceNames}) but couldn't activate them. Try starting Spotify and playing any song first, then try again.\n\nFound: **${track.name}** by ${track.artists.map(a => a.name).join(', ')}`;
        }
      } else {
        const error = await playResponse.text();
        Logger.error('Spotify playback failed', new Error(error), { requestId, status: playResponse.status });
        return `Couldn't start playback (${playResponse.status}). Make sure Spotify is open and active on one of your devices.`;
      }

    } catch (error) {
      Logger.error('Play track error', error as Error, { requestId, trackName });
      return `Error playing track: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  private async pausePlayback(requestId: string): Promise<string> {
    const userToken = this.getUserToken();
    if (!userToken) {
      return 'Authentication required. Visit: http://localhost:8000/api/spotify/login';
    }

    try {
      const response = await fetch('https://api.spotify.com/v1/me/player/pause', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${userToken}`
        }
      });

      if (response.status === 200) {
        console.log("##############################################");
        console.log(response.status)
        console.log("##############################################");
        return '⏸️ Music paused';
      } else if (response.status === 404) {
        return 'No active Spotify device found. Make sure Spotify is open and playing.';
      } else {
        return `Couldn't pause playback (${response.status}). Make sure Spotify is active.`;
      }
    } catch (error) {
      Logger.error('Pause playback error', error as Error, { requestId });
      return `Error pausing: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  private async resumePlayback(requestId: string): Promise<string> {
    const userToken = this.getUserToken();
    if (!userToken) {
      return 'Authentication required. Visit: http://localhost:8000/api/spotify/login';
    }

    try {
      const response = await fetch('https://api.spotify.com/v1/me/player/play', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${userToken}`
        }
      });

      if (response.status === 200) {
        console.log("##############################################");
        console.log(response.status)
        console.log("##############################################");
        return '▶️ Music resumed';
      } else if (response.status === 404) {
        return 'No active Spotify device found. Make sure Spotify is open.';
      } else {
        return `Couldn't resume playback (${response.status}). Make sure Spotify is active.`;
      }
    } catch (error) {
      Logger.error('Resume playback error', error as Error, { requestId });
      return `Error resuming: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  private async skipTrack(requestId: string): Promise<string> {
    const userToken = this.getUserToken();
    if (!userToken) {
      return 'Authentication required. Visit: http://localhost:8000/api/spotify/login';
    }

    try {
      const response = await fetch('https://api.spotify.com/v1/me/player/next', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${userToken}`
        }
      });

      if (response.status === 200) {
        return '⏭️ Skipped to next track';
      } else if (response.status === 404) {
        return 'No active Spotify device found. Make sure Spotify is open and playing.';
      } else {
        return `Couldn't skip track (${response.status}). Make sure Spotify is active.`;
      }
    } catch (error) {
      Logger.error('Skip track error', error as Error, { requestId });
      return `Error skipping: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  private async getCurrentTrack(requestId: string): Promise<string> {
    const userToken = this.getUserToken();
    if (!userToken) {
      return 'Authentication required. Visit: http://localhost:8000/api/spotify/login';
    }

    try {
      const response = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
        headers: {
          'Authorization': `Bearer ${userToken}`
        }
      });

      if (response.status === 200) {
        // Nothing playing, but let's check if there are devices and provide helpful info
        const devices = await this.getAvailableDevices(requestId);
        if (devices.length > 0) {
          const deviceNames = devices.map(d => `${d.name} (${d.type})`).join(', ');
          return `No music currently playing.\n\nAvailable devices: ${deviceNames}\n\nSay "play [song name]" to start listening!`;
        } else {
          return 'No music currently playing and no Spotify devices found. Please open Spotify on one of your devices first.';
        }
      } else if (response.status === 404) {
        const devices = await this.getAvailableDevices(requestId);
        if (devices.length > 0) {
          const deviceNames = devices.map(d => `${d.name} (${d.type})`).join(', ');
          return `No active playback session found.\n\nAvailable devices: ${deviceNames}\n\nSay "play [song name]" to start listening!`;
        } else {
          return 'No active Spotify device found. Please open Spotify on one of your devices first.';
        }
      } else if (response.ok) {
        const data = await response.json() as SpotifyCurrentlyPlayingResponse;
        
        if (!data.item) {
          return 'Spotify is open but no track information available. Try playing a song first.';
        }
        
        const artists = data.item.artists.map(artist => artist.name).join(', ');
        const status = data.is_playing ? '🎵 Currently playing' : '⏸️ Paused';
        return `${status}: **${data.item.name}** by ${artists}\nAlbum: ${data.item.album.name}\nDevice: ${data.device.name} (${data.device.type})`;
      } else {
        return `Couldn't get current track (${response.status}). Make sure Spotify is active.`;
      }
    } catch (error) {
      Logger.error('Get current track error', error as Error, { requestId });
      return `Error getting current track: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  private async setVolume(volume: number, requestId: string): Promise<string> {
    if (volume < 0 || volume > 100) {
      return 'Volume must be between 0 and 100.';
    }
    return `Volume control requires user authentication. Please set volume to ${volume}% directly in Spotify.`;
  }
}