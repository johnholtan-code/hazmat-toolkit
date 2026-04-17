-- Specialty Kits table
-- For moderated public directory of hazmat response kits

CREATE TABLE IF NOT EXISTS specialty_kits (
  id TEXT PRIMARY KEY,
  
  -- Contact and Organization
  kit_name TEXT NOT NULL,
  organization_name TEXT NOT NULL,
  contact_name TEXT,
  phone TEXT,
  secondary_phone TEXT,
  email TEXT,
  website TEXT,
  notes TEXT,

  -- Location
  address_line_1 TEXT,
  address_line_2 TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  region TEXT,
  lat NUMERIC,
  lng NUMERIC,
  location_label TEXT,
  travel_or_service_area_notes TEXT,

  -- Kit Classification
  kit_category TEXT,
  kit_types TEXT[], -- Array: Propane, LNG, Natural Gas, etc.
  hazard_focus TEXT[], -- Array: Flammable Gas, Toxic Inhalation, etc.
  equipment_capabilities TEXT[], -- Array: Leak Control, Product Transfer, etc.
  deployment_type TEXT,

  -- Operational Context
  availability_status TEXT,
  access_type TEXT,
  storage_environment TEXT,
  transport_capable TEXT,
  trailer_required TEXT,
  response_team_included TEXT,
  training_required TEXT,
  hours_of_availability TEXT,
  call_before_use TEXT,

  -- Descriptive
  manufacturer TEXT,
  model_or_build TEXT,
  quantity_summary TEXT,
  last_verified_at TIMESTAMPTZ,

  -- Moderation / Lifecycle
  record_status TEXT DEFAULT 'pending', -- pending, approved, rejected
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by TEXT,
  rejection_reason TEXT,
  submitter_type TEXT DEFAULT 'self-submitted', -- self-submitted, admin-created
  visibility TEXT DEFAULT 'admin-only', -- public, admin-only

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for public queries (approved kits)
CREATE INDEX IF NOT EXISTS idx_specialty_kits_status_visibility 
  ON specialty_kits(record_status, visibility);

-- Index for location-based queries
CREATE INDEX IF NOT EXISTS idx_specialty_kits_location
  ON specialty_kits(state, region, lat, lng) 
  WHERE record_status = 'approved';

-- Index for searches
CREATE INDEX IF NOT EXISTS idx_specialty_kits_org
  ON specialty_kits(organization_name);

CREATE INDEX IF NOT EXISTS idx_specialty_kits_kit_name
  ON specialty_kits(kit_name);
