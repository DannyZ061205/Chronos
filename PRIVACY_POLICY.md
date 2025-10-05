# Privacy Policy for Chronos - Natural Calendar Assistant

**Effective Date**: January 1, 2025
**Last Updated**: January 1, 2025

## Introduction

Chronos ("we", "our", or "the extension") is committed to protecting your privacy. This Privacy Policy explains how Chronos handles your data when you use our Chrome extension for calendar management.

## Data Collection and Usage

### What Data We Collect

Chronos collects and stores **minimal data locally** on your device:

1. **Calendar Connection Status**
   - Whether you've connected Google Calendar and/or Outlook Calendar
   - OAuth tokens for calendar access (stored securely in Chrome's local storage)

2. **User Preferences**
   - Default event duration setting
   - Timezone preference
   - Calendar selection preferences

3. **Action History**
   - Undo/redo history for calendar operations
   - Stored locally to enable undo functionality across sessions

### What Data We DO NOT Collect

- ❌ **No Personal Information**: We do not collect names, email addresses, or contact details
- ❌ **No Calendar Event Content**: We do not store, transmit, or access your calendar events
- ❌ **No Usage Analytics**: We do not track how you use the extension
- ❌ **No Third-Party Sharing**: We do not share any data with third parties
- ❌ **No Cookies or Tracking**: We do not use cookies or tracking technologies

## Data Storage

All data is stored **locally on your device** using Chrome's storage API:
- Data never leaves your computer
- Data is not transmitted to our servers (we don't have any servers!)
- Data is automatically cleared when you uninstall the extension

## Third-Party Services

### Google Calendar API
- Used to create, read, modify, and delete events in your Google Calendar
- Requires OAuth authentication (you grant permission)
- Governed by [Google's Privacy Policy](https://policies.google.com/privacy)
- We only request calendar event permissions - nothing else

### Microsoft Graph API (Outlook)
- Used to create, read, modify, and delete events in your Outlook Calendar
- Requires OAuth authentication (you grant permission)
- Governed by [Microsoft's Privacy Policy](https://privacy.microsoft.com/privacystatement)
- We only request calendar permissions - nothing else

### OpenAI API
- Used for natural language parsing of event descriptions
- Event text you type is sent to OpenAI's API for parsing
- No personal information is sent - only the event text
- Governed by [OpenAI's Privacy Policy](https://openai.com/policies/privacy-policy)
- We use our API key - you don't need an OpenAI account

## Permissions Explained

### Why We Need Each Permission

- **storage**: Save your preferences and undo history locally on your device
- **identity**: Enable OAuth authentication for Google Calendar (Chrome's built-in secure authentication)
- **offscreen**: Planned for future voice input feature (currently unused)
- **googleapis.com access**: Communicate with Google Calendar API to manage your events
- **graph.microsoft.com access**: Communicate with Microsoft Graph API to manage your Outlook events

## Data Security

- **OAuth Tokens**: Stored securely in Chrome's encrypted storage
- **No Server Communication**: Extension runs entirely on your device
- **Open Source**: Code is available for review (transparency)
- **No Data Breaches**: Since we don't collect or store data centrally, there's nothing to breach

## Your Rights

You have complete control over your data:

- **Access**: All data is on your device - you can inspect it anytime
- **Delete**: Uninstalling the extension removes all local data
- **Disconnect**: Revoke calendar access anytime in the extension settings
- **Export**: Your calendar data remains in Google/Outlook where you can export it

## Children's Privacy

Chronos is not directed at children under 13. We do not knowingly collect data from children.

## Changes to Privacy Policy

We may update this policy occasionally. Changes will be posted here with a new "Last Updated" date. Continued use after changes means you accept the updated policy.

## Data Retention

- Local preferences and undo history: Kept until you uninstall the extension
- OAuth tokens: Kept until you disconnect your calendar or uninstall
- Calendar events: We never store these - they remain in your Google/Outlook account

## Contact Us

Questions about privacy or data handling?

- **Email**: [your-support-email@example.com]
- **GitHub Issues**: [link to your repo's issues page]

## Compliance

- **GDPR Compliant**: We don't collect personal data
- **CCPA Compliant**: We don't sell or share data
- **Chrome Web Store Policies**: Fully compliant with all policies

## Summary

**TL;DR:**
- ✅ Everything stays on your device
- ✅ No tracking, analytics, or data collection
- ✅ We never see your calendar events
- ✅ OAuth for secure calendar access
- ✅ You can delete everything by uninstalling
- ✅ Open and transparent

---

**Your privacy is our priority. If you have concerns, please contact us.**
