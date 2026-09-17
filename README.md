# Meeting Cost Ticker

A browser extension that shows the **live cost of a meeting** as it happens, based on the number of attendees and their average hourly rate.

> "This meeting could have been an email" — now with numbers.

## Features

- 💰 Live cost ticker that updates every second
- 👥 **Live attendee detection** — counts people in the meeting as they join and leave, and prices each second at the current headcount
- 📋 Join/leave log in the overlay (`2 joined, 1 left`)
- 🏁 Auto-pauses when everyone leaves the room; resumes automatically if someone rejoins
- ⏱️ Elapsed meeting timer
- ⏸️ Start / pause / reset controls
- ⚙️ Inline settings (auto-detect toggle, attendees, rate, currency) directly on the overlay
- 🖱️ Draggable overlay — grab anywhere to move it
- 📐 Resizable — drag the bottom-right corner handle (double-click to reset)
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
3. With **Auto-detect people** enabled (default), the headcount follows the meeting live — the Attendees and Avg rate fields are disabled while it's on. Turn it off to set the headcount manually.
4. Click the ⚙ button to adjust the rate and currency without leaving the call.
5. Use ⏸ / ▶ to pause or resume, and ↺ to reset (clears the accumulated cost and the join/leave log).
6. When everyone leaves the room, the ticker auto-pauses and shows `· ended`; it resumes if someone rejoins.
7. Click × to hide the ticker for the rest of the session.

## Cost formula

The cost is **accumulated per second** at the headcount present at that second, so mid-meeting joins and leaves are priced dynamically:

```
cost = Σ (attendeesAtSecond × hourlyRate / 3600)
```

With auto-detect off (or before detection has seen anyone), `attendees` is the manual value from settings.

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

- ~~Auto-detect attendee count from the meeting UI~~ ✅ done
- Per-platform selectors for Zoom and Teams (currently tile detection is Meet-specific; others use the aria-label fallback)
- Weekly "meeting waste" report
- Firefox port (WebExtensions API is compatible)

## License

MIT
