-- Migration 014: Harden trainers schema compatibility for auth + ICS collaboration

create extension if not exists pgcrypto;

alter table if exists trainers
  add column if not exists trainer_ref text,
  add column if not exists email text,
  add column if not exists display_name text,
  add column if not exists name text,
  add column if not exists is_active boolean not null default true,
  add column if not exists password_hash text,
  add column if not exists last_login_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

update trainers
set id = gen_random_uuid()
where id is null
  or btrim(id::text) = '';

update trainers
set email = lower(email)
where email is not null
  and email <> lower(email);

update trainers
set trainer_ref = lower(coalesce(nullif(btrim(trainer_ref), ''), email))
where trainer_ref is null
  or btrim(trainer_ref) = '';

update trainers
set display_name = coalesce(
  nullif(btrim(display_name), ''),
  nullif(btrim(name), ''),
  split_part(coalesce(email, trainer_ref, 'trainer'), '@', 1),
  'Trainer'
)
where display_name is null
  or btrim(display_name) = '';

update trainers
set name = coalesce(
  nullif(btrim(name), ''),
  nullif(btrim(display_name), ''),
  split_part(coalesce(email, trainer_ref, 'trainer'), '@', 1),
  'Trainer'
)
where name is null
  or btrim(name) = '';

update trainers
set is_active = true
where is_active is null;

with ranked as (
  select
    id,
    trainer_ref,
    row_number() over (
      partition by trainer_ref
      order by created_at nulls last, id
    ) as row_num
  from trainers
  where trainer_ref is not null
    and btrim(trainer_ref) <> ''
)
update trainers t
set trainer_ref = t.trainer_ref || '-' || left(t.id::text, 8)
from ranked r
where t.id = r.id
  and r.row_num > 1;

create unique index if not exists uq_trainers_trainer_ref
  on trainers (trainer_ref)
  where trainer_ref is not null
    and btrim(trainer_ref) <> '';

create unique index if not exists uq_trainers_email_lower
  on trainers (lower(email))
  where email is not null;

