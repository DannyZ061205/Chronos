# 🚀 Chronos Setup Guide

This guide will walk you through setting up the Chronos extension from scratch.

## Step 1: Install Dependencies

```bash
cd chronos-extension
npm install -g pnpm  # If you don't have pnpm
pnpm install
```

## Step 2: Set Up Google Calendar API

### 2.1 Create Google Cloud Project

1. Go to https://console.cloud.google.com
2. Click "Select a project" dropdown → "New Project"
3. Name it "Chronos Extension"
4. Click "Create"

### 2.2 Enable Google Calendar API

1. In your project, go to "APIs & Services" → "Library"
2. Search for "Google Calendar API"
3. Click on it and click "Enable"

### 2.3 Create OAuth 2.0 Credentials

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth client ID"
3. If prompted, configure the OAuth consent screen:
   - User Type: External
   - App name: Chronos
   - User support email: your email
   - Developer contact: your email
   - Save and continue through the scopes (no scopes needed here)
   - Add test users if in testing mode
4. Back to Create OAuth client ID:
   - Application type: **Chrome Extension**
   - Name: "Chronos Extension"
   - For now, leave "Application ID" blank (we'll add it later)
   - Click "Create"
5. **Copy your Client ID** - it looks like: `xxxxx.apps.googleusercontent.com`

### 2.4 Update Manifest

Open `public/manifest.json` and replace:

```json
"oauth2": {
  "client_id": "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com",
```

With your actual Client ID:

```json
"oauth2": {
  "client_id": "123456789-abcdefg.apps.googleusercontent.com",
```

## Step 3: Set Up Microsoft Outlook API

### 3.1 Create Azure App Registration

1. Go to https://portal.azure.com
2. Search for "Azure Active Directory" or "Microsoft Entra ID"
3. Click "App registrations" in the left menu
4. Click "New registration"
5. Fill in:
   - Name: **Chronos Extension**
   - Supported account types: **Accounts in any organizational directory and personal Microsoft accounts**
   - Redirect URI: 
     - Select **Single-page application (SPA)**
     - Leave URI blank for now (we'll add it after first build)
6. Click "Register"
7. **Copy your Application (client) ID** - it's a GUID like: `12345678-1234-1234-1234-123456789abc`

### 3.2 Configure API Permissions

1. In your app, click "API permissions" in the left menu
2. Click "Add a permission"
3. Click "Microsoft Graph"
4. Click "Delegated permissions"
5. Search for and select: **Calendars.ReadWrite**
6. Click "Add permissions"

### 3.3 Update Code

Open `src/components/OptionsApp.tsx` and find this section around line 7:

```typescript
const msalConfig = {
  auth: {
    clientId: 'YOUR_MICROSOFT_CLIENT_ID', // TODO: User needs to add this
```

Replace with your Client ID:

```typescript
const msalConfig = {
  auth: {
    clientId: '12345678-1234-1234-1234-123456789abc', // Your actual ID
```

## Step 4: First Build

```bash
pnpm build
```

This creates the `dist/` folder with your extension.

## Step 5: Load Extension in Chrome

1. Open Chrome
2. Go to `chrome://extensions/`
3. Enable **Developer mode** (toggle in top-right corner)
4. Click **Load unpacked**
5. Navigate to and select the `dist/` folder in your chronos-extension directory
6. The extension will load!

### 5.1 Get Your Extension ID

Look at your extension card in `chrome://extensions/`. You'll see an ID like:

```
ID: abcdefghijklmnopqrstuvwxyz123456
```

**Copy this entire ID!**

## Step 6: Update OAuth Settings with Extension ID

### 6.1 Update Google Cloud

1. Go back to Google Cloud Console → Credentials
2. Click on your OAuth client ID
3. In "Application ID" field, paste your extension ID
4. Click "Save"

### 6.2 Update Azure

1. Go back to Azure Portal → Your app → Authentication
2. Under "Single-page application", click "Add URI"
3. Add: `https://YOUR_EXTENSION_ID.chromiumapp.org/`
   - Replace YOUR_EXTENSION_ID with your actual ID
   - Example: `https://abcdefghijklmnopqrstuvwxyz123456.chromiumapp.org/`
4. Click "Save"

## Step 7: Rebuild and Reload

```bash
pnpm build
```

Then in Chrome:
1. Go to `chrome://extensions/`
2. Find your Chronos extension
3. Click the **reload** icon (circular arrow)

## Step 8: Connect Your Calendars

1. Click the Chronos extension icon in Chrome toolbar
2. Click the **Settings** (gear) icon in the popup
3. Click **Connect** next to Google Calendar
   - A popup will appear asking for permissions
   - Click "Allow"
4. Click **Connect** next to Outlook Calendar
   - A Microsoft login popup will appear
   - Sign in and grant permissions

## Step 9: Test It!

1. Click the Chronos extension icon
2. Type: `Test event tomorrow 2pm 30m`
3. Click Confirm
4. Check your Google and Outlook calendars - the event should be there!

## 🎉 You're Done!

## Troubleshooting

### "Failed to authenticate with Google Calendar"

- Double-check your Client ID in `manifest.json`
- Make sure you added your extension ID to Google Cloud Console
- Try disconnecting and reconnecting in Settings

### "Failed to authenticate with Outlook Calendar"

- Check your Client ID in `OptionsApp.tsx`
- Verify redirect URI in Azure matches: `https://YOUR_ID.chromiumapp.org/`
- Make sure Calendars.ReadWrite permission is granted
- Try disconnecting and reconnecting

### Extension doesn't load

- Run `pnpm type-check` to check for TypeScript errors
- Check the Console in `chrome://extensions/` for error messages
- Make sure all dependencies installed: `pnpm install`

### Can't parse my command

Try being more specific:
- ✅ "Lunch Friday 1pm 1h"
- ❌ "Lunch Friday" (missing time)

### OAuth popup blocked

- Allow popups for `chrome-extension://` in Chrome settings
- Look for the popup blocker icon in the address bar

## Development Mode

For development with hot reload:

```bash
pnpm dev
```

This watches for file changes and rebuilds automatically. You still need to click reload on the extension in `chrome://extensions/` after changes.

## Need Help?

Check the [README.md](README.md) for more information, or review the PRD for feature details.
