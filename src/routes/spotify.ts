import express from 'express';
import { Logger } from '../utils/logger';
import dotenv from 'dotenv';
dotenv.config();

const router = express.Router();

// Simple in-memory storage for user tokens (in production, use a database)
const userTokens = new Map<string, {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}>();

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const SPOTIFY_REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI || 'http://127.0.0.1:8000/api/spotify/callback';

// Step 1: Redirect user to Spotify OAuth
router.get('/login', (req, res) => {
  if (!SPOTIFY_CLIENT_ID) {
    return res.status(500).json({ error: 'Spotify client ID not configured' });
  }

  const scopes = [
    'user-read-playback-state',
    'user-modify-playback-state',
    'user-read-currently-playing',
    'streaming'
  ].join(' ');

  const authURL = new URL('https://accounts.spotify.com/authorize');
  authURL.searchParams.append('response_type', 'code');
  authURL.searchParams.append('client_id', SPOTIFY_CLIENT_ID);
  authURL.searchParams.append('scope', scopes);
  authURL.searchParams.append('redirect_uri', SPOTIFY_REDIRECT_URI);
  authURL.searchParams.append('state', 'spotify-oauth'); // Simple state for security

  Logger.info('Spotify OAuth login initiated', { redirect_uri: SPOTIFY_REDIRECT_URI });
  
  res.redirect(authURL.toString());
});

// Step 2: Handle OAuth callback
router.get('/callback', async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    Logger.error('Spotify OAuth error', new Error(error as string));
    return res.status(400).json({ error: `Spotify OAuth error: ${error}` });
  }

  if (state !== 'spotify-oauth') {
    Logger.error('Invalid OAuth state', new Error(`Expected: spotify-oauth, Received: ${state}`));
    return res.status(400).json({ 
      error: 'Invalid state parameter',
      received: state,
      expected: 'spotify-oauth',
      debug: 'Make sure you accessed http://127.0.0.1:8000/api/spotify/login first'
    });
  }

  if (!code) {
    Logger.error('No authorization code received');
    return res.status(400).json({ error: 'No authorization code received' });
  }

  try {
    // Exchange code for tokens
    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64')}`
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code as string,
        redirect_uri: SPOTIFY_REDIRECT_URI
      })
    });

    if (!tokenResponse.ok) {
      throw new Error(`Token exchange failed: ${tokenResponse.status}`);
    }

    const tokens = await tokenResponse.json() as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };

    // Store tokens (use a proper session/user ID in production)
    const userId = 'default_user'; // In production, get this from session
    userTokens.set(userId, {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: Date.now() + (tokens.expires_in * 1000)
    });

    Logger.info('Spotify OAuth completed successfully', { userId });

    // Return success page
    res.send(`
      <html>
        <head><title>Spotify Connected!</title></head>
        <body style="font-family: Arial, sans-serif; text-align: center; margin-top: 100px;">
          <h1>✅ Spotify Connected!</h1>
          <p>You can now control Spotify playback through the chatbot.</p>
          <p>You can close this window and return to your chat.</p>
          <script>
            setTimeout(() => window.close(), 3000);
          </script>
        </body>
      </html>
    `);

  } catch (error) {
    Logger.error('Spotify token exchange failed', error as Error);
    res.status(500).json({ error: 'Failed to complete Spotify authentication' });
  }
});

// Get stored token for a user
export function getUserSpotifyToken(userId: string = 'default_user'): string | null {
  const userToken = userTokens.get(userId);
  
  if (!userToken) {
    return null;
  }

  // Check if token is expired
  if (Date.now() >= userToken.expires_at) {
    // TODO: Implement refresh token logic
    Logger.warn('Spotify token expired', { userId });
    return null;
  }

  return userToken.access_token;
}

// Check authentication status
router.get('/status', (req, res) => {
  const userId = 'default_user';
  const token = getUserSpotifyToken(userId);
  
  res.json({
    authenticated: !!token,
    loginUrl: '/api/spotify/login'
  });
});

export default router;