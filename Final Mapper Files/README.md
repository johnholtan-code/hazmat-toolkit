# Hazmat Incident Map - Hot Wash Replay (Phase 1)

This repository now includes a new local-only Phase 1 app:

- `/Users/johnholtan/Library/CloudStorage/OneDrive-lightsonss.com/THMG/Final Files/Final Mapper Files/Hazmat Incident Map - Hot Wash Replay Phase 1/index.html`
- Store/data layer modules:
  - `/Users/johnholtan/Library/CloudStorage/OneDrive-lightsonss.com/THMG/Final Files/Final Mapper Files/src/store/store_interface.js`
  - `/Users/johnholtan/Library/CloudStorage/OneDrive-lightsonss.com/THMG/Final Files/Final Mapper Files/src/store/local_store_indexeddb.js`
  - `/Users/johnholtan/Library/CloudStorage/OneDrive-lightsonss.com/THMG/Final Files/Final Mapper Files/src/utils/hash.js`
  - `/Users/johnholtan/Library/CloudStorage/OneDrive-lightsonss.com/THMG/Final Files/Final Mapper Files/src/utils/canonical_json.js`

## Phase 1 Behavior

- Single-user, local-only (IndexedDB + local profile values in localStorage)
- Incident creation and opening
- Operating Period lifecycle: `ACTIVE -> LOCKED`
- Locking creates immutable snapshot (`hash` via canonical JSON + SHA-256)
- Write guard enforced in store: map/timeline/staging writes reject when OP is locked
- Amendments are append-only JSON Patch records for locked OPs (IC role only)
- Locked OP view is rendered as `Snapshot + Amendments overlay` in memory
- Start Next OP clones locked snapshot state into a new `ACTIVE` OP

## Run

1. Start the local web server with:
   - `/Users/johnholtan/Library/CloudStorage/OneDrive-lightsonss.com/THMG/Final Files/Final Mapper Files/Launch Hazmat Map.command`
2. Open:
   - `http://localhost:8000/Hazmat%20Incident%20Map%20-%20Hot%20Wash%20Replay%20Phase%201/index.html`
3. Stop server with:
   - `/Users/johnholtan/Library/CloudStorage/OneDrive-lightsonss.com/THMG/Final Files/Final Mapper Files/Stop Hazmat Map Server.command`

## Manual Acceptance Checks

1. Lock rejection for icon move
   - Add marker in OP-1, then click `Close & Lock OP`.
   - Try dragging or moving marker.
   - Expected: write rejected with `Operating Period Locked - create Amendment` toast.

2. Lock creates snapshot/hash and OP status
   - Lock current OP.
   - Expected: OP status shows `LOCKED`, locked banner appears, snapshot exists with `hash`.

3. Start Next OP clones state
   - Click `Start Next OP` on locked OP.
   - Expected: new active OP created with cloned map and staging state.

4. Amendment overlay without snapshot mutation
   - In locked OP, click `Create Amendment` and add patch.
   - Expected: amendment appears in list and view updates from overlay.
   - Snapshot record remains unchanged; amendment is stored separately.
