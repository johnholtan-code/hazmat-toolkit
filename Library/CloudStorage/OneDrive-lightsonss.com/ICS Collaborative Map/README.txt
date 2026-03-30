ICS Collaborative Map

Start:
- Double-click: Launch ICS Collaborative Map.command

Folder layout:
- `ics-collaborative-map/`
  Live app bundle used by the launcher.
- `source-assets/icons/custom/`
  Original custom icon source library.
- `source-assets/icons/napsg/`
  Original NAPSG icon source library.

Why it launches through a local server:
- The app fetches local JSON files such as `icon-manifest.json`, so it should be opened from `http://localhost:8080/...` instead of `file://`.

Stop:
- Double-click: Stop ICS Collaborative Map Server.command
