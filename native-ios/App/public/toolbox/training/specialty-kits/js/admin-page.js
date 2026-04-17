import * as constants from "./constants.js";
import * as schema from "./kit-schema.js";
import { signIn, signOut, userIsSuperAdmin } from "./auth.js";
import { getSupabaseClient, hasSupabaseConfig } from "./supabase-client.js";
import { escapeHtml, el } from "./utils.js";

const DEFAULT_REJECTION_REASON = "Kit does not meet listing requirements";

const state = {
  user: null,
  kits: [],
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
  emailInput: el("emailInput"),
  passwordInput: el("passwordInput"),
  editModal: el("editModal"),
  editForm: el("editForm"),
  editStatus: el("editStatus"),
  btnCloseEdit: el("btnCloseEdit"),
  editKitName: el("editKitName"),
  editOrganizationName: el("editOrganizationName"),
  editContactName: el("editContactName"),
  editPhone: el("editPhone"),
  editSecondaryPhone: el("editSecondaryPhone"),
  editEmail: el("editEmail"),
  editWebsite: el("editWebsite"),
  editAddressLine1: el("editAddressLine1"),
  editAddressLine2: el("editAddressLine2"),
  editCity: el("editCity"),
  editState: el("editState"),
  editZip: el("editZip"),
  editRegion: el("editRegion"),
  editLat: el("editLat"),
  editLng: el("editLng"),
  editLocationLabel: el("editLocationLabel"),
  editTravelOrServiceAreaNotes: el("editTravelOrServiceAreaNotes"),
  editKitCategory: el("editKitCategory"),
  editDeploymentType: el("editDeploymentType"),
  editAvailabilityStatus: el("editAvailabilityStatus"),
  editAccessType: el("editAccessType"),
  editStorageEnvironment: el("editStorageEnvironment"),
  editTransportCapable: el("editTransportCapable"),
  editTrailerRequired: el("editTrailerRequired"),
  editResponseTeamIncluded: el("editResponseTeamIncluded"),
  editTrainingRequired: el("editTrainingRequired"),
  editCallBeforeUse: el("editCallBeforeUse"),
  editHoursOfAvailability: el("editHoursOfAvailability"),
  editManufacturer: el("editManufacturer"),
  editModelOrBuild: el("editModelOrBuild"),
  editQuantitySummary: el("editQuantitySummary"),
  editNotes: el("editNotes"),
  editRecordStatus: el("editRecordStatus")
};

function setStatus(msg, klass = "ok") {
  ui.status.innerHTML = `<strong>Status:</strong> <span class="${klass}">${escapeHtml(msg)}</span>`;
}

function statusBadge(status) {
  const color = status === "approved" ? "#36d399" : status === "rejected" ? "#ff8080" : "#ffd100";
  return `<span style="color:${color};font-weight:700;text-transform:uppercase;">${escapeHtml(status)}</span>`;
}

function renderList() {
  const filtered = state.kits.filter((kit) => kit.recordStatus === state.tab);
  ui.list.innerHTML = "";

  if (!filtered.length) {
    ui.list.innerHTML = '<div class="emptyState">No kit records in this state.</div>';
    return;
  }

  filtered.forEach((kit) => {
    const div = document.createElement("article");
    div.className = "adminCard";
    div.innerHTML = `
      <h4>${escapeHtml(kit.kitName)} (${statusBadge(kit.recordStatus)})</h4>
      <div class="adminMeta">${escapeHtml(kit.organizationName || "Organization unspecified")} | ${escapeHtml(kit.state || "No state")} | ${escapeHtml(kit.availabilityStatus || "Availability n/a")}</div>
      <div class="adminMeta">Category: ${escapeHtml(kit.kitCategory || "n/a")}</div>
      <div class="adminMeta">Contact: ${escapeHtml(kit.contactName || "")} ${escapeHtml(kit.phone || "")}</div>
      <div class="adminMeta">Submitted: ${escapeHtml(kit.submittedAt || "")}</div>
      ${kit.rejectionReason ? `<div class="adminMeta">Rejection reason: ${escapeHtml(kit.rejectionReason)}</div>` : ""}
      <div class="actions sectionSpacer">
        <button class="miniBtn" type="button" data-action="view" data-id="${escapeHtml(kit.id)}">View</button>
        <button class="miniBtn" type="button" data-action="edit" data-id="${escapeHtml(kit.id)}">Edit</button>
        <button class="miniBtn" type="button" data-action="approve" data-id="${escapeHtml(kit.id)}">Approve</button>
        <button class="miniBtn" type="button" data-action="reject" data-id="${escapeHtml(kit.id)}">Reject</button>
      </div>
    `;
    ui.list.appendChild(div);
  });
}

