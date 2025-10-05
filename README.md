# Chronos - Natural Language Calendar Assistant

Create calendar events instantly using natural language. Type "Team meeting tomorrow at 3pm" and Chronos adds it to your Google Calendar or Outlook—no forms, no clicks.

🚀 **[Download from Chrome Web Store](#)** (Coming Soon) | 📦 **[Install Locally](#-installation-for-preview)**

---

## ⚡ Features

### Core Functionality
- **Natural Language Parsing**: "Lunch Friday 1pm 45m" → Calendar event in seconds
- **Multi-Calendar Support**: Works with both Google Calendar and Microsoft Outlook
- **Multi-Event Creation**: Create multiple events at once: "Lunch at noon, gym at 5pm, dinner at 7pm"
- **Recurring Events**: Supports daily, weekly, biweekly, monthly patterns with custom days
  - "Yoga every Tuesday and Thursday at 6pm"
  - "Team standup weekdays at 9am"
  - "Book club first Monday of each month"
- **Smart Scheduling**: Timezone-aware, handles relative dates ("tomorrow", "next Friday")
- **Undo/Redo**: Full undo/redo stack with keyboard shortcuts (Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z)

### User Experience
- **Command Persistence**: Your input auto-saves—never lose what you typed
- **Event Preview**: See exactly what will be created before confirming
- **Modify/Delete Events**: Edit or remove events directly from Chronos
- **Keyboard Shortcuts**: Open with Alt+M, submit with Enter
- **Privacy-First**: All processing happens locally—your data never leaves your device

## 🎯 Usage Examples

```
"Team meeting tomorrow at 3pm for 1 hour"
"Coffee with Sarah Friday 10am"
"Dentist appointment Oct 15 at 2:30pm"
"Yoga every Tuesday and Thursday at 6pm"
"Team standup weekdays at 9am"
"Project deadline next Friday 5pm"
"Lunch at noon, gym at 5pm, dinner at 7pm"  (creates 3 events)
```

---

## 📦 Installation for Preview

Want to try Chronos before it's on the Chrome Web Store? Follow these steps:

### Prerequisites

1. **Node.js** (LTS version recommended)
2. **pnpm** (or npm)
3. **Google Calendar** and/or **Outlook** account

### Steps

**1. Clone and Install**

```bash
git clone https://github.com/YOUR_USERNAME/chronos-extension.git
cd chronos-extension
pnpm install
```

**2. Build the Extension**

```bash
pnpm build
```

**3. Load in Chrome**

1. Open Chrome → `chrome://extensions/`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the `dist/` folder from your project

**4. Connect Your Calendar**

1. Click the Chronos icon in your toolbar
2. Click the **Settings** (⚙️) button
3. Connect **Google Calendar** and/or **Outlook**
4. Authorize the permissions

That's it! You're ready to start scheduling with natural language.

> **Note**: The preview version uses pre-configured OAuth credentials for testing. For production deployment, you'll need to set up your own Google Cloud and Azure apps (see [SETUP.md](SETUP.md)).

---

## 🎯 How to Use

**Open Chronos:**
- Click the extension icon, OR
- Press **Alt+M** (Windows/Linux) or **Option+M** (Mac)

**Create Events:**

Just type what you want in plain English:
- "Team meeting tomorrow at 3pm"
- "Dentist Friday 2pm for 45 minutes"
- "Yoga every Tuesday at 6pm"

**Multiple Events at Once:**
- "Lunch at noon, gym at 5pm, dinner at 7pm"

**Recurring Events:**
- "Team standup weekdays at 9am"
- "Play basketball Friday 8pm biweekly"
- "Book club first Monday of each month"

**Undo/Redo:**
- Click undo/redo buttons, OR
- **Ctrl/Cmd+Z** to undo
- **Ctrl/Cmd+Shift+Z** to redo

**Modify/Delete Events:**
- Events you create show up in the preview
- Click "Modify" to edit or "Delete" to remove

## 📁 Project Structure

```
chronos-extension/
├── src/
│   ├── components/         # React components
│   │   ├── PopupApp.tsx   # Main popup UI
│   │   ├── OptionsApp.tsx # Settings page
│   │   ├── CommandInput.tsx
│   │   ├── PreviewCard.tsx
│   │   ├── EditForm.tsx
│   │   ├── TargetToggles.tsx
│   │   ├── ActionButtons.tsx
│   │   └── Toast.tsx
│   ├── background/         # Service worker
│   │   └── background.ts  # Calendar API calls
│   ├── utils/             # Utilities
│   │   ├── parser.ts      # NLP parsing
│   │   └── storage.ts     # Chrome storage helpers
│   ├── stores/            # State management
│   │   └── popupStore.ts  # Zustand store
│   ├── types/             # TypeScript types
│   │   └── index.ts
│   └── styles/            # CSS
│       └── index.css      # Tailwind styles
├── public/
│   └── manifest.json      # Extension manifest
├── popup.html             # Popup entry point
├── options.html           # Options entry point
├── vite.config.ts         # Build configuration
└── package.json
```

## 🔧 Development

### Available Scripts

```bash
# Development with hot reload
pnpm dev

# Type checking
pnpm type-check

# Linting
pnpm lint

# Testing
pnpm test

# Production build
pnpm build
```

### Tech Stack

- **Language**: TypeScript
- **Framework**: React 18
- **Build**: Vite
- **Styling**: Tailwind CSS
- **State**: Zustand
- **Parsing**: chrono-node + Luxon
- **OAuth**: Chrome Identity API + MSAL.js

---

## 🔧 Tech Stack

- **Frontend**: React 18 + TypeScript
- **Build**: Vite
- **Styling**: Tailwind CSS
- **State**: Zustand
- **NLP Parsing**: chrono-node + Luxon
- **OAuth**: Chrome Identity API + MSAL.js
- **Calendar APIs**: Google Calendar API, Microsoft Graph API

---

## 🐛 Troubleshooting

**"Could not parse date/time"**
- Be more specific: "tomorrow 2pm" instead of just "tomorrow"
- Include both date and time for best results

**OAuth popup blocked**
- Allow popups for chrome-extension:// in Chrome settings
- Try disconnecting and reconnecting in Settings

**Extension doesn't load**
- Make sure you ran `pnpm build`
- Check Chrome DevTools console for errors

---

## 🗺️ Roadmap

- [x] Natural language parsing
- [x] Google Calendar integration
- [x] Outlook Calendar integration
- [x] Multi-event creation
- [x] Recurring events (daily, weekly, biweekly, monthly)
- [x] Undo/Redo functionality
- [x] Modify/Delete events
- [ ] Voice input
- [ ] AI-powered suggestions
- [ ] Attendee invitations
- [ ] Conference links (Google Meet, Teams)
- [ ] Apple Calendar support

---

## 📄 Privacy & License

**Privacy**: All data processing happens locally in your browser. We don't collect, store, or transmit any personal information. See [PRIVACY_POLICY.md](PRIVACY_POLICY.md).

**License**: This project is for educational and demonstration purposes.

---

## 🤝 Feedback & Support

Found a bug or have a feature request? [Open an issue](https://github.com/YOUR_USERNAME/chronos-extension/issues) or contact the developer.

**Built with ❤️ for faster scheduling**
