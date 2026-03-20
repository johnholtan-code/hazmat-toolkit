-- Migration 006: revokable viewer access for collaborative ICS map sessions

alter table collab_map_sessions
  add column if not exists viewer_access_enabled boolean not null default true;
