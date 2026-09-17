# Meeting Cost Ticker

A browser extension that shows the **live cost of a meeting** as it happens, based on the number of attendees and their average hourly rate.

> "This meeting could have been an email" — now with numbers.

## Features

- 💰 Live cost ticker that updates every second
- ⏱️ Elapsed meeting timer
- ⏸️ Start / pause / reset controls
- ⚙️ Inline settings (attendees, rate, currency) directly on the overlay
- 🖱️ Draggable overlay — grab the big number to move it
- 🌐 Works on Google Meet, Zoom (web) and Microsoft Teams

## Install (developer mode)

1. Generate the icons (one-time step):
   ```bash
   node icons/generate-icons.js
   ```
2. Open `chrome://extensions` (or `edge://extensions`).
3. Enable **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select this folder.

## Usage

1. Join a meeting on Google Meet, Zoom or Teams.
2. The ticker appears in the top-right corner and starts counting automatically.
3. Click the ⚙ button to adjust attendees, hourly rate and currency without leaving the call.
4. Use ⏸ / ▶ to pause or resume, and ↺ to reset.
5. Click × to hide the ticker for the rest of the session.

## Cost formula

```
cost = attendees × hourlyRate × (elapsedSeconds / 3600)
```

## Project structure

```
meeting-cost-ticker/
├── manifest.json          # Chrome MV3 extension manifest
├── icons/
│   ├── generate-icons.js  # Zero-dependency icon generator
│   └── icon*.png          # Generated icons (16/48/128 px)
└── src/
    ├── content/
    │   ├── overlay.js     # Content script: live ticker overlay
    │   └── overlay.css    # Overlay styles
    └── popup/
        ├── popup.html     # Settings popup
        ├── popup.css
        └── popup.js       # Popup logic (chrome.storage.sync)
```

## Roadmap ideas

- Auto-detect attendee count from the meeting UI
- Sync settings across devices (already uses `storage.sync`)
- Weekly "meeting waste" report
- Firefox port (WebExtensions API is compatible)

## License

MIT
