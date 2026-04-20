-- Migration 016: Fix btrim function errors in trainer indexes
-- Remove btrim from unique index predicates to avoid UUID type issues

-- Drop the problematic unique index
drop index if exists uq_trainers_trainer_ref;

-- Recreate without btrim in the WHERE clause
create unique index if not exists uq_trainers_trainer_ref
  on trainers (trainer_ref)
  where trainer_ref is not null;

-- Ensure email index is clean as well
drop index if exists uq_trainers_email_lower;

create unique index if not exists uq_trainers_email_lower
  on trainers (lower(email))
  where email is not null;
