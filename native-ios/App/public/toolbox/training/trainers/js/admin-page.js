import {
  AVAILABILITY_OPTIONS,
  BACKGROUND_OPTIONS,
  CERTIFICATION_OPTIONS,
  CLASS_SIZE_OPTIONS,
  CUSTOM_CURRICULUM_OPTIONS,
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
import { signIn, signOut, userIsSuperAdmin } from "./auth.js";
import { normalizeTrainerArray, normalizeTrainerRecord, trainerToDbRow } from "./trainer-schema.js";
import { DEMO_TRAINERS } from "./demo-data.js";
import { buildModerationUpdate, DEFAULT_REJECTION_REASON } from "./admin-moderation.js";
import { getSupabaseClient, hasSupabaseConfig } from "./supabase-client.js";
import { createCheckbox, createOption, escapeHtml, setStatus } from "./utils.js";

function el(id) {
  return document.getElementById(id);
}

const state = {
  user: null,
  trainers: [],
  tab: "pending",
  editTarget: null
};

const ui = {
  authCard: el("adminAuthCard"),
  authForm: el("authForm"),
  authStatus: el("authStatus"),
  panel: el("adminPanel"),
  status: el("status"),
  userBadge: el("userBadge"),
  list: el("adminList"),
  tabButtons: Array.from(document.querySelectorAll(".tabBtn")),
  btnSignOut: el("btnSignOut"),
  btnRefresh: el("btnRefresh"),
  btnSeedDemo: el("btnSeedDemo"),
  btnImportLegacy: el("btnImportLegacy"),
  editDialog: el("editDialog"),
  editForm: el("editForm")
};

function buildEditOptions() {
  const checkboxData = {
    discipline: DISCIPLINE_OPTIONS,
    hazmatSpecialties: HAZMAT_SPECIALTY_OPTIONS,
    certifications: CERTIFICATION_OPTIONS,
    background: BACKGROUND_OPTIONS,
    industryExperience: INDUSTRY_EXPERIENCE_OPTIONS,
    trainingType: TRAINING_TYPE_OPTIONS
  };

  Object.entries(checkboxData).forEach(([field, options]) => {
    const mount = el(`edit${field[0].toUpperCase()}${field.slice(1)}Options`);
    options.forEach((value) => mount.appendChild(createCheckbox(`edit-${field}`, value)));
  });

  const selects = {
    editTravelCapability: TRAVEL_CAPABILITY_OPTIONS,
    editState: STATE_OPTIONS,
    editRegion: REGION_OPTIONS,
    editExperienceLevel: EXPERIENCE_LEVEL_OPTIONS,
    editClassSize: CLASS_SIZE_OPTIONS,
    editCustomCurriculum: CUSTOM_CURRICULUM_OPTIONS,
    editAvailability: AVAILABILITY_OPTIONS,
    editRecordStatus: ["pending", "approved", "rejected"]
  };

  Object.entries(selects).forEach(([id, options]) => {
    const select = el(id);
    options.forEach((value) => select.appendChild(createOption(value)));
  });
}

function checkedValues(name) {
  return Array.from(ui.editForm.querySelectorAll(`input[name="${name}"]:checked`)).map((input) => input.value);
}

function setChecked(name, values) {
  ui.editForm.querySelectorAll(`input[name="${name}"]`).forEach((input) => {
    input.checked = values.includes(input.value);
  });
}

function statusBadge(status) {
  const color = status === "approved" ? "#36d399" : status === "rejected" ? "#ff8080" : "#ffd100";
  return `<span style="color:${color};font-weight:700;text-transform:uppercase;">${escapeHtml(status)}</span>`;
}

function renderList() {
  const filtered = state.trainers.filter((trainer) => trainer.recordStatus === state.tab);
  ui.list.innerHTML = "";

  if (!filtered.length) {
    ui.list.innerHTML = '<div class="emptyState">No trainer records in this state.</div>';
    return;
  }

  filtered.forEach((trainer) => {
    const div = document.createElement("article");
    div.className = "adminCard";
    div.innerHTML = `
      <h4>${escapeHtml(trainer.name)} (${statusBadge(trainer.recordStatus)})</h4>
      <div class="adminMeta">${escapeHtml(trainer.org || "Independent")} | ${escapeHtml(trainer.state || "No state")} | ${escapeHtml(trainer.travelCapability || "Travel n/a")}</div>
      <div class="adminMeta">Discipline: ${escapeHtml(trainer.discipline.join(", ") || "n/a")}</div>
      <div class="adminMeta">Submitted: ${escapeHtml(trainer.submittedAt || "")}</div>
      ${trainer.rejectionReason ? `<div class="adminMeta">Rejection reason: ${escapeHtml(trainer.rejectionReason)}</div>` : ""}
      <div class="actions sectionSpacer">
        <button class="miniBtn" type="button" data-action="edit" data-id="${escapeHtml(trainer.id)}">Edit</button>
        <button class="miniBtn" type="button" data-action="approve" data-id="${escapeHtml(trainer.id)}">Approve</button>
        <button class="miniBtn" type="button" data-action="reject" data-id="${escapeHtml(trainer.id)}">Reject</button>
      </div>
    `;
    ui.list.appendChild(div);
  });
}

function activeAdminIdentifier() {
  return state.user?.email || state.user?.id || "unknown-admin";
}

async function updateTrainerStatus(trainer, status) {
  let rejectionReasonInput;
  if (status === "rejected") {
    rejectionReasonInput = prompt(
      `Rejection reason (leave blank to use: ${DEFAULT_REJECTION_REASON}):`,
      trainer.rejectionReason || ""
    );
  }

  const decision = buildModerationUpdate({
    trainer,
    status,
    adminIdentifier: activeAdminIdentifier(),
    rejectionReasonInput
  });

  if (decision.cancelled) {
    return { cancelled: true };
  }

  const supabase = getSupabaseClient();
  const { error } = await supabase.from(TABLE_NAME).update(decision.update).eq("id", trainer.id);
  if (error) {
    throw new Error(error.message);
  }

  return { cancelled: false };
}

async function loadAll() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from(TABLE_NAME).select("*").order("submitted_at", { ascending: false });
  if (error) {
    throw new Error(error.message);
  }
  state.trainers = normalizeTrainerArray(data || []);
  renderList();
}

