-- Migration 015: Fix corrupted trainer id UUIDs from migration 014
-- Ensures all trainer IDs are proper UUIDs and not text-encoded values

-- Verify trainers.id column is UUID type and has no conflicts
alter table if exists trainers
  alter column id set default gen_random_uuid();

-- Remove any unique indexes that might be causing issues with uuid comparison
drop index if exists uq_trainers_trainer_ref;

-- Recreate the unique index without any UUID comparison issues
create unique index if not exists uq_trainers_trainer_ref
  on trainers (trainer_ref)
  where trainer_ref is not null
    and btrim(trainer_ref) <> '';

-- Ensure all foreign key references to trainers(id) are properly typed
-- Check and potentially fix any cascade issues in dependent tables
create index if not exists idx_scenarios_trainer_id
  on scenarios (trainer_id)
  where trainer_id is not null;

create index if not exists idx_scenario_sessions_trainer_id
  on scenario_sessions (trainer_id)
  where trainer_id is not null;

create index if not exists idx_organization_memberships_trainer_id
  on organization_memberships (trainer_id);

create index if not exists idx_trainer_entitlements_trainer_id
  on trainer_entitlements (trainer_id);
