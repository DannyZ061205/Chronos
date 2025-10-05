# Chrome Web Store Publishing Guide

## Prerequisites

### 1. Chrome Web Store Developer Account
- **Cost**: $5 one-time registration fee
- **Sign up**: https://chrome.google.com/webstore/devconsole
- **Requirements**: Google account with payment method

### 2. Required Assets

#### Icons (Already created in `public/icons/`)
- ✅ 16x16 (toolbar icon)
- ✅ 32x32 (Windows computers)
- ✅ 48x48 (extension management page)
- ✅ 128x128 (Chrome Web Store & installation)

#### Store Listing Images (Need to create)
- **Small promotional tile**: 440x280 pixels
- **Large promotional tile**: 920x680 pixels (optional but recommended)
- **Marquee promotional tile**: 1400x560 pixels (optional, for featured listings)
- **Screenshots**: At least 1, recommended 3-5 (1280x800 or 640x400)

### 3. OAuth Configuration

#### Google Calendar OAuth
✅ **Already configured**
- Client ID: `411091318026-0qpft2a2s71a10qg23ptn5nprbe447pk.apps.googleusercontent.com`
- **IMPORTANT**: Add Chrome Web Store redirect URI to Google Cloud Console:
  1. Go to https://console.cloud.google.com/apis/credentials
  2. Find your OAuth client
  3. Add authorized redirect URIs:
     - `https://<YOUR_EXTENSION_ID>.chromiumapp.org/`
     - After first publish, update with actual extension ID

#### Outlook Calendar OAuth
✅ **Already configured**
- Client ID: `ca0fddd7-53ce-4f46-8a7d-4bab1f70ced0`
- **IMPORTANT**: Add redirect URI to Azure AD:
  1. Go to https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade
  2. Find your app registration
  3. Add redirect URI: `https://<YOUR_EXTENSION_ID>.chromiumapp.org/`
  4. Update after first publish with actual extension ID

## Publishing Steps

### Step 1: Build for Production
```bash
npm run build
```

### Step 2: Create ZIP Package
```bash
cd dist
zip -r ../chronos-extension-v1.0.0.zip .
cd ..
```

### Step 3: Submit to Chrome Web Store

1. **Go to Developer Dashboard**
   - https://chrome.google.com/webstore/devconsole

2. **Create New Item**
   - Click "New Item"
   - Upload `chronos-extension-v1.0.0.zip`

3. **Fill Store Listing**

   **Product Details:**
   - Name: Chronos - Natural Calendar Assistant
   - Summary: Fast calendar scheduling with natural language for Google & Outlook
   - Description: (See STORE_LISTING.md)
   - Category: Productivity
   - Language: English

   **Privacy:**
   - Single purpose: Calendar event management
   - Permissions justification:
     - `storage`: Save user preferences and undo history
     - `identity`: OAuth authentication for Google Calendar
     - `offscreen`: Future voice input feature
   - Host permissions justification:
     - googleapis.com: Google Calendar API
     - graph.microsoft.com: Outlook Calendar API

   **Distribution:**
   - Visibility: Public
   - Regions: All countries

4. **Upload Store Assets**
   - Small promotional tile (440x280)
   - Screenshots (1280x800) - at least 3
   - Detailed description

5. **Submit for Review**
   - Review time: typically 1-3 days
   - May require additional information

### Step 4: Post-Publish Updates

**CRITICAL**: After first publish, you'll receive an extension ID. You MUST:

1. **Update Google OAuth redirect URI**:
   - Add `https://<EXTENSION_ID>.chromiumapp.org/` to Google Cloud Console

2. **Update Outlook OAuth redirect URI**:
   - Add `https://<EXTENSION_ID>.chromiumapp.org/` to Azure AD

3. **Test authentication flows** to ensure they work

## Privacy Policy

**Required for Chrome Web Store**

Create and host a privacy policy (see PRIVACY_POLICY.md). Host it on:
- GitHub Pages (free)
- Your own website
- Google Sites (free)

Add the privacy policy URL in the store listing.

## Review Checklist

Before submitting:

- [ ] Extension builds without errors (`npm run build`)
- [ ] All features work in production build
- [ ] Icons are clear at all sizes
- [ ] Store listing description is compelling
- [ ] Screenshots show key features
- [ ] Privacy policy is hosted and accessible
- [ ] OAuth clients are configured for Chrome Web Store
- [ ] No hardcoded API keys in public code (✅ using OAuth)
- [ ] Version number is correct (1.0.0)

## Common Rejection Reasons

1. **Missing privacy policy** - Must be hosted and accessible
2. **Unclear permission usage** - Clearly explain why each permission is needed
3. **OAuth issues** - Ensure redirect URIs are configured correctly
4. **Misleading description** - Be accurate about features
5. **Poor screenshots** - Show actual extension UI, not stock photos

## Support & Updates

After publishing:
- Monitor reviews and respond to user feedback
- Fix bugs quickly (new versions review faster)
- Update screenshots when UI changes
- Keep privacy policy up to date

## Useful Links

- Chrome Web Store Developer Dashboard: https://chrome.google.com/webstore/devconsole
- Publishing Guide: https://developer.chrome.com/docs/webstore/publish/
- Program Policies: https://developer.chrome.com/docs/webstore/program-policies/
- Google OAuth Console: https://console.cloud.google.com/apis/credentials
- Azure AD Portal: https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade
