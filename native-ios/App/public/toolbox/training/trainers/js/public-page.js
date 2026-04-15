import {
  AVAILABILITY_OPTIONS,
  BACKGROUND_OPTIONS,
  CERTIFICATION_OPTIONS,
  CLASS_SIZE_OPTIONS,
  CUSTOM_CURRICULUM_OPTIONS,
  DEFAULT_US_VIEW,
  DISCIPLINE_OPTIONS,
  EXPERIENCE_LEVEL_OPTIONS,
  HAZMAT_SPECIALTY_OPTIONS,
  INDUSTRY_EXPERIENCE_OPTIONS,
  REGION_OPTIONS,
  STATE_OPTIONS,
  TABLE_NAME,
  TRAINING_TYPE_OPTIONS,
  TRAVEL_CAPABILITY_OPTIONS
} from "./constants.js";
import { getFilteredTrainers } from "./trainer-filters.js";
import { normalizeTrainerArray } from "./trainer-schema.js";
import { getSupabaseClient, hasSupabaseConfig } from "./supabase-client.js";
import { createCheckbox, createOption, debounce, escapeHtml, joinSummary, setStatus } from "./utils.js";

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

function el(id) {
  return document.getElementById(id);
}

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
  bindEvents();
  loadApprovedTrainers();
}

init();
