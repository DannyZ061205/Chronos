# OAuth Setup for Published Chrome Extension

## Problem
When you publish your extension to the Chrome Web Store, it gets a **new extension ID** different from your local development version. Both Google and Outlook OAuth require you to configure the redirect URI using this published ID.

## Step 1: Get Your Published Extension ID

1. Install your extension from the Chrome Web Store
2. Go to `chrome://extensions`
3. Find "Chronos - Natural Calendar Assistant"
4. Copy the **ID** (it will be something like: `abcdefghijklmnopqrstuvwxyzabcdef`)

## Step 2: Fix Google Calendar OAuth

### 2.1 Go to Google Cloud Console
1. Go to https://console.cloud.google.com/apis/credentials
2. Find your OAuth 2.0 Client (the one with ID: `411091318026-0qpft2a2s71a10qg23ptn5nprbe447pk`)
3. Click on it to edit

### 2.2 Add Published Extension Redirect URI
Add this redirect URI (replace `YOUR_PUBLISHED_EXTENSION_ID` with your actual ID from Step 1):

```
https://YOUR_PUBLISHED_EXTENSION_ID.chromiumapp.org/
```

Example:
```
https://abcdefghijklmnopqrstuvwxyzabcdef.chromiumapp.org/
```

### 2.3 Keep Existing URIs
**IMPORTANT**: Don't delete any existing redirect URIs. Keep both:
- Your local development ID redirect URI (for testing)
- Your published extension ID redirect URI (for production)

### 2.4 Save Changes
Click "Save" at the bottom

## Step 3: Fix Outlook Calendar OAuth

### 3.1 Go to Azure Portal
1. Go to https://portal.azure.com/
2. Navigate to "Azure Active Directory" → "App registrations"
3. Find your app with Client ID: `ca0fddd7-53ce-4f46-8a7d-4bab1f70ced0`
4. Click on it

### 3.2 Add Published Extension Redirect URI
1. Click "Authentication" in the left sidebar
2. Under "Platform configurations" → "Single-page application", click "Add URI"
3. Add this redirect URI (replace `YOUR_PUBLISHED_EXTENSION_ID`):

```
https://YOUR_PUBLISHED_EXTENSION_ID.chromiumapp.org/
```

### 3.3 Keep Existing URIs
**IMPORTANT**: Keep all existing redirect URIs for local testing

### 3.4 Save
Click "Save" at the top

## Step 4: Test

1. Uninstall and reinstall the extension from Chrome Web Store
2. Open the extension
3. Go to Settings
4. Try connecting Google Calendar → Should work now
5. Try connecting Outlook Calendar → Should work now

## Common Issues

### "redirect_uri_mismatch" Error
- Double-check the extension ID is correct
- Make sure you added the redirect URI in both Google Cloud Console AND Azure Portal
- The URI must end with a trailing slash: `/`
- Make sure it's the HTTPS redirect URI, not HTTP

### Still Not Working?
1. Clear browser cache and cookies
2. Remove and re-add the redirect URIs
3. Wait 5-10 minutes for changes to propagate
4. Try in incognito mode

## Notes
- Each time you update the extension on Chrome Web Store, the extension ID stays the same
- You only need to do this setup once for the published version
- Keep your local development redirect URIs for testing future updates
