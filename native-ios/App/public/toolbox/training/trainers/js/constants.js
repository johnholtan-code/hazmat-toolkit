export const TABLE_NAME = "trainers";

export const RECORD_STATUS = ["pending", "approved", "rejected"];
export const VISIBILITY = ["public", "admin-only"];
export const SUBMITTER_TYPE = ["self-submitted", "admin-created", "imported"];

export const DISCIPLINE_OPTIONS = [
  "Fire Suppression",
  "Hazardous Materials",
  "Rescue",
  "Incident Command",
  "Industrial Safety",
  "EMS"
];

export const HAZMAT_SPECIALTY_OPTIONS = [
  "Air Monitoring",
  "LNG / Natural Gas",
  "CO2 / Cryogenics",
  "Rail Incidents",
  "Tanker / Cargo Tank",
  "Pipeline Emergencies",
  "WMD / Terrorism",
  "Decon",
  "Foam Operations",
  "Battery / EV Incidents"
];

export const TRAVEL_CAPABILITY_OPTIONS = ["Local Only", "Regional", "National", "International"];

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

export const CERTIFICATION_OPTIONS = [
  "NFPA 470 Hazmat Technician",
  "NFPA 470 Hazmat Specialist",
  "Instructor I",
  "Instructor II",
  "Instructor III",
  "OSHA HAZWOPER Trainer",
  "ICS 300",
  "ICS 400",
  "State-Certified Instructor",
  "TEEX Affiliated",
  "LSU FETI Affiliated",
  "NFA Affiliated"
];

export const EXPERIENCE_LEVEL_OPTIONS = ["Under 5 Years", "5 to 10 Years", "10 to 20 Years", "20+ Years"];

export const BACKGROUND_OPTIONS = [
  "Fire Department",
  "Industrial",
  "Military",
  "Law Enforcement",
  "Private Contractor",
  "Emergency Management",
  "EMS"
];

export const INDUSTRY_EXPERIENCE_OPTIONS = [
  "Oil and Gas",
  "Pipeline",
  "Chemical Plants",
  "Railroads",
  "Agriculture",
  "Maritime / Port",
  "Utilities",
  "Transportation",
  "Public Sector",
  "Healthcare"
];

export const TRAINING_TYPE_OPTIONS = [
  "Classroom",
  "Hands-On / Field",
  "Full-Scale Exercises",
  "Tabletop",
  "Virtual / Online",
  "Augmented Reality"
];

export const CLASS_SIZE_OPTIONS = ["Small Group", "Mid-Size Group", "Large Group", "Conference / Keynote"];

export const CUSTOM_CURRICULUM_OPTIONS = ["Yes", "No", "Pre-Built Only", "Fully Customizable"];

export const AVAILABILITY_OPTIONS = ["Available This Month", "1 to 3 Months Out", "3+ Months Out"];

export const STATE_OPTIONS = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY", "DC"
];

export const ARRAY_FIELDS = [
  "discipline",
  "hazmatSpecialties",
  "certifications",
  "background",
  "industryExperience",
  "trainingType"
];

export const SINGLE_FILTER_FIELDS = [
  "travelCapability",
  "state",
  "region",
  "experienceLevel",
  "classSize",
  "customCurriculum",
  "availability"
];

export const SEARCHABLE_FIELDS = [
  "name",
  "org",
  "specialty",
  "topics",
  "notes",
  "discipline",
  "hazmatSpecialties",
  "certifications",
  "background",
  "industryExperience",
  "trainingType",
  "state",
  "region"
];

export const DEFAULT_US_VIEW = {
  center: [39.8283, -98.5795],
  zoom: 4
};

export const REQUIRED_COLUMNS = {
  id: "",
  name: "",
  org: "",
  email: "",
  phone: "",
  specialty: "",
  topics: "",
  notes: "",
  lat: null,
  lng: null,
  locationLabel: "",
  discipline: [],
  hazmatSpecialties: [],
  travelCapability: "",
  state: "",
  region: "",
  certifications: [],
  experienceLevel: "",
  background: [],
  industryExperience: [],
  trainingType: [],
  classSize: "",
  customCurriculum: "",
  availability: "",
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