async function ensureAdminSession() {
  if (!hasSupabaseConfig()) {
    setStatus(ui.authStatus, "Supabase config missing. Configure window.TRAINER_LOCATOR_CONFIG first.", "bad");
    return;
  }

  const supabase = getSupabaseClient();
  const { data } = await supabase.auth.getUser();
  const user = data?.user || null;

  if (user && userIsSuperAdmin(user)) {
    state.user = user;
    ui.userBadge.textContent = `Signed in as ${user.email}`;
    ui.authCard.hidden = true;
    ui.panel.hidden = false;
    await loadAll();
    setStatus(ui.status, "Admin dataset loaded.", "ok");
    return;
  }

  state.user = null;
  ui.authCard.hidden = false;
  ui.panel.hidden = true;
  if (user && !userIsSuperAdmin(user)) {
    await signOut();
    setStatus(ui.authStatus, "This account is not authorized for Super Admin access.", "bad");
  }
}

function openEditor(trainerId) {
  const trainer = state.trainers.find((item) => item.id === trainerId);
  if (!trainer) {
    return;
  }
  state.editTarget = trainer;

  el("editName").value = trainer.name;
  el("editOrg").value = trainer.org;
  el("editEmail").value = trainer.email;
  el("editPhone").value = trainer.phone;
  el("editSpecialty").value = trainer.specialty;
  el("editTopics").value = trainer.topics;
  el("editNotes").value = trainer.notes;
  el("editLat").value = trainer.lat ?? "";
  el("editLng").value = trainer.lng ?? "";
  el("editLocationLabel").value = trainer.locationLabel;
  el("editTravelCapability").value = trainer.travelCapability;
  el("editState").value = trainer.state;
  el("editRegion").value = trainer.region;
  el("editExperienceLevel").value = trainer.experienceLevel;
  el("editClassSize").value = trainer.classSize;
  el("editCustomCurriculum").value = trainer.customCurriculum;
  el("editAvailability").value = trainer.availability;
  el("editRecordStatus").value = trainer.recordStatus;
  el("editRejectionReason").value = trainer.rejectionReason;

  setChecked("edit-discipline", trainer.discipline);
  setChecked("edit-hazmatSpecialties", trainer.hazmatSpecialties);
  setChecked("edit-certifications", trainer.certifications);
  setChecked("edit-background", trainer.background);
  setChecked("edit-industryExperience", trainer.industryExperience);
  setChecked("edit-trainingType", trainer.trainingType);

  ui.editDialog.showModal();
}

function getEditPayload() {
  const merged = {
    ...state.editTarget,
    name: el("editName").value,
    org: el("editOrg").value,
    email: el("editEmail").value,
    phone: el("editPhone").value,
    specialty: el("editSpecialty").value,
    topics: el("editTopics").value,
    notes: el("editNotes").value,
    lat: Number.parseFloat(el("editLat").value),
    lng: Number.parseFloat(el("editLng").value),
    locationLabel: el("editLocationLabel").value,
    discipline: checkedValues("edit-discipline"),
    hazmatSpecialties: checkedValues("edit-hazmatSpecialties"),
    travelCapability: el("editTravelCapability").value,
    state: el("editState").value,
    region: el("editRegion").value,
    certifications: checkedValues("edit-certifications"),
    experienceLevel: el("editExperienceLevel").value,
    background: checkedValues("edit-background"),
    industryExperience: checkedValues("edit-industryExperience"),
    trainingType: checkedValues("edit-trainingType"),
    classSize: el("editClassSize").value,
    customCurriculum: el("editCustomCurriculum").value,
    availability: el("editAvailability").value,
    recordStatus: el("editRecordStatus").value,
    rejectionReason: el("editRejectionReason").value,
    reviewedBy: activeAdminIdentifier(),
    reviewedAt: new Date().toISOString()
  };

  if (!Number.isFinite(merged.lat)) {
    merged.lat = null;
  }
  if (!Number.isFinite(merged.lng)) {
    merged.lng = null;
  }

  merged.visibility = merged.recordStatus === "approved" ? "public" : "admin-only";
  return normalizeTrainerRecord(merged);
}

