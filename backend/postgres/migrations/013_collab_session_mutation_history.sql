-- Migration 013: Allow collaborative session-level edits in mutation history

alter table if exists collab_map_mutations
  alter column object_id drop not null;

alter table if exists collab_map_mutations
  drop constraint if exists chk_collab_mutation_type;

alter table if exists collab_map_mutations
  add constraint chk_collab_mutation_type
  check (mutation_type in ('create', 'update', 'delete', 'session'));