function activeAdminIdentifier() {
  return state.user?.email || state.user?.id || "unknown-admin";
}

function setEditStatus(msg, klass = "ok") {
  ui.editStatus.innerHTML = `<strong>Status:</strong> <span class="${klass}">${escapeHtml(msg)}</span>`;
}

function loadKitIntoEditForm(kit) {
  ui.editKitName.value = kit.kitName || "";
  ui.editOrganizationName.value = kit.organizationName || "";
  ui.editContactName.value = kit.contactName || "";
  ui.editPhone.value = kit.phone || "";
  ui.editSecondaryPhone.value = kit.secondaryPhone || "";
  ui.editEmail.value = kit.email || "";
  ui.editWebsite.value = kit.website || "";
  ui.editAddressLine1.value = kit.addressLine1 || "";
  ui.editAddressLine2.value = kit.addressLine2 || "";
  ui.editCity.value = kit.city || "";
  ui.editState.value = kit.state || "";
  ui.editZip.value = kit.zip || "";
  ui.editRegion.value = kit.region || "";
  ui.editLat.value = kit.lat || "";
  ui.editLng.value = kit.lng || "";
  ui.editLocationLabel.value = kit.locationLabel || "";
  ui.editTravelOrServiceAreaNotes.value = kit.travelOrServiceAreaNotes || "";
  ui.editKitCategory.value = kit.kitCategory || "";
  ui.editDeploymentType.value = kit.deploymentType || "";
  ui.editAvailabilityStatus.value = kit.availabilityStatus || "";
  ui.editAccessType.value = kit.accessType || "";
  ui.editStorageEnvironment.value = kit.storageEnvironment || "";
  ui.editTransportCapable.value = kit.transportCapable || "";
  ui.editTrailerRequired.value = kit.trailerRequired || "";
  ui.editResponseTeamIncluded.value = kit.responseTeamIncluded || "";
  ui.editTrainingRequired.value = kit.trainingRequired || "";
  ui.editCallBeforeUse.value = kit.callBeforeUse || "";
  ui.editHoursOfAvailability.value = kit.hoursOfAvailability || "";
  ui.editManufacturer.value = kit.manufacturer || "";
  ui.editModelOrBuild.value = kit.modelOrBuild || "";
  ui.editQuantitySummary.value = kit.quantitySummary || "";
  ui.editNotes.value = kit.notes || "";
  ui.editRecordStatus.value = kit.recordStatus || "pending";
  setEditStatus("Ready to edit.");
}

async function saveKitChanges(kit) {
  const updates = {
    kit_name: ui.editKitName.value,
    organization_name: ui.editOrganizationName.value,
    contact_name: ui.editContactName.value,
    phone: ui.editPhone.value,
    secondary_phone: ui.editSecondaryPhone.value,
    email: ui.editEmail.value,
    website: ui.editWebsite.value,
    address_line_1: ui.editAddressLine1.value,
    address_line_2: ui.editAddressLine2.value,
    city: ui.editCity.value,
    state: ui.editState.value,
    zip: ui.editZip.value,
    region: ui.editRegion.value,
    lat: Number.parseFloat(ui.editLat.value) || null,
    lng: Number.parseFloat(ui.editLng.value) || null,
    location_label: ui.editLocationLabel.value,
    travel_or_service_area_notes: ui.editTravelOrServiceAreaNotes.value,
    kit_category: ui.editKitCategory.value,
    deployment_type: ui.editDeploymentType.value,
    availability_status: ui.editAvailabilityStatus.value,
    access_type: ui.editAccessType.value,
    storage_environment: ui.editStorageEnvironment.value,
    transport_capable: ui.editTransportCapable.value,
    trailer_required: ui.editTrailerRequired.value,
    response_team_included: ui.editResponseTeamIncluded.value,
    training_required: ui.editTrainingRequired.value,
    call_before_use: ui.editCallBeforeUse.value,
    hours_of_availability: ui.editHoursOfAvailability.value,
    manufacturer: ui.editManufacturer.value,
    model_or_build: ui.editModelOrBuild.value,
    quantity_summary: ui.editQuantitySummary.value,
    notes: ui.editNotes.value,
    record_status: ui.editRecordStatus.value,
    updated_at: new Date().toISOString()
  };

  // Auto-update visibility based on status
  if (updates.record_status === "approved") {
    updates.visibility = "public";
  } else {
    updates.visibility = "admin-only";
  }

  const supabase = getSupabaseClient();
  const { error } = await supabase.from(constants.TABLE_NAME).update(updates).eq("id", kit.id);
  if (error) {
    throw new Error(error.message);
  }

  return true;
}

