# Hazmat ToolKIT Trainee THMG -> Native iOS (Xcode) Review

## What was reviewed

Source package reviewed from the provided Power App `.msapp` export:
- `/Users/johnholtan/Library/CloudStorage/OneDrive-lightsonss.com/THMG_1_0_0_8/CanvasApps/new_hazmattoolkittraineethmg_aba1a_DocumentUri.msapp`
- Companion files:
  - `/Users/johnholtan/Library/CloudStorage/OneDrive-lightsonss.com/THMG_1_0_0_8/CanvasApps/new_hazmattoolkittraineethmg_aba1a_BackgroundImageUri`
  - `/Users/johnholtan/Library/CloudStorage/OneDrive-lightsonss.com/THMG_1_0_0_8/CanvasApps/new_hazmattoolkittraineethmg_aba1a_AdditionalUris0_identity.json`

The `.msapp` is a ZIP archive and was extracted to:
- `/Users/johnholtan/Library/CloudStorage/OneDrive-lightsonss.com/THMG/Final Files/Final Mapper Files/toolbox-site/powerapp_extracted`

## Key findings (Power App behavior)

### App metadata
- App name: `Hazmat ToolKIT Trainee THMG`
- Publish target: `player`
- `PublishResourcesLocally: false`
- `PublishDataLocally: false`
- Background color: `rgba(243, 202, 62, 1)`

Source: `/Users/johnholtan/Library/CloudStorage/OneDrive-lightsonss.com/THMG/Final Files/Final Mapper Files/toolbox-site/powerapp_extracted/Resources/PublishInfo.json`

### Extracted content inventory
- `10` Power Apps source YAML files in `/powerapp_extracted/Src`
- `9` control JSON files in `/powerapp_extracted/Controls`
- `6` bundled images in `/powerapp_extracted/Assets/Images`
- `3` bundled audio files in `/powerapp_extracted/Assets/Audio`

### Screen flow found in the Power App
- `scrSplash` -> auto timer (3000 ms) navigates to `scrHome`
- `scrHome` -> trainee enters name, then `Navigate(scrScenarios)`
- `scrScenarios` -> scenario search/list from Dataverse table `GeoSim Scenarios`
- `scrTools` -> tool search/list from `colMonitors`
- Tool routing:
  - `Radiation Monitor` -> `scrSimulator_Rad`
  - `pH Paper` -> `scrSimulator_pH`
  - all other monitors -> `scrSimulator`

Sources:
- `/Users/johnholtan/Library/CloudStorage/OneDrive-lightsonss.com/THMG/Final Files/Final Mapper Files/toolbox-site/powerapp_extracted/Src/scrSplash.pa.yaml`
- `/Users/johnholtan/Library/CloudStorage/OneDrive-lightsonss.com/THMG/Final Files/Final Mapper Files/toolbox-site/powerapp_extracted/Src/scrHome.pa.yaml`
- `/Users/johnholtan/Library/CloudStorage/OneDrive-lightsonss.com/THMG/Final Files/Final Mapper Files/toolbox-site/powerapp_extracted/Src/scrScenarios.pa.yaml`
- `/Users/johnholtan/Library/CloudStorage/OneDrive-lightsonss.com/THMG/Final Files/Final Mapper Files/toolbox-site/powerapp_extracted/Src/scrTools.pa.yaml`

### Data sources and dependency risk (important)
The Power App depends on Dataverse tables and does not ship the live rows in the `.msapp` package. This means a 1:1 native conversion requires Dataverse authentication + API integration to fetch actual scenarios/geofences.

Referenced entities found in `DataSources.json`:
- `GeoSim Scenarios`
- `GeoSims`
- `GeoTrackings`

Relevant field mappings found (used by simulator logic):
- `Scenario Name`
- `Scenario Date`
- `ShapeGeoJSON`
- `Oxygen`
- `LEL`
- `Carbon Monoxide`
- `Hydrogen Sulfide`
- `PID`
- `pH`
- `RadLatitude`
- `RadLongitude`
- `Detection Device`

Source: `/Users/johnholtan/Library/CloudStorage/OneDrive-lightsonss.com/THMG/Final Files/Final Mapper Files/toolbox-site/powerapp_extracted/References/DataSources.json`

### Simulator logic identified
- Gas simulator alarm thresholds found in `scrSimulator.pa.yaml`:
  - O2 `< 19.5` or `> 23.4`
  - LEL `> 10`
  - CO `> 35`
  - H2S `> 10`
  - PID `> 50`
- pH simulator color/fact mapping is initialized in `App.pa.yaml` and used in `scrSimulator_pH.pa.yaml`
- Tool screen parses `ShapeGeoJSON` (polygon and point+circle) into local polygon collections for geofence simulation

## What was created (native iOS / Xcode)

New project created here:
- `/Users/johnholtan/Library/CloudStorage/OneDrive-lightsonss.com/THMG/Final Files/Final Mapper Files/toolbox-site/HazmatTrainee-iOS`

Includes:
- SwiftUI app + `xcodegen` project spec (`project.yml`)
- Real `.xcodeproj` (generated from `xcodegen`)
- Native screens matching the Power App flow:
  - splash
  - home (trainee name)
  - scenarios list + confirm
  - tools list + confirm
  - gas simulator (4-gas and 4-gas+PID modes)
  - radiation simulator
  - pH simulator
- Local sample scenario JSON (`SampleScenarios.json`) to replace missing Dataverse rows for offline/native testing
- Dataverse integration placeholder (`DataverseClient.swift` and `DataverseConfig.example.plist`) for future live data wiring
- Reused Power App image assets (logos)

## Conversion scope note
This is a native SwiftUI reimplementation based on the extracted Power App behavior and assets, not an automatic binary conversion of Power Apps formulas into native Swift code. The main blocker to exact parity is the missing live Dataverse scenario records/geofence geometry from the export package.
