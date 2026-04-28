# Hazmat Trainer -> Trainee Handoff

## Goal
Use this as the contract reference for integrating/testing the Trainee app against the same backend the Trainer app uses.

## Connection Overview
1. `AppStore` chooses data source:
- API mode: `HazmatDataSource=api` (or env `HAZMAT_DATA_SOURCE=api`) -> `APIHazmatRepository`
- otherwise -> `MockHazmatRepository`

2. API mode requires:
- `HazmatAPIBaseURL` (or env `HAZMAT_API_BASE_URL`)
- optional `HazmatTrainerRef` (or env `HAZMAT_TRAINER_REF`) sent as `X-Trainer-Ref`

3. `HazmatRepository` contract:
- scenarios CRUD
- shapes CRUD
- tracking fetch
- tracking review fetch

4. Current repository implementations:
- `APIHazmatRepository`: active backend path
- `MockHazmatRepository`: in-memory test seed
- `DataverseHazmatRepository`: currently not implemented

## API Client Conventions
- JSON encode: snake_case
- JSON decode: snake_case -> camelCase
- Dates: ISO-8601
- Auth header when signed in: `Authorization: Bearer <token>`

## Trainer Endpoints in Use
- `GET /v1/scenarios`
- `POST /v1/scenarios`
- `PATCH /v1/scenarios/{scenarioId}`
- `DELETE /v1/scenarios/{scenarioId}`
- `GET /v1/scenarios/{scenarioId}/shapes`
- `POST /v1/scenarios/{scenarioId}/shapes`
- `PUT /v1/scenarios/{scenarioId}/shapes/{shapeId}`
- `DELETE /v1/scenarios/{scenarioId}/shapes/{shapeId}`
- `GET /v1/watch/tracking?scenarioName=...`
- `GET /v1/sessions/{sessionId}/watch/participants`
- `GET /v1/sessions/{sessionId}/watch/tracking`
- `GET /v1/sessions/{sessionId}/watch/zone-events`
- `POST /v1/sessions`
- `POST /v1/sessions/{sessionId}/rotate-join-code`
- `POST /v1/sessions/{sessionId}/start`
- `POST /v1/sessions/{sessionId}/end`

## Trainee MVP Endpoints
### 1) Join session
`POST /v1/sessions/join`

Request:
```json
{
  "join_code": "ABC123",
  "trainee_name": "Trainee 01",
  "device_type": "air_monitor"
}
```

Response shape (important fields):
```json
{
  "session": {
    "id": "UUID",
    "status": "scheduled|live|ended|cancelled",
    "starts_at": "ISO8601 or null"
  },
  "participant": {
    "id": "UUID",
    "trainee_name": "string",
    "device_type": "air_monitor|radiation_detection|ph_paper|wet_chemistry_paper"
  },
  "token": {
    "access_token": "jwt",
    "expires_at": "ISO8601"
  },
  "snapshot": {
    "session_id": "UUID",
    "scenario": { "...": "APIScenarioDTO fields" },
    "shapes": ["APIShapeDTO"],
    "rules": {
      "overlap_priority": "string"
    }
  }
}
```

### 2) Upload tracking batch
`POST /v1/tracking/batches`

Request:
```json
{
  "batch_id": "UUID",
  "points": [
    {
      "client_point_id": "UUID",
      "recorded_at": "2026-04-27T19:00:00Z",
      "lat": 29.7604,
      "lon": -95.3698,
      "accuracy_m": 6.2,
      "speed_mps": 1.2,
      "heading_deg": 180.0,
      "active_shape_id": "UUID or null",
      "active_shape_sort_order": 1
    }
  ]
}
```

Response:
```json
{
  "accepted": 1,
  "duplicates": 0,
  "server_time": "2026-04-27T19:00:01Z"
}
```

## Key Data Models
### Detection device values expected by API
- `air_monitor`
- `radiation_detection`
- `ph_paper`
- `wet_chemistry_paper`

### Scenario fields
- `id`, `scenario_name`, `trainer_name`, `scenario_date`
- `latitude?`, `longitude?`
- `detection_device`
- `version?`, `created_at`, `updated_at?`

### Shape fields
Core required:
- `id`, `scenario_id`, `description`, `kind`, `sort_order`, `shape_geo_json`

Optional groups by mode:
- air: `oxygen`, `lel`, `carbon_monoxide`, `hydrogen_sulfide`, `pid`
- chem: `chemical_readings[]` with `{id,name,abbr,value,unit}`
- radiation: `dose_rate`, `background`, `shielding`, `rad_latitude`, `rad_longitude`, `rad_dose_unit`, `rad_exposure_unit`
- pH/oxidizer: `p_h`, `oxidizer_enabled`, `oxidizer_target_type`, `oxidizer_concentration_ppm`, `oxidizer_sample_ph`, `oxidizer_reaction_result`, `oxidizer_reaction_pattern`, `oxidizer_reaction_duration_seconds`, `oxidizer_fact_text_override`
- sampling controls: `*_sampling_mode`, `*_feather_percent`

## End-to-End Test Flow
1. Configure Trainer app in API mode.
2. Trainer sign-in succeeds.
3. Create scenario + at least one shape in Trainer app.
4. Trainer creates session and gets join code.
5. Trainee app calls `/v1/sessions/join` with that code.
6. Trainee app posts `/v1/tracking/batches` repeatedly with unique IDs.
7. Trainer watch endpoints show participant, points, and zone events.
8. Rotate join code and confirm old code no longer joins.
9. End session and confirm trainee handles closed session.

## Known Gaps
- Dataverse path is stubbed (`notImplemented`).
- Only 4 devices are API-mapped today.
- Some watch/tracking data transformations are legacy-shaped for current UI expectations.
