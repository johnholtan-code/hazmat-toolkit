# THMG Trainee App Handoff (Evidence-First, Low-Token)
Date: 2026-05-01
Repo Root: `/Users/johnholtan/Library/CloudStorage/OneDrive-lightsonss.com/THMG/Final Files`
Primary iOS/App Root: `/Users/johnholtan/Library/CloudStorage/OneDrive-lightsonss.com/THMG/Final Files/Final Mapper Files/toolbox-site-archive-2026-03-31/archive/non-ics-collab-2026-03-27/HazmatTrainee-iOS`
Xcode Project: `HazmatTrainee.xcodeproj`

## Objective
Produce a reliable handoff that maps:
1. Trainee app/module ownership and launch flow.
2. GitHub repositories explicitly referenced by this codebase.
3. Trainee app -> Render/backend connectivity, with unknowns flagged and closure plan.

## Operating Rules (Hard Constraints)
- Every mapping must cite concrete evidence (`file:line` or command output).
- Environment-driven values must include env/config key names.
- Keep runtime/debug findings separate from static architecture facts.
- Do not infer missing ownership/repo/backend values.
- Leave unresolved values as `UNKNOWN` and state the exact evidence needed to close.

## Milestone 1: Embedded Apps and Launch Paths

| App/Module | Launch Kind | Evidence File:Line | Launch Path/Target | Status |
|---|---|---|---|---|
| THMG Trainee app entrypoint | Native SwiftUI iOS app | `Sources/HazmatTraineeApp.swift:4`, `Sources/HazmatTraineeApp.swift:9-12` | `@main` app -> `RootView()` with shared `AppModel` | FOUND |
| Splash / root navigator | Native SwiftUI flow | `Sources/RootView.swift:8-13`, `Sources/RootView.swift:39-64` | Splash -> `NavigationStack(path: $model.navPath)` -> `HomeView()` | FOUND |
| Join live trainer session | Native SwiftUI + backend API | `Sources/HomeView.swift:14`, `Sources/HomeView.swift:55-57`, `Sources/AppModel.swift:196-239` | Trainee name + join code -> `joinScenarioSessionFromBackend()` -> scenarios screen | FOUND |
| QR join-code scanner | Native camera scanner | `Sources/HomeView.swift:50-52`, `Sources/HomeView.swift:97-103`, `Sources/HomeView.swift:149-217` | `Scan QR Code` sheet -> `AVCaptureMetadataOutput` QR payload -> `applyScannedJoinPayload` | FOUND |
| Continue Session shortcut | App Intent + native route | `Sources/HazmatTraineeApp.swift:17-33`, `Sources/HazmatTraineeApp.swift:36-48`, `Sources/AppModel.swift:1740-1763` | App Shortcut stores pending route, app restores persisted `backend_join` scenario | FOUND |
| Scenario selection | Native SwiftUI screen | `Sources/RootView.swift:14-16`, `Sources/ScenarioListView.swift:14-22`, `Sources/ScenarioListView.swift:52-80` | `.scenarios` -> `ScenarioListView()` -> selected scenario -> `.tools` | FOUND |
| Tool list / detection-device selection | Native SwiftUI screen | `Sources/RootView.swift:16-18`, `Sources/ToolListView.swift:85-102`, `Sources/ToolListView.swift:160-181` | `.tools` -> `ToolListView()` -> monitor confirmation -> `routeForSelectedMonitor()` | FOUND |
| Air Monitor Builder | Native SwiftUI tool builder | `Sources/RootView.swift:18-20`, `Sources/ToolListView.swift:104-145`, `Sources/Models.swift:238-242` | `.airMonitorBuilder` -> `AirMonitorBuilderView()` | FOUND |
| 4 Gas + PID / 4 Gas simulator | Native SwiftUI simulator | `Sources/RootView.swift:21-22`, `Sources/Models.swift:178-180`, `Sources/Models.swift:187-200` | `.gasSimulator` -> `GasSimulatorView()` for air-monitor tool types | FOUND |
| Radiation Monitor simulator | Native SwiftUI simulator | `Sources/RootView.swift:23-24`, `Sources/Models.swift:181`, `Sources/Models.swift:191` | `.radiationSimulator` -> `RadiationSimulatorView()` | FOUND |
| pH Paper simulator | Native SwiftUI simulator | `Sources/RootView.swift:25-26`, `Sources/Models.swift:182`, `Sources/Models.swift:192` | `.phSimulator` -> `PHSimulatorView()` | FOUND |
| Oxidizer Test Strip simulator | Native SwiftUI simulator | `Sources/RootView.swift:27-28`, `Sources/Models.swift:183`, `Sources/Models.swift:193` | `.oxidizerSimulator` -> `OxidizerStripSimulatorView()` | FOUND |
| Location breadcrumb tracking | Native CoreLocation + backend API | `Sources/AppModel.swift:376-382`, `Sources/AppModel.swift:504-538`, `Sources/AppModel.swift:541-587` | Active joined session -> capture every 5s -> upload loop every 15s | FOUND |

