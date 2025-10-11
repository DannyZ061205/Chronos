# Fix OAuth "redirect_uri_mismatch" Error

## Problem
When clicking "Connect" for Google Calendar, you see:
```
Error 400: redirect_uri_mismatch
Access blocked: Chronos Extension's request is invalid
```

## Cause
The OAuth client in Google Cloud Console doesn't have your extension ID registered.

## Solution

### Step 1: Get Your Extension ID
1. Open Chrome and go to `chrome://extensions/`
2. Find "Chronos" extension
3. Copy the **Extension ID** (looks like: `abcdefghijklmnopqrstuvwxyz123456`)

### Step 2: Update Google Cloud Console
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select the project that has your OAuth client
3. Go to **APIs & Services** → **Credentials**
4. Find the OAuth 2.0 Client ID: `411091318026-0qpft2a2s71a10qg23ptn5nprbe447pk`
5. Click **Edit** (pencil icon)
6. Under **Authorized redirect URIs**, click **+ ADD URI**
7. Add: `https://YOUR_EXTENSION_ID.chromiumapp.org/`
   - Replace `YOUR_EXTENSION_ID` with the actual ID from Step 1
   - Example: `https://abcdefghijklmnopqrstuvwxyz123456.chromiumapp.org/`
8. Click **Save**

### Step 3: Test
1. Go back to Chronos Settings
2. Click **Connect** for Google Calendar
3. It should now work!

## For Outlook Calendar

The Outlook OAuth should work without changes since it uses PKCE flow with a public client.

If Outlook also doesn't work, the issue is likely:
1. The Azure app isn't configured as "Public client"
2. Redirect URI needs to be added in Azure Portal

### Fix Outlook:
1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **App registrations**
3. Find your app (Client ID: `ca0fddd7-53ce-4f46-8a7d-4bab1f70ced0`)
4. Click **Authentication**
5. Under **Platform configurations**, add **Single-page application**
6. Add redirect URI: `https://YOUR_EXTENSION_ID.chromiumapp.org/`
7. Enable **Public client flows** toggle
8. Click **Save**

## Note for Friends Testing

Each person loading the extension unpacked will have a **different extension ID**, so they'll need to either:
1. Configure their own OAuth clients (tedious)
2. Wait for Chrome Web Store publish (recommended - everyone gets the same ID)

Once published to Chrome Web Store, the extension ID becomes permanent and OAuth will work for everyone!