function closeEditModal() {
  ui.editModal.style.display = "none";
  state.editTarget = null;
  ui.editForm.reset();
}

function buildEditFormOptions() {
  const selects = {
    editKitCategory: constants.KIT_CATEGORY_OPTIONS,
    editDeploymentType: constants.DEPLOYMENT_TYPE_OPTIONS,
    editAvailabilityStatus: constants.AVAILABILITY_STATUS_OPTIONS,
    editAccessType: constants.ACCESS_TYPE_OPTIONS,
    editStorageEnvironment: constants.STORAGE_ENVIRONMENT_OPTIONS,
    editTransportCapable: constants.TRANSPORT_CAPABLE_OPTIONS,
    editTrailerRequired: constants.TRAILER_REQUIRED_OPTIONS,
    editResponseTeamIncluded: constants.RESPONSE_TEAM_INCLUDED_OPTIONS,
    editTrainingRequired: constants.TRAINING_REQUIRED_OPTIONS,
    editCallBeforeUse: constants.CALL_BEFORE_USE_OPTIONS
  };

  Object.entries(selects).forEach(([fieldName, options]) => {
    const select = ui[fieldName];
    options.forEach((option) => {
      const opt = document.createElement("option");
      opt.value = option;
      opt.textContent = option;
      select.appendChild(opt);
    });
  });
}

async function updateKitStatus(kit, status) {
  let rejectionReason = "";
  if (status === "rejected") {
    rejectionReason = prompt(
      `Rejection reason (leave blank to use default):`,
      kit.rejectionReason || ""
    );
    if (rejectionReason === null) return; // User cancelled
    if (!rejectionReason) rejectionReason = DEFAULT_REJECTION_REASON;
  }

  const update = {
    record_status: status,
    visibility: status === "approved" ? "public" : "admin-only",
    reviewed_at: new Date().toISOString(),
    reviewed_by: activeAdminIdentifier()
  };

  if (status === "rejected") {
    update.rejection_reason = rejectionReason;
  }

  const supabase = getSupabaseClient();
  const { error } = await supabase.from(constants.TABLE_NAME).update(update).eq("id", kit.id);
  if (error) {
    throw new Error(error.message);
  }

  return true;
}

async function loadAll() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(constants.TABLE_NAME)
    .select("*")
    .order("submitted_at", { ascending: false });
  if (error) {
    throw new Error(error.message);
  }
  state.kits = schema.normalizeKitArray(data || []);
  renderList();
}

async function ensureAdminSession() {
  if (!hasSupabaseConfig()) {
    setStatus("Supabase config missing. Configure window.SPECIALTY_KITS_CONFIG first.", "bad");
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
    setStatus(`Admin dataset loaded (${state.kits.length} total kits).`, "ok");
    return;
  }

  state.user = null;
  ui.authCard.hidden = false;
  ui.panel.hidden = true;
  if (user && !userIsSuperAdmin(user)) {
    await signOut();
    setStatus("This account is not authorized for Super Admin access.", "bad");
  }
}

// Event listeners
ui.authForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = ui.emailInput.value.trim();
  const password = ui.passwordInput.value;

  try {
    ui.authStatus.innerHTML = `<strong>Status:</strong> <span class="ok">Signing in...</span>`;
    await signIn(email, password);
    await ensureAdminSession();
  } catch (err) {
    console.error(err);
    ui.authStatus.innerHTML = `<strong>Status:</strong> <span class="bad">Auth error: ${escapeHtml(err.message)}</span>`;
  }
});

ui.btnSignOut.addEventListener("click", async () => {
  try {
    await signOut();
    state.user = null;
    await ensureAdminSession();
    setStatus("Signed out.", "ok");
  } catch (err) {
    console.error(err);
    setStatus(`Error: ${err.message}`, "bad");
  }
});

ui.btnRefresh.addEventListener("click", async () => {
  try {
    setStatus("Refreshing...", "ok");
    await loadAll();
    setStatus("Data refreshed.", "ok");
  } catch (err) {
    console.error(err);
    setStatus(`Error: ${err.message}`, "bad");
  }
});

