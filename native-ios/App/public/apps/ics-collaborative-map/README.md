# ICS Collaborative Map

This folder contains the standalone web client for the collaborative ICS map tool.

Contents:
- `index.html`: app entrypoint
- `app.js`: session, sync, map, and editing runtime
- `styles.css`: app-specific styles
- `config.js`: environment config for API and Supabase auth
- `vendor/`: app-local third-party web dependencies used by this tool

This tool is intentionally isolated from the legacy Incident Mapper assets so it can evolve independently.
