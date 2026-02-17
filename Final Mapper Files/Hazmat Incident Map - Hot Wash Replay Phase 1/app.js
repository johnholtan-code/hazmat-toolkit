import LocalStoreIndexedDb from "../src/store/local_store_indexeddb.js";
import { ACTION_TYPES } from "../src/store/store_interface.js";

const store = new LocalStoreIndexedDb();

const ui = {
  homeView: document.getElementById("homeView"),
  incidentView: document.getElementById("incidentView"),
  amendmentModal: document.getElementById("amendmentModal"),
  toast: document.getElementById("toast"),

  authorName: document.getElementById("authorName"),
  authorRole: document.getElementById("authorRole"),
  authorAgency: document.getElementById("authorAgency"),

  incidentTitle: document.getElementById("incidentTitle"),
  incidentStatus: document.getElementById("incidentStatus"),
  createIncidentBtn: document.getElementById("createIncidentBtn"),
  refreshIncidentsBtn: document.getElementById("refreshIncidentsBtn"),
  incidentList: document.getElementById("incidentList"),
  openIncidentBtn: document.getElementById("openIncidentBtn"),

  incidentTitleHeader: document.getElementById("incidentTitleHeader"),
  opSelector: document.getElementById("opSelector"),
  opStatusPill: document.getElementById("opStatusPill"),
  closeLockOpBtn: document.getElementById("closeLockOpBtn"),
  startNextOpBtn: document.getElementById("startNextOpBtn"),
  createAmendmentBtn: document.getElementById("createAmendmentBtn"),
  backHomeBtn: document.getElementById("backHomeBtn"),
  lockedBanner: document.getElementById("lockedBanner"),

  addMarkerBtn: document.getElementById("addMarkerBtn"),
  removeMarkerBtn: document.getElementById("removeMarkerBtn"),
  moveMarkerBtn: document.getElementById("moveMarkerBtn"),
  selectedMarkerMeta: document.getElementById("selectedMarkerMeta"),

  stagingName: document.getElementById("stagingName"),
  stagingRate: document.getElementById("stagingRate"),
  addStagingBtn: document.getElementById("addStagingBtn"),
  stagingBody: document.getElementById("stagingBody"),

  noteInput: document.getElementById("noteInput"),
  addNoteBtn: document.getElementById("addNoteBtn"),
  timelineBody: document.getElementById("timelineBody"),

  amendmentsBody: document.getElementById("amendmentsBody"),
  amendmentsEmpty: document.getElementById("amendmentsEmpty"),

  amdReason: document.getElementById("amdReason"),
  amdOp: document.getElementById("amdOp"),
  amdPath: document.getElementById("amdPath"),
  amdValue: document.getElementById("amdValue"),
  amdMoveSelectedBtn: document.getElementById("amdMoveSelectedBtn"),
  amdCancelBtn: document.getElementById("amdCancelBtn"),
  amdSubmitBtn: document.getElementById("amdSubmitBtn")
};

let map;
let mapMarkersLayer;
let currentIncident = null;
let currentOps = [];
let currentOpId = null;
let currentState = null;
let markerById = new Map();
let selectedMarkerId = null;
let toastTimer = null;

const BASEMAPS = {
  streets: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    options: { maxZoom: 20, attribution: "&copy; OpenStreetMap" }
  }
};
let activeBaseLayer;

function showToast(message) {
  ui.toast.textContent = message;
  ui.toast.style.display = "block";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    ui.toast.style.display = "none";
  }, 2600);
}

function getAuthor() {
  return {
    name: (ui.authorName.value || "Unknown").trim() || "Unknown",
    role: (ui.authorRole.value || "Observer").trim() || "Observer",
    agency: (ui.authorAgency.value || "").trim() || undefined
  };
}

function saveProfile() {
  localStorage.setItem("hazmat_phase1_profile", JSON.stringify(getAuthor()));
}

function loadProfile() {
  try {
    const parsed = JSON.parse(localStorage.getItem("hazmat_phase1_profile") || "{}");
    ui.authorName.value = parsed.name || "";
    ui.authorRole.value = parsed.role || "IC";
    ui.authorAgency.value = parsed.agency || "";
  } catch {
    // ignore malformed profile
  }
}

function setView(view) {
  ui.homeView.classList.toggle("active", view === "home");
  ui.incidentView.classList.toggle("active", view === "incident");
}

function ensureMap() {
  if (map) return;
  map = L.map("map").setView([39.5, -98.35], 5);
  activeBaseLayer = L.tileLayer(BASEMAPS.streets.url, BASEMAPS.streets.options).addTo(map);
  mapMarkersLayer = L.layerGroup().addTo(map);
}

