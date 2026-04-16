const TABLE_NAME = "trainers";

const DISCIPLINE_OPTIONS = [
  "Fire Suppression",
  "Hazardous Materials",
  "Rescue",
  "Incident Command",
  "Industrial Safety",
  "EMS"
];

const HAZMAT_SPECIALTY_OPTIONS = [
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

const TRAVEL_CAPABILITY_OPTIONS = ["Local Only", "Regional", "National", "International"];

const REGION_OPTIONS = [
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

const CERTIFICATION_OPTIONS = [
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

const EXPERIENCE_LEVEL_OPTIONS = ["Under 5 Years", "5 to 10 Years", "10 to 20 Years", "20+ Years"];

const BACKGROUND_OPTIONS = [
  "Fire Department",
  "Industrial",
  "Military",
  "Law Enforcement",
  "Private Contractor",
  "Emergency Management",
  "EMS"
];

const INDUSTRY_EXPERIENCE_OPTIONS = [
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

const TRAINING_TYPE_OPTIONS = [
  "Classroom",
  "Hands-On / Field",
  "Full-Scale Exercises",
  "Tabletop",
  "Virtual / Online",
  "Augmented Reality"
];

const CLASS_SIZE_OPTIONS = ["Small Group", "Mid-Size Group", "Large Group", "Conference / Keynote"];
const CUSTOM_CURRICULUM_OPTIONS = ["Yes", "No", "Pre-Built Only", "Fully Customizable"];
const AVAILABILITY_OPTIONS = ["Available This Month", "1 to 3 Months Out", "3+ Months Out"];

const STATE_OPTIONS = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY", "DC"
];

const COLLAPSIBLE_FILTER_GROUPS = new Set([
  "training classification",
  "geography / travel",
  "credentials / experience",
  "delivery / budget / availability"
]);

const ARRAY_FIELDS = [
  "discipline",
  "hazmatSpecialties",
  "certifications",
  "background",
  "industryExperience",
  "trainingType"
];

const SINGLE_FILTER_FIELDS = [
  "travelCapability",
  "state",
  "region",
  "experienceLevel",
  "classSize",
  "customCurriculum",
  "availability"
];

const SEARCHABLE_FIELDS = [
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

const DEFAULT_US_VIEW = {
  center: [39.8283, -98.5795],
  zoom: 4
};

function escapeHtml(input) {
  return String(input ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function toArray(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? "").trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function asTrimmedString(value) {
  return String(value ?? "").trim();
}

function createOption(label, value = label) {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = label;
  return option;
}

function createCheckbox(name, value, checked = false) {
  const label = document.createElement("label");
  label.className = "checkItem";
  label.innerHTML = `<input type="checkbox" name="${escapeHtml(name)}" value="${escapeHtml(value)}" ${checked ? "checked" : ""}/> <span>${escapeHtml(value)}</span>`;
  return label;
}

function debounce(fn, delay = 180) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

function setStatus(el, msg, kind = "info") {
  if (!el) {
    return;
  }
  const klass = kind === "ok" ? "ok" : kind === "bad" ? "bad" : "";
  el.innerHTML = `<strong>Status:</strong> <span class="${klass}">${escapeHtml(msg)}</span>`;
}

function joinSummary(values, max = 3) {
  const list = toArray(values);
  if (!list.length) {
    return "";
  }
  if (list.length <= max) {
    return list.join(", ");
  }
  return `${list.slice(0, max).join(", ")} +${list.length - max} more`;
}

function normalizeTrainerRecord(input) {
  const record = { ...(input || {}) };
  const normalized = {
    ...record,
    id: asTrimmedString(record.id),
    name: asTrimmedString(record.name),
    org: asTrimmedString(record.org),
    email: asTrimmedString(record.email),
    phone: asTrimmedString(record.phone),
    specialty: asTrimmedString(record.specialty),
    topics: asTrimmedString(record.topics),
    notes: asTrimmedString(record.notes),
    lat: Number.isFinite(Number(record.lat)) ? Number(record.lat) : null,
    lng: Number.isFinite(Number(record.lng)) ? Number(record.lng) : null,
    locationLabel: asTrimmedString(record.locationLabel || record.location_label),
    travelCapability: asTrimmedString(record.travelCapability || record.travel_capability),
    state: asTrimmedString(record.state).toUpperCase(),
    region: asTrimmedString(record.region),
    experienceLevel: asTrimmedString(record.experienceLevel || record.experience_level),
    classSize: asTrimmedString(record.classSize || record.class_size),
    customCurriculum: asTrimmedString(record.customCurriculum || record.custom_curriculum),
    availability: asTrimmedString(record.availability),
    recordStatus: asTrimmedString(record.record_status || record.recordStatus || "pending"),
    submittedAt: asTrimmedString(record.submittedAt || record.submitted_at),
    reviewedAt: asTrimmedString(record.reviewedAt || record.reviewed_at),
    reviewedBy: asTrimmedString(record.reviewedBy || record.reviewed_by),
    rejectionReason: asTrimmedString(record.rejectionReason || record.rejection_reason),
    submitterType: asTrimmedString(record.submitterType || record.submitter_type || "self-submitted"),
    visibility: asTrimmedString(record.visibility || "")
  };

  ARRAY_FIELDS.forEach((field) => {
    const snake = field.replace(/[A-Z]/g, (match) => `_${match.toLowerCase()}`);
    normalized[field] = toArray(record[field] ?? record[snake]);
  });

  return normalized;
}

function normalizeTrainerArray(records) {
  return (records || []).map((record) => normalizeTrainerRecord(record));
}

function buildSearchIndexString(trainer) {
  const tokens = [];
  SEARCHABLE_FIELDS.forEach((field) => {
    const value = trainer[field];
    if (Array.isArray(value)) {
      tokens.push(value.join(" "));
    } else if (value) {
      tokens.push(String(value));
    }
  });
  return tokens.join(" ").toLowerCase();
}

function matchArrayField(trainerValues, selectedValues) {
  if (!selectedValues.length) {
    return true;
  }
  const set = new Set(toArray(trainerValues));
  return selectedValues.some((value) => set.has(value));
}

function matchSingleField(trainerValue, selectedValue) {
  if (!selectedValue) {
    return true;
  }
  return asTrimmedString(trainerValue) === selectedValue;
}

function getFilteredTrainers(trainers, filters) {
  return (trainers || []).filter((trainer) => {
    for (const field of ARRAY_FIELDS) {
      if (!matchArrayField(trainer[field], filters[field] || [])) {
        return false;
      }
    }

    for (const field of SINGLE_FILTER_FIELDS) {
      if (!matchSingleField(trainer[field], filters[field] || "")) {
        return false;
      }
    }

    const query = asTrimmedString(filters.query).toLowerCase();
    if (query) {
      const index = buildSearchIndexString(trainer);
      if (!index.includes(query)) {
        return false;
      }
    }

    return true;
  });
}

const APP_CONFIG = {
  supabaseUrl: "",
  supabaseAnonKey: ""
};

function resolveConfig() {
  const runtime = window.TRAINER_LOCATOR_CONFIG || {};
  return {
    ...APP_CONFIG,
    ...runtime,
    supabaseUrl: String(runtime.supabaseUrl || APP_CONFIG.supabaseUrl || "").replace(/\/$/, ""),
    supabaseAnonKey: String(runtime.supabaseAnonKey || APP_CONFIG.supabaseAnonKey || "")
  };
}

const config = resolveConfig();
let supabaseClient;

function hasSupabaseConfig() {
  return Boolean(config.supabaseUrl && config.supabaseAnonKey);
}

function getSupabaseClient() {
  if (supabaseClient) {
    return supabaseClient;
  }
  if (!window.supabase || !window.supabase.createClient) {
    throw new Error("Supabase client SDK not loaded.");
  }
  if (!hasSupabaseConfig()) {
    throw new Error("Missing Supabase URL or anon key. Set window.TRAINER_LOCATOR_CONFIG first.");
  }
  supabaseClient = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });
  return supabaseClient;
}

function el(id) {
  return document.getElementById(id);
}

if (!window.L) {
  const status = el("status");
  if (status) {
    setStatus(status, "Map library failed to load. Reload the page.", "bad");
  }
  throw new Error("Leaflet (window.L) is not available.");
}

const map = L.map("map", { zoomControl: true, minZoom: 3 }).setView(DEFAULT_US_VIEW.center, DEFAULT_US_VIEW.zoom);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 18,
  attribution: "&copy; OpenStreetMap contributors"
}).addTo(map);

const pinIcon = L.divIcon({
  className: "",
  html: '<div class="pin"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9]
});

const state = {
  trainers: [],
  filtered: [],
  markersById: new Map(),
  collapsed: false
};

const ui = {
  grid: el("grid"),
  btnGutter: el("btnGutter"),
  gutterIcon: el("gutterIcon"),
  status: el("status"),
  resultCount: el("resultCount"),
  items: el("items"),
  noResults: el("noResults"),
  search: el("filterQuery"),
  resetFilters: el("btnResetFilters"),
  centerUs: el("btnCenterUS"),
  exportBtn: el("btnExport"),
  filtersForm: el("filtersForm")
};

const filterDefs = {
  discipline: { options: DISCIPLINE_OPTIONS, type: "multi" },
  hazmatSpecialties: { options: HAZMAT_SPECIALTY_OPTIONS, type: "multi" },
  travelCapability: { options: TRAVEL_CAPABILITY_OPTIONS, type: "single" },
  state: { options: STATE_OPTIONS, type: "single" },
  region: { options: REGION_OPTIONS, type: "single" },
  certifications: { options: CERTIFICATION_OPTIONS, type: "multi" },
  experienceLevel: { options: EXPERIENCE_LEVEL_OPTIONS, type: "single" },
  background: { options: BACKGROUND_OPTIONS, type: "multi" },
  industryExperience: { options: INDUSTRY_EXPERIENCE_OPTIONS, type: "multi" },
  trainingType: { options: TRAINING_TYPE_OPTIONS, type: "multi" },
  classSize: { options: CLASS_SIZE_OPTIONS, type: "single" },
  customCurriculum: { options: CUSTOM_CURRICULUM_OPTIONS, type: "single" },
  availability: { options: AVAILABILITY_OPTIONS, type: "single" }
};

function popupHtml(trainer) {
  const contact = [];
  if (trainer.email) {
    contact.push(`<span>Email:</span> <a href="mailto:${encodeURIComponent(trainer.email)}">${escapeHtml(trainer.email)}</a>`);
  }
  if (trainer.phone) {
    contact.push(`<span>Phone:</span> ${escapeHtml(trainer.phone)}`);
  }

  const location = trainer.locationLabel || `${trainer.lat?.toFixed(5)}, ${trainer.lng?.toFixed(5)}`;

  const summaryBlocks = [
    trainer.discipline.length ? `<div class="kv"><span>Discipline:</span> ${escapeHtml(trainer.discipline.join(", "))}</div>` : "",
    trainer.hazmatSpecialties.length ? `<div class="kv"><span>Hazmat:</span> ${escapeHtml(joinSummary(trainer.hazmatSpecialties, 4))}</div>` : "",
    trainer.state || trainer.region ? `<div class="kv"><span>Area:</span> ${escapeHtml([trainer.state, trainer.region].filter(Boolean).join(" / "))}</div>` : "",
    trainer.travelCapability ? `<div class="kv"><span>Travel:</span> ${escapeHtml(trainer.travelCapability)}</div>` : "",
    trainer.certifications.length ? `<div class="kv"><span>Certs:</span> ${escapeHtml(joinSummary(trainer.certifications, 3))}</div>` : "",
    trainer.trainingType.length ? `<div class="kv"><span>Training Type:</span> ${escapeHtml(joinSummary(trainer.trainingType, 3))}</div>` : "",
    trainer.availability ? `<div class="kv"><span>Availability:</span> ${escapeHtml(trainer.availability)}</div>` : "",
    location ? `<div class="kv"><span>Location:</span> ${escapeHtml(location)}</div>` : "",
    contact.length ? `<div class="kv">${contact.join("<br/>")}</div>` : "",
    trainer.notes ? `<div class="kv"><span>Notes:</span> ${escapeHtml(trainer.notes)}</div>` : ""
  ].filter(Boolean);

  const detailBlocks = [
    trainer.specialty ? `<div class="kv"><span>Legacy Specialty:</span> ${escapeHtml(trainer.specialty)}</div>` : "",
    trainer.topics ? `<div class="kv"><span>Legacy Topics:</span> ${escapeHtml(trainer.topics)}</div>` : "",
    trainer.hazmatSpecialties.length ? `<div class="kv"><span>Hazmat Specialties:</span> ${escapeHtml(trainer.hazmatSpecialties.join(", "))}</div>` : "",
    trainer.certifications.length ? `<div class="kv"><span>All Certifications:</span> ${escapeHtml(trainer.certifications.join(", "))}</div>` : "",
    trainer.background.length ? `<div class="kv"><span>Background:</span> ${escapeHtml(trainer.background.join(", "))}</div>` : "",
    trainer.industryExperience.length ? `<div class="kv"><span>Industry Experience:</span> ${escapeHtml(trainer.industryExperience.join(", "))}</div>` : "",
    trainer.trainingType.length ? `<div class="kv"><span>Training Type:</span> ${escapeHtml(trainer.trainingType.join(", "))}</div>` : "",
    trainer.classSize ? `<div class="kv"><span>Class Size:</span> ${escapeHtml(trainer.classSize)}</div>` : "",
    trainer.customCurriculum ? `<div class="kv"><span>Custom Curriculum:</span> ${escapeHtml(trainer.customCurriculum)}</div>` : "",
    trainer.submitterType ? `<div class="kv"><span>Submitter Type:</span> ${escapeHtml(trainer.submitterType)}</div>` : ""
  ].filter(Boolean);

  return `
    <div class="popup">
      <h3>${escapeHtml(trainer.name)}</h3>
      <div class="tagline">${escapeHtml(trainer.org || "Independent / Unspecified")}</div>
      ${summaryBlocks.join("")}
      ${
        detailBlocks.length
          ? `<details class="popupDetails">
               <summary class="popupMoreBtn">View All Info</summary>
               <div class="popupDetail">${detailBlocks.join("")}</div>
             </details>`
          : ""
      }
    </div>
  `;
}

function clearMarkers() {
  state.markersById.forEach((marker) => map.removeLayer(marker));
  state.markersById.clear();
}

function renderMarkers() {
  clearMarkers();
  state.filtered.forEach((trainer) => {
    if (!Number.isFinite(trainer.lat) || !Number.isFinite(trainer.lng)) {
      return;
    }
    const marker = L.marker([trainer.lat, trainer.lng], { icon: pinIcon });
    marker.bindPopup(popupHtml(trainer), {
      maxWidth: 560,
      keepInView: true,
      autoPan: true,
      autoPanPaddingTopLeft: [20, 220],
      autoPanPaddingBottomRight: [20, 90],
      offset: [0, 14]
    });
    marker.addTo(map);
    state.markersById.set(trainer.id, marker);
  });

  if (!state.filtered.length) {
    map.setView(DEFAULT_US_VIEW.center, DEFAULT_US_VIEW.zoom, { animate: true });
    return;
  }

  const points = state.filtered
    .filter((trainer) => Number.isFinite(trainer.lat) && Number.isFinite(trainer.lng))
    .map((trainer) => [trainer.lat, trainer.lng]);

  if (points.length === 1) {
    map.setView(points[0], 7, { animate: true });
  } else if (points.length > 1) {
    map.fitBounds(points, { padding: [20, 20], maxZoom: 7 });
  }
}

function renderList() {
  ui.items.innerHTML = "";
  ui.noResults.hidden = state.filtered.length > 0;

  state.filtered.forEach((trainer) => {
    const item = document.createElement("div");
    item.className = "item";
    const subtitle = [
      trainer.discipline[0] || trainer.specialty || "General",
      trainer.state || "Unspecified",
      trainer.travelCapability || "Travel not listed"
    ].join(" | ");

    item.innerHTML = `
      <div class="meta">
        <div class="name" title="${escapeHtml(trainer.name)}">${escapeHtml(trainer.name)}</div>
        <div class="small" title="${escapeHtml(subtitle)}">${escapeHtml(subtitle)}</div>
        <div class="small" title="${escapeHtml(trainer.org || "")}">${escapeHtml(trainer.org || "Independent / Unspecified")}</div>
      </div>
      <div class="miniActions">
        <button class="miniBtn" type="button" data-action="zoom" data-id="${escapeHtml(trainer.id)}">Zoom</button>
      </div>
    `;

    ui.items.appendChild(item);
  });
}

function updateCount() {
  ui.resultCount.textContent = `${state.filtered.length} of ${state.trainers.length} trainers`;
}

function getFilterState() {
  const values = {
    query: ui.search.value.trim(),
    discipline: [],
    hazmatSpecialties: [],
    certifications: [],
    background: [],
    industryExperience: [],
    trainingType: [],
    travelCapability: "",
    state: "",
    region: "",
    experienceLevel: "",
    classSize: "",
    customCurriculum: "",
    availability: ""
  };

  Object.keys(filterDefs).forEach((field) => {
    const def = filterDefs[field];
    if (def.type === "multi") {
      const checked = Array.from(ui.filtersForm.querySelectorAll(`input[name="${field}"]:checked`));
      values[field] = checked.map((input) => input.value);
    } else {
      const select = ui.filtersForm.querySelector(`select[name="${field}"]`);
      values[field] = select ? select.value : "";
    }
  });

  return values;
}

function applyFilters() {
  state.filtered = getFilteredTrainers(state.trainers, getFilterState());
  updateCount();
  renderList();
  renderMarkers();
}

function resetFilters() {
  ui.filtersForm.reset();
  applyFilters();
}

function buildFilterControls() {
  const mounts = {
    discipline: el("disciplineOptions"),
    hazmatSpecialties: el("hazmatOptions"),
    certifications: el("certificationOptions"),
    background: el("backgroundOptions"),
    industryExperience: el("industryOptions"),
    trainingType: el("trainingTypeOptions")
  };

  Object.keys(mounts).forEach((field) => {
    const container = mounts[field];
    filterDefs[field].options.forEach((value) => {
      container.appendChild(createCheckbox(field, value));
    });
  });

  const singleSelectMap = {
    travelCapability: el("filterTravel"),
    state: el("filterState"),
    region: el("filterRegion"),
    experienceLevel: el("filterExperience"),
    classSize: el("filterClassSize"),
    customCurriculum: el("filterCurriculum"),
    availability: el("filterAvailability")
  };

  Object.entries(singleSelectMap).forEach(([field, selectEl]) => {
    filterDefs[field].options.forEach((value) => selectEl.appendChild(createOption(value)));
  });
}

function setupCollapsibleFilterGroups() {
  const groups = Array.from(ui.filtersForm?.querySelectorAll(".group") || []);
  groups.forEach((group, index) => {
    const heading = group.querySelector("h4");
    if (!heading) {
      return;
    }

    const headingText = asTrimmedString(heading.textContent).toLowerCase();
    if (!COLLAPSIBLE_FILTER_GROUPS.has(headingText)) {
      return;
    }

    const content = document.createElement("div");
    content.className = "groupBody";
    content.id = `filter-group-body-${index}`;

    const nodesToMove = [];
    let node = heading.nextSibling;
    while (node) {
      const next = node.nextSibling;
      nodesToMove.push(node);
      node = next;
    }
    nodesToMove.forEach((child) => content.appendChild(child));
    group.appendChild(content);

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "groupToggle";
    toggle.setAttribute("aria-expanded", "true");
    toggle.setAttribute("aria-controls", content.id);
    toggle.innerHTML = `
      <span class="groupToggleLabel">${escapeHtml(asTrimmedString(heading.textContent))}</span>
      <span class="groupToggleChevron" aria-hidden="true">v</span>
    `;

    heading.replaceWith(toggle);
    group.classList.add("is-collapsible");

    toggle.addEventListener("click", () => {
      const isCollapsed = group.classList.toggle("is-collapsed");
      const isExpanded = !isCollapsed;
      content.hidden = !isExpanded;
      toggle.setAttribute("aria-expanded", String(isExpanded));
      const chevron = toggle.querySelector(".groupToggleChevron");
      if (chevron) {
        chevron.textContent = isExpanded ? "v" : ">";
      }
    });
  });
}

function bindEvents() {
  map.on("popupopen", (event) => {
    const root = event.popup?.getElement();
    if (!root) {
      return;
    }
    root.querySelectorAll(".popupDetails").forEach((detailsEl) => {
      detailsEl.addEventListener("toggle", () => {
        const summary = detailsEl.querySelector(".popupMoreBtn");
        if (summary) {
          summary.textContent = detailsEl.open ? "Hide Extra Info" : "View All Info";
        }
        window.requestAnimationFrame(() => {
          event.popup.update();
        });
        window.setTimeout(() => {
          event.popup.update();
        }, 90);
      });
    });
  });

  ui.items.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action='zoom']");
    if (!button) {
      return;
    }
    const trainer = state.filtered.find((item) => item.id === button.getAttribute("data-id"));
    if (!trainer || !Number.isFinite(trainer.lat) || !Number.isFinite(trainer.lng)) {
      return;
    }
    map.setView([trainer.lat, trainer.lng], 9, { animate: true });
    const marker = state.markersById.get(trainer.id);
    if (marker) {
      marker.openPopup();
    }
  });

  const debounced = debounce(applyFilters, 180);
  ui.filtersForm.addEventListener("change", applyFilters);
  ui.search.addEventListener("input", debounced);
  ui.resetFilters.addEventListener("click", resetFilters);

  ui.centerUs.addEventListener("click", () => map.setView(DEFAULT_US_VIEW.center, DEFAULT_US_VIEW.zoom, { animate: true }));

  ui.exportBtn.addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(state.filtered, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "trainer-locator-approved-export.json";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setStatus(ui.status, "Exported filtered approved trainers.", "ok");
  });

  ui.btnGutter.addEventListener("click", () => {
    state.collapsed = !state.collapsed;
    if (state.collapsed) {
      ui.grid.classList.add("is-collapsed");
      ui.gutterIcon.textContent = ">";
    } else {
      ui.grid.classList.remove("is-collapsed");
      ui.gutterIcon.textContent = "<";
    }
    window.setTimeout(() => map.invalidateSize(true), 220);
  });
}

async function loadApprovedTrainers() {
  if (!hasSupabaseConfig()) {
    setStatus(ui.status, "Supabase config missing. Set window.TRAINER_LOCATOR_CONFIG before using production mode.", "bad");
    state.trainers = [];
    applyFilters();
    return;
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select("*")
    .eq("record_status", "approved")
    .eq("visibility", "public")
    .order("name", { ascending: true });

  if (error) {
    setStatus(ui.status, `Load failed: ${error.message}`, "bad");
    state.trainers = [];
    applyFilters();
    return;
  }

  state.trainers = normalizeTrainerArray(data || []);
  applyFilters();
  setStatus(ui.status, "Loaded approved trainers.", "ok");
}

function init() {
  buildFilterControls();
  setupCollapsibleFilterGroups();
  bindEvents();
  loadApprovedTrainers();
}

init();
