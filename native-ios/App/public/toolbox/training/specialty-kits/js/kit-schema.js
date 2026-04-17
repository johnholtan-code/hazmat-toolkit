import { REQUIRED_COLUMNS, ARRAY_FIELDS } from "./constants.js";
import { asTrimmedString, toArray, uid } from "./utils.js";

function normalizeArrayField(value) {
  return toArray(value);
}

function normalizeState(value) {
  const trimmed = asTrimmedString(value).toUpperCase();
  return trimmed.length <= 2 ? trimmed : "";
}

export function ensureLifecycleDefaults(kit) {
  if (!kit.recordStatus) {
    kit.recordStatus = "pending";
  }
  if (!kit.submitterType) {
    kit.submitterType = "self-submitted";
  }
  if (!kit.submittedAt) {
    kit.submittedAt = new Date().toISOString();
  }
  if (!kit.visibility) {
    kit.visibility = kit.recordStatus === "approved" ? "public" : "admin-only";
  }
  if (kit.recordStatus === "approved" && !kit.visibility) {
    kit.visibility = "public";
  }
  if (kit.recordStatus !== "approved" && kit.visibility === "public") {
    kit.visibility = "admin-only";
  }
  return kit;
}

export function normalizeKitRecord(input, options = {}) {
  const record = { ...REQUIRED_COLUMNS, ...(input || {}) };

  const normalized = {
    ...record,
    id: asTrimmedString(record.id) || uid(),
    kitName: asTrimmedString(record.kitName || record.kit_name),
    organizationName: asTrimmedString(record.organizationName || record.organization_name),
    contactName: asTrimmedString(record.contactName || record.contact_name),
    phone: asTrimmedString(record.phone),
    secondaryPhone: asTrimmedString(record.secondaryPhone || record.secondary_phone),
    email: asTrimmedString(record.email),
    website: asTrimmedString(record.website),
    notes: asTrimmedString(record.notes),

    // Location
    addressLine1: asTrimmedString(record.addressLine1 || record.address_line_1),
    addressLine2: asTrimmedString(record.addressLine2 || record.address_line_2),
    city: asTrimmedString(record.city),
    state: normalizeState(record.state),
    zip: asTrimmedString(record.zip),
    region: asTrimmedString(record.region),
    lat: Number.isFinite(Number(record.lat)) ? Number(record.lat) : null,
    lng: Number.isFinite(Number(record.lng)) ? Number(record.lng) : null,
    locationLabel: asTrimmedString(record.locationLabel || record.location_label),
    travelOrServiceAreaNotes: asTrimmedString(
      record.travelOrServiceAreaNotes || record.travel_or_service_area_notes
    ),

    // Kit classification
    kitCategory: asTrimmedString(record.kitCategory || record.kit_category),
    deploymentType: asTrimmedString(record.deploymentType || record.deployment_type),

    // Operational context
    availabilityStatus: asTrimmedString(
      record.availabilityStatus || record.availability_status
    ),
    accessType: asTrimmedString(record.accessType || record.access_type),
    storageEnvironment: asTrimmedString(
      record.storageEnvironment || record.storage_environment
    ),
    transportCapable: asTrimmedString(record.transportCapable || record.transport_capable),
    trailerRequired: asTrimmedString(record.trailerRequired || record.trailer_required),
    responseTeamIncluded: asTrimmedString(
      record.responseTeamIncluded || record.response_team_included
    ),
    trainingRequired: asTrimmedString(record.trainingRequired || record.training_required),
    hoursOfAvailability: asTrimmedString(
      record.hoursOfAvailability || record.hours_of_availability
    ),
    callBeforeUse: asTrimmedString(record.callBeforeUse || record.call_before_use),

    // Descriptive
    manufacturer: asTrimmedString(record.manufacturer),
    modelOrBuild: asTrimmedString(record.modelOrBuild || record.model_or_build),
    quantitySummary: asTrimmedString(record.quantitySummary || record.quantity_summary),
    lastVerifiedAt: asTrimmedString(record.lastVerifiedAt || record.last_verified_at) || null,

    // Moderation / lifecycle
    recordStatus: asTrimmedString(record.record_status || record.recordStatus || "pending"),
    submittedAt: asTrimmedString(record.submittedAt || record.submitted_at) || new Date().toISOString(),
    reviewedAt: asTrimmedString(record.reviewedAt || record.reviewed_at) || null,
    reviewedBy: asTrimmedString(record.reviewedBy || record.reviewed_by),
    rejectionReason: asTrimmedString(record.rejectionReason || record.rejection_reason),
    submitterType: asTrimmedString(
      record.submitterType || record.submitter_type || "self-submitted"
    ),
    visibility: asTrimmedString(record.visibility || ""),
    createdAt: asTrimmedString(record.createdAt || record.created_at) || new Date().toISOString(),
    updatedAt: asTrimmedString(record.updatedAt || record.updated_at) || new Date().toISOString()
  };

  ARRAY_FIELDS.forEach((field) => {
    const snake = field.replace(/[A-Z]/g, (match) => `_${match.toLowerCase()}`);
    normalized[field] = normalizeArrayField(record[field] ?? record[snake]);
  });

  ensureLifecycleDefaults(normalized);

  if (options.forSubmission && !normalized.submittedAt) {
    normalized.submittedAt = new Date().toISOString();
  }

  return normalized;
}

export function normalizeKitArray(records) {
  return (records || []).map((record) => normalizeKitRecord(record));
}

export function kitToDbRow(kit) {
  const normalized = normalizeKitRecord(kit);
  return {
    id: normalized.id,
    kit_name: normalized.kitName,
    organization_name: normalized.organizationName,
    contact_name: normalized.contactName,
    phone: normalized.phone,
    secondary_phone: normalized.secondaryPhone,
    email: normalized.email,
    website: normalized.website,
    notes: normalized.notes,

    address_line_1: normalized.addressLine1,
    address_line_2: normalized.addressLine2,
    city: normalized.city,
    state: normalized.state,
    zip: normalized.zip,
    region: normalized.region,
    lat: normalized.lat,
    lng: normalized.lng,
    location_label: normalized.locationLabel,
    travel_or_service_area_notes: normalized.travelOrServiceAreaNotes,

    kit_category: normalized.kitCategory,
    kit_types: normalized.kitTypes,
    hazard_focus: normalized.hazardFocus,
    equipment_capabilities: normalized.equipmentCapabilities,
    deployment_type: normalized.deploymentType,

    availability_status: normalized.availabilityStatus,
    access_type: normalized.accessType,
    storage_environment: normalized.storageEnvironment,
    transport_capable: normalized.transportCapable,
    trailer_required: normalized.trailerRequired,
    response_team_included: normalized.responseTeamIncluded,
    training_required: normalized.trainingRequired,
    hours_of_availability: normalized.hoursOfAvailability,
    call_before_use: normalized.callBeforeUse,

    manufacturer: normalized.manufacturer,
    model_or_build: normalized.modelOrBuild,
    quantity_summary: normalized.quantitySummary,
    last_verified_at: normalized.lastVerifiedAt || null,

    record_status: normalized.recordStatus,
    submitted_at: normalized.submittedAt || new Date().toISOString(),
    reviewed_at: normalized.reviewedAt || null,
    reviewed_by: normalized.reviewedBy || null,
    rejection_reason: normalized.rejectionReason || null,
    submitter_type: normalized.submitterType,
    visibility: normalized.visibility
  };
}