function setOpStatusUI(status) {
  ui.opStatusPill.textContent = status;
  ui.opStatusPill.classList.toggle("locked", status === "LOCKED");
  const isLocked = status === "LOCKED";
  ui.lockedBanner.style.display = isLocked ? "block" : "none";
  ui.startNextOpBtn.disabled = !isLocked;
  ui.createAmendmentBtn.disabled = !isLocked;
  ui.closeLockOpBtn.disabled = isLocked;
}

function markerLabel(item, idx) {
  return item.label || `Marker ${idx + 1}`;
}

function setSelectedMarker(id) {
  selectedMarkerId = id || null;
  const item = currentState?.mapState?.items?.find((row) => row.id === selectedMarkerId);
  if (!item) {
    ui.selectedMarkerMeta.textContent = "No marker selected.";
    return;
  }
  ui.selectedMarkerMeta.textContent = `Selected ${item.label || item.id}: lat ${item.lat.toFixed(5)}, lng ${item.lng.toFixed(5)}`;
}

async function refreshIncidentState({ preserveSelection = true } = {}) {
  if (!currentIncident || !currentOpId) return;
  const priorSelection = preserveSelection ? selectedMarkerId : null;
  currentState = await store.getState(currentIncident.incidentId, currentOpId);
  renderFromState();
  if (priorSelection && currentState.mapState.items.some((row) => row.id === priorSelection)) {
    setSelectedMarker(priorSelection);
  } else {
    setSelectedMarker(null);
  }
}

function renderMapItems() {
  mapMarkersLayer.clearLayers();
  markerById = new Map();
  const isLocked = currentState?.status === "LOCKED";

  (currentState?.mapState?.items || []).forEach((item, idx) => {
    const marker = L.marker([item.lat, item.lng], { draggable: !isLocked });
    marker.addTo(mapMarkersLayer);
    marker.bindTooltip(markerLabel(item, idx), { direction: "top" });
    marker.on("click", () => setSelectedMarker(item.id));

    marker.on("dragend", async () => {
      const latlng = marker.getLatLng();
      try {
        await applyAction(ACTION_TYPES.MAP_ITEM_UPDATE, {
          itemId: item.id,
          changes: { lat: latlng.lat, lng: latlng.lng }
        });
      } catch (error) {
        showToast(error.message || "Move rejected");
      }
    });

    markerById.set(item.id, marker);
  });
}

function renderStaging() {
  const rows = currentState?.stagingLedger || [];
  if (!rows.length) {
    ui.stagingBody.innerHTML = "<tr><td colspan='4' class='small'>No staging entries.</td></tr>";
    return;
  }

  ui.stagingBody.innerHTML = rows
    .map(
      (row) => `<tr>
        <td>${row.name || "Asset"}</td>
        <td>${row.status || "active"}</td>
        <td>${Number(row.rate || 0).toFixed(2)}</td>
        <td><button data-demob="${row.id}">Demobilize</button></td>
      </tr>`
    )
    .join("");

  ui.stagingBody.querySelectorAll("button[data-demob]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        await applyAction(ACTION_TYPES.STAGING_ENTRY_DEMOBILIZE, {
          entryId: btn.dataset.demob,
          demobilizedAt: new Date().toISOString()
        });
      } catch (error) {
        showToast(error.message || "Staging update failed");
      }
    });
  });
}

function renderTimeline() {
  const rows = [...(currentState?.timelineEvents || [])].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  if (!rows.length) {
    ui.timelineBody.innerHTML = "<tr><td colspan='4' class='small'>No timeline events.</td></tr>";
    return;
  }

  ui.timelineBody.innerHTML = rows
    .map(
      (row) => `<tr>
        <td>${new Date(row.timestamp).toLocaleString()}</td>
        <td>${row.type}</td>
        <td>${row.author?.name || "Unknown"} (${row.author?.role || ""})</td>
        <td>${row.clientId || ""}</td>
      </tr>`
    )
    .join("");
}

function renderAmendments() {
  const rows = currentState?.amendments || [];
  ui.amendmentsEmpty.style.display = rows.length ? "none" : "block";
  if (!rows.length) {
    ui.amendmentsBody.innerHTML = "";
    return;
  }
  ui.amendmentsBody.innerHTML = rows
    .map(
      (row) => `<tr>
        <td>${row.amendmentId}</td>
        <td>${new Date(row.createdAt).toLocaleString()}</td>
        <td>${row.createdBy?.name || "Unknown"}</td>
        <td>${row.reason}</td>
      </tr>`
    )
    .join("");
}