## Milestone 2: Repository Mapping (GitHub)

| Repository URL | Where Found | Consumer App/Module | Dependency Type |
|---|---|---|---|
| `git@github.com:LightsOn-Safety-Solutions/hazmat-toolkit.git` | `git remote -v` from repo root returned `origin` fetch/push | Whole `Final Files` repo containing archived trainee app | Primary git remote |
| `../HazMatDesignSystem` | `project.yml:8-10`, `project.yml:33-34` | THMG Trainee native app | Local Swift package dependency |
| `HazMatDesignSystem` package | `../HazMatDesignSystem/Package.swift:4-18` | Shared design system imported by trainee SwiftUI screens | Local Swift package product |
| External Swift Package URLs | Searched `HazmatTrainee-iOS` for `Package.swift`, `Package.resolved`, `Podfile`, `Cartfile`, `.gitmodules` | THMG Trainee app | NOT FOUND |
| Standalone trainee-app repo ownership | No app-local `.git` remote found; `git rev-parse --show-toplevel` returned `/Users/johnholtan/Library/CloudStorage/OneDrive-lightsonss.com/THMG/Final Files` | THMG Trainee app | UNKNOWN |
| Render/backend source repo ownership | `/Volumes/Crucial X9/toolbox-site` `git remote -v` returned `origin` and `johnholtan`; trainee app references only API domain, not backend repo URL | API consumed by trainee app | PARTIAL |

Required evidence to close UNKNOWN rows:
- Confirmation whether `HazmatTrainee-iOS` should remain a subdirectory of `Final Files` or be split into its own GitHub repo.
- Current GitHub target if trainee app changes should be pushed outside `LightsOn-Safety-Solutions/hazmat-toolkit.git`.
- A maintained ownership registry or README that explicitly assigns trainee app repo ownership.

## Milestone 3: Render Connectivity Mapping

| App/Flow | Base URL Source | Endpoint File | Render Service | Confidence |
|---|---|---|---|---|
| Trainee join-session flow | `HAZMAT_API_BASE_URL` env key first, then `HazmatAPIBaseURL` Info.plist fallback | `Sources/DataverseClient.swift:247-258` | Domain value environment/config-driven | High |
| Trainee current static fallback | `HazmatAPIBaseURL` Info.plist key | `Resources/Info.plist:23-24` | `https://hazmat-toolkit-api-75ct.onrender.com` | High |
| Join live trainer session | Uses `baseURL.appendingPathComponent("v1/sessions/join")` | `Sources/DataverseClient.swift:140-170`, `Sources/AppModel.swift:212-239` | Same service resolved from `HAZMAT_API_BASE_URL` / `HazmatAPIBaseURL` | High |
| Refresh joined session state | Uses `baseURL.appendingPathComponent("v1/sessions/me")` with bearer token | `Sources/DataverseClient.swift:185-215`, `Sources/AppModel.swift:384-421` | Same service resolved from `HAZMAT_API_BASE_URL` / `HazmatAPIBaseURL` | High |
| Breadcrumb tracking upload | Uses `baseURL.appendingPathComponent("v1/tracking/batches")` with bearer token | `Sources/DataverseClient.swift:218-245`, `Sources/AppModel.swift:529-587` | Same service resolved from `HAZMAT_API_BASE_URL` / `HazmatAPIBaseURL` | High |
| Backend Render blueprint service | Service name `hazmat-toolkit-api`, root dir `backend/postgres/api` | `/Volumes/Crucial X9/toolbox-site/render.yaml:1-9` | `hazmat-toolkit-api` | Medium |
| Archived backend Render blueprint service | Service name `hazmat-toolkit-api`, root dir `backend/postgres/api` | `../../../../toolbox-site/deploy/render.yaml:1-9` | `hazmat-toolkit-api` | Medium |
| Exact Render service ID for `hazmat-toolkit-api-75ct` | No service ID found in trainee app source scan | N/A | UNKNOWN | Low |
| Supabase direct connectivity | No Supabase URL/key found in trainee app source scan | Searched `HazmatTrainee-iOS` for `Supabase` / URL keys | N/A | High |

