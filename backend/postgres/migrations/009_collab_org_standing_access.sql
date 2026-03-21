create table if not exists collab_org_standing_access (
  source_organization_id uuid not null references collab_organizations(id) on delete cascade,
  target_organization_id uuid not null references collab_organizations(id) on delete cascade,
  created_by_trainer_ref text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (source_organization_id, target_organization_id),
  constraint chk_collab_org_standing_access_self check (source_organization_id <> target_organization_id)
);

create index if not exists idx_collab_org_standing_access_target
  on collab_org_standing_access (target_organization_id, created_at desc);

drop trigger if exists trg_collab_org_standing_access_updated_at on collab_org_standing_access;
create trigger trg_collab_org_standing_access_updated_at
before update on collab_org_standing_access
for each row execute function set_updated_at();
