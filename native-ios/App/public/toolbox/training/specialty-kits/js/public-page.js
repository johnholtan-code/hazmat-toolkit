import * as constants from "./constants.js";
import * as schema from "./kit-schema.js";
import * as filters from "./kit-filters.js";
import { getSupabaseClient, hasSupabaseConfig } from "./supabase-client.js";
import { escapeHtml, el, buildSearchString } from "./utils.js";

// ============= Map Setup =============
if (!window.L) {
  throw new Error("Leaflet (window.L) is not available.");
}

const map = L.map("map", { zoomControl: true, minZoom: 3 }).setView(
  constants.DEFAULT_US_VIEW.center,
  constants.DEFAULT_US_VIEW.zoom
);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 18,
  attribution: "&copy; OpenStreetMap contributors"
}).addTo(map);

// Signals successful app bootstrap so WKWebView fallback logic can skip.
window.__specialtyKitPublicPageBooted = true;

const pinIcon = L.divIcon({
  className: "",
  html: '<div class="pin"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9]
});

// ============= App State =============
const state = {
  kits: [],
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

// ============= Filter Defs =============
const filterDefs = {
  kitCategory: { options: constants.KIT_CATEGORY_OPTIONS, type: "single" },
  kitType: { options: constants.KIT_TYPE_OPTIONS, type: "multi" },
  hazardFocus: { options: constants.HAZARD_FOCUS_OPTIONS, type: "multi" },
  equipmentCapabilities: { options: constants.EQUIPMENT_CAPABILITIES_OPTIONS, type: "multi" },
  state: { options: constants.STATE_OPTIONS, type: "single" },
  region: { options: constants.REGION_OPTIONS, type: "single" },
  deploymentType: { options: constants.DEPLOYMENT_TYPE_OPTIONS, type: "single" },
  availabilityStatus: { options: constants.AVAILABILITY_STATUS_OPTIONS, type: "single" },
  accessType: { options: constants.ACCESS_TYPE_OPTIONS, type: "single" },
  storageEnvironment: { options: constants.STORAGE_ENVIRONMENT_OPTIONS, type: "single" },
  transportCapable: { options: constants.TRANSPORT_CAPABLE_OPTIONS, type: "single" },
  responseTeamIncluded: { options: constants.RESPONSE_TEAM_INCLUDED_OPTIONS, type: "single" },
  trainingRequired: { options: constants.TRAINING_REQUIRED_OPTIONS, type: "single" }
};

// ============= Popup HTML =============
function popupHtml(kit) {
  const contact = [];
  if (kit.email) {
    contact.push(
      `<span>Email:</span> <a href="mailto:${encodeURIComponent(kit.email)}">${escapeHtml(kit.email)}</a>`
    );
  }
  if (kit.phone) {
    contact.push(
      `<span>Phone:</span> <a href="tel:${encodeURIComponent(kit.phone)}">${escapeHtml(kit.phone)}</a>`
    );
  }
  if (kit.secondaryPhone) {
    contact.push(
      `<span>Secondary:</span> <a href="tel:${encodeURIComponent(kit.secondaryPhone)}">${escapeHtml(kit.secondaryPhone)}</a>`
    );
  }

  const location = kit.locationLabel || (kit.city ? `${kit.city}, ${kit.state}` : "Location unavailable");

  const summaryBlocks = [
    kit.kitCategory ? `<div class="kv"><span>Category:</span> ${escapeHtml(kit.kitCategory)}</div>` : "",
    kit.kitTypes?.length ? `<div class="kv"><span>Types:</span> ${escapeHtml(kit.kitTypes.slice(0, 3).join(", "))}${kit.kitTypes.length > 3 ? " ..." : ""}</div>` : "",
    kit.hazardFocus?.length ? `<div class="kv"><span>Hazards:</span> ${escapeHtml(kit.hazardFocus.slice(0, 3).join(", "))}${kit.hazardFocus.length > 3 ? " ..." : ""}</div>` : "",
    kit.equipmentCapabilities?.length ? `<div class="kv"><span>Capabilities:</span> ${escapeHtml(kit.equipmentCapabilities.slice(0, 3).join(", "))}${kit.equipmentCapabilities.length > 3 ? " ..." : ""}</div>` : "",
    kit.availabilityStatus ? `<div class="kv"><span>Availability:</span> ${escapeHtml(kit.availabilityStatus)}</div>` : "",
    kit.accessType ? `<div class="kv"><span>Access:</span> ${escapeHtml(kit.accessType)}</div>` : "",
    location ? `<div class="kv"><span>Location:</span> ${escapeHtml(location)}</div>` : "",
    contact.length ? `<div class="kv">${contact.join("<br/>")}</div>` : ""
  ].filter(Boolean);

  return `
    <div class="popup">
      <h3>${escapeHtml(kit.kitName)}</h3>
      <div class="tagline">${escapeHtml(kit.organizationName || "Organization unspecified")}</div>
      ${summaryBlocks.join("")}
      ${kit.notes ? `<div class="kv" style="margin-top:8px;"><span>Notes:</span> ${escapeHtml(kit.notes)}</div>` : ""}
    </div>
  `;
}

// ============= Markers =============
function clearMarkers() {
  state.markersById.forEach((marker) => map.removeLayer(marker));
  state.markersById.clear();
}

function renderMarkers() {
  clearMarkers();
  state.filtered.forEach((kit) => {
    if (!Number.isFinite(kit.lat) || !Number.isFinite(kit.lng)) {
      return;
    }
    const marker = L.marker([kit.lat, kit.lng], { icon: pinIcon });
    marker.bindPopup(popupHtml(kit), {
      maxWidth: 560,
      keepInView: true,
      autoPan: true,
      autoPanPaddingTopLeft: [20, 220],
      autoPanPaddingBottomRight: [20, 90],
      offset: [0, 14]
    });
    marker.addTo(map);
    state.markersById.set(kit.id, marker);
  });

  if (!state.filtered.length) {
    map.setView(constants.DEFAULT_US_VIEW.center, constants.DEFAULT_US_VIEW.zoom, { animate: true });
    return;
  }

  const points = state.filtered
    .filter((kit) => Number.isFinite(kit.lat) && Number.isFinite(kit.lng))
    .map((kit) => [kit.lat, kit.lng]);

  if (points.length === 1) {
    map.setView(points[0], 7, { animate: true });
  } else if (points.length > 1) {
    map.fitBounds(points, { padding: [20, 20], maxZoom: 7 });
  }
}

// ============= List Rendering =============
function renderList() {
  ui.items.innerHTML = "";
  ui.noResults.hidden = state.filtered.length > 0;

  state.filtered.forEach((kit) => {
    const item = document.createElement("div");
    item.className = "item";
    const subtitle = [
      kit.kitCategory || "General",
      kit.state || "Unspecified",
      kit.availabilityStatus || "Availability not listed"
    ].join(" | ");

    item.innerHTML = `
      <div class="meta">
        <div class="name" title="${escapeHtml(kit.kitName)}">${escapeHtml(kit.kitName)}</div>
        <div class="small" title="${escapeHtml(subtitle)}">${escapeHtml(subtitle)}</div>
        <div class="small" title="${escapeHtml(kit.organizationName || "")}">${escapeHtml(kit.organizationName || "Organization unspecified")}</div>
      </div>
      <div class="miniActions">
        ${kit.phone ? `<a class="miniBtn" href="tel:${encodeURIComponent(kit.phone)}">Call</a>` : ""}
        <button class="miniBtn" type="button" data-action="zoom" data-id="${escapeHtml(kit.id)}">Zoom</button>
      </div>
    `;

    ui.items.appendChild(item);
  });
}

function updateCount() {
  ui.resultCount.textContent = `${state.filtered.length} of ${state.kits.length} kits`;
}

function setStatus(msg, klass = "ok") {
  const el = ui.status;
  el.innerHTML = `<strong>Status:</strong> <span class="${klass}">${escapeHtml(msg)}</span>`;
}

// ============= Filtering =============
function getFilterState() {
  const values = {
    keyword: ui.search.value.trim(),
    kitCategory: "",
    kitType: [],
    hazardFocus: [],
    equipmentCapabilities: [],
    state: "",
    region: "",
    deploymentType: "",
    availabilityStatus: "",
    accessType: "",
    storageEnvironment: "",
    transportCapable: "",
    responseTeamIncluded: "",
    trainingRequired: ""
  };

  // Single-select fields
  ["kitCategory", "state", "region", "deploymentType", "availabilityStatus", "accessType", "storageEnvironment", "transportCapable", "responseTeamIncluded", "trainingRequired"].forEach((field) => {
    const selector = `select[name="${field}"]`;
    const el = ui.filtersForm.querySelector(selector);
    if (el) {
      values[field] = el.value;
    }
  });

  // Multi-select checkboxes
  ["kitType", "hazardFocus", "equipmentCapabilities"].forEach((field) => {
    const checkboxes = ui.filtersForm.querySelectorAll(`input[name="${field}"]:checked`);
    values[field] = Array.from(checkboxes).map((cb) => cb.value);
  });

  return values;
}

function applyFilters() {
  const filterState = getFilterState();
  state.filtered = filters.getFilteredKits(state.kits, filterState);
  renderList();
  renderMarkers();
  updateCount();
  setStatus(`Showing ${state.filtered.length} kit(s).`, state.filtered.length ? "ok" : "warn");
}

// ============= UI Builders =============
function buildFilterUI() {
  // Build multi-select checkboxes
  ["kitType", "hazardFocus", "equipmentCapabilities"].forEach((field) => {
    const options = filterDefs[field]?.options || [];
    const container = ui.filtersForm.querySelector(`#${field}Options`);
    if (!container) return;
    container.innerHTML = "";

    options.forEach((option) => {
      const label = document.createElement("label");
      label.className = "chip";
      label.innerHTML = `
        <input type="checkbox" name="${field}" value="${escapeHtml(option)}" />
        <span>${escapeHtml(option)}</span>
      `;
      label.addEventListener("change", applyFilters);
      container.appendChild(label);
    });
  });

  // Build single-select dropdowns
  ["kitCategory", "state", "region", "deploymentType", "availabilityStatus", "accessType", "storageEnvironment", "transportCapable", "responseTeamIncluded", "trainingRequired"].forEach((field) => {
    const options = filterDefs[field]?.options || [];
    const select = ui.filtersForm.querySelector(`select[name="${field}"]`);
    if (!select) return;

    options.forEach((option) => {
      const opt = document.createElement("option");
      opt.value = option;
      opt.textContent = option;
      select.appendChild(opt);
    });

    select.addEventListener("change", applyFilters);
  });
}

// ============= Load Data =============
async function loadApprovedKits() {
  if (!hasSupabaseConfig()) {
    setStatus("Configuration missing. Check console.", "bad");
    return;
  }

  try {
    setStatus("Loading approved kits...", "ok");
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from(constants.TABLE_NAME)
      .select("*")
      .eq("record_status", "approved")
      .eq("visibility", "public");

    if (error) {
      throw error;
    }

    state.kits = schema.normalizeKitArray(data || []);
    applyFilters();
    setStatus(`Loaded ${state.kits.length} approved kit(s).`, "ok");
  } catch (err) {
    console.error(err);
    setStatus(`Error: ${err.message}`, "bad");
  }
}

// ============= Event Listeners =============
ui.search.addEventListener("input", applyFilters);
ui.resetFilters.addEventListener("click", () => {
  ui.search.value = "";
  ui.filtersForm.querySelectorAll("input[type='checkbox']").forEach((cb) => (cb.checked = false));
  ui.filtersForm.querySelectorAll("select").forEach((s) => (s.value = ""));
  applyFilters();
});

ui.centerUs.addEventListener("click", () => {
  map.setView(constants.DEFAULT_US_VIEW.center, constants.DEFAULT_US_VIEW.zoom, { animate: true });
});

ui.items.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-action='zoom']");
  if (!btn) return;
  const id = btn.dataset.id;
  const kit = state.kits.find((k) => k.id === id);
  if (kit && Number.isFinite(kit.lat) && Number.isFinite(kit.lng)) {
    map.setView([kit.lat, kit.lng], 10, { animate: true });
    state.markersById.get(id)?.openPopup();
  }
});

// Collapse/expand gutter
let isCollapsed = false;
function applyCollapsedState() {
  if (isCollapsed) {
    ui.grid.classList.add("is-collapsed");
    ui.gutterIcon.textContent = "▶";
    ui.btnGutter.title = "Expand filters";
  } else {
    ui.grid.classList.remove("is-collapsed");
    ui.gutterIcon.textContent = "◀";
    ui.btnGutter.title = "Collapse filters";
  }
  window.setTimeout(() => map.invalidateSize(true), 220);
}

ui.btnGutter.addEventListener("click", () => {
  isCollapsed = !isCollapsed;
  applyCollapsedState();
});

function syncGutterHeight() {
  const mapEl = document.getElementById("map");
  const gut = document.querySelector(".gutter");
  if (mapEl && gut) {
    gut.style.minHeight = (mapEl.getBoundingClientRect().height || 640) + "px";
  }
}

window.addEventListener("resize", syncGutterHeight);

// ============= Init =============
buildFilterUI();
loadApprovedKits();
window.setTimeout(syncGutterHeight, 50);