Exact keys/config needed to resolve unknown backend rows:
- iOS runtime override: `HAZMAT_API_BASE_URL`.
- iOS static fallback: `HazmatAPIBaseURL` in `Resources/Info.plist`.
- Render service ID for whichever domain is intended: `hazmat-toolkit-api-75ct.onrender.com` or `hazmat-toolkit-api.onrender.com`.
- Render Dashboard or CLI evidence showing which GitHub repo/branch backs `hazmat-toolkit-api-75ct`.

## Runtime Findings (Separate from Static Mapping)
- Current static fallback in this checkout is `https://hazmat-toolkit-api-75ct.onrender.com` (`Resources/Info.plist:23-24`). Older handoff material may reference `https://hazmat-toolkit-api.onrender.com`; treat that as historical unless the user explicitly switches the target back.
- `git status --short` from the repo root shows a very dirty parent repo with many unrelated modified/deleted/untracked files outside `HazmatTrainee-iOS`. Do not stage broad paths from the parent root without first narrowing the intended files.
- This document did not perform live Render health checks or a simulator run; it is a static architecture and routing map.

## Update 2026-05-04: Sampling + Alarm Visibility

### Sampling Positions (Runtime)
- Physical-device runtime confirmed motion sampling and calibration/band switching work end-to-end (`normal -> high/low -> normal`) using the existing `AppModel` motion + band pipeline.
- Prior simulator failures were environment/runtime-path specific and not an app-logic removal.

### HIGH/LOW Value Fallback (Implemented)
- Problem: some joined zones had no `airMonitorSampling` adjustment payload, so HIGH/LOW position changed the band but did not change values.
- Fix: added fallback band adjustment when the current zone has no sampling adjustments configured.
  - `4 Gas + PID` fallback: `HIGH 12%`, `LOW 18%`
  - `4 Gas` fallback: `HIGH 10%`, `LOW 16%`
  - default fallback remains `HIGH 12%`, `LOW 18%`
- Evidence:
  - `Sources/AppModel.swift` fallback map + selection logic (`FallbackSamplingConfig`, `fallbackSamplingByMonitor`, `fallbackBandAdjustment`)
  - `Sources/AppModel.swift` fallback usage in `adjustedAirMonitorReading(...)` when `zoneHasAnySamplingAdjustment(zone) == false`
  - `Sources/GasSimulatorView.swift` warning text shown when fallback is active

### Alarm Readability Fix (Implemented)
- Problem: in LOW alarm state, metric value text could become low-contrast (e.g., CO tile hard to read).
- Fix: metric value text now remains high-contrast white in alarm states, with improved label/unit contrast.
- Evidence:
  - `Sources/SharedViews.swift` `MetricTile` color updates (`valueColor`, `labelColor`, `unitColor`)
  - same tile component used by CO/O2/H2S/LEL/VOC, so fix applies across sensor configurations.

### Files Changed in This Update Set
- `Sources/AppModel.swift`
- `Sources/GasSimulatorView.swift`
- `Sources/SharedViews.swift`

## New Chat Starter Prompt (Paste-Ready)
"Use `/Users/johnholtan/Library/CloudStorage/OneDrive-lightsonss.com/THMG/Final Files/Final Mapper Files/toolbox-site-archive-2026-03-31/archive/non-ics-collab-2026-03-27/HazmatTrainee-iOS` as the trainee app root and `/Users/johnholtan/Library/CloudStorage/OneDrive-lightsonss.com/THMG/Final Files` as the git root. Execute launch inventory, GitHub mapping, and Render mapping in that order. Evidence-only mappings with file citations; unknowns must remain UNKNOWN and include exact evidence needed to close. The current static API fallback is `HazmatAPIBaseURL=https://hazmat-toolkit-api-75ct.onrender.com` unless live runtime evidence or user direction changes it. Keep runtime findings separate from static facts."
