# Diet Log · Charts

The charts page (a Telegram Mini App) for a private Diet Log bot. It opens from the bot's **📊 Charts** button.

**This repository contains only the page's code — no data, no keys.** The page asks the bot's own server for the charts,
sending Telegram's signed sign-in data; the server checks that signature and shows each person only their own log.
Opened outside Telegram, the page shows nothing.

- `index.html`, `style.css`, `app.js` — plain files, no build step; served by GitHub Pages.
- Follows Telegram's light/dark theme; tabs (Food · Gut · Timing), swipe between charts, 7/30/90 days or dates,
  tap a bar or dot for its numbers.
