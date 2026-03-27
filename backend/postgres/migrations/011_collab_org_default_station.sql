-- Migration 011: default station profile and mileage rate for collaborative ICS organizations

alter table collab_organizations
  add column if not exists station_name text,
  add column if not exists station_address text,
  add column if not exists station_lat numeric(9, 6),
  add column if not exists station_lng numeric(9, 6),
  add column if not exists default_mileage_rate numeric(10, 2);

alter table collab_organizations
  drop constraint if exists chk_collab_org_station_lat,
  add constraint chk_collab_org_station_lat
    check (station_lat is null or (station_lat >= -90 and station_lat <= 90));

alter table collab_organizations
  drop constraint if exists chk_collab_org_station_lng,
  add constraint chk_collab_org_station_lng
    check (station_lng is null or (station_lng >= -180 and station_lng <= 180));

alter table collab_organizations
  drop constraint if exists chk_collab_org_default_mileage_rate,
  add constraint chk_collab_org_default_mileage_rate
    check (default_mileage_rate is null or default_mileage_rate >= 0);