function renderFromState() {
  const op = currentOps.find((row) => row.operatingPeriodId === currentOpId);
  if (!op) return;
  setOpStatusUI(op.status);

  if (currentState?.mapState?.basemap === "streets" && !map.hasLayer(activeBaseLayer)) {
    activeBaseLayer.addTo(map);
  }

  renderMapItems();
  renderStaging();
  renderTimeline();
  renderAmendments();
}

async function refreshIncidentMetadata() {
  if (!currentIncident) return;
  const loaded = await store.loadIncident(currentIncident.incidentId);
  currentIncident = loaded.incident;
  currentOps = loaded.operatingPeriods;

  ui.incidentTitleHeader.textContent = `${currentIncident.title} (${currentIncident.incidentId})`;
  ui.opSelector.innerHTML = currentOps
    .map((op) => `<option value="${op.operatingPeriodId}">OP ${op.opNumber} - ${op.status}</option>`)
    .join("");

  currentOpId = currentOpId || currentIncident.activeOperatingPeriodId;
  if (!currentOps.some((op) => op.operatingPeriodId === currentOpId)) {
    currentOpId = currentIncident.activeOperatingPeriodId;
  }
  ui.opSelector.value = currentOpId;

  await refreshIncidentState();
}

async function applyAction(type, payload = {}) {
  const result = await store.applyAction({
    incidentId: currentIncident.incidentId,
    operatingPeriodId: currentOpId,
    type,
    payload,
    author: getAuthor(),
    timestamp: new Date().toISOString()
  });

  await refreshIncidentMetadata();
  return result;
}

async function refreshIncidentsList() {
  const incidents = await store.listIncidents();
  if (!incidents.length) {
    ui.incidentList.innerHTML = "<option value=''>No incidents yet</option>";
    return;
  }
  ui.incidentList.innerHTML = incidents
    .map((row) => `<option value="${row.incidentId}">${row.title} (${row.incidentId}) - ${row.status}</option>`)
    .join("");
}

async function createIncident() {
  saveProfile();
  const created = await store.createIncident({
    title: ui.incidentTitle.value,
    status: ui.incidentStatus.value,
    createdBy: getAuthor()
  });
  currentIncident = created.incident;
  currentOpId = created.operatingPeriod.operatingPeriodId;
  ensureMap();
  setView("incident");
  await refreshIncidentMetadata();
}

async function openSelectedIncident() {
  const incidentId = ui.incidentList.value;
  if (!incidentId) return;
  saveProfile();
  const loaded = await store.loadIncident(incidentId);
  currentIncident = loaded.incident;
  currentOps = loaded.operatingPeriods;
  currentOpId = currentIncident.activeOperatingPeriodId;
  ensureMap();
  setView("incident");
  await refreshIncidentMetadata();
}

function parseJsonOrPrimitive(rawText) {
  if (!rawText.trim()) return undefined;
  try {
    return JSON.parse(rawText);
  } catch {
    if (!Number.isNaN(Number(rawText))) return Number(rawText);
    if (rawText === "true") return true;
    if (rawText === "false") return false;
    return rawText;
  }
}

async function createAmendmentFromModal() {
  const reason = (ui.amdReason.value || "").trim();
  const op = ui.amdOp.value;
  const path = (ui.amdPath.value || "").trim();
  const parsedValue = parseJsonOrPrimitive(ui.amdValue.value || "");

  const patch = [{ op, path }];
  if (op !== "remove") patch[0].value = parsedValue;

  await store.createAmendment({
    incidentId: currentIncident.incidentId,
    operatingPeriodId: currentOpId,
    createdBy: getAuthor(),
    reason,
    patch
  });

  ui.amdReason.value = "";
  ui.amdPath.value = "";
  ui.amdValue.value = "";
  ui.amendmentModal.classList.remove("active");
  await refreshIncidentMetadata();
}

function prefillMoveSelectedAmendment() {
  if (!selectedMarkerId) {
    showToast("Select a marker first");
    return;
  }
  const idx = (currentState?.snapshot?.mapState?.items || []).findIndex((row) => row.id === selectedMarkerId);
  if (idx < 0) {
    showToast("Selected marker is not in snapshot");
    return;
  }
  const center = map.getCenter();
  ui.amdOp.value = "replace";
  ui.amdPath.value = `/mapState/items/${idx}/lat`;
  ui.amdValue.value = String(center.lat);
  ui.amdReason.value = ui.amdReason.value || "Correct marker location";
}

ui.createIncidentBtn.addEventListener("click", () => {
  createIncident().catch((error) => showToast(error.message || "Create failed"));
});