async function saveEdit(event) {
  event.preventDefault();
  if (!state.editTarget) {
    return;
  }

  try {
    const payload = getEditPayload();
    const supabase = getSupabaseClient();
    const { error } = await supabase.from(TABLE_NAME).update(trainerToDbRow(payload)).eq("id", payload.id);
    if (error) {
      throw new Error(error.message);
    }
    ui.editDialog.close();
    setStatus(ui.status, "Trainer record updated.", "ok");
    await loadAll();
  } catch (error) {
    setStatus(ui.status, error.message || "Update failed.", "bad");
  }
}

async function seedDemoData() {
  const supabase = getSupabaseClient();
  const rows = DEMO_TRAINERS.map((record) => trainerToDbRow(normalizeTrainerRecord(record)));
  const { error } = await supabase.from(TABLE_NAME).upsert(rows, { onConflict: "id" });
  if (error) {
    throw new Error(error.message);
  }
}

function loadLegacyLocalPins() {
  const keys = ["trainerLocatorPins_v1", "trainerLocatorPins_v2"];
  for (const key of keys) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) {
        continue;
      }
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) {
        return parsed;
      }
    } catch {
      // ignore malformed local data
    }
  }
  return [];
}

async function importLegacyData() {
  const legacy = loadLegacyLocalPins().map((record) =>
    normalizeTrainerRecord({
      ...record,
      submitterType: record.submitterType || "imported",
      submittedAt: record.submittedAt || new Date().toISOString(),
      recordStatus: record.recordStatus || "pending",
      visibility: record.recordStatus === "approved" ? "public" : "admin-only"
    })
  );

  if (!legacy.length) {
    throw new Error("No legacy localStorage trainer records found.");
  }

  const rows = legacy.map((record) => trainerToDbRow(record));
  const supabase = getSupabaseClient();
  const { error } = await supabase.from(TABLE_NAME).upsert(rows, { onConflict: "id" });
  if (error) {
    throw new Error(error.message);
  }
}

function bindEvents() {
  ui.authForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const email = el("email").value.trim();
      const password = el("password").value;
      setStatus(ui.authStatus, "Signing in...");
      const { error } = await signIn(email, password);
      if (error) {
        throw new Error(error.message);
      }
      await ensureAdminSession();
    } catch (error) {
      setStatus(ui.authStatus, error.message || "Sign-in failed.", "bad");
    }
  });

  ui.btnSignOut.addEventListener("click", async () => {
    await signOut();
    state.user = null;
    ui.panel.hidden = true;
    ui.authCard.hidden = false;
    setStatus(ui.authStatus, "Signed out.", "ok");
  });

  ui.btnRefresh.addEventListener("click", async () => {
    try {
      await loadAll();
      setStatus(ui.status, "Data refreshed.", "ok");
    } catch (error) {
      setStatus(ui.status, error.message || "Refresh failed.", "bad");
    }
  });

  ui.btnSeedDemo.addEventListener("click", async () => {
    try {
      await seedDemoData();
      await loadAll();
      setStatus(ui.status, "Demo records seeded (approved/pending/rejected).", "ok");
    } catch (error) {
      setStatus(ui.status, error.message || "Seed failed.", "bad");
    }
  });

  ui.btnImportLegacy.addEventListener("click", async () => {
    try {
      await importLegacyData();
      await loadAll();
      setStatus(ui.status, "Legacy local trainer records imported.", "ok");
    } catch (error) {
      setStatus(ui.status, error.message || "Legacy import failed.", "bad");
    }
  });

  ui.tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.tab = button.getAttribute("data-tab");
      ui.tabButtons.forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      renderList();
    });
  });

  ui.list.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) {
      return;
    }

    const trainer = state.trainers.find((item) => item.id === button.getAttribute("data-id"));
    if (!trainer) {
      return;
    }

    const action = button.getAttribute("data-action");
    try {
      if (action === "edit") {
        openEditor(trainer.id);
        return;
      }
      if (action === "approve") {
        const result = await updateTrainerStatus(trainer, "approved");
        if (result?.cancelled) {
          setStatus(ui.status, "Approval cancelled.");
          return;
        }
      }
      if (action === "reject") {
        const result = await updateTrainerStatus(trainer, "rejected");
        if (result?.cancelled) {
          setStatus(ui.status, "Reject action cancelled.");
          return;
        }
      }
      await loadAll();
      setStatus(ui.status, "Trainer status updated.", "ok");
    } catch (error) {
      setStatus(ui.status, error.message || "Status update failed.", "bad");
    }
  });

  ui.editForm.addEventListener("submit", saveEdit);
  el("btnCloseDialog").addEventListener("click", () => ui.editDialog.close());
}

async function init() {
  buildEditOptions();
  bindEvents();
  await ensureAdminSession();
}

init();
