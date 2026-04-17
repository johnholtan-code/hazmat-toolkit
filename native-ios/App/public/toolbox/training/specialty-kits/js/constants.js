export const TABLE_NAME = "specialty_kits";

export const RECORD_STATUS = ["pending", "approved", "rejected"];
export const VISIBILITY = ["public", "admin-only"];
export const SUBMITTER_TYPE = ["self-submitted", "admin-created"];

// Kit classification
export const KIT_CATEGORY_OPTIONS = [
  "Leak Control Kit",
  "Plug and Patch Kit",
  "Overpack / Containment",
  "Transfer / Flare Kit",
  "Foam / Suppression Kit",
  "Decon Kit",
  "Air Monitoring Kit",
  "Rail Response Kit",
  "Pipeline Response Kit",
  "Waterway / Marine Spill Kit",
  "Battery / EV Incident Kit",
  "General Hazmat Response Kit",
  "Firefighting Specialty Kit"
];

export const KIT_TYPE_OPTIONS = [
  "Propane",
  "LNG",
  "Natural Gas",
  "Chlorine",
  "Ammonia",
  "Flammable Liquid",
  "Corrosive",
  "Oxidizer",
  "Cryogenic",
  "Railcar",
  "Cargo Tank",
  "Drum",
  "Cylinder",
  "Battery / EV",
  "Marine Spill"
];

export const HAZARD_FOCUS_OPTIONS = [
  "Flammable Gas",
  "Flammable Liquid",
  "Toxic Inhalation Hazard",
  "Corrosive Materials",
  "Cryogenic Materials",
  "Oxidizers",
  "Unknown Hazmat",
  "WMD / Terrorism",
  "Industrial Fire",
  "Lithium-Ion Battery"
];

export const EQUIPMENT_CAPABILITIES_OPTIONS = [
  "Leak Control",
  "Product Transfer",
  "Flaring",
  "Vapor Control",
  "Foam Application",
  "Decontamination",
  "Monitoring Support",
  "Plugging / Patching",
  "Overpacking",
  "Water Injection",
  "Tank Cooling Support"
];

export const DEPLOYMENT_TYPE_OPTIONS = [
  "Fixed Location",
  "Trailer-Based",
  "Vehicle-Mounted",
  "Cache / Warehouse",
  "Team-Deployed"
];

export const AVAILABILITY_STATUS_OPTIONS = [
  "Available 24/7",
  "Business Hours Only",
  "Call Ahead Required",
  "Limited Availability",
  "Temporarily Unavailable"
];

export const ACCESS_TYPE_OPTIONS = [
  "Mutual Aid",
  "Agency-Owned",
  "Private Company Approval Required",
  "Contractor Deployment Required",
  "Public Safety Request Required"
];

export const STORAGE_ENVIRONMENT_OPTIONS = [
  "Fire Station",
  "Training Center",
  "Industrial Facility",
  "Warehouse",
  "Trailer Yard",
  "Mobile Unit"
];

export const TRANSPORT_CAPABLE_OPTIONS = [
  "Yes",
  "No",
  "Depends on Request"
];

export const TRAILER_REQUIRED_OPTIONS = [
  "Yes",
  "No"
];

export const RESPONSE_TEAM_INCLUDED_OPTIONS = [
  "Yes",
  "No",
  "Optional"
];

export const TRAINING_REQUIRED_OPTIONS = [
  "Yes",
  "No",
  "Recommended"
];

export const CALL_BEFORE_USE_OPTIONS = [
  "Yes",
  "No"
];

export const REGION_OPTIONS = [
  "Northeast",
  "Southeast",
  "Midwest",
  "South Central",
  "Mountain West",
  "Southwest",
  "West Coast",
  "Mid-Atlantic",
  "Great Plains"
];

export const STATE_OPTIONS = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY", "DC"
];

// Field groupings for filtering and normalization
export const ARRAY_FIELDS = [
  "kitTypes",
  "hazardFocus",
  "equipmentCapabilities"
];

export const SINGLE_SELECT_FIELDS = [
  "kitCategory",
  "deploymentType",
  "availabilityStatus",
  "accessType",
  "storageEnvironment",
  "transportCapable",
  "trailerRequired",
  "responseTeamIncluded",
  "trainingRequired",
  "callBeforeUse",
  "state",
  "region"
];

export const SEARCHABLE_FIELDS = [
  "kitName",
  "organizationName",
  "contactName",
  "email",
  "website",
  "notes",
  "kitCategory",
  "kitTypes",
  "hazardFocus",
  "equipmentCapabilities",
  "manufacturer",
  "modelOrBuild",
  "quantitySummary",
  "state",
  "region"
];

export const DEFAULT_US_VIEW = {
  center: [39.8283, -98.5795],
  zoom: 4
};

export const REQUIRED_COLUMNS = {
  id: "",
  kitName: "",
  organizationName: "",
  contactName: "",
  phone: "",
  secondaryPhone: "",
  email: "",
  website: "",
  notes: "",

  // Location
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  zip: "",
  region: "",
  lat: null,
  lng: null,
  locationLabel: "",
  travelOrServiceAreaNotes: "",

  // Kit classification
  kitCategory: "",
  kitTypes: [],
  hazardFocus: [],
  equipmentCapabilities: [],
  deploymentType: "",

  // Operational context
  availabilityStatus: "",
  accessType: "",
  storageEnvironment: "",
  transportCapable: "",
  trailerRequired: "",
  responseTeamIncluded: "",
  trainingRequired: "",
  hoursOfAvailability: "",
  callBeforeUse: "",

  // Descriptive
  manufacturer: "",
  modelOrBuild: "",
  quantitySummary: "",
  lastVerifiedAt: "",

  // Moderation / lifecycle
  recordStatus: "pending",
  submittedAt: "",
  reviewedAt: "",
  reviewedBy: "",
  rejectionReason: "",
  submitterType: "self-submitted",
  visibility: "admin-only",
  createdAt: "",
  updatedAt: ""
};