ui.refreshIncidentsBtn.addEventListener("click", () => {
  refreshIncidentsList().catch((error) => showToast(error.message || "Refresh failed"));
});

ui.openIncidentBtn.addEventListener("click", () => {
  openSelectedIncident().catch((error) => showToast(error.message || "Open failed"));
});

ui.backHomeBtn.addEventListener("click", () => {
  setView("home");
  refreshIncidentsList().catch(() => {});
});

ui.opSelector.addEventListener("change", async () => {
  currentOpId = ui.opSelector.value;
  await store.setActiveOperatingPeriod({
    incidentId: currentIncident.incidentId,
    operatingPeriodId: currentOpId,
    author: getAuthor()
  });
  await refreshIncidentMetadata();
});

ui.closeLockOpBtn.addEventListener("click", async () => {
  try {
    await store.lockOperatingPeriod({
      incidentId: currentIncident.incidentId,
      operatingPeriodId: currentOpId,
      author: getAuthor()
    });
    await refreshIncidentMetadata();
  } catch (error) {
    showToast(error.message || "Lock failed");
  }
});

ui.startNextOpBtn.addEventListener("click", async () => {
  try {
    await store.startNextOperatingPeriod({ incidentId: currentIncident.incidentId, author: getAuthor() });
    currentOpId = null;
    await refreshIncidentMetadata();
  } catch (error) {
    showToast(error.message || "Cannot start next OP");
  }
});

ui.createAmendmentBtn.addEventListener("click", () => {
  ui.amendmentModal.classList.add("active");
});

ui.amdCancelBtn.addEventListener("click", () => {
  ui.amendmentModal.classList.remove("active");
});

ui.amdSubmitBtn.addEventListener("click", () => {
  createAmendmentFromModal().catch((error) => showToast(error.message || "Amendment failed"));
});

ui.amdMoveSelectedBtn.addEventListener("click", prefillMoveSelectedAmendment);

ui.addMarkerBtn.addEventListener("click", async () => {
  try {
    const center = map.getCenter();
    const count = (currentState?.mapState?.items || []).length + 1;
    const id = `MKR-${crypto.randomUUID()}`;
    await applyAction(ACTION_TYPES.MAP_ITEM_ADD, {
      item: {
        id,
        lat: center.lat,
        lng: center.lng,
        label: `Marker ${count}`
      }
    });
    setSelectedMarker(id);
  } catch (error) {
    showToast(error.message || "Add marker rejected");
  }
});

ui.removeMarkerBtn.addEventListener("click", async () => {
  if (!selectedMarkerId) {
    showToast("Select a marker to remove");
    return;
  }
  try {
    await applyAction(ACTION_TYPES.MAP_ITEM_REMOVE, { itemId: selectedMarkerId });
    setSelectedMarker(null);
  } catch (error) {
    showToast(error.message || "Remove rejected");
  }
});

ui.moveMarkerBtn.addEventListener("click", async () => {
  if (!selectedMarkerId) {
    showToast("Select a marker to move");
    return;
  }
  try {
    const center = map.getCenter();
    await applyAction(ACTION_TYPES.MAP_ITEM_UPDATE, {
      itemId: selectedMarkerId,
      changes: { lat: center.lat, lng: center.lng }
    });
  } catch (error) {
    showToast(error.message || "Move rejected");
  }
});

ui.addStagingBtn.addEventListener("click", async () => {
  const name = (ui.stagingName.value || "").trim();
  if (!name) {
    showToast("Enter a staging asset name");
    return;
  }
  try {
    await applyAction(ACTION_TYPES.STAGING_ENTRY_ADD, {
      entry: {
        id: `STG-${crypto.randomUUID()}`,
        name,
        rate: Math.max(0, Number(ui.stagingRate.value || 0)),
        status: "active",
        placedAt: new Date().toISOString()
      }
    });
    ui.stagingName.value = "";
    ui.stagingRate.value = "";
  } catch (error) {
    showToast(error.message || "Staging add rejected");
  }
});

ui.addNoteBtn.addEventListener("click", async () => {
  const note = (ui.noteInput.value || "").trim();
  if (!note) return;
  try {
    await applyAction(ACTION_TYPES.NOTE_ADD, { note });
    ui.noteInput.value = "";
  } catch (error) {
    showToast(error.message || "Note rejected");
  }
});

[ui.authorName, ui.authorRole, ui.authorAgency].forEach((el) => {
  el.addEventListener("change", saveProfile);
});

loadProfile();
refreshIncidentsList().catch((error) => showToast(error.message || "Initialization failed"));
