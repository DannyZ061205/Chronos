import { useState, useEffect } from 'react';
import { getDefaults, saveDefaults, DEFAULT_SETTINGS, getTimezone } from '../utils/storage';
import type { Defaults } from '../types';

export function OptionsApp() {
  const [defaults, setDefaults] = useState<Defaults>(DEFAULT_SETTINGS);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [outlookConnected, setOutlookConnected] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  
  useEffect(() => {
    loadSettings();
    checkConnectionStatus();
  }, []);
  
  const loadSettings = async () => {
    const settings = await getDefaults();
    setDefaults(settings);
  };
  
  const checkConnectionStatus = async () => {
    // Check Google
    try {
      const googleToken = await chrome.identity.getAuthToken({ interactive: false });
      setGoogleConnected(!!googleToken.token);
    } catch {
      setGoogleConnected(false);
    }
    
    // Check Outlook
    const storage = await chrome.storage.local.get(['outlookToken', 'outlookConnected']);
    setOutlookConnected(!!storage.outlookToken || !!storage.outlookConnected);
  };
  
  const handleSave = async () => {
    setSaving(true);
    setMessage('');

    try {
      await saveDefaults(defaults);
      setMessage('Settings saved successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage('Error saving settings');
      console.error(error);
    } finally {
      setSaving(false);
    }
  };
  
  const handleConnectGoogle = async () => {
    try {
      const token = await chrome.identity.getAuthToken({ interactive: true });
      if (token.token) {
        setGoogleConnected(true);
        await chrome.storage.local.set({ googleConnected: true });
        setMessage('Google Calendar connected!');
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (error) {
      console.error('Google auth error:', error);
      setMessage('Failed to connect Google Calendar');
    }
  };
  
  const handleDisconnectGoogle = async () => {
    try {
      const token = await chrome.identity.getAuthToken({ interactive: false });
      if (token.token) {
        await chrome.identity.removeCachedAuthToken({ token: token.token });
      }
      await chrome.storage.local.remove('googleConnected');
      setGoogleConnected(false);
      setMessage('Google Calendar disconnected');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Error disconnecting Google:', error);
    }
  };
  
  const handleConnectOutlook = async () => {
    try {
      const clientId = 'ca0fddd7-53ce-4f46-8a7d-4bab1f70ced0';
      // Use Chrome's identity API to get the correct redirect URI
      const redirectUri = chrome.identity.getRedirectURL();
      const scope = 'https://graph.microsoft.com/Calendars.ReadWrite offline_access';

      console.log('Starting Outlook auth...');
      console.log('Extension ID:', chrome.runtime.id);
      console.log('Redirect URI:', redirectUri);

      // Generate PKCE code verifier and challenge
      const generateRandomString = (length: number): string => {
        const array = new Uint8Array(length);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('').substring(0, length);
      };

      const sha256 = async (plain: string): Promise<ArrayBuffer> => {
        const encoder = new TextEncoder();
        const data = encoder.encode(plain);
        return await crypto.subtle.digest('SHA-256', data);
      };

      const base64urlencode = (buffer: ArrayBuffer): string => {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary)
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=/g, '');
      };

      const codeVerifier = generateRandomString(128);
      const hashed = await sha256(codeVerifier);
      const codeChallenge = base64urlencode(hashed);

      // Store code verifier for later use in token exchange
      await chrome.storage.local.set({ outlookCodeVerifier: codeVerifier });

      const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?` +
        `client_id=${clientId}` +
        `&response_type=code` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&scope=${encodeURIComponent(scope)}` +
        `&response_mode=query` +
        `&prompt=select_account` +
        `&code_challenge=${codeChallenge}` +
        `&code_challenge_method=S256`;

      console.log('Auth URL:', authUrl);

      const responseUrl = await chrome.identity.launchWebAuthFlow({
        url: authUrl,
        interactive: true,
      });

      console.log('Response URL:', responseUrl);

      if (!responseUrl) {
        throw new Error('No response from authentication');
      }

      // Parse the authorization code
      const urlObj = new URL(responseUrl);
      console.log('Parsed URL params:', Object.fromEntries(urlObj.searchParams));

      const code = urlObj.searchParams.get('code');
      const error = urlObj.searchParams.get('error');
      const errorDescription = urlObj.searchParams.get('error_description');

      if (error) {
        throw new Error(`Auth error: ${error} - ${errorDescription || 'Unknown error'}`);
      }

      if (!code) {
        console.error('No code in response URL. Full URL:', responseUrl);
        throw new Error('No authorization code received. Check Azure redirect URI configuration.');
      }

      // Retrieve code verifier from storage
      const { outlookCodeVerifier } = await chrome.storage.local.get('outlookCodeVerifier');

      if (!outlookCodeVerifier) {
        throw new Error('Code verifier not found. Please try again.');
      }

      // Exchange code for tokens with PKCE (no client secret for public clients)
      const tokenResponse = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          scope: scope,
          code: code,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
          code_verifier: outlookCodeVerifier,
        }),
      });

      if (!tokenResponse.ok) {
        const error = await tokenResponse.json();
        throw new Error(error.error_description || 'Token exchange failed');
      }

      const tokens = await tokenResponse.json();

      // Store access token, refresh token, and expiry
      await chrome.storage.local.set({
        outlookToken: tokens.access_token,
        outlookRefreshToken: tokens.refresh_token,
        outlookTokenExpiry: Date.now() + (tokens.expires_in * 1000),
        outlookConnected: true,
      });

      // Clean up code verifier after successful exchange
      await chrome.storage.local.remove('outlookCodeVerifier');

      setOutlookConnected(true);
      setMessage('Outlook Calendar connected with auto-refresh!');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Outlook auth error:', error);
      setMessage(`Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };
  
  const handleDisconnectOutlook = async () => {
    try {
      await chrome.storage.local.remove([
        'outlookToken',
        'outlookRefreshToken',
        'outlookTokenExpiry',
        'outlookConnected'
      ]);
      setOutlookConnected(false);
      setMessage('Outlook Calendar disconnected');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Error disconnecting Outlook:', error);
    }
  };
  
  const currentTz = getTimezone(defaults.tzOverride);
  
  return (
    <div className="max-w-3xl mx-auto p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Chronos Settings</h1>
        <p className="text-gray-600">Manage your calendar connections and default settings</p>
      </div>
      
      {/* Message */}
      {message && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-800 rounded-lg">
          {message}
        </div>
      )}
      
      {/* Accounts Section */}
      <section className="card mb-6">
        <h2 className="text-xl font-semibold mb-4">Calendar Accounts</h2>
        
        {/* Google Calendar */}
        <div className="mb-6 pb-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg overflow-hidden flex items-center justify-center">
                <img src="/logos/google-calendar.jpg" alt="Google Calendar" className="w-full h-full object-cover" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Google Calendar</h3>
                <p className="text-sm text-gray-600">
                  {googleConnected ? (
                    <span className="text-green-600">✓ Connected</span>
                  ) : (
                    <span className="text-gray-500">Not connected</span>
                  )}
                </p>
              </div>
            </div>
            
            {googleConnected ? (
              <button onClick={handleDisconnectGoogle} className="btn-secondary">
                Disconnect
              </button>
            ) : (
              <button onClick={handleConnectGoogle} className="btn-primary">
                Connect
              </button>
            )}
          </div>
        </div>
        
        {/* Outlook Calendar */}
        <div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg overflow-hidden flex items-center justify-center bg-white">
                <img src="/logos/outlook-calendar.png" alt="Outlook Calendar" className="w-full h-full object-cover" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Outlook Calendar</h3>
                <p className="text-sm text-gray-600">
                  {outlookConnected ? (
                    <span className="text-green-600">✓ Connected</span>
                  ) : (
                    <span className="text-gray-500">Not connected</span>
                  )}
                </p>
              </div>
            </div>
            
            {outlookConnected ? (
              <button onClick={handleDisconnectOutlook} className="btn-secondary">
                Disconnect
              </button>
            ) : (
              <button onClick={handleConnectOutlook} className="btn-primary">
                Connect
              </button>
            )}
          </div>
          
          {!outlookConnected && (
            <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-800">
              <p className="font-medium mb-1">⚠️ Setup Required</p>
              <p>You need to configure your Microsoft Client ID in the manifest.json file and in OptionsApp.tsx before connecting Outlook.</p>
            </div>
          )}
        </div>
      </section>

      {/* Defaults Section */}
      <section className="card mb-6">
        <h2 className="text-xl font-semibold mb-4">Default Settings</h2>

        <div className="space-y-4">
          <div>
            <label htmlFor="duration" className="block text-sm font-medium text-gray-700 mb-2">
              Default Event Duration
            </label>
            <select
              id="duration"
              value={defaults.durationMinutes}
              onChange={(e) => setDefaults({ ...defaults, durationMinutes: parseInt(e.target.value) })}
              className="input max-w-xs"
            >
              <option value="15">15 minutes</option>
              <option value="30">30 minutes</option>
              <option value="45">45 minutes</option>
              <option value="60">1 hour</option>
              <option value="90">1.5 hours</option>
              <option value="120">2 hours</option>
            </select>
            <p className="text-sm text-gray-500 mt-1">
              Used when no duration is specified in your command
            </p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Current Timezone
            </label>
            <p className="text-gray-900 font-mono text-sm bg-gray-50 p-2 rounded border border-gray-200">
              {currentTz}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Detected automatically from your browser
            </p>
          </div>
        </div>
        
        <div className="mt-6 pt-4 border-t border-gray-200">
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-8 text-center text-sm text-gray-500">
        <p>Chronos v1.0.1 • Built for fast multi-calendar scheduling</p>
        <p className="mt-2 text-xs">
          🔒 Your privacy matters: All calendar data stays on your device. We never collect or transmit your personal information.
        </p>
        <p className="mt-4 text-xs bg-gray-100 p-2 rounded font-mono">
          Extension ID: {chrome.runtime.id}
        </p>
        <p className="mt-1 text-xs text-gray-400">
          ℹ️ Copy this ID if you need to configure OAuth in Google Cloud Console
        </p>
      </footer>
    </div>
  );
}