ui.tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    ui.tabButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    state.tab = btn.dataset.tab;
    renderList();
  });
});

ui.list.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;

  const action = btn.dataset.action;
  const kitId = btn.dataset.id;
  const kit = state.kits.find((k) => k.id === kitId);
  if (!kit) return;

  try {
    if (action === "approve") {
      await updateKitStatus(kit, "approved");
      kit.recordStatus = "approved";
      kit.visibility = "public";
      renderList();
      setStatus(`Kit "${kit.kitName}" approved.`, "ok");
    } else if (action === "reject") {
      await updateKitStatus(kit, "rejected");
      kit.recordStatus = "rejected";
      kit.visibility = "admin-only";
      renderList();
      setStatus(`Kit "${kit.kitName}" rejected.`, "ok");
    } else if (action === "edit") {
      state.editTarget = kit;
      loadKitIntoEditForm(kit);
      ui.editModal.style.display = "block";
    } else if (action === "view") {
      const details = `
Kit Name: ${kit.kitName}
Organization: ${kit.organizationName}
Contact: ${kit.contactName}
Phone: ${kit.phone}
Email: ${kit.email}

Category: ${kit.kitCategory}
Types: ${kit.kitTypes?.join(", ") || "n/a"}
Hazards: ${kit.hazardFocus?.join(", ") || "n/a"}
Capabilities: ${kit.equipmentCapabilities?.join(", ") || "n/a"}

Location: ${kit.city}, ${kit.state} ${kit.zip}
Region: ${kit.region}
Coordinates: ${kit.lat}, ${kit.lng}

Availability: ${kit.availabilityStatus}
Access Type: ${kit.accessType}
Storage: ${kit.storageEnvironment}
Transport Capable: ${kit.transportCapable}

Notes: ${kit.notes || "n/a"}
      `;
      alert(details);
    }
  } catch (err) {
    console.error(err);
    setStatus(`Error: ${err.message}`, "bad");
  }
});

ui.btnCloseEdit.addEventListener("click", () => {
  closeEditModal();
});

ui.editForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!state.editTarget) return;

  try {
    setEditStatus("Saving changes...", "ok");
    await saveKitChanges(state.editTarget);

    // Update local state
    Object.assign(state.editTarget, {
      kitName: ui.editKitName.value,
      organizationName: ui.editOrganizationName.value,
      contactName: ui.editContactName.value,
      phone: ui.editPhone.value,
      secondaryPhone: ui.editSecondaryPhone.value,
      email: ui.editEmail.value,
      website: ui.editWebsite.value,
      addressLine1: ui.editAddressLine1.value,
      addressLine2: ui.editAddressLine2.value,
      city: ui.editCity.value,
      state: ui.editState.value,
      zip: ui.editZip.value,
      region: ui.editRegion.value,
      lat: Number.parseFloat(ui.editLat.value) || null,
      lng: Number.parseFloat(ui.editLng.value) || null,
      locationLabel: ui.editLocationLabel.value,
      travelOrServiceAreaNotes: ui.editTravelOrServiceAreaNotes.value,
      kitCategory: ui.editKitCategory.value,
      deploymentType: ui.editDeploymentType.value,
      availabilityStatus: ui.editAvailabilityStatus.value,
      accessType: ui.editAccessType.value,
      storageEnvironment: ui.editStorageEnvironment.value,
      transportCapable: ui.editTransportCapable.value,
      trailerRequired: ui.editTrailerRequired.value,
      responseTeamIncluded: ui.editResponseTeamIncluded.value,
      trainingRequired: ui.editTrainingRequired.value,
      callBeforeUse: ui.editCallBeforeUse.value,
      hoursOfAvailability: ui.editHoursOfAvailability.value,
      manufacturer: ui.editManufacturer.value,
      modelOrBuild: ui.editModelOrBuild.value,
      quantitySummary: ui.editQuantitySummary.value,
      notes: ui.editNotes.value,
      recordStatus: ui.editRecordStatus.value
    });

    setEditStatus("Changes saved successfully!", "ok");
    renderList();
    setTimeout(() => closeEditModal(), 1000);
  } catch (err) {
    console.error(err);
    setEditStatus(`Error: ${err.message}`, "bad");
  }
});

// Init
buildEditFormOptions();
ensureAdminSession();
