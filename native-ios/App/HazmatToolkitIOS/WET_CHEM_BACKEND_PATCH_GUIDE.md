# Wet Chemistry Backend Patch Guide

## Scope
Fix wet chemistry oxidizer persistence for shape upsert/read endpoints.

## 1) Request Normalization
In your shape upsert handler:
- Accept both snake_case and camelCase during migration.
- Normalize to snake_case fields in server memory.

Canonical fields:
- `oxidizer_enabled`
- `oxidizer_target_type`
- `oxidizer_concentration_ppm`
- `oxidizer_sample_ph`
- `oxidizer_reaction_result`
- `oxidizer_reaction_pattern`
- `oxidizer_reaction_duration_seconds`
- `oxidizer_fact_text_override`

## 2) Upsert SQL
Ensure `INSERT`/`UPDATE` writes canonical values to dedicated columns.
Do not rely only on `properties_json`.

Pseudo-shape for SQL params:
- `:oxidizer_enabled`
- `:oxidizer_target_type`
- `:oxidizer_concentration_ppm`
- `:oxidizer_sample_ph`
- `:oxidizer_reaction_result`
- `:oxidizer_reaction_pattern`
- `:oxidizer_reaction_duration_seconds`
- `:oxidizer_fact_text_override`

If you still maintain `properties_json`, write only snake_case keys there to avoid drift.

## 3) Read Query + Serializer
`GET /v1/scenarios/{scenarioId}/shapes` must select and serialize all `oxidizer_*` columns.

Optional migration fallback (temporary):
- If column is null, fallback to `properties_json` snake_case/camelCase key.
- Remove fallback after backfill window.

## 4) One-time Backfill
Run:
- [WET_CHEM_BACKEND_MIGRATION.sql](/Volumes/Crucial X9/toolbox-site/native-ios/App/HazmatToolkitIOS/WET_CHEM_BACKEND_MIGRATION.sql)

## 5) Verification
1. Save wet chemistry polygon from iOS Trainer app.
2. Confirm row has non-null `oxidizer_*` columns.
3. Confirm shape response returns those values.
4. Exit/re-enter scenario in Trainer app.
5. Confirm values persist and no warning appears.

## 6) Known iOS Diagnostic Behavior
Trainer app currently raises:
`Wet chemistry values were not persisted by the backend. Saved shape returned without oxidizer fields.`

That warning should disappear once backend write+read paths are fixed.
